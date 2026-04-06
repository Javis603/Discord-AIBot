import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { GameManager } from '../game/GameManager';

export const startGameCommand = {
  data: new SlashCommandBuilder()
    .setName('angrybirds')
    .setDescription('🐦 Start a new Angry Birds game')
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('Starting level (default: 1)')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction: ChatInputCommandInteraction, gameManager: GameManager) {
    const channel = interaction.channel as TextChannel;
    const level = interaction.options.getInteger('level') || 1;
    
    // Check if game already exists
    if (gameManager.getGame(channel.id)) {
      return interaction.reply({
        content: '⚠️ A game is already in progress in this channel!',
        ephemeral: true,
      });
    }

    // Create new game
    gameManager.createGame(channel.id, interaction.user);
    gameManager.addPlayer(channel.id, interaction.user);
    
    // Start the game
    const started = await gameManager.startGame(channel, level);
    
    if (started) {
      await interaction.reply({
        content: '🎮 **Angry Birds game starting!**\nUse `/join` to join the game!',
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to start game!',
        ephemeral: true,
      });
    }
  },
};
