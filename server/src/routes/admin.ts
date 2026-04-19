import { Router } from 'express';
import { z } from 'zod';
import { one, pool, query } from '../db.js';
import { requireAdmin, requireAuth, hashPassword } from '../auth.js';
import { streamOrderPdf } from '../pdf.js';
import {
  notifyManagersNewOrder,
  notifyPartnerStatusChange,
  notifyWarehouseOrderConfirmed,
} from '../telegram.js';

const r = Router();
r.use(requireAuth, requireAdmin);

/* ---------------- orders ---------------- */

const EDITABLE_STATUSES = new Set(['new', 'confirmed', 'shipped']);
const ALL_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
type Status = (typeof ALL_STATUSES)[number];

r.get('/orders', async (req, res) => {
  const { status, partner_id, date_from, date_to } = req.query as Record<string, string | undefined>;
  const params: any[] = [];
  const where: string[] = [];
  if (status) { params.push(status); where.push(`o.status = $${params.length}`); }
  if (partner_id) { params.push(partner_id); where.push(`o.partner_id = $${params.length}`); }
  if (date_from) { params.push(date_from); where.push(`o.created_at >= $${params.length}`); }
  if (date_to) { params.push(date_to); where.push(`o.created_at < $${params.length}`); }

  const sql = `
    SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
           p.name AS partner_name, u.contact_name AS user_contact,
           da.label AS address_label
      FROM orders o
      JOIN partners p ON p.id = o.partner_id
      JOIN users u ON u.id = o.user_id
      JOIN delivery_addresses da ON da.id = o.delivery_address_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.created_at DESC`;
  res.json(await query(sql, params));
});

r.get('/orders/:id', async (req, res) => {
  const order = await one(
    `SELECT o.*, p.name AS partner_name, p.discount_percent,
            u.contact_name AS user_contact, u.phone AS user_phone, u.email AS user_email,
            da.label AS address_label, da.address AS address_text
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN users u ON u.id = o.user_id
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
      WHERE o.id = $1`,
    [req.params.id]
  );
  if (!order) return res.status(404).json({ error: 'not found' });
  const items = await query(
    `SELECT oi.id, oi.wine_id, oi.quantity, oi.price, w.name
       FROM order_items oi JOIN wines w ON w.id = oi.wine_id
      WHERE oi.order_id = $1 ORDER BY w.sort_order, w.name`,
    [req.params.id]
  );
  res.json({ ...order, items });
});

r.get('/orders/:id/pdf', async (req, res) => {
  const exists = await one(`SELECT id FROM orders WHERE id = $1`, [req.params.id]);
  if (!exists) return res.status(404).json({ error: 'not found' });
  await streamOrderPdf(req.params.id, res);
});

const itemSchema = z.object({
  wine_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative().optional(),
});
const editSchema = z.object({
  delivery_address_id: z.string().uuid().optional(),
  comment: z.string().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1).optional(),
});

