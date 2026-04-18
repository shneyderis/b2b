import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAuth, requireWarehouse } from '../auth.js';

const r = Router();
r.use(requireAuth, requireWarehouse);

// List only confirmed orders whose partner is assigned to this warehouse.
r.get('/orders', async (req, res) => {
  const wid = req.user!.wid!;
  const rows = await query(
    `SELECT o.id, o.order_number, o.status, o.total_amount,
            o.created_at, o.updated_at,
            p.name AS partner_name,
            da.label AS address_label, da.address AS address_text
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
      WHERE o.status = 'confirmed'
        AND p.warehouse_id = $1
      ORDER BY o.created_at DESC`,
    [wid]
  );
  res.json(rows);
});

r.get('/orders/:id', async (req, res) => {
  const wid = req.user!.wid!;
  const order = await one(
    `SELECT o.id, o.order_number, o.status, o.total_amount, o.comment,
            o.created_at, o.updated_at,
            p.name AS partner_name, p.warehouse_id,
            u.contact_name AS user_contact, u.phone AS user_phone,
            da.label AS address_label, da.address AS address_text
       FROM orders o
       JOIN partners p ON p.id = o.partner_id
       JOIN users u ON u.id = o.user_id
       JOIN delivery_addresses da ON da.id = o.delivery_address_id
      WHERE o.id = $1 AND p.warehouse_id = $2`,
    [req.params.id, wid]
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

// Ship an order: confirmed → shipped. Only for this warehouse's orders.
r.put('/orders/:id/ship', async (req, res) => {
  const wid = req.user!.wid!;
  const existing = await one<{ status: string }>(
    `SELECT o.status FROM orders o
       JOIN partners p ON p.id = o.partner_id
      WHERE o.id = $1 AND p.warehouse_id = $2`,
    [req.params.id, wid]
  );
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (existing.status !== 'confirmed') {
    return res.status(409).json({ error: 'not_confirmed' });
  }
  await query(
    `UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ ok: true });
});

export default r;
