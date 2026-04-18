import pg from 'pg';
import { env } from './env.js';

const isServerless = !!process.env.VERCEL;

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('supabase.com') || env.DATABASE_URL.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : undefined,
  ...(isServerless ? { max: 1, idleTimeoutMillis: 10_000 } : {}),
});

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
