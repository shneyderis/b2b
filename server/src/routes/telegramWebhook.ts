import { Router } from 'express';
import { env } from '../env.js';
import { handleTelegramUpdate, type TgUpdate } from '../telegramBot.js';

const r = Router();

r.post('/webhook', async (req, res) => {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const got = req.header('x-telegram-bot-api-secret-token') ?? '';
    if (got !== env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'bad_secret' });
    }
  } else {
    console.warn('[tgBot] TELEGRAM_WEBHOOK_SECRET is not set — webhook is unauthenticated');
  }
  try {
    await handleTelegramUpdate(req.body as TgUpdate);
  } catch (e) {
    console.error('[tgBot] handler threw', e);
  }
  res.json({ ok: true });
});

export default r;
