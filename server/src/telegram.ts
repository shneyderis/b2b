// Outbound-only Telegram notifications. Filled in p.4.
import { env } from './env.js';

export async function sendTelegram(chatId: string | number, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('tg send failed', e);
  }
}

export async function notifyManagersNewOrder(_orderId: string) {
  // filled in p.4
}

export async function notifyPartnerStatusChange(_orderId: string, _status: string) {
  // filled in p.4
}
