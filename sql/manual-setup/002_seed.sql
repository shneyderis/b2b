-- Generated from server/scripts/seed.ts — paste into Supabase SQL Editor after 001_init.sql
-- Admin:    admin@winery.com / admin123
-- Partner:  chaika@example.com / partner123 (approved)
-- Partner:  terasa@example.com / partner123 (pending — login must be rejected)

BEGIN;

DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM delivery_addresses;
DELETE FROM users;
DELETE FROM partners;
DELETE FROM wines;

-- admin
INSERT INTO users (email, password_hash, contact_name, role) VALUES
  ('admin@winery.com', '$2a$10$KNVEPxSVblIWmFxie5xglef/cwssKF4bckJ9vTDIunOsCYdaqKpbW', 'Admin', 'admin');

-- wines (sort_order = index)
INSERT INTO wines (name, price, stock_quantity, sort_order, is_active) VALUES
  ('Амфора Рислінг', 450, 1, 0, TRUE),
  ('Амфора Ркацителі', 450, 1, 1, TRUE),
  ('Артанія ПетНат', 450, 1, 2, TRUE),
  ('Артанія біле', 450, 1, 3, TRUE),
  ('Артанія червоне', 450, 1, 4, TRUE),
  ('Артанія рожеве', 450, 1, 5, TRUE),
  ('Бейкуш Біле', 450, 1, 6, TRUE),
  ('Бейкуш Шардоне', 450, 1, 7, TRUE),
  ('Бейкуш Червоне', 450, 1, 8, TRUE),
  ('Бейкуш Тельти Курук', 450, 1, 9, TRUE),
  ('Бейкуш Резерв Шардоне', 850, 1, 10, TRUE),
  ('Бейкуш Резерв Піно Нуар', 900, 1, 11, TRUE),
  ('Ігрісте BdB', 650, 1, 12, TRUE),
  ('Ігрісте Rose', 650, 1, 13, TRUE),
  ('Яфе Нагар', 520, 1, 14, TRUE),
  ('Лерічі', 520, 1, 15, TRUE),
  ('Арбина', 450, 1, 16, TRUE),
  ('Лока Дезерта', 450, 1, 17, TRUE),
  ('Кара Кермен', 450, 1, 18, TRUE);

-- approved partners + 1 pending
INSERT INTO partners (name, discount_percent, status) VALUES
  ('Ресторан «Кримська чайка»', 10, 'approved'),
  ('Винотека «Ліра»', 5, 'approved'),
  ('Готель «Набережна»', 0, 'approved'),
  ('Бар «Тераса»', 0, 'pending');

-- partner users
INSERT INTO users (partner_id, email, phone, password_hash, contact_name, role) VALUES
  ((SELECT id FROM partners WHERE name='Ресторан «Кримська чайка»'), 'chaika@example.com', '+380501112233', '$2a$10$CfPprtCdS2N4lBFwW.h5be5z/SlEWkb.1GpoPgn5urZ1w1iWLkSPC', 'Олена Коваль', 'partner'),
  ((SELECT id FROM partners WHERE name='Винотека «Ліра»'), 'lira@example.com', '+380671234567', '$2a$10$CfPprtCdS2N4lBFwW.h5be5z/SlEWkb.1GpoPgn5urZ1w1iWLkSPC', 'Володимир Левченко', 'partner'),
  ((SELECT id FROM partners WHERE name='Винотека «Ліра»'), 'lira2@example.com', '+380672223344', '$2a$10$CfPprtCdS2N4lBFwW.h5be5z/SlEWkb.1GpoPgn5urZ1w1iWLkSPC', 'Марія Бойко', 'partner'),
  ((SELECT id FROM partners WHERE name='Готель «Набережна»'), 'naberezhna@example.com', '+380631112200', '$2a$10$CfPprtCdS2N4lBFwW.h5be5z/SlEWkb.1GpoPgn5urZ1w1iWLkSPC', 'Андрій Шевченко', 'partner'),
  ((SELECT id FROM partners WHERE name='Бар «Тераса»'), 'terasa@example.com', '+380631110000', '$2a$10$CfPprtCdS2N4lBFwW.h5be5z/SlEWkb.1GpoPgn5urZ1w1iWLkSPC', 'Наталія Дементьєва', 'partner');

-- delivery addresses
INSERT INTO delivery_addresses (partner_id, label, address, is_default) VALUES
  ((SELECT id FROM partners WHERE name='Ресторан «Кримська чайка»'), 'Основний зал', 'м. Київ, вул. Хрещатик, 22', TRUE),
  ((SELECT id FROM partners WHERE name='Винотека «Ліра»'), 'Центральний', 'м. Львів, вул. Ринок, 5', TRUE),
  ((SELECT id FROM partners WHERE name='Винотека «Ліра»'), 'Склад', 'м. Львів, вул. Богдана Хмельницького, 120', FALSE),
  ((SELECT id FROM partners WHERE name='Готель «Набережна»'), 'Ресепшн', 'м. Одеса, Приморський б-р, 8', TRUE);

