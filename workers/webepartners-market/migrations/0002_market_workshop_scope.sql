-- NAPRAWNIK MARKET staging schema upgrade: workshop relevance + FTS.
-- Apply only to the dedicated naprawnik-market-staging D1 database.
ALTER TABLE market_products ADD COLUMN is_workshop INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_market_products_workshop ON market_products(is_workshop);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop_category ON market_products(is_workshop, category);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop_title ON market_products(is_workshop, title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_market_products_workshop_price ON market_products(is_workshop, price);
UPDATE market_products SET is_workshop = CASE WHEN (
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%motocykl%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%skuter%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%scooter%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%motorower%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%moped%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%cross%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%enduro%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%quad%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%atv%' OR
lower(title || ' ' || category || ' ' || coalesce(description, '')) LIKE '%off-road%' OR
(lower(category) LIKE '%narzędzia i sprzęt warsztatowy%' AND (
lower(title) LIKE '%klucz%' OR lower(title) LIKE '%nasadk%' OR lower(title) LIKE '%grzechotk%' OR
lower(title) LIKE '%szczypc%' OR lower(title) LIKE '%kombinerk%' OR lower(title) LIKE '%multimetr%' OR
lower(title) LIKE '%miernik%' OR lower(title) LIKE '%tester%' OR lower(title) LIKE '%diagnost%' OR
lower(title) LIKE '%kompresor%' OR lower(title) LIKE '%podnośnik%' OR lower(title) LIKE '%stojak%' OR
lower(title) LIKE '%imadło%' OR lower(title) LIKE '%ściągacz%' OR lower(title) LIKE '%honownic%' OR
lower(title) LIKE '%nitownic%' OR lower(title) LIKE '%suwmiark%' OR lower(title) LIKE '%mikrometr%' OR
lower(title) LIKE '%prostownik%' OR lower(title) LIKE '%zestaw narzędzi%'))
) AND NOT (
lower(title || ' ' || coalesce(description, '')) LIKE '%kosiark%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%podkaszark%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%wykaszark%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%kosy spalin%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%pilark%łańcuchow%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%piły łańcuchow%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%żywopłot%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%sekator%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%opryskiwacz%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%glebogryzark%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%dywaniki samochodow%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%kamera cofania%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%czujniki parkowania%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%hak holowniczy%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%kobyłki samochodow%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%podstawki samochodow%' OR
lower(title || ' ' || coalesce(description, '')) LIKE '%akcesoria samochodowe%'
) THEN 1 ELSE 0 END;
CREATE VIRTUAL TABLE IF NOT EXISTS market_products_fts USING fts5(title, brand, category, description, content='market_products', content_rowid='id');
CREATE TRIGGER IF NOT EXISTS market_products_ai AFTER INSERT ON market_products BEGIN
INSERT INTO market_products_fts(rowid, title, brand, category, description) VALUES (new.id, new.title, coalesce(new.brand, ''), new.category, coalesce(new.description, ''));
END;
CREATE TRIGGER IF NOT EXISTS market_products_ad AFTER DELETE ON market_products BEGIN
INSERT INTO market_products_fts(market_products_fts, rowid, title, brand, category, description) VALUES ('delete', old.id, old.title, coalesce(old.brand, ''), old.category, coalesce(old.description, ''));
END;
CREATE TRIGGER IF NOT EXISTS market_products_au AFTER UPDATE ON market_products BEGIN
INSERT INTO market_products_fts(market_products_fts, rowid, title, brand, category, description) VALUES ('delete', old.id, old.title, coalesce(old.brand, ''), old.category, coalesce(old.description, ''));
INSERT INTO market_products_fts(rowid, title, brand, category, description) VALUES (new.id, new.title, coalesce(new.brand, ''), new.category, coalesce(new.description, ''));
END;
INSERT INTO market_products_fts(market_products_fts) VALUES ('rebuild');
