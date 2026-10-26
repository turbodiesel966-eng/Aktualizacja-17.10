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
- Na Androidzie można zainstalować PWA z oficjalnego adresu w Chrome przez menu → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**.
- Osobny APK debug jest budowany w `.github/workflows/build-android-apk.yml`. Pakiet zawiera lokalne pliki HTML, moduł płatności, katalog techniczny, katalog diagnostyczny, PWA assets i mostek natywny. Ikona oraz ekran startowy są generowane z istniejącego logo SVG NAPRAWNIKA.
- Przy zmianach zasobów zwiększ wersję cache w `sw.js` i numer `billing.js?v=...` w `index.html`, a potem uruchom testy regresyjne.


## Funkcje natywne Androida

- Mostek `scripts/native-bridge.js` jest wstrzykiwany wyłącznie do wygenerowanego katalogu `www`; nie jest dołączany do opublikowanej wersji webowej.
- Przycisk systemowy Wstecz zamyka najpierw otwarty widok diagnostyczny, następnie wraca do Home, a dopiero na Home zamyka aplikację.
- Zewnętrzne instrukcje PDF i inne łącza HTTP(S) otwierają się przez natywną kartę przeglądarki. Pasek statusu używa ciemnego tła NAPRAWNIKA.
- Eksport kopii danych warsztatowych oraz oddzielny eksport historii asystenta ze zdjęciami uruchamiają natywne okno Udostępnij/Zapisz. Plik kopii jest przygotowywany w pamięci tymczasowej aplikacji i nie jest automatycznie wysyłany na serwer.
- Weryfikacja APK sprawdza obecność minimum 70 unikalnych kart diagnostycznych, plików płatności/katalogu/Service Workera, wejść eksportu/importu, integracji administratora, ikon Androida w kilku rozdzielczościach oraz obrazów splash screen.
- APK debug nadal wymaga testu na fizycznym urządzeniu. Zmiany nie importują automatycznie lokalnej pamięci Chrome i nie usuwają żadnych zapisanych danych.

## Płatności i uprawnienia

- Produkcyjny Worker: `naprawnik-subscriptions-live`; jego kod źródłowy jest wersjonowany w `workers/subscriptions/src/index.mjs`.
- W Live potwierdzono konfigurację `PRODUCTION_ENABLED=true`, oczekiwany tryb Stripe `live`, osiem identyfikatorów cen (4 abonamentowe i 4 jednorazowe), adresy powrotu HTTPS i połączenie z produkcyjną bazą D1.
- Ceny używane do nowych zakupów: PRO 14,99 PLN/miesiąc i 149,99 PLN/rok; WARSZTAT 29 PLN/miesiąc i 300 PLN/rok. Ceny miesięczne/roczne są przypięte bezpośrednio do produkcyjnego Workera i mają odpowiadające im ceny w trybie testowym.
- **Stan po ostatniej weryfikacji (26.10.2026):** odczyt Stripe potwierdził wszystkie osiem cen: cztery abonamentowe i cztery jednorazowe, każdą z właściwym trybem, aktywnym statusem, walutą PLN i kwotą. To odczyt konfiguracji — nie pełny test płatności i nie potwierdzenie przepływu użytkownik → Checkout → webhook. Nie utworzono podczas tej weryfikacji żadnych sesji Checkout.
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
- Schemat tabel administracyjnych, kodów promocyjnych, historii wykorzystania, zakupów jednorazowych i budżetu AI jest obecny w produkcyjnej bazie D1. Migracja `0005_photo_usage_budget.sql` jest addytywna i zastosowana w LIVE oraz STAGING.

## Pakiety jednorazowe

- PRO na 3 dni — 3,00 zł; PRO na 7 dni — 7,00 zł.
- WARSZTAT na 3 dni — 5,00 zł; WARSZTAT na 7 dni — 10,00 zł.
- Każdy pakiet ma odrębną cenę Stripe w TEST i LIVE; są to ceny jednorazowe (`type=one_time`), a nie cykliczne abonamenty. Dotychczasowe ceny miesięczne/roczne nie zostały zmienione.
- Endpoint `POST /api/one-time-checkout` wymaga uwierzytelnionego konta, klucza idempotencji oraz zgodności ceny, kwoty, waluty i trybu ze środowiskiem; ma też limit 5 prób na konto na godzinę i nie pozwala prowadzić równolegle sesji abonamentowej i jednorazowej. Podpisany webhook ponownie odczytuje Checkout i dopiero przy `payment_status=paid` zapisuje dostęp czasowy. `one_time_purchases` używa identyfikatora sesji Checkout jako klucza idempotencji.
- Schematy zakupów i rezerwacji budżetu zostały wdrożone addytywnie do D1 STAGING oraz LIVE. Backend LIVE i STAGING mają nowe bindingi cen, a istniejące bindingi i sekrety zostały zachowane.
- Nie wykonano rzeczywistej ani testowej płatności. Przed ogłoszeniem gotowości przepływu trzeba przeprowadzić kontrolowany E2E w TEST za odrębną zgodą: sesja → płatność testowa → webhook → nadanie 3/7-dniowego dostępu → wygaśnięcie/odnowienie statusu.

