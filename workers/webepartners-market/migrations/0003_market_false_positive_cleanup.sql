-- Staging-only cleanup of legacy false positives in the Market catalog.
-- Safe to re-run; it only changes classification flags, never product records.
UPDATE market_products
SET is_workshop = 0
WHERE (
  lower(category) LIKE '%akcesoria samochodowe%'
  OR lower(category) LIKE '%dom i ogród%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%spinki samochodow%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%kołki samochodow%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%klipsy samochodow%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%tapicerka samochodow%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%dywaniki samochodow%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%kamera cofania%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%czujniki parkowania%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%hak holowniczy%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%kobyłki samochodow%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%podstawki samochodow%'
)
AND NOT (
  lower(title || ' ' || coalesce(description, '')) LIKE '%motocykl%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%skuter%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%scooter%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%motorower%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%quad%'
  OR lower(title || ' ' || coalesce(description, '')) LIKE '%atv%'
);
