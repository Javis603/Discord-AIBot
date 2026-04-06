/**
 * @file chessMessageHandler.js
 * @description Handles voice chess moves from Discord messages
 * Integrates Whisper/DeepSpeech for speech-to-move conversion
 * @license MIT
 */

const { EmbedBuilder } = require('discord.js');
const { processVoiceChessMove, parseNaturalToAlgebraic } = require('./chessVoice');
const fetch = require('node-fetch');

// Reference to active games (shared with chess.js command)
let activeGames = null;

/**
 * Initialize with shared game state
 */
function initChessHandler(games) {
    activeGames = games;
}

/**
 * Check if message contains chess voice command
 */
function isChessVoiceMessage(message, client) {
    // Must mention bot or be in passiar channel
    const mentioned = message.mentions.has(client.user);
    const inPassiar = client.passiarChannels?.has(message.channel.id) ||
        client.passiarUsers?.has(message.author.id);

    if (!mentioned && !inPassiar) return false;

    // Must have audio attachment
    const hasAudio = message.attachments.some(a => a.contentType?.startsWith('audio/'));

    // Check for chess keywords in message
    const content = message.content.toLowerCase();
    const hasChessKeyword = /chess|move|play|knight|bishop|rook|queen|king|pawn|castle|e[1-8]|d[1-8]|[a-h][1-8]/i.test(content);

    return hasAudio && hasChessKeyword;
}

/**
 * Handle chess voice message
 */
async function handleChessVoiceMessage(message, client) {
    const userId = message.author.id;
    const channelId = message.channel.id;
    const gameKey = `${channelId}-${userId}`;

    // Check for active game
    if (!activeGames || !activeGames.has(gameKey)) {
        await message.reply({
            content: '❌ No active chess game. Start one with `/chess new`',
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    const game = activeGames.get(gameKey);

    // Find audio attachment
    const audioAttachment = message.attachments.find(a => a.contentType?.startsWith('audio/'));
    if (!audioAttachment) {
        await message.reply({
            content: '🎤 Please attach an audio file with your chess move.',
            allowedMentions: { repliedUser: false }
        });
        return;
    }

    // Show typing indicator
    await message.channel.sendTyping();

    try {
        // Process voice move
        const result = await processVoiceChessMove(message, audioAttachment, game.state);

        if (!result.success) {
            await message.reply({
                content: `❌ Could not process voice move: ${result.error}`,
                allowedMentions: { repliedUser: false }
            });
            return;
        }

        // Apply the move
        game.moves.push(result.move);
        game.state.turn = game.state.turn === 'w' ? 'b' : 'w';

        // Build response embed
        const embed = new EmbedBuilder()
            .setTitle('🎤 Voice Move Recognized')
            .setDescription(`**Heard:** "${result.transcript}"\n**Move:** \`${result.move}\``)
            .addFields(
                { name: '🎯 Turn', value: game.state.turn === 'w' ? 'White' : 'Black', inline: true },
                { name: '🔊 Engine', value: result.engine === 'deepspeech' ? 'DeepSpeech' : 'Whisper', inline: true },
                { name: '📜 Recent Moves', value: game.moves.slice(-8).join(' ') || '-', inline: false }
            )
            .setColor(result.engine === 'deepspeech' ? 0x00AA00 : 0x0099FF)
            .setFooter({ text: result.isNatural ? 'Natural language converted to notation' : 'Direct notation recognized' });

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    } catch (error) {
        console.error('[ChessVoice] Handler error:', error);
        await message.reply({
            content: `❌ Error processing voice move: ${error.message}`,
            allowedMentions: { repliedUser: false }
        });
    }
}

/**
 * Export active games getter for chess.js to share state
 */
function getActiveGames() {
    if (!activeGames) {
        activeGames = new Map();
    }
    return activeGames;
}

module.exports = {
    initChessHandler,
    isChessVoiceMessage,
    handleChessVoiceMessage,
    getActiveGames
};