r.put('/orders/:id', async (req, res) => {
  const p = editSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });

  const existing = await one<{ status: Status }>(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (!EDITABLE_STATUSES.has(existing.status)) return res.status(409).json({ error: 'not_editable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (p.data.delivery_address_id || p.data.comment !== undefined) {
      await client.query(
        `UPDATE orders SET
           delivery_address_id = COALESCE($2, delivery_address_id),
           comment = COALESCE($3, comment),
           updated_at = NOW()
         WHERE id = $1`,
        [req.params.id, p.data.delivery_address_id ?? null, p.data.comment ?? null]
      );
    }
    if (p.data.items) {
      const partner = await one<{ discount_percent: string }>(
        `SELECT pa.discount_percent
           FROM orders o JOIN partners pa ON pa.id = o.partner_id
          WHERE o.id = $1`,
        [req.params.id]
      );
      const discount = Number(partner?.discount_percent ?? 0);
      const ids = p.data.items.map((i) => i.wine_id);
      const wines = await query<{ id: string; price: string }>(
        `SELECT id, price FROM wines WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      const wineMap = new Map(wines.map((w) => [w.id, Number(w.price)]));
      await client.query(`DELETE FROM order_items WHERE order_id = $1`, [req.params.id]);
      let total = 0;
      for (const it of p.data.items) {
        const base = wineMap.get(it.wine_id) ?? 0;
        const price = Math.round(base * (100 - discount)) / 100;
        total += price * it.quantity;
        await client.query(
          `INSERT INTO order_items (order_id, wine_id, quantity, price) VALUES ($1, $2, $3, $4)`,
          [req.params.id, it.wine_id, it.quantity, price]
        );
      }
      await client.query(`UPDATE orders SET total_amount = $2, updated_at = NOW() WHERE id = $1`, [
        req.params.id,
        Math.round(total * 100) / 100,
      ]);
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

const createOrderSchema = z.object({
  partner_id: z.string().uuid(),
  delivery_address_id: z.string().uuid(),
  comment: z.string().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1),
});

r.post('/orders', async (req, res) => {
  const p = createOrderSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });

  const partner = await one<{ id: string; discount_percent: string }>(
    `SELECT id, discount_percent FROM partners WHERE id = $1`,
    [p.data.partner_id]
  );
  if (!partner) return res.status(400).json({ error: 'partner_not_found' });

  const addr = await one(
    `SELECT id FROM delivery_addresses WHERE id = $1 AND partner_id = $2`,
    [p.data.delivery_address_id, partner.id]
  );
  if (!addr) return res.status(400).json({ error: 'invalid_address' });

  const discount = Number(partner.discount_percent);
  const ids = p.data.items.map((i) => i.wine_id);
  const wines = await query<{ id: string; price: string; stock_quantity: number; is_active: boolean }>(
    `SELECT id, price, stock_quantity, is_active FROM wines WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const byId = new Map(wines.map((w) => [w.id, w]));
  const priced: { wine_id: string; quantity: number; price: number }[] = [];
  let total = 0;
  for (const it of p.data.items) {
    const w = byId.get(it.wine_id);
    if (!w || !w.is_active) return res.status(400).json({ error: `wine_unavailable:${it.wine_id}` });
    if (w.stock_quantity <= 0) return res.status(400).json({ error: `wine_out_of_stock:${it.wine_id}` });
    const price = Math.round(Number(w.price) * (100 - discount)) / 100;
    priced.push({ wine_id: it.wine_id, quantity: it.quantity, price });
    total += price * it.quantity;
  }
  total = Math.round(total * 100) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (partner_id, user_id, delivery_address_id, comment, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING id, order_number`,
      [partner.id, req.user!.uid, p.data.delivery_address_id, p.data.comment ?? null, total]
    );
    for (const it of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, wine_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, it.wine_id, it.quantity, it.price]
      );
    }
    await client.query('COMMIT');
    void notifyManagersNewOrder(order.id);
    void notifyWarehouseOrderConfirmed(order.id);
    res.status(201).json({ id: order.id, order_number: order.order_number });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

const statusSchema = z.object({ status: z.enum(ALL_STATUSES) });

r.put('/orders/:id/status', async (req, res) => {
  const p = statusSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });

  const existing = await one<{ status: Status }>(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (existing.status === 'delivered' || existing.status === 'cancelled')
    return res.status(409).json({ error: 'terminal_status' });

  await query(`UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`, [
    req.params.id,
    p.data.status,
  ]);
  void notifyPartnerStatusChange(req.params.id, p.data.status);
  if (p.data.status === 'confirmed') void notifyWarehouseOrderConfirmed(req.params.id);
  res.json({ ok: true });
});

r.delete('/orders/:id', async (req, res) => {
  const existing = await one<{ status: Status }>(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (existing.status === 'delivered') return res.status(409).json({ error: 'not_deletable' });
  await query(`DELETE FROM orders WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

/* ---------------- wines ---------------- */

r.get('/wines', async (_req, res) => {
  res.json(await query(
    `SELECT id, name, price, stock_quantity, sort_order, is_active, created_at
       FROM wines ORDER BY sort_order, name`
  ));
});

const wineSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().nonnegative(),
  stock_quantity: z.number().int().nonnegative(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

r.post('/wines', async (req, res) => {
  const p = wineSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const row = await one(
    `INSERT INTO wines (name, price, stock_quantity, sort_order, is_active)
     VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, TRUE)) RETURNING *`,
    [p.data.name, p.data.price, p.data.stock_quantity, p.data.sort_order ?? null, p.data.is_active ?? null]
  );
  res.status(201).json(row);
});

r.put('/wines/:id', async (req, res) => {
  const p = wineSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const row = await one(
    `UPDATE wines SET
       name = COALESCE($2, name),
       price = COALESCE($3, price),
       stock_quantity = COALESCE($4, stock_quantity),
       sort_order = COALESCE($5, sort_order),
       is_active = COALESCE($6, is_active)
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      p.data.name ?? null,
      p.data.price ?? null,
      p.data.stock_quantity ?? null,
      p.data.sort_order ?? null,
      p.data.is_active ?? null,
    ]
  );
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

/* ---------------- warehouses ---------------- */

r.get('/warehouses', async (_req, res) => {
  res.json(await query(
    `SELECT id, name, telegram_chat_id, created_at FROM warehouses ORDER BY created_at`
  ));
});

const warehouseCreateSchema = z.object({
  name: z.string().min(1).max(255),
  telegram_chat_id: z.string().max(64).nullable().optional(),
});

r.post('/warehouses', async (req, res) => {
  const p = warehouseCreateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const row = await one(
    `INSERT INTO warehouses (name, telegram_chat_id) VALUES ($1, $2) RETURNING *`,
    [p.data.name, p.data.telegram_chat_id || null]
  );
  res.status(201).json(row);
});

const warehouseUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  telegram_chat_id: z.string().max(64).nullable().optional(),
});

r.put('/warehouses/:id', async (req, res) => {
  const p = warehouseUpdateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const row = await one(
    `UPDATE warehouses SET
       name = COALESCE($2, name),
       telegram_chat_id = CASE WHEN $3::boolean THEN $4 ELSE telegram_chat_id END
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      p.data.name ?? null,
      p.data.telegram_chat_id !== undefined,
      p.data.telegram_chat_id ?? null,
    ]
  );
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

/* ---------------- warehouse staff users ---------------- */

const warehouseUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  contact_name: z.string().max(255).optional(),
  warehouse_id: z.string().uuid(),
});

r.post('/warehouse-users', async (req, res) => {
  const p = warehouseUserSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const exists = await one(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [p.data.email]);
  if (exists) return res.status(409).json({ error: 'email_taken' });
  const wh = await one(`SELECT id FROM warehouses WHERE id = $1`, [p.data.warehouse_id]);
  if (!wh) return res.status(400).json({ error: 'warehouse_not_found' });
  const hash = await hashPassword(p.data.password);
  const row = await one(
    `INSERT INTO users (email, password_hash, contact_name, role, warehouse_id)
     VALUES ($1, $2, $3, 'warehouse', $4)
     RETURNING id, email, contact_name, warehouse_id, created_at`,
    [p.data.email, hash, p.data.contact_name ?? null, p.data.warehouse_id]
  );
  res.status(201).json(row);
});

/* ---------------- partners ---------------- */

r.get('/partners', async (req, res) => {
  const { status } = req.query as Record<string, string | undefined>;
  const params: any[] = [];
  let sql = `
    SELECT p.id, p.name, p.discount_percent, p.status, p.notes, p.created_at,
           p.city, p.warehouse_id, w.name AS warehouse_name,
           COALESCE(u.users, '[]'::jsonb) AS users,
           COALESCE(a.addresses, '[]'::jsonb) AS addresses
      FROM partners p
      LEFT JOIN warehouses w ON w.id = p.warehouse_id
      LEFT JOIN (
        SELECT partner_id, jsonb_agg(jsonb_build_object(
          'id', id, 'email', email, 'phone', phone,
          'contact_name', contact_name, 'telegram_id', telegram_id
        ) ORDER BY created_at) AS users
        FROM users WHERE role = 'partner' GROUP BY partner_id
      ) u ON u.partner_id = p.id
      LEFT JOIN (
        SELECT partner_id, jsonb_agg(jsonb_build_object(
          'id', id, 'label', label, 'address', address, 'is_default', is_default
        ) ORDER BY is_default DESC, created_at) AS addresses
        FROM delivery_addresses GROUP BY partner_id
      ) a ON a.partner_id = p.id`;
  if (status) {
    params.push(status);
    sql += ` WHERE p.status = $${params.length}`;
  }
  sql += ` ORDER BY p.created_at DESC`;
  res.json(await query(sql, params));
});

const createPartnerSchema = z.object({
  name: z.string().min(1).max(255),
  discount_percent: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  city: z.string().max(128).nullable().optional(),
  warehouse_id: z.string().uuid().optional(),
  user: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().max(50).optional(),
    contact_name: z.string().max(255).optional(),
  }),
});

r.post('/partners', async (req, res) => {
  const p = createPartnerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });

  const exists = await one(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [p.data.user.email]);
  if (exists) return res.status(409).json({ error: 'email_taken' });

  const defaultWh = p.data.warehouse_id
    ? null
    : await one<{ id: string }>(`SELECT id FROM warehouses ORDER BY created_at LIMIT 1`);
  const warehouseId = p.data.warehouse_id ?? defaultWh?.id ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [partner] } = await client.query(
      `INSERT INTO partners (name, discount_percent, notes, status, warehouse_id, city)
       VALUES ($1, COALESCE($2, 0), $3, 'approved', $4, $5) RETURNING *`,
      [p.data.name, p.data.discount_percent ?? null, p.data.notes ?? null, warehouseId, p.data.city ?? null]
    );
    const hash = await hashPassword(p.data.user.password);
    await client.query(
      `INSERT INTO users (partner_id, email, phone, password_hash, contact_name, role)
       VALUES ($1, $2, $3, $4, $5, 'partner')`,
      [partner.id, p.data.user.email, p.data.user.phone ?? null, hash, p.data.user.contact_name ?? null]
    );
    await client.query('COMMIT');
    res.status(201).json(partner);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

const updatePartnerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  city: z.string().max(128).nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
});

