const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const OpenAI = require('openai');
const fetch = require('node-fetch');
const SlotsBalance = require('../../Models/SlotsBalance');
const voiceManager = require('../../Handlers/voiceHandler');
const content = narration ? narration : (result.win ? 'You win!' : 'Better luck next time.');

try {
  await voiceManager.speak(voiceChannel, content, {
    language: 'en-US'
  });
} catch (error) {
  console.error('[Slots] Error playing TTS in voice channel:', error);
}

return interaction.editReply({
  content,
  embeds: [embed]
});
const SYMBOLS = ['🍒', '🍋', '🍀', '⭐', '💎', '7️⃣'];

const DEFAULT_START_BALANCE = 1000;
const DEFAULT_BET = 10;
const voiceManager = require('../../Handlers/voiceHandler');
function spinReels() {
  const reels = [];
  for (let i = 0; i < 3; i++) {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    reels.push(symbol);
  }
  return reels;
}

function calculatePayout(reels, bet) {
  const [a, b, c] = reels;

  if (a === b && b === c) {
    let multiplier = 5;
    if (a === '7️⃣') multiplier = 50;
    else if (a === '💎') multiplier = 20;
    else if (a === '⭐') multiplier = 10;
    return { win: true, multiplier, amount: bet * multiplier, reason: 'Triple match!' };
  }

  if (a === b || a === c || b === c) {
    const multiplier = 1.5;
    return { win: true, multiplier, amount: Math.floor(bet * multiplier), reason: 'Two of a kind!' };
  }

  return { win: false, multiplier: 0, amount: -bet, reason: 'No match.' };
}

function formatReels(reels) {
  return reels.join(' | ');
}

async function getOrCreateBalance(userId) {
  let doc = await SlotsBalance.findOne({ userId });
  if (!doc) {
    doc = new SlotsBalance({ userId, balance: DEFAULT_START_BALANCE });
    await doc.save();
  }
  return doc;
}

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.DEFAULT_API_KEY,
    baseURL: process.env.DEFAULT_BASE_URL
  });
}

