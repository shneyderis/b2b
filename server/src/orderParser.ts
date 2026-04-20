import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.js';
import { query } from './db.js';

const MODEL = 'claude-haiku-4-5';
const CACHE_TTL_MS = 60 * 1000;

type CatalogEntry = { id: string; name: string };
let catalogCache: { at: number; rows: CatalogEntry[] } | null = null;

async function getCatalog(): Promise<CatalogEntry[]> {
  const now = Date.now();
  if (catalogCache && now - catalogCache.at < CACHE_TTL_MS) return catalogCache.rows;
  const rows = await query<CatalogEntry>(
    `SELECT id, name FROM wines WHERE is_active = TRUE AND stock_quantity > 0 ORDER BY sort_order, name`
  );
  catalogCache = { at: now, rows };
  return rows;
}

export type ParsedOrder = {
  partner_hint: string | null;
  items: { wine_id: string; quantity: number }[];
};

function fail(status: number, code: string, detail?: string): never {
  const err: any = new Error(code);
  err.status = status;
  if (detail) err.detail = detail;
  throw err;
}

export async function parseOrderText(text: string): Promise<ParsedOrder> {
  if (!env.ANTHROPIC_API_KEY) fail(503, 'llm_not_configured');

  const catalog = await getCatalog();
  if (catalog.length === 0) fail(503, 'catalog_empty');

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const system =
    `Ти розпізнаєш замовлення вина з довільного українського/російського/англійського тексту, ` +
    `включно з розмовним стилем («для Артанії треба три каберне», «Густозо хоче дві шардоне», ` +
    `«відправ Накед Раму один кара кермен»). ` +
    `Каталог (id та повна назва):\n` +
    JSON.stringify(catalog) +
    `\n\nВитягни з тексту користувача назву партнера/закладу та позиції. ` +
    `Поверни ЛИШЕ валідний JSON вигляду ` +
    `{"partner_hint":"<назва закладу в називному відмінку, або null>",` +
    `"items":[{"wine_id":"<uuid з каталогу>","quantity":<ціле додатне число>}]}. ` +
    `\n\nПравила для partner_hint: ` +
    `(а) шукай назву закладу/ресторана/ТОВ навіть у непрямих відмінках та конструкціях ` +
    `«для X», «X хоче/замовляє/просить», «відправ X», «відвантаж X»; ` +
    `(б) ОБОВ'ЯЗКОВО приводь до називного відмінка ` +
    `(«італійської редакції» → «Італійська редакція», «густозо» → «Густозо», «накед раму» → «Naked Rum»); ` +
    `(в) ігноруй слова-маркери («для», «треба», «хоче», «будь ласка», «пляшки»); ` +
    `(г) null лише якщо назву взагалі не згадано. ` +
    `\n\nПравила для items: ` +
    `(а) ігноруй регістр, рік, дрібні відмінності, лапки, дефіси; ` +
    `(б) обов'язково транслітеруй між латиницею та кирилицею перед порівнянням ` +
    `(«kara kermen» ↔ «Кара Кермен», «shardone»/«шардоне»/«шардони» ↔ «Шардоне», «artania» ↔ «Артанія», «beykush»/«бейкуш» ↔ «Beykush»); ` +
    `(в) часткова відповідність достатня — якщо текст містить ключові слова з назви, це матч; ` +
    `(г) кількість визначай з тексту («3», «три», «дві пляшки», «x2»); якщо не вказана — 1; ` +
    `(д) якщо позицію впевнено не впізнано — пропусти. ` +
    `\n\nБез markdown, без пояснень, лише JSON.`;

  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: text }],
    });
  } catch (e: any) {
    console.error('[orderParser] anthropic error', {
      status: e?.status,
      message: e?.message,
      type: e?.error?.type,
      body: e?.error,
    });
    const status = typeof e?.status === 'number' ? e.status : 502;
    const detail = e?.error?.error?.message || e?.message || 'anthropic_error';
    fail(status, 'llm_request_failed', detail);
  }

  const part = resp.content.find((p) => p.type === 'text');
  if (!part || part.type !== 'text') fail(502, 'llm_empty_response');
  const raw = part.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[orderParser] invalid JSON from model', raw.slice(0, 500));
    fail(502, 'llm_invalid_json', raw.slice(0, 200));
  }
  const validIds = new Set(catalog.map((w) => w.id));
  const items: { wine_id: string; quantity: number }[] = [];
  for (const it of Array.isArray(parsed?.items) ? parsed.items : []) {
    const id = typeof it?.wine_id === 'string' ? it.wine_id : null;
    const qty = Number(it?.quantity);
    if (!id || !validIds.has(id)) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    items.push({ wine_id: id, quantity: Math.floor(qty) });
  }
  const hintRaw = typeof parsed?.partner_hint === 'string' ? parsed.partner_hint.trim() : '';
  const partner_hint = hintRaw && hintRaw.toLowerCase() !== 'null' ? hintRaw : null;
  return { partner_hint, items };
}
