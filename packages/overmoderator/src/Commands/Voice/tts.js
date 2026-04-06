/**
 * @file tts.js
 * @description Text-to-Speech command with multi-language support
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getText } = require('../../Functions/i18n');
const voiceManager = require('../../Handlers/voiceHandler');
const OpenAI = require('openai');

// TTS Configuration
const TTS_CONFIG = {
  maxLength: parseInt(process.env.TTS_MAX_LENGTH) || 200,
  defaultLanguage: process.env.TTS_DEFAULT_LANGUAGE || 'en-US',
  volume: parseFloat(process.env.TTS_VOLUME) || 1.0,

  // Available languages/voices
  languages: {
    'en-US': { name: 'English (US)', voice: 'en-US' },
    'en-GB': { name: 'English (UK)', voice: 'en-GB' },
    'es-ES': { name: 'Spanish', voice: 'es-ES' },
    'fr-FR': { name: 'French', voice: 'fr-FR' },
    'de-DE': { name: 'German', voice: 'de-DE' },
    'it-IT': { name: 'Italian', voice: 'it-IT' },
    'ja-JP': { name: 'Japanese', voice: 'ja-JP' },
    'ko-KR': { name: 'Korean', voice: 'ko-KR' },
    'zh-CN': { name: 'Chinese (Simplified)', voice: 'zh-CN' },
    'zh-TW': { name: 'Chinese (Traditional)', voice: 'zh-TW' },
    'pt-BR': { name: 'Portuguese (Brazil)', voice: 'pt-BR' },
    'ru-RU': { name: 'Russian', voice: 'ru-RU' },
  }
};

const contextObj = {
  userId: 'system',
  guildId: null,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Text-to-Speech commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect | PermissionFlagsBits.Speak)

    // /tts speak <text> [language]
    .addSubcommand(subcommand =>
      subcommand
        .setName('speak')
        .setDescription('Generate and play text-to-speech in your voice channel')
        .addStringOption(option =>
          option
            .setName('text')
            .setDescription('Text to speak (max 200 characters)')
            .setRequired(true)
            .setMaxLength(TTS_CONFIG.maxLength)
        )
        .addStringOption(option =>
          option
            .setName('language')
            .setDescription('Language/voice to use')
            .setRequired(false)
            .addChoices(
              ...Object.entries(TTS_CONFIG.languages).map(([code, lang]) => ({
                name: lang.name,
                value: code
              }))
            )
        )
    )

    // /tts stop
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop current TTS playback')
    )

    // /tts skip
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip current TTS and play next in queue')
    )

    // /tts queue
    .addSubcommand(subcommand =>
      subcommand
        .setName('queue')
        .setDescription('Show current TTS queue')
    )

    // /tts settings
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('View or modify TTS settings')
        .addNumberOption(option =>
          option
            .setName('volume')
            .setDescription('Set volume (0.1 to 2.0)')
            .setRequired(false)
            .setMinValue(0.1)
            .setMaxValue(2.0)
        )
        .addNumberOption(option =>
          option
            .setName('speed')
            .setDescription('Set speech speed (0.5 to 2.0)')
            .setRequired(false)
            .setMinValue(0.5)
            .setMaxValue(2.0)
        )
    ),

  /**
   * Execute TTS command
   * @param {ChatInputCommandInteraction} interaction 
   * @param {Client} client 
   */
  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'speak':
          await this.handleSpeak(interaction, client);
          break;
        case 'stop':
          await this.handleStop(interaction, client);
          break;
        case 'skip':
          await this.handleSkip(interaction, client);
          break;
        case 'queue':
          await this.handleQueue(interaction, client);
          break;
        case 'settings':
          await this.handleSettings(interaction, client);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('[TTS Command] Error:', error);

      const errorMessage = error.message.includes('voice')
        ? '❌ Please join a voice channel first!'
        : '❌ An error occurred while processing your TTS request.';

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  /**
   * Handle /tts speak command
   */
  async handleSpeak(interaction, client) {
    await interaction.deferReply();

    // Check if user is in a voice channel
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return await interaction.editReply({
        content: '❌ You need to be in a voice channel to use TTS!'
      });
    }

    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) ||
      !permissions.has(PermissionFlagsBits.Speak)) {
      return await interaction.editReply({
        content: '❌ I don\'t have permission to join or speak in your voice channel!'
      });
    }

    const text = interaction.options.getString('text');
    const language = interaction.options.getString('language') || TTS_CONFIG.defaultLanguage;
    const style = interaction.options.getString('style') || 'neutral';

    let finalText = text;

    // Optional happy narrator style using OpenAI
    if (style === 'happy') {
      try {
        const apiKey = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
        const baseURL = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;

        if (!apiKey) {
          console.warn('[TTS Command] VOICE_API_KEY/DEFAULT_API_KEY missing, falling back to raw text');
        } else {
          const openai = new OpenAI({ apiKey, baseURL });

          const completion = await openai.chat.completions.create({
            model: process.env.VOICE_TEXT_MODEL || process.env.DEFAULT_MODEL || 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a cheerful narrator. Rewrite the user message so it keeps the same factual content but sounds upbeat, kind and encouraging, even if the news is bad. Do not add emojis or markdown, keep it short and natural.',
              },
              { role: 'user', content: text },
            ],
            max_tokens: 120,
            temperature: 0.8,
          });

          const rewritten = completion.choices?.[0]?.message?.content?.trim();
          if (rewritten) {
            finalText = rewritten;
          }
        }
      } catch (err) {
        console.error('[TTS Command] Error generating happy style text:', err);
      }
    }

    try {
      await voiceManager.speak(voiceChannel, finalText, {
        language,
        // Voice/model can be controlled by env: VOICE_TTS_MODEL / VOICE_MODEL
      });

      await interaction.editReply({
        content:
          `🎤 Speaking in **${voiceChannel.name}**\n` +
          `🌍 Language: ${TTS_CONFIG.languages[language]?.name || language}\n` +
          `🎭 Style: ${style === 'happy' ? 'Happy' : 'Neutral'}`,
      });
    } catch (err) {
      console.error('[TTS Command] Error speaking in voice channel:', err);
      await interaction.editReply({
        content: '❌ Failed to play TTS in the voice channel.',
      });
    }
  },

  /**
   * Handle /tts stop command
   */
  async handleStop(interaction, client) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
      return await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    voiceManager.stop(guildId);

    await interaction.reply({
      content: '⏹️ TTS playback stopped.',
      ephemeral: true,
    });
  },

  /**
   * Handle /tts skip command
   */
  async handleSkip(interaction, client) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
      return await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    voiceManager.skip(guildId);

    await interaction.reply({
      content: '⏭️ Skipped current TTS.',
      ephemeral: true,
    });
  },

  /**
   * Handle /tts queue command
   */
  async handleQueue(interaction, client) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
      return await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const queue = voiceManager.getQueue(guildId);

    if (!queue.length) {
      return await interaction.reply({
        content: '📋 **TTS Queue:**\nNo items in queue.',
        ephemeral: true,
      });
    }

    const preview = queue
      .map((item, index) => `${index + 1}. ${item.text.slice(0, 80)}${item.text.length > 80 ? '…' : ''}`)
      .join('\n');

    await interaction.reply({
      content: `📋 **TTS Queue (${queue.length}):**\n${preview}`,
      ephemeral: true,
    });
  },

  /**
   * Handle /tts settings command
   */
  async handleSettings(interaction, client) {
    const guildId = interaction.guild?.id;
    if (!guildId) {
      return await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const volume = interaction.options.getNumber('volume');
    const speed = interaction.options.getNumber('speed');

    if (volume === null && speed === null) {
      // Display current settings
      const settings = voiceManager.getSettings(guildId);
      await interaction.reply({
        content: `⚙️ **Current TTS Settings:**\n` +
          `🔊 Volume: ${settings.volume}\n` +
          `⚡ Speed: ${settings.speed}\n` +
          `🌍 Default Language: ${TTS_CONFIG.languages[TTS_CONFIG.defaultLanguage].name}`,
        ephemeral: true
      });
    } else {
      const updates = {};
      if (volume !== null) updates.volume = volume;
      if (speed !== null) updates.speed = speed;
      voiceManager.updateSettings(guildId, updates);

      const settings = voiceManager.getSettings(guildId);
      await interaction.reply({
        content: `✅ Settings updated!\n` +
          (volume !== null ? `🔊 Volume: ${settings.volume}\n` : '') +
          (speed !== null ? `⚡ Speed: ${settings.speed}` : ''),
        ephemeral: true
      });
    }
  }
};