## Panel ADMINA i historia

- Statystyki są dostępne tylko w panelu właściciela/ADMINA; publiczny licznik użytkowników nie jest wyświetlany.
- Dokładna liczba kont pochodzi z rekordów kont o unikalnym ID; aktywność zalogowanych kont jest liczona przez unikalny `user_id` w wybranym okresie. Sesje/przeglądarki pozostają osobnymi miarami, a przeglądarki anonimowe są opisane jako szacunek.
- Panel pokazuje historię do 100 ostatnich aktywacji kodów z krótkim ID konta, bez e-maili. Rekordy historii są retencjonowane do roku od aktywacji; szczegółowy zakres przechowywania powinien być opisany w polityce prywatności.
- Budżet analizy AI jest widoczny wyłącznie w panelu admina jako agregat miesięczny: koszt szacowany, rezerwy i liczba żądań. Nie przechowuje zdjęć ani ID klientów w rejestrze budżetu.

## Asystent zdjęciowy AI

- Zdjęcia i przypadki asystenta są przechowywane lokalnie w IndexedDB; dane te nie są automatycznie synchronizowane między przeglądarkami.
- Analiza online jest kierowana przez `billing.js` do `POST /api/photo-diagnosis` w Cloudflare Workerze. Wymaga tokenu Bearer i aktywnego PRO/WARSZTAT zweryfikowanego przez serwer.
- **W produkcji analiza AI pozostaje wyłączona** (`PHOTO_ANALYSIS_ENABLED` nie została włączona, klucz OpenAI nie jest dodany). Nie uruchamiaj jej, dopóki właściciel oddzielnie nie zatwierdzi aktywacji i nie przejdzie przeglądu.
- Backend ma już twardą bramkę budżetową w D1: domyślny limit 5 USD na miesiąc UTC, rezerwa 0,25 USD na każde żądanie, limit 5 żądań na konto/dobę i 8/godzinę, fail-closed przy niedostępnej bazie budżetu. Admin widzi tylko agregaty. Dopuszczony model to `gpt-6-luna`; model `gpt-4.1-mini`, oznaczony w aktualnej dokumentacji OpenAI jako deprecated, jest blokowany.
- Obsługiwane są 1–3 zdjęcia JPEG/PNG/WebP, 1,5 MiB na plik i 5 MiB całego żądania; każdy obraz jest ograniczony do 12 megapikseli (i maks. 8000 px na wymiar). Nieznany model bez jawnej stawki jest blokowany. Koszt jest szacowany z liczby tokenów zwróconych przez Responses API; jeżeli usage nie wróci, rezerwa zostaje zachowana jako konserwatywne zużycie.
- Odpowiedzi przekazywane do OpenAI używają `store: false`; klucz API nie może trafiać do HTML ani repozytorium.
- Cennik modeli należy weryfikować na bieżąco w [oficjalnym cenniku OpenAI](https://developers.openai.com/api/docs/pricing); w razie zmiany cen aktualizuj mapę kosztów przed włączeniem funkcji.

## Ograniczenia i następne kroki

- Nie utworzono podczas audytu nowych sesji Stripe Checkout, płatności, PaymentIntent ani subskrypcji.
- **Przed uznaniem płatności za w pełni przetestowane:** wykonać i udokumentować kontrolowany E2E wyłącznie w trybie Stripe TEST: abonamentowy Checkout → webhook → przyznanie planu → Billing Portal → anulowanie/aktualizacja oraz osobny zakup jednorazowy 3/7 dni. W tej zmianie nie tworzono żadnych sesji Checkout i nie wykonywano płatności; prawdziwy zakup nie jest testem technicznym.
- Dane pojazdów, napraw, notatek i checklist w webowej aplikacji pozostają obecnie lokalne dla danej przeglądarki. Worker zawiera API `/api/data`, ale frontend nie jest jeszcze zintegrowany z pełną synchronizacją danych. Kopię zapasową należy eksportować przed zmianami lub czyszczeniem pamięci.
- Wynik kompilacji i testów automatycznych nie jest równoznaczny z testem na fizycznym telefonie ani z potwierdzeniem realnej płatności.
