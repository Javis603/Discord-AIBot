/**
 * @file ai-chat.js
 * @description AI chat module for Discord bot. Handles text, image, PDF, and audio inputs.
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { Client, GatewayIntentBits, Partials, Collection, TextInputStyle, AttachmentBuilder, EmbedBuilder, WebhookClient, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const roles = yaml.load(fs.readFileSync('./roles.yaml', 'utf8'));
const { encode, encodeChat } = require('gpt-tokenizer');
const PDFParser = require('pdf-parse');
const FormData = require('form-data');
const fetch = require('node-fetch');

require('dotenv/config');
const OpenAI = require('openai');

let models = JSON.parse(fs.readFileSync('./models.json', 'utf8'));
if (process.env.DEFAULT_MODEL) {
    models.default = process.env.DEFAULT_MODEL;
}

async function generateReplySuggestions(userText, count, stylePrompt) {
    try {
        const sys = 'You are a helpful assistant that crafts extremely concise, natural follow-up replies a Discord user might send next. Avoid emojis unless the user uses them. No punctuation if it reads fine without it.';
        const res = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            temperature: 0.3,
            messages: [
                { role: 'system', content: sys },
                {
                    role: 'user', content: `User said: "${userText}"
${stylePrompt}
Return ${count} options as a numbered list, one per line, no extra commentary.`
                }
            ],
        });
        const text = res.choices?.[0]?.message?.content || '';
        const lines = text.split(/\r?\n/).map(l => l.replace(/^\s*\d+\.?\s*/, '').trim()).filter(Boolean);
        return lines.slice(0, count);
    } catch (e) { return []; }
}

