import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const WINES = [
  'Амфора Рислінг',
  'Амфора Ркацителі',
  'Артанія ПетНат',
  'Артанія біле',
  'Артанія червоне',
  'Артанія рожеве',
  'Бейкуш Біле',
  'Бейкуш Шардоне',
  'Бейкуш Червоне',
  'Бейкуш Тельти Курук',
  'Бейкуш Резерв Шардоне',
  'Бейкуш Резерв Піно Нуар',
  'Ігрісте BdB',
  'Ігрісте Rose',
  'Яфе Нагар',
  'Лерічі',
  'Арбина',
  'Лока Дезерта',
  'Кара Кермен',
];

// Placeholder prices (UAH). Replace via admin catalog later.
const PRICE_FALLBACK = 450;
const PRICES: Record<string, number> = {
  'Бейкуш Резерв Шардоне': 850,
  'Бейкуш Резерв Піно Нуар': 900,
  'Ігрісте BdB': 650,
  'Ігрісте Rose': 650,
  'Лерічі': 520,
  'Яфе Нагар': 520,
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // wipe in FK order
    await client.query(`DELETE FROM order_items`);
    await client.query(`DELETE FROM orders`);
    await client.query(`DELETE FROM delivery_addresses`);
    await client.query(`DELETE FROM users`);
    await client.query(`DELETE FROM partners`);
    await client.query(`DELETE FROM wines`);

    // admin
    const adminHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, contact_name, role)
       VALUES ('admin@winery.com', $1, 'Admin', 'admin')`,
      [adminHash]
    );

    // wines
    const wineIds: string[] = [];
    for (let i = 0; i < WINES.length; i++) {
      const name = WINES[i];
      const { rows: [w] } = await client.query(
        `INSERT INTO wines (name, price, stock_quantity, sort_order, is_active)
         VALUES ($1, $2, 1, $3, TRUE) RETURNING id`,
        [name, PRICES[name] ?? PRICE_FALLBACK, i]
      );
      wineIds.push(w.id);
    }

    // partners
    const partnerHash = await bcrypt.hash('partner123', 10);
    const partnersData = [
      {
        name: 'Ресторан «Кримська чайка»',
        discount: 10,
        users: [{ email: 'chaika@example.com', contact: 'Олена Коваль', phone: '+380501112233' }],
        addresses: [
          { label: 'Основний зал', address: 'м. Київ, вул. Хрещатик, 22', is_default: true },
        ],
      },
      {
        name: 'Винотека «Ліра»',
        discount: 5,
        users: [
          { email: 'lira@example.com', contact: 'Володимир Левченко', phone: '+380671234567' },
          { email: 'lira2@example.com', contact: 'Марія Бойко', phone: '+380672223344' },
        ],
        addresses: [
          { label: 'Центральний', address: 'м. Львів, вул. Ринок, 5', is_default: true },
          { label: 'Склад', address: 'м. Львів, вул. Богдана Хмельницького, 120', is_default: false },
        ],
      },
      {
        name: 'Готель «Набережна»',
        discount: 0,
        users: [{ email: 'naberezhna@example.com', contact: 'Андрій Шевченко', phone: '+380631112200' }],
        addresses: [
          { label: 'Ресепшн', address: 'м. Одеса, Приморський б-р, 8', is_default: true },
        ],
      },
    ];

    type CreatedPartner = { partnerId: string; userIds: string[]; addressIds: string[] };
    const created: CreatedPartner[] = [];

    for (const p of partnersData) {
      const { rows: [partner] } = await client.query(
        `INSERT INTO partners (name, discount_percent, status) VALUES ($1, $2, 'approved') RETURNING id`,
        [p.name, p.discount]
      );
      const userIds: string[] = [];
      for (const u of p.users) {
        const { rows: [user] } = await client.query(
          `INSERT INTO users (partner_id, email, phone, password_hash, contact_name, role)
           VALUES ($1, $2, $3, $4, $5, 'partner') RETURNING id`,
          [partner.id, u.email, u.phone, partnerHash, u.contact]
        );
        userIds.push(user.id);
      }
      const addressIds: string[] = [];
      for (const a of p.addresses) {
        const { rows: [addr] } = await client.query(
          `INSERT INTO delivery_addresses (partner_id, label, address, is_default)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [partner.id, a.label, a.address, a.is_default]
        );
        addressIds.push(addr.id);
      }
      created.push({ partnerId: partner.id, userIds, addressIds });
    }

    // a pending partner to showcase approval flow
    const { rows: [pendingPartner] } = await client.query(
      `INSERT INTO partners (name, discount_percent, status) VALUES ($1, 0, 'pending') RETURNING id`,
      ['Бар «Тераса»']
    );
    await client.query(
      `INSERT INTO users (partner_id, email, phone, password_hash, contact_name, role)
       VALUES ($1, 'terasa@example.com', '+380631110000', $2, 'Наталія Дементьєва', 'partner')`,
      [pendingPartner.id, partnerHash]
    );

    // demo orders in various statuses
    const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled', 'new', 'confirmed'] as const;
    let orderIdx = 0;
    for (const { partnerId, userIds, addressIds } of created) {
      for (let k = 0; k < 2 && orderIdx < STATUSES.length; k++, orderIdx++) {
        const status = STATUSES[orderIdx];
        const itemsCount = 2 + (orderIdx % 3);
        const picked = wineIds.slice(orderIdx, orderIdx + itemsCount);
        const partnerDiscount = partnersData[created.indexOf(created.find((c) => c.partnerId === partnerId)!)].discount;
        let total = 0;
        const priced: { wine_id: string; qty: number; price: number }[] = [];
        for (const wineId of picked) {
          const { rows: [{ price }] } = await client.query(`SELECT price FROM wines WHERE id = $1`, [wineId]);
          const p = Math.round(Number(price) * (100 - partnerDiscount)) / 100;
          const qty = 1 + (orderIdx % 4);
          total += p * qty;
          priced.push({ wine_id: wineId, qty, price: p });
        }
        total = Math.round(total * 100) / 100;
        const { rows: [order] } = await client.query(
          `INSERT INTO orders (partner_id, user_id, delivery_address_id, status, comment, total_amount)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [partnerId, userIds[0], addressIds[0], status, null, total]
        );
        for (const it of priced) {
          await client.query(
            `INSERT INTO order_items (order_id, wine_id, quantity, price) VALUES ($1, $2, $3, $4)`,
            [order.id, it.wine_id, it.qty, it.price]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('[seed] done');
    console.log('  admin:    admin@winery.com / admin123');
    console.log('  partner:  chaika@example.com / partner123  (approved)');
    console.log('  partner:  terasa@example.com / partner123  (pending — should fail login)');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
