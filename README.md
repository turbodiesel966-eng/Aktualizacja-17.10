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
- Ceny używane do nowych zakupów: PRO 14,99 PLN/miesiąc i 149,99 PLN/rok; WARSZTAT 29 PLN/miesiąc i 300 PLN/rok. Ceny miesięczne/roczne są przypięte bezpośrednio do produkcyjnego Workera i mają odpowiadające im ceny w trybie testowym.
- Diagnostyka wywołana przez produkcyjny Worker otrzymała HTTP 403, kod `more_permissions_required`, typ `invalid_request_error` dla każdego `GET /v1/prices/{id}`. To potwierdza brak uprawnienia dla użytego klucza ograniczonego, a nie brak cen. Diagnostyka nie ujawnia wartości sekretu i wykonuje tylko żądania GET.
- **Wymagane uprawnienia restricted LIVE API key (ustawić minimalnie dla używanych endpointów):**
  - `Prices: Read` — sprawdzanie czterech cen i rozwinięte ceny przy odczycie subskrypcji.
  - `Checkout Sessions: Read + Write` — odzyskanie istniejącej sesji i tworzenie nowej sesji przez `POST /v1/checkout/sessions`.
  - `Subscriptions: Read` — odświeżanie aktualnego stanu subskrypcji przez `GET /v1/subscriptions/{id}`.
  - `Customers: Read + Write` — sprawdzenie klienta przy otwieraniu Billing Portal; tryb subskrypcji Checkout może utworzyć obiekt Customer, jeżeli użytkownik nie ma przypiętego klienta.
  - `Billing Portal Sessions: Write` (w Dashboardzie może być opisane jako Customer Portal / Billing customer portal session) — tworzenie sesji portalu przez `POST /v1/billing_portal/sessions`.
  - Nie włączaj uprawnień do płatności, zwrotów, wypłat, kart ani pozostałych zasobów, jeśli żaden endpoint aplikacji ich nie wywołuje. Jeżeli po nadaniu powyższych minimalnych zakresów Stripe nadal zwróci `more_permissions_required`, sprawdź szczegóły konkretnego Request ID w logach żądań Stripe i dodaj tylko jawnie wskazany zakres.
- Nie zmieniaj klucza ani sekretu w Cloudflare, dopóki nie ustalisz, że to właściwy klucz LIVE i że można edytować jego zakresy. Nie wklejaj wartości klucza do kodu, GitHuba ani czatu.
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