const replyChannels = (process.env.REPLY_CHANNEL || '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

const openai = new OpenAI({
    apiKey: process.env.DEFAULT_API_KEY,
    baseURL: process.env.DEFAULT_BASE_URL
});

const { specialModels } = require('./models');

const {
    updateUserSystemPrompt,
    sendStreamingResponse,
    getModelForUser,
    handleConversationSummary,
    handlePdfAttachments
} = require('./utils');

const { getText } = require('../../Functions/i18n');
const { isChessVoiceMessage, handleChessVoiceMessage } = require('./chessMessageHandler');

const MAX_TOKENS = Number(process.env.MAX_CONTEXT_TOKENS || 8192);
const voiceApi = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
const voiceBase = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;
const voiceModel = process.env.VOICE_MODEL;
const voiceEngine = (process.env.VOICE_ENGINE || 'whisper').toLowerCase();
const voicePrompt = process.env.VOICE_PROMPT || "You will hear isolated English letters separated by pauses. The letters may include: s, f, k, d, t, b, g, and clusters like 'ck' and 'kk', as well as pairs like 'ai', 'ei', 'ey', 'gi', 'ji', 'ia', 'ci', 'fi', 'di', 'si', 'pi', and 'my', and 'ty'. Pronunciations like 'ess' for s, 'eff' for f, 'kay' for k, 'dee' for d, 'tee' for t, 'bee' for b, and 'gee' for g may be used. You may also hear whole words such as 'air', 'sheer', 'cheer', and 'dear'.";
const voiceTemperature = process.env.VOICE_TEMPERATURE ? parseFloat(process.env.VOICE_TEMPERATURE) : 0;
const voiceLanguage = process.env.VOICE_LANGUAGE || 'en';
const voiceNormalizeLetters = process.env.VOICE_NORMALIZE_LETTERS !== 'false';
const showTranscriptions = process.env.VOICE_SHOW_TRANSCRIPTIONS === 'true';
const dsModelPath = process.env.VOICE_DS_MODEL_PATH;
const dsScorerPath = process.env.VOICE_DS_SCORER_PATH;
const dsHotWords = process.env.VOICE_DS_HOT_WORDS || 's:4,f:4,k:4,ck:4,kk:4,ai:5,ei:5,ey:5,gi:5,ji:5,ia:5,ci:5,fi:5,di:5,si:5,pi:5,my:5,d:5,t:5,dee:6,tee:6,ty:6,b:5,g:5,bee:6,gee:6,air:6,sheer:6,cheer:6,dear:6';
const sfZcrThreshold = process.env.VOICE_SF_ZCR_THRESHOLD ? parseFloat(process.env.VOICE_SF_ZCR_THRESHOLD) : 0.12;
const dsBeamWidth = process.env.VOICE_DS_BEAM_WIDTH ? parseInt(process.env.VOICE_DS_BEAM_WIDTH, 10) : undefined;
const userCooldownMs = process.env.USER_COOLDOWN_MS ? parseInt(process.env.USER_COOLDOWN_MS, 10) : 3000;
const channelCooldownMs = process.env.CHANNEL_COOLDOWN_MS ? parseInt(process.env.CHANNEL_COOLDOWN_MS, 10) : 1500;
const chatStylePrompt = process.env.CHAT_STYLE_PROMPT || '';
const replySuggestions = process.env.REPLY_SUGGESTIONS === 'true';
const replySuggestionsCount = process.env.REPLY_SUGGESTIONS_COUNT ? Math.min(5, Math.max(1, parseInt(process.env.REPLY_SUGGESTIONS_COUNT, 10))) : 3;
const replySuggestionsPrompt = process.env.REPLY_SUGGESTIONS_PROMPT || 'Generate a few very short, natural, non-spammy reply options the user might send next. Keep each to under 8 words.';

const allowedShortTokens = new Set([
    's', 'f', 'k', 'b', 'g', 'd', 't', 'ty',
    'ai', 'ei', 'ey', 'gi', 'ji', 'ia', 'ci', 'fi', 'di', 'si', 'pi', 'my'
]);
const allowedWords = new Set(['air', 'sheer', 'cheer', 'dear']);

function normalizeSF(text) {
    const t = (text || '').toLowerCase().trim();
    const cleaned = t.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const joined = cleaned.replace(/\s+/g, '');
    if (cleaned === 's' || joined === 's' || cleaned === 'ess' || joined === 'ess') return 's';
    if (cleaned === 'f' || joined === 'f' || cleaned === 'eff' || joined === 'eff') return 'f';
    if (cleaned === 'k' || joined === 'k' || cleaned === 'kay' || joined === 'kay') return 'k';
    if (cleaned === 'b' || joined === 'b' || cleaned === 'bee' || joined === 'bee') return 'b';
    if (cleaned === 'g' || joined === 'g' || cleaned === 'gee' || joined === 'gee') return 'g';
    if (cleaned === 'a i' || joined === 'ai') return 'ai';
    if (cleaned === 'e i' || joined === 'ei') return 'ei';
    if (cleaned === 'e y' || joined === 'ey') return 'ey';
    if (cleaned === 'g i' || joined === 'gi') return 'gi';
    if (cleaned === 'j i' || joined === 'ji') return 'ji';
    if (cleaned === 'i a' || joined === 'ia') return 'ia';
    if (cleaned === 'c i' || joined === 'ci') return 'ci';
    if (cleaned === 'f i' || joined === 'fi') return 'fi';
    if (cleaned === 'd i' || joined === 'di') return 'di';
    if (cleaned === 's i' || joined === 'si') return 'si';
    if (cleaned === 'p i' || joined === 'pi') return 'pi';
    if (cleaned === 'm y' || joined === 'my') return 'my';
    if (cleaned === 'd' || joined === 'd' || cleaned === 'dee' || joined === 'dee') return 'd';
    if (cleaned === 't' || joined === 't' || cleaned === 'tee' || joined === 'tee') return 't';
    if (cleaned === 't y' || joined === 'ty') return 'ty';
    if (cleaned === 'air' || joined === 'air') return 'air';
    if (cleaned === 'sheer' || joined === 'sheer') return 'sheer';
    if (cleaned === 'cheer' || joined === 'cheer') return 'cheer';
    if (cleaned === 'dear' || joined === 'dear') return 'dear';
    return null;
}

// Minimal WAV PCM16 parser (mono/stereo). Returns { pcm:Int16Array, sampleRate:number }
function parseWavPcm16(buffer) {
    // buffer is a Node.js Buffer
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('Not a RIFF/WAVE file');
    }
    let offset = 12; // start of first chunk
    let fmt = null;
    let dataStart = -1;
    let dataSize = 0;
    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const next = offset + 8 + chunkSize;
        if (chunkId === 'fmt ') {
            const audioFormat = buffer.readUInt16LE(offset + 8);
            const numChannels = buffer.readUInt16LE(offset + 10);
            const sampleRate = buffer.readUInt32LE(offset + 12);
            const bitsPerSample = buffer.readUInt16LE(offset + 22);
            fmt = { audioFormat, numChannels, sampleRate, bitsPerSample };
        } else if (chunkId === 'data') {
            dataStart = offset + 8;
            dataSize = chunkSize;
        }
        offset = next;
    }
    if (!fmt) throw new Error('WAV fmt chunk not found');
    if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) throw new Error('Only PCM16 WAV supported');
    if (dataStart < 0 || dataSize <= 0) throw new Error('WAV data chunk not found');
    const samples = dataSize / 2;
    const pcm = new Int16Array(samples);
    for (let i = 0; i < samples; i++) {
        pcm[i] = buffer.readInt16LE(dataStart + i * 2);
    }
    return { pcm, sampleRate: fmt.sampleRate };
}

