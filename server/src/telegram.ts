import { env } from './env.js';
import { one, query } from './db.js';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новий',
  confirmed: 'Підтверджено',
  shipped: 'Відвантажено',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendTelegram(chatId: string | number, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!resp.ok) console.error('tg send failed', resp.status, await resp.text());
  } catch (e) {
    console.error('tg send error', e);
  }
}

export async function notifyManagersNewOrder(orderId: string): Promise<void> {
  if (!env.TELEGRAM_MANAGERS_CHAT_ID) return;
  const order = await one<{
    order_number: number;
    partner_name: string;
    user_contact: string | null;
    address_label: string;
    total_amount: string;
  }>(
    `SELECT o.order_number, p.name AS partner_name, u.contact_name AS user_contact,
            da.label AS address_label, o.total_amount
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN users u ON u.id = o.user_id
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
      WHERE o.id = $1`,
    [orderId]
  );
  if (!order) return;
  const items = await query<{ name: string; quantity: number }>(
    `SELECT w.name, oi.quantity FROM order_items oi JOIN wines w ON w.id = oi.wine_id
      WHERE oi.order_id = $1 ORDER BY w.sort_order, w.name`,
    [orderId]
  );
  const list = items.map((i) => `• ${escapeHtml(i.name)} × ${i.quantity}`).join('\n');
  const text =
    `<b>🍷 Нове замовлення #${order.order_number}</b>\n` +
    `Партнер: ${escapeHtml(order.partner_name)}\n` +
    (order.user_contact ? `Контакт: ${escapeHtml(order.user_contact)}\n` : '') +
    `Адреса: ${escapeHtml(order.address_label)}\n` +
    `Сума: <b>${order.total_amount}</b>\n\n` +
    list;
  await sendTelegram(env.TELEGRAM_MANAGERS_CHAT_ID, text);
}

export async function notifyManagersNewPartner(partnerId: string): Promise<void> {
  if (!env.TELEGRAM_MANAGERS_CHAT_ID) return;
  const p = await one<{
    name: string;
    legal_name: string | null;
    city: string | null;
    contact_name: string | null;
    phone: string | null;
  }>(
    `SELECT p.name, p.legal_name, p.city,
            u.contact_name, u.phone
       FROM partners p
       JOIN users u ON u.partner_id = p.id
      WHERE p.id = $1
      ORDER BY u.created_at
      LIMIT 1`,
    [partnerId]
  );
  if (!p) return;
  const text =
    `<b>🆕 Заявка на партнерство</b>\n` +
    `${escapeHtml(p.name)}` +
    (p.legal_name && p.legal_name !== p.name ? ` / ${escapeHtml(p.legal_name)}` : '') +
    (p.city ? ` (${escapeHtml(p.city)})` : '') +
    `\n` +
    (p.contact_name ? `Контакт: ${escapeHtml(p.contact_name)}\n` : '') +
    (p.phone ? `Телефон: ${escapeHtml(p.phone)}\n` : '') +
    `\nВідкрий /admin/partners щоб схвалити.`;
  await sendTelegram(env.TELEGRAM_MANAGERS_CHAT_ID, text);
}

export async function notifyPartnerStatusChange(orderId: string, status: string): Promise<void> {
  const row = await one<{
    order_number: number;
    partner_name: string;
    telegram_id: string | null;
  }>(
    `SELECT o.order_number, p.name AS partner_name, u.telegram_id
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN users u ON u.id = o.user_id
      WHERE o.id = $1`,
    [orderId]
  );
  if (!row || !row.telegram_id) return;
  const label = STATUS_LABELS[status] ?? status;
  const text =
    `<b>Замовлення #${row.order_number}</b>\n` +
    `Новий статус: <b>${label}</b>`;
  await sendTelegram(row.telegram_id, text);
}

export async function notifyPasswordReset(
  telegramId: string,
  resetUrl: string,
  email: string
): Promise<void> {
  const text =
    `<b>🔑 Скидання паролю</b>\n\n` +
    `Хтось запросив скидання паролю для ${escapeHtml(email)}.\n` +
    `Якщо це були ви — перейдіть за посиланням (діє 30 хвилин):\n\n` +
    `${escapeHtml(resetUrl)}\n\n` +
    `Якщо це не ви — просто проігноруйте це повідомлення.`;
  await sendTelegram(telegramId, text);
}

export async function notifyWarehouseOrderConfirmed(orderId: string): Promise<void> {
  const order = await one<{
    order_number: number;
    partner_name: string;
    address_label: string;
    address_text: string;
    total_amount: string;
    warehouse_chat_id: string | null;
  }>(
    `SELECT o.order_number, p.name AS partner_name,
            da.label AS address_label, da.address AS address_text,
            o.total_amount, w.telegram_chat_id AS warehouse_chat_id
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
       LEFT JOIN warehouses w ON w.id = p.warehouse_id
      WHERE o.id = $1`,
    [orderId]
  );
  if (!order || !order.warehouse_chat_id) return;
  const items = await query<{ name: string; quantity: number; price: string }>(
    `SELECT w.name, oi.quantity, oi.price
       FROM order_items oi JOIN wines w ON w.id = oi.wine_id
      WHERE oi.order_id = $1 ORDER BY w.sort_order, w.name`,
    [orderId]
  );
  const list = items
    .map((i) => `• ${escapeHtml(i.name)} × ${i.quantity} — ${i.price} ₴`)
    .join('\n');
  const text =
    `<b>🍷 Замовлення №${order.order_number} готове до відвантаження</b>\n` +
    `Партнер: ${escapeHtml(order.partner_name)}\n` +
    `Адреса: ${escapeHtml(order.address_label)}, ${escapeHtml(order.address_text)}\n` +
    `\n${list}\n\n` +
    `Разом: <b>${order.total_amount} ₴</b>`;
  await sendTelegram(order.warehouse_chat_id, text);
}
