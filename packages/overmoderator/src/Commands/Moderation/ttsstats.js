/**
 * @file ttsstats.js
 * @description Admin command to view TTS statistics and manage settings
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ttsModeration = require('../../Events/Moderation/ttsModeration');
const voiceManager = require('../../Handlers/voiceHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ttsstats')
    .setDescription('View TTS system statistics and manage settings (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View TTS statistics')
    )
    
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset TTS statistics')
    )
    
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('View or update TTS configuration')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable TTS moderation')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('ratelimit')
            .setDescription('Set rate limit in milliseconds (1000-10000)')
            .setRequired(false)
            .setMinValue(1000)
            .setMaxValue(10000)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'view':
          await this.handleView(interaction);
          break;
        case 'reset':
          await this.handleReset(interaction);
          break;
        case 'config':
          await this.handleConfig(interaction);
          break;
      }
    } catch (error) {
      console.error('[TTS Stats] Error:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  },

  async handleView(interaction) {
    const moderationStats = ttsModeration.getStats();
    const voiceStats = voiceManager.getStats();

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 TTS System Statistics')
      .setDescription('Current statistics for the TTS system')
      .addFields([
        {
          name: '🔇 Moderation Stats',
          value: 
            `**Total Processed:** ${moderationStats.totalProcessed}\n` +
            `**Flagged:** ${moderationStats.totalFlagged}\n` +
            `**Deleted:** ${moderationStats.totalDeleted}\n` +
            `**Rate Limited:** ${moderationStats.rateLimited}\n` +
            `**Errors:** ${moderationStats.errors}`,
          inline: true
        },
        {
          name: '🎤 Voice Stats',
          value:
            `**Active Connections:** ${voiceStats.activeConnections}\n` +
            `**Queued Items:** ${voiceStats.totalQueued}\n` +
            `**Connected Guilds:** ${voiceStats.guilds.length}`,
          inline: true
        },
        {
          name: '⚙️ Configuration',
          value:
            `**API Configured:** ${process.env.OPENAI_API_KEY ? '✅ Yes' : '❌ No'}\n` +
            `**Rate Limit:** ${process.env.TTS_RATE_LIMIT || 3000}ms\n` +
            `**Max Length:** ${process.env.TTS_MAX_LENGTH || 200} chars\n` +
            `**Default Language:** ${process.env.TTS_DEFAULT_LANGUAGE || 'en-US'}`,
          inline: false
        }
      ])
      .setTimestamp()
      .setFooter({ text: 'TTS System' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  },

  async handleReset(interaction) {
    ttsModeration.resetStats();

    await interaction.reply({
      content: '✅ TTS statistics have been reset.',
      ephemeral: true
    });
  },

  async handleConfig(interaction) {
    const enabled = interaction.options.getBoolean('enabled');
    const ratelimit = interaction.options.getInteger('ratelimit');

    if (enabled === null && ratelimit === null) {
      // Show current config
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ TTS Configuration')
        .addFields([
          {
            name: 'Environment Variables',
            value:
              `**TTS_RATE_LIMIT:** ${process.env.TTS_RATE_LIMIT || '3000 (default)'}\n` +
              `**TTS_MAX_LENGTH:** ${process.env.TTS_MAX_LENGTH || '200 (default)'}\n` +
              `**TTS_DEFAULT_LANGUAGE:** ${process.env.TTS_DEFAULT_LANGUAGE || 'en-US (default)'}\n` +
              `**TTS_VOLUME:** ${process.env.TTS_VOLUME || '1.0 (default)'}\n` +
              `**TTS_LOG_CHANNEL_ID:** ${process.env.TTS_LOG_CHANNEL_ID || 'Not set'}\n` +
              `**OPENAI_API_KEY:** ${process.env.OPENAI_API_KEY ? 'Configured ✅' : 'Not configured ❌'}`,
            inline: false
          }
        ])
        .setFooter({ text: 'Note: Changes to environment variables require bot restart' });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } else {
      // Update config (requires bot restart for env vars)
      let updates = [];

      if (ratelimit !== null) {
        updates.push(`Rate Limit: ${ratelimit}ms`);
      }

      if (enabled !== null) {
        updates.push(`Moderation: ${enabled ? 'Enabled' : 'Disabled'}`);
      }

      await interaction.reply({
        content: 
          `⚙️ **Configuration Update Requested:**\n${updates.join('\n')}\n\n` +
          `⚠️ **Note:** These changes require updating .env file and restarting the bot.\n` +
          `Update your .env file with:\n` +
          (ratelimit !== null ? `\`TTS_RATE_LIMIT=${ratelimit}\`\n` : ''),
        ephemeral: true
      });
    }
  }
};
