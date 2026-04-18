import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { one, query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_REG = join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');
const FONT_BOLD = join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf');
const HAS_UA_FONT = existsSync(FONT_REG);

function useFont(doc: PDFKit.PDFDocument, variant: 'reg' | 'bold') {
  if (HAS_UA_FONT) {
    doc.font(variant === 'bold' && existsSync(FONT_BOLD) ? FONT_BOLD : FONT_REG);
  } else {
    doc.font(variant === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
  }
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новий',
  confirmed: 'Підтверджено',
  shipped: 'Відвантажено',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
};

function fmtDate(d: string | Date): string {
  const x = new Date(d);
  return x.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
}

function money(v: number | string): string {
  const n = Number(v);
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type OrderRow = {
  id: string;
  order_number: number;
  status: keyof typeof STATUS_LABELS;
  comment: string | null;
  total_amount: string;
  created_at: string;
  updated_at: string;
  partner_name: string;
  user_contact: string | null;
  user_phone: string | null;
  address_label: string;
  address_text: string;
};

type OrderItem = { name: string; quantity: number; price: string };

export async function streamOrderPdf(orderId: string, res: Response): Promise<void> {
  const order = await one<OrderRow>(
    `SELECT o.id, o.order_number, o.status, o.comment, o.total_amount,
            o.created_at, o.updated_at,
            p.name AS partner_name,
            u.contact_name AS user_contact, u.phone AS user_phone,
            da.label AS address_label, da.address AS address_text
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN users u ON u.id = o.user_id
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
      WHERE o.id = $1`,
    [orderId]
  );
  if (!order) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const items = await query<OrderItem>(
    `SELECT w.name, oi.quantity, oi.price
       FROM order_items oi JOIN wines w ON w.id = oi.wine_id
      WHERE oi.order_id = $1 ORDER BY w.sort_order, w.name`,
    [orderId]
  );

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="order-${order.order_number}.pdf"`);
  doc.pipe(res);

  useFont(doc, 'bold');
  doc.fontSize(18).text('Винарня — Замовлення');
  useFont(doc, 'reg');
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#888').text('[ logo placeholder ]');
  doc.fillColor('#000').moveDown(0.5);

  useFont(doc, 'bold');
  doc.fontSize(14).text(`№ ${order.order_number}`);
  useFont(doc, 'reg');
  doc.fontSize(10).text(`Створено: ${fmtDate(order.created_at)}`);
  doc.text(`Статус: ${STATUS_LABELS[order.status] ?? order.status} (${fmtDate(order.updated_at)})`);
  doc.moveDown(0.5);

  useFont(doc, 'bold');
  doc.fontSize(12).text('Партнер');
  useFont(doc, 'reg');
  doc.fontSize(10).text(order.partner_name);
  if (order.user_contact) doc.text(`Контакт: ${order.user_contact}`);
  if (order.user_phone) doc.text(`Телефон: ${order.user_phone}`);
  doc.moveDown(0.5);

  useFont(doc, 'bold');
  doc.fontSize(12).text('Адреса доставки');
  useFont(doc, 'reg');
  doc.fontSize(10).text(order.address_label);
  doc.text(order.address_text);
  doc.moveDown(0.5);

  const tableTop = doc.y + 6;
  const cols = { n: 40, name: 70, qty: 340, price: 410, sum: 480 };
  useFont(doc, 'bold');
  doc.fontSize(10).fillColor('#555');
  doc.text('#', cols.n, tableTop);
  doc.text('Найменування', cols.name, tableTop);
  doc.text('К-сть', cols.qty, tableTop, { width: 60, align: 'right' });
  doc.text('Ціна', cols.price, tableTop, { width: 60, align: 'right' });
  doc.text('Сума', cols.sum, tableTop, { width: 70, align: 'right' });
  doc.fillColor('#000');
  doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).strokeColor('#aaa').stroke().strokeColor('#000');
  useFont(doc, 'reg');

  let y = tableTop + 20;
  items.forEach((it, i) => {
    const sum = Number(it.price) * it.quantity;
    doc.text(String(i + 1), cols.n, y);
    doc.text(it.name, cols.name, y, { width: 260 });
    doc.text(String(it.quantity), cols.qty, y, { width: 60, align: 'right' });
    doc.text(money(it.price), cols.price, y, { width: 60, align: 'right' });
    doc.text(money(sum), cols.sum, y, { width: 70, align: 'right' });
    y = doc.y + 6;
    if (y > 760) { doc.addPage(); y = 60; }
  });

  doc.moveTo(40, y + 2).lineTo(555, y + 2).strokeColor('#aaa').stroke().strokeColor('#000');
  y += 10;
  useFont(doc, 'bold');
  doc.fontSize(12).text('Разом:', cols.price - 40, y, { width: 100, align: 'right' });
  doc.text(money(order.total_amount), cols.sum, y, { width: 70, align: 'right' });
  useFont(doc, 'reg');

  if (order.comment) {
    doc.moveDown(1.5).fontSize(10).fillColor('#555').text('Коментар:', 40);
    doc.fillColor('#000').text(order.comment, 40);
  }

  if (order.status === 'shipped' || order.status === 'delivered') {
    doc.moveDown(2);
    const sigY = Math.max(doc.y, 720);
    doc.fontSize(10).fillColor('#555').text('Підпис отримувача:', 40, sigY);
    doc.strokeColor('#000').moveTo(170, sigY + 10).lineTo(400, sigY + 10).stroke();
  }

  doc.end();
}
