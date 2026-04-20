import { one, pool, query } from './db.js';
import { notifyManagersNewOrder, notifyWarehouseOrderConfirmed } from './telegram.js';

export type AdminOrderItem = { wine_id: string; quantity: number };

export type AdminOrderInput = {
  partnerId: string;
  deliveryAddressId: string;
  adminUserId: string;
  items: AdminOrderItem[];
  comment?: string | null;
};

export type AdminOrderResult = { id: string; order_number: number };

export class AdminOrderError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

export async function createAdminOrder(input: AdminOrderInput): Promise<AdminOrderResult> {
  const partner = await one<{ id: string; discount_percent: string }>(
    `SELECT id, discount_percent FROM partners WHERE id = $1`,
    [input.partnerId]
  );
  if (!partner) throw new AdminOrderError(400, 'partner_not_found');

  const addr = await one(
    `SELECT id FROM delivery_addresses WHERE id = $1 AND partner_id = $2`,
    [input.deliveryAddressId, partner.id]
  );
  if (!addr) throw new AdminOrderError(400, 'invalid_address');

  const discount = Number(partner.discount_percent);
  const ids = input.items.map((i) => i.wine_id);
  const wines = await query<{ id: string; price: string; stock_quantity: number; is_active: boolean }>(
    `SELECT id, price, stock_quantity, is_active FROM wines WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const byId = new Map(wines.map((w) => [w.id, w]));
  const priced: { wine_id: string; quantity: number; price: number }[] = [];
  let total = 0;
  for (const it of input.items) {
    const w = byId.get(it.wine_id);
    if (!w || !w.is_active) throw new AdminOrderError(400, `wine_unavailable:${it.wine_id}`);
    if (w.stock_quantity <= 0) throw new AdminOrderError(400, `wine_out_of_stock:${it.wine_id}`);
    const price = Math.round(Number(w.price) * (100 - discount)) / 100;
    priced.push({ wine_id: it.wine_id, quantity: it.quantity, price });
    total += price * it.quantity;
  }
  total = Math.round(total * 100) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (partner_id, user_id, delivery_address_id, comment, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING id, order_number`,
      [partner.id, input.adminUserId, input.deliveryAddressId, input.comment ?? null, total]
    );
    for (const it of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, wine_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, it.wine_id, it.quantity, it.price]
      );
    }
    await client.query('COMMIT');
    void notifyManagersNewOrder(order.id);
    void notifyWarehouseOrderConfirmed(order.id);
    return { id: order.id, order_number: order.order_number };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
