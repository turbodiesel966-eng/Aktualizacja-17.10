/* NAPRAWNIK — centralny katalog techniczny
 * Wersja: 1.0
 * Źródło danych: arkusz „Parametry centralne”.
 * Uwaga: wpisy zachowują status weryfikacji z arkusza; nie traktuj danych
 * oznaczonych do sprawdzenia jako uniwersalnych specyfikacji OEM.
 *
 * Integracja: dołącz ten plik przez <script src="./katalog-techniczny.js"></script>.
 * API: window.NAPRAWNIK_KATALOG.records, .search(query, filters), .getFacets()
 * Plik sam nie zmienia interfejsu aplikacji.
 */
(function (global) {
  "use strict";

  const records = [
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator",
    "Wartość": "400–600",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Przykład dla wskazanej wersji YQ50; sprawdzić kod modelu."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka zasilająca CDI",
    "Wartość": "640–960",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Pomiar według wskazanych przewodów w instrukcji."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — uzwojenie pierwotne",
    "Wartość": "0,56–0,84",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Bardzo niski zakres; skompensować rezystancję przewodów miernika."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — uzwojenie wtórne",
    "Wartość": "5,68–8,52",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Sprawdzić, czy pomiar wykonywany jest z fajką czy bez."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka oświetlenia — uzwojenie 1",
    "Wartość": "0,32–0,48",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Pomiar według pinów w instrukcji."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka oświetlenia — uzwojenie 2",
    "Wartość": "0,48–0,72",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Pomiar według pinów w instrukcji."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Napięcie regulowane bez obciążenia",
    "Wartość": "13–14",
    "Jednostka": "V",
    "Warunki pomiaru / zastosowania": "Warunki testu wg instrukcji",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Nie traktować jako uniwersalnego zakresu ładowania."
  },
  {
    "Rodzina": "Yamaha",
    "Model / kod silnika": "Aerox YQ50 (wersja instrukcji 1997)",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Minimalna długość iskry w testerze",
    "Wartość": "6",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Test iskry specjalnym testerem",
    "Status weryfikacji": "Dokumentacja modelowa — sprawdzić rocznik/wariant",
    "Źródło (URL)": "https://scootergrisen.org/scooterhjemmeside/download/yamaha_aerox_servicemanual.pdf",
    "Uwagi / ograniczenia": "Nie jest to szczelina świecy."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Cewka WN — uzwojenie pierwotne",
    "Wartość": "0,1–1,0",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Wg podręcznika",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Zakres z podręcznika GY6; potwierdzić kod silnika."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Cewka WN — wtórne z fajką",
    "Wartość": "7–9",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "Wg podręcznika",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Pomiar z fajką."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Cewka WN — wtórne bez fajki",
    "Wartość": "3–4",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "Wg podręcznika",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Pomiar bez fajki."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Impulsator",
    "Wartość": "1–10",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Wg tabeli podręcznika",
    "Status weryfikacji": "Wymaga ponownej weryfikacji",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Wartość nietypowa i potencjalnie niejednoznaczna; NIE używać jako normy produkcyjnej bez ponownej weryfikacji skanu/wersji."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Napięcie szczytowe cewki zapłonowej",
    "Wartość": ">120",
    "Jednostka": "V",
    "Warunki pomiaru / zastosowania": "Pomiar peak-voltage adapterem",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Nie mierzyć zwykłym multimetrem bez odpowiedniej procedury."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Napięcie szczytowe impulsatora",
    "Wartość": ">2,1",
    "Jednostka": "V",
    "Warunki pomiaru / zastosowania": "Pomiar peak-voltage adapterem",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Warunki testu wg instrukcji."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Elektryka",
    "Parametr": "Szczelina świecy",
    "Wartość": "0,6–0,7",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Pomiar szczelinomierzem",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Dotyczy podręcznika 50cc GY6."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Mechanika",
    "Parametr": "Luz zaworu ssącego",
    "Wartość": "0,06",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Wg podręcznika 139QMA/139QMB",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Zimny silnik / procedura wg instrukcji."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Mechanika",
    "Parametr": "Luz zaworu wydechowego",
    "Wartość": "0,08",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Wg podręcznika 139QMA/139QMB",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Zimny silnik / procedura wg instrukcji."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Mechanika",
    "Parametr": "Średnica cylindra — standard",
    "Wartość": "39,00–39,01",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Wg podręcznika 139QMA/139QMB",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Wymaga pomiaru w miejscach opisanych w instrukcji."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Mechanika",
    "Parametr": "Średnica cylindra — granica",
    "Wartość": "39,10",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Limit zużycia",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Wg podręcznika 139QMA/139QMB."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Mechanika",
    "Parametr": "Nakrętki głowicy M7",
    "Wartość": "16–18",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment dokręcania",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Tylko po potwierdzeniu wersji i procedury."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "50 cm³ 139QMA/139QMB",
    "Układ": "Mechanika",
    "Parametr": "Nakrętka kontrująca regulację zaworów",
    "Wartość": "9",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment dokręcania",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://www.49ccscoot.com/manuals/50cc_GY6_Service_Manual.pdf",
    "Uwagi / ograniczenia": "Tylko dla wskazanego podręcznika."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "125/150 cm³ 152QMI/157QMJ",
    "Układ": "Mechanika",
    "Parametr": "Śruba wałka rozrządu",
    "Wartość": "16 ft·lbf ≈ 21,7",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment z podręcznika",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://bradsscooters.com/wp-content/uploads/2019/10/150cc-Gy6-QMJ157-Scooter-Repair-and-Service-Manual.pdf",
    "Uwagi / ograniczenia": "Nie przenosić na wszystkie warianty GY6."
  },
  {
    "Rodzina": "GY6",
    "Model / kod silnika": "125/150 cm³ 152QMI/157QMJ",
    "Układ": "Mechanika",
    "Parametr": "Korek regulacji zaworów",
    "Wartość": "7 ft·lbf ≈ 9,5",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment z podręcznika",
    "Status weryfikacji": "Dane podręcznika — OEM niepotwierdzone",
    "Źródło (URL)": "https://bradsscooters.com/wp-content/uploads/2019/10/150cc-Gy6-QMJ157-Scooter-Repair-and-Service-Manual.pdf",
    "Uwagi / ograniczenia": "Nie przenosić na wszystkie warianty GY6."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50 — stator FACIND",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator / pickup",
    "Wartość": "110",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Przewody wskazane w instrukcji; odchylenie ok. ±10% wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://scf99fe700a0cb239.jimcontent.com/download/version/1582706086/module/12580877626/name/Minarelli%20MA50%20Engine%20Service%20Manual.pdf",
    "Uwagi / ograniczenia": "Nie uśredniać między typami zapłonu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50 — stator FACIND",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka zasilająca / charge coil",
    "Wartość": "600",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Przewody wskazane w instrukcji; odchylenie ok. ±10% wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://scf99fe700a0cb239.jimcontent.com/download/version/1582706086/module/12580877626/name/Minarelli%20MA50%20Engine%20Service%20Manual.pdf",
    "Uwagi / ograniczenia": "Nie uśredniać między typami zapłonu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50 — stator MORYAMA",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator / pickup",
    "Wartość": ">500",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Przewody wskazane w instrukcji; odchylenie ok. ±10% wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://scf99fe700a0cb239.jimcontent.com/download/version/1582706086/module/12580877626/name/Minarelli%20MA50%20Engine%20Service%20Manual.pdf",
    "Uwagi / ograniczenia": "Nie uśredniać między typami zapłonu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50 — stator MORYAMA",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka zasilająca / charge coil",
    "Wartość": ">830",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Przewody wskazane w instrukcji; odchylenie ok. ±10% wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://scf99fe700a0cb239.jimcontent.com/download/version/1582706086/module/12580877626/name/Minarelli%20MA50%20Engine%20Service%20Manual.pdf",
    "Uwagi / ograniczenia": "Nie uśredniać między typami zapłonu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50 — stator DUCATI",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator / pickup",
    "Wartość": "120",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Przewody wskazane w instrukcji; odchylenie ok. ±10% wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://scf99fe700a0cb239.jimcontent.com/download/version/1582706086/module/12580877626/name/Minarelli%20MA50%20Engine%20Service%20Manual.pdf",
    "Uwagi / ograniczenia": "Nie uśredniać między typami zapłonu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50 — stator DUCATI",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka zasilająca / charge coil",
    "Wartość": "720",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Przewody wskazane w instrukcji; odchylenie ok. ±10% wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://scf99fe700a0cb239.jimcontent.com/download/version/1582706086/module/12580877626/name/Minarelli%20MA50%20Engine%20Service%20Manual.pdf",
    "Uwagi / ograniczenia": "Nie uśredniać między typami zapłonu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50",
    "Układ": "Mechanika",
    "Parametr": "Luz osiowy główki korbowodu",
    "Wartość": "0,20–0,50",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Procedura pomiarowa wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://it.scribd.com/document/39905703/Minarelli-MA50-MY50-Manual",
    "Uwagi / ograniczenia": "Dotyczy opisanej procedury."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "MA50/MY50",
    "Układ": "Mechanika",
    "Parametr": "Granica bicia półosi wału",
    "Wartość": "0,03",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Pomiar czujnikiem zegarowym wg instrukcji",
    "Status weryfikacji": "Dane instrukcji serwisowej",
    "Źródło (URL)": "https://it.scribd.com/document/39905703/Minarelli-MA50-MY50-Manual",
    "Uwagi / ograniczenia": "Dotyczy opisanego pomiaru."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Świeca M14 × 1,25",
    "Wartość": "20–25",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Nakrętki głowicy M7",
    "Wartość": "14–16",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Króciec głowicy M8",
    "Wartość": "24–26",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Czujnik temperatury M14",
    "Wartość": "16–20",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Nakrętka wałka pośredniego M12",
    "Wartość": "45–50",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruby pompy wody M6",
    "Wartość": "4–6",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruby pompy oleju M5",
    "Wartość": "6–8",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Mocowanie króćca dolotowego M6",
    "Wartość": "9–11",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruby karteru M6 po stronie koła magnesowego",
    "Wartość": "10–12",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "Minarelli",
    "Model / kod silnika": "AM6 — wersja podręcznika 2006",
    "Układ": "Momenty dokręcania",
    "Parametr": "Nakrętka koła magnesowego M10",
    "Wartość": "43–45",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Moment wg instrukcji AM6",
    "Status weryfikacji": "Dane z podręcznika — sprawdzić wariant",
    "Źródło (URL)": "https://www.scribd.com/document/924897354/AM6-2006",
    "Uwagi / ograniczenia": "Nie stosować bez sprawdzenia rocznika i procedury gwintu."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — uzwojenie pierwotne",
    "Wartość": "0,153–0,187",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Pomiar między zaciskami pierwotnymi."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — wtórne z fajką",
    "Wartość": "10–14",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Pomiar z fajką."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — wtórne bez fajki",
    "Wartość": "7–9",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Pomiar bez fajki."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator",
    "Wartość": "100–150",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Pomiar między przewodem blue/yellow a masą wg strony serwisowej."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka ładowania",
    "Wartość": "0,4",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Biały–zielony, wg instrukcji",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Wynik bardzo niski; uwzględnić przewody miernika."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka oświetlenia",
    "Wartość": "0,3",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Żółty–zielony, wg instrukcji",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Wynik bardzo niski; uwzględnić przewody miernika."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Napięcie graniczne regulatora",
    "Wartość": "14,5 ± 0,5",
    "Jednostka": "V",
    "Warunki pomiaru / zastosowania": "8000 obr./min",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Procedura testu ładowania wg instrukcji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Prąd ładowania — dzień",
    "Wartość": "min. 1,3",
    "Jednostka": "A",
    "Warunki pomiaru / zastosowania": "2500 obr./min",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Warunki pomiaru wg instrukcji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Prąd ładowania — noc",
    "Wartość": "min. 1,0 A",
    "Jednostka": "A",
    "Warunki pomiaru / zastosowania": "2500 obr./min",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Warunki pomiaru wg instrukcji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Prąd ładowania",
    "Wartość": "min. 2,0 A",
    "Jednostka": "A",
    "Warunki pomiaru / zastosowania": "6000 obr./min",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Wartość dotyczy zarówno dnia, jak i nocy (wg instrukcji)."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T",
    "Układ": "Serwis",
    "Parametr": "Szczelina świecy",
    "Wartość": "0,6–0,7",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Świeca BR8HSA",
    "Status weryfikacji": "Instrukcja modelowa — zweryfikować rocznik",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-Manual/like-50-2T-1-Workshop-manual/page168",
    "Uwagi / ograniczenia": "Zgodność modelowa."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T (zakres roczników strony 2010–2014)",
    "Układ": "Momenty dokręcania",
    "Parametr": "Świeca zapłonowa",
    "Wartość": "11–17",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Warunki gwintu: czyste/suche, chyba że podano inaczej",
    "Status weryfikacji": "Wtórne zestawienie danych serwisowych — potwierdzić w instrukcji OEM",
    "Źródło (URL)": "https://kymcopartsstore.com/blogs/guides/like-50-2t-service-specs",
    "Uwagi / ograniczenia": "Nie przenosić na inne modele/roczniki bez weryfikacji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T (zakres roczników strony 2010–2014)",
    "Układ": "Momenty dokręcania",
    "Parametr": "Korek spustowy przekładni",
    "Wartość": "18–22",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Warunki gwintu: czyste/suche, chyba że podano inaczej",
    "Status weryfikacji": "Wtórne zestawienie danych serwisowych — potwierdzić w instrukcji OEM",
    "Źródło (URL)": "https://kymcopartsstore.com/blogs/guides/like-50-2t-service-specs",
    "Uwagi / ograniczenia": "Nie przenosić na inne modele/roczniki bez weryfikacji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T (zakres roczników strony 2010–2014)",
    "Układ": "Momenty dokręcania",
    "Parametr": "Nakrętka wariatora / drive face",
    "Wartość": "49–59",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Warunki gwintu: czyste/suche, chyba że podano inaczej",
    "Status weryfikacji": "Wtórne zestawienie danych serwisowych — potwierdzić w instrukcji OEM",
    "Źródło (URL)": "https://kymcopartsstore.com/blogs/guides/like-50-2t-service-specs",
    "Uwagi / ograniczenia": "Nie przenosić na inne modele/roczniki bez weryfikacji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T (zakres roczników strony 2010–2014)",
    "Układ": "Momenty dokręcania",
    "Parametr": "Nakrętka dzwonu sprzęgła",
    "Wartość": "34–44",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Warunki gwintu: czyste/suche, chyba że podano inaczej",
    "Status weryfikacji": "Wtórne zestawienie danych serwisowych — potwierdzić w instrukcji OEM",
    "Źródło (URL)": "https://kymcopartsstore.com/blogs/guides/like-50-2t-service-specs",
    "Uwagi / ograniczenia": "Nie przenosić na inne modele/roczniki bez weryfikacji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T (zakres roczników strony 2010–2014)",
    "Układ": "Momenty dokręcania",
    "Parametr": "Oś przednia",
    "Wartość": "49–69",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Warunki gwintu: czyste/suche, chyba że podano inaczej",
    "Status weryfikacji": "Wtórne zestawienie danych serwisowych — potwierdzić w instrukcji OEM",
    "Źródło (URL)": "https://kymcopartsstore.com/blogs/guides/like-50-2t-service-specs",
    "Uwagi / ograniczenia": "Nie przenosić na inne modele/roczniki bez weryfikacji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Like 50 2T (zakres roczników strony 2010–2014)",
    "Układ": "Momenty dokręcania",
    "Parametr": "Oś tylna",
    "Wartość": "108–127",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Warunki gwintu: czyste/suche, chyba że podano inaczej",
    "Status weryfikacji": "Wtórne zestawienie danych serwisowych — potwierdzić w instrukcji OEM",
    "Źródło (URL)": "https://kymcopartsstore.com/blogs/guides/like-50-2t-service-specs",
    "Uwagi / ograniczenia": "Nie przenosić na inne modele/roczniki bez weryfikacji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Super 8 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — uzwojenie pierwotne",
    "Wartość": "0,153–0,187",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Wymaga sprawdzenia zgodności tabeli/rocznika",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-manual/super-8-50-2t-1-Workshop-manual/page14",
    "Uwagi / ograniczenia": "Wartość ze strony podręcznika; weryfikować stronę/wersję."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Super 8 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — wtórne z fajką",
    "Wartość": "6,99–10,21",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "Wg tabeli strony 14",
    "Status weryfikacji": "Wymaga sprawdzenia zgodności tabeli/rocznika",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-manual/super-8-50-2t-1-Workshop-manual/page14",
    "Uwagi / ograniczenia": "Wartość różni się od innej strony podręcznika, gdzie podano 10–14 kΩ; wymaga weryfikacji modelu/wersji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Super 8 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — wtórne bez fajki",
    "Wartość": "3,24–3,96",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "Wg tabeli strony 14",
    "Status weryfikacji": "Wymaga sprawdzenia zgodności tabeli/rocznika",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-manual/super-8-50-2t-1-Workshop-manual/page14",
    "Uwagi / ograniczenia": "Wartość różni się od innej strony podręcznika, gdzie podano 7–9 kΩ; wymaga weryfikacji modelu/wersji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Super 8 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator",
    "Wartość": "80–160",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "20°C",
    "Status weryfikacji": "Wymaga sprawdzenia zgodności tabeli/rocznika",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-manual/super-8-50-2t-1-Workshop-manual/page14",
    "Uwagi / ograniczenia": "Wartość ze strony podręcznika."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Super 8 50 2T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Szczelina świecy",
    "Wartość": "0,6–0,7",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Wymaga sprawdzenia zgodności tabeli/rocznika",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-manual/super-8-50-2t-1-Workshop-manual/page14",
    "Uwagi / ograniczenia": "Sprawdzić właściwą świecę dla wersji."
  },
  {
    "Rodzina": "KYMCO",
    "Model / kod silnika": "Super 8 50 2T",
    "Układ": "Zapłon",
    "Parametr": "Wyprzedzenie zapłonu",
    "Wartość": "13,5° ± 1°",
    "Jednostka": "przed GMP",
    "Warunki pomiaru / zastosowania": "2000 obr./min",
    "Status weryfikacji": "Dane tabeli serwisowej — potwierdzić wariant",
    "Źródło (URL)": "https://www.bike-parts-kymco.uk/catalog/Workshop-manual/super-8-50-2t-1-Workshop-manual/page14",
    "Uwagi / ograniczenia": "Wartość odczytana z tabeli parametrów."
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 50 2T (w tym PureJet)",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek napędowy — granica",
    "Wartość": "17,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał w tabeli: 15 000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 50 2T (w tym PureJet)",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Rolki wariatora — granica",
    "Wartość": "18,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": ""
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 50 2T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek pompy oleju — interwał",
    "Wartość": "20 000",
    "Jednostka": "km",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Tabela podaje interwał; brak wymiaru granicznego"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 50 4T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pojemność oleju",
    "Wartość": "850",
    "Jednostka": "cm³",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "W tabeli; sprawdzić model"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 50 4T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek napędowy — granica",
    "Wartość": "17,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał: 12 000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 50 4T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Rolki wariatora — nowy wymiar / granica",
    "Wartość": "18,9 / 18,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Nowy wymiar / limit"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 2T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek napędowy — granica",
    "Wartość": "21,0",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał: 12 000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 2T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Rolki wariatora — granica",
    "Wartość": "18,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": ""
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 2T",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek pompy oleju — interwał",
    "Wartość": "30 000",
    "Jednostka": "km",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": ""
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 4T original",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pojemność oleju",
    "Wartość": "850",
    "Jednostka": "cm³",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał oleju w tabeli: 5000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 4T original",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek napędowy — granica",
    "Wartość": "17,2",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał: 10 000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 4T Leader",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pojemność oleju",
    "Wartość": "1",
    "Jednostka": "l",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał oleju w tabeli: 6000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 4T Leader",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Pasek napędowy — nowy wymiar / granica",
    "Wartość": "22,5 / 21,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Interwał: 12 000 km"
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 4T Leader",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Rolki wariatora — nowy wymiar / granica",
    "Wartość": "19,0 / 18,5",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": ""
  },
  {
    "Rodzina": "Piaggio",
    "Model / kod silnika": "Piaggio 125 (wersja tabeli)",
    "Układ": "CVT / serwis / mechanika",
    "Parametr": "Tarcza hamulcowa przednia — nowa/granica",
    "Wartość": "4,00 / 3,50",
    "Jednostka": "mm",
    "Warunki pomiaru / zastosowania": "Tabela techniczna Piaggio; model/rocznik do przypisania",
    "Status weryfikacji": "Zestawienie techniczne — nie jest samodzielną specyfikacją modelową",
    "Źródło (URL)": "https://www.scribd.com/doc/20596740/Piaggio-Tech-Manuals",
    "Uwagi / ograniczenia": "Dokładny model wymaga przypisania"
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Impulsator",
    "Wartość": "250 ±20%",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Derbi Senda 125 4T, wersja instrukcji."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka zasilająca CDI",
    "Wartość": "860 ±20%",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Derbi Senda 125 4T, wersja instrukcji."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — pierwotne",
    "Wartość": "0,3 ±10%",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Derbi Senda 125 4T, wersja instrukcji."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka WN — wtórne",
    "Wartość": "3,16 ±10%",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Derbi Senda 125 4T, wersja instrukcji."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Fajka świecy",
    "Wartość": "5 ±20%",
    "Jednostka": "kΩ",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Zapis źródłowy interpretuje wartość jako 5 kΩ ±20%."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Cewka ładowania",
    "Wartość": "0,4 ±20%",
    "Jednostka": "Ω",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Pomiar wg wskazanych przewodów."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Napięcie ładowania",
    "Wartość": "14–15",
    "Jednostka": "V",
    "Warunki pomiaru / zastosowania": "Wg instrukcji",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Warunki pomiaru zależne od procedury serwisowej."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Elektryka / zapłon",
    "Parametr": "Napięcie szczytowe impulsatora",
    "Wartość": "min. 0,7",
    "Jednostka": "V",
    "Warunki pomiaru / zastosowania": "Pomiar napięcia szczytowego",
    "Status weryfikacji": "Dane instrukcji modelowej — sprawdzić wariant",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Wymaga odpowiedniego adaptera."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Mechanika",
    "Parametr": "Luz zaworu ssącego",
    "Wartość": "Niepotwierdzone — nie stosować",
    "Jednostka": "—",
    "Warunki pomiaru / zastosowania": "Brak potwierdzenia w dokumentacji Derbi; nie używać do regulacji",
    "Status weryfikacji": "Niepotwierdzone — dane z innego modelu",
    "Źródło (URL)": "",
    "Uwagi / ograniczenia": "Wcześniejsza wartość pochodzi z instrukcji Beverly 125 4T, nie Derbi Senda 125 4T. Wymaga potwierdzenia w DTR właściwego wariantu."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T",
    "Układ": "Mechanika",
    "Parametr": "Luz zaworu wydechowego",
    "Wartość": "Niepotwierdzone — nie stosować",
    "Jednostka": "—",
    "Warunki pomiaru / zastosowania": "Brak potwierdzenia w dokumentacji Derbi; nie używać do regulacji",
    "Status weryfikacji": "Niepotwierdzone — dane z innego modelu",
    "Źródło (URL)": "",
    "Uwagi / ograniczenia": "Wcześniejsza wartość pochodzi z instrukcji Beverly 125 4T, nie Derbi Senda 125 4T. Wymaga potwierdzenia w DTR właściwego wariantu."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T — tabela ogólna mocowań",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruba/nakrętka M5",
    "Wartość": "5",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Ogólna tabela w instrukcji",
    "Status weryfikacji": "Nie stosować automatycznie do każdego połączenia",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Moment zależy od elementu, klasy śruby i procedury."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T — tabela ogólna mocowań",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruba/nakrętka M6",
    "Wartość": "10",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Ogólna tabela w instrukcji",
    "Status weryfikacji": "Nie stosować automatycznie do każdego połączenia",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Moment zależy od elementu, klasy śruby i procedury."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T — tabela ogólna mocowań",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruba/nakrętka M8",
    "Wartość": "22",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Ogólna tabela w instrukcji",
    "Status weryfikacji": "Nie stosować automatycznie do każdego połączenia",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Moment zależy od elementu, klasy śruby i procedury."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T — tabela ogólna mocowań",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruba/nakrętka M10",
    "Wartość": "34",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Ogólna tabela w instrukcji",
    "Status weryfikacji": "Nie stosować automatycznie do każdego połączenia",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Moment zależy od elementu, klasy śruby i procedury."
  },
  {
    "Rodzina": "Derbi",
    "Model / kod silnika": "Senda 125 4T — tabela ogólna mocowań",
    "Układ": "Momenty dokręcania",
    "Parametr": "Śruba/nakrętka M12",
    "Wartość": "54",
    "Jednostka": "Nm",
    "Warunki pomiaru / zastosowania": "Ogólna tabela w instrukcji",
    "Status weryfikacji": "Nie stosować automatycznie do każdego połączenia",
    "Źródło (URL)": "https://www.dealerinfo.net/newsitems/DERBE/DERBE_19627_Wmanualsenda1254t2005y.pdf",
    "Uwagi / ograniczenia": "Moment zależy od elementu, klasy śruby i procedury."
  }
];

  const fields = [
    "Rodzina",
    "Model / kod silnika",
    "Układ",
    "Parametr",
    "Wartość",
    "Jednostka",
    "Warunki pomiaru / zastosowania",
    "Status weryfikacji",
    "Źródło (URL)",
    "Uwagi / ograniczenia"
  ];

  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pl-PL")
      .trim();
  }

  function search(query, filters) {
    const q = normalize(query);
    const f = filters || {};
    return records.filter(function (record) {
      if (f.rodzina && record["Rodzina"] !== f.rodzina) return false;
      if (f.uklad && record["Układ"] !== f.uklad) return false;
      if (f.status && record["Status weryfikacji"] !== f.status) return false;
      if (!q) return true;
      return fields.some(function (field) {
        return normalize(record[field]).includes(q);
      });
    });
  }

  function uniqueSorted(field) {
    return Array.from(new Set(records.map(function (r) {
      return r[field];
    }).filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b, "pl");
    });
  }

  function getFacets() {
    return {
      rodziny: uniqueSorted("Rodzina"),
      uklady: uniqueSorted("Układ"),
      statusy: uniqueSorted("Status weryfikacji")
    };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  global.NAPRAWNIK_KATALOG = Object.freeze({
    version: "1.0",
    records: records,
    search: search,
    normalize: normalize,
    getFacets: getFacets,
    escapeHtml: escapeHtml
  });
})(window);
