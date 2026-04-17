import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

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
