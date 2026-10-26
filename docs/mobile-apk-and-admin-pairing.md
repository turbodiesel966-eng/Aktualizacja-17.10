# NAPRAWNIK — logowanie właściciela na telefonie i APK Android

## Konto właściciela na drugim urządzeniu

Panel administratora jest przypisany do jednego konta po stronie serwera. Samo wpisanie kodu aktywacyjnego drugi raz nie powinno tworzyć kolejnego konta z uprawnieniami administratora.

1. Na urządzeniu, na którym panel ADMINA już działa, otwórz Ustawienia → Właściciel aplikacji / ADMIN.
2. Wybierz **Wygeneruj kod połączenia telefonu**.
3. Skopiuj kod i użyj go na drugim urządzeniu w panelu właściciela. Kod działa przez 10 minut i może być wykorzystany raz.
4. Po połączeniu telefon otrzyma osobny token tego samego konta właściciela. W bazie zapisywany jest tylko skrót kodu; pełny kod nie jest przechowywany.

Nie umieszczaj kodu ani tokena w publicznym repozytorium, zrzucie ekranu lub komentarzu.

## APK Android

GitHub Actions generuje instalowalny plik APK z lokalnie dołączonymi plikami aplikacji. Artifact jest publikowany jako `naprawnik-android-debug-apk` i pozostaje dostępny przez 30 dni. To **debug APK** do instalacji/testów, nie podpisany kluczami właściciela pakiet produkcyjny przeznaczony do Google Play.

APK działa z bieżącą konfiguracją API produkcyjnego, dlatego żądania płatności i administratora wymagają internetu. Dane lokalne zapisane w przeglądarce Chrome nie są automatycznie przenoszone do Android WebView. Przed pierwszym użyciem APK wyeksportuj kopię zapasową z wersji web i zachowaj poprzednią aplikację — niczego nie czyścić ani nie usuwać.

## Bezpieczne wdrażanie backendu

Migracja `0006_admin_device_pairing.sql` jest addytywna: tworzy wyłącznie tabelę i indeksy dla kodów parowania; nie usuwa istniejących rekordów, tabel ani subskrypcji. Przed wdrożeniem należy sprawdzić kod i testy, zaktualizować STAGING, zweryfikować origin `https://localhost` i dopiero wtedy wdrażać LIVE.

### Natywne zachowanie APK

W pakiecie Android używana jest własna ikona oraz ekran startowy wygenerowane z logo SVG NAPRAWNIKA. Systemowy przycisk Wstecz obsługuje otwarte widoki, zewnętrzne instrukcje serwisowe otwierają się w karcie przeglądarki, a eksporty JSON korzystają z systemowego okna Udostępnij/Zapisz. Dane eksportowane są przygotowywane lokalnie i nie są samoczynnie wysyłane na serwer.
