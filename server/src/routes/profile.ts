import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { requireAuth, requirePartner } from '../auth.js';

const r = Router();
r.use(requireAuth, requirePartner);

r.get('/', async (req, res) => {
  const user = await one(
    `SELECT id, email, phone, contact_name, telegram_id, role FROM users WHERE id = $1`,
    [req.user!.uid]
  );
  const partner = req.user!.pid
    ? await one(
        `SELECT id, name, discount_percent, status FROM partners WHERE id = $1`,
        [req.user!.pid]
      )
    : null;
  res.json({ user, partner });
});

const updateSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  contact_name: z.string().max(255).optional(),
  company_name: z.string().max(255).optional(),
});

r.put('/', async (req, res) => {
  const p = updateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid input' });
  const d = p.data;

  if (d.email || d.phone || d.contact_name) {
    await query(
      `UPDATE users SET
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         contact_name = COALESCE($4, contact_name)
       WHERE id = $1`,
      [req.user!.uid, d.email ?? null, d.phone ?? null, d.contact_name ?? null]
    );
  }
  if (d.company_name && req.user!.pid) {
    await query(`UPDATE partners SET name = $2 WHERE id = $1`, [req.user!.pid, d.company_name]);
  }
  res.json({ ok: true });
});

export default r;
