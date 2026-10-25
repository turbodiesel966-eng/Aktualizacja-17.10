# NAPRAWNIK — aplikacja webowa

## Kontrola kodu

Wymagany Node.js z obsługą wbudowanego modułu testowego.

```sh
node --check billing.js
node --check katalog-techniczny.js
node --check sw.js
node --check workers/subscriptions/src/index.mjs
node --test tests/*.test.cjs workers/subscriptions/security.test.mjs
```

Workflow GitHub Actions w `.github/workflows/validate-html.yml` sprawdza składnię skryptu osadzonego w `index.html`, pozostałe skrypty oraz uruchamia testy regresyjne.

## Płatności i uprawnienia

Źródło odczytanego Cloudflare Workera jest teraz wersjonowane w `workers/subscriptions/src/index.mjs`, wraz z migracjami D1 i szablonem konfiguracji stagingowej. To kod w gałęzi PR, a nie wdrożenie na Cloudflare.

Read-only audyt wdrożonego Workera wykazał, że kod nadpisywał `PRODUCTION_ENABLED` na `true`, mimo że zmienna Cloudflare była ustawiona na `false`, a także miał rozbieżność między originem aplikacji a wartościami URL-i w konfiguracji. Wersjonowany kod usuwa nadpisanie i waliduje URL-e powrotne. Konfigurację Cloudflare trzeba oddzielnie uzgodnić i przetestować na stagingu.

Uprawnienia w statycznej aplikacji HTML nie są granicą bezpieczeństwa dla osoby modyfikującej kod w przeglądarce. Stan planu w interfejsie pochodzi teraz z odpowiedzi API w zamknięciu modułu płatności, bez publicznego setter-a. Chronione dane i operacje muszą być weryfikowane przez Worker.

Żadne zmiany nie zostały wdrożone do Cloudflare/Stripe Live. Migracje D1 są tylko w repozytorium i nie zostały zastosowane do żadnej zdalnej bazy.