// Simple zero-crossing rate over PCM16 frames
function zeroCrossingRate(pcm) {
    if (!pcm || pcm.length < 2) return 0;
    let crossings = 0;
    let prev = pcm[0];
    for (let i = 1; i < pcm.length; i++) {
        const cur = pcm[i];
        if ((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) crossings++;
        prev = cur;
    }
    return crossings / (pcm.length - 1);
}

// image model
const defaultModel = process.env.DEFAULT_MODEL;
const imageModelEnv = process.env.IMAGE_MODEL;
let imageModel = '';

if (specialModels.includes(defaultModel)) {
    imageModel = defaultModel;
}

else if (imageModelEnv && specialModels.includes(imageModelEnv)) {
    imageModel = imageModelEnv;
}

const detail = process.env.IMAGE_DETAIL;
//const temperature = 0.7;

async function handleAudioAttachment(message, audioAttachment, conversationLog, typingInterval, client) {
    if (process.env.VOICE_INPUT !== 'true') {
        clearInterval(typingInterval);
        await message.reply(`❌ ${getText('common.error', message.author.id)}\n\`\`\`\nVOICE_INPUT=${process.env.VOICE_INPUT}\`\`\``);
        return true;
    }

    try {
        const audioBuffer = await fetch(audioAttachment.url).then(res => res.buffer());

        let finalText = '';
        let transcriptRaw = '';

        if (voiceEngine === 'deepspeech') {
            try {
                const Deepspeech = require('deepspeech');
                if (!dsModelPath) throw new Error('VOICE_DS_MODEL_PATH is not set');
                const model = new Deepspeech.Model(dsModelPath);
                if (dsBeamWidth && Number.isInteger(dsBeamWidth) && model.setBeamWidth) {
                    try { model.setBeamWidth(dsBeamWidth); } catch { }
                }
                if (dsScorerPath) {
                    model.enableExternalScorer(dsScorerPath);
                }
                // apply hot-words like "s:4,f:4"
                if (dsHotWords) {
                    dsHotWords.split(',').forEach(pair => {
                        const [word, weightStr] = pair.split(':');
                        const weight = parseFloat(weightStr);
                        if (word && !isNaN(weight) && model.addHotWord) {
                            try { model.addHotWord(word.trim(), weight); } catch { }
                        }
                    });
                }

                // For DS, only support WAV PCM16 attachments here
                let pcm;
                let wavInfo;
                if (audioAttachment.contentType?.includes('wav')) {
                    wavInfo = parseWavPcm16(audioBuffer);
                    pcm = wavInfo.pcm;
                } else {
                    throw new Error('DeepSpeech path requires WAV PCM16 audio attachment');
                }
                transcriptRaw = model.stt(pcm);
            } catch (e) {
                console.log('DeepSpeech error or not installed:', e?.message || e);
                await message.reply(`❌ ${getText('events.AICore.audioProcessFailed', message.author.id)}\n\n-# Install and configure DeepSpeech or switch VOICE_ENGINE=whisper`);
                clearInterval(typingInterval);
                return true;
            }
        } else {
            const audioOpenai = new OpenAI({
                apiKey: voiceApi,
                baseURL: voiceBase
            });
            const fileName = audioAttachment.name || 'audio';
            const fileExt = audioAttachment.contentType?.includes('wav') ? 'wav' : 'mp3';
            const fileType = audioAttachment.contentType || (fileExt === 'wav' ? 'audio/wav' : 'audio/mpeg');
            const fileUpload = await OpenAI.toFile(audioBuffer, `${fileName}.${fileExt}`, { contentType: fileType });
            const transcription = await audioOpenai.audio.transcriptions.create({
                file: fileUpload,
                model: voiceModel,
                prompt: voicePrompt,
                temperature: voiceTemperature,
                language: voiceLanguage,
            });
            transcriptRaw = transcription.text;
        }

        const normalized = voiceNormalizeLetters ? normalizeSF(transcriptRaw) : null;
        finalText = normalized || transcriptRaw;

        // WAV-only spectral fallback using zero-crossing rate for s/f
        try {
            if (!normalized && (finalText.length <= 3) && audioAttachment.contentType?.includes('wav')) {
                const { pcm, sampleRate } = parseWavPcm16(audioBuffer);
                const zcr = zeroCrossingRate(pcm);
                const sfGuess = zcr > sfZcrThreshold ? 's' : 'f';
                finalText = sfGuess;
            }
        } catch (e) {
            // ignore DSP fallback errors
        }

        conversationLog.push({
            role: 'user',
            content: finalText,
        });
        if (showTranscriptions) {
            await message.reply(`${finalText}\n-# ✧${getText('events.AICore.transcription', message.author.id)}`);
        }
        // Clarifier: if very short and not recognized, ask user to repeat/clarify
        try {
            const isShort = finalText && finalText.length <= 3;
            const isAllowed = allowedShortTokens.has(finalText) || allowedWords.has(finalText);
            if (isShort && !isAllowed) {
                await message.reply(`I heard "${finalText}". Did you mean one of these pairs like s/f, k, ai/ei/ey, gi/ji, or ia/ci/fi/di/si/pi/my? Please repeat clearly.`);
                clearInterval(typingInterval);
                return true;
            }
        } catch { }

        const modelToUse = getModelForUser(message.author.id, client);

        const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
        const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
        const currentMessageTokens = encodeChat([{ role: 'user', content: finalText }], 'gpt-3.5-turbo').length;

        if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
            conversationLog = await handleConversationSummary(conversationLog, message, null, message.author.id);
        }

        // Inject style prompt to avoid spammy tone if provided
        if (chatStylePrompt) {
            conversationLog.unshift({ role: 'system', content: chatStylePrompt });
        }
        await sendStreamingResponse(message, message.channel, conversationLog, modelToUse, message.author, client);
        // After main response, optionally post suggested replies
        if (replySuggestions) {
            try {
                const lastUserMsg = finalText || '';
                const suggestions = await generateReplySuggestions(lastUserMsg, replySuggestionsCount, replySuggestionsPrompt);
                if (suggestions && suggestions.length) {
                    const lines = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
                    await message.reply(`💬 Suggested quick replies:\n${lines}`);
                }
            } catch (e) { /* ignore */ }
        }
        clearInterval(typingInterval);
        return true;
    } catch (error) {
        clearInterval(typingInterval);
        console.log('Error processing audio:', error);
        await message.reply(`❌ ${getText('events.AICore.audioProcessFailed', message.author.id)}`);
        return true;
    }
}

