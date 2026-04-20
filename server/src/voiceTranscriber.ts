import { env } from './env.js';
import { query } from './db.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3';
// Whisper's prompt window is ~224 tokens. Stay well under via char cap.
const PROMPT_MAX_CHARS = 800;
const VOCAB_TTL_MS = 60_000;

let vocabCache: { at: number; prompt: string } | null = null;

function fail(status: number, code: string, detail?: string): never {
  const err: any = new Error(code);
  err.status = status;
  if (detail) err.detail = detail;
  throw err;
}

export async function buildVoiceVocabPrompt(): Promise<string> {
  const now = Date.now();
  if (vocabCache && now - vocabCache.at < VOCAB_TTL_MS) return vocabCache.prompt;

  const partners = await query<{ name: string; legal_name: string | null }>(
    `SELECT name, legal_name FROM partners WHERE status = 'approved'`
  );
  const wines = await query<{ name: string }>(
    `SELECT name FROM wines WHERE is_active = TRUE ORDER BY sort_order, name`
  );

  const seen = new Set<string>();
  const terms: string[] = [];
  function add(s: string | null | undefined) {
    if (!s) return;
    const v = s.trim();
    const k = v.toLowerCase();
    if (!v || seen.has(k)) return;
    seen.add(k);
    terms.push(v);
  }
  for (const p of partners) {
    add(p.name);
    add(p.legal_name);
  }
  for (const w of wines) add(w.name);

  let prompt = `Каталог вин винарні Beykush та назви партнерів-закладів: ${terms.join(', ')}.`;
  if (prompt.length > PROMPT_MAX_CHARS) prompt = prompt.slice(0, PROMPT_MAX_CHARS - 1) + '…';

  vocabCache = { at: now, prompt };
  return prompt;
}

type TranscribeOptions = {
  mime?: string;
  prompt?: string;
  language?: string;
};

export async function transcribeVoice(buffer: Buffer, opts: TranscribeOptions = {}): Promise<string> {
  if (!env.GROQ_API_KEY) fail(503, 'voice_not_configured');

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: opts.mime ?? 'audio/ogg' });
  form.append('file', blob, 'voice.ogg');
  form.append('model', MODEL);
  form.append('response_format', 'json');
  if (opts.language) form.append('language', opts.language);
  if (opts.prompt) form.append('prompt', opts.prompt.slice(0, PROMPT_MAX_CHARS));

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
