/**
 * @file ai.js
 * @description AI Command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const yaml = require('js-yaml');
const fs = require('fs');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
let models = JSON.parse(fs.readFileSync('./models-user.json', 'utf8'));
if (process.env.DEFAULT_MODEL) {
    const defaultModel = process.env.DEFAULT_MODEL.split(',')[0].trim();
    if (defaultModel) {
        models.default = defaultModel;
    }
}
const roles = yaml.load(fs.readFileSync('./roles.yaml', 'utf8'));
const UserSettings = require('../../Models/UserSettings');
const { getText } = require('../../Functions/i18n');
const { specialUsers, modelGroups, getModelGroup } = require('../../Events/AICore/models');
const { webhookLog } = require('../../Events/AICore/utils');
const { deleteUserImages } = require('../../utils/r2Uploader');
const { loadSkills, getSkillStatusForUser } = require('../../Events/AICore/skills');

const contextObj = {
    userId: 'system',
    guildId: null,
};
const skillChoices = [...loadSkills().values()].map(skill => ({ name: skill.name, value: skill.id })).slice(0, 25);

module.exports = {
    data: new SlashCommandBuilder()
        .setName(getText('commands.ai.name', contextObj))
        .setDescription(getText('commands.ai.description', contextObj))
        
        //model subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName(getText('commands.ai.options.model.name', contextObj))
                .setDescription(getText('commands.ai.options.model.description', contextObj))
                .addStringOption(option =>
                    option.setName(getText('commands.ai.options.model.options.model.name', contextObj))
                        .setDescription(getText('commands.ai.options.model.options.model.description', contextObj))
                        .setRequired(true)
                        .addChoices(...Object.keys(models).map(model => ({ name: model, value: model })))
                )
        )
        
        //role subcommand
        .addSubcommand(subcommand =>
            subcommand
                .setName(getText('commands.ai.options.role.name', contextObj))
                .setDescription(getText('commands.ai.options.role.description', contextObj))
                .addStringOption(option => {
                    option.setName(getText('commands.ai.options.role.options.role.name', contextObj))
                        .setDescription(getText('commands.ai.options.role.options.role.description', contextObj))
                        .setRequired(true);
                    const choices = [];
                    for (const role in roles) {
                        choices.push({ name: role, value: role });
                    }
                    option.addChoices(...choices); 
                    return option;
                })
        )
        
        //chat subcommand
        .addSubcommandGroup(group =>
            group
                .setName(getText('commands.ai.options.chat.name', contextObj))
                .setDescription(getText('commands.ai.options.chat.description', contextObj))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName(getText('commands.ai.options.chat.options.clear.name', contextObj))
                        .setDescription(getText('commands.ai.options.chat.options.clear.description', contextObj))
                )
        )

        // skill subcommand group
        .addSubcommandGroup(group =>
            group
                .setName('skill')
                .setDescription('Manage your AI skills')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List available AI skills')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('enable')
                        .setDescription('Enable an AI skill for your account')
                        .addStringOption(option =>
                            option
                                .setName('skill')
                                .setDescription('Skill to enable')
                                .setRequired(true)
                                .addChoices(...skillChoices)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('disable')
                        .setDescription('Disable an AI skill for your account')
                        .addStringOption(option =>
                            option
                                .setName('skill')
                                .setDescription('Skill to disable')
                                .setRequired(true)
                                .addChoices(...skillChoices)
                        )
                )
        ),

    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };

        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);

        // for /ai model
        if (subcommand === "model" && !group) {
            const selectedModelKey = interaction.options.getString('model');

            if (models[selectedModelKey]) {
                try {
                    if (selectedModelKey === 'default') {
                        delete client.userModels[interaction.user.id];
                    } else {
                        client.userModels[interaction.user.id] = selectedModelKey;
                    }

                    const modelName = models[selectedModelKey];
                    const { name: groupName, iconURL } = getModelGroup(modelName);
                    
                    const embed = new EmbedBuilder()
                        .setColor(interaction.member.displayHexColor)
                        .setTitle(getText('commands.ai.messages.model.success', contextObj))
                        .setDescription(getText('commands.ai.messages.model.description', contextObj, { 
                            model: `${selectedModelKey} (${models[selectedModelKey]})`
                        }))
                        .setThumbnail(iconURL)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed] });
                } catch (error) {
                    console.error('設定模型時出錯:', error);
                    await interaction.reply({ 
                        content: getText('commands.ai.messages.model.error', contextObj, { 
                            error: error.message
                        }), 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            } else {
                await interaction.reply({ 
                    content: getText('commands.ai.messages.model.invalid', contextObj, {
                        models: Object.keys(models).join(', ')
                    }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
        
        // for /ai role
        else if (subcommand === "role" && !group) {
            const selectedRole = interaction.options.getString('role');

            if (roles[selectedRole]) {
                const specialUser = specialUsers[interaction.user.id];
                const relation = specialUser ? specialUser.relation : '用戶';
                const username = specialUser ? specialUser.username : (interaction.member ? interaction.member.displayName : interaction.user.username);
                
                client.userModels[interaction.user.id] = {
                    role: selectedRole
                };
                
                const webSearchStatus = client.userNetSearchEnabled.get(interaction.user.id) ? "開啟" : "關閉，需要用戶在多功能選單裏面打開";
                const deepThinkingStatus = client.userDeepThinkingEnabled.get(interaction.user.id) ? "開啟" : "關閉，需要用戶在多功能選單裏面打開";
                
                const systemContent = roles[selectedRole]
                    .replace(/{username}/g, username)
                    .replace(/{relation}/g, relation)
                    .replace(/{WebSerach}/g, webSearchStatus)
                    .replace(/{DeepThinking}/g, deepThinkingStatus);
                
                if (client.userConversations[interaction.user.id]) {
                    let conversation = client.userConversations[interaction.user.id];
                    if (conversation.length > 0 && conversation[0].role === 'system') {
                        conversation[0].content = systemContent;
                    } else {
                        conversation.unshift({ role: 'system', content: systemContent });
                    }
                } else {
                    client.userConversations[interaction.user.id] = [
                        { role: 'system', content: systemContent }
                    ];
                }

                await UserSettings.findOneAndUpdate(
                    { userId: interaction.user.id },
                    { 
                        model: selectedRole,
                        lastUpdated: new Date()
                    },
                    { upsert: true }
                );
                    
                const embed = new EmbedBuilder()
                    .setColor(interaction.member.displayHexColor)
                    .setTitle(getText('commands.ai.messages.role.successTitle', contextObj, { default: '角色設定成功' }))
                    .setDescription(getText('commands.ai.messages.role.success', contextObj, { 
                        role: selectedRole,
                        default: `你的AI角色已設定為: ${selectedRole}`
                    }))
                    .setThumbnail(interaction.user.displayAvatarURL());

                await interaction.reply({ embeds: [embed] });
                await webhookLog(`用戶 ${interaction.user.username} 的聊天角色已設定為：${selectedRole}`, 'ai-role');
                    
            } else {
                await interaction.reply({ 
                    content: getText('commands.ai.messages.role.invalid', contextObj, { 
                        roles: Object.keys(roles).join(', '),
                        default: `無效的角色。可用的角色有: ${Object.keys(roles).join(', ')}`
                    }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
        
        // for /ai chat clear
        else if (group === "chat" && subcommand === "clear") {
            if (client.userConversations[interaction.user.id]) {
                const initialConversation = client.userConversations[interaction.user.id].filter(conversation => conversation.role === 'system');
        
                if (client.userConversations[interaction.user.id].length > initialConversation.length) {
                    delete client.userConversations[interaction.user.id];
                    client.userActiveSkills?.delete(interaction.user.id);

                    client.userConversations[interaction.user.id] = initialConversation;
        
                    const deleteResult = await deleteUserImages(interaction.user.id);
        
                    const embed = new EmbedBuilder()
                        .setColor(interaction.member.displayHexColor)
                        .setTitle(getText('commands.ai.messages.chat.clear.title', contextObj, { default: '聊天記錄已清除' }))
                        .setDescription(getText('commands.ai.messages.chat.clear.description', contextObj, { default: '你與AI的所有對話記錄已被成功清除。' }))
                        .setThumbnail(client.user.displayAvatarURL());
        
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ 
                        content: getText('commands.ai.messages.chat.clear.noHistory', contextObj, { default: '你沒有與AI的聊天記錄。' }), 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            } else {
                await interaction.reply({ 
                    content: getText('commands.ai.messages.chat.clear.noHistory', contextObj, { default: '你沒有與AI的聊天記錄。' }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }

        // for /ai skill list|enable|disable
        else if (group === "skill") {
            if (!client.userEnabledSkills) client.userEnabledSkills = new Map();
            if (!client.userDisabledSkills) client.userDisabledSkills = new Map();

            const userId = interaction.user.id;
            const selectedSkillId = interaction.options.getString('skill');

            if (subcommand === "list") {
                const skillStatus = getSkillStatusForUser(client, userId);
                const description = skillStatus.length
                    ? skillStatus.map(skill => {
                        const status = skill.available ? 'Enabled' : 'Disabled';
                        const source = skill.userDisabled
                            ? 'user disabled'
                            : skill.userEnabled
                                ? 'user enabled'
                                : skill.enabled
                                    ? 'global default'
                                    : 'globally disabled';
                        return `**${skill.name}** \`${skill.id}\`\n${status} - ${source}\n${skill.description}`;
                    }).join('\n\n')
                    : 'No skills are loaded.';

                const embed = new EmbedBuilder()
                    .setColor(interaction.member?.displayHexColor || 0x5865F2)
                    .setTitle('AI Skills')
                    .setDescription(description)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            const allSkillIds = new Set([...loadSkills().keys()]);
            if (!selectedSkillId || !allSkillIds.has(selectedSkillId)) {
                await interaction.reply({
                    content: `Unknown skill: ${selectedSkillId || 'none'}`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const enabledSkills = new Set(client.userEnabledSkills.get(userId) || []);
            const disabledSkills = new Set(client.userDisabledSkills.get(userId) || []);

            if (subcommand === "enable") {
                disabledSkills.delete(selectedSkillId);
                enabledSkills.add(selectedSkillId);
            } else if (subcommand === "disable") {
                enabledSkills.delete(selectedSkillId);
                disabledSkills.add(selectedSkillId);
                const activeSkills = client.userActiveSkills?.get(userId) || [];
                const nextActiveSkills = activeSkills.filter(skillId => skillId !== selectedSkillId);
                if (nextActiveSkills.length > 0) {
                    client.userActiveSkills.set(userId, nextActiveSkills);
                } else {
                    client.userActiveSkills?.delete(userId);
                }
            }

            const enabledSkillsArray = [...enabledSkills];
            const disabledSkillsArray = [...disabledSkills];
            client.userEnabledSkills.set(userId, enabledSkillsArray);
            client.userDisabledSkills.set(userId, disabledSkillsArray);

            await UserSettings.findOneAndUpdate(
                { userId },
                {
                    enabledSkills: enabledSkillsArray,
                    disabledSkills: disabledSkillsArray,
                    lastUpdated: new Date()
                },
                { upsert: true }
            );

            await interaction.reply({
                content: `Skill \`${selectedSkillId}\` is now ${subcommand === 'enable' ? 'enabled' : 'disabled'} for you.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
}