async function handlePdfAndImageAttachments(message, pdfAttachments, imageAttachments, conversationLog, messageContent, typingInterval, client) {
    if (process.env.PDF_INPUT !== 'true' || !imageModel || process.env.IMAGE_INPUT !== 'true') {
        clearInterval(typingInterval);
        let errorMessage = '';
        if (process.env.PDF_INPUT !== 'true') {
            errorMessage += `❌ ${getText('events.AICore.pdfInputDisabled', message.author.id)}\n\`\`\`\nPDF_INPUT=${process.env.PDF_INPUT}\`\`\`\n`;
        }
        if (!imageModel) {
            errorMessage += `❌ ${getText('events.AICore.modelNotSupportImage', message.author.id)}\n\`\`\`\nIMAGE_MODEL=${process.env.IMAGE_MODEL || process.env.DEFAULT_MODEL}\`\`\`\n`;
        } else if (process.env.IMAGE_INPUT !== 'true') {
            errorMessage += `❌ ${getText('events.AICore.imageInputDisabled', message.author.id)}\n\`\`\`\nIMAGE_INPUT=${process.env.IMAGE_INPUT}\`\`\`\n`;
        }
        await message.reply(errorMessage);
        return true;
    }

    try {
        const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
        const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
        const currentMessageTokens = encodeChat([{ role: 'user', content: messageContent }], 'gpt-3.5-turbo').length;

        if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
            conversationLog = await handleConversationSummary(conversationLog, message, null, message.author.id);
        }

        await sendStreamingResponse(message, message.channel, conversationLog, imageModel, message.author, client, false, null, pdfAttachments, imageAttachments);
        clearInterval(typingInterval);

        const modelToUse = getModelForUser(message.author.id, client);

        if (!specialModels.includes(modelToUse)) {
            conversationLog = client.userConversations[message.author.id].map(log => {
                if (log.content && Array.isArray(log.content)) {
                    const filteredContent = log.content.filter(content => content.type !== 'image_url' || (content.type === 'text' && content.text.trim() !== ''));
                    if (filteredContent.length > 0) {
                        log.content = filteredContent;
                    } else {
                        return null;
                    }
                }
                return log;
            }).filter(log => log !== null);
        }
        return true;
    } catch (error) {
        clearInterval(typingInterval);
        console.error('PDF 和圖片處理錯誤:', error);
        await message.reply(`❌ ${getText('events.AICore.pdfImageProcessFailed', message.author.id)}`);
        return true;
    }
}

