/**
 * @file main.js
 * @description A multi-functional AI assistant designed for Discord
 * @author Javis
 * @see https://github.com/Javis603/Discord-AIBot
 * @license MIT
 * @copyright Copyright (c) 2025
 */

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

require('dotenv/config');

const { Client, GatewayIntentBits, Partials, Collection, TextInputStyle, AttachmentBuilder, EmbedBuilder, WebhookClient, ButtonBuilder, ActionRowBuilder, ButtonStyle, SimpleShardingStrategy } = require("discord.js");
const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember } = Partials;

class MaxListenersShardingStrategy extends SimpleShardingStrategy {
    async spawn(shardIds) {
        await super.spawn(shardIds);

        for (const shard of this.shards.values()) {
            shard.setMaxListeners(0);
        }
    }
}

const client = new Client({ 
    intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildPresences], 
    partials: [User, Message, GuildMember, ThreadMember],
    ws: {
        buildStrategy: manager => new MaxListenersShardingStrategy(manager)
    }
});

require('events').EventEmitter.setMaxListeners(0);
client.setMaxListeners(0);
client.ws.setMaxListeners(0);
if (client.rest) {
    client.rest.setMaxListeners(0);
}

const { loadEvents } = require("./Handlers/eventHandlers");
const { loadUserLanguagePreferences } = require('./Functions/i18n');
const { installSkills } = require('./Events/AICore/skills');

client.events = [];
client.commands = new Collection();

// Connect MangoDB
const mongoose = require('mongoose');
mongoose.set('strictQuery', true);
const { connect } = require("mongoose");
const UserSettings = require('./Models/UserSettings');
const Conversation = require('./Models/Conversation');

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
client.userEnabledSkills = new Map();
client.userDisabledSkills = new Map();
client.userActiveSkills = new Map();
installSkills(client);

const {specialUsers} = require('./Events/AICore/models');

async function initializeUserSettings() {
    try {
        // 載入所有用戶設置
        const settings = await UserSettings.find({});
        settings.forEach(setting => {
            client.userModels[setting.userId] = setting.model;
            client.userNetSearchEnabled.set(setting.userId, setting.netSearchEnabled);
            client.userDeepThinkingEnabled.set(setting.userId, setting.deepThinkingEnabled);
            client.userEnabledSkills.set(setting.userId, setting.enabledSkills || []);
            client.userDisabledSkills.set(setting.userId, setting.disabledSkills || []);
        });

        // 載入所有對話記錄
        const conversations = await Conversation.find({});
        conversations.forEach(conv => {
            if (conv.conversations && conv.conversations.length > 0) {
                client.userConversations[conv.userId] = conv.conversations;
            }
        });

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

                const systemPrompt = {
                    role: 'system',
                    content: roles[config.role]
                        .replace(/{username}/g, config.username)
                        .replace(/{relation}/g, config.relation)
                        .replace(/{WebSerach}/g, webSearchStatus)
                        .replace(/{DeepThinking}/g, deepThinkingStatus)
                };

                // 只在沒有現有對話記錄時創建新的
                await Conversation.findOneAndUpdate(
                    { userId },
                    {
                        $setOnInsert: {
                            conversations: [systemPrompt],
                            lastUpdated: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );

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

// 定期清理超過3天的對話記錄
async function cleanupOldConversations() {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        await Conversation.deleteMany({
            lastUpdated: { $lt: threeDaysAgo }
        });
        console.log('已清理超過3天的對話記錄');
    } catch (error) {
        console.error('Error cleaning up conversations:', error);
    }
}

// 連接數據庫並初始化
connect(process.env.MONGODB_URI, {})
    .then(async () => {
        console.log("成功連接到數據庫");
        //setInterval(cleanupOldConversations, 3 * 24 * 60 * 60 * 1000);
        
        // 先加載用戶語言偏好設置，然後再啟動機器人
        console.time("加載用戶設置");
        await initializeUserSettings();
        console.timeEnd("加載用戶設置");
        
        // 啟動機器人
        //console.log("正在啟動機器人...");
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
        client.login(process.env.DISCORD_BOT_TOKEN)
            .then(() => {
                // 登錄成功後加載事件
                loadEvents(client);
            })
            .catch(error => {
                console.error('機器人登錄錯誤:', error);
            });
    })
    .catch(error => {
        console.error('數據庫連接錯誤:', error);
    });
