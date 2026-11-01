# Polityka Prywatności i Ochrony Danych (RODO) — NAPRAWNIK

## 1. Zasada minimalizacji danych (Privacy by Design)
Aplikacja **NAPRAWNIK** została zaprojektowana w architekturze *Local-First*:
- Korzystanie z bezpłatnego planu **AMATOR** nie wymaga rejestracji, podawania imienia, nazwiska, adresu e-mail ani numeru telefonu.
- Dane warsztatowe wprowadzane przez użytkownika (pojazdy, historia napraw, notatki, przypomnienia, checklisty oraz zdjęcia w Asystencie Zdjęć) są przechowywane domyślnie wyłącznie lokalnie w pamięci urządzenia użytkownika (`localStorage` oraz `IndexedDB`).

## 2. Konto dostępowe i klucze licencyjne
- W celu obsługi planów płatnych (**PRO** i **WARSZTAT**) oraz kodów promocyjnych aplikacja generuje kryptograficznie losowy klucz dostępu (token Bearer).
- W bazie danych **Cloudflare D1 (region: Unia Europejska)** przechowywany jest wyłącznie jednokierunkowy skrót kryptograficzny `SHA-256` tego klucza — serwer nie przechowuje jawnych tokenów ani haseł.
- Użytkownik może w każdej chwili pobrać swój klucz dostępu do pliku `.txt` (`NAPRAWNIK-klucz-dostepu.txt`) w zakładce **Plany i licencja**, aby zachować dostęp w razie zmiany telefonu lub wyczyszczenia danych przeglądarki.

## 3. Płatności i subskrypcje (Stripe)
- Obsługę płatności elektronicznych (subskrypcje miesięczne/roczne oraz pakiety jednorazowe 3- i 7-dniowe) realizuje zewnętrzny operator płatności **Stripe** (*Stripe Payments Europe, Ltd.*).
- Aplikacja NAPRAWNIK nie gromadzi ani nie przetwarza numerów kart płatniczych ani danych logowania do bankowości użytkownika.
- W bazie Cloudflare D1 zapisywane są wyłącznie techniczne identyfikatory powiązań (`stripe_customer_id`, `stripe_subscription_id`, `stripe_session_id`), rodzaj planu (`pro` / `warsztat`), status oraz czas wygaśnięcia uprawnień.

## 4. Kopia zapasowa w chmurze (PRO / WARSZTAT)
- Użytkownicy posiadający aktywny plan **PRO** lub **WARSZTAT** mogą dobrowolnie skorzystać z funkcji **Synchronizacja kopii w chmurze** w zakładce **Ustawienia**.
- Dane kopii zapasowej są przesyłane wyłącznie na wyraźne żądanie użytkownika połączeniem szyfrowanym HTTPS (`TLS`) i przypisywane do jego konta w bazie Cloudflare D1 (region UE).

## 5. Anonimowe statystyki odwiedzin (Opt-In)
- Zbieranie anonimowych statystyk odwiedzin jest **domyślnie wyłączone**.
- Po dobrowolnym włączeniu w zakładce **Ustawienia → Prywatność i statystyki**, serwer zapisuje wyłącznie jednokierunkowe skróty `SHA-256` losowego identyfikatora przeglądarki i sesji oraz datę wizyty, bez zapisywania surowych adresów IP.
- Zgodę można wycofać w dowolnym momencie jednym kliknięciem w Ustawieniach.

## 6. Prawa użytkownika
Użytkownik ma prawo do:
1. Eksportu wszystkich swoich danych lokalnych do pliku `.json` lub `.csv` bezpośrednio w zakładce **Ustawienia**,
2. Całkowitego usunięcia danych lokalnych z urządzenia przyciskiem **Wyczyść wszystkie dane lokalne**,
3. Zarządzania subskrypcją i danymi rozliczeniowymi w oficjalnym **Panelu subskrypcji Stripe (Billing Portal)**,
4. Kontaktu z administratorem w sprawach dotyczących konta, płatności i realizacji praw wynikających z RODO.
