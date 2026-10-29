# NAPRAWNIK — checklista testów APK

Ten dokument dotyczy wyłącznie izolowanej wersji Android APK. Nie wdrażaj plików do produkcyjnego web/PWA.

## 1. Przed instalacją
- Pobierz artefakt `naprawnik-android-debug-apk` z ukończonego workflow GitHub Actions.
- Zachowaj kopię danych starej aplikacji przez jej funkcję eksportu. Kopia PWA/Chrome i kopia APK to oddzielne źródła danych.
- Debug APK może mieć inny podpis niż instalacja produkcyjna i nie musi aktualizować jej bez odinstalowania. Nie odinstalowuj starej aplikacji, jeśli nie masz sprawdzonej kopii danych.
- Nie wykonuj zakupów produkcyjnych podczas testów.

## 2. Test funkcji — zaznacz wynik na telefonie
- [ ] APK instaluje się i uruchamia bez błędu.
- [ ] Ekran startowy, ikona i nawigacja są prawidłowe.
- [ ] Przycisk Wstecz wraca z widoku do poprzedniego ekranu.
- [ ] Wyszukiwanie nadal znajduje istniejące usterki.
- [ ] Nowe karty są wyszukiwalne: 2T brak rozruchu; 2T wysokie obroty; 4T brak rozruchu; 4T gaśnie.
- [ ] Karta pokazuje objaw, możliwe przyczyny, testy i zalecane rozwiązanie.
- [ ] Każda karta pokazuje źródło i status „częściowo potwierdzone”; wartości modelowe są weryfikowane w DTR.
- [ ] Kalkulator mieszanki: 5 l paliwa przy 1:50 daje 100 ml oleju.
- [ ] Kalkulator pojemności: cylinder 40 × 39 mm, jeden cylinder daje około 49,01 cm³.
- [ ] Kalkulator przełożenia: 14 zębów z przodu i 52 z tyłu daje około 3,714:1.
- [ ] Puste, zerowe, ujemne i nienumeryczne dane nie powodują awarii aplikacji.
- [ ] Kalkulatory otwierają się, zamykają i działają bez połączenia z internetem.
- [ ] Dane użytkownika zachowują się po zamknięciu i ponownym uruchomieniu.
- [ ] Eksport kopii JSON działa, a import prawidłowej kopii odtwarza dane.
- [ ] Import uszkodzonego pliku jest odrzucany z czytelnym komunikatem.
- [ ] Parowanie ADMIN wymaga autoryzacji serwera; sam ukryty przycisk nie daje uprawnień.
- [ ] Dodawanie/edycja karty przez ADMIN działa i nie znika po ponownym uruchomieniu.
- [ ] Testy płatności nie utworzyły rzeczywistego zamówienia.

## 3. Warunek akceptacji
Wpisz urządzenie, wersję Androida, SHA/wersję APK oraz wynik każdego testu. Każdy błąd musi mieć opis i kroki odtworzenia. Nie scalaj PR i nie publikuj aktualizacji, dopóki krytyczne testy nie przejdą.

## 4. Oddzielny test webowy — dopiero po zaakceptowaniu APK
- Użyj osobnej gałęzi i osobnego projektu/hostingu testowego.
- Nie zmieniaj produkcyjnego `main`, produkcyjnych sekretów, Workera ani domeny produkcyjnej.
- Najpierw sprawdź, że różnica webowa jest pusta lub celowo ograniczona do jawnie zatwierdzonych zmian.
- Testuj formularze, wyszukiwanie, responsywność, Service Workera, import/eksport oraz regresje.
- Do produkcji przenoś wyłącznie zatwierdzone zmiany w osobnym PR po porównaniu diffu i wyników testów.
