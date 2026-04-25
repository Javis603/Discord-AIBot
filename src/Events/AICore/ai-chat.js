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

const replyChannels = process.env.REPLY_CHANNEL.split(',');

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
const { processImageUrl } = require('../../utils/r2Uploader');

const MAX_TOKENS = process.env.MAX_CONTEXT_TOKENS;
const voiceApi = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
const voiceBase = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;
const voiceModel = process.env.VOICE_MODEL;

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
        
        const audioOpenai = new OpenAI({
            apiKey: voiceApi,
            baseURL: voiceBase
        });
        
        const transcription = await audioOpenai.audio.transcriptions.create({
            file: new File([audioBuffer], 'audio.mp3', { type: audioAttachment.contentType }),
            model: voiceModel,
        });
        
        conversationLog.push({
            role: 'user',
            content: transcription.text,
        });

        await message.reply(`${transcription.text}\n-# ✧${getText('events.AICore.transcription', message.author.id)}`);
        
        const modelToUse = getModelForUser(message.author.id, client);

        const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
        const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
        const currentMessageTokens = encodeChat([{ role: 'user', content: transcription.text }], 'gpt-3.5-turbo').length;
        
        if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
            conversationLog = await handleConversationSummary(conversationLog, message, null, message.author.id);
        }

        await sendStreamingResponse(message, message.channel, conversationLog, modelToUse, message.author, client);
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
    
    const processedUrls = await Promise.all(
        imageAttachments.map(attachment => processImageUrl(attachment.url, message.author.id))
    );
    
    const attachmentContents = processedUrls.map(url => ({
        type: "image_url",
        image_url: {
            "url": url,
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
    if (message.mentions.has(client.user) && !message.mentions.everyone || replyChannels.includes(message.channel.id)) {
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

                    if(referencedMessage.content) {
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
}