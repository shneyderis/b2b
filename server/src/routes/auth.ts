import { Router } from 'express';
import { z } from 'zod';
import { one, pool } from '../db.js';
import { hashPassword, signToken, verifyPassword } from '../auth.js';

const r = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

r.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const { email, password } = parsed.data;

  const row = await one<{
    id: string;
    partner_id: string | null;
    warehouse_id: string | null;
    password_hash: string;
    role: 'partner' | 'admin' | 'warehouse';
    partner_status: 'pending' | 'approved' | 'rejected' | null;
  }>(
    `SELECT u.id, u.partner_id, u.warehouse_id, u.password_hash, u.role,
            p.status AS partner_status
       FROM users u LEFT JOIN partners p ON p.id = u.partner_id
      WHERE lower(u.email) = lower($1)`,
    [email]
  );
  if (!row) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  if (row.role === 'partner' && row.partner_status !== 'approved') {
    return res.status(403).json({ error: 'partner_not_approved', status: row.partner_status });
  }
  if (row.role === 'warehouse' && !row.warehouse_id) {
    return res.status(403).json({ error: 'no_warehouse' });
  }

  const token = signToken({
    uid: row.id,
    pid: row.partner_id,
    wid: row.warehouse_id,
    role: row.role,
  });
  res.json({ token, role: row.role });
});

const registerSchema = z.object({
  company_name: z.string().min(1).max(255),
  contact_name: z.string().min(1).max(255),
  phone: z.string().min(3).max(50),
  email: z.string().email().max(255),
  password: z.string().min(6).max(200),
});

r.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const { company_name, contact_name, phone, email, password } = parsed.data;

  const exists = await one(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [email]);
  if (exists) return res.status(409).json({ error: 'email_taken' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [partner] } = await client.query(
      `INSERT INTO partners (name, status) VALUES ($1, 'pending') RETURNING id`,
      [company_name]
    );
    const hash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (partner_id, email, phone, password_hash, contact_name, role)
       VALUES ($1, $2, $3, $4, $5, 'partner')`,
      [partner.id, email, phone, hash, contact_name]
    );
    await client.query('COMMIT');
    res.status(201).json({ status: 'pending' });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export default r;
