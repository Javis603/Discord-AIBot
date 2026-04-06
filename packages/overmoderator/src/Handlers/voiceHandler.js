/**
 * @file voiceHandler.js
 * @description Voice connection and TTS queue management
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2026
 * 
 * IMPORTANT: This handler requires the following packages:
 * - npm install @discordjs/voice @discordjs/opus ffmpeg-static discord-tts
 * 
 * After installing, uncomment the imports and implementation below.
 */

/**
 * Uncomment these imports after installing dependencies:
 * 
 * const { 
 *   joinVoiceChannel, 
 *   createAudioPlayer, 
 *   createAudioResource,
 *   AudioPlayerStatus,
 *   VoiceConnectionStatus,
 *   entersState,
 *   VoiceConnectionDisconnectReason
 * } = require('@discordjs/voice');
 * const discordTTS = require('discord-tts');
 * const { createWriteStream, unlinkSync } = require('fs');
 * const { pipeline } = require('stream');
 * const { promisify } = require('util');
 */

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  VoiceConnectionDisconnectReason,
  StreamType
} = require('@discordjs/voice');
const { createWriteStream, unlinkSync } = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('stream');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');
const ffmpegPath = require('ffmpeg-static');

const streamPipeline = promisify(pipeline);

/**
 * Voice Connection Manager
 * Handles voice connections, TTS generation, and queue management
 */
class VoiceManager {
  constructor() {
    this.connections = new Map(); // guildId -> VoiceConnection
    this.players = new Map();     // guildId -> AudioPlayer
    this.queues = new Map();      // guildId -> Queue[]
    this.settings = new Map();    // guildId -> Settings
    this.timeouts = new Map();    // guildId -> Timeout

    // Default settings
    this.defaultSettings = {
      volume: 1.0,
      speed: 1.0,
      idleTimeout: 300000, // 5 minutes
      maxQueueSize: 10
    };
  }

  /**
   * Get or create settings for a guild
   * @param {string} guildId 
   * @returns {object} Guild settings
   */
  getSettings(guildId) {
    if (!this.settings.has(guildId)) {
      this.settings.set(guildId, { ...this.defaultSettings });
    }
    return this.settings.get(guildId);
  }

  /**
   * Update guild settings
   * @param {string} guildId 
   * @param {object} updates 
   */
  updateSettings(guildId, updates) {
    const current = this.getSettings(guildId);
    this.settings.set(guildId, { ...current, ...updates });
  }

