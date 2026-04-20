import { env } from './env.js';
import { one, query } from './db.js';
import { parseOrderText } from './orderParser.js';
import { createAdminOrder, AdminOrderError } from './adminOrders.js';
import { transcribeVoice, buildVoiceVocabPrompt } from './voiceTranscriber.js';

type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number };
type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  voice?: { file_id: string; duration: number };
};
type TgCallbackQuery = {
  id: string;
  from: TgUser;
  message?: { chat: TgChat; message_id: number };
  data?: string;
};
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
};

export function isAdminId(telegramId: number): boolean {
  if (!env.TELEGRAM_ADMIN_IDS) return false;
  return env.TELEGRAM_ADMIN_IDS.split(',')
    .map((s) => s.trim())
    .includes(String(telegramId));
}

async function tg(method: string, body: Record<string, unknown>): Promise<any> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) console.error('[tgBot]', method, 'failed', resp.status, data);
  return data;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type PartnerRow = {
  id: string;
  name: string;
  legal_name: string | null;
  city: string | null;
  discount_percent: string;
  default_address_id: string | null;
};

async function findPartnersByHint(hint: string): Promise<PartnerRow[]> {
  const normalized = hint.toLowerCase().replace(/[«»"'`]/g, '').trim();
  if (!normalized) return [];
  return await query<PartnerRow>(
    `SELECT p.id, p.name, p.legal_name, p.city, p.discount_percent,
            (SELECT id FROM delivery_addresses da
              WHERE da.partner_id = p.id
              ORDER BY is_default DESC, created_at LIMIT 1) AS default_address_id
       FROM partners p
      WHERE p.status = 'approved'
        AND (
          lower(p.name) ILIKE $1
          OR (p.legal_name IS NOT NULL AND lower(p.legal_name) ILIKE $1)
        )
      ORDER BY length(p.name), p.name
      LIMIT 6`,
    [`%${normalized}%`]
  );
}

async function pickAdminUserId(telegramId: number): Promise<string | null> {
  const r = await one<{ id: string }>(
    `SELECT id FROM users
      WHERE role = 'admin'
      ORDER BY (telegram_id = $1) DESC, created_at
      LIMIT 1`,
    [telegramId]
  );
  return r?.id ?? null;
}

async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {}
) {
  await tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

async function answerCallback(callbackId: string, text?: string) {
  await tg('answerCallbackQuery', { callback_query_id: callbackId, text });
}

function renderPreview(
  partner: PartnerRow,
  items: { name: string; quantity: number; price: number }[],
  total: number
) {
  const list = items.map((i) => `• ${escapeHtml(i.name)} × ${i.quantity} — ${i.price} ₴`).join('\n');
  const legalLine =
    partner.legal_name && partner.legal_name !== partner.name
      ? `\nЮр. особа: ${escapeHtml(partner.legal_name)}`
      : '';
  return (
    `<b>🍷 Нове замовлення</b>\n` +
    `Партнер: <b>${escapeHtml(partner.name)}</b>` +
    (partner.city ? ` (${escapeHtml(partner.city)})` : '') +
    legalLine +
    `\n\n${list}\n\n` +
    `Разом: <b>${total} ₴</b>\n` +
    `Натисни «Підтвердити» щоб створити замовлення.`
  );
}

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  try {
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message) await handleMessage(update.message);
  } catch (e) {
    console.error('[tgBot] unhandled error', e);
  }
}

