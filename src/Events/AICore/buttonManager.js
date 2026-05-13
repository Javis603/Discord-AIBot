/**
 * @file buttonManager.js
 * @description Button interaction manager for AI core, including deep thinking, net search, update button, clear current response, clear chat, check log, and predicted buttons.
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const Conversation = require('../../Models/Conversation');
const UserSettings = require('../../Models/UserSettings');
const { updateUserSystemPrompt, sendStreamingResponse, getModelForUser, handleConversationSummary } = require('./utils');
const { encodeChat } = require('gpt-tokenizer');
const config = require('../../../config.json');
const { getText } = require('../../Functions/i18n');
const { deleteUserImages } = require('../../utils/r2Uploader');

const MAX_TOKENS = process.env.MAX_CONTEXT_TOKENS;

async function checkPermission(interaction, userId, defaultErrorMessage) {
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        userLang: interaction.userLang
    };
    
    const errorMessage = getText('errors.permissionDenied', contextObj, { default: defaultErrorMessage });
    
    if (interaction.user.id !== userId && interaction.user.id !== process.env.DEVELOPER_ID) {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        return false;
    }
    return true;
}

// for update button
async function handleUpdateButton(interaction, client, userId) {
    await interaction.deferUpdate();
    
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`menu`)
            .setLabel(getText('components.buttons.menu', contextObj, { default: '📋 多功能選單' }))
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
    );

    const deepThinkingEnabled = client.userDeepThinkingEnabled.get(userId) || false;
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`deepThinking_${userId}`)
            .setLabel(getText('components.buttons.deepThinking', contextObj, { default: '💭 深度思考' }))
            .setStyle(deepThinkingEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const netSearchEnabled = client.userNetSearchEnabled.get(userId) || false;
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`netSearch_${userId}`)
            .setLabel(getText('components.buttons.netSearch', contextObj, { default: '🌐 聯網搜尋' }))
            .setStyle(netSearchEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`checkLog_${userId}`)
            .setLabel(getText('components.buttons.checkLog', contextObj, { default: '📑 檢查日誌' }))
            .setStyle(ButtonStyle.Secondary)
    );

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`clearCurrent_${userId}`)
            .setLabel(getText('components.buttons.clearCurrent', contextObj, { default: '清除此回應' }))
            .setStyle(ButtonStyle.Danger)
            .setEmoji(`${config.emojis.delete.id ? `<:delete:${config.emojis.delete.id}>` : config.emojis.delete.fallback}`)
    );

    await interaction.message.edit({ components: [row] });
}

// for deep thinking button
async function handleDeepThinking(interaction, client, userId) {
    const currentState = client.userDeepThinkingEnabled.get(userId) || false;
    client.userDeepThinkingEnabled.set(userId, !currentState);

    await updateUserSystemPrompt(userId, interaction, client);

    await UserSettings.findOneAndUpdate(
        { userId },
        { 
            deepThinkingEnabled: !currentState,
            lastUpdated: new Date()
        },
        { upsert: true }
    );

    const row = ActionRowBuilder.from(interaction.message.components[0]);
    const deepThinkingButton = ButtonBuilder.from(row.components.find(c => c.data.custom_id.startsWith('deepThinking')));
    deepThinkingButton.setStyle(!currentState ? ButtonStyle.Primary : ButtonStyle.Secondary);
    row.components[1] = deepThinkingButton;

    await interaction.update({ components: [row] });
}

// for clear current response button
async function handleClearCurrent(interaction, client, userId) {
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    if (!client.userConversations[userId]) {
        await interaction.reply({ content: getText('events.AICore.noConversation', contextObj, { default: "你沒有與你爸AI的聊天記錄。" }), flags: MessageFlags.Ephemeral });
        return;
    }

    const messageContentNoThink = interaction.message.content.replace(/\n> -# ⠀⠀⠀/g, '\n');
    const botResponseIndex = client.userConversations[userId].findIndex(
        conversation => {
            if (conversation.role !== 'assistant') return false;
            const conversationContent = conversation.content
                .replace(/<\/?think>/g, '')
                .replace(/\*\*已深度思考 ⚛︎\*\*/g, '');
            return messageContentNoThink.includes(conversationContent.trim());
        }
    );

    if (botResponseIndex === -1) {
        await interaction.reply({ content: getText('events.AICore.cannotFindResponse', contextObj, { default: "找不到要清除的回應。" }), flags: MessageFlags.Ephemeral });
        return;
    }

    const initialConversation = client.userConversations[userId].filter(
        conversation => conversation.role === 'system'
    );

    const userQuestionIndex = botResponseIndex - 1;
    
    if (userQuestionIndex >= 0 && client.userConversations[userId][userQuestionIndex].role === 'user') {
        client.userConversations[userId].splice(userQuestionIndex, 2);
    } else {
        client.userConversations[userId].splice(botResponseIndex, 1);
    }

    await Conversation.findOneAndUpdate(
        { userId: userId },
        { 
            conversations: client.userConversations[userId],
            lastUpdated: new Date()
        },
        { upsert: true }
    );

    const updatedContent = `~~${interaction.message.content}~~`;
    await interaction.message.edit({ content: updatedContent });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cleared`)
            .setLabel(getText('components.buttons.cleared', contextObj, { default: '✅ 已清除此回應記錄' }))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );

    const buttons = getDefaultButtons(userId, client);
    row.addComponents(...buttons);
    row.addComponents(
        new ButtonBuilder()
        .setCustomId(`clearchat_${userId}`)
        .setLabel(getText('components.buttons.newChat', contextObj, { default: '新交談' }))
        .setStyle(ButtonStyle.Success)
        .setEmoji(`${config.emojis.newchat.id ? `<:newchat:${config.emojis.newchat.id}>` : config.emojis.newchat.fallback}`)
    );

    await interaction.deferUpdate();
    await interaction.message.edit({ components: [row] });
}

// for clear chat button
async function handleClearChat(interaction, client, userId) {
    await interaction.deferUpdate();

    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    if (!client.userConversations[userId]) {
        await interaction.followUp({ content: getText('events.AICore.noConversation', contextObj, { default: "你沒有與你爸AI的聊天記錄。" }), flags: MessageFlags.Ephemeral });
        return;
    }

    const initialConversation = client.userConversations[userId].filter(conversation => 
        conversation.role === 'system'
    );

    if (client.userConversations[userId].length > initialConversation.length) {
        client.userConversations[userId] = initialConversation;
        client.userActiveSkills?.delete(userId);

        const deleteResult = await deleteUserImages(userId);

        await Conversation.findOneAndUpdate(
            { userId: userId },
            { 
                conversations: initialConversation,
                lastUpdated: new Date()
            },
            { upsert: true }
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cleared`)
                .setLabel(getText('components.buttons.clearedAll', contextObj, { default: '✅ 已清除所有對話記錄' }))
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        const buttons = getDefaultButtons(userId, client);
        row.addComponents(...buttons);

        await interaction.editReply({ components: [row] });
    } else {
        await interaction.followUp({ content: getText('events.AICore.noConversationToClear', contextObj, { default: "你沒有需要清除的聊天記錄。" }), flags: MessageFlags.Ephemeral });
    }
}