  /**
   * Join a voice channel
   * @param {VoiceChannel} channel 
   * @returns {VoiceConnection}
   */
  async joinChannel(channel) {
    console.log(`[Voice] Joining channel: ${channel.name} (${channel.id})`);

    if (this.connections.has(channel.guild.id)) {
      this.resetIdleTimeout(channel.guild.id);
      return this.connections.get(channel.guild.id);
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[Voice] Connected to ${channel.name}`);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch (error) {
        console.log(`[Voice] Disconnected from ${channel.name}`);
        this.cleanup(channel.guild.id);
      }
    });

    this.connections.set(channel.guild.id, connection);
    this.setupPlayer(channel.guild.id);
    this.resetIdleTimeout(channel.guild.id);

    return connection;
  }

  /**
   * Setup audio player for a guild
   * @param {string} guildId 
   */
  setupPlayer(guildId) {
    if (this.players.has(guildId)) return;

    const player = createAudioPlayer();

    player.on(AudioPlayerStatus.Idle, () => {
      this.playNext(guildId);
    });

    player.on('error', error => {
      console.error(`[Voice] Audio player error in guild ${guildId}:`, error);
      this.playNext(guildId);
    });

    const connection = this.connections.get(guildId);
    if (connection) {
      connection.subscribe(player);
    }

    this.players.set(guildId, player);
  }

  /**
   * Add TTS request to queue
   * @param {string} guildId 
   * @param {object} ttsRequest 
   */
  async addToQueue(guildId, ttsRequest) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, []);
    }

    const queue = this.queues.get(guildId);
    const settings = this.getSettings(guildId);

    if (queue.length >= settings.maxQueueSize) {
      throw new Error(`Queue is full (max ${settings.maxQueueSize} items)`);
    }

    queue.push(ttsRequest);
    console.log(`[Voice] Added to queue in guild ${guildId}. Queue length: ${queue.length}`);

    // If nothing is playing, start playback
    const player = this.players.get(guildId);
    if (player && player.state.status === 'idle') {
      await this.playNext(guildId);
    }
  }

  /**
   * Play next item in queue
   * @param {string} guildId 
   */
  async playNext(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) {
      console.log(`[Voice] Queue empty for guild ${guildId}`);
      this.resetIdleTimeout(guildId);
      return;
    }

    const ttsRequest = queue.shift();
    const player = this.players.get(guildId);

    if (!player) {
      console.error(`[Voice] No player found for guild ${guildId}`);
      return;
    }

    try {
      const voiceApiKey = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
      const voiceBaseUrl = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;
      const voiceModel = ttsRequest.model || process.env.VOICE_TTS_MODEL || process.env.VOICE_MODEL;

      if (!voiceApiKey || !voiceModel) {
        console.error('[Voice] VOICE_API_KEY/DEFAULT_API_KEY or VOICE_TTS_MODEL/VOICE_MODEL not configured');
        return;
      }

      const openai = new OpenAI({ apiKey: voiceApiKey, baseURL: voiceBaseUrl });
      const tempDir = os.tmpdir();
      const fileName = `tts-${guildId}-${Date.now()}.mp3`;
      const filePath = path.join(tempDir, fileName);

      const response = await openai.audio.speech.create({
        model: voiceModel,
        voice: ttsRequest.voice || 'alloy',
        input: ttsRequest.text,
        format: 'mp3'
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      await streamPipeline(
        require('stream').Readable.from(buffer),
        createWriteStream(filePath)
      );

      const settings = this.getSettings(guildId);
      const cleanupTemp = () => {
        try {
          unlinkSync(filePath);
        } catch {
          // ignore
        }
      };

      let resource;
      if (settings.speed !== 1.0 && ffmpegPath) {
        const ffmpeg = spawn(ffmpegPath, [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          filePath,
          '-filter:a',
          `atempo=${settings.speed}`,
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
          'pipe:1',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        ffmpeg.on('close', cleanupTemp);
        ffmpeg.on('error', cleanupTemp);

        resource = createAudioResource(ffmpeg.stdout, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
      } else {
        resource = createAudioResource(filePath, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true,
        });
        resource.playStream.on('end', cleanupTemp);
      }

      if (resource.volume && typeof resource.volume.setVolume === 'function') {
        resource.volume.setVolume(settings.volume);
      }

      player.play(resource);

      console.log(`[Voice] Playing TTS in guild ${guildId}: "${ttsRequest.text.substring(0, 50)}..."`);
    } catch (error) {
      console.error(`[Voice] Error playing TTS:`, error);
      // Try next item
      await this.playNext(guildId);
    }
  }

  /**
   * Stop current playback
   * @param {string} guildId 
   */
  stop(guildId) {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      console.log(`[Voice] Stopped playback in guild ${guildId}`);
    }
  }

  /**
   * Skip current item
   * @param {string} guildId 
   */
  skip(guildId) {
    this.stop(guildId);
    // The 'idle' event will trigger playNext
  }

  /**
   * Get queue for a guild
   * @param {string} guildId 
   * @returns {Array}
   */
  getQueue(guildId) {
    return this.queues.get(guildId) || [];
  }

  /**
   * Clear queue for a guild
   * @param {string} guildId 
   */
  clearQueue(guildId) {
    this.queues.set(guildId, []);
    console.log(`[Voice] Cleared queue for guild ${guildId}`);
  }

  /**
   * Reset idle timeout
   * @param {string} guildId 
   */
  resetIdleTimeout(guildId) {
    // Clear existing timeout
    const existing = this.timeouts.get(guildId);
    if (existing) {
      clearTimeout(existing);
    }

    const settings = this.getSettings(guildId);

    // Set new timeout
    const timeout = setTimeout(() => {
      console.log(`[Voice] Idle timeout reached for guild ${guildId}`);
      this.cleanup(guildId);
    }, settings.idleTimeout);

    this.timeouts.set(guildId, timeout);
  }

  /**
   * Cleanup and disconnect
   * @param {string} guildId 
   */
  cleanup(guildId) {
    console.log(`[Voice] Cleaning up guild ${guildId}`);

    // Clear timeout
    const timeout = this.timeouts.get(guildId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(guildId);
    }

    // Stop player
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
      this.players.delete(guildId);
    }

    // Destroy connection
    const connection = this.connections.get(guildId);
    if (connection) {
      connection.destroy();
      this.connections.delete(guildId);
    }

    // Clear queue
    this.queues.delete(guildId);
  }

  /**
   * Check if bot is connected in a guild
   * @param {string} guildId 
   * @returns {boolean}
   */
  isConnected(guildId) {
    return this.connections.has(guildId);
  }

  /**
   * Get connection statistics
   * @returns {object}
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      totalQueued: Array.from(this.queues.values())
        .reduce((sum, queue) => sum + queue.length, 0),
      guilds: Array.from(this.connections.keys())
    };
  }

  /**
   * High-level helper to speak text in a guild's voice channel
   * @param {import('discord.js').VoiceChannel} channel
   * @param {string} text
   * @param {object} [options]
   */
  async speak(channel, text, options = {}) {
    const guildId = channel.guild.id;
    await this.joinChannel(channel);
    await this.addToQueue(guildId, {
      text,
      language: options.language || 'en-US',
      voice: options.voice,
      model: options.model
    });
  }
}

// Export singleton instance
module.exports = new VoiceManager();