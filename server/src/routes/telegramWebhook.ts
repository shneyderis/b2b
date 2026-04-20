import { Router } from 'express';
import { env } from '../env.js';
import { handleTelegramUpdate, type TgUpdate } from '../telegramBot.js';

const r = Router();

r.post('/webhook', (req, res) => {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const got = req.header('x-telegram-bot-api-secret-token') ?? '';
    if (got !== env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'bad_secret' });
    }
  }
  // Acknowledge to Telegram immediately; handler runs async. If it
  // throws, we've already returned 200 — Telegram won't retry-bomb us.
  res.json({ ok: true });
  void handleTelegramUpdate(req.body as TgUpdate);
});

export default r;