async function handlePdfAttachmentsOnly(message, pdfAttachments, conversationLog, messageContent, typingInterval, client) {
    if (process.env.PDF_INPUT !== 'true') {
        clearInterval(typingInterval);
        await message.reply(`❌ ${getText('events.AICore.pdfInputDisabled', message.author.id)}\n\`\`\`\nPDF_INPUT=${process.env.PDF_INPUT}\`\`\``);
        return true;
    }

    try {
        const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
        const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
        const currentMessageTokens = encodeChat([{ role: 'user', content: messageContent }], 'gpt-3.5-turbo').length;

        if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
            conversationLog = await handleConversationSummary(conversationLog, message, null, message.author.id);
        }

        const modelToUse = getModelForUser(message.author.id, client);
        await sendStreamingResponse(message, message.channel, conversationLog, modelToUse, message.author, client, false, null, pdfAttachments);

        clearInterval(typingInterval);
        return true;
    } catch (error) {
        clearInterval(typingInterval);
        console.error('PDF 處理錯誤:', error);
        await message.reply(`❌ ${getText('events.AICore.pdfProcessFailed', message.author.id)}`);
        return true;
    }
}

async function handleImageAttachments(message, imageAttachments, conversationLog, messageContent, typingInterval, client) {
    if (!imageModel || process.env.IMAGE_INPUT !== 'true') {
        clearInterval(typingInterval);
        if (!imageModel) {
            await message.reply(`❌ ${getText('events.AICore.modelNotSupportImage', message.author.id)}\n\`\`\`\nIMAGE_MODEL=${process.env.IMAGE_MODEL || process.env.DEFAULT_MODEL}\`\`\``);
        } else {
            await message.reply(`❌ ${getText('events.AICore.imageInputDisabled', message.author.id)}\n\`\`\`\nIMAGE_INPUT=${process.env.IMAGE_INPUT}\`\`\``);
        }
        return true;
    }

    const attachmentContents = imageAttachments.map(attachment => ({
        type: "image_url",
        image_url: {
            "url": attachment.url,
            "detail": detail,
        },
    }));

    conversationLog.push({
        role: 'user',
        content: [
            { type: "text", text: messageContent },
            ...attachmentContents,
        ],
    });

    try {
        const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
        const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
        const currentMessageTokens = encodeChat([{ role: 'user', content: messageContent }], 'gpt-3.5-turbo').length;

        if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
            conversationLog = await handleConversationSummary(conversationLog, message, attachmentContents, message.author.id);
        }

        await sendStreamingResponse(message, message.channel, conversationLog, imageModel, message.author, client);
        clearInterval(typingInterval);

        const modelToUse = getModelForUser(message.author.id, client);

        if (!specialModels.includes(modelToUse)) {
            conversationLog = client.userConversations[message.author.id].map(log => {
                if (log.content && Array.isArray(log.content)) {
                    const filteredContent = log.content.filter(content => content.type !== 'image_url' || (content.type === 'text' && content.text.trim() !== ''));
                    if (filteredContent.length > 0) {
                        log.content = filteredContent;
                    } else {
                        return null;
                    }
                }
                return log;
            }).filter(log => log !== null);
        }
        return true;
    } catch (error) {
        clearInterval(typingInterval);
        console.log('Error from OpenAI:', error instanceof OpenAI.APIError ? error.message : error);
        await message.reply(`❌ ${getText('events.AICore.imageProcessFailed', message.author.id)}`);
        return true;
    }
}

