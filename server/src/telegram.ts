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