r.put('/partners/:id', async (req, res) => {
  const p = updatePartnerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const row = await one(
    `UPDATE partners SET
       name = COALESCE($2, name),
       discount_percent = COALESCE($3, discount_percent),
       notes = COALESCE($4, notes),
       warehouse_id = COALESCE($5, warehouse_id),
       city = COALESCE($6, city)
     WHERE id = $1 RETURNING *`,
    [
      req.params.id,
      p.data.name ?? null,
      p.data.discount_percent ?? null,
      p.data.notes ?? null,
      p.data.warehouse_id ?? null,
      p.data.city ?? null,
    ]
  );
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

// Add a partner user (i.e. a login) to an existing partner. Used to
// activate partners that were imported without any users attached.
const partnerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().max(50).optional(),
  contact_name: z.string().max(255).optional(),
});

r.post('/partners/:id/users', async (req, res) => {
  const p = partnerUserSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const partner = await one(`SELECT id FROM partners WHERE id = $1`, [req.params.id]);
  if (!partner) return res.status(404).json({ error: 'partner_not_found' });
  const exists = await one(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [p.data.email]);
  if (exists) return res.status(409).json({ error: 'email_taken' });
  const hash = await hashPassword(p.data.password);
  const row = await one(
    `INSERT INTO users (partner_id, email, phone, password_hash, contact_name, role)
     VALUES ($1, $2, $3, $4, $5, 'partner')
     RETURNING id, email, phone, contact_name, telegram_id`,
    [req.params.id, p.data.email, p.data.phone ?? null, hash, p.data.contact_name ?? null]
  );
  res.status(201).json(row);
});

const partnerStatusSchema = z.object({ status: z.enum(['pending', 'approved', 'rejected']) });

r.put('/partners/:id/status', async (req, res) => {
  const p = partnerStatusSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const row = await one(
    `UPDATE partners SET status = $2 WHERE id = $1 RETURNING id, status`,
    [req.params.id, p.data.status]
  );
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

export default r;
