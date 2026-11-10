# NAPRAWNIK v5.49 — Cyfrowy Mózg Warsztatu Motocyklowego

Profesjonalny kombajn warsztatowy, encyklopedia techniczna i asystent diagnostyczny dla mechaników motocykli, skuterów, motorowerów oraz quadów ATV/UTV. Działa w architekturze PWA (Web) oraz jako samodzielna, w 100% izolowana aplikacja Android APK bez konieczności połączenia z internetem.

---

## 1. Architektura i 6 Głównych Modułów

1. **Moduł 01 — Klienci i Zlecenia Warsztatowe:** Ewidencja napraw, koszyk części, robocizna, poufna analiza marży mechanika oraz generowanie i wydruk protokołów/zleceń PDF.
2. **Moduł 02 — Baza Wiedzy i Encyklopedia Usterek:** Ponad 70 realnych awarii warsztatowych z weryfikacją krok po kroku, zdjęciami makro, typowymi błędami i wskazówkami BHP.
3. **Moduł 03 — Katalog Techniczny & Momenty Dokręcania:** Baza 229+ modeli motocykli, skuterów i quadów ATV/UTV z danymi fabrycznymi OEM, luzami zaworowymi, świecami i momentami dokręcania głowic, cylindrów i zawieszeń.
4. **Moduł 04 — Narzędzia i Kalkulatory Warsztatowe:** Precyzyjne kalkulatory: Squish, stopień sprężania (CR), przełożenia, dobór dysz gaźnika, strojenie napędów CVT i dobór płytek zaworowych.
5. **Moduł 05 — Elektroniczne Laboratorium:** Diagnostyka instalacji 12V, rezystancji uzwojeń statora, cewek i impulsatorów, pinouty modułów CDI/TCI oraz testy regulatorów napięcia.
6. **Moduł 06 — Silniki Wielocylindrowe i Quady (Działy A–H):** Dedykowana baza serwisowa dla silników R2, R3, R4, V2, V4, Boxer, 2T/4T oraz quadów ATV/UTV 4x4. 8 wyspecjalizowanych działów z 47 procedurami naprawczymi.

---

## 2. Działy Diagnostyczne A–H (Procedury Warsztatowe)

- **Dział A: Mechanika i Rozrząd Silnika** — synchronizacja rozrządu wielocylindrowego, kompresja i próba olejowa, regulacja luzów zaworowych (płytki/śruby), dekompresatory automatyczne.
- **Dział B: Układy Zasilania i Wtrysk Paliwa (EFI)** — ciśnienie pompy paliwa, test wydatku i rozpylenia wtryskiwaczy, kalibracja TPS i zaworów IACV/STVA, synchronizacja podciśnieniowa wakuometrami.
- **Dział C: Układy Zapłonowe i Elektronika Sterująca** — diagnostyka cewek COP i przewodów WN, sygnały impulsatora CKP, test modułów CDI/TCI i komputerów ECU, masy silnika.
- **Dział D: Układ Ładowania i Instalacja 12V** — pomiary napięcia ładowania i prądu upływu, test diod regulatora napięcia, rezystancje faz statora 3-fazowego, spadki napięć.
- **Dział E: Układ Chłodzenia i Smarowania** — dynamiczny pomiar ciśnienia oleju, test termostatu i korka chłodnicy, odpowietrzanie układu, diagnostyka czujnika ECT i wentylatora.
- **Dział F: Układ Napędowy i Przeniesienie Napędu** — ślizganie i kalibracja sprzęgła wielopłytkowego, zużycie napędu CVT (pasek, wariator, sprzęgło odśrodkowe), inspekcja kardana i luzu dyferencjałów ATV 4x4.
- **Dział G: Zawieszenie, Rama i Układ Hamulcowy** — odpowietrzanie pomp i modulatorów ABS, regeneracja uszczelniaczy lag USD i tradycyjnych, łożyska główki ramy, geometria ramy.
- **Dział H: Specyfika Pojazdów Specjalnych (2T, Quady ATV / UTV)** — test szczelności karteru 2T, czyszczenie i kalibracja zaworów wydechowych YPVS/RAVE, załączanie siłownika napędu 4x4 w ATV, instalacja wyciągarki.

---

## 3. Oferta i Pakiety Abonamentowe

| Plan | Cena | Tryb | Główne Możliwości |
| :--- | :--- | :--- | :--- |
| **AMATOR** | **0 zł** | Stały / Bez konta | Katalog 229+ pojazdów, 70 usterek, kalkulatory warsztatowe, Lab do 20 wpisów, 1 własny pojazd, praca 100% offline. |
| **PRO** | **14,99 zł / mc** lub **149,99 zł / rok** | Subskrypcja (Stripe) | Wszystko z AMATOR + działy A–H, silniki wielocylindrowe i quady ATV/UTV, Lab do 150 wpisów, schematy SVG Zoom, dobór płytek zaworowych, 3 pojazdy. *(Test: 7 dni za 7 zł jednorazowo)*. |
| **WARSZTAT** | **29,00 zł / mc** lub **300,00 zł / rok** | Subskrypcja (Stripe) | Wszystko z PRO + pełny kombajn serwisowy: Karta Zlecenia, protokoły i wydruk PDF, poufna analiza marży mechanika, kartoteka do 2000 klientów i 500 pojazdów, 5000 pomiarów, eksport CSV. *(Test: 7 dni za 10 zł jednorazowo)*. |

*Uwaga:* Pakiety 3-dniowe zostały wycofane z oferty. Pakiety 7-dniowe są jednorazowe na dane konto/użytkownika i nie podlegają automatycznemu odnawianiu.

---

## 4. Weryfikacja i Testy Jakościowe

Do uruchomienia testów wymagany jest Node.js (wersja 20 lub nowsza):

```sh
# Weryfikacja składni i uruchomienie 112 testów regresyjnych:
npm test

# Synchronizacja zasobów do katalogu aplikacji mobilnej www/:
npm run mobile:prepare
```

Pliki `motocykle-multi-data.js`, `katalog-techniczny.js`, `motocykle-multi.js` oraz `index.html` stanowią **Single Source of Truth** w głównym katalogu projektu. Skrypt `prepare-mobile.mjs` automatycznie synchronizuje i weryfikuje ich zgodność skrótów SHA-256 z katalogiem `www/`.

---

## 5. Dystrybucja i Wdrożenie

- **Repozytorium:** `https://github.com/turbodiesel966-eng/Aktualizacja-17.10`
- **Wersja PWA (Produkcja):** `https://turbodiesel966-eng.github.io/Aktualizacja-17.10/`
- **Strona pobierania APK:** `https://naprawnik-download.pages.dev/`
- **Cloudflare Worker (Płatności Live):** `https://naprawnik-subscriptions-live.turbodiesel966.workers.dev`
