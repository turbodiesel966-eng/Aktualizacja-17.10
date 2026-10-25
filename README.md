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

## Asystent zdjęciowy AI

- Przypadki, zdjęcia i checklisty nadal zapisują się lokalnie w IndexedDB i mogą być używane offline.
- Analiza online jest kierowana przez `billing.js` do `POST /api/photo-diagnosis` w Cloudflare Workerze. Wymaga tokenu Bearer oraz aktywnego PRO/WARSZTAT zweryfikowanego w D1; UI nie może nadać tego uprawnienia samodzielnie.
- Worker dopuszcza maksymalnie 3 pliki JPEG/PNG/WebP (do 1,5 MB na plik, do 5 MB całe żądanie) i 8 prób na konto na godzinę. Obrazy są przekazywane do OpenAI Responses API; odpowiedź nie jest przechowywana przez parametr `store: false`.
- Klucz `OPENAI_API_KEY` musi być dodany jako sekret na stagingowym Workerze; nigdy w HTML ani repozytorium. Nazwa modelu to `OPENAI_VISION_MODEL` (domyślnie `gpt-4.1-mini`).
- Ta gałąź nie została wdrożona. Bez sekretu i testu online nie można twierdzić, że analiza AI działa produkcyjnie. Przy hostingu statycznym GitHub Pages stary adres `/.netlify/functions/photo-diagnosis` nie istnieje automatycznie i został usunięty z przepływu aplikacji.

## Pozostałe warunki pełnego testu

- W tej sesji dostępny przez konektor Stripe jest tylko kontekst Live. Nie używaj go do testów. Do rzeczywistego E2E potrzebny jest połączony kontekst Sandbox/Test, cztery kanoniczne Price IDs testowe (zwłaszcza jedna wybrana para WARSZTAT), podpisany testowy webhook oraz sekret OpenAI dodany bezpiecznie na stagingu.
- Migracje `0002_request_limits.sql` i `0003_checkout_locks.sql` pozostają tylko w repozytorium; przed uruchomieniem wersji Workera z tej gałęzi trzeba je zastosować do potwierdzonej bazy stagingowej — nigdy live w ramach tego PR.
- Dane pojazdów, napraw, notatek i checklist w statycznym HTML nadal są lokalne dla przeglądarki. Synchronizacja tych danych przez `/api/data` nie jest zintegrowana z frontendem w tym PR. Klientowe blokady planów nie są mechanizmem autoryzacji serwerowej.
