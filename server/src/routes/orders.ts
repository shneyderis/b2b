import { Router } from 'express';
import { z } from 'zod';
import { one, pool, query } from '../db.js';
import { requireAuth, requirePartner } from '../auth.js';
import { streamOrderPdf } from '../pdf.js';
import { notifyManagersNewOrder } from '../telegram.js';

const r = Router();
r.use(requireAuth, requirePartner);

const itemSchema = z.object({
  wine_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});
const createSchema = z.object({
  delivery_address_id: z.string().uuid(),
  comment: z.string().max(2000).optional().nullable(),
  items: z.array(itemSchema).min(1),
});

async function loadOrder(orderId: string, partnerId: string) {
  const order = await one(
    `SELECT o.*, da.label AS address_label, da.address AS address_text
       FROM orders o
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
      WHERE o.id = $1 AND o.partner_id = $2`,
    [orderId, partnerId]
  );
  if (!order) return null;
  const items = await query(
    `SELECT oi.id, oi.wine_id, oi.quantity, oi.price, w.name
       FROM order_items oi JOIN wines w ON w.id = oi.wine_id
      WHERE oi.order_id = $1 ORDER BY w.sort_order, w.name`,
    [orderId]
  );
  return { ...order, items };
}

function applyDiscount(price: number, discountPercent: number) {
  const raw = Number(price) * (100 - Number(discountPercent)) / 100;
  return Math.round(raw * 100) / 100;
}

r.get('/', async (req, res) => {
  const { status } = req.query;
  const params: any[] = [req.user!.pid];
  let sql = `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
                    da.label AS address_label
               FROM orders o
               JOIN delivery_addresses da ON da.id = o.delivery_address_id
              WHERE o.partner_id = $1`;
  if (typeof status === 'string' && status) {
    params.push(status);
    sql += ` AND o.status = $${params.length}`;
  }
  sql += ` ORDER BY o.created_at DESC`;
  res.json(await query(sql, params));
});

r.get('/:id', async (req, res) => {
  const order = await loadOrder(req.params.id, req.user!.pid!);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});

r.get('/:id/pdf', async (req, res) => {
  const owned = await one(
    `SELECT id FROM orders WHERE id = $1 AND partner_id = $2`,
    [req.params.id, req.user!.pid]
  );
  if (!owned) return res.status(404).json({ error: 'not found' });
  await streamOrderPdf(req.params.id, res);
});

async function priceWinesForPartner(partnerId: string, items: { wine_id: string; quantity: number }[]) {
  const partner = await one<{ discount_percent: string }>(
    `SELECT discount_percent FROM partners WHERE id = $1`,
    [partnerId]
  );
  const discount = Number(partner?.discount_percent ?? 0);
  const ids = items.map((i) => i.wine_id);
  const wines = await query<{ id: string; price: string; stock_quantity: number; is_active: boolean; name: string }>(
    `SELECT id, name, price, stock_quantity, is_active FROM wines WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const byId = new Map(wines.map((w) => [w.id, w]));
  const priced: { wine_id: string; quantity: number; price: number }[] = [];
  let total = 0;
  for (const it of items) {
    const w = byId.get(it.wine_id);
    if (!w || !w.is_active) throw Object.assign(new Error(`wine_unavailable:${it.wine_id}`), { status: 400 });
    if (w.stock_quantity <= 0) throw Object.assign(new Error(`wine_out_of_stock:${it.wine_id}`), { status: 400 });
    const price = applyDiscount(Number(w.price), discount);
    priced.push({ wine_id: it.wine_id, quantity: it.quantity, price });
    total += price * it.quantity;
  }
  return { priced, total: Math.round(total * 100) / 100 };
}

r.post('/', async (req, res) => {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });

  const addr = await one(
    `SELECT id FROM delivery_addresses WHERE id = $1 AND partner_id = $2`,
    [p.data.delivery_address_id, req.user!.pid]
  );
  if (!addr) return res.status(400).json({ error: 'invalid_address' });

  const { priced, total } = await priceWinesForPartner(req.user!.pid!, p.data.items);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (partner_id, user_id, delivery_address_id, comment, total_amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, order_number`,
      [req.user!.pid, req.user!.uid, p.data.delivery_address_id, p.data.comment ?? null, total]
    );
    for (const it of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, wine_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, it.wine_id, it.quantity, it.price]
      );
    }
    await client.query('COMMIT');
    void notifyManagersNewOrder(order.id);
    res.status(201).json({ id: order.id, order_number: order.order_number });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

r.put('/:id', async (req, res) => {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });

  const existing = await one<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE id = $1 AND partner_id = $2`,
    [req.params.id, req.user!.pid]
  );
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (existing.status !== 'new') return res.status(409).json({ error: 'not_editable' });

  const addr = await one(
    `SELECT id FROM delivery_addresses WHERE id = $1 AND partner_id = $2`,
    [p.data.delivery_address_id, req.user!.pid]
  );
  if (!addr) return res.status(400).json({ error: 'invalid_address' });

  const { priced, total } = await priceWinesForPartner(req.user!.pid!, p.data.items);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE orders SET delivery_address_id = $2, comment = $3, total_amount = $4, updated_at = NOW()
        WHERE id = $1`,
      [req.params.id, p.data.delivery_address_id, p.data.comment ?? null, total]
    );
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [req.params.id]);
    for (const it of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, wine_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [req.params.id, it.wine_id, it.quantity, it.price]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

r.delete('/:id', async (req, res) => {
  const existing = await one<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE id = $1 AND partner_id = $2`,
    [req.params.id, req.user!.pid]
  );
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (existing.status !== 'new') return res.status(409).json({ error: 'not_deletable' });

  await query(`DELETE FROM orders WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default r;
