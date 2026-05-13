/**
 * @file skills.js
 * @description Skill loading, routing, and prompt assembly for the AI core.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const OpenAI = require('openai');

require('dotenv/config');

const DEFAULT_SKILLS_DIR = path.resolve(process.cwd(), 'src', 'Skills');
const ROUTER_MODEL = process.env.SKILL_ROUTER_MODEL || process.env.ALL_FUNCTION_MODEL || (process.env.DEFAULT_MODEL || '').split(',')[0].trim();

function parseFrontmatter(rawContent, filePath) {
    const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { metadata: {}, body: rawContent.trim() };

    const metadata = yaml.load(match[1]) || {};
    const body = (match[2] || '').trim();
    return { metadata, body };
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean);
}

function normalizeDiscordPersistence(value) {
    const discordPersistence = String(value || 'auto').trim().toLowerCase();
    return ['auto', 'turn', 'conversation'].includes(discordPersistence) ? discordPersistence : 'auto';
}

function getDiscordPersistence(metadata) {
    return normalizeDiscordPersistence(metadata['x-discord-persistence'] || 'auto');
}

function formatNameFromSource(sourceName) {
    const parsed = path.parse(sourceName);
    return (parsed.name || sourceName)
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function slugifyId(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function extractHeading(body) {
    const match = String(body || '').match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
}

function extractDescription(body, skillName) {
    const line = String(body || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .find(item => item && !item.startsWith('#') && !item.startsWith('---'));

    if (!line) return `Prompt guidance for ${skillName}.`;

    return line
        .replace(/[*_`>#-]/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 180)
        .trim() || `Prompt guidance for ${skillName}.`;
}

function buildSkillFromContent({ metadata, body, filePath, sourceName }) {
    const sourceDisplayName = formatNameFromSource(sourceName);
    const id = slugifyId(sourceName);
    const name = String(metadata.name || extractHeading(body) || sourceDisplayName).trim();
    const capabilities = normalizeStringArray(metadata.capabilities);

    return {
        id,
        name,
        description: String(metadata.description || extractDescription(body, name)).trim(),
        enabled: metadata.enabled !== false,
        capabilities,
        discordPersistence: getDiscordPersistence(metadata),
        path: filePath,
        instructions: body
    };
}

function validateSkill(skill, filePath) {
    const required = ['id', 'name', 'description'];
    for (const field of required) {
        if (!skill[field] || typeof skill[field] !== 'string') {
            throw new Error(`Skill ${filePath} is missing required field: ${field}`);
        }
    }

    if (!/^[a-z0-9][a-z0-9-]*$/.test(skill.id)) {
        throw new Error(`Skill ${filePath} has invalid id: ${skill.id}`);
    }

    if (!skill.instructions) {
        throw new Error(`Skill ${filePath} has empty instructions`);
    }
}

function loadSkills(skillsDir = DEFAULT_SKILLS_DIR) {
    const skills = new Map();

    if (!fs.existsSync(skillsDir)) {
        return skills;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const filePath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(filePath)) continue;

        try {
            const rawContent = fs.readFileSync(filePath, 'utf8');
            const { metadata, body } = parseFrontmatter(rawContent, filePath);
            const skill = buildSkillFromContent({
                metadata,
                body,
                filePath,
                sourceName: entry.name
            });

            validateSkill(skill, filePath);
            if (skills.has(skill.id)) {
                throw new Error(`Duplicate skill id: ${skill.id}`);
            }
            skills.set(skill.id, skill);
        } catch (error) {
            console.error(`Failed to load skill from ${filePath}:`, error.message);
        }
    }

    return skills;
}

function installSkills(client) {
    client.skills = loadSkills();
    if (!client.userEnabledSkills) client.userEnabledSkills = new Map();
    if (!client.userDisabledSkills) client.userDisabledSkills = new Map();
    if (!client.userActiveSkills) client.userActiveSkills = new Map();
    console.log(`Loaded ${client.skills.size} AI skills`);
    return client.skills;
}

function getAllSkills(client) {
    if (!client.skills) {
        installSkills(client);
    }
    return client.skills || new Map();
}

function getAvailableSkillsForUser(client, userId) {
    const skills = getAllSkills(client);
    const enabledOverrides = new Set(client.userEnabledSkills?.get(userId) || []);
    const disabled = new Set(client.userDisabledSkills?.get(userId) || []);

    return [...skills.values()].filter(skill => {
        if (disabled.has(skill.id)) return false;
        return skill.enabled || enabledOverrides.has(skill.id);
    });
}

function getSkillStatusForUser(client, userId) {
    const skills = getAllSkills(client);
    const enabledOverrides = new Set(client.userEnabledSkills?.get(userId) || []);
    const disabled = new Set(client.userDisabledSkills?.get(userId) || []);

    return [...skills.values()].map(skill => ({
        ...skill,
        available: !disabled.has(skill.id) && (skill.enabled || enabledOverrides.has(skill.id)),
        userEnabled: enabledOverrides.has(skill.id),
        userDisabled: disabled.has(skill.id)
    }));
}

function getSkillByCapability(client, userId, capability) {
    return getAvailableSkillsForUser(client, userId)
        .find(skill => skill.capabilities.includes(capability));
}

function safeParseJson(content) {
    const cleaned = String(content || '')
        .trim()
        .replace(/^```json\s*|\s*```$/g, '')
        .replace(/^`+|`+$/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : cleaned);
}

function buildRouterPrompt(availableSkills, context) {
    const skillList = availableSkills.map(skill => ({
        key: skill.id,
        name: skill.name,
        description: skill.description,
        capabilities: skill.capabilities,
        kind: skill.capabilities.length > 0 ? 'tool-backed' : 'prompt-only',
        discordPersistence: skill.discordPersistence
    }));

    return [
        'You route a Discord AI request to zero or more safe prompt skills.',
        'Return only compact JSON with this shape: {"skills":["skill-key"],"reason":"short reason"}.',
        'Never answer the user, apologize, explain, or return plain text. If unsure, return {"skills":[],"reason":"uncertain"}.',
        'Only choose skill keys from the provided list.',
        'Choose no skill when the request is normal conversation or no skill materially helps.',
        'Use each skill name and description as the primary discovery signal.',
        'Tool-backed skills activate existing internal bot handlers; prompt-only skills only add temporary response guidance.',
        'Use prompt-only skills when the user asks for that persona, style, domain guidance, or workflow.',
        'Discord runtime may carry persona or mode skills across the conversation; this does not change which skills you should choose for the current request.',
        'Do not choose PDF analysis without PDFs or image generation unless the user wants a new image.',
        'If attachments are present, prefer the matching attachment skill.',
        `Attachment context: ${JSON.stringify(context.attachments || {})}`,
        `Available skills: ${JSON.stringify(skillList)}`
    ].join('\n');
}

function normalizeLookupKey(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveSelectedSkillIds(selectedSkills, availableSkills) {
    if (!Array.isArray(selectedSkills)) return [];

    const lookup = new Map();
    for (const skill of availableSkills) {
        lookup.set(normalizeLookupKey(skill.id), skill.id);
        lookup.set(normalizeLookupKey(skill.name), skill.id);
    }

    return [...new Set(
        selectedSkills
            .map(skillId => lookup.get(normalizeLookupKey(skillId)))
            .filter(Boolean)
    )];
}

function buildRoutingMessages(conversationLog, availableSkills, context) {
    const filteredLog = conversationLog
        .filter(log => log.role !== 'system')
        .slice(-8);

    return [
        { role: 'system', content: buildRouterPrompt(availableSkills, context) },
        ...filteredLog
    ];
}

async function routeSkills({ conversationLog, userId, client, attachments = {} }) {
    const availableSkills = getAvailableSkillsForUser(client, userId);
    if (availableSkills.length === 0 || !ROUTER_MODEL) {
        return { skills: [], reason: '' };
    }

    try {
        const routerClient = new OpenAI({
            apiKey: process.env.DEFAULT_API_KEY,
            baseURL: process.env.DEFAULT_BASE_URL
        });

        const response = await routerClient.chat.completions.create({
            model: ROUTER_MODEL,
            messages: buildRoutingMessages(conversationLog, availableSkills, { attachments }),
            temperature: 0,
            max_tokens: 180
        });

        const rawContent = response.choices[0].message.content;
        const parsed = safeParseJson(rawContent);
        const selectedIds = resolveSelectedSkillIds(parsed.skills, availableSkills);

        return {
            skills: selectedIds,
            reason: typeof parsed.reason === 'string' ? parsed.reason : ''
        };
    } catch (error) {
        const message = error instanceof SyntaxError
            ? 'Skill routing returned non-JSON; continuing without new skill selection.'
            : `Skill routing failed: ${error.message}`;
        console.warn(message);
        return { skills: [], reason: '' };
    }
}

function buildSkillSystemMessage(client, skillIds) {
    if (!skillIds || skillIds.length === 0) return null;

    const skills = getAllSkills(client);
    const selected = skillIds
        .map(id => skills.get(id))
        .filter(Boolean);

    if (selected.length === 0) return null;

    const sections = selected.map(skill => `## ${skill.name} (${skill.id})\n${skill.instructions}`);

    return {
        role: 'system',
        content: [
            'The following temporary skill instructions apply only to this response.',
            'Do not mention skill routing unless the user asks.',
            ...sections
        ].join('\n\n')
    };
}

function injectSkillSystemMessage(conversationLog, skillMessage) {
    if (!skillMessage) return conversationLog;

    const copy = conversationLog.map(message => ({ ...message }));
    const systemIndex = copy.findIndex(message => message.role === 'system');
    if (systemIndex === -1) {
        return [skillMessage, ...copy];
    }

    copy.splice(systemIndex + 1, 0, skillMessage);
    return copy;
}

module.exports = {
    loadSkills,
    installSkills,
    getAllSkills,
    getAvailableSkillsForUser,
    getSkillStatusForUser,
    getSkillByCapability,
    routeSkills,
    buildSkillSystemMessage,
    injectSkillSystemMessage
};