async function generateNarration(openai, interaction, reels, result, balance) {
  try {
    const userName = interaction.user.username;
    const content = `You are a fun casino slot machine announcer. Describe the following spin in one or two lively sentences, no markdown, no emojis other than slot symbols if useful.

User: ${userName}
Reels: ${reels.join(' ')}
Outcome: ${result.win ? 'WIN' : 'LOSE'}
Payout amount: ${result.amount}
Current balance: ${balance}`;

    const completion = await openai.chat.completions.create({
      model: process.env.DEFAULT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a concise, energetic casino announcer.' },
        { role: 'user', content }
      ],
      max_tokens: 120,
      temperature: 0.8
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('[Slots] Error generating narration:', error);
    return null;
  }
}

async function transcribeBetFromAudio(url) {
  try {
    if (!url) return null;

    const voiceApi = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
    const voiceBase = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;
    const voiceModel = process.env.VOICE_MODEL;

    if (!voiceApi || !voiceModel) {
      return null;
    }

    const audioBuffer = await fetch(url).then(res => res.buffer());
    const audioOpenai = new OpenAI({ apiKey: voiceApi, baseURL: voiceBase });

    const file = new File([audioBuffer], 'audio.mp3');

    const transcription = await audioOpenai.audio.transcriptions.create({
      file,
      model: voiceModel
    });

    const text = transcription.text || '';
    const match = text.match(/(\d+)/);
    if (!match) return null;

    const bet = parseInt(match[1], 10);
    if (Number.isNaN(bet) || bet <= 0) return null;
    return bet;
  } catch (error) {
    console.error('[Slots] Error transcribing bet from audio:', error);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Play a slot machine game')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('Play slots with text input')
        .addIntegerOption(option =>
          option
            .setName('bet')
            .setDescription('Bet amount (credits)')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('voiceplay')
        .setDescription('Play slots using voice input and voice output')
        .addStringOption(option =>
          option
            .setName('audio_url')
            .setDescription('URL to an audio file that says your bet (optional)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('fallback_bet')
            .setDescription('Bet to use if audio bet cannot be read')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your slots statistics')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'play') {
      return this.handlePlay(interaction);
    }

    if (subcommand === 'voiceplay') {
      return this.handleVoicePlay(interaction);
    }

    if (subcommand === 'stats') {
      return this.handleStats(interaction);
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },

  async handlePlay(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    let bet = interaction.options.getInteger('bet') || DEFAULT_BET;

    const balanceDoc = await getOrCreateBalance(userId);

    if (bet > balanceDoc.balance) {
      return interaction.editReply({
        content: `❌ You don\'t have enough credits. Your current balance is **${balanceDoc.balance}**.`,
      });
    }

    const reels = spinReels();
    const result = calculatePayout(reels, bet);

    balanceDoc.balance += result.amount;
    balanceDoc.totalSpins += 1;
    balanceDoc.lastPlayedAt = new Date();

    if (result.win) balanceDoc.totalWins += 1;
    else balanceDoc.totalLosses += 1;

    await balanceDoc.save();

    const openai = createOpenAIClient();
    const narration = await generateNarration(openai, interaction, reels, result, balanceDoc.balance);

    const embed = new EmbedBuilder()
      .setTitle('🎰 Slots')
      .setColor(result.win ? 0x00ff00 : 0xff0000)
      .addFields(
        { name: 'Spin', value: formatReels(reels), inline: true },
        { name: 'Bet', value: `${bet} credits`, inline: true },
        { name: result.win ? 'Winnings' : 'Loss', value: `${result.amount > 0 ? '+' : ''}${result.amount} credits`, inline: true },
        { name: 'Balance', value: `${balanceDoc.balance} credits`, inline: true },
      )
      .setTimestamp();

    const content = narration ? narration : (result.win ? 'You win!' : 'Better luck next time.');

    return interaction.editReply({
      content,
      embeds: [embed]
    });
  },

  async handleVoicePlay(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply({
        content: '❌ You must be in a voice channel to use /slots voiceplay.'
      });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions || !permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.editReply({
        content: '❌ I don\'t have permission to join or speak in your voice channel.'
      });
    }

    const audioUrl = interaction.options.getString('audio_url');
    let bet = interaction.options.getInteger('fallback_bet') || DEFAULT_BET;

    const transcribedBet = await transcribeBetFromAudio(audioUrl);
    if (transcribedBet && transcribedBet > 0) {
      bet = transcribedBet;
    }

    const balanceDoc = await getOrCreateBalance(userId);

    if (bet > balanceDoc.balance) {
      return interaction.editReply({
        content: `❌ You don\'t have enough credits. Your current balance is **${balanceDoc.balance}**.`,
      });
    }

    const reels = spinReels();
    const result = calculatePayout(reels, bet);

    balanceDoc.balance += result.amount;
    balanceDoc.totalSpins += 1;
    balanceDoc.lastPlayedAt = new Date();

    if (result.win) balanceDoc.totalWins += 1;
    else balanceDoc.totalLosses += 1;

    await balanceDoc.save();

    const openai = createOpenAIClient();
    const narration = await generateNarration(openai, interaction, reels, result, balanceDoc.balance);

    const embed = new EmbedBuilder()
      .setTitle('🎰 Slots (Voice)')
      .setColor(result.win ? 0x00ff00 : 0xff0000)
      .addFields(
        { name: 'Spin', value: formatReels(reels), inline: true },
        { name: 'Bet', value: `${bet} credits`, inline: true },
        { name: result.win ? 'Winnings' : 'Loss', value: `${result.amount > 0 ? '+' : ''}${result.amount} credits`, inline: true },
        { name: 'Balance', value: `${balanceDoc.balance} credits`, inline: true },
      )
      .setTimestamp();

    const content = narration ? narration : (result.win ? 'You win!' : 'Better luck next time.');

    try {
      await voiceManager.speak(voiceChannel, content, {
        language: 'en-US'
      });
    } catch (error) {
      console.error('[Slots] Error playing TTS in voice channel:', error);
    }

    return interaction.editReply({
      content,
      embeds: [embed]
    });
  },

  async handleStats(interaction) {
    const userId = interaction.user.id;
    const balanceDoc = await getOrCreateBalance(userId);

    const embed = new EmbedBuilder()
      .setTitle('🎰 Slots Stats')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Balance', value: `${balanceDoc.balance} credits`, inline: true },
        { name: 'Total Spins', value: `${balanceDoc.totalSpins}`, inline: true },
        { name: 'Wins', value: `${balanceDoc.totalWins}`, inline: true },
        { name: 'Losses', value: `${balanceDoc.totalLosses}`, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
