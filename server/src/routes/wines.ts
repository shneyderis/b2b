import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

// Catalog for partners: only active wines; in-stock first, then sort_order.
// Prices returned are already discounted by the partner's discount_percent,
// so the client never has to know about the discount or apply it itself.
r.get('/', async (req, res) => {
  const pid = req.user!.pid;
  let discount = 0;
  if (pid) {
    const p = await one<{ discount_percent: string }>(
      `SELECT discount_percent FROM partners WHERE id = $1`,
      [pid]
    );
    discount = p ? Number(p.discount_percent) : 0;
  }
  const rows = await query(
    `SELECT id, name,
            ROUND(price * (100 - $1::numeric) / 100, 2) AS price,
            stock_quantity, sort_order
       FROM wines WHERE is_active = TRUE
      ORDER BY (stock_quantity > 0) DESC, sort_order, name`,
    [discount]
  );
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  res.json(rows);
});

export default r;
