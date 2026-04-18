import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DIRECT_DATABASE_URL (preferred) or DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('supabase.com') || connectionString.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : undefined,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'migrations');

async function main() {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    console.log(`[migrate] ${f}`);
    await pool.query(sql);
  }
  await pool.end();
  console.log('[migrate] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
