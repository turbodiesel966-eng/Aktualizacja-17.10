# NAPRAWNIK — katalog afiliacyjny APK

## Status integracji (13.11.2026)
Katalog działa przez osobny Cloudflare Worker i osobną bazę D1. To integracja APK-only; produkcyjne PWA, Worker subskrypcji, Stripe i baza płatności nie są zmieniane.

## Partnerzy i rzeczywiste dane
- **Motolak** — program zaakceptowany; 14 054 rekordy w staging. Feed zawiera dużo lakiernictwa samochodowego, dlatego publiczne wyszukiwanie filtruje ofertę pod zastosowania warsztatowe i jednoślady.
- **Tooles.pl** — program zaakceptowany; 4 553 rekordy w staging.
- **Gadżety Rajdowe** — program zaakceptowany; 3 242 rekordy w staging.
- **TopBuy.eu** — feed wykryty, ale import kończy się Cloudflare 1102; tymczasowo wyłączony z rotacji synchronizacji.
- **eTOMNAR** — brak potwierdzonego zaakceptowanego feedu w API; nie publikować ofert.

## Baza i API
- Worker (produkcja): `https://naprawnik-market-live.turbodiesel966.workers.dev`
- Worker (staging): `https://naprawnik-market-staging.turbodiesel966.workers.dev`
- D1: `naprawnik-market-live` (produkcja) oraz `naprawnik-market-staging` (staging) — obie oddzielone od bazy płatności i PWA.
- `GET /health` — status usługi.
- `GET /products?q=&category=&limit=&cursor=` — wyszukiwanie ofert, domyślnie ograniczone do zakresu warsztatowo-motocyklowego.
- `GET /categories` — kategorie i liczebność w tym samym zakresie.
- Linki produktowe są URL-ami trackingowymi zwróconymi przez WebePartners; nie generujemy ich samodzielnie.
- Ceny, waluta i zdjęcia pochodzą z feedów; przed zakupem należy potwierdzić aktualność w sklepie.
- Widoczne ujawnienie afiliacji: NAPRAWNIK może otrzymać prowizję, cena użytkownika nie wzrasta.

## Synchronizacja
- Cron Workera: co 6 godzin.
- Jeden feed na jedno uruchomienie; indeks feedu jest rotowany w tabeli `market_sync_state`, aby uniknąć limitu CPU przy pobieraniu wszystkich feedów jednocześnie.
- Aktualnie w rotacji: Motolak, Tooles.pl, Gadżety Rajdowe.
- TopBuy pozostaje poza rotacją do czasu rozwiązania błędu 1102.
- Historia synchronizacji: `market_sync_runs`.

## APK
`affiliate/market-ui.js` jest dołączany wyłącznie przez `scripts/prepare-mobile.mjs` do wygenerowanej kopii Androida w `www/`. PWA nie otrzymuje tego modułu. Katalog online wymaga połączenia z internetem; pozostałe funkcje APK pozostają lokalne.

## Zasady bezpieczeństwa
- Sekret WebePartners jest przechowywany jako Cloudflare Worker secret `WEBEPARTNERS_API_KEY`; login API jako zmienna Worker.
- Nie umieszczać sekretów, feed URL ani tokenu administracyjnego w APK ani repozytorium.
- Produkcyjna PWA i produkcyjny Worker subskrypcji są poza zakresem tej integracji.
