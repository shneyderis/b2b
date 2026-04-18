import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

// Catalog for partners: only active wines; in-stock first, then sort_order.
r.get('/', async (_req, res) => {
  const rows = await query(
    `SELECT id, name, price, stock_quantity, sort_order
       FROM wines WHERE is_active = TRUE
      ORDER BY (stock_quantity > 0) DESC, sort_order, name`
  );
  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  res.json(rows);
});

export default r;
