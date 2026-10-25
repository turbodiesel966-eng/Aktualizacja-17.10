# NAPRAWNIK — aplikacja webowa

## Kontrola kodu

Wymagany Node.js z obsługą wbudowanego modułu testowego.

```sh
node --check billing.js
node --check katalog-techniczny.js
node --check sw.js
node --test tests/*.test.cjs
```

Workflow GitHub Actions w `.github/workflows/validate-html.yml` sprawdza także składnię skryptu osadzonego w `index.html`.

## Płatności i uprawnienia

Frontend rozmawia z Cloudflare Workerem przez `billing.js`. Źródło Workera nie znajduje się w tym repozytorium; nie zmieniaj jego ustawień produkcyjnych na podstawie samego frontendu.

Uprawnienia w statycznej aplikacji HTML nie są granicą bezpieczeństwa dla osoby, która świadomie modyfikuje kod w przeglądarce. Operacje i dane płatne po stronie serwera muszą weryfikować token i aktywną subskrypcję w Workerze. W tej gałęzi dostęp PRO/WARSZTAT w interfejsie opiera się na bieżącej odpowiedzi API przechowywanej w pamięci, a nie na samym wpisie `localStorage`.

Nie uznawaj integracji Stripe za przetestowaną na produkcji bez odrębnej weryfikacji. Testy automatyczne nie wykonują transakcji.
