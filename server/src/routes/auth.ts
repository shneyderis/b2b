import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { one, pool, query } from '../db.js';
import { hashPassword, signToken, verifyPassword } from '../auth.js';
import { env } from '../env.js';

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

const telegramSchema = z.object({
  initData: z.string().min(1).max(10_000),
});

const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

function verifyTelegramInitData(initData: string, botToken: string):
  | { ok: true; authDate: number; user: TelegramUser }
  | { ok: false; reason: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };
  params.delete('hash');

  const keys = Array.from(params.keys()).sort();
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  let hashBuf: Buffer;
  let compBuf: Buffer;
  try {
    hashBuf = Buffer.from(hash, 'hex');
    compBuf = Buffer.from(computed, 'hex');
  } catch {
    return { ok: false, reason: 'invalid_hash' };
  }
  if (hashBuf.length !== compBuf.length || !crypto.timingSafeEqual(hashBuf, compBuf)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const authDateStr = params.get('auth_date');
  const authDate = authDateStr ? Number(authDateStr) : 0;
  if (!authDate || !Number.isFinite(authDate)) {
    return { ok: false, reason: 'missing_auth_date' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > INIT_DATA_MAX_AGE_SEC) {
    return { ok: false, reason: 'expired' };
  }

  const userStr = params.get('user');
  if (!userStr) return { ok: false, reason: 'missing_user' };
  let user: TelegramUser;
  try {
    user = JSON.parse(userStr);
  } catch {
    return { ok: false, reason: 'invalid_user_json' };
  }
  if (!user || typeof user.id !== 'number') {
    return { ok: false, reason: 'invalid_user' };
  }
  return { ok: true, authDate, user };
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

r.post('/telegram', async (req, res) => {
  const parsed = telegramSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });

  if (!env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: 'telegram_not_configured' });
  }

  const verified = verifyTelegramInitData(parsed.data.initData, env.TELEGRAM_BOT_TOKEN);
  if (!verified.ok) {
    return res.status(401).json({ error: 'invalid_init_data', reason: verified.reason });
  }

  const tgId = String(verified.user.id);

  const row = await one<{
    id: string;
    partner_id: string | null;
    warehouse_id: string | null;
    role: 'partner' | 'admin' | 'warehouse';
    partner_status: 'pending' | 'approved' | 'rejected' | null;
  }>(
    `SELECT u.id, u.partner_id, u.warehouse_id, u.role, p.status AS partner_status
       FROM users u LEFT JOIN partners p ON p.id = u.partner_id
      WHERE u.telegram_id = $1::bigint
      ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'warehouse' THEN 1 ELSE 2 END,
               u.created_at
      LIMIT 1`,
    [tgId]
  );

  if (!row) return res.status(404).json({ error: 'not_linked' });

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

const telegramOnboardSchema = z.object({
  initData: z.string().min(1).max(10_000),
  company_name: z.string().min(1).max(255),
  phone: z.string().min(3).max(50),
});

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

r.post('/telegram/onboard', async (req, res) => {
  const parsed = telegramOnboardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });

  if (!env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: 'telegram_not_configured' });
  }

  const verified = verifyTelegramInitData(parsed.data.initData, env.TELEGRAM_BOT_TOKEN);
  if (!verified.ok) {
    return res.status(401).json({ error: 'invalid_init_data', reason: verified.reason });
  }

  const { company_name, phone } = parsed.data;
  const phoneDigits = normalizePhone(phone);
  if (phoneDigits.length < 9) return res.status(400).json({ error: 'invalid_phone' });
  const phoneTail = phoneDigits.slice(-9);

  const tg = verified.user;
  const tgId = String(tg.id);
  const contactName =
    [tg.first_name, tg.last_name].filter(Boolean).join(' ').trim() ||
    tg.username ||
    `tg${tgId}`;

  type Row = {
    id: string;
    partner_id: string | null;
    warehouse_id: string | null;
    role: 'partner' | 'admin' | 'warehouse';
    partner_status: 'pending' | 'approved' | 'rejected' | null;
  };

  let row = await one<Row>(
    `SELECT u.id, u.partner_id, u.warehouse_id, u.role, p.status AS partner_status
       FROM users u LEFT JOIN partners p ON p.id = u.partner_id
      WHERE u.telegram_id = $1::bigint`,
    [tgId]
  );

  if (!row) {
    const matches = await query<Row>(
      `SELECT u.id, u.partner_id, u.warehouse_id, u.role, p.status AS partner_status
         FROM users u LEFT JOIN partners p ON p.id = u.partner_id
        WHERE u.role = 'partner'
          AND u.telegram_id IS NULL
          AND right(regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), 9) = $1`,
      [phoneTail]
    );
    if (matches.length === 1) {
      row = matches[0];
      await query(
        `UPDATE users SET telegram_id = $1::bigint WHERE id = $2`,
        [tgId, row.id]
      );
    } else {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: [partner] } = await client.query(
          `INSERT INTO partners (name, status) VALUES ($1, 'pending') RETURNING id`,
          [company_name]
        );
        const placeholderEmail = `tg${tgId}@telegram.pending`;
        const placeholderHash = await hashPassword(crypto.randomBytes(24).toString('hex'));
        const { rows: [user] } = await client.query(
          `INSERT INTO users (partner_id, email, phone, password_hash, contact_name, telegram_id, role)
             VALUES ($1, $2, $3, $4, $5, $6::bigint, 'partner')
           RETURNING id, partner_id, role`,
          [partner.id, placeholderEmail, phone, placeholderHash, contactName, tgId]
        );
        await client.query('COMMIT');
        row = {
          id: user.id,
          partner_id: user.partner_id,
          warehouse_id: null,
          role: user.role,
          partner_status: 'pending',
        };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  }

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

export default r;
