"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameManager = void 0;
const discord_js_1 = require("discord.js");
const dotenv = __importStar(require("dotenv"));
const start_game_1 = require("./commands/start-game");
const join_game_1 = require("./commands/join-game");
const attack_1 = require("./commands/attack");
const stats_1 = require("./commands/stats");
const rules_1 = require("./commands/rules");
const GameManager_1 = require("./game/GameManager");
dotenv.config();
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMembers,
    ],
});
// Game manager instance
exports.gameManager = new GameManager_1.GameManager();
// Commands collection
const commands = [
    start_game_1.startGameCommand,
    join_game_1.joinGameCommand,
    attack_1.attackCommand,
    stats_1.statsCommand,
    rules_1.rulesCommand,
];
client.once('ready', async () => {
    console.log(`🎮 Grand Theft Aura 6 is online!`);
    console.log(`👻 Logged in as ${client.user?.tag}`);
    // Register slash commands
    const rest = new discord_js_1.REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('📝 Registering slash commands...');
        await rest.put(discord_js_1.Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands.map(cmd => cmd.data.toJSON()) });
        console.log('✅ Successfully registered slash commands!');
    }
    catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);
    if (!command)
        return;
    try {
        await command.execute(interaction, exports.gameManager);
    }
    catch (error) {
        console.error(error);
        await interaction.reply({
            content: '💀 Something went wrong! The spirits are angry...',
            ephemeral: true,
        });
    }
});
client.login(process.env.DISCORD_TOKEN);
