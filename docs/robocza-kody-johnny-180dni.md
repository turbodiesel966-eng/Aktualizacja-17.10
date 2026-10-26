# Wersja robocza: kody Johnny na 6 miesięcy

**Status: ROBOCZE — NIE WDRAŻAĆ DO LIVE bez wykonania listy kontroli poniżej.**  
Gałąź: `draft/johnny-codes-180-days`  
Zakres: 5 osobnych kodów promocyjnych WARSZTAT, każdy do jednorazowego użycia, 180 dni dostępu.

## Oczekiwane działanie

- Panel ADMINA ma przycisk „Generuj 5 kodów Johnny — WARSZTAT / 6 miesięcy”.
- Backend tworzy dokładnie 5 osobnych kodów, każdy z limitem 1 użycia, okresem dostępu 180 dni i ważnością samego kodu 180 dni.
- W bazie przechowywany jest tylko hash kodu i jego krótka końcówka — pełne kody pojawiają się administratorowi jednorazowo po utworzeniu.
- Po aktywacji kodu kampanii Johnny wyświetla się stylizowany komunikat:
  „Gratulacje Tu Johnny Dostałeś Dożywotni Dostęp Do Naprawnika”
  oraz mniejszym tekstem informacja, że dostęp trwa 6 miesięcy i trzeba go przedłużyć kolejnym kodem co pół roku.
- Zwykłe dotychczasowe kody na 3 i 7 dni mają zachować dotychczasowe działanie.
- Nie wykonujemy masowego update/delete tabel. Istniejące kody, subskrypcje, konta i aktywacje pozostają nietknięte.

## Co znajduje się w tej gałęzi

- `workers/subscriptions/src/index.mjs`: obsługa okresu 180 dni, paczki kodów i specjalnego pola komunikatu po aktywacji.
- `billing.js`: opcja 180 dni, przycisk tworzenia 5 kodów, wyświetlanie pełnych kodów do skopiowania oraz popup aktywacji Johnny.
- `workers/subscriptions/admin-promos.test.mjs`: testy regresyjne tworzenia pięciu kodów i komunikatu aktywacji.
- Plik dokumentacyjny z instrukcją bezpiecznego dokończenia.

## Warunki przed wydaniem

1. Sprawdź różnice gałęzi względem `main`; nie scalaj jej automatycznie.
2. Uruchom testy Node: `node --test workers/subscriptions/admin-promos.test.mjs` oraz pełny workflow CI.
3. Przejrzyj ustawienia produkcyjnego Workera `naprawnik-subscriptions-live` i aktualne bindingi. Przy wdrażaniu kodu użyj mechanizmu zachowującego istniejące bindingi/sekrety; nie publikuj nowej konfiguracji bez weryfikacji DB i sekretów.
4. Najpierw wdrożenie i test ograniczony w STAGING: jeden kod na 180 dni, aktywacja, sprawdzenie komunikatu i uprawnień. Nie używaj prawdziwego konta znajomego.
5. Dopiero po zaliczeniu testów wdrażaj Worker LIVE, potem panel frontendu. Zmień wersję cache Service Workera i parametr `billing.js?v=...` jako jedną skoordynowaną zmianę, by uniknąć starych zasobów na urządzeniach.
6. W LIVE dopiero wtedy utwórz pięć prawdziwych kodów. Skopiuj je do bezpiecznego miejsca i przekaż po jednym każdemu znajomemu.
7. Zweryfikuj, że zwykłe kody 3/7 dni i istniejący abonenci nadal działają.

## Zasady bezpieczeństwa

- Nie zmieniać ani nie usuwać rekordów istniejących użytkowników.
- Nie odczytywać/ujawniać sekretów z Cloudflare.
- Nie twierdzić, że pięć kodów zostało utworzonych, dopóki panel ADMINA nie zwróci pięciu pełnych kodów po pomyślnym utworzeniu.
- Komunikat „dożywotni” jest żartobliwy; mniejszy tekst musi wyraźnie wyjaśniać faktyczne 180 dni dostępu i konieczność wydania kolejnego kodu.

## Zmiany robocze przygotowane 26.10.2026

Zmodyfikowano źródło Workera i interfejs na tej gałęzi. Wdrożenie LIVE oraz wygenerowanie prawdziwych kodów **nie zostały potwierdzone**. Pracę należy wznowić od przeglądu diffów i testów, a nie od ponownego generowania kodów.
