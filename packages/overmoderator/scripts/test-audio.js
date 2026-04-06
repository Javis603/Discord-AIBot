require('dotenv/config');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const voiceApi = process.env.VOICE_API_KEY || process.env.DEFAULT_API_KEY;
const voiceBase = process.env.VOICE_BASE_URL || process.env.DEFAULT_BASE_URL;
const voiceModel = process.env.VOICE_MODEL;
const voiceEngine = (process.env.VOICE_ENGINE || 'whisper').toLowerCase();
const voicePrompt = process.env.VOICE_PROMPT || 'You will hear isolated English letters separated by pauses. The letters may include: s, f.';
const voiceTemperature = process.env.VOICE_TEMPERATURE ? parseFloat(process.env.VOICE_TEMPERATURE) : 0;
const voiceLanguage = process.env.VOICE_LANGUAGE || 'en';
const voiceNormalizeLetters = process.env.VOICE_NORMALIZE_LETTERS !== 'false';
const dsModelPath = process.env.VOICE_DS_MODEL_PATH;
const dsScorerPath = process.env.VOICE_DS_SCORER_PATH;
const dsHotWords = process.env.VOICE_DS_HOT_WORDS || 's:4,f:4';
const dsBeamWidth = process.env.VOICE_DS_BEAM_WIDTH ? parseInt(process.env.VOICE_DS_BEAM_WIDTH, 10) : undefined;
const sfZcrThreshold = process.env.VOICE_SF_ZCR_THRESHOLD ? parseFloat(process.env.VOICE_SF_ZCR_THRESHOLD) : 0.12;

function normalizeSF(text) {
  const t = (text || '').toLowerCase().trim();
  const cleaned = t.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const joined = cleaned.replace(/\s+/g, '');
  if (cleaned === 's' || joined === 's' || cleaned === 'ess' || joined === 'ess') return 's';
  if (cleaned === 'f' || joined === 'f' || cleaned === 'eff' || joined === 'eff') return 'f';
  return null;
}

function parseWavPcm16(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt = null;
  let dataStart = -1;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const next = offset + 8 + chunkSize;
    if (chunkId === 'fmt ') {
      const audioFormat = buffer.readUInt16LE(offset + 8);
      const numChannels = buffer.readUInt16LE(offset + 10);
      const sampleRate = buffer.readUInt32LE(offset + 12);
      const bitsPerSample = buffer.readUInt16LE(offset + 22);
      fmt = { audioFormat, numChannels, sampleRate, bitsPerSample };
    } else if (chunkId === 'data') {
      dataStart = offset + 8;
      dataSize = chunkSize;
    }
    offset = next;
  }
  if (!fmt) throw new Error('WAV fmt chunk not found');
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) throw new Error('Only PCM16 WAV supported');
  if (dataStart < 0 || dataSize <= 0) throw new Error('WAV data chunk not found');
  const samples = dataSize / 2;
  const pcm = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    pcm[i] = buffer.readInt16LE(dataStart + i * 2);
  }
  return { pcm, sampleRate: fmt.sampleRate };
}

function zeroCrossingRate(pcm) {
  if (!pcm || pcm.length < 2) return 0;
  let crossings = 0;
  let prev = pcm[0];
  for (let i = 1; i < pcm.length; i++) {
    const cur = pcm[i];
    if ((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) crossings++;
    prev = cur;
  }
  return crossings / (pcm.length - 1);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/test-audio.js <audio.(wav|mp3)>');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const isWav = ext === '.wav';
  const contentType = isWav ? 'audio/wav' : 'audio/mpeg';

  let transcriptRaw = '';
  if (voiceEngine === 'deepspeech') {
    try {
      const Deepspeech = require('deepspeech');
      if (!dsModelPath) throw new Error('VOICE_DS_MODEL_PATH is not set');
      const model = new Deepspeech.Model(dsModelPath);
      if (dsBeamWidth && Number.isInteger(dsBeamWidth) && model.setBeamWidth) {
        try { model.setBeamWidth(dsBeamWidth); } catch {}
      }
      if (dsScorerPath) {
        model.enableExternalScorer(dsScorerPath);
      }
      if (dsHotWords) {
        dsHotWords.split(',').forEach(pair => {
          const [word, weightStr] = pair.split(':');
          const weight = parseFloat(weightStr);
          if (word && !isNaN(weight) && model.addHotWord) {
            try { model.addHotWord(word.trim(), weight); } catch {}
          }
        });
      }
      if (!isWav) throw new Error('DeepSpeech requires WAV PCM16 test input');
      const { pcm } = parseWavPcm16(buf);
      transcriptRaw = model.stt(pcm);
    } catch (e) {
      console.error('DeepSpeech error:', e?.message || e);
      process.exit(2);
    }
  } else {
    const audioOpenai = new OpenAI({ apiKey: voiceApi, baseURL: voiceBase });
    const fileName = path.basename(abs);
    const FileCtor = typeof File !== 'undefined' ? File : null;
    let fileArg;
    if (FileCtor) {
      fileArg = new FileCtor([buf], fileName, { type: contentType });
    } else {
      const form = await OpenAI.toFile(buf, fileName, { contentType });
      fileArg = form;
    }
    const out = await audioOpenai.audio.transcriptions.create({
      file: fileArg,
      model: voiceModel,
      prompt: voicePrompt,
      temperature: voiceTemperature,
      language: voiceLanguage,
    });
    transcriptRaw = out.text;
  }

  const normalized = voiceNormalizeLetters ? normalizeSF(transcriptRaw) : null;
  let finalText = normalized || transcriptRaw;

  try {
    if (!normalized && isWav && finalText.length <= 3) {
      const { pcm } = parseWavPcm16(buf);
      const zcr = zeroCrossingRate(pcm);
      finalText = zcr > sfZcrThreshold ? 's' : 'f';
    }
  } catch {}

  console.log(JSON.stringify({ engine: voiceEngine, transcript: transcriptRaw, final: finalText }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
