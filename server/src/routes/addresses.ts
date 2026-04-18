import { Router } from 'express';
import { z } from 'zod';
import { one, pool, query } from '../db.js';
import { requireAuth, requirePartner } from '../auth.js';

const r = Router();
r.use(requireAuth, requirePartner);

r.get('/', async (req, res) => {
  const rows = await query(
    `SELECT id, label, address, is_default, created_at
       FROM delivery_addresses WHERE partner_id = $1
      ORDER BY is_default DESC, created_at`,
    [req.user!.pid]
  );
  res.json(rows);
});

const bodySchema = z.object({
  label: z.string().min(1).max(255),
  address: z.string().min(1),
  is_default: z.boolean().optional(),
});

async function clearOtherDefaults(partnerId: string, exceptId?: string) {
  await query(
    `UPDATE delivery_addresses SET is_default = FALSE
      WHERE partner_id = $1 AND ($2::uuid IS NULL OR id <> $2)`,
    [partnerId, exceptId ?? null]
  );
}

r.post('/', async (req, res) => {
  const p = bodySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (p.data.is_default) await clearOtherDefaults(req.user!.pid!);
    const { rows: [row] } = await client.query(
      `INSERT INTO delivery_addresses (partner_id, label, address, is_default)
       VALUES ($1, $2, $3, COALESCE($4, FALSE)) RETURNING *`,
      [req.user!.pid, p.data.label, p.data.address, p.data.is_default ?? false]
    );
    await client.query('COMMIT');
    res.status(201).json(row);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

r.put('/:id', async (req, res) => {
  const p = bodySchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const owned = await one(
    `SELECT id FROM delivery_addresses WHERE id = $1 AND partner_id = $2`,
    [req.params.id, req.user!.pid]
  );
  if (!owned) return res.status(404).json({ error: 'not found' });

  if (p.data.is_default) await clearOtherDefaults(req.user!.pid!, req.params.id);

  const row = await one(
    `UPDATE delivery_addresses SET
       label = COALESCE($2, label),
       address = COALESCE($3, address),
       is_default = COALESCE($4, is_default)
     WHERE id = $1 RETURNING *`,
    [req.params.id, p.data.label ?? null, p.data.address ?? null, p.data.is_default ?? null]
  );
  res.json(row);
});

r.delete('/:id', async (req, res) => {
  const result = await query(
    `DELETE FROM delivery_addresses WHERE id = $1 AND partner_id = $2 RETURNING id`,
    [req.params.id, req.user!.pid]
  );
  if (!result.length) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default r;
