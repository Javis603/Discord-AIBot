/**
 * @file chess.js
 * @description Mac Chess game encoder for Discord with OpenAI, Whisper/DeepSpeech
 * @license MIT
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const OpenAI = require('openai');
const { getActiveGames } = require('../../Events/AICore/chessMessageHandler');

const PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟', '.': '·'
};

const openai = new OpenAI({
    apiKey: process.env.DEFAULT_API_KEY,
    baseURL: process.env.DEFAULT_BASE_URL
});

// Shared game state with voice handler
const activeGames = getActiveGames();

function parseFEN(fen) {
    const [boardFen, turn = 'w', castling = '-', enPassant = '-', halfmove = '0', fullmove = '1'] = fen.split(' ');
    const board = boardFen.split('/').map(row => {
        const r = [];
        for (const c of row) r.push(...(/\d/.test(c) ? '.'.repeat(+c) : c));
        return r;
    });
    return { board, turn, castling, enPassant, halfmove: +halfmove, fullmove: +fullmove };
}

function toFEN({ board, turn, castling, enPassant, halfmove, fullmove }) {
    const rows = board.map(row => {
        let s = '', e = 0;
        for (const p of row) p === '.' ? e++ : (e && (s += e, e = 0), s += p);
        return e ? s + e : s;
    });
    return `${rows.join('/')} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

function renderBoard(board) {
    const files = 'abcdefgh'.split('');
    let out = '　 ' + files.join(' ') + '\n';
    board.forEach((row, i) => {
        out += `${8 - i} ` + row.map(p => PIECES[p] || p).join(' ') + ` ${8 - i}\n`;
    });
    return out + '　 ' + files.join(' ');
}

async function getAIAnalysis(fen, lastMove, moves) {
    try {
        const res = await openai.chat.completions.create({
            model: process.env.DEFAULT_MODEL || 'gpt-4',
            messages: [{ role: 'user', content: `Chess position FEN: ${fen}\nLast move: ${lastMove || 'none'}\nAnalyze briefly (2 sentences).` }],
            max_tokens: 150
        });
        return res.choices[0]?.message?.content || 'Analysis unavailable.';
    } catch { return 'Analysis unavailable.'; }
}

async function transcribeMove(audioBuffer, contentType) {
    const engine = (process.env.VOICE_ENGINE || 'whisper').toLowerCase();
    if (engine === 'deepspeech' && process.env.VOICE_DS_MODEL_PATH) {
        try {
            const DS = require('deepspeech');
            const model = new DS.Model(process.env.VOICE_DS_MODEL_PATH);
            if (process.env.VOICE_DS_SCORER_PATH) model.enableExternalScorer(process.env.VOICE_DS_SCORER_PATH);
            // Requires WAV PCM16
            const pcm = parseWav(audioBuffer);
            return model.stt(pcm);
        } catch (e) { console.log('DeepSpeech fallback:', e.message); }
    }
    // Whisper
    const api = new OpenAI({ apiKey: process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY, baseURL: process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL });
    const file = await OpenAI.toFile(audioBuffer, 'move.wav', { contentType });
    const t = await api.audio.transcriptions.create({ file, model: process.env.VOICE_MODEL || 'whisper-1', prompt: 'Chess: e4, Nf3, O-O, Bxc6' });
    return t.text;
}

function parseWav(buf) {
    let off = 12, fmt, dataStart, dataSize;
    while (off + 8 <= buf.length) {
        const id = buf.toString('ascii', off, off + 4), sz = buf.readUInt32LE(off + 4);
        if (id === 'fmt ') fmt = { sr: buf.readUInt32LE(off + 12) };
        if (id === 'data') { dataStart = off + 8; dataSize = sz; }
        off += 8 + sz;
    }
    const pcm = new Int16Array(dataSize / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = buf.readInt16LE(dataStart + i * 2);
    return pcm;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Mac Chess encoder for Discord')
        .addSubcommand(s => s.setName('new').setDescription('Start new game').addUserOption(o => o.setName('opponent').setDescription('Opponent')))
        .addSubcommand(s => s.setName('fen').setDescription('Load FEN').addStringOption(o => o.setName('position').setDescription('FEN string').setRequired(true)))
        .addSubcommand(s => s.setName('move').setDescription('Make move').addStringOption(o => o.setName('notation').setDescription('e.g. e4, Nf3').setRequired(true)))
        .addSubcommand(s => s.setName('analyze').setDescription('AI analysis'))
        .addSubcommand(s => s.setName('show').setDescription('Show board'))
        .addSubcommand(s => s.setName('voice').setDescription('Voice move (attach audio)'))
        .addSubcommand(s => s.setName('resign').setDescription('Resign')),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const key = `${interaction.channel.id}-${interaction.user.id}`;
        const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

        if (sub === 'new') {
            const opp = interaction.options.getUser('opponent');
            const game = { state: parseFEN(START_FEN), moves: [], white: interaction.user.id, black: opp?.id || 'AI' };
            activeGames.set(key, game);
            const embed = new EmbedBuilder().setTitle('♟️ New Chess Game').setDescription('```\n' + renderBoard(game.state.board) + '\n```')
                .addFields({ name: 'White', value: `<@${game.white}>`, inline: true }, { name: 'Black', value: game.black === 'AI' ? '🤖 AI' : `<@${game.black}>`, inline: true })
                .setColor(0x00FF00);
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'fen') {
            const state = parseFEN(interaction.options.getString('position'));
            activeGames.set(key, { state, moves: [], white: interaction.user.id, black: 'Analysis' });
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('♟️ Position').setDescription('```\n' + renderBoard(state.board) + '\n```').setColor(0x9900FF)] });
        }

        const game = activeGames.get(key);
        if (!game) return interaction.reply({ content: '❌ No game. Use `/chess new`', ephemeral: true });

        if (sub === 'move') {
            game.moves.push(interaction.options.getString('notation'));
            game.state.turn = game.state.turn === 'w' ? 'b' : 'w';
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('♟️ Move').setDescription('```\n' + renderBoard(game.state.board) + '\n```').addFields({ name: 'Moves', value: game.moves.slice(-10).join(' ') || '-' }).setColor(0x0099FF)] });
        }

        if (sub === 'analyze') {
            await interaction.deferReply();
            const analysis = await getAIAnalysis(toFEN(game.state), game.moves.at(-1), game.moves);
            return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🔍 Analysis').setDescription('```\n' + renderBoard(game.state.board) + '\n```').addFields({ name: '🤖 AI', value: analysis }).setColor(0xFF9900)] });
        }

        if (sub === 'show') {
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('♟️ Board').setDescription('```\n' + renderBoard(game.state.board) + '\n```').addFields({ name: 'Turn', value: game.state.turn === 'w' ? 'White' : 'Black' }).setColor(0x333333)] });
        }

        if (sub === 'voice') {
            return interaction.reply({ content: '🎤 Attach an audio file with your move (e.g. "knight to f3") and mention the bot, or use `/chess move`', ephemeral: true });
        }

        if (sub === 'resign') {
            activeGames.delete(key);
            return interaction.reply({ content: '🏳️ You resigned. Game over.' });
        }
    }
};
