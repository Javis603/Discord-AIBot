const { Events } = require('discord.js');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting
const userTTSTimestamps = new Map();
const TTS_COOLDOWN = 3000; // 3 seconds

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.tts) {
      return;
    }

    // Rate limiting
    const now = Date.now();
    const userTimestamp = userTTSTimestamps.get(message.author.id);
    if (userTimestamp && (now - userTimestamp) < TTS_COOLDOWN) {
      await message.delete();
      return;
    }
    userTTSTimestamps.set(message.author.id, now);

    // API key check
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured for TTS moderation');
      return;
    }

    try {
      const moderation = await openai.moderations.create({
        input: message.content,
      });

      const [results] = moderation.results;

      if (results.flagged) {
        await message.delete();
        
        const logChannel = message.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
          await logChannel.send({
            embeds: [{
              color: 0xff0000,
              title: '🔇 TTS Message Moderated',
              fields: [
                {
                  name: 'User',
                  value: `${message.author.tag} (${message.author.id})`,
                  inline: true
                },
                {
                  name: 'Channel',
                  value: message.channel.name,
                  inline: true
                },
                {
                  name: 'Flagged Categories',
                  value: Object.entries(results.categories)
                    .filter(([_, flagged]) => flagged)
                    .map(([category]) => category)
                    .join(', ') || 'Unknown',
                  inline: false
                }
              ],
              timestamp: new Date()
            }]
          });
        }
      }
    } catch (error) {
      console.error('Error moderating TTS message:', error);
      // Don't delete message if moderation fails
    }
  },
};