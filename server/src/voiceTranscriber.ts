import { env } from './env.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3';

function fail(status: number, code: string, detail?: string): never {
  const err: any = new Error(code);
  err.status = status;
  if (detail) err.detail = detail;
  throw err;
}

export async function transcribeVoice(buffer: Buffer, mime = 'audio/ogg'): Promise<string> {
  if (!env.GROQ_API_KEY) fail(503, 'voice_not_configured');

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  form.append('file', blob, 'voice.ogg');
  form.append('model', MODEL);
  form.append('response_format', 'json');

  let resp: Response;
  try {
    resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });
  } catch (e: any) {
    fail(502, 'transcription_request_failed', e?.message ?? 'fetch_error');
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[voice] groq error', resp.status, text.slice(0, 400));
    fail(resp.status, 'transcription_failed', text.slice(0, 200));
  }
  const data = (await resp.json().catch(() => null)) as { text?: string } | null;
  const transcript = (data?.text ?? '').trim();
  return transcript;
}