async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const info = await tg('getFile', { file_id: fileId });
  const filePath = info?.result?.file_path;
  if (!filePath) throw new Error('telegram_file_path_missing');
  const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`telegram_file_download_${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function handleMessage(msg: TgMessage): Promise<void> {
  const from = msg.from;
  if (!from) return;

  const text = (msg.text ?? '').trim();
  if (text.startsWith('/id')) {
    await sendMessage(msg.chat.id, `Твій Telegram ID: <code>${from.id}</code>`);
    return;
  }

  if (!isAdminId(from.id)) {
    await greetNonAdmin(msg.chat.id, from.id);
    return;
  }

  if (msg.voice) {
    await sendMessage(msg.chat.id, '🎙 Розпізнаю голос…');
    let transcript: string;
    try {
      const [buf, vocab] = await Promise.all([
        downloadTelegramFile(msg.voice.file_id),
        buildVoiceVocabPrompt().catch(() => ''),
      ]);
      transcript = await transcribeVoice(buf, { language: 'uk', prompt: vocab || undefined });
    } catch (e: any) {
      const detail = e?.detail || e?.message || 'помилка транскрипції';
      await sendMessage(msg.chat.id, `❌ Не вдалося розпізнати голос: ${escapeHtml(String(detail))}`);
      return;
    }
    if (!transcript) {
      await sendMessage(msg.chat.id, '❌ Голос порожній або нерозбірливий.');
      return;
    }
    await sendMessage(msg.chat.id, `🗣 «${escapeHtml(transcript)}»`);
    await processOrderText(msg, from.id, transcript);
    return;
  }

  if (!text) return;
  if (text.startsWith('/start')) {
    await sendMessage(
      msg.chat.id,
      `Надішли текст замовлення, наприклад:\n<code>Артанія: 3 каберне, 2 шардоне</code>\n\n` +
        `Або надішли голосове — розпізнаю на льоту.`
    );
    return;
  }

  await sendMessage(msg.chat.id, '⏳ Розпізнаю…');
  await processOrderText(msg, from.id, text);
}

async function processOrderText(msg: TgMessage, fromId: number, text: string): Promise<void> {
  let parsed;
  try {
    parsed = await parseOrderText(text);
  } catch (e: any) {
    const detail = e?.detail || e?.message || 'помилка LLM';
    await sendMessage(msg.chat.id, `❌ Не вдалося розпізнати: ${escapeHtml(String(detail))}`);
    return;
  }

  if (parsed.items.length === 0) {
    await sendMessage(msg.chat.id, '❌ Жодної позиції не впізнано з каталогу.');
    return;
  }
  if (!parsed.partner_hint) {
    await sendMessage(
      msg.chat.id,
      '❌ Не вказано партнера. Додай назву закладу на початку, напр. <code>Артанія: 3 каберне</code>.'
    );
    return;
  }

  const candidates = await findPartnersByHint(parsed.partner_hint);
  if (candidates.length === 0) {
    await sendMessage(
      msg.chat.id,
      `❌ Партнера «${escapeHtml(parsed.partner_hint)}» не знайдено.`
    );
    return;
  }
  if (candidates.length > 1) {
    const list = candidates
      .map((p, i) => {
        const legal =
          p.legal_name && p.legal_name !== p.name ? ` / ${escapeHtml(p.legal_name)}` : '';
        const city = p.city ? ` (${escapeHtml(p.city)})` : '';
        return `${i + 1}. ${escapeHtml(p.name)}${legal}${city}`;
      })
      .join('\n');
    await sendMessage(
      msg.chat.id,
      `❓ Знайдено кілька партнерів для «${escapeHtml(parsed.partner_hint)}»:\n${list}\n\nУточни назву.`
    );
    return;
  }

  const partner = candidates[0];
  if (!partner.default_address_id) {
    await sendMessage(
      msg.chat.id,
      `❌ У партнера <b>${escapeHtml(partner.name)}</b> немає збереженої адреси. Додай її у веб-версії.`
    );
    return;
  }

  const discount = Number(partner.discount_percent);
  const ids = parsed.items.map((i) => i.wine_id);
  const wines = await query<{ id: string; name: string; price: string; stock_quantity: number; is_active: boolean }>(
    `SELECT id, name, price, stock_quantity, is_active FROM wines WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const byId = new Map(wines.map((w) => [w.id, w]));
  const priced: { wine_id: string; name: string; quantity: number; price: number }[] = [];
  let total = 0;
  for (const it of parsed.items) {
    const w = byId.get(it.wine_id);
    if (!w || !w.is_active || w.stock_quantity <= 0) continue;
    const price = Math.round(Number(w.price) * (100 - discount)) / 100;
    priced.push({ wine_id: it.wine_id, name: w.name, quantity: it.quantity, price });
    total += price * it.quantity;
  }
  total = Math.round(total * 100) / 100;
  if (priced.length === 0) {
    await sendMessage(msg.chat.id, '❌ Усі розпізнані позиції недоступні (вимкнені або немає залишку).');
    return;
  }

  const pending = await one<{ id: string }>(
    `INSERT INTO pending_telegram_orders
       (telegram_user_id, telegram_chat_id, telegram_message_id,
        partner_id, delivery_address_id, items, raw_text)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [
      fromId,
      msg.chat.id,
      msg.message_id,
      partner.id,
      partner.default_address_id,
      JSON.stringify(priced.map((p) => ({ wine_id: p.wine_id, quantity: p.quantity }))),
      text,
    ]
  );
  if (!pending) return;

  await sendMessage(msg.chat.id, renderPreview(partner, priced, total), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Підтвердити', callback_data: `confirm:${pending.id}` },
          { text: '✖️ Скасувати', callback_data: `cancel:${pending.id}` },
        ],
      ],
    },
  });
}

function partnerKeyboard(): Record<string, unknown> | null {
  const base = env.TELEGRAM_MINIAPP_URL.replace(/\/$/, '');
  if (!base) return null;
  return {
    keyboard: [
      [{ text: '🛒 Новий заказ', web_app: { url: `${base}/orders/new` } }],
      [
        { text: '📋 Мої замовлення', web_app: { url: `${base}/orders` } },
        { text: '👤 Профіль', web_app: { url: `${base}/profile` } },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function greetNonAdmin(chatId: number, tgUserId: number): Promise<void> {
  const partner = await one<{ partner_name: string; partner_status: string }>(
    `SELECT p.name AS partner_name, p.status AS partner_status
       FROM users u JOIN partners p ON p.id = u.partner_id
      WHERE u.telegram_id = $1::bigint AND u.role = 'partner'
      LIMIT 1`,
    [tgUserId]
  );
  if (partner && partner.partner_status === 'approved') {
    const kb = partnerKeyboard();
    await sendMessage(
      chatId,
      `Вітаю, <b>${escapeHtml(partner.partner_name)}</b>! 🍷\n\n` +
        (kb
          ? `Обери дію на клавіатурі нижче.`
          : `Щоб зробити замовлення, відкрий каталог — синя кнопка <b>«Відкрити каталог»</b> ліворуч від поля вводу.`),
      kb ? { reply_markup: kb } : {}
    );
    return;
  }
  if (partner && partner.partner_status !== 'approved') {
    await sendMessage(
      chatId,
      `Заявка на партнерство ще на розгляді. Після схвалення менеджером відкрий Mini App.`,
      { reply_markup: { remove_keyboard: true } }
    );
    return;
  }
  await sendMessage(
    chatId,
    `⛔ Доступ лише для адмінів. Твій Telegram ID: <code>${tgUserId}</code>`,
    { reply_markup: { remove_keyboard: true } }
  );
}

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  if (!isAdminId(cb.from.id)) {
    await answerCallback(cb.id, 'Доступ лише для адмінів');
    return;
  }
  const data = cb.data ?? '';
  const [action, pendingId] = data.split(':');
  if (!pendingId) {
    await answerCallback(cb.id);
    return;
  }
  const pending = await one<{
    id: string;
    partner_id: string;
    delivery_address_id: string;
    items: { wine_id: string; quantity: number }[];
    raw_text: string | null;
  }>(
    `SELECT id, partner_id, delivery_address_id, items, raw_text
       FROM pending_telegram_orders
      WHERE id = $1 AND telegram_user_id = $2`,
    [pendingId, cb.from.id]
  );
  if (!pending) {
    await answerCallback(cb.id, 'Заявка вже оброблена');
    if (cb.message) await editMessage(cb.message.chat.id, cb.message.message_id, '⚠️ Заявка вже оброблена');
    return;
  }

  if (action === 'cancel') {
    await query(`DELETE FROM pending_telegram_orders WHERE id = $1`, [pending.id]);
    await answerCallback(cb.id, 'Скасовано');
    if (cb.message) await editMessage(cb.message.chat.id, cb.message.message_id, '✖️ Скасовано');
    return;
  }

  if (action !== 'confirm') {
    await answerCallback(cb.id);
    return;
  }

  const adminUserId = await pickAdminUserId(cb.from.id);
  if (!adminUserId) {
    await answerCallback(cb.id, 'Немає жодного адмін-користувача в БД');
    return;
  }

  try {
    const order = await createAdminOrder({
      partnerId: pending.partner_id,
      deliveryAddressId: pending.delivery_address_id,
      adminUserId,
      items: pending.items,
      comment: pending.raw_text ? `Telegram: ${pending.raw_text}`.slice(0, 2000) : null,
    });
    await query(`DELETE FROM pending_telegram_orders WHERE id = $1`, [pending.id]);
    await answerCallback(cb.id, 'Створено');
    if (cb.message)
      await editMessage(
        cb.message.chat.id,
        cb.message.message_id,
        `✅ Замовлення №${order.order_number} створено.`
      );
  } catch (e) {
    const code = e instanceof AdminOrderError ? e.message : 'internal_error';
    console.error('[tgBot] createAdminOrder failed', e);
    await answerCallback(cb.id, 'Помилка');
    if (cb.message)
      await editMessage(
        cb.message.chat.id,
        cb.message.message_id,
        `❌ Помилка створення: ${escapeHtml(code)}`
      );
  }
}

