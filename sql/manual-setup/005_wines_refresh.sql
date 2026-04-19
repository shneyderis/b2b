-- Master catalog refresh (Oct 2026).
-- Updates prices, stocks, and a few name spellings to match the winery's
-- catalog. Hides Ігрісте BdB / Ігрісте Rose — not in the current master
-- list. Idempotent, safe to re-run.
--
-- Paste into the Supabase SQL Editor and Run.

BEGIN;

-- Name normalisations (run before the UPDATE-by-name block so they match).
UPDATE wines SET name = 'Артанія Пет Нат'   WHERE name = 'Артанія ПетНат';
UPDATE wines SET name = 'Тельти Курук'      WHERE name = 'Бейкуш Тельти Курук';
UPDATE wines SET name = 'Бейкуш Піно Нуар'  WHERE name = 'Бейкуш Резерв Піно Нуар';
UPDATE wines SET name = 'Арбіна'            WHERE name = 'Арбина';

-- Price + stock refresh, one row per wine.
UPDATE wines SET price = 400,  stock_quantity = 3000 WHERE name = 'Артанія біле';
UPDATE wines SET price = 400,  stock_quantity = 90   WHERE name = 'Артанія рожеве';
UPDATE wines SET price = 450,  stock_quantity = 887  WHERE name = 'Артанія червоне';
UPDATE wines SET price = 500,  stock_quantity = 100  WHERE name = 'Артанія Пет Нат';
UPDATE wines SET price = 450,  stock_quantity = 0    WHERE name = 'Амфора Рислінг';
UPDATE wines SET price = 500,  stock_quantity = 1400 WHERE name = 'Амфора Ркацителі';
UPDATE wines SET price = 500,  stock_quantity = 2700 WHERE name = 'Бейкуш Біле';
UPDATE wines SET price = 400,  stock_quantity = 1300 WHERE name = 'Бейкуш Шардоне';
UPDATE wines SET price = 450,  stock_quantity = 3250 WHERE name = 'Бейкуш Червоне';
UPDATE wines SET price = 500,  stock_quantity = 2000 WHERE name = 'Тельти Курук';
UPDATE wines SET price = 700,  stock_quantity = 0    WHERE name = 'Бейкуш Резерв Шардоне';
UPDATE wines SET price = 750,  stock_quantity = 1298 WHERE name = 'Бейкуш Піно Нуар';
UPDATE wines SET price = 800,  stock_quantity = 1351 WHERE name = 'Яфе Нагар';
UPDATE wines SET price = 1750, stock_quantity = 0    WHERE name = 'Кара Кермен';
UPDATE wines SET price = 900,  stock_quantity = 1696 WHERE name = 'Арбіна';
UPDATE wines SET price = 900,  stock_quantity = 85   WHERE name = 'Лерічі';
UPDATE wines SET price = 900,  stock_quantity = 1016 WHERE name = 'Лока Дезерта';

-- Not in the current master catalog — hide them. is_active=FALSE keeps
-- any historical orders intact; they disappear from /api/wines for
-- partners but remain in the admin list.
UPDATE wines SET is_active = FALSE WHERE name IN ('Ігрісте BdB', 'Ігрісте Rose');

COMMIT;
