# Telegram admin bot

Admins can send free-form order text to the bot and get a
"Підтвердити / Скасувати" preview before the order is actually created.
Partner selection happens by fuzzy-matching the name the admin types against
`partners.name`.

## One-time setup

1. Create a bot via `@BotFather` (`/newbot`) and copy the token.
2. In Vercel → Settings → Environment Variables, add:
   - `TELEGRAM_BOT_TOKEN` — bot token from BotFather.
   - `TELEGRAM_ADMIN_IDS` — comma-separated Telegram user IDs allowed to
     place orders (e.g. `123456789,987654321`). You can get yours by
     DM'ing the bot after setup and sending `/id`.
   - `TELEGRAM_WEBHOOK_SECRET` — any random string; Telegram will send it
     back in the `X-Telegram-Bot-Api-Secret-Token` header, so bogus POSTs
     to `/api/telegram/webhook` are rejected.
   - `ANTHROPIC_API_KEY` — Claude Haiku parses the freeform order text.
   - `GROQ_API_KEY` — *optional*, enables voice-message transcription via
     Whisper. Without it, voice messages get an error reply.
3. Deploy, then register the webhook once locally:
   ```sh
   WEBHOOK_URL=https://your.vercel.app/api/telegram/webhook \
   TELEGRAM_BOT_TOKEN=... \
   TELEGRAM_WEBHOOK_SECRET=... \
     npm run -w server tg:webhook
   ```
   The script calls Telegram's `setWebhook` and prints `getWebhookInfo`.

## Usage

- `/start` — shows the expected format.
- `/id` — prints your Telegram user ID.
- Free-form text like `Артанія: 3 каберне, 2 шардоне` — bot replies with a
  parsed preview and two inline buttons:
  - **Підтвердити** → creates an order with status `confirmed`, fires the
    same manager + warehouse Telegram notifications as the web admin flow.
  - **Скасувати** → throws away the pending preview.

Orders created through the bot land in `orders.user_id` under the first
admin user whose `telegram_id` matches the sender, falling back to any
admin if there's no match.

## Voice messages

Send a voice message to the bot — it'll:

1. Reply with `🎙 Розпізнаю голос…`.
2. Download the .ogg from Telegram, send to Groq Whisper
   (`whisper-large-v3`), get the transcript.
3. Echo the transcript back as `🗣 «…»` so you can sanity-check it.
4. Pipe the same transcript through the Anthropic order parser → preview
   with Підтвердити / Скасувати, identical to the text path.

Voice path needs `GROQ_API_KEY` set; without it the bot replies with
`❌ Не вдалося розпізнати голос: voice_not_configured`. Get a key at
<https://console.groq.com/keys> — Whisper there is roughly $0.03/hour of
audio.

Telegram voice clips are usually well under 1 MB and Whisper transcribes
them in ~1–2s, leaving plenty of room inside the Vercel 10s function
budget alongside the LLM parse (~5s).
