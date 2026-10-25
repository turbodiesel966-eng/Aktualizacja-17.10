# NAPRAWNIK — aplikacja webowa

## Kontrola kodu

Wymagany Node.js z obsługą wbudowanego modułu testowego.

```sh
node --check billing.js
node --check katalog-techniczny.js
node --check sw.js
node --check workers/subscriptions/src/index.mjs
node --test tests/*.test.cjs workers/subscriptions/*.test.mjs
```

Workflow GitHub Actions w `.github/workflows/validate-html.yml` sprawdza składnię skryptu osadzonego w `index.html`, pozostałe skrypty oraz uruchamia testy regresyjne.

## Instalacja web jako PWA

- Aplikacja publikuje manifest `manifest.webmanifest` z zakresem ograniczonym do `/Aktualizacja-17.10/`, nazwą NAPRAWNIK i ikonami SVG w wariantach 192/512.
- Service Worker buforuje zasoby startowe, manifest i ikony; w razie utraty sieci próbuje wyświetlić zapisaną stronę startową. Funkcje wymagające Cloudflare/Stripe nadal potrzebują internetu.
- Na Androidzie otwórz oficjalny adres w Chrome i użyj menu przeglądarki → **Zainstaluj aplikację** lub **Dodaj do ekranu głównego** (nazwa opcji zależy od przeglądarki). To PWA zainstalowana z przeglądarki, a nie jeszcze osobny, podpisany plik APK.
- Przy zmianach zasobów zwiększ wersję cache w `sw.js` i numer `billing.js?v=...` w `index.html`, a potem uruchom testy regresyjne.

## Płatności i uprawnienia

- Produkcyjny Worker: `naprawnik-subscriptions-live`; jego kod źródłowy jest wersjonowany w `workers/subscriptions/src/index.mjs`.
- W Live potwierdzono konfigurację `PRODUCTION_ENABLED=true`, oczekiwany tryb Stripe `live`, cztery identyfikatory cen, adresy powrotu HTTPS i połączenie z produkcyjną bazą D1.
- Bezpośredni, tylko odczytowy odczyt konta Stripe potwierdził, że wszystkie cztery ceny są aktywne i poprawne: PRO 9 PLN/miesiąc i 100 PLN/rok; WARSZTAT 29 PLN/miesiąc i 300 PLN/rok.
- Diagnostyka wywołana przez produkcyjny Worker otrzymała HTTP 403 dla odczytu każdej ceny. To wskazuje na uwierzytelnienie lub uprawnienia użytego sekretu, a nie na brak cen. Do czasu uzyskania kodu błędu i typu klucza przyczyna jest **nierozstrzygnięta**. Diagnostyka nie ujawnia wartości sekretu i wykonuje tylko żądania GET.
- Zabezpieczone ścieżki API weryfikują token i uprawnienia po stronie Workera; ustawienia/interfejs przeglądarki nie nadają samodzielnie dostępu PRO/WARSZTAT.
- Tokeny API mają odnowienie kroczące tylko wtedy, gdy konto ma nadal aktywny abonament, okres ochronny opóźnionej płatności albo ważny dostęp promocyjny. Unieważnione tokeny pozostają odrzucane.
- Schemat tabel administracyjnych i kodów promocyjnych jest obecny w produkcyjnej bazie D1. Nie uruchamiaj migracji ponownie bez sprawdzenia aktualnego schematu.

## Asystent zdjęciowy AI

- Zdjęcia i przypadki asystenta są przechowywane lokalnie w IndexedDB; dane te nie są automatycznie synchronizowane między przeglądarkami.
- Analiza online jest kierowana przez `billing.js` do `POST /api/photo-diagnosis` w Cloudflare Workerze. Wymaga tokenu Bearer i aktywnego PRO/WARSZTAT zweryfikowanego przez serwer.
- **W produkcji analiza AI pozostaje celowo wyłączona.** Nie włączaj `PHOTO_ANALYSIS_ENABLED` ani nie dodawaj klucza OpenAI, dopóki nie zostanie osobno zatwierdzony budżet, konfiguracja i test bezpieczeństwa. Klucz API nie może trafiać do HTML ani repozytorium.
- Worker ogranicza typy i rozmiary przesyłanych plików, liczbę zdjęć oraz częstotliwość żądań. Odpowiedzi przekazywane do OpenAI używają `store: false`.

## Ograniczenia i następne kroki

- Nie utworzono podczas audytu nowych sesji Stripe Checkout, płatności, PaymentIntent ani subskrypcji.
- Przed uznaniem płatności za gotowe wymagane jest rozwiązanie HTTP 403 po stronie sekretu/uprawnień Stripe, a następnie ręczna weryfikacja właścicielska w panelu aplikacji. Nie wolno używać produkcyjnych transakcji jako testu technicznego.
- Dane pojazdów, napraw, notatek i checklist w webowej aplikacji pozostają obecnie lokalne dla danej przeglądarki. Worker zawiera API `/api/data`, ale frontend nie jest jeszcze zintegrowany z pełną synchronizacją danych. Kopię zapasową należy eksportować przed zmianami lub czyszczeniem pamięci.
- Wynik kompilacji i testów automatycznych nie jest równoznaczny z testem na fizycznym telefonie ani z potwierdzeniem realnej płatności.
