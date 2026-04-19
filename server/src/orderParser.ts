import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.js';
import { query } from './db.js';

const MODEL = 'claude-haiku-4-5-20251001';
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

export type ParsedOrder = { items: { wine_id: string; quantity: number }[] };

export async function parseOrderText(text: string): Promise<ParsedOrder> {
  if (!env.ANTHROPIC_API_KEY) {
    const err: any = new Error('llm_not_configured');
    err.status = 503;
    throw err;
  }
  const catalog = await getCatalog();
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const system =
    `Ти розпізнаєш замовлення вина з довільного українського/російського тексту. ` +
    `У мене такий каталог (id та повна назва вина):\n` +
    JSON.stringify(catalog) +
    `\n\nЗ тексту користувача витягни позиції та поверни ЛИШЕ валідний JSON вигляду ` +
    `{"items":[{"wine_id":"<uuid з каталогу>","quantity":<ціле додатне число>}]}. ` +
    `Використовуй тільки id з каталогу. Якщо кількість не вказана — 1. ` +
    `Якщо позицію не впізнано — пропусти її. Без пояснень, без markdown, лише JSON.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: text }],
  });

  const part = resp.content.find((p) => p.type === 'text');
  if (!part || part.type !== 'text') {
    const err: any = new Error('llm_empty_response');
    err.status = 502;
    throw err;
  }
  const raw = part.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err: any = new Error('llm_invalid_json');
    err.status = 502;
    throw err;
  }
  const validIds = new Set(catalog.map((w) => w.id));
  const items: { wine_id: string; quantity: number }[] = [];
  for (const raw of Array.isArray(parsed?.items) ? parsed.items : []) {
    const id = typeof raw?.wine_id === 'string' ? raw.wine_id : null;
    const qty = Number(raw?.quantity);
    if (!id || !validIds.has(id)) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    items.push({ wine_id: id, quantity: Math.floor(qty) });
  }
  return { items };
}