async function handleTextMessage(message, conversationLog, messageContent, client) {
    const typingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 4000);

    if (!Array.isArray(conversationLog)) {
        conversationLog = [];
        client.userConversations[message.author.id] = conversationLog;
    }

    conversationLog.push({
        role: 'user',
        content: messageContent,
    });

    const modelToUse = getModelForUser(message.author.id, client);

    try {
        const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
        const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
        const currentMessageTokens = encodeChat([{ role: 'user', content: messageContent }], 'gpt-3.5-turbo').length;

        if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
            conversationLog = await handleConversationSummary(conversationLog, message, null, message.author.id);
        }

        await sendStreamingResponse(message, message.channel, conversationLog, modelToUse, message.author, client);
        clearInterval(typingInterval);
        return true;
    } catch (error) {
        clearInterval(typingInterval);
        console.log('Error from OpenAI:', error instanceof OpenAI.APIError ? error.message : error);
        await message.reply(`❌ ${getText('events.AICore.messageProcessFailed', message.author.id)}`);
        return true;
    }
}

module.exports = {
    name: "messageCreate",
    async execute(message, client) {
        if (message.author.bot || message.interaction) return;

        // initialize cooldown stores
        if (!client.__omCooldowns) {
            client.__omCooldowns = { users: new Map(), channels: new Map() };
        }
        const now = Date.now();
        const lastUser = client.__omCooldowns.users.get(message.author.id) || 0;
        const lastChannel = client.__omCooldowns.channels.get(message.channel.id) || 0;
        if (now - lastUser < parseInt(process.env.USER_COOLDOWN_MS) || now - lastChannel < parseInt(process.env.CHANNEL_COOLDOWN_MS)) {
            return; // skip to avoid spam-like rapid replies
        }
        client.__omCooldowns.users.set(message.author.id, now);
        client.__omCooldowns.channels.set(message.channel.id, now);

        const inPassiarChannel = client.passiarChannels && client.passiarChannels.has(message.channel.id);
        const inPassiarUser = client.passiarUsers && client.passiarUsers.has(message.author.id);

        if (
            (message.mentions.has(client.user) && !message.mentions.everyone) ||
            replyChannels.includes(message.channel.id) ||
            inPassiarChannel ||
            inPassiarUser
        ) {
            if (!client.userConversations) {
                client.userConversations = {};
            }

            if (!client.userConversations[message.author.id]) {
                await updateUserSystemPrompt(message.author.id, message, client);
            }

            let conversationLog = client.userConversations[message.author.id];
            let messageContent = '';
            let attachments = [];

            if (message.reference && message.reference.messageId) {
                try {
                    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    if (referencedMessage && !referencedMessage.author.bot) {

                        if (referencedMessage.attachments.size > 0) {
                            const originalImages = referencedMessage.attachments.filter(
                                attachment => attachment.contentType?.includes('image')
                            );

                            if (originalImages.size > 0) {
                                attachments = Array.from(originalImages.values());
                                messageContent = `${getText('events.AICore.referencedUserImage', message.author.id, {
                                    user: referencedMessage.member.displayName || referencedMessage.author.displayName,
                                    mention: referencedMessage.author
                                })}\n${referencedMessage.content}\n\n${message.content}`;
                            }
                        }

                        if (referencedMessage.content) {
                            messageContent = `${getText('events.AICore.referencedUserSaid', message.author.id, {
                                user: referencedMessage.member.displayName || referencedMessage.author.displayName,
                                mention: referencedMessage.author
                            })}\n${referencedMessage.content}\n\n${message.content}`;
                        }
                    } else {
                        messageContent = message.content;
                    }
                } catch (error) {
                    console.log('Failed to fetch referenced message:', error);
                    messageContent = message.content;
                }
            } else {
                messageContent = message.content;
            }

            if (message.attachments.size > 0 || attachments.length > 0) {
                const typingInterval = setInterval(() => {
                    message.channel.sendTyping();
                }, 4000);

                const allAttachments = [...attachments, ...Array.from(message.attachments.values())];
                const audioAttachment = allAttachments.find(attachment => attachment.contentType?.startsWith('audio/'));
                const pdfAttachments = allAttachments.filter(attachment => attachment.contentType === 'application/pdf');
                const imageAttachments = allAttachments.filter(attachment => attachment.contentType?.includes('image'));

                // Check for chess voice move first
                if (audioAttachment && isChessVoiceMessage(message, client)) {
                    clearInterval(typingInterval);
                    await handleChessVoiceMessage(message, client);
                    return;
                }

                // for audio attachment
                if (audioAttachment) {
                    if (await handleAudioAttachment(message, audioAttachment, conversationLog, typingInterval, client)) {
                        return;
                    }
                }

                // for pdf and image attachments
                if (pdfAttachments.length > 0 && imageAttachments.length > 0) {
                    if (await handlePdfAndImageAttachments(message, pdfAttachments, imageAttachments, conversationLog, messageContent, typingInterval, client)) {
                        return;
                    }
                }

                // for pdf attachments
                if (pdfAttachments.length > 0) {
                    if (await handlePdfAttachmentsOnly(message, pdfAttachments, conversationLog, messageContent, typingInterval, client)) {
                        return;
                    }
                }

                // for image attachments
                if (imageAttachments.length > 0) {
                    if (await handleImageAttachments(message, imageAttachments, conversationLog, messageContent, typingInterval, client)) {
                        return;
                    }
                }
            } else {
                // for text message
                await handleTextMessage(message, conversationLog, messageContent, client);
            }
        }
    }
};