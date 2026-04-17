import { pool } from '../src/db.js';

async function main() {
  console.log('[seed] placeholder — filled in p.8');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
