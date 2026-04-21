import { Router } from 'express';
import { env } from '../env.js';
import { pool } from '../db.js';

const r = Router();

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on each scheduled
// invocation (secret auto-injected by the platform into the request and into
// the env var we compare against). If CRON_SECRET is unset, the endpoint
// refuses to run at all — safer than an open "cleanup" route.
function ok(authHeader: string | undefined): boolean {
  if (!env.CRON_SECRET) return false;
  return authHeader === `Bearer ${env.CRON_SECRET}`;
}

r.get('/cleanup', async (req, res) => {
  if (!ok(req.header('authorization'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const result = await pool.query(
    `DELETE FROM pending_telegram_orders
      WHERE created_at < NOW() - INTERVAL '7 days'`
  );
  res.json({ deleted: result.rowCount ?? 0 });
});

export default r;