// for check log button
async function handleCheckLog(interaction, client, userId) {
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    let logOwner;
    try {
        logOwner = await interaction.guild.members.fetch(userId);
    } catch (error) {
        console.error('Error fetching user:', error);
        await interaction.reply({ 
            content: getText('events.AICore.userNotFound', contextObj, { default: "無法獲取用戶資訊，可能是用戶已離開伺服器。" }), 
            flags: MessageFlags.Ephemeral 
        });
        return;
    }

    const conversationLog = client.userConversations[userId];
    if (!conversationLog) {
        await interaction.reply({ content: getText('events.AICore.noConversation', contextObj, { default: "你沒有與你爸AI的聊天記錄。" }), flags: MessageFlags.Ephemeral });
        return;
    }

    const textOnlyLog = conversationLog.filter(log => 
        typeof log.content === 'string' && log.content.trim() !== ''
    );
    const currentTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
    const tokenPercentage = ((currentTokens / MAX_TOKENS) * 100).toFixed(1);

    const filteredLog = conversationLog.filter(entry => entry.role !== 'system');
    
    const chunks = [];
    let currentChunk = '';
    
    for (const entry of filteredLog) {
        const role = entry.role === 'user' ? '👤 用戶' : '🤖 AI';
        let content = '';

        if (Array.isArray(entry.content)) {
            const textContent = entry.content.find(item => item.type === 'text')?.text || '';
            const imageUrls = entry.content
                .filter(item => item.type === 'image_url')
                .map(item => item.image_url.url)
                .join('\n');

            content = `${role}:\n${textContent}${imageUrls ? `\n📎 ${getText('events.AICore.image', contextObj, { default: "圖片" })}: ${imageUrls}` : ''}\n\n`;
        } else {
            const sanitizedContent = String(entry.content).substring(0, 1900);
            content = `${role}:\n${sanitizedContent}\n\n`;
        }
        
        if (currentChunk.length + content.length > 3900) {
            chunks.push(currentChunk);
            currentChunk = content;
        } else {
            currentChunk += content;
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    const embeds = chunks.map((chunk, index) => {
        if (!chunk.trim()) {
            chunk = '無對話內容';
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setDescription('```' + chunk + '```')
            .setFooter({ 
                text: `你爸AI使用紀錄 (${index + 1}/${chunks.length}) | Tokens: ${currentTokens}/${MAX_TOKENS} (${tokenPercentage}%)`, 
                iconURL: client.user.avatarURL({dynamic: true}) 
            });

        if (index === 0) {
            embed.setAuthor({
                name: `${logOwner.user.tag}的對話記錄`, 
                iconURL: logOwner.user.avatarURL({dynamic: true})
            })
            .setTimestamp();
        }

        return embed;
    });

    if (embeds.length === 0) {
        await interaction.reply({ 
            content: getText('events.AICore.noConversationToDisplay', contextObj, { default: "目前沒有可顯示的對話記錄。" }), 
            flags: MessageFlags.Ephemeral 
        });
        return;
    }

    await interaction.reply({ 
        embeds: [embeds[0]], 
        flags: MessageFlags.Ephemeral 
    });

    for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ 
            embeds: [embeds[i]], 
            flags: MessageFlags.Ephemeral 
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// for predicted button
async function handlePredictedButton(interaction, client, index, userId) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const buttonOwner = await interaction.guild.members.fetch(userId);
    const question = interaction.message.components[0].components[index - 1].label;

    if (!question || !client.userConversations[userId]) {
        return;
    }

    let userConversation = client.userConversations[userId];

    if (!question.trim()) {
        await interaction.deleteReply();
        return;
    }

    const textOnlyLog = userConversation.filter(log => 
        typeof log.content === 'string' && log.content.trim() !== ''
    );
    
    const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
    const currentMessageTokens = encodeChat([{ 
        role: 'user', 
        content: question 
    }], 'gpt-3.5-turbo').length;

    if (totalTokens + currentMessageTokens >= MAX_TOKENS) {
        userConversation = await handleConversationSummary(userConversation, {
            content: question,
            author: interaction.user
        }, null, userId);
    }

    userConversation.push({
        role: 'user',
        content: question.trim()
    });

    await sendStreamingResponse(
        interaction.message, 
        interaction.channel, 
        userConversation, 
        getModelForUser(userId, client), 
        buttonOwner.user,
        client, 
        true, 
        question
    );

    await interaction.deleteReply();
}

// for net search button
async function handleNetSearch(interaction, client, userId) {
    const currentState = client.userNetSearchEnabled.get(userId) || false;
    client.userNetSearchEnabled.set(userId, !currentState);

    await updateUserSystemPrompt(userId, interaction, client);

    await UserSettings.findOneAndUpdate(
        { userId },
        { 
            netSearchEnabled: !currentState,
            lastUpdated: new Date()
        },
        { upsert: true }
    );

    const row = ActionRowBuilder.from(interaction.message.components[0]);
    const netSearchButton = ButtonBuilder.from(row.components.find(c => c.data.custom_id.startsWith('netSearch')));
    netSearchButton.setStyle(!currentState ? ButtonStyle.Primary : ButtonStyle.Secondary);
    row.components[2] = netSearchButton;

    await interaction.update({ components: [row] });
}

function getDefaultButtons(userId, client) {
    const contextObj = {
        userId: userId,
        guildId: null
    };
    
    return [
        new ButtonBuilder()
            .setCustomId(`deepThinking_${userId}`)
            .setLabel(getText('components.buttons.deepThinking', contextObj, { default: '💭 深度思考' }))
            .setStyle(client.userDeepThinkingEnabled.get(userId) ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`netSearch_${userId}`)
            .setLabel(getText('components.buttons.netSearch', contextObj, { default: '🌐 聯網搜尋' }))
            .setStyle(client.userNetSearchEnabled.get(userId) ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`checkLog_${userId}`)
            .setLabel(getText('components.buttons.checkLog', contextObj, { default: '📑 檢查日誌' }))
            .setStyle(ButtonStyle.Secondary)
    ];
}

async function handleClearCurrentCallback(interaction, client, userId, messageId) {
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    try {
        const messageIndex = client.userConversations[userId].findIndex(msg => msg.messageId === messageId);
        if (messageIndex === -1) {
            await interaction.reply({ content: getText('events.AICore.cannotFindResponse', contextObj, { default: "找不到要清除的回應。" }), flags: MessageFlags.Ephemeral });
            return;
        }

        client.userConversations[userId].splice(messageIndex, 1);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`clearedCurrent_${userId}_${messageId}`)
                .setLabel(getText('components.buttons.cleared', contextObj, { default: '✅ 已清除此回應記錄' }))
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        await interaction.update({ components: [row] });
    } catch (error) {
        console.error('清除當前回應時出錯:', error);
    }
}

// for new chat button
async function handleNewChat(interaction, client, userId) {
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`newChatConfirm_${userId}`)
            .setLabel(getText('components.buttons.newChat', contextObj, { default: '新交談' }))
            .setStyle(ButtonStyle.Success)
    );

    await interaction.update({ components: [row] });
}

