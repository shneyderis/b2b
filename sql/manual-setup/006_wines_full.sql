-- Extended wine metadata — year, grape composition, aging, ABV, acidity,
-- residual sugar, volume, barcode, UKTZED. All nullable and idempotent via
-- IF NOT EXISTS; loaded from the winery's master catalog (Oct 2026).
-- Paste into the Supabase SQL Editor and Run.

BEGIN;

ALTER TABLE wines ADD COLUMN IF NOT EXISTS year              SMALLINT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS grape_composition TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS aging             VARCHAR(128);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS alcohol_percent   NUMERIC(4,2);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS acidity           NUMERIC(4,2);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS residual_sugar    NUMERIC(4,2);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS volume_l          NUMERIC(4,2);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS barcode           VARCHAR(32);
ALTER TABLE wines ADD COLUMN IF NOT EXISTS uktzed            VARCHAR(32);

-- Data load, one UPDATE per wine (keyed by current name). Names already
-- normalised in 005_wines_refresh.sql.

UPDATE wines SET
  year = 2024, grape_composition = '43% Chardonnay, 24% Rkatsiteli, 17% Sauvignon Blanc, 10% Riesling, 6% Chenin Blanc',
  aging = 'inox 6m', alcohol_percent = 12.00, acidity = 5.2, residual_sugar = 2.6,
  volume_l = 0.75, barcode = '4820212630095', uktzed = '2204219700'
 WHERE name = 'Артанія біле';

UPDATE wines SET
  year = 2024, grape_composition = '90% Pinot Gris, 10% Pinot Noir',
  aging = 'inox 6m', alcohol_percent = 13.00, acidity = 5.9, residual_sugar = 1.4,
  volume_l = 0.75, barcode = '4820212630118', uktzed = '2204219800'
 WHERE name = 'Артанія рожеве';

UPDATE wines SET
  year = 2023, grape_composition = '30% Merlot, 30% Tempranillo, 21% Pinot Noir, 13% Cabernet Sauvignon, 6% Rubin',
  aging = '10m', alcohol_percent = 13.00, acidity = 6.2, residual_sugar = 1.8,
  volume_l = 0.75, barcode = '4820212630088', uktzed = '2204219800'
 WHERE name = 'Артанія червоне';

UPDATE wines SET
  year = 2023, grape_composition = '50% Riesling, 50% Pinot Gris',
  aging = 'inox', alcohol_percent = 11.00, acidity = 6.6, residual_sugar = 1.2,
  volume_l = 0.75, barcode = '4820212630538', uktzed = '2204109800'
 WHERE name = 'Артанія Пет Нат';

UPDATE wines SET
  year = 2023, grape_composition = '100% Riesling',
  aging = 'ферментація в керамічних амфорах', alcohol_percent = 12.00,
  acidity = NULL, residual_sugar = NULL,
  volume_l = 0.75, barcode = '4820212630484', uktzed = '2204219500'
 WHERE name = 'Амфора Рислінг';

UPDATE wines SET
  year = 2024, grape_composition = '100% Rkatsiteli',
  aging = 'мацерація та ферментація на м''яззі, в тінахах', alcohol_percent = 12.00,
  acidity = 6.5, residual_sugar = 1.6,
  volume_l = 0.75, barcode = '4820212630491', uktzed = '2204219500'
 WHERE name = 'Амфора Ркацителі';

UPDATE wines SET
  year = 2025, grape_composition = '100% Albariño',
  aging = 'inox', alcohol_percent = 13.60, acidity = 5.9, residual_sugar = 2.1,
  volume_l = 0.75, barcode = '4820212630279', uktzed = '2204219700'
 WHERE name = 'Бейкуш Біле';

UPDATE wines SET
  year = 2025, grape_composition = '100% Chardonnay',
  aging = 'inox', alcohol_percent = 13.50, acidity = 6.3, residual_sugar = 1.4,
  volume_l = 0.75, barcode = '4820212630316', uktzed = '2204219500'
 WHERE name = 'Бейкуш Шардоне';

UPDATE wines SET
  year = 2025, grape_composition = '100% Pinotage',
  aging = 'inox', alcohol_percent = 13.00, acidity = 6.0, residual_sugar = 1.4,
  volume_l = 0.75, barcode = '4820212630477', uktzed = '2204219800'
 WHERE name = 'Бейкуш Червоне';

UPDATE wines SET
  year = 2025, grape_composition = '100% Telti-Kuruk',
  aging = 'inox', alcohol_percent = 13.40, acidity = 6.2, residual_sugar = 1.9,
  volume_l = 0.75, barcode = '4820212630347', uktzed = '2204219500'
 WHERE name = 'Тельти Курук';

UPDATE wines SET
  year = 2023, grape_composition = '100% Chardonnay',
  aging = '24m', alcohol_percent = 13.50, acidity = 6.0, residual_sugar = 1.8,
  volume_l = 0.75, barcode = '4820212630385', uktzed = '2204219500'
 WHERE name = 'Бейкуш Резерв Шардоне';

UPDATE wines SET
  year = 2023, grape_composition = '100% Pinot Noir',
  aging = '24m', alcohol_percent = 13.50, acidity = 6.0, residual_sugar = 1.6,
  volume_l = 0.75, barcode = '4820212630354', uktzed = '2204219600'
 WHERE name = 'Бейкуш Піно Нуар';

UPDATE wines SET
  year = 2023, grape_composition = 'Black Sea White Blend — 50% Riesling, 50% Chardonnay',
  aging = '24m', alcohol_percent = 13.30, acidity = 6.1, residual_sugar = 2.3,
  volume_l = 0.75, barcode = '4820212630378', uktzed = '2204219700'
 WHERE name = 'Яфе Нагар';

UPDATE wines SET
  year = 2021, grape_composition = 'Appassimento style. 50% Saperavi + 50% Tempranillo',
  aging = '36m', alcohol_percent = 14.50, acidity = 5.9, residual_sugar = 2.8,
  volume_l = 0.75, barcode = '4820212630309', uktzed = '2204219800'
 WHERE name = 'Кара Кермен';

UPDATE wines SET
  year = 2023, grape_composition = '100% Rkatsiteli',
  aging = '24m', alcohol_percent = 13.50, acidity = 6.3, residual_sugar = 2.1,
  volume_l = 0.75, barcode = '4820212630293', uktzed = '2204219500'
 WHERE name = 'Арбіна';

UPDATE wines SET
  year = 2023, grape_composition = '100% Timorasso',
  aging = '15m', alcohol_percent = 14.50, acidity = 6.5, residual_sugar = 2.2,
  volume_l = 0.75, barcode = '4820212630507', uktzed = '2204 21 97 00'
 WHERE name = 'Лерічі';

UPDATE wines SET
  year = 2023, grape_composition = '28% Merlot, 18% Cabernet Franc & Sauvignon, 18% Malbec, 18% Tempranillo, 9% Rubin, 9% Saperavi',
  aging = '30m', alcohol_percent = 14.50, acidity = 5.8, residual_sugar = 2.2,
  volume_l = 0.75, barcode = '4820212630521', uktzed = '2204 21 98 00'
 WHERE name = 'Лока Дезерта';

COMMIT;
