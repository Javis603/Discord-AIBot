/**
 * @file chessVoice.js
 * @description Voice-to-chess-move handler using Whisper and DeepSpeech
 * Integrates with Mac Chess game encoder
 * @license MIT
 */

const OpenAI = require('openai');
const fetch = require('node-fetch');

// Voice API configuration
const voiceApi = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
const voiceBase = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;
const voiceModel = process.env.VOICE_MODEL || 'whisper-1';
const dsModelPath = process.env.VOICE_DS_MODEL_PATH;
const dsScorerPath = process.env.VOICE_DS_SCORER_PATH;

// Chess-specific vocabulary for better recognition
const CHESS_PROMPT = `Chess move notation and natural language moves.
Examples: e4, d4, Nf3, Nc6, Bb5, O-O, O-O-O, Bxc6, dxc6, Qh5+, checkmate.
Natural: knight to f3, bishop takes c6, castle kingside, pawn to e4, queen h5 check.
Pieces: king, queen, rook, bishop, knight, pawn.
Files: a, b, c, d, e, f, g, h. Ranks: 1, 2, 3, 4, 5, 6, 7, 8.`;

// DeepSpeech hot words for chess
const DS_CHESS_HOTWORDS = [
    'king:6', 'queen:6', 'rook:6', 'bishop:6', 'knight:6', 'pawn:6',
    'castle:5', 'castles:5', 'check:5', 'checkmate:6', 'mate:5',
    'takes:5', 'captures:5', 'to:3',
    'a:3', 'b:3', 'c:3', 'd:3', 'e:3', 'f:3', 'g:3', 'h:3',
    'one:3', 'two:3', 'three:3', 'four:3', 'five:3', 'six:3', 'seven:3', 'eight:3'
];

/**
 * Parse WAV PCM16 audio buffer
 */
function parseWavPcm16(buffer) {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('Invalid WAV file');
    }

    let offset = 12;
    let fmt = null;
    let dataStart = -1;
    let dataSize = 0;

    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);

        if (chunkId === 'fmt ') {
            fmt = {
                audioFormat: buffer.readUInt16LE(offset + 8),
                numChannels: buffer.readUInt16LE(offset + 10),
                sampleRate: buffer.readUInt32LE(offset + 12),
                bitsPerSample: buffer.readUInt16LE(offset + 22)
            };
        } else if (chunkId === 'data') {
            dataStart = offset + 8;
            dataSize = chunkSize;
        }
        offset += 8 + chunkSize;
    }

    if (!fmt || fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
        throw new Error('Only PCM16 WAV supported');
    }

    const samples = dataSize / 2;
    const pcm = new Int16Array(samples);
    for (let i = 0; i < samples; i++) {
        pcm[i] = buffer.readInt16LE(dataStart + i * 2);
    }

    return { pcm, sampleRate: fmt.sampleRate, channels: fmt.numChannels };
}

/**
 * Transcribe audio using DeepSpeech
 */
async function transcribeWithDeepSpeech(audioBuffer) {
    if (!dsModelPath) {
        throw new Error('VOICE_DS_MODEL_PATH not configured');
    }

    const DeepSpeech = require('deepspeech');
    const model = new DeepSpeech.Model(dsModelPath);

    // Set beam width for better accuracy
    if (process.env.VOICE_DS_BEAM_WIDTH && model.setBeamWidth) {
        model.setBeamWidth(parseInt(process.env.VOICE_DS_BEAM_WIDTH, 10));
    }

    // Enable external scorer if available
    if (dsScorerPath) {
        model.enableExternalScorer(dsScorerPath);
    }

    // Add chess-specific hot words
    DS_CHESS_HOTWORDS.forEach(hw => {
        const [word, weight] = hw.split(':');
        if (model.addHotWord) {
            try { model.addHotWord(word, parseFloat(weight)); } catch { }
        }
    });

    const { pcm } = parseWavPcm16(audioBuffer);
    return model.stt(pcm);
}

/**
 * Transcribe audio using Whisper (OpenAI API)
 */