async function handleNewChatConfirm(interaction, client, userId) {
    const contextObj = {
        userId: interaction.user.id,
        guildId: interaction.guildId
    };
    
    if (!client.userConversations[userId]) {
        await interaction.followUp({ content: getText('events.AICore.noConversation', contextObj, { default: "你沒有與你爸AI的聊天記錄。" }), flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        const systemMessage = client.userConversations[userId].find(msg => msg.role === 'system');
        
        delete client.userConversations[userId];
        client.userActiveSkills?.delete(userId);

        client.userConversations[userId] = [];
        if (systemMessage) {
            client.userConversations[userId].push(systemMessage);
        }
        
        const deleteResult = await deleteUserImages(userId);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`clearedAll_${userId}`)
                .setLabel(getText('components.buttons.clearedAll', contextObj, { default: '✅ 已清除所有對話記錄' }))
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
        );

        await interaction.update({ components: [row] });
    } catch (error) {
        console.error('清除所有對話時出錯:', error);
        await interaction.followUp({ content: getText('events.AICore.noConversationToClear', contextObj, { default: "你沒有需要清除的聊天記錄。" }), flags: MessageFlags.Ephemeral });
    }
}

async function handleButtonInteraction(interaction, client) {
    try {
        try {
            const userSettings = await UserSettings.findOne({ userId: interaction.user.id });
            if (userSettings && userSettings.language) {
                interaction.userLang = userSettings.language;
            } else {
                interaction.userLang = process.env.BOT_LANG || 'zh-TW';
            }
        } catch (error) {
            console.error(`獲取用戶語言設置時出錯: ${error.message}`);
            interaction.userLang = process.env.BOT_LANG || 'zh-TW';
        }
        
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId,
            userLang: interaction.userLang
        };
        
        const customId = interaction.customId;
        
        if (customId === 'menu') {
            await handleUpdateButton(interaction, client, interaction.user.id);
        } else if (customId.startsWith('deepThinking_')) {
            const userId = customId.split('_')[1];
            if (!await checkPermission(interaction, userId, getText('errors.unauthorizedMenu', contextObj, { default: "你無權使用其他用戶的選單。" }))) return;
            await handleDeepThinking(interaction, client, userId);
        } else if (customId.startsWith('netSearch_')) {
            const userId = customId.split('_')[1];
            if (!await checkPermission(interaction, userId, getText('errors.unauthorizedButton', contextObj, { default: "你無權使用其他用戶的按鈕。" }))) return;
            await handleNetSearch(interaction, client, userId);
        } else if (customId.startsWith('clearCurrent_')) {
            const userId = customId.split('_')[1];
            if (!await checkPermission(interaction, userId, getText('errors.unauthorizedClear', contextObj, { default: "你無權清除其他用戶的記錄。" }))) return;
            await handleClearCurrent(interaction, client, userId);
        } else if (customId.startsWith('clearcurrent_')) {
            const [_, userId, messageId] = customId.split('_');
            if (!await checkPermission(interaction, userId, getText('errors.unauthorizedClear', contextObj, { default: "你無權清除其他用戶的記錄。" }))) return;
            await handleClearCurrentCallback(interaction, client, userId, messageId);
        } else if (customId.startsWith('checkLog_')) {
            const userId = customId.split('_')[1];
            if (!await checkPermission(interaction, userId, getText('errors.unauthorizedView', contextObj, { default: "你無權查看其他用戶的記錄。" }))) return;
            await handleCheckLog(interaction, client, userId);
        } else if (customId.startsWith('newChat_')) {
            const userId = customId.split('_')[1];
            if (!await checkPermission(interaction, userId, getText('errors.unauthorizedButton', contextObj, { default: "你無權使用其他用戶的按鈕。" }))) return;
            await handleNewChat(interaction, client, userId);
        } else if (customId.startsWith('newChatConfirm_')) {
            const userId = customId.split('_')[1];
            await handleNewChatConfirm(interaction, client, userId);
        }
    } catch (error) {
        console.error('處理按鈕互動時出錯:', error);
        await interaction.reply({
            content: getText('errors.buttonInteraction', contextObj, { default: "處理按鈕互動時發生錯誤。" }),
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        
        try {
            const userSettings = await UserSettings.findOne({ userId: interaction.user.id });
            if (userSettings && userSettings.language) {
                interaction.userLang = userSettings.language;
            } else {
                interaction.userLang = process.env.BOT_LANG || 'zh-TW';
            }
        } catch (error) {
            console.error(`獲取用戶語言設置時出錯: ${error.message}`);
            interaction.userLang = process.env.BOT_LANG || 'zh-TW';
        }
        
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId,
            userLang: interaction.userLang
        };
        
        if (interaction.customId.startsWith('button_')) {
            const [prefix, index, userId] = interaction.customId.split('_');
            await handlePredictedButton(interaction, client, index, userId);
            return;
        }

        const [prefix, userId] = interaction.customId.split('_');

        try {
            switch (prefix) {
                case 'updateButton':
                    if (!await checkPermission(interaction, userId, getText('errors.unauthorizedMenu', contextObj, { default: "你無權使用其他用戶的選單。" }))) return;
                    await handleUpdateButton(interaction, client, userId);
                    break;

                case 'deepThinking':
                    if (!await checkPermission(interaction, userId, getText('errors.unauthorizedButton', contextObj, { default: "你無權使用其他用戶的按鈕。" }))) return;
                    await handleDeepThinking(interaction, client, userId);
                    break;

                case 'clearCurrent':
                    if (!await checkPermission(interaction, userId, getText('errors.unauthorizedClear', contextObj, { default: "你無權清除其他用戶的記錄。" }))) return;
                    await handleClearCurrent(interaction, client, userId);
                    break;

                case 'clearchat':
                    if (!await checkPermission(interaction, userId, getText('errors.unauthorizedClear', contextObj, { default: "你無權清除其他用戶的記錄。" }))) return;
                    await handleClearChat(interaction, client, userId);
                    break;

                case 'checkLog':
                    if (!await checkPermission(interaction, userId, getText('errors.unauthorizedView', contextObj, { default: "你無權查看其他用戶的記錄。" }))) return;
                    await handleCheckLog(interaction, client, userId);
                    break;

                case 'netSearch':
                    if (!await checkPermission(interaction, userId, getText('errors.unauthorizedButton', contextObj, { default: "你無權使用其他用戶的按鈕。" }))) return;
                    await handleNetSearch(interaction, client, userId);
                    break;
            }
        } catch (error) {
            console.error(`Button interaction error (${prefix}):`, error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: getText('errors.buttonInteraction', contextObj, { default: "處理按鈕互動時發生錯誤。" }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    }
};
