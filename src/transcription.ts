import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { WAMessage, WASocket } from '@whiskeysockets/baileys';

import { readEnvFile } from './env.js';

interface TranscriptionConfig {
  model: string;
  enabled: boolean;
  fallbackMessage: string;
}

// Groq is OpenAI-compatible and has a generous free tier.
// Set GROQ_API_KEY in .env to use Groq; falls back to OPENAI_API_KEY for standard OpenAI.
const DEFAULT_CONFIG: TranscriptionConfig = {
  model: 'whisper-large-v3',
  enabled: true,
  fallbackMessage: '[Voice Message - transcription unavailable]',
};

async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  config: TranscriptionConfig,
): Promise<string | null> {
  const env = readEnvFile(['GROQ_API_KEY', 'OPENAI_API_KEY']);
  const groqKey = env.GROQ_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  const apiKey = groqKey || openaiKey;

  if (!apiKey) {
    console.warn('Neither GROQ_API_KEY nor OPENAI_API_KEY set in .env');
    return null;
  }

  try {
    const openaiModule = await import('openai');
    const OpenAI = openaiModule.default;
    const toFile = openaiModule.toFile;

    const clientOptions: { apiKey: string; baseURL?: string } = { apiKey };
    if (groqKey) {
      clientOptions.baseURL = 'https://api.groq.com/openai/v1';
    }
    const openai = new OpenAI(clientOptions);

    const file = await toFile(audioBuffer, 'voice.ogg', {
      type: 'audio/ogg',
    });

    const model = groqKey ? config.model : 'whisper-1';
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model,
      response_format: 'text',
    });

    // When response_format is 'text', the API returns a plain string
    return transcription as unknown as string;
  } catch (err) {
    console.error('OpenAI transcription failed:', err);
    return null;
  }
}

export async function transcribeAudioMessage(
  msg: WAMessage,
  sock: WASocket,
): Promise<string | null> {
  const config = DEFAULT_CONFIG;

  if (!config.enabled) {
    return config.fallbackMessage;
  }

  try {
    const buffer = (await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: console as any,
        reuploadRequest: sock.updateMediaMessage,
      },
    )) as Buffer;

    if (!buffer || buffer.length === 0) {
      console.error('Failed to download audio message');
      return config.fallbackMessage;
    }

    console.log(`Downloaded audio message: ${buffer.length} bytes`);

    const transcript = await transcribeWithOpenAI(buffer, config);

    if (!transcript) {
      return config.fallbackMessage;
    }

    return transcript.trim();
  } catch (err) {
    console.error('Transcription error:', err);
    return config.fallbackMessage;
  }
}

export function isVoiceMessage(msg: WAMessage): boolean {
  return msg.message?.audioMessage?.ptt === true;
}
