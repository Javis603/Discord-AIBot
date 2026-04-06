import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { startGameCommand } from './commands/start-game';
import { joinGameCommand } from './commands/join-game';
import { attackCommand } from './commands/attack';
import { statsCommand } from './commands/stats';
import { rulesCommand } from './commands/rules';
import { GameManager } from './game/GameManager';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Game manager instance
export const gameManager = new GameManager();

// Commands collection
const commands = [
  startGameCommand,
  joinGameCommand,
  attackCommand,
  statsCommand,
  rulesCommand,
];

client.once('ready', async () => {
  console.log(`🎮 Grand Theft Aura 6 is online!`);
  console.log(`👻 Logged in as ${client.user?.tag}`);
  
  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  
  try {
    console.log('📝 Registering slash commands...');
    
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
      { body: commands.map(cmd => cmd.data.toJSON()) }
    );
    
    console.log('✅ Successfully registered slash commands!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find(cmd => cmd.data.name === interaction.commandName);
  
  if (!command) return;

  try {
    await command.execute(interaction, gameManager);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: '💀 Something went wrong! The spirits are angry...',
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