async function transcribeWithWhisper(audioBuffer, contentType) {
    const openai = new OpenAI({
        apiKey: voiceApi,
        baseURL: voiceBase
    });

    const ext = contentType?.includes('wav') ? 'wav' : 'mp3';
    const mimeType = contentType || (ext === 'wav' ? 'audio/wav' : 'audio/mpeg');

    const file = await OpenAI.toFile(audioBuffer, `chess_move.${ext}`, { contentType: mimeType });

    const transcription = await openai.audio.transcriptions.create({
        file,
        model: voiceModel,
        prompt: CHESS_PROMPT,
        language: 'en',
        temperature: 0
    });

    return transcription.text;
}

/**
 * Main transcription function - tries DeepSpeech first, falls back to Whisper
 */
async function transcribeChessMove(audioBuffer, contentType) {
    const engine = (process.env.VOICE_ENGINE || 'whisper').toLowerCase();
    let transcript = '';
    let usedEngine = 'whisper';

    if (engine === 'deepspeech') {
        try {
            if (!contentType?.includes('wav')) {
                console.log('[ChessVoice] DeepSpeech requires WAV, falling back to Whisper');
            } else {
                transcript = await transcribeWithDeepSpeech(audioBuffer);
                usedEngine = 'deepspeech';
            }
        } catch (e) {
            console.log('[ChessVoice] DeepSpeech error:', e.message);
        }
    }

    if (!transcript) {
        transcript = await transcribeWithWhisper(audioBuffer, contentType);
        usedEngine = 'whisper';
    }

    return { transcript, engine: usedEngine };
}

/**
 * Parse natural language to algebraic notation
 */
function parseNaturalToAlgebraic(text) {
    const lower = text.toLowerCase().trim();

    // Already algebraic notation
    if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][+#]?=?[QRBN]?$/.test(text.trim())) {
        return text.trim();
    }

    // Castling
    if (/castle.*king|king.*castle|short.*castle|castle.*short|o-o(?!-o)/i.test(lower)) return 'O-O';
    if (/castle.*queen|queen.*castle|long.*castle|castle.*long|o-o-o/i.test(lower)) return 'O-O-O';

    // Piece mapping
    const pieceMap = {
        'king': 'K', 'queen': 'Q', 'rook': 'R', 'bishop': 'B', 'knight': 'N', 'horse': 'N', 'pawn': ''
    };

    // Number to rank mapping
    const rankMap = { 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7', 'eight': '8' };

    // Replace spoken numbers with digits
    let processed = lower;
    for (const [word, digit] of Object.entries(rankMap)) {
        processed = processed.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
    }

    // Pattern: "piece to square" or "piece square"
    const moveMatch = processed.match(/(\w+)\s+(?:to\s+)?([a-h])\s*([1-8])/);
    if (moveMatch) {
        const piece = pieceMap[moveMatch[1]] || '';
        return `${piece}${moveMatch[2]}${moveMatch[3]}`;
    }

    // Pattern: "piece takes/captures square"
    const takesMatch = processed.match(/(\w+)\s+(?:takes?|captures?)\s+(?:on\s+)?([a-h])\s*([1-8])/);
    if (takesMatch) {
        const piece = pieceMap[takesMatch[1]] || '';
        return `${piece}x${takesMatch[2]}${takesMatch[3]}`;
    }

    // Pattern: just "square" for pawn moves
    const squareMatch = processed.match(/\b([a-h])\s*([1-8])\b/);
    if (squareMatch) {
        return `${squareMatch[1]}${squareMatch[2]}`;
    }

    // Return original if can't parse
    return text.trim();
}

/**
 * Process voice chess move from Discord message
 */
async function processVoiceChessMove(message, audioAttachment, gameState) {
    try {
        // Download audio
        const response = await fetch(audioAttachment.url);
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        // Transcribe
        const { transcript, engine } = await transcribeChessMove(audioBuffer, audioAttachment.contentType);

        if (!transcript || transcript.trim().length === 0) {
            return { success: false, error: 'Could not transcribe audio' };
        }

        // Parse to algebraic notation
        const move = parseNaturalToAlgebraic(transcript);

        return {
            success: true,
            transcript,
            move,
            engine,
            isNatural: transcript.toLowerCase() !== move.toLowerCase()
        };
    } catch (error) {
        console.error('[ChessVoice] Error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    transcribeChessMove,
    parseNaturalToAlgebraic,
    processVoiceChessMove,
    parseWavPcm16,
    CHESS_PROMPT,
    DS_CHESS_HOTWORDS
};
