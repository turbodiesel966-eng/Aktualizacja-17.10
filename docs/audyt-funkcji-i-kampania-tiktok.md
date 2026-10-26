# NAPRAWNIK — audyt funkcji, rozwój bazy i kampania TikTok

Stan odniesienia: 26 października 2026 r. Wersja interfejsu: NAPRAWNIK v5.16. Repozytorium: [Aktualizacja-17.10](https://github.com/turbodiesel966-eng/Aktualizacja-17.10). Ten dokument odróżnia funkcje potwierdzone w kodzie od elementów wymagających testu użytkowego. Nie oznacza, że każda funkcja jest zweryfikowana na każdym telefonie.

## 1. Zawartość aplikacji widoczna w kodzie

### Funkcje warsztatowe i diagnostyczne
- Diagnostyczne karty wiedzy i przypadki dla problemów silników 2T/4T, rozruchu, zapłonu, zasilania paliwem, CVT/napędu, chłodzenia i elektryki.
- Techniczny katalog parametrów/ustaleń z polami: rodzina, model/kod silnika, układ, parametr, wartość, jednostka, warunki zastosowania, status weryfikacji, źródło i ograniczenia.
- Wyszukiwanie i filtrowanie katalogu technicznego.
- Plany AMATOR, PRO i WARSZTAT oraz blokady widoków zależne od planu w interfejsie; funkcje płatne wymagają także weryfikacji po stronie serwera.
- Checklisty, notatki i historię pracy przechowywane lokalnie w przeglądarce.
- Eksport kopii zapasowej, eksport CSV dla danych warsztatowych oraz osobny eksport przypadków asystenta zdjęć.
- PWA: manifest, ikony i service worker z cache zasobów startowych; część funkcji chmurowych nadal wymaga internetu.

### Konto, dostęp i rozliczenia
- API kont i tokenów Bearer, przechowywanie skrótów tokenów oraz sprawdzanie uprawnień przez Worker.
- Plany Stripe PRO/WARSZTAT w abonamencie miesięcznym i rocznym; bieżące ceny miesięczne/roczne pozostają bez zmian.
- Stripe Checkout, Billing Portal, webhook podpisany i obsługa cyklu życia subskrypcji.
- Ochrona przed podwójnym Checkout dla jednego konta, klucz idempotencji oraz walidacja trybu test/live, waluty, aktywności ceny i URL powrotu.
- Jednorazowe pakiety: PRO 3 dni — 3 zł, PRO 7 dni — 7 zł, WARSZTAT 3 dni — 5 zł, WARSZTAT 7 dni — 10 zł. Mają oddzielne ceny Stripe w trybie TEST i LIVE, niezależne od abonamentów miesięcznych i rocznych.
- Istniejący panel ADMINA: serwerowa rola administratora, statystyki wyłącznie w panelu, diagnostyka ośmiu cen Stripe, generowanie i wyłączanie kodów promocyjnych, historia do 100 ostatnich wykorzystań bez adresów e-mail oraz agregat kosztu AI.

### Prywatność i zabezpieczenia
- Anonimowe pomiary są opcjonalne i domyślnie wyłączone.
- Przechowywane są hashe identyfikatorów przeglądarki/sesji, bez surowego adresu IP w tym module.
- Dokładna liczba kont pochodzi z unikalnych rekordów konta; aktywne konta to unikalne ID widziane w ruchu po logowaniu; przeglądarki anonimowe są szacunkiem, nie liczbą osób.
- Limity żądań D1 dla m.in. rejestracji, zapisów, Checkout/portalu, promocji, statystyk i analizy zdjęć.
- Analiza zdjęć otrzymała miesięczny budżet (domyślnie 5 USD), rezerwację do 0,25 USD na próbę, limit 5 prób/dobę i 8/godzinę na konto oraz blokadę, gdy nie można potwierdzić rezerwy w D1. Funkcja pozostaje wyłączona w ustawieniach Workera.

### Asystent zdjęciowy AI
- Endpoint analizy zdjęć 1–3 plików JPEG/PNG/WebP, walidacja typu/rozmiaru i sprawdzanie planu PRO/WARSZTAT po stronie serwera.
- W kodzie analiza wymaga flagi serwera i sekretu OpenAI; obecnie należy utrzymać ją wyłączoną, dopóki limity kosztów oraz konfiguracja nie zostaną wdrożone i przetestowane.

## 2. Granice, których nie należy ukrywać
- Wynik CI/Pages potwierdza automatyczne kontrole i publikację, a nie pełną zgodność każdego widoku mobilnego.
- Dane klientów, pojazdów, notatek i checklist są przede wszystkim lokalne; pełna synchronizacja danych warsztatowych przez API nie jest potwierdzona.
- Pełny test zakupu Stripe, webhooka od strony użytkownika i portalu rozliczeń nie jest równoważny z odczytem ustawień. Nie wykonywać płatności testowych ani prawdziwych bez odrębnej zgody właściciela.
- Moduły pakietów, historia użycia promocji, migracja budżetu AI i oba Workery zostały wdrożone w LIVE/STAGING. Pozostaje kontrolowany E2E w Stripe TEST (po uzyskaniu zgody na testową transakcję) oraz osobna decyzja właściciela o aktywacji analizy AI. Nie uruchamiano sesji Checkout ani płatności.

## 3. Rozszerzenie bazy usterek — zasada jakości
Nowe przypadki dodane w ramach rozwoju bazy opisują **procedury ogólnej diagnostyki**, nie zastępują serwisówki producenta. Nie podają uniwersalnych momentów dokręcania, luzów zaworowych, rezystancji ani wartości kompresji. Dla każdego modelu należy potwierdzić parametry, kod silnika, rocznik i wersję układu. Jeśli występuje wyciek paliwa, przegrzanie, zatarcie lub problem z hamulcami/kierowaniem — najpierw przerwać użytkowanie i zabezpieczyć pojazd.

### 20 nowych kart diagnostycznych dodanych do bazy

Po dodaniu nowych przypadków główna tablica `knowledgeCases` zawiera **50 kart o unikalnych ID**. Nowe karty obejmują:

1. **Akumulator się rozładowuje — ładowanie nie rośnie.** Sprawdzenie akumulatora i połączeń, pomiar ładowania, regulatora oraz statora według schematu konkretnego pojazdu.
2. **Przeładowanie akumulatora lub przepalające się żarówki.** Sprawdzenie masy regulatora, zgodności regulatora z instalacją AC/DC oraz pomiary napięcia w danych warunkach pracy.
3. **Kliknięcie rozrusznika, ale brak obrotu.** Rozdzielenie słabego akumulatora, złych połączeń, przekaźnika, rozrusznika i ewentualnej blokady mechanicznej.
4. **Rozrusznik kręci, ale wał nie obraca się.** Kontrola bendiksa/sprzęgła jednokierunkowego, zazębienia i swobody obrotu silnika bez wymuszania ruchu.
5. **Przelewanie gaźnika lub wyciek z przelewu.** Zabezpieczenie paliwa, kontrola pływaka, iglicy, gniazda oraz kranika podciśnieniowego.
6. **Dławienie na wysokich obrotach lub pod obciążeniem.** Sprawdzenie odpowietrzenia zbiornika, filtra, przewodów, dysz gaźnika albo ciśnienia paliwa w EFI.
7. **Wysokie obroty w silniku 2T po puszczeniu gazu.** Kontrola linki/przepustnicy, nieszczelności dolotu i skrzyni korbowej oraz procedury testu szczelności.
8. **Przegrzewanie lub przycieranie silnika 2T.** Zalecenie przerwania jazdy i kontrola smarowania, chłodzenia, szczelności, mieszanki, zapłonu, wydechu oraz tłoka/cylindra.
9. **Trudny rozruch rozgrzanego silnika 4T — luzy zaworowe.** Pomiar luzów w warunkach z serwisówki i dalsze rozróżnienie przyczyn, jeśli luzy są prawidłowe.
10. **Migające światła przy poruszaniu kierownicą.** Kontrola wiązki przy główce ramy, stacyjce, złączach i punktach masowych, a następnie bezpieczne pomiary spadków napięcia.
11. **Zanik iskry na wybojach lub przy poruszaniu wiązką.** Kontrola fajki, przewodu WN, cewki, mas, CDI/ECU i przewodu gaszenia bez wymieniania części „w ciemno”.
12. **Tylne koło obraca się ciężko po naprawie CVT lub hamulca.** Sprawdzenie tulei, dystansów, podkładek, poprawności montażu napędu, hamulca i łożysk.
13. **Hamulec grzeje się, trze albo nie odpuszcza.** Wstrzymanie jazdy i kontrola powrotu dźwigni/linki, tłoczka, prowadnic zacisku, klocków/szczęk i przewodu.
14. **Przegrzewanie silnika 4T z chłodzeniem cieczą.** Kontrola po ostygnięciu poziomu płynu, wycieków, wentylatora, bezpiecznika, czujnika, termostatu i pompy.
15. **Wyciek oleju z silnika lub przekładni.** Ustalenie dokładnego źródła, rozdzielenie smarowania silnika i przekładni końcowej oraz ocena, czy wolno bezpiecznie jechać.
16. **Zapach benzyny lub wyciek paliwa.** Natychmiastowe przerwanie prób rozruchu, usunięcie źródeł zapłonu i kontrola przewodów, zbiornika, kranika, filtra i gaźnika.
17. **Falujące obroty na biegu jałowym w EFI.** Odczyt błędów i danych sterownika oraz kontrola dolotu, mas, złączy i czujników na podstawie dokumentacji modelowej.
18. **Nagły metaliczny hałas silnika.** Zalecenie wyłączenia silnika i dalsze rozróżnienie osłon/napędu zewnętrznego od rozrządu, tłoka, łożysk i wału.
19. **Niska kompresja.** Właściwe warunki pomiaru oraz rozróżnienie pierścieni, tłoka, cylindra, zaworów, uszczelki i rozrządu; osobno wskazano ograniczenia testu w silniku 2T.
20. **Brak rozruchu lub przerywanie po myciu/deszczu.** Osuszenie, kontrola dolotu, fajki, WN, cewek, złączy CDI/ECU i mas przed ponowną próbą.

Każda karta ma sekcje kroków diagnostycznych i ostrzeżeń. Wartości liczbowe są celowo odsyłane do właściwej serwisówki, jeśli zależą od kodu silnika lub wersji pojazdu.

## 4. Kampania TikTok — 14 dni

### Cel
Zebrać pierwszych rzeczywistych użytkowników i informację zwrotną, nie kupować wyświetleń ani nie obiecywać cudownej automatycznej naprawy. Główny przekaz: „mniej zgadywania, uporządkowana diagnostyka”.

### Odbiorcy
Właściciele skuterów 2T/4T, osoby naprawiające pojazdy w garażu, początkujący mechanicy oraz małe warsztaty. W materiałach używać rzeczywistych części i prostych demonstracji.

### Powtarzalny format
9:16, 15–30 s, cięcie co 1–3 s, napisy na ekranie i nagrania z garażu. Pokaż objaw, pierwszy sensowny trop, bezpieczny test, a na końcu interfejs NAPRAWNIKA i CTA. Nie publikuj tablic rejestracyjnych, VIN ani danych klientów.

### Kalendarz publikacji
1. **Problem:** „Skuter kręci, ale nie odpala — od czego zacząć?” Pokaż prostą kolejność: iskra, paliwo, kompresja.
2. **Mit:** „Nie wymieniaj CDI w ciemno.” Pokaż sprawdzanie masy, kill switch i impulsatora według schematu.
3. **CVT:** „Wysokie obroty, słabe przyspieszenie?” Rozróżnij napęd od problemu mocy silnika.
4. **2T:** „Wysokie obroty po puszczeniu gazu — uważaj na lewe powietrze.” Podkreśl ryzyko dla silnika.
5. **Warsztat:** pokaż checklistę przed rozebraniem silnika.
6. **Historia napraw:** pokaż, jak notować objaw, pomiar, część i wynik naprawy — bez fikcyjnych danych.
7. **Odpowiedź na komentarz:** wybierz realne pytanie użytkownika; nie przedstawiaj go jako potwierdzonej diagnozy.
8. **Elektryka:** 3 podstawowe kontrole przed podejrzeniem regulatora.
9. **Paliwo:** objaw przelewania gaźnika i dlaczego nie należy odpalać silnika przy wycieku.
10. **Pomyłka montażowa:** podkładka/tuleja CVT — pokaż kontrolę schematu części, nie uniwersalny moment.
11. **4T:** ciężki rozruch na ciepło i znaczenie luzu zaworowego.
12. **Demo aplikacji:** wyszukaj symptom i pokaż przypadki wiedzy oraz status weryfikacji.
13. **Pytanie do społeczności:** „Jaki objaw mam rozpisać jako następny: brak iskry, brak ładowania czy przelewanie gaźnika?”
14. **Podsumowanie:** 3 najczęstsze błędy diagnostyczne i spokojne CTA do sprawdzenia NAPRAWNIKA.

### Gotowy scenariusz pierwszego filmu (20–25 s)
**0–2 s:** zbliżenie na skuter, napis: „Kręci, ale nie odpala?”  
**2–7 s:** „Nie zaczynaj od kupowania CDI.” Pokaż świecę/tester iskry.  
**7–12 s:** „Sprawdź iskrę, dopływ paliwa i kompresję — krok po kroku.”  
**12–18 s:** nagranie ekranu NAPRAWNIKA z wyszukiwaniem przypadku, bez widocznych kont, tokenów ani danych prywatnych.  
**18–23 s:** „Zapisz ten film. NAPRAWNIK pomaga uporządkować diagnostykę.”  
**Opis:** „Skuter nie odpala? Najpierw sprawdź podstawy, potem wymieniaj części. Parametry zawsze potwierdzaj dla konkretnego silnika. #skuter #mechanika #2T #4T #warsztat #naprawnik”  
**CTA:** „Napisz w komentarzu model silnika i objaw — bez VIN i danych osobowych”.

### Mierzenie wyników
Po 24 i 72 godzinach zapisuj wyświetlenia, średni czas oglądania, procent obejrzeń do końca, zapisy, udostępnienia, komentarze, wejścia w link i nowe rejestracje. Porównuj wyniki organiczne per film. Nie przedstawiaj zasięgów jako liczby użytkowników aplikacji.

### Zasady promocyjne i bezpieczeństwo
- Nie obiecuj 100% poprawności diagnozy ani konkretnej oszczędności pieniędzy bez dowodu.
- Nie pokazuj niebezpiecznych prób z paliwem, odsłoniętym napędem, gorącym układem chłodzenia ani pracującymi elementami.
- Każdy film kończy się jasną wskazówką, że specyfikacje liczbowe muszą odpowiadać konkretnemu modelowi.
- Nie płacimy za reklamy ani nie uruchamiamy promocji płatnej bez osobnej zgody. Pierwsze 14 dni to test treści organicznych.

## 5. Spis 20 nowych kart diagnostycznych dodanych do bazy

Każda karta zawiera objaw, możliwe przyczyny, kolejność bezpiecznych kontroli oraz zastrzeżenia, gdzie trzeba korzystać z dokumentacji serwisowej konkretnego modelu:

1. **Brak wzrostu napięcia ładowania** — akumulator, połączenia masy, stator i regulator.
2. **Przeładowanie / przepalające się żarówki** — masa regulatora, zgodność instalacji oraz pomiary napięcia.
3. **Kliknięcie bez kręcenia rozrusznika** — akumulator, przewody, przekaźnik, rozrusznik i możliwe mechaniczne zablokowanie silnika.
4. **Rozrusznik kręci, ale nie obraca wałem** — sprzęgło jednokierunkowe, bendiks lub przekładnia rozrusznika.
5. **Przelewanie gaźnika** — pływak, zawór iglicowy, gniazdo i kranik paliwa.
6. **Dławienie na wysokich obrotach / pod obciążeniem** — przepływ paliwa, filtr, dysze lub ciśnienie paliwa, zależnie od gaźnika/EFI.
7. **Wysokie obroty 2T po puszczeniu gazu** — przepustnica, nieszczelny dolot, króciec i uszczelniacze; ostrzeżenie przed ryzykiem ubogiej mieszanki.
8. **Przegrzewanie/przytarcie 2T** — smarowanie, szczelność, mieszanka, chłodzenie i stan tłoka/cylindra.
9. **Ciężki rozruch 4T na ciepło** — pomiar luzów zaworowych i dalsza diagnostyka kompresji oraz układów zasilania.
10. **Migające światła przy skręcaniu kierownicą** — wiązka przy główce ramy, stacyjka, złącza oraz punkty masowe.
11. **Zanik iskry na wybojach** — fajka, przewód WN, cewka, złącza CDI/ECU i przewód gaszenia.
12. **Opór tylnego koła po pracach przy CVT/hamulcu** — dystanse, tuleje, montaż napędu, hamulec i łożyska.
13. **Grzejący się lub trący hamulec** — linka, zacisk, tłoczek, prowadnice i elementy hydrauliczne.
14. **Przegrzewanie silnika chłodzonego cieczą** — płyn, wycieki, chłodnica, wentylator, termostat i pompa.
15. **Wyciek oleju z silnika/przekładni** — zlokalizowanie źródła, oddzielenie obiegów i sprawdzenie uszczelnień.
16. **Zapach benzyny / podejrzenie wycieku** — bezpieczne przerwanie użytkowania, przewody, zbiornik, kranik i gaźnik.
17. **Falujące wolne obroty EFI** — kody usterek, szczelność dolotu, czujniki i odczyt danych bieżących.
18. **Nagły metaliczny hałas silnika** — bezpieczne wyłączenie, poziom oleju oraz etapowa kontrola mechaniczna.
19. **Niska kompresja** — poprawne warunki pomiaru i różnice diagnostyczne między 2T a 4T.
20. **Problemy po myciu/deszczu** — wilgoć w zapłonie, złączach, dolocie i osprzęcie.

## 6. Materiały kampanii przygotowane w Canva

- **Grafika pionowa TikTok 9:16:** [otwórz podgląd](https://www.canva.com/d/BpxEmJwibYnHzRz) · [edytuj w Canva](https://www.canva.com/d/p5AXcLEYkMg1S7h)
- **Prezentacja kampanii — 10 slajdów:** [otwórz podgląd](https://www.canva.com/d/4JVIp-tcRot4pDN) · [edytuj w Canva](https://www.canva.com/d/HXadx5HkVKx32ug)

To materiały robocze do publikacji. Nie oznaczają, że filmy opublikowano na TikToku ani że konto TikTok jest połączone z harmonogramem publikacji.