-- demo orders (one CTE per order so we can capture the new id and insert its items)
WITH new_order AS (
  INSERT INTO orders (partner_id, user_id, delivery_address_id, status, total_amount)
  VALUES (
    (SELECT id FROM partners WHERE name='Ресторан «Кримська чайка»'),
    (SELECT id FROM users WHERE email='chaika@example.com'),
    (SELECT id FROM delivery_addresses WHERE partner_id=(SELECT id FROM partners WHERE name='Ресторан «Кримська чайка»') AND label='Основний зал'),
    'new',
    810.00
  ) RETURNING id
)
INSERT INTO order_items (order_id, wine_id, quantity, price)
SELECT new_order.id, w.id, 1, 405.00
FROM new_order, wines w WHERE w.sort_order IN (0, 1);

WITH new_order AS (
  INSERT INTO orders (partner_id, user_id, delivery_address_id, status, total_amount)
  VALUES (
    (SELECT id FROM partners WHERE name='Ресторан «Кримська чайка»'),
    (SELECT id FROM users WHERE email='chaika@example.com'),
    (SELECT id FROM delivery_addresses WHERE partner_id=(SELECT id FROM partners WHERE name='Ресторан «Кримська чайка»') AND label='Основний зал'),
    'confirmed',
    2430.00
  ) RETURNING id
)
INSERT INTO order_items (order_id, wine_id, quantity, price)
SELECT new_order.id, w.id, 2, 405.00
FROM new_order, wines w WHERE w.sort_order IN (1, 2, 3);

WITH new_order AS (
  INSERT INTO orders (partner_id, user_id, delivery_address_id, status, total_amount)
  VALUES (
    (SELECT id FROM partners WHERE name='Винотека «Ліра»'),
    (SELECT id FROM users WHERE email='lira@example.com'),
    (SELECT id FROM delivery_addresses WHERE partner_id=(SELECT id FROM partners WHERE name='Винотека «Ліра»') AND label='Центральний'),
    'shipped',
    5130.00
  ) RETURNING id
)
INSERT INTO order_items (order_id, wine_id, quantity, price)
SELECT new_order.id, w.id, 3, 427.50
FROM new_order, wines w WHERE w.sort_order IN (2, 3, 4, 5);

WITH new_order AS (
  INSERT INTO orders (partner_id, user_id, delivery_address_id, status, total_amount)
  VALUES (
    (SELECT id FROM partners WHERE name='Винотека «Ліра»'),
    (SELECT id FROM users WHERE email='lira@example.com'),
    (SELECT id FROM delivery_addresses WHERE partner_id=(SELECT id FROM partners WHERE name='Винотека «Ліра»') AND label='Центральний'),
    'delivered',
    3420.00
  ) RETURNING id
)
INSERT INTO order_items (order_id, wine_id, quantity, price)
SELECT new_order.id, w.id, 4, 427.50
FROM new_order, wines w WHERE w.sort_order IN (3, 4);

WITH new_order AS (
  INSERT INTO orders (partner_id, user_id, delivery_address_id, status, total_amount)
  VALUES (
    (SELECT id FROM partners WHERE name='Готель «Набережна»'),
    (SELECT id FROM users WHERE email='naberezhna@example.com'),
    (SELECT id FROM delivery_addresses WHERE partner_id=(SELECT id FROM partners WHERE name='Готель «Набережна»') AND label='Ресепшн'),
    'cancelled',
    1350.00
  ) RETURNING id
)
INSERT INTO order_items (order_id, wine_id, quantity, price)
SELECT new_order.id, w.id, 1, 450.00
FROM new_order, wines w WHERE w.sort_order IN (4, 5, 6);

WITH new_order AS (
  INSERT INTO orders (partner_id, user_id, delivery_address_id, status, total_amount)
  VALUES (
    (SELECT id FROM partners WHERE name='Готель «Набережна»'),
    (SELECT id FROM users WHERE email='naberezhna@example.com'),
    (SELECT id FROM delivery_addresses WHERE partner_id=(SELECT id FROM partners WHERE name='Готель «Набережна»') AND label='Ресепшн'),
    'new',
    3600.00
  ) RETURNING id
)
INSERT INTO order_items (order_id, wine_id, quantity, price)
SELECT new_order.id, w.id, 2, 450.00
FROM new_order, wines w WHERE w.sort_order IN (5, 6, 7, 8);

COMMIT;

