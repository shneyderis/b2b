// Registers the Telegram bot webhook with Telegram.
//
// Usage:
//   WEBHOOK_URL=https://your.vercel.app/api/telegram/webhook \
//   TELEGRAM_BOT_TOKEN=... \
//   TELEGRAM_WEBHOOK_SECRET=... \
//     npx tsx server/scripts/setTelegramWebhook.ts
//
// Or run with TELEGRAM_WEBHOOK_DELETE=1 to remove the current webhook.

import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const url = process.env.WEBHOOK_URL;
const del = process.env.TELEGRAM_WEBHOOK_DELETE === '1';

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

async function main() {
  if (del) {
    const r = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: 'POST' });
    console.log('deleteWebhook:', r.status, await r.text());
    return;
  }
  if (!url) {
    console.error('WEBHOOK_URL is required (unless TELEGRAM_WEBHOOK_DELETE=1)');
    process.exit(1);
  }
  const body = {
    url,
    secret_token: secret || undefined,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  };
  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log('setWebhook:', r.status, await r.text());

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log('getWebhookInfo:', await info.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
