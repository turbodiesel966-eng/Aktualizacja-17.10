-- NAPRAWNIK migration 0008: Centralna rozszerzalna baza techniczna modeli, części i parametrów tuningu
-- Bezpłatna baza Cloudflare D1 (zero kosztów zewnętrznych), dostępna w trybie offline-first.

CREATE TABLE IF NOT EXISTS catalog_models (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  engine_family TEXT NOT NULL,
  stroke TEXT NOT NULL CHECK (stroke IN ('2T', '4T', 'CVT')),
  specs_json TEXT NOT NULL DEFAULT '{}',
  verified INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_models_brand ON catalog_models(brand);
CREATE INDEX IF NOT EXISTS idx_catalog_models_engine ON catalog_models(engine_family);

CREATE TABLE IF NOT EXISTS catalog_parts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('naped', 'silnik', 'zaplon', 'zasilanie', 'hamulce', 'inne')),
  title TEXT NOT NULL,
  part_number_oem TEXT,
  dimensions TEXT,
  confidence TEXT NOT NULL DEFAULT 'Wysoka (Zamiennik)',
  compatibility_json TEXT NOT NULL DEFAULT '[]',
  purchase_json TEXT NOT NULL DEFAULT '[]',
  caution TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_parts_cat ON catalog_parts(category);

CREATE TABLE IF NOT EXISTS catalog_tuning_specs (
  id TEXT PRIMARY KEY,
  engine_code TEXT NOT NULL UNIQUE,
  engine_name TEXT NOT NULL,
  stroke_type TEXT NOT NULL CHECK (stroke_type IN ('2T', '4T')),
  standard_bore_mm REAL NOT NULL,
  standard_stroke_mm REAL NOT NULL,
  standard_displacement_cc REAL NOT NULL,
  combustion_chamber_cc REAL NOT NULL,
  standard_cr REAL NOT NULL,
  safe_squish_min_mm REAL NOT NULL,
  safe_squish_max_mm REAL NOT NULL,
  notes TEXT,
  updated_at INTEGER NOT NULL
);

-- Wstępne zasilenie bazy silników tuningu i parametrów squish
INSERT OR IGNORE INTO catalog_tuning_specs
(id, engine_code, engine_name, stroke_type, standard_bore_mm, standard_stroke_mm, standard_displacement_cc, combustion_chamber_cc, standard_cr, safe_squish_min_mm, safe_squish_max_mm, notes, updated_at)
VALUES
('tune_am6', 'AM6', 'Minarelli AM6 50cc 2T', '2T', 40.3, 39.0, 49.7, 4.3, 12.0, 0.65, 0.85, 'Dla cylindrów sportowych 70cc (bore 47.0-47.6mm) zalecany squish 0.70-0.80 mm. Dokręcenie głowicy 18-20 Nm na krzyż.', 1730486000000),
('tune_min_horiz', 'MIN_HORIZ', 'Minarelli Horizontal 2T AC/LC (Aerox, Neos, Jog)', '2T', 40.0, 39.2, 49.3, 4.4, 11.5, 0.60, 0.80, 'Przy montażu uszczelki aluminiowej kontrolować squish cyną lutowniczą 1.0 mm przez otwór świecy równolegle do sworznia tłoka.', 1730486000000),
('tune_piaggio_hiper2', 'HIPER2', 'Piaggio Hi-Per2 Pro 50cc 2T (NRG, Runner, Typhoon)', '2T', 40.0, 39.3, 49.4, 4.2, 12.2, 0.65, 0.85, 'Dostępne podkładki cylindra o różnej grubości (0.2, 0.4, 0.6 mm) pozwalające precyzyjnie wyregulować squish bez obróbki głowicy.', 1730486000000),
('tune_gy6_50', '139QMB', 'GY6 139QMB / QMA 50cc 4T', '4T', 39.0, 41.5, 49.5, 5.2, 10.5, 0.85, 1.10, 'Luzy zaworowe na zimno: ssący 0.05 mm, wydechowy 0.08 mm. Przy zestawie 72cc (47mm) sprawdzić czy zawory nie kolidują z tłokiem.', 1730486000000),
('tune_gy6_125', '152QMI', 'GY6 152QMI 125cc 4T', '4T', 52.4, 57.8, 124.6, 13.5, 9.8, 0.90, 1.15, 'Moment głowicy 28-32 Nm. Luzy zaworowe: ssący 0.08 mm, wydechowy 0.10 mm.', 1730486000000),
('tune_derbi_d50b0', 'D50B0', 'Derbi D50B0 / Euro 3-4 (Senda, GPR)', '2T', 39.86, 40.0, 49.9, 4.3, 11.8, 0.65, 0.80, 'Głowica modułowa w wersjach wyczynowych. Dokręcanie szpilek M7 momentem 14-16 Nm.', 1730486000000),
('tune_keeway_2t', '1E40QMB', 'Keeway / CPI 1E40QMB 2T (sworzeń 12mm)', '2T', 40.0, 39.2, 49.3, 4.6, 10.8, 0.70, 0.95, 'Klon Minarelli ze sworzniem tłoka 12 mm zamiast 10 mm. Wał z dłuższym wieloklinem wariatora 16 mm.', 1730486000000);
