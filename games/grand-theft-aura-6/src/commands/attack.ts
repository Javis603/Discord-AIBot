import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { GameManager } from '../game/GameManager';

export const attackCommand = {
  data: new SlashCommandBuilder()
    .setName('attack')
    .setDescription('⚔️ Attack another player')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The player to attack')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, gameManager: GameManager) {
    const channel = interaction.channel as TextChannel;
    const target = interaction.options.getUser('target', true);

    const error = await gameManager.attackPlayer(
      channel.id,
      interaction.user.id,
      target.id,
      channel
    );

    if (error) {
      return interaction.reply({
        content: `⚠️ ${error}`,
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: '⚔️ Attack executed...',
      ephemeral: true,
    });
  },
};
