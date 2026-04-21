import { Router } from 'express';
import { env } from '../env.js';
import { handleTelegramUpdate, type TgUpdate } from '../telegramBot.js';

const r = Router();

// In-memory token bucket per telegram_user_id. A burst of more than LIMIT
// updates within WINDOW_MS (e.g. a partner spamming the bot) gets silently
// dropped at the edge so the LLM/DB never sees them. We still 200 OK the
// webhook so Telegram doesn't retry.
const LIMIT = 5;
const WINDOW_MS = 60_000;
const buckets = new Map<number, { count: number; windowStart: number }>();

function allow(tgUserId: number | null | undefined): boolean {
  if (!tgUserId) return true;
  const now = Date.now();
  const b = buckets.get(tgUserId);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(tgUserId, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= LIMIT) return false;
  b.count++;
  return true;
}

function pickUserId(u: TgUpdate): number | null {
  return u.message?.from?.id ?? u.callback_query?.from?.id ?? null;
}

r.post('/webhook', async (req, res) => {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const got = req.header('x-telegram-bot-api-secret-token') ?? '';
    if (got !== env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'bad_secret' });
    }
  } else {
    console.warn('[tgBot] TELEGRAM_WEBHOOK_SECRET is not set — webhook is unauthenticated');
  }
  const update = req.body as TgUpdate;
  const tgUserId = pickUserId(update);
  if (!allow(tgUserId)) {
    console.warn('[tgBot] rate-limited', tgUserId);
    return res.json({ ok: true, rate_limited: true });
  }
  try {
    await handleTelegramUpdate(update);
  } catch (e) {
    console.error('[tgBot] handler threw', e);
  }
  res.json({ ok: true });
});

export default r;
