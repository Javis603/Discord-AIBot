/**
 * @file main.js
 * @description A multi-functional AI assistant designed for Discord
 * @author Javis
 * @see https://github.com/Javis603/Discord-AIBot
 * @license MIT
 * @copyright Copyright (c) 2025
 */

require('dotenv/config');

const { Client, GatewayIntentBits, Partials, Collection, TextInputStyle, AttachmentBuilder, EmbedBuilder, WebhookClient, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember } = Partials;
const mongoose = require('mongoose');

const client = new Client({
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences],
    partials: [User, Message, GuildMember, ThreadMember]
});

require('events').EventEmitter.setMaxListeners(Infinity);
client.ws.setMaxListeners(Infinity);

const { loadEvents } = require("./Handlers/eventHandlers");
const { loadUserLanguagePreferences } = require('./Functions/i18n');
const { checkConnection, getAllUserSettings, getAllConversations, upsertSystemPromptConversation } = require('./db');

async function initializeMongo() {
    const uri = (process.env.MONGODB_URI || '').trim();
    if (!uri) {
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log('[Database] MongoDB connected');
    } catch (error) {
        console.error('[Database] MongoDB connection failed:', error);
    }
}

client.events = new Collection();
client.commands = new Collection();

// snipe
client.snipes = new Collection();

// AI chat
const yaml = require('js-yaml');
const fs = require('fs');
const roles = yaml.load(fs.readFileSync('./roles.yaml', 'utf8'));

client.globalModel = 'default';
client.userModels = {};
client.userConversations = {};
client.userNetSearchEnabled = new Map();
client.userDeepThinkingEnabled = new Map();

const { specialUsers } = require('./Events/AICore/models');

async function initializeUserSettings() {
    try {
        const postgresAvailable = await checkConnection();
        if (postgresAvailable) {
            console.log('[Database] PostgreSQL available, loading settings and conversations');

            const settings = await getAllUserSettings();
            settings.forEach(setting => {
                client.userModels[setting.user_id] = setting.model;
                client.userNetSearchEnabled.set(setting.user_id, setting.net_search_enabled);
                client.userDeepThinkingEnabled.set(setting.user_id, setting.deep_thinking_enabled);
            });

            const conversations = await getAllConversations();
            conversations.forEach(row => {
                if (!client.userConversations[row.user_id]) {
                    client.userConversations[row.user_id] = [];
                }
                client.userConversations[row.user_id].push(row.content);
            });
        } else {
            console.log('[Database] PostgreSQL not configured/reachable, using in-memory settings');
        }

        // 初始化特定用戶設置
        for (const [userId, config] of Object.entries(specialUsers)) {
            // 檢查是否已有對話記錄
            if (!client.userConversations[userId]) {
                const webSearchStatus = client.userNetSearchEnabled.get(userId)
                    ? "開啟"
                    : "關閉，需要用戶在多功能選單裏面打開";

                const deepThinkingStatus = client.userDeepThinkingEnabled.get(userId)
                    ? "開啟"
                    : "關閉，需要用戶在多功能選單裏面打開";

                // Check if role exists before using it
                const roleContent = roles[config.role];
                if (!roleContent) {
                    console.warn(`[Init] Role "${config.role}" not found for user ${userId}, skipping`);
                    continue;
                }

                const systemPrompt = {
                    role: 'system',
                    content: roleContent
                        .replace(/{username}/g, config.username || 'User')
                        .replace(/{relation}/g, config.relation || 'friend')
                        .replace(/{WebSerach}/g, webSearchStatus)
                        .replace(/{DeepThinking}/g, deepThinkingStatus)
                };

                // 只在沒有現有對話記錄時創建新的
                if (postgresAvailable) {
                    await upsertSystemPromptConversation(userId, systemPrompt);
                }
                client.userConversations[userId] = [systemPrompt];
            }
        }

        // 載入用戶語言偏好設置
        await loadUserLanguagePreferences();
        console.log('已載入用戶語言偏好設置');
    } catch (error) {
        console.error('Error initializing user settings:', error);
    }
}

// 定期清理超過3天的對話記錄 (Postgres) - TODO: Re-enable after DB migration
/*
async function cleanupOldConversations() {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        await deleteOldConversations(threeDaysAgo);
        console.log('已清理超過3天的對話記錄');
    } catch (error) {
        console.error('Error cleaning up conversations:', error);
    }
}

// 連接數據庫並初始化
if (process.env.OFFLINE_MODE === 'true') {
    console.log('Running in offline mode. Skipping database connection and Discord login.');
} else {
    initializeMongo()
        .then(() => pool.connect())
        .then(async (clientConn) => {
            clientConn.release();
            console.log("成功連接到 Postgres 數據庫");
            setInterval(cleanupOldConversations, 3 * 24 * 60 * 60 * 1000);
            
            await initializeUserSettings();
            
            // 啟動機器人
            console.log('\x1b[35m%s\x1b[0m', `
                ███╗   ██╗██╗██████╗  █████╗      █████╗ ██╗
                ████╗  ██║██║██╔══██╗██╔══██╗    ██╔══██╗██║
                ██╔██╗ ██║██║██████╔╝███████║    ███████║██║
                ██║╚██╗██║██║██╔══██╗██╔══██║    ██╔══██║██║
                ██║ ╚████║██║██████╔╝██║  ██║    ██║  ██║██║
                ╚═╝  ╚═══╝╚═╝╚═════╝ ╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝
                `);
            console.log('\x1b[36m%s\x1b[0m', '歡迎使用 你爸NIBA AI Discord 機器人 v1.0');
            console.log('\x1b[33m%s\x1b[0m', '正在啟動中...\n');
            const token = (process.env.DISCORD_BOT_TOKEN || '').trim();
            if (!token) {
                console.error('缺少 DISCORD_BOT_TOKEN：請在 .env 中設置機器人 Token（不要使用 Client ID/Secret，也不要加引號或前綴）。');
                process.exit(1);
            }

            client.login(token)
                .then(() => {
                    // 登錄成功後加載事件
                    loadEvents(client);
                })
                .catch(error => {
                    console.error('機器人登錄錯誤:', error);
                });
        })
        .catch(error => {
            console.error('初始化錯誤:', error);
            process.exit(1);
        });
}
// Conversation / passiar mode
client.passiarChannels = new Set();   // channels with always-on conversation mode
client.passiarUsers = new Set();      // users with always-on conversation mode