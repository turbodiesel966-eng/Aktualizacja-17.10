# NAPRAWNIK — katalog afiliacyjny APK

## Zakres
Moduł jest przygotowany jako osobna warstwa danych dla wydania APK. Nie zawiera loginów, haseł, kluczy API ani automatycznego scrapowania sklepów. Nie zmienia produkcyjnego PWA ani gałęzi `main`.

## Stan partnerów
- **Motolak** — zachowany istniejący link WebePartners: `https://webep1.com/go/37a852f559`. Link jest znany z wcześniejszej integracji; nie oznacza to weryfikacji aktualnych produktów, cen ani dostępności feedu.
- **Tooles.pl, TopBuy.eu, eTOMNAR** — zapisane jako partnerzy do weryfikacji. Nie ma jeszcze potwierdzonych linków ani danych ofert, więc nie pokazujemy fikcyjnych produktów.

## Import ofert
Po uzyskaniu dostępu do WebePartners należy pobrać wyłącznie udostępnione dla konta feedy CSV/XML. Przed publikacją:
1. potwierdzić akceptację programu,
2. zweryfikować docelowy URL HTTPS i merchantId,
3. zweryfikować kategorię,
4. nie uzupełniać brakujących cen, zdjęć ani opisów zgadywaniem,
5. odrzucać rekordy partnerów bez statusu `verified`.

## Kontrakt danych
Źródło ofert: `catalog.json`. Do publikacji oferty wymagane są: `title`, `merchantId`, `categoryId`, `affiliateUrl`. Cena, zdjęcie i opis są opcjonalne. Waluta obsługiwana w pierwszym etapie: PLN.

## Moduł JS
`catalog.js` udostępnia:
- `safeAffiliateUrl(url)` — dopuszcza tylko HTTPS na domenie WebePartners,
- `normalizeOffer(raw, merchants, categories)` — waliduje i normalizuje rekord, ale tylko dla partnera ze statusem `verified`,
- `filterOffers(offers, query, categoryId)` — filtruje zatwierdzone oferty.

## Następny krok wymagający konta
Po powrocie do komputera zalogować się samodzielnie do WebePartners i pobrać feedy/linki dla zaakceptowanych programów. Nie przesyłać hasła ani kodów 2FA w czacie. Dopiero wtedy można oznaczyć partnera jako `verified` i dodać rzeczywiste oferty.
