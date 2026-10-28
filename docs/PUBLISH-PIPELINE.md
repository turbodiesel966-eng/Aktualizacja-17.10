# Publikacja NAPRAWNIKA — WWW + APK

## Codzienny sposób pracy

1. Wprowadź zmiany w kodzie projektu.
2. Zapisz je i wypchnij/połącz na gałęzi `main` (czyli opublikuj zmiany).
3. GitHub Pages aktualizuje wersję WWW, a workflow **Publish NAPRAWNIK Web + APK** buduje i weryfikuje APK oraz publikuje plik APK i sumę SHA-256 na stronie Cloudflare Pages.

Workflow można też uruchomić ręcznie z GitHub → Actions → **Publish NAPRAWNIK Web + APK** → **Run workflow**.

## Jednorazowa konfiguracja Cloudflare

W repozytorium GitHub otwórz Settings → Secrets and variables → Actions → New repository secret i dodaj:

- Name: `CLOUDFLARE_API_TOKEN`
- Value: token Cloudflare z uprawnieniem do wdrażania Cloudflare Pages (Pages: Edit).

Token nie może być zapisany w kodzie ani w repozytorium. Jeśli sekretu nie ma lub token nie ma właściwych uprawnień, publikacja Cloudflare zakończy się błędem, a workflow pokaże komunikat.

## Ochrona strony pobierania

Przed publikacją skrypt pobiera bieżącą stronę pobierania, zachowuje jej HTML, obrazy, CSS i sekcję VirusTotal, podmienia APK oraz aktualizuje SHA-256. Jeżeli oczekiwane sekcje nie zostaną znalezione, wdrożenie zostanie przerwane zamiast opublikowania niepełnej strony.

Po wymianie APK zrzuty VirusTotal nadal przedstawiają wcześniejszy skan; należy wykonać nowy skan nowego pliku i dopiero wtedy podmienić zrzuty raportu.
