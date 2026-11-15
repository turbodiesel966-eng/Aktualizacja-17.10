-- Final NAPRAWNIK MARKET classification refresh.
-- Run only against the dedicated Market D1 database, never subscriptions/live billing.
UPDATE market_products
SET is_workshop = CASE WHEN (
  lower(title || ' ' || coalesce(description, '')) LIKE '%motocykl%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%skuter%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%scooter%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%motorower%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%moped%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%motocross%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%enduro%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%quad%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%atv%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%off-road%' OR
  lower(category) LIKE '%motocykl%' OR lower(category) LIKE '%skuter%' OR
  lower(category) LIKE '%motorower%' OR lower(category) LIKE '%quad%' OR lower(category) LIKE '%atv%' OR
  (lower(category) LIKE '%narzędzia i sprzęt warsztatowy%' AND (
    lower(title) LIKE '%klucz%' OR lower(title) LIKE '%nasadk%' OR lower(title) LIKE '%grzechotk%' OR
    lower(title) LIKE '%szczypc%' OR lower(title) LIKE '%kombinerk%' OR lower(title) LIKE '%multimetr%' OR
    lower(title) LIKE '%miernik%' OR lower(title) LIKE '%tester%' OR lower(title) LIKE '%diagnost%' OR
    lower(title) LIKE '%kompresor%' OR lower(title) LIKE '%podnośnik%' OR lower(title) LIKE '%stojak%' OR
    lower(title) LIKE '%imadło%' OR lower(title) LIKE '%ściągacz%' OR lower(title) LIKE '%honownic%' OR
    lower(title) LIKE '%nitownic%' OR lower(title) LIKE '%suwmiark%' OR lower(title) LIKE '%mikrometr%' OR
    lower(title) LIKE '%prostownik%' OR lower(title) LIKE '%zestaw narzędzi%' OR lower(title) LIKE '%śrubokręt%' OR
    lower(title) LIKE '%wkrętak%' OR lower(title) LIKE '%lampa warsztatow%' OR lower(title) LIKE '%latarka czołow%' OR
    lower(title) LIKE '%ładowarka akumulator%' OR lower(title) LIKE '%spawark%' OR lower(title) LIKE '%szlifierk%' OR
    lower(title) LIKE '%wiertark%' OR (lower(title) LIKE '%synchronizacj%' AND lower(title) LIKE '%gaźnik%')
  ))
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
  lower(title || ' ' || coalesce(description, '')) LIKE '%akcesoria samochodowe%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%spinki samochodow%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%kołki samochodow%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%klipsy samochodow%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%tapicerka samochodow%' OR
  (lower(category) LIKE '%akcesoria samochodowe%' AND NOT (
    lower(title || ' ' || coalesce(description, '')) LIKE '%motocykl%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%skuter%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%scooter%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%motorower%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%quad%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%atv%'
  )) OR
  (lower(category) LIKE '%dom i ogród%' AND NOT (
    lower(title || ' ' || coalesce(description, '')) LIKE '%motocykl%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%skuter%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%quad%' OR
    lower(title || ' ' || coalesce(description, '')) LIKE '%atv%'
  )) OR
  lower(category) LIKE '%koszulki%' OR lower(category) LIKE '%bluzy%' OR
  lower(category) LIKE '%czapki%' OR lower(category) LIKE '%kurtki%' OR
  lower(category) LIKE '%breloczki%' OR lower(category) LIKE '%torby%' OR
  lower(category) LIKE '%modele samochodów%' OR lower(category) LIKE '%na prezent%' OR
  lower(category) LIKE '%bezrękawniki%' OR
  (lower(category) LIKE '%fotele%' AND lower(title) NOT LIKE '%motocykl%' AND lower(title) NOT LIKE '%quad%' AND lower(title) NOT LIKE '%atv%') OR
  (lower(category) LIKE '%przetwornice napięcia%' AND lower(category) LIKE '%akumulatory%' AND lower(title) NOT LIKE '%motocykl%' AND lower(title) NOT LIKE '%skuter%') OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%do szlifowania drewna%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%frez tarnik%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%toyota gazoo%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%rally-raid%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%w2rc%' OR
  lower(title || ' ' || coalesce(description, '')) LIKE '%breloczek%'
) THEN 1 ELSE 0 END;
