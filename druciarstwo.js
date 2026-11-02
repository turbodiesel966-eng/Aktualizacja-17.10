/* NAPRAWNIK — DRUCIARSTWO ULTIMATE
 * „Nie masz części? Nie masz kasy? Masz garaż. Kombinuj!”
 * Kompletny moduł kreatywnych napraw garażowych, generatora Janusz 3000 i recyklingu warsztatowego.
 */
(function (global) {
  "use strict";

  // --- SKALA DRUCIARSTWA (KREATYWNOŚCI 1–5) ---
  const LEVELS = {
    1: { id: 1, name: 'SPRYTNE', icon: '💡', badgeColor: '#10b981', desc: 'Prosty, sprytny sposób wykorzystania dostępnych materiałów bez ruszania geometrii.' },
    2: { id: 2, name: 'GARAŻOWE', icon: '🔧', badgeColor: '#3b82f6', desc: 'Klasyczna garażowa rzeźba wymagająca pracy ręcznej, pilnika lub podstawowych narzędzi.' },
    3: { id: 3, name: 'CO TU SIĘ ODPIERDALA?', icon: '🤯', badgeColor: '#f59e0b', desc: 'Bardzo niekonwencjonalna konstrukcja na granicy inżynieryjnego geniuszu i czystego szaleństwa.' },
    4: { id: 4, name: 'EKSPERYMENT', icon: '🧪', badgeColor: '#ec4899', desc: 'Projekt eksperymentalny. Wymaga regularnej inspekcji, testów i ostrożności.' },
    5: { id: 5, name: 'GARAŻOWA LEGENDA', icon: '🏆', badgeColor: '#ffd700', desc: 'Patent owiany legendą wśród starych mechaników i na forach. Działa wbrew prawom fizyki.' }
  };

  // --- SYSTEM BEZPIECZEŃSTWA (CZERWONA LINIA) ---
  const SAFETY = {
    safe: { code: 'safe', label: 'BEZPIECZNA NAPRAWA', icon: '🟢', color: '#10b981', desc: 'Metoda zdatna do stałego lub długiego użytku bez ryzyka wypadku.' },
    temp: { code: 'temp', label: 'TYMCZASOWE (DOJAZD)', icon: '🟡', color: '#f59e0b', desc: 'Wyłącznie dojazd awaryjny do bazy / sklepu z umiarkowaną prędkością.' },
    exp: { code: 'exp', label: 'EKSPERYMENT GARAŻOWY', icon: '🟠', color: '#f97316', desc: 'Wymaga wzmożonej uwagi. Nie jest zatwierdzoną naprawą serwisową.' },
    bench: { code: 'bench', label: 'NIE DO JAZDY (STACJONARNE)', icon: '🔴', color: '#ef4444', desc: 'Tylko do diagnostyki warsztatowej na stole lub postoju.' },
    danger: { code: 'danger', label: 'CZERWONA LINIA / ZABRONIONE', icon: '⛔', color: '#b91c1c', desc: 'Zagrożenie wypadkiem lub pożarem! Wyjaśnia, jakich prowizorek NIGDY nie wolno robić.' }
  };

  // --- KATEGORIE PATENTÓW ---
  const CATEGORIES = {
    dtt: { id: 'dtt', name: 'Drut, Trytytka i Taśma', icon: '🪢', color: '#06b6d4', desc: 'Szybkie wiązania, mocowania, adaptery i usztywnienia z materiałów elastycznych.' },
    met: { id: 'met', name: 'Rzeźba w Metalu', icon: '⚙️', color: '#94a3b8', desc: 'Dorabianie uchwytów, klinów, tulejek, ratowanie zerwanych gwintów i frezów.' },
    pla: { id: 'pla', name: 'Plastikowa Inżynieria', icon: '🧩', color: '#8b5cf6', desc: 'Zgrzewanie owiewek, wtapianie zbrojeń, spawanie chemiczne i klejenie kompozytowe.' },
    nar: { id: 'nar', name: 'Narzędzia z Niczego', icon: '🔨', color: '#f59e0b', desc: 'Samodzielnie wykonane ściągacze, blokady napędu, ściski sprężyn i przyrządy pomiarowe.' },
    sil: { id: 'sil', name: 'Patenty na Silnik', icon: '🔥', color: '#ef4444', desc: 'Ratowanie uszczelek, udrażnianie dysz, awaryjne linki i uszczelnienia karteru.' },
    abs: { id: 'abs', name: 'Absurdalne Patenty', icon: '⚡', color: '#ec4899', desc: 'Rozwiązania tak absurdalne, że aż działają — dla prawdziwych wirtuozów szlifierki.' }
  };

  // --- BAZA WIEDZY PATENTÓW (BUILT-IN) ---
  const BUILTIN_PATENTS = [
    // 1. DRUT, TRYTYTKA I TAŚMA
    {
      id: 'dtt-01',
      category: 'dtt',
      title: 'Pancerz i uszczelka tłumika z puszki po napoju',
      subtitle: 'Nieszczelne połączenie wydechu z cylindrem lub kolankiem tłumika',
      level: 1,
      safety: 'safe',
      cost: '0 zł',
      time: '15 min',
      rating: 4.8,
      votes: 142,
      vehicle: '2T / 4T Skuter, Motorower',
      materials: ['Puszka aluminiowa po napoju', 'Opaska zaciskowa (cybant) lub stalowy drut', 'Pasta do wydechów lub pasta do zębów z popiołem drzewnym'],
      tools: ['Nożyczki warsztatowe do blachy / mocne nożyce', 'Śrubokręt płaski'],
      description: 'Gdy wydmucha uszczelkę na łączeniu kolanka z tłumikiem, spaliny ryczą i brudzą silnik olejem. Aluminium z puszki ma idealną plastyczność i pod wpływem temperatury doszczelnia złącze.',
      instructions: [
        'Rozetnij puszkę wzdłuż, odetnij denko i wieczko, uzyskując gładki pas miękkiej blachy.',
        'Oczyść szczotką drucianą powierzchnię rury wydechowej z nagaru i luźnej rdzy.',
        'Nawiń 2–3 warstwy blachy aluminiowej ciasno wokół rury w miejscu połączenia.',
        'Wsuń końcówkę tłumika na przygotowaną tulejkę — blacha skasuje luz z dokładnością do 0.2 mm.',
        'Zaciśnij mocno opaską zaciskową (cybantem). Po rozgrzaniu aluminium lekko spęcznieje, zamykając mikroszczeliny.'
      ],
      durability: 'Trzyma bez problemu 1000–3000 km, często szczelniejsze niż tanie uszczelki grafitowe.',
      limits: 'Nie montować bezpośrednio pod szpilki głowicy bez pasty uszczelniającej (temperatura gazów >550°C).',
      testMethod: 'Zatkaj szmatą wylot tłumika na wolnych obrotach — silnik powinien natychmiast zgasnąć, brak przedmuchów na łączeniu.',
      isTested: true
    },
    {
      id: 'dtt-02',
      category: 'dtt',
      title: 'Podwieszenie urwanego wydechu na wieszaku z pralni',
      subtitle: 'Pęknięte ucho mocowania tłumika do karteru w trasie',
      level: 1,
      safety: 'temp',
      cost: '0 zł',
      time: '10 min',
      rating: 4.6,
      votes: 98,
      vehicle: 'Każdy skuter / motorower',
      materials: ['Stalowy drut z wieszaka na ubrania (ok. 2–3 mm)', 'Kawałek starej dętki rowerowej jako tłumik drgań'],
      tools: ['Kombinerki lub szczypce uniwersalne'],
      description: 'Wibracje 2T/4T często urywają aluminiowe ucha tłumika. Jazda z wiszącym wydechem natychmiast wyłamuje szpilki w cylindrze!',
      instructions: [
        'Rozprostuj stalowy wieszak pralniczy kombinerkami.',
        'Owiń rurę wydechu gumą z dętki (aby drut nie dzwonił o puszkę tłumika).',
        'Przełóż drut pod tłumikiem i złap za ramę lub mocowanie amortyzatora.',
        'Skręć końce drutu kombinerkami za pomocą warkocza, uzyskując mocne napięcie podtrzymujące wagę wydechu.'
      ],
      durability: 'Dojazd do domu lub warsztatu (50–100 km). Unikać skakania po krawężnikach.',
      limits: 'Guma z dętki może dymić przy bezpośrednim kontakcie z gorącą rurą — nawijaj tylko w rejonie puszki tłumika.',
      testMethod: 'Szarpnij tłumik dłonią — nie może mieć luzu góra-dół.',
      isTested: true
    },
    {
      id: 'dtt-03',
      category: 'dtt',
      title: 'Szyna z dwóch trytytek i klucza imbusowego na złamaną klamkę',
      subtitle: 'Złamana dźwignia tylnego hamulca lub sprzęgła w lesie / trasie',
      level: 2,
      safety: 'temp',
      cost: '0 zł',
      time: '10 min',
      rating: 4.5,
      votes: 118,
      vehicle: 'Motorower / Skuter',
      materials: ['Klucz imbusowy 4-5 mm lub gruby gwóźdź', '4–6 mocnych opasek zaciskowych (trytytek)', 'Taśma izolacyjna lub duct tape'],
      tools: ['Kombinerki'],
      description: 'Po wywrotce klamka urywa się przy samej nasadzie i nie ma jak wysprzęglić ani zahamować tylnym kołem, by zjechać do szosy.',
      instructions: [
        'Przyłóż klucz imbusowy od spodu złamanej klamki jako stalową szynę nośną.',
        'Zaciśnij ciasno 4 trytytki naprzemiennie wzdłuż złamania.',
        'Owiń całość ciasno taśmą naprawczą, tworząc chwyt na 2 palce.',
        'Pozwala bezpiecznie naciskać klamkę dwoma palcami i zjechać z trasy.'
      ],
      durability: 'Awaryjny zjazd z trasy do bazy. Wymienić klamkę na nową przed wjechaniem na drogę publiczną!',
      limits: 'Zabronione do szybkiej jazdy szosowej! Nie stosować na przednim hamulcu tarczowym jako stała naprawa.',
      testMethod: 'Naciśnij klamkę na postoju z pełną siłą ręki — szyna nie może się ugiąć ani obrócić.',
      isTested: true
    },
    {
      id: 'dtt-04',
      category: 'dtt',
      title: 'Awaryjna linka gazu ze struny gitarowej E-1 lub drutu MIG',
      subtitle: 'Zerwana linka gazu przy manetce w trasie',
      level: 3,
      safety: 'temp',
      cost: '0–5 zł',
      time: '25 min',
      rating: 4.9,
      votes: 188,
      vehicle: 'Wszystkie pojazdy z gaźnikiem',
      materials: ['Cienka struna gitarowa (wiolinowa E-1 lub H-2) lub drut spawalniczy nierdzewny 0.8 mm', 'Wkład ze skręcanej kostki elektrycznej (baryłka mosiężna ze śrubkami M3)'],
      tools: ['Kombinerki', 'Mały śrubokręt płaski'],
      description: 'Gdy pęknie linka gazu, pojazd stoi. Struna ze stali sprężynowej ma potężną wytrzymałość na zerwanie i idealnie mieści się w fabrycznym pancerzu.',
      instructions: [
        'Wyciągnij resztki zerwanej linki stalowej z pancerza.',
        'Przepuść strunę gitarową przez pancerz od strony manetki w dół do przepustnicy gaźnika.',
        'Na końcu linki w gaźniku zagnij pętelkę lub załóż baryłkę wyjętą ze skręcanej kostki elektrycznej.',
        'Przy manetce zabezpiecz koniec linki drugą baryłką, mocno dokręcając śrubkę M3.',
        'Wpuść 3 krople oleju do pancerza i sprawdź, czy przepustnica płynnie odbija pod wpływem sprężyny.'
      ],
      durability: 'Działa bezawaryjnie nawet kilkaset kilometrów.',
      limits: 'Koniecznie nasmarować wnętrze pancerza olejem, by stalowa struna nie cięła teflonowego wkładu.',
      testMethod: 'Puść gwałtownie manetkę — przepustnica musi natychmiast uderzyć o śrubę wolnych obrotów (wyraźny klik).',
      isTested: true
    },
    {
      id: 'dtt-05',
      category: 'dtt',
      title: 'Opaski zaciskowe jako łańcuchy śniegowe / ratunek ze śliskiego błota',
      subtitle: 'Brak trakcji na lodzie, ubitym śniegu lub w gliniastej mazi',
      level: 2,
      safety: 'temp',
      cost: '2 zł',
      time: '10 min',
      rating: 4.7,
      votes: 130,
      vehicle: 'Skutery i motorowery (koła z hamulcem bębnowym lub wolnymi szprychami)',
      materials: ['10–16 grubych opasek zaciskowych (szerokość 4.8–7.6 mm)'],
      tools: ['Obcinaczki do kabli / kombinerki'],
      description: 'Gdy utkniesz w zimie na lodzie lub w lesie w glinie, opona ślizga się w miejscu. Opaski zaciśnięte na oponie i feldze działają jak kolce i łopatki śniegowe.',
      instructions: [
        'Przełóż opaskę zaciskową przez felgę i zaciśnij na oponie tak, by zamek opaski znajdował się na boku opony (nie na bieżniku!).',
        'Załóż po 6–8 opasek w równych odstępach na tylnym kole napędowym.',
        'Upewnij się, że opaski nie haczą o zacisk hamulcowy, amortyzator ani wahacz!',
        'Ruszaj płynnie — plastikowe paski wgryzają się w lód i błoto z ogromną przyczepnością.'
      ],
      durability: 'Do wyjechania z zaspy lub trudnego terenu (ok. 5–15 km na ubitym śniegu).',
      limits: 'NIE STOSOWAĆ na suchym asfalcie (opaski zetrą się w 300 metrów). Uważać na przewody hamulcowe przy kole!',
      testMethod: 'Zakręć kołem w powietrzu na stopce centralnej — żaden element nie może ocierać.',
      isTested: true
    },

    // 2. RZEŹBA W METALU
    {
      id: 'met-01',
      category: 'met',
      title: 'Klin koła magnesowego dopiłowany z podkładki lub gwoździa',
      subtitle: 'Ścięty klin magneta (Woodruff key), brak iskry we właściwym punkcie',
      level: 2,
      safety: 'safe',
      cost: '0 zł',
      time: '30 min',
      rating: 4.8,
      votes: 175,
      vehicle: 'Silniki 2T i 4T (Minarelli, Piaggio, GY6, AM6, Morini)',
      materials: ['Gruba podkładka stalowa (grubość 2.5–3.0 mm) lub obcięty trzonek gwoździa ciesielskiego'],
      tools: ['Pilnik płaski do metalu', 'Imadło lub szczypce zaciskowe Morse\'a', 'Suwmiarka'],
      description: 'Oryginalny klin to zwykły półksiężyc ze stali miękkiej. Jego jedynym zadaniem jest ustalenie kąta zapłonu przed dociągnięciem — to tarcie stożka przenosi moment obrotowy!',
      instructions: [
        'Zmierz suwmiarką szerokość rowka wpustowego w czopie wału (zwykle 2.5 lub 3.0 mm).',
        'Wytnij z grubej podkładki stalowej mały fragment.',
        'Dopiłuj pilnikiem kształt półksiężyca, sprawdzając spasowanie w rowku wału (musi wchodzić na ciasny wcisk).',
        'Dokładnie odtłuść zmywaczem stożek wału i stożek koła magnesowego.',
        'Załóż magneto i dokręć nakrętkę pełnym momentem dynamometrycznym (35–45 Nm). Tarcie stożka gwarantuje brak ponownego ścięcia.'
      ],
      durability: 'Trwałość identyczna z częścią OEM, o ile stożek wału został prawidłowo odtłuszczony i dociągnięty.',
      limits: 'Nie montować z luzem bocznym. Jeśli rowek wału jest rozbity, klin musi być dopasowany indywidualnie na grubość rowka.',
      testMethod: 'Obróć wałem za koło magnesowe — brak jakiegokolwiek przesunięcia.',
      isTested: true
    },
    {
      id: 'met-02',
      category: 'met',
      title: 'Tulejka dystansowa wariatora z hydraulicznej rurki miedzianej',
      subtitle: 'Brakujące podkładki regulacyjne wariatora, pasek nie wchodzi na dół tulei',
      level: 3,
      safety: 'safe',
      cost: '0–2 zł',
      time: '20 min',
      rating: 4.6,
      votes: 84,
      vehicle: 'Skutery 50cc / 125cc z przekładnią CVT',
      materials: ['Kawałek twardej rurki miedzianej fi 15 mm lub tulejka z główki starego amortyzatora'],
      tools: ['Brzeszczot do metalu', 'Pilnik płaski', 'Suwmiarka'],
      description: 'Regulacja podkładek pod tuleję wariatora wymaga dystansów 0.5–1.2 mm. Zamiast czekać 3 dni na przesyłkę ze sklepu tuningowego, ucięty pierścień z rurki załatwia sprawę od ręki.',
      instructions: [
        'Z rurki miedzianej lub starej tulei odetnij równo pierścień o pożądanej szerokości (np. 1.0 mm).',
        'Wyrównaj krawędzie na pilniku położonym na płaskim stole, obracając pierścień w palcach.',
        'Zmierz suwmiarką w 4 punktach obwodu, aby zapewnić idealną równoległość ścianek.',
        'Załóż podkładkę między przeciwtalerz a wariator, korygując ułożenie paska klinowego na starcie.'
      ],
      durability: 'Miedź jest odporna na ściskanie i nie pęka pod nakrętką wału.',
      limits: 'Ścianki muszą być idealnie równoległe (tolerancja 0.05 mm), inaczej przeciwtalerz dostanie bicia osiowego.',
      testMethod: 'Sprawdź ułożenie paska po montażu — pasek musi leżeć na samym dole tulei wariatora.',
      isTested: true
    },
    {
      id: 'met-03',
      category: 'met',
      title: 'Ratowanie zjechanego wielowypustu kickstartera wkrętem samowiercącym',
      subtitle: 'Kopka omiata wałek, brak możliwości odpalenia silnika z nożnego',
      level: 3,
      safety: 'safe',
      cost: '0.20 zł',
      time: '15 min',
      rating: 4.9,
      votes: 220,
      vehicle: 'Skutery 2T/4T z rozrusznikiem nożnym',
      materials: ['Jeden krótki wkręt samowiercący z łbem sześciokątnym (farmer) lub ucięty kawałek wiertła 3 mm'],
      tools: ['Wkrętarka z wiertełkiem 2.5 mm', 'Klucz nasadowy 8 mm'],
      description: 'Gdy zetrą się drobne frezy na wałku kopnika, ramię obraca się bez oporu. Wkręt wprowadzony na styku działa jak potężny rygiel blokujący obrót.',
      instructions: [
        'Załóż dźwignię kickstartera na wałek w docelowej pozycji roboczej.',
        'Na styku wałka i szczeliny klamry kopnika wywierć wiertłem 2.5 mm otwór wzdłuż osi wałka (w połowie w wałku, w połowie w klamrze).',
        'Wkręć w ten otwór hartowany wkręt farmer lub wbij ucięty trzpień wiertła 3 mm jako kołek ustalający.',
        'Dociągnij mocno śrubę zaciskową klamry kopnika.',
        'Wkręt blokuje obrót z siłą kilkuset niutonometrów — klamka nie przeskoczy nawet przy mocnym kopnięciu.'
      ],
      durability: 'Trzyma latami. Odpala silnik nawet przy kompletnie zjechanym wałku.',
      limits: 'Wkręt nie może wystawać w stronę karteru, by nie ocierać o pokrywę napędu CVT.',
      testMethod: 'Kopnij energicznie z całej siły — klamka musi natychmiast zakręcić wałem bez uślizgu.',
      isTested: true
    },

    // 3. PLASTIKOWA INŻYNIERIA
    {
      id: 'pla-01',
      category: 'pla',
      title: 'Zgrzewanie pękniętych owiewek lutownicą z wtapianiem zszywek',
      subtitle: 'Połamane plastiki czaszy, pęknięte boczki i błotniki',
      level: 2,
      safety: 'safe',
      cost: '0 zł',
      time: '30 min',
      rating: 4.9,
      votes: 340,
      vehicle: 'Wszystkie plastiki ABS / PP w motocyklach i skuterach',
      materials: ['Zszywki biurowe (ze zwykłego zszywacza) lub siatka mosiężna', 'Kawałek starego plastiku ABS (np. zderzaka/obudowy) jako spoiwo'],
      tools: ['Zwykła lutownica transformatorowa lub kolbowa z płaskim grotem', 'Papier ścierny'],
      description: 'Zamiast wydawać 400 zł na nową owiewkę, stalowe zszywki wtapiane na gorąco tworzą wewnętrzne zbrojenie przewyższające wytrzymałością fabryczny plastik.',
      instructions: [
        'Zdejmij owiewkę i dokładnie oczyść i odtłuść pęknięcie od strony wewnętrznej (niewidocznej).',
        'Złóż szczelinę równo i złap punktowo lutownicą na końcach pęknięcia.',
        'Przyłóż zszywkę biurową w poprzek pęknięcia i dociśnij gorącym grotem lutownicy.',
        'Zszywka rozgrzeje się i wtopi w głąb tworzywa na głębokość ok. 1.5 mm.',
        'Przeciągnij stopiony plastik grotem po wierzchu, zalewając zszywkę jak zbrojenie w żelbecie.',
        'Powtarzaj co 1.5 cm wzdłuż całego pęknięcia. Od zewnątrz zaszpachluj lub spoleruj.'
      ],
      durability: 'Wieczna naprawa — plastik pęknie w każdym innym miejscu, ale nigdy w zazbrojonym zszywkami.',
      limits: 'Nie przegrzać na wylot, by nie przypalić lakieru po zewnętrznej stronie owiewki.',
      testMethod: 'Wygnij owiewkę w dłoniach — spoina pracuje elastycznie i nie pęka.',
      isTested: true
    },
    {
      id: 'pla-02',
      category: 'pla',
      title: 'Spawanie chemiczne: Klej cyjanoakrylowy + soda oczyszczona',
      subtitle: 'Urwane uszy montażowe, pęknięte króćce filtra powietrza i mocowania śrub',
      level: 1,
      safety: 'safe',
      cost: '3 zł',
      time: '5 min',
      rating: 4.9,
      votes: 430,
      vehicle: 'Wszystkie elementy z tworzyw i lekkich stopów',
      materials: ['Klej cyjanoakrylowy (Kropelka, Super Glue, Cyjanopan)', 'Zwykła soda oczyszczona spożywcza'],
      tools: ['Brak specjalistycznych narzędzi'],
      description: 'Połączenie cyjanoakrylu z sodą wywołuje błyskawiczną polimeryzację łańcuchową z wydzieleniem ciepła. Tworzy twardy jak granit kompozyt polimerowo-mineralny, który można wiercić i gwintować!',
      instructions: [
        'Ustaw urwany element na swoim miejscu i zalej szczelinę kropelką kleju.',
        'Natychmiast posyp klej obficie suchą sodą oczyszczoną.',
        'W ułamku sekundy dochodzi do reakcji — masa twardnieje na kamień w ciągu 3 sekund!',
        'Zdmuchnij nadmiar sody. Nałóż kolejną warstwę kleju i ponownie zasyp sodą, budując solidną nakładkę wzmacniającą.',
        'Po 2 minutach spoinę można piłować pilnikiem, gwintować lub malować lakierem.'
      ],
      durability: 'Wyjątkowa twardość i pełna odporność na benzynę, oleje i wibracje.',
      limits: 'Reakcja wydziela ciepło i dymek — nie wdychać oparów bezpośrednio nad spoiną!',
      testMethod: 'Spróbuj złamać zrekonstruowane ucho kombinerkami — pęknie obok spoiny.',
      isTested: true
    },
    {
      id: 'pla-03',
      category: 'pla',
      title: 'Filtr powietrza ze zmywaka kuchennego i siatki do herbaty',
      subtitle: 'Sparciała, rozpadająca się gąbka filtra powietrza, brak zamiennika w sklepie',
      level: 2,
      safety: 'safe',
      cost: '2 zł',
      time: '15 min',
      rating: 4.7,
      votes: 160,
      vehicle: 'Wszystkie gaźnikowce 2T i 4T',
      materials: ['Duża gąbka kąpielowa o drobnych porach lub gąbka zmywakowa bez części ściernej', 'Olej do filtrów powietrza lub olej silnikowy 2T/4T'],
      tools: ['Nożyczki', 'Nóż ząbkowany do chleba'],
      description: 'Jazda bez filtra lub ze sparciałą kruszącą się gąbką natychmiast zasysa piasek do cylindra, niszcząc tłok w 50 km. Drobnoziarnista gąbka nasączona olejem filtruje 99% pyłu.',
      instructions: [
        'Wyjmij starą, zniszczoną wkładkę filtrującą z puszki filtra powietrza.',
        'Wytnij nożem ząbkowanym z nowej gąbki kształt odpowiadający obrysowi puszki filtra z naddatkiem 5 mm.',
        'Umyj gąbkę w wodzie z mydłem i dokładnie wysusz.',
        'Wlej 10 ml oleju 2T lub silnikowego na gąbkę i wyciśnij ją w dłoniach w rękawiczce, by była równomiernie wilgotna, ale nie kapała.',
        'Zamontuj w obudowie filtra — silnik zyskuje idealny przepływ i pełną ochronę przed piaskiem.'
      ],
      durability: 'Wytrzymuje normalny okres eksploatacyjny (mycie co 1000–2000 km).',
      limits: 'Nie stosować gąbek o zbyt grubych porach (np. tapicerskich z wielkimi dziurami). Gąbka MUSI być lekko zaolejona!',
      testMethod: 'Sprawdź po 50 km wnętrze gardzieli gaźnika — musi być czysta i pozbawiona kurzu.',
      isTested: true
    },

    // 4. NARZĘDZIA Z NICZEGO
    {
      id: 'nar-01',
      category: 'nar',
      title: 'Ściągacz uszczelniaczy (simeringów) wału z dwóch wkrętów do drewna',
      subtitle: 'Wymiana uszczelniacza wału korbowego bez rozpoławiania karteru',
      level: 1,
      safety: 'safe',
      cost: '0 zł',
      time: '10 min',
      rating: 5.0,
      votes: 310,
      vehicle: 'Każdy silnik spalinowy 2T / 4T',
      materials: ['Dwa cienkie czarne wkręty do płyt gipsowo-kartonowych lub drewna (3.5 x 25 mm)'],
      tools: ['Wkrętak krzyżakowy', 'Kombinerki lub obcęgi'],
      description: 'Wydłubywanie simeringu śrubokrętem niemal ZAWSZE kończy się porysowaniem czopa wału lub gniazda karteru, powodując permanentny wyciek oleju. Dwa wkręty wyciągają simering w 10 sekund bez dotykania karteru.',
      instructions: [
        'Zrób małym punktakiem lub gwoździem dwa delikatne nakłucia w blaszanym czole starego uszczelniacza (na godzinie 9 i 3).',
        'Wkręć w te miejsca po 2–3 zwoje wkręta do drewna (ostrożnie, by nie dotknąć łożyska wału znajdującego się za simeringiem!).',
        'Chwyć łby obu wkrętów kombinerkami lub obcęgami i pociągnij równomiernie wzdłuż osi wału.',
        'Stary simering wyskakuje z gniazda gładko i bez najmniejszego kontaktu narzędzia z delikatnym aluminium karteru.'
      ],
      durability: 'Profesjonalny patent warsztatowy stosowany przez doświadczonych mechaników.',
      limits: 'Nie wkręcać wkręta głębiej niż 4 mm, by nie uszkodzić koszyka i kulek łożyska wału!',
      testMethod: 'Obejrzyj gniazdo po wyjęciu simeringu — brak jakichkolwiek rys na czopie wału i karterze.',
      isTested: true
    },
    {
      id: 'nar-02',
      category: 'nar',
      title: 'Ścisk do sprężyny centralnej sprzęgła z dwóch desek i pręta M8',
      subtitle: 'Bezpieczny demontaż dużej nakrętki sprzęgła 38/41 mm bez ryzyka uderzenia w twarz',
      level: 2,
      safety: 'safe',
      cost: '0–5 zł',
      time: '20 min',
      rating: 4.8,
      votes: 215,
      vehicle: 'Sprzęgła odśrodkowe CVT (50cc – 300cc)',
      materials: ['Dwa kawałki deski lub sklejki (ok. 15x15 cm)', 'Jeden pręt gwintowany M8 lub długa śruba M8 z nakrętką i 2 podkładkami'],
      tools: ['Wiertarka z wiertłem 9 mm', 'Klucz płaski 13 mm'],
      description: 'Odkręcanie nakrętki sprzęgła na podłodze nogami grozi wystrzeleniem talerza sprężyną prosto w zęby lub zerwaniem drobnego gwintu. Dwie deski i pręt M8 tworzą bezpieczną prasę śrubową.',
      instructions: [
        'Przewierć otwór 9 mm w środku obu desek.',
        'Umieść zespół sprzęgła między deskami, przekładając przez środek pręt gwintowany.',
        'Skręć nakrętką M8 deski, ściskając delikatnie sprężynę centralną o 3–5 mm.',
        'Teraz odkręć dużą nakrętkę sprzęgła (38–41 mm) — nie ma na niej żadnego naprężenia ani oporu!',
        'Powoli odkręcaj nakrętkę M8 na pręcie, płynnie i bezpiecznie rozprężając sprężynę centralną.'
      ],
      durability: 'Przyrząd służy w warsztacie przez lata do każdego serwisu napędu.',
      limits: 'Stosować szerokie podkładki pod nakrętki, by pręt nie wbijał się w drewno.',
      testMethod: 'Bezpieczny demontaż bez używania nóg ani uderzania młotkiem.',
      isTested: true
    },
    {
      id: 'nar-03',
      category: 'nar',
      title: 'Blokada wariatora i dzwonu sprzęgła ze starego płaskownika',
      subtitle: 'Odkręcanie nakrętki wariatora bez klucza pneumatycznego ani udaru',
      level: 2,
      safety: 'safe',
      cost: '0 zł',
      time: '25 min',
      rating: 4.9,
      votes: 260,
      vehicle: 'Wszystkie skutery CVT',
      materials: ['Kawałek stalowego płaskownika (szerokość 25–30 mm, grubość 3–4 mm, długość 35 cm)', 'Dwie śruby M6 o twardości min. 8.8 z nakrętkami'],
      tools: ['Wiertarka z wiertłami 6.5 mm', 'Szlifierka kątowa lub brzeszczot'],
      description: 'Blokowanie wieńca wariatora śrubokrętem wyłamuje zęby wieńca rozrusznika lub karter silnika. Blokada widełkowa z płaskownika opiera się o podłogę i kosztuje 0 zł.',
      instructions: [
        'Zmierz rozstaw dwóch otworów w dzwonie sprzęgła lub zębów wieńca wariatora (zwykle 40–80 mm).',
        'Wywierć w płaskowniku dwa otwory w tym rozstawie.',
        'Wkręć w otwory dwie śruby M6 i zakontruj nakrętkami — wystające trzpienie tworzą widelce blokujące.',
        'Włóż bolce w otwory dzwonu lub oprzyj o zęby wieńca, a drugi koniec płaskownika oprzyj o podłoże.',
        'Odkręcaj nakrętkę wału długim kluczem z przedłużką bez obawy o karter silnika.'
      ],
      durability: 'Niezniszczalne narzędzie warsztatowe.',
      limits: 'Śruby blokujące muszą mieć min. twardość 8.8, aby nie zgięły się pod obciążeniem.',
      testMethod: 'Dociągnij nakrętkę momentem 45 Nm — blokada stoi sztywno bez wyginania.',
      isTested: true
    },
    {
      id: 'nar-04',
      category: 'nar',
      title: 'Blokada tłoka ze starej świecy zapłonowej z nylonowym sznurkiem',
      subtitle: 'Blokowanie wału korbowego bez ryzyka zrobienia dziury w denku tłoka',
      level: 2,
      safety: 'safe',
      cost: '0 zł',
      time: '20 min',
      rating: 4.8,
      votes: 195,
      vehicle: 'Silniki 2T (skutery, motorowery, pilarki, crossy)',
      materials: ['Stara zużyta świeca zapłonowa z pasującym gwintem (M14x1.25)', 'Odcinek miękkiej linki nylonowej lub sznurówki (ok. 40 cm)'],
      tools: ['Imadło', 'Młotek', 'Wybijak do usunięcia porcelany'],
      description: 'Metalowe blokady tłoka wkręcane w gniazdo świecy często wybijają dziurę w cienkim denku tłoka 2T! Miękka linka nylonowa wprowadzona do cylindra łagodnie wypełnia komorę spalania bez punktowego nacisku.',
      instructions: [
        'Wybiij młotkiem i przecinakiem ceramikę ze starej świecy, uzyskując pusty metalowy korpus z gwintem M14.',
        'Przeszlifuj wnętrze, by usunąć ostre krawędzie.',
        'Wkręć wydrążony korpus w głowicę ręką.',
        'Ustaw tłok w drodze ku górze (ok. 30° przed GMP) i wsuń przez otwór 25–30 cm miękkiej linki nylonowej (zostawiając koniec na zewnątrz!).',
        'Obróć delikatnie wałem — tłok miękko zaprze się o kłębek sznurka, blokując wał w 100% bezpiecznie bez mikropęknięć w aluminium tłoka.',
        'Po dokręceniu/odkręceniu nakrętki obróć lekko wał w tył i wyciągnij sznurek za wystający koniec.'
      ],
      durability: 'Najbezpieczniejsza garażowa metoda blokowania silnika 2T.',
      limits: 'NIGDY nie używać w silnikach 4T (sznurek może wpaść w otwarty zawór i go skrzywić!). Tylko silniki 2T bez zaworów w głowicy.',
      testMethod: 'Tłok opiera się miękko, brak jakichkolwiek śladów na denku tłoka.',
      isTested: true
    },

    // 5. PATENTY NA SILNIK
    {
      id: 'eng-01',
      category: 'eng',
      title: 'Wycinanie uszczelek karteru i gaźnika z kartonu TetraPak po soku',
      subtitle: 'Brak uszczelki komory pływakowej, króćca dolotu lub połówek karteru silnika',
      level: 1,
      safety: 'safe',
      cost: '0 zł',
      time: '15 min',
      rating: 4.8,
      votes: 185,
      vehicle: 'Wszystkie gaźniki i silniki 2T/4T',
      materials: ['Pusty karton po soku lub mleku TetraPak (papier + folia aluminiowa + warstwa polietylenu)', 'Kropla oleju silnikowego lub smaru'],
      tools: ['Nożyczki modelarskie', 'Wybijak do otworów lub zaostrzona rurka stalowa', 'Mały młoteczek'],
      description: 'Karton TetraPak jest zaawansowanym laminatem odpornym na ciecze i ciśnienie. Warstwa aluminium i polietylenu nie rozpuszcza się w benzynie i idealnie uszczelnia nierówności karteru.',
      instructions: [
        'Rozetnij i umyj karton po soku, osuszając powierzchnię.',
        'Posmaruj krawędź gaźnika lub karteru cienką warstwą brudnego oleju/smaru i odbij pieczątkę na kartonie.',
        'Wytnij otwory pod śruby zaostrzoną rurką lub wybijakiem na kawałku twardego drewna.',
        'Wytnij obrys zewnętrzny nożyczkami.',
        'Przed montażem posmaruj karton cienko olejem silnikowym — zmięknie i idealnie wypełni mikronierówności pod dociągnięciem śrub.'
      ],
      durability: 'Wytrzymuje lata w gaźnikach i karterach. W 100% odporna na benzynę i olej.',
      limits: 'Nie stosować pod głowicę cylindra (tam panuje ciśnienie 50 barów i ogień — wymaga miedzi lub stali).',
      testMethod: 'Sprawdź czy nie ma wycieków paliwa po odkręceniu kranika i napełnieniu komory pływakowej.',
      isTested: true
    },
    {
      id: 'eng-02',
      category: 'eng',
      title: 'Czyszczenie zapchanej dyszy gaźnika drucikiem ze szczotki drucianej',
      subtitle: 'Silnik dławi się, zapchany mikroskopijny otworek dyszy w trasie',
      level: 1,
      safety: 'safe',
      cost: '0 zł',
      time: '10 min',
      rating: 4.7,
      votes: 162,
      vehicle: 'Wszystkie silniki gaźnikowe',
      materials: ['Jeden pojedynczy cienki drucik wyrwany ze szczotki drucianej lub rozplecionej linki rowerowej'],
      tools: ['Kombinerki', 'Zmywacz do gaźników / benzyna'],
      description: 'Zwykła igła krawiecka jest stożkowa i zbyt gruba — wciskanie jej w mosiężną dyszę nieodwracalnie rozkalibruje otwór! Drucik ze szczotki ma stałą średnicę 0.15–0.20 mm i udrażnia bez zarysowań.',
      instructions: [
        'Wyrwij jeden stalowy lub mosiężny drucik ze szczotki ręcznej.',
        'Zegnij drucik w połowie dla uzyskania sztywności.',
        'Przepchnij delikatnie przez kanalik dyszy wolnych obrotów (Pilot Jet) i dyszy głównej.',
        'Wypłucz obficie zmywaczem do gaźników lub przedmuchaj pompką/ustami.',
        'Dysza odzyskuje 100% fabrycznego przepływu bez uszkodzenia kalibracji otworu.'
      ],
      durability: 'Standardowa sprawdzona metoda naprawy gaźnika w terenie.',
      limits: 'Nie używać wierteł ani twardych stalowych rysików, które mogą powiększyć średnicę dyszy.',
      testMethod: 'Spójrz przez dyszę pod słońce — musi być widoczny idealny, okrągły punkt świetlny.',
      isTested: true
    },
    {
      id: 'eng-03',
      category: 'eng',
      title: 'Zerwany gwint M6 w karterze: Szpilka redukcyjna M7/M6',
      subtitle: 'Przekręcona śruba pokrywy zaworów, króćca dolotu lub wydechu w miękkim aluminium',
      level: 2,
      safety: 'safe',
      cost: '2 zł',
      time: '20 min',
      rating: 4.9,
      votes: 205,
      vehicle: 'Silniki z karterem ze stopu aluminium',
      materials: ['Krótka śruba M7 lub kawałek pręta M7 z narzynką, mocny klej do gwintów (zielony/czerwony)'],
      tools: ['Gwintownik M7x1.0', 'Klucz płaski'],
      description: 'Aluminiowe kartery skuterów łatwo zerwać. Wiercenie pod wkładkę Heli-Coil wymaga zestawu za 80 zł. Zerwany otwór M6 ma po zerwaniu średnicę 6.0 mm — to IDEALNA średnica pod bezpośrednie nagwintowanie M7 bez rozwiercania!',
      instructions: [
        'Zerwany otwór M6 nagwintuj bezpośrednio gwintownikiem M7x1.0 bez używania wiertarki.',
        'Weź śrubę M7, utnij łeb, a na drugim końcu przetocz lub zeszlifuj do M6 i nagwintuj (lub zastosuj gotową szpilkę redukcyjną gaźnika Fiata 126p M7->M6).',
        'Wkręć szpilkę w nagwintowany otwór karteru na mocny klej do gwintów.',
        'Część dociskasz od zewnątrz seryjną nakrętką M6 — karter zyskuje wieczne mocowanie na szpilce zamiast ciągłego wkręcania w miękki karter!'
      ],
      durability: 'Trwalsze niż fabryczny gwint w aluminium, bo szpilka nigdy więcej nie jest wykręcana z bloku.',
      limits: 'Dokręcać nakrętkę z wyczuciem (maksymalnie 9–10 Nm).',
      testMethod: 'Dokręć nakrętkę M6 momentem roboczym — szpilka ani drgnie w karterze.',
      isTested: true
    },
    {
      id: 'eng-04',
      category: 'eng',
      title: 'Docieranie zaworów 4T wkrętarką i pastą do zębów z popiołem',
      subtitle: 'Nieszczelne zawory głowicy 4T, brak kompresji, brak pasty do docierania w niedzielę',
      level: 2,
      safety: 'safe',
      cost: '0 zł',
      time: '35 min',
      rating: 4.7,
      votes: 140,
      vehicle: 'Silniki 4T (GY6 50/125/150, 139QMB, 152QMI, 125cc)',
      materials: ['Pasta do zębów (najlepiej wybielająca z mikrogranulkami)', 'Drobno przesiany popiół drzewny lub proszek do pieczenia', 'Kawałek wężyka paliwowego gumowego 5 mm'],
      tools: ['Wkrętarka akumulatorowa z regulacją obrotów i lewymi/prawymi obrotami'],
      description: 'Zawory tracą szczelność przez nagar. Profesjonalna pasta do docierania to ścierniwo korundowe. Drobny popiół z pastą do zębów tworzy pastę polerską o gradacji ok. 1500–2000, idealną do końcowego polerowania przylgni zaworowej.',
      instructions: [
        'Wymieszaj 1 łyżeczkę pasty do zębów z odrobiną przesianego popiołu na gęstą maź.',
        'Nałóż odrobinę na przylgnię zaworu (UWAŻAJ, by nie zabrudzić trzonka zaworu w prowadnicy!).',
        'Wsuń zawór w prowadnicę głowicy.',
        'Na wystający trzonek zaworu nałóż gumowy wężyk, a drugi koniec zaciśnij w uchwycie wkrętarki.',
        'Docieraj na niskich obrotach z lekkim dociskiem, zmieniając kierunek obrotów co 10 sekund i unosząc zawór.',
        'Po 5 minutach zmyj pastę benzyną — na przylgni zaworu i gnieździe pojawi się jednolity, matowo-szary pas o szerokości 1.0–1.2 mm.'
      ],
      durability: 'Zapewnia 100% kompresji silnika na tysiące kilometrów.',
      limits: 'Nie stosować obrotów powyżej 300 obr/min, by nie zatrzeć trzonka zaworu w prowadnicy!',
      testMethod: 'Wlej benzynę ekstrakcyjną do kanału dolotowego/wydechowego głowicy przy zapiętych sprężynach — przez 3 minuty nie ma prawa pojawić się ani jedna kropla pod zaworem.',
      isTested: true
    },

    // 6. ABSURDALNE PATENTY
    {
      id: 'abs-01',
      category: 'abs',
      title: 'Kierownica powietrza chłodzenia z butelki 2L po napoju',
      subtitle: 'Przegrzewanie się cylindra AC w upalne dni w korkach miejskich',
      level: 3,
      safety: 'exp',
      cost: '0 zł',
      time: '15 min',
      rating: 4.6,
      votes: 155,
      vehicle: 'Skutery chłodzone powietrzem (AC 2T/4T)',
      materials: ['Plastikowa butelka PET 2 litry (np. po napoju)', '3 opaski zaciskowe'],
      tools: ['Nożyk tapicerski'],
      description: 'Skutery AC chłodzone są wirnikiem na wale. W upał fabryczny wlot zasysa gorące powietrze znad nagrzanego asfaltu. Butelka PET ucięta w kształt wlotu NACA wymusza dopływ chłodniejszego powietrza pędem jazdy.',
      instructions: [
        'Odetnij ukośnie szyjkę i denko plastikowej butelki PET 2L, tworząc lejkowaty chwyt powietrza (tzw. air scoop).',
        'Przymocuj butelkę szerokim wlotem skierowanym do przodu nad kratką wentylatora chłodzenia za pomocą opasek zaciskowych.',
        'Podczas jazdy pęd powietrza jest wtłaczany bezpośrednio w łopatki wirnika wentylatora magneta.',
        'Obniża temperaturę cylindra w upale o 6–10°C przy prędkościach powyżej 40 km/h.'
      ],
      durability: 'Patent sprawdzony przez kurierów w krajach śródziemnomorskich.',
      limits: 'Nie stosować podczas ulewy w głębokim błocie (wtłacza brud bezpośrednio na żebra cylindra).',
      testMethod: 'Zmierz temperaturę cylindra pirometrem po 15 minutach jazdy z tunelem i bez niego.',
      isTested: true
    },
    {
      id: 'abs-02',
      category: 'abs',
      title: 'Odpalanie silnika wkrętarką akumulatorową z nasadką na wał',
      subtitle: 'Padł akumulator, zerwany kickstarter na warsztacie, trzeba zdiagnozować zapłon',
      level: 3,
      safety: 'bench',
      cost: '0 zł',
      time: '5 min',
      rating: 4.8,
      votes: 215,
      vehicle: 'Warsztat stacjonarny / stanowisko diagnostyczne',
      materials: ['Wkrętarka akumulatorowa 18V z regulacją obrotów', 'Nasadka sześciokątna pasująca na nakrętkę wału (zwykle 14 lub 17 mm)'],
      tools: ['Przejściówka z wkrętarki na kwadrat 1/2 lub 3/8 cala'],
      description: 'Gdy skuter ma niesprawny rozrusznik i brak kopnika, a trzeba sprawdzić iskrę lub wyregulować gaźnik na stole, mocna wkrętarka 18V kręci wałem jak profesjonalny rozrusznik.',
      instructions: [
        'Zdejmij osłonę magneta lub pokrywę napędu CVT.',
        'Upewnij się, w którą stronę kręci się silnik podczas normalnej pracy (zgodnie z ruchem wskazówek zegara od strony magneta!).',
        'Ustaw obroty wkrętarki we właściwym kierunku (nigdy odwrotnie, bo natychmiast odkręcisz nakrętkę wału!).',
        'Włącz stacyjkę, przyłóż nasadkę do nakrętki wału i płynnie wciśnij spust wkrętarki.',
        'W chwili gdy silnik zaskoczy, NATYCHMIAST odsuń wkrętarkę od wału, by pracujący silnik nie wyrwał narzędzia z rąk!'
      ],
      durability: 'Sprawdzona metoda warsztatowa do wielokrotnego użytku diagnostycznego.',
      limits: 'ŚCIŚLE STACJONARNE! Obowiązkowo okulary ochronne. Trzymać wkrętarkę oburącz.',
      testMethod: 'Silnik odpala natychmiast na wolne obroty bez używania akumulatora pojazdu.',
      isTested: true
    },
    {
      id: 'abs-03',
      category: 'abs',
      title: 'Wziernik poziomu paliwa z przezroczystego wężyka na zewnątrz baku',
      subtitle: 'Uszkodzony pływak lub brak wskaźnika poziomu paliwa na desce rozdzielczej',
      level: 4,
      safety: 'exp',
      cost: '4 zł',
      time: '25 min',
      rating: 4.6,
      votes: 118,
      vehicle: 'Pojazdy z bakiem metalowym lub tworzywowym',
      materials: ['Przezroczysty zbrojony wężyk paliwowy 5-6 mm', 'Dwa trójniki paliwowe z tworzywa', 'Mini opaski zaciskowe'],
      tools: ['Nożyk', 'Śrubokręt'],
      description: 'Zasada naczyń połączonych: ciecz w pionowym przezroczystym przewodzie połączonym z dołem i górą zbiornika zawsze ustawi się dokładnie na poziomie paliwa w baku.',
      instructions: [
        'Wepnij pierwszy trójnik w przewód odpływowy na samym dole zbiornika (przed kranikiem paliwa).',
        'Poprowadź przezroczysty wężyk pionowo do góry wzdłuż boku zbiornika pod owiewką.',
        'Górny koniec wężyka wepnij drugim trójnikiem w przewód odpowietrzenia baku na samej górze.',
        'Poziom benzyny widać gołym okiem przez szczelinę w plastiku z dokładnością do 50 ml!'
      ],
      durability: 'Stosowane fabrycznie w wielu motocyklach rajdowych Dakar i wyścigowych maszynach.',
      limits: 'Wężyk musi być certyfikowany do benzyny (nie może zżółknąć ani stwardnieć po miesiącu).',
      testMethod: 'Dolej 1 litr paliwa do pustego baku — słup cieczy w wężyku natychmiast podnosi się proporcjonalnie.',
      isTested: true
    }
  ];

  // --- BAZA MATERIAŁÓW Z ODZYSKU (ROZBIERZ I ODZYSKAJ) ---
  const RECYCLE_DATABASE = [
    {
      source: 'Stara pralka automatyczna',
      icon: '🧺',
      badge: 'Złom / Elektrośmieci',
      items: [
        { name: 'Sprężyny zawieszenia bębna', use: 'Idealne potężne sprężyny wydechu, podnóżka centralnego i stopki bocznej.', check: 'Brak pęknięć zwojów, wysoka siła naciągu.' },
        { name: 'Opaski ślimakowe i cybanty nierdzewne W2', use: 'Mocowanie rur dolotu powietrza, filtrów stożkowych i osłon termicznych.', check: 'Nieprzekręcony gwint śruby ślimakowej.' },
        { name: 'Węże zbrojone gumowe EPDM', use: 'Przewody chłodzenia cieczą (LC), odporne na 120°C i glikol borygo.', check: 'Brak sparciałej gumy i pęknięć od wewnątrz.' },
        { name: 'Amortyzatory cierne bębna', use: 'Podstawa do budowy prasy warsztatowej lub tłumika drgań silnika.', check: 'Stały opór suwu bez zacięć.' }
      ]
    },
    {
      source: 'Stary rower górski / trekkingowy',
      icon: '🚲',
      badge: 'Piwnica / Garaż',
      items: [
        { name: 'Linki i pancerze teflonowe przerzutki', use: 'Awaryjne linki gazu, linki ssania manualnego, linki zamka kanapy.', check: 'Czysty rdzeń ze stali nierdzewnej bez zadziorów i załamań.' },
        { name: 'Klamki i baryłki regulacyjne M6', use: 'Regulacja naciągu linki hamulca bębnowego i przepustnicy gaźnika.', check: 'Nienaruszony gwint aluminiowy.' },
        { name: 'Dętka butylowa 26 / 28 cali', use: 'Tłumiki drgań pod owiewki, elastyczne podkładki pod śruby, uszczelnienia dolotu.', check: 'Elastyczna guma bez mikropęknięć.' },
        { name: 'Łańcuch rowerowy ze spinką', use: 'Klucz łańcuchowy do filtrów oleju oraz blokada koła magnesowego.', check: 'Brak zardzewiałych sworzni.' }
      ]
    },
    {
      source: 'Zasilacz komputerowy ATX',
      icon: '💻',
      badge: 'Elektroodpady',
      items: [
        { name: 'Wentylator 12V 80x80 / 120x120 mm', use: 'Dodatkowe wymuszone chłodzenie chłodnicy w upalne dni lub nawiew na cylinder AC.', check: 'Płynny cichy obrót po podaniu 12V z akumulatora.' },
        { name: 'Wiązki elastycznych przewodów miedzianych (18 AWG)', use: 'Najwyższej jakości przewody do naprawy instalacji elektrycznej skutera.', check: 'Czysta miedź bez utlenienia na zielono.' },
        { name: 'Diody prostownicze Schottky\'ego', use: 'Zabezpieczenie instalacji przed odwrotną polaryzacją i ładowanie USB.', check: 'Test diody multimetrem (spadek ok. 0.3V).' },
        { name: 'Radiatory aluminiowe żebrowane', use: 'Dodatkowe chłodzenie regulatora napięcia lub modułu CDI.', check: 'Czysta płaska powierzchnia styku.' }
      ]
    },
    {
      source: 'Puszki aluminiowe i konserwowe',
      icon: '🥫',
      badge: 'Odpady domowe',
      items: [
        { name: 'Blacha aluminiowa 0.15 mm z puszki po napoju', use: 'Precyzyjne podkładki pod cylinder (strojenie squish/kątów), uszczelki wydechu, osłony kabli.', check: 'Brak załamań i zagnieceń krawędzi.' },
        { name: 'Blacha stalowa ocynkowana z puszki konserwowej', use: 'Opaski naprawcze, osłony łańcucha, dorabianie uchwytów przewodów.', check: 'Brak korozji.' }
      ]
    },
    {
      source: 'Stara lodówka / zamrażarka',
      icon: '🧊',
      badge: 'Sprzęt AGD',
      items: [
        { name: 'Rurki miedziane kapilarne 2–6 mm', use: 'Dysze czyszczące do kompresora, odpowietrzniki, tulejki lutownicze.', check: 'Czyste światło rurki bez zagnieceń.' },
        { name: 'Magnesy neodymowe / ferrytowe z uszczelki drzwi', use: 'Wyłapywanie opiłków metalu w misce olejowej lub na korku spustowym.', check: 'Silne pole magnetyczne.' }
      ]
    },
    {
      source: 'Zużyta kosiarka spalinowa',
      icon: '🌱',
      badge: 'Ogród',
      items: [
        { name: 'Manetka gazu z blokadą tarcia i linką', use: 'Ręczne ssanie, tempomat warsztatowy lub gaz do wózka custom.', check: 'Płynny skok bez zacięć.' },
        { name: 'Przelotowy filtr paliwa ze spiekiem', use: 'Dodatkowy filtr paliwa w skuterze chroniący dyszę gaźnika.', check: 'Czysty wkład bez mułu.' },
        { name: 'Sprężyny powrotne przepustnicy', use: 'Sprężyny odbijające kopki, stopki bocznej lub przepustnicy.', check: 'Wysoka sprężystość.' }
      ]
    }
  ];

  // --- ZARZĄDZANIE STANEM MODUŁU ---
  let activeTab = 'janusz';
  let activeFilterCategory = 'all';
  let activeFilterSafety = 'all';
  let activeFilterLevel = 0;
  let activeFilterZeroCost = false;
  let patentSearchQuery = '';

  // Klucze LocalStorage
  const STORAGE_CUSTOM = 'naprawnik_druciarstwo_custom';
  const STORAGE_FAVORITES = 'naprawnik_druciarstwo_favorites';
  const STORAGE_RATINGS = 'naprawnik_druciarstwo_ratings';
  const STORAGE_HISTORY = 'naprawnik_druciarstwo_history';

  function getCustomPatents() {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveCustomPatentsList(list) {
    try {
      localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(list));
    } catch (_) {}
  }

  function getFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_FAVORITES);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveFavoritesList(list) {
    try {
      localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(list));
    } catch (_) {}
  }

  function getRatings() {
    try {
      const raw = localStorage.getItem(STORAGE_RATINGS);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function saveRatingsMap(map) {
    try {
      localStorage.setItem(STORAGE_RATINGS, JSON.stringify(map));
    } catch (_) {}
  }

  function getHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function addHistoryItem(id) {
    try {
      let list = getHistory().filter(x => x !== id);
      list.unshift(id);
      if (list.length > 20) list.pop();
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list));
    } catch (_) {}
  }

  function getAllPatents() {
    return [...BUILTIN_PATENTS, ...getCustomPatents()];
  }

  // --- WSTRZYKIWANIE STYLÓW DLA DRUCIARSTWA ---
  function injectDruciarstwoStyles() {
    if (document.getElementById('druciarstwo-styles')) return;
    const style = document.createElement('style');
    style.id = 'druciarstwo-styles';
    style.textContent = `
      .druciarstwo-wrapper { max-width: 900px; margin: 0 auto; padding: 10px 12px 60px; }
      .druciarstwo-header { text-align: center; margin-bottom: 16px; position: relative; }
      .druciarstwo-title { font-size: 26px; font-weight: 900; color: #ffd700; text-shadow: 0 0 15px rgba(255,215,0,0.5); margin: 0 0 4px; letter-spacing: 0.5px; }
      .druciarstwo-sub { font-size: 14px; color: #cbd5e1; font-style: italic; margin-bottom: 14px; }
      
      .redline-banner {
        background: linear-gradient(135deg, rgba(185,28,28,0.25), rgba(0,0,0,0.85));
        border: 2px solid #ef4444;
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 16px;
        box-shadow: 0 0 20px rgba(239,68,68,0.25);
      }
      .redline-head { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #fca5a5; font-size: 14px; margin-bottom: 6px; }
      .redline-body { font-size: 12px; color: #fecaca; line-height: 1.5; }
      .redline-body b { color: #fff; }

      .druc-nav-bar {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 6px 2px 12px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .druc-nav-bar::-webkit-scrollbar { display: none; }
      .druc-tab-btn {
        background: #111827;
        color: #94a3b8;
        border: 1px solid #374151;
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .druc-tab-btn.active {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #000;
        border-color: #ffd700;
        box-shadow: 0 0 15px rgba(245,158,11,0.4);
      }

      .janusz-box {
        background: #0f172a;
        border: 1px solid #f59e0b;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      }
      .janusz-title { font-size: 18px; font-weight: 800; color: #f59e0b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
      .janusz-form-group { margin-bottom: 14px; }
      .janusz-form-group label { display: block; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .janusz-input, .janusz-select {
        width: 100%;
        background: #1e293b;
        border: 1px solid #475569;
        border-radius: 8px;
        padding: 10px 12px;
        color: #fff;
        font-size: 14px;
        box-sizing: border-box;
      }
      .janusz-input:focus, .janusz-select:focus { border-color: #f59e0b; outline: none; }
      
      .zero-cost-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff;
        font-weight: 800;
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 20px;
        cursor: pointer;
        border: none;
        box-shadow: 0 0 10px rgba(16,185,129,0.4);
        margin-top: 6px;
      }
      
      .checkbox-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
        margin-top: 6px;
      }
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
        color: #cbd5e1;
        cursor: pointer;
      }
      .checkbox-label:hover { border-color: #f59e0b; }
      .checkbox-label input { accent-color: #f59e0b; }

      .janusz-btn-calc {
        width: 100%;
        background: linear-gradient(135deg, #f59e0b, #b45309);
        color: #000;
        font-weight: 900;
        font-size: 15px;
        padding: 14px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(245,158,11,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 10px;
        transition: transform 0.15s ease;
      }
      .janusz-btn-calc:active { transform: scale(0.98); }

      .patent-card {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        position: relative;
        overflow: hidden;
      }
      .patent-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
      .patent-title { font-size: 16px; font-weight: 800; color: #fff; margin: 0; line-height: 1.3; }
      .patent-sub { font-size: 13px; color: #94a3b8; margin: 4px 0 10px; }
      .patent-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
      .badge-druc {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      
      .points-12-grid {
        background: #1e293b;
        border-radius: 10px;
        padding: 12px;
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pt-row { font-size: 12px; line-height: 1.4; color: #cbd5e1; }
      .pt-row b { color: #f59e0b; }
      .pt-inst-list { margin: 6px 0 0 16px; padding: 0; }
      .pt-inst-list li { margin-bottom: 4px; }

      .star-rating { display: inline-flex; gap: 4px; cursor: pointer; color: #ffd700; font-size: 16px; }
      .fav-btn {
        background: transparent;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #64748b;
        transition: transform 0.2s ease, color 0.2s ease;
      }
      .fav-btn.active { color: #ef4444; transform: scale(1.15); }

      .filter-toolbar {
        background: #1e293b;
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .filter-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .filter-chip {
        background: #0f172a;
        border: 1px solid #475569;
        border-radius: 16px;
        padding: 4px 10px;
        font-size: 12px;
        color: #cbd5e1;
        cursor: pointer;
      }
      .filter-chip.active {
        background: #f59e0b;
        color: #000;
        font-weight: 700;
        border-color: #ffd700;
      }
    `;
    document.head.appendChild(style);
  }

  // --- RENDEROWANIE GŁÓWNEGO WIDOKU MODUŁU ---
  function renderDruciarstwo(tabArg) {
    injectDruciarstwoStyles();
    if (tabArg) activeTab = tabArg;

    const screen = document.getElementById('screen');
    if (!screen) return;

    let tabContentHtml = '';
    if (activeTab === 'janusz') tabContentHtml = renderJanuszTabHtml();
    else if (activeTab === 'baza') tabContentHtml = renderBazaTabHtml();
    else if (activeTab === 'recycle') tabContentHtml = renderRecycleTabHtml();
    else if (activeTab === 'custom') tabContentHtml = renderCustomTabHtml();
    else if (activeTab === 'fav') tabContentHtml = renderFavoritesTabHtml();

    screen.innerHTML = `
      <div class="druciarstwo-wrapper">
        <div class="druciarstwo-header">
          <h1 class="druciarstwo-title">🛠️ DRUCIARSTWO ULTIMATE</h1>
          <div class="druciarstwo-sub">„Nie masz części? Nie masz kasy? Masz garaż. Kombinuj!”</div>
        </div>

        <!-- CZERWONA LINIA BEZPIECZEŃSTWA -->
        <div class="redline-banner">
          <div class="redline-head">
            <span>⛔ CZERWONA LINIA BEZPIECZEŃSTWA — ZASADY GARAŻOWE</span>
          </div>
          <div class="redline-body">
            Garażowe patenty ratują w trasie i oszczędzają tysiące, ale <b>twoje zdrowie i życie są bezcenne</b>.<br>
            <b>BEZWZGLĘDNY ZAKAZ prowizorek przy:</b><br>
            • <b>Hamulcach</b> (przewody hydrauliczne pod ciśnieniem 100 bar, klocki hamulcowe)<br>
            • <b>Układzie kierowniczym</b> (półki widelca, sztyca, kierownica — ryzyko nagłego pęknięcia)<br>
            • <b>Ramie nośnej</b> (pęknięcia nośne ramy i zawieszenia)<br>
            • <b>Ciśnieniowych przewodach paliwowych</b> (układy wtryskowe EFI — ryzyko natychmiastowego pożaru)!
          </div>
        </div>

        <!-- BELKA ZAKŁADEK -->
        <div class="druc-nav-bar">
          <button class="druc-tab-btn ${activeTab==='janusz'?'active':''}" onclick="window.setDruciarstwoTab('janusz')">
            🤖 Janusz 3000
          </button>
          <button class="druc-tab-btn ${activeTab==='baza'?'active':''}" onclick="window.setDruciarstwoTab('baza')">
            📚 Baza Patentów (${getAllPatents().length})
          </button>
          <button class="druc-tab-btn ${activeTab==='recycle'?'active':''}" onclick="window.setDruciarstwoTab('recycle')">
            ♻️ Rozbierz i Odzyskaj
          </button>
          <button class="druc-tab-btn ${activeTab==='custom'?'active':''}" onclick="window.setDruciarstwoTab('custom')">
            ⭐ Moje Patenty & Kreator
          </button>
          <button class="druc-tab-btn ${activeTab==='fav'?'active':''}" onclick="window.setDruciarstwoTab('fav')">
            ❤️ Ulubione (${getFavorites().length})
          </button>
        </div>

        <!-- ZAWARTOŚĆ AKTYWNEJ ZAKŁADKI -->
        <div id="drucTabContent">
          ${tabContentHtml}
        </div>
      </div>
    `;

    // Podpięcie handlerów po wyrenderowaniu
    attachDruciarstwoListeners();
  }

  // --- ZAKŁADKA 1: JANUSZ ENGINEERING 3000 ---
  function renderJanuszTabHtml() {
    return `
      <div class="janusz-box">
        <div class="janusz-title">
          <span>🤖 JANUSZ ENGINEERING 3000</span>
        </div>
        <div style="font-size:13px; color:#cbd5e1; margin-bottom:14px;">
          Inteligentny silnik garażowego kombinowania. Opisz co padło, zaznacz co masz w szafce i wygeneruj natychmiastowe rozwiązanie 0 zł.
        </div>

        <form id="januszGeneratorForm" onsubmit="window.handleJanuszSubmit(event)">
          <div class="janusz-form-group">
            <label>1. Co się zepsuło? (Wybierz lub opisz)</label>
            <select class="janusz-select" id="januszProblem">
              <option value="wydech">Urwany wydech / nieszczelność połączenia tłumika</option>
              <option value="klamka">Złamana klamka hamulca / sprzęgła</option>
              <option value="linka">Zerwana linka gazu / ssania</option>
              <option value="klin">Ścięty klin koła magnesowego (brak iskry)</option>
              <option value="plastiki">Połamana owiewka / pęknięte mocowania plastików</option>
              <option value="kickstarter">Zjechany wielowypust kopnika (nie kręci)</option>
              <option value="simering">Wyciek z uszczelniacza wału (simeringu)</option>
              <option value="sprzeglo">Demontaż wariatora / sprzęgła bez klucza pneumatycznego</option>
              <option value="gaznik">Zapchana dysza gaźnika / brak wolnych obrotów</option>
              <option value="uszczelka">Brak uszczelki gaźnika / komory pływakowej</option>
              <option value="paliwo">Brak wskaźnika poziomu paliwa</option>
              <option value="chlodzenie">Przegrzewanie silnika w upale</option>
              <option value="zawory">Nieszczelne zawory głowicy 4T / brak kompresji</option>
              <option value="custom">Inny problem (własny opis poniżej)</option>
            </select>
          </div>

          <div class="janusz-form-group" id="januszCustomProblemGroup" style="display:none;">
            <label>Własny opis usterki</label>
            <input type="text" class="janusz-input" id="januszCustomText" placeholder="np. urwana szpilka cylindra, pęknięty króciec...">
          </div>

          <div class="janusz-form-group">
            <label>2. Jaki pojazd naprawiasz?</label>
            <select class="janusz-select" id="januszVehicle">
              <option value="2t">Skuter 2T (Minarelli, Piaggio, Peugeot, chińskie 2T)</option>
              <option value="4t">Skuter 4T GY6 (139QMB / 152QMI 50cc-125cc)</option>
              <option value="moto">Motorower biegowy (AM6, Derbi D50B0, 139FMB)</option>
              <option value="big">Motocykl 125cc+ / Quad / Buggy</option>
              <option value="other">Kosiarka / Silnik stacjonarny / Inne</option>
            </select>
          </div>

          <div class="janusz-form-group">
            <label>3. Twój budżet</label>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <select class="janusz-select" id="januszBudget" style="max-width:200px;">
                <option value="0">🪙 0 zł (Tylko to co w garażu)</option>
                <option value="5">Do 5 zł (Drobiazgi ze sklepu)</option>
                <option value="20">Do 20 zł</option>
                <option value="any">Byle zadziałało</option>
              </select>
              <button type="button" class="zero-cost-pill" onclick="window.activateZeroCostMode()">
                ✨ Aktywuj tryb 0 zł!
              </button>
            </div>
          </div>

          <div class="janusz-form-group">
            <label>4. Co masz pod ręką w garażu? (Zaznacz materiały)</label>
            <div class="checkbox-grid">
              <label class="checkbox-label"><input type="checkbox" id="mat_trytytki" checked> Opaski (trytytki)</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_drut" checked> Drut stalowy / wieszak</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_puszka" checked> Puszka po napoju</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_detka" checked> Stara dętka rowerowa</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_klej" checked> Kropelka / Super Glue</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_soda" checked> Soda oczyszczona</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_tetrapak" checked> Karton po soku</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_sruby" checked> Wiadro starych śrub</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_tasmy" checked> Taśma izolacyjna / Duct</label>
              <label class="checkbox-label"><input type="checkbox" id="mat_struna"> Struna gitarowa</label>
            </div>
          </div>

          <div class="janusz-form-group">
            <label>5. Dostępne narzędzia</label>
            <div class="checkbox-grid">
              <label class="checkbox-label"><input type="checkbox" id="tool_basic" checked> Klucze i śrubokręty</label>
              <label class="checkbox-label"><input type="checkbox" id="tool_kombinerki" checked> Kombinerki</label>
              <label class="checkbox-label"><input type="checkbox" id="tool_wkretarka" checked> Wkrętarka akumulatorowa</label>
              <label class="checkbox-label"><input type="checkbox" id="tool_lutownica"> Lutownica</label>
              <label class="checkbox-label"><input type="checkbox" id="tool_diax"> Szlifierka kątowa (diax)</label>
            </div>
          </div>

          <div class="janusz-form-group">
            <label>6. Oczekiwana trwałość i poziom umiejętności</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <select class="janusz-select" id="januszDuration">
                <option value="perm">Trwała naprawa (ma trzymać)</option>
                <option value="temp">Awaryjny dojazd do bazy</option>
                <option value="exp">Eksperyment garażowy</option>
              </select>
              <select class="janusz-select" id="januszSkill">
                <option value="pro">Janusz Szlifierki (Zaawansowany)</option>
                <option value="med" selected>Średni (Majsterkowicz)</option>
                <option value="low">Początkujący (Podstawy)</option>
              </select>
            </div>
          </div>

          <button type="submit" class="janusz-btn-calc">
            🚀 WYGENERUJ PATENTY JANUSZA 3000
          </button>
        </form>
      </div>

      <div id="januszResultsContainer"></div>
    `;
  }

  // --- ZAKŁADKA 2: BAZA PATENTÓW ---
  function renderBazaTabHtml() {
    const patents = filterPatentsList();

    return `
      <!-- PASEK WYSZUKIWANIA I FILTRÓW -->
      <div class="filter-toolbar">
        <div style="display:flex; gap:8px;">
          <input type="text" class="janusz-input" id="drucSearchInput" placeholder="🔍 Szukaj patentu (np. wydech, linka, gaźnik, puszka)..." value="${escapeHtml(patentSearchQuery)}" oninput="window.handlePatentSearch(this.value)">
          ${patentSearchQuery ? `<button class="filter-chip" onclick="window.handlePatentSearch('')">✕ Wyczyść</button>` : ''}
        </div>

        <div class="filter-row">
          <span style="font-size:11px; font-weight:700; color:#94a3b8;">KATEGORIA:</span>
          <button class="filter-chip ${activeFilterCategory==='all'?'active':''}" onclick="window.setFilterCategory('all')">Wszystkie</button>
          ${Object.values(CATEGORIES).map(c => `
            <button class="filter-chip ${activeFilterCategory===c.id?'active':''}" onclick="window.setFilterCategory('${c.id}')">${c.icon} ${c.name}</button>
          `).join('')}
        </div>

        <div class="filter-row">
          <span style="font-size:11px; font-weight:700; color:#94a3b8;">BEZPIECZEŃSTWO:</span>
          <button class="filter-chip ${activeFilterSafety==='all'?'active':''}" onclick="window.setFilterSafety('all')">Wszystkie</button>
          <button class="filter-chip ${activeFilterSafety==='safe'?'active':''}" onclick="window.setFilterSafety('safe')">🟢 Bezpieczne</button>
          <button class="filter-chip ${activeFilterSafety==='temp'?'active':''}" onclick="window.setFilterSafety('temp')">🟡 Dojazdowe</button>
          <button class="filter-chip ${activeFilterSafety==='bench'?'active':''}" onclick="window.setFilterSafety('bench')">🔴 Stacjonarne</button>
          <button class="filter-chip ${activeFilterZeroCost?'active':''}" onclick="window.toggleFilterZeroCost()">🪙 Tylko 0 zł</button>
        </div>
      </div>

      <div style="font-size:12px; color:#94a3b8; margin-bottom:12px;">
        Znaleziono: <b>${patents.length}</b> patentów
      </div>

      <div id="patentsListGrid">
        ${patents.length ? patents.map(p => renderPatentCardHtml(p)).join('') : `
          <div style="text-align:center; padding:40px 10px; color:#64748b;">
            <div style="font-size:32px; margin-bottom:8px;">🤷‍♂️</div>
            Brak patentów spełniających kryteria. Zmień filtry lub wyszukaj inne hasło.
          </div>
        `}
      </div>
    `;
  }

  // --- ZAKŁADKA 3: ROZBIERZ I ODZYSKAJ ---
  function renderRecycleTabHtml() {
    return `
      <div style="margin-bottom:16px;">
        <h2 style="font-size:18px; color:#ffd700; margin:0 0 6px;">♻️ KATALOG MATERIAŁÓW Z ODZYSKU</h2>
        <div style="font-size:13px; color:#94a3b8;">
          Co wyciągnąć ze starych sprzętów domowych, maszyn i złomu zanim wyrzucisz do śmietnika.
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${RECYCLE_DATABASE.map(dev => `
          <div class="patent-card" style="border-left: 4px solid #10b981;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
              <div style="font-size:16px; font-weight:800; color:#fff; display:flex; align-items:center; gap:8px;">
                <span>${dev.icon}</span>
                <span>${escapeHtml(dev.source)}</span>
              </div>
              <span class="badge-druc" style="background:#1e293b; color:#10b981; border:1px solid #10b981;">${dev.badge}</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              ${dev.items.map(it => `
                <div style="background:#1e293b; border-radius:8px; padding:10px; font-size:13px;">
                  <div style="font-weight:700; color:#ffd700; margin-bottom:3px;">🔩 ${escapeHtml(it.name)}</div>
                  <div style="color:#cbd5e1; margin-bottom:4px;"><b>Zastosowanie w garażu:</b> ${escapeHtml(it.use)}</div>
                  <div style="color:#94a3b8; font-size:11px;"><b>Jak sprawdzić stan:</b> ${escapeHtml(it.check)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- ZAKŁADKA 4: MOJE PATENTY & KREATOR ---
  function renderCustomTabHtml() {
    const customList = getCustomPatents();

    return `
      <div class="janusz-box" style="border-color:#8b5cf6;">
        <div class="janusz-title" style="color:#a78bfa;">
          <span>➕ KREATOR WŁASNEGO PATENTU</span>
        </div>
        <div style="font-size:13px; color:#cbd5e1; margin-bottom:14px;">
          Stworzyłeś genialną prowizorkę? Zapisz ją w swojej bazie, dodaj zdjęcie z warsztatu i korzystaj w każdej chwili!
        </div>

        <form id="customPatentForm" onsubmit="window.handleCustomPatentSubmit(event)">
          <div class="janusz-form-group">
            <label>Tytuł patentu *</label>
            <input type="text" class="janusz-input" id="cTitle" placeholder="np. Awaryjny filtr paliwa z końcówki strzykawki" required>
          </div>

          <div class="janusz-form-group">
            <label>Podtytuł / Problem</label>
            <input type="text" class="janusz-input" id="cSubtitle" placeholder="np. Zatkany przewód paliwowy w trasie">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="janusz-form-group">
              <label>Kategoria</label>
              <select class="janusz-select" id="cCategory">
                ${Object.values(CATEGORIES).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="janusz-form-group">
              <label>Szacowany koszt</label>
              <input type="text" class="janusz-input" id="cCost" placeholder="np. 0 zł lub 3 zł" value="0 zł">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div class="janusz-form-group">
              <label>Poziom Druciarstwa</label>
              <select class="janusz-select" id="cLevel">
                <option value="1">1 - Sprytne 💡</option>
                <option value="2" selected>2 - Garażowe 🔧</option>
                <option value="3">3 - Co tu się odpierdala? 🤯</option>
                <option value="4">4 - Eksperyment 🧪</option>
                <option value="5">5 - Garażowa Legenda 🏆</option>
              </select>
            </div>
            <div class="janusz-form-group">
              <label>Bezpieczeństwo</label>
              <select class="janusz-select" id="cSafety">
                <option value="safe">🟢 Bezpieczna naprawa</option>
                <option value="temp" selected>🟡 Tymczasowe (dojazd)</option>
                <option value="exp">🟠 Eksperyment</option>
                <option value="bench">🔴 Stacjonarne (nie do jazdy)</option>
              </select>
            </div>
          </div>

          <div class="janusz-form-group">
            <label>Potrzebne materiały (oddziel przecinkami)</label>
            <input type="text" class="janusz-input" id="cMaterials" placeholder="np. 2 trytytki, kawałek gumy, drut miedziany">
          </div>

          <div class="janusz-form-group">
            <label>Potrzebne narzędzia</label>
            <input type="text" class="janusz-input" id="cTools" placeholder="np. Kombinerki, nożyk, śrubokręt">
          </div>

          <div class="janusz-form-group">
            <label>Opis i instrukcja krok po kroku *</label>
            <textarea class="janusz-input" id="cInstructions" rows="4" placeholder="Krok 1: Wytnij...&#10;Krok 2: Załóż...&#10;Krok 3: Zaciśnij..." required></textarea>
          </div>

          <div class="janusz-form-group">
            <label>📸 Zdjęcie patentu (opcjonalnie)</label>
            <input type="file" id="cPhotoInput" accept="image/*" class="janusz-input" onchange="window.handlePhotoPreview(this)">
            <div id="cPhotoPreview" style="margin-top:8px; display:none;">
              <img id="cPhotoImg" src="" style="max-width:100%; max-height:220px; border-radius:8px; border:1px solid #475569;">
            </div>
          </div>

          <button type="submit" class="janusz-btn-calc" style="background:linear-gradient(135deg, #8b5cf6, #6d28d9); color:#fff; box-shadow:0 0 20px rgba(139,92,246,0.5);">
            💾 ZAPISZ PATENT W MOJEJ BAZIE
          </button>
        </form>
      </div>

      <div style="margin-top:24px;">
        <h3 style="font-size:16px; color:#fff; margin-bottom:12px;">TWOJE ZAPISANE PATENTY (${customList.length})</h3>
        ${customList.length ? customList.map(p => renderPatentCardHtml(p, true)).join('') : `
          <div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">
            Nie dodałeś jeszcze żadnego własnego patentu. Użyj formularza powyżej!
          </div>
        `}
      </div>
    `;
  }

  // --- ZAKŁADKA 5: ULUBIONE, HISTORIA I BACKUP ---
  function renderFavoritesTabHtml() {
    const favIds = getFavorites();
    const all = getAllPatents();
    const favPatents = all.filter(p => favIds.includes(p.id));
    const histIds = getHistory();
    const histPatents = all.filter(p => histIds.includes(p.id));

    return `
      <div style="margin-bottom:20px;">
        <h2 style="font-size:18px; color:#ef4444; margin:0 0 6px;">❤️ TWOJE ULUBIONE PATENTY (${favPatents.length})</h2>
        <div style="font-size:13px; color:#94a3b8; margin-bottom:12px;">
          Szybki dostęp do Twoich najczęściej używanych i najlepiej ocenianych patentów.
        </div>

        ${favPatents.length ? favPatents.map(p => renderPatentCardHtml(p)).join('') : `
          <div style="background:#1e293b; border-radius:8px; padding:20px; text-align:center; color:#64748b; margin-bottom:20px;">
            Brak ulubionych patentów. Kliknij serduszko (🤍) na dowolnej karcie patentu, aby dodać go tutaj!
          </div>
        `}
      </div>

      <!-- HISTORIA -->
      ${histPatents.length ? `
        <div style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="font-size:15px; color:#cbd5e1; margin:0;">🕒 Ostatnio przeglądane</h3>
            <button class="filter-chip" onclick="window.clearPatentHistory()">Wyczyść historię</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${histPatents.slice(0, 5).map(h => `
              <div style="background:#1e293b; border-radius:6px; padding:8px 12px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#fff; font-weight:700;">${escapeHtml(h.title)}</span>
                <button class="filter-chip" onclick="window.showPatentDetails('${h.id}')">Otwórz</button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- EKSPORT / IMPORT JSON -->
      <div class="patent-card" style="border:1px dashed #64748b;">
        <h3 style="font-size:15px; color:#ffd700; margin:0 0 8px;">📦 KOPIA ZAPASOWA I WYMIANA PATENTÓW</h3>
        <div style="font-size:12px; color:#cbd5e1; margin-bottom:12px;">
          Eksportuj swoje patenty, ulubione i oceny do pliku JSON lub wczytaj bazę patentów od znajomego mechanika.
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="filter-chip active" style="padding:8px 14px;" onclick="window.exportDruciarstwoJson()">
            💾 Pobierz kopię (.JSON)
          </button>
          <label class="filter-chip" style="padding:8px 14px; cursor:pointer;">
            📥 Wgraj plik JSON
            <input type="file" accept=".json" style="display:none;" onchange="window.importDruciarstwoJson(this)">
          </label>
        </div>
      </div>
    `;
  }

  // --- KARTA PATENTU HTML (12 PUNKTÓW) ---
  function renderPatentCardHtml(p, isCustom = false) {
    const lvl = LEVELS[p.level] || LEVELS[1];
    const sft = SAFETY[p.safety] || SAFETY.safe;
    const cat = CATEGORIES[p.category] || CATEGORIES.dtt;
    const favs = getFavorites();
    const isFav = favs.includes(p.id);
    const ratings = getRatings();
    const userRating = ratings[p.id] || p.rating || 5;

    return `
      <div class="patent-card" id="card-${p.id}">
        <div class="patent-card-head">
          <div>
            <h3 class="patent-title">${escapeHtml(p.title)}</h3>
            ${p.subtitle ? `<div class="patent-sub">${escapeHtml(p.subtitle)}</div>` : ''}
          </div>
          <button class="fav-btn ${isFav?'active':''}" title="Ulubione" onclick="window.toggleFavorite('${p.id}')">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>

        <div class="patent-badges">
          <span class="badge-druc" style="background:#1e293b; color:${cat.color}; border:1px solid ${cat.color};">
            ${cat.icon} ${cat.name}
          </span>
          <span class="badge-druc" style="background:#1e293b; color:${lvl.badgeColor}; border:1px solid ${lvl.badgeColor};">
            ${lvl.icon} Poz. ${p.level}: ${lvl.name}
          </span>
          <span class="badge-druc" style="background:#1e293b; color:${sft.color}; border:1px solid ${sft.color};">
            ${sft.icon} ${sft.label}
          </span>
          <span class="badge-druc" style="background:#064e3b; color:#34d399;">
            🪙 Koszt: ${escapeHtml(p.cost || '0 zł')}
          </span>
          ${p.time ? `<span class="badge-druc" style="background:#1e293b; color:#cbd5e1;">⏱️ Czas: ${escapeHtml(p.time)}</span>` : ''}
        </div>

        ${p.photo ? `
          <div style="margin-bottom:12px; text-align:center;">
            <img src="${p.photo}" style="max-width:100%; max-height:260px; border-radius:8px; border:1px solid #475569;" alt="Zdjęcie patentu">
          </div>
        ` : ''}

        <!-- 12 STRUKTURYZOWANYCH PUNKTÓW -->
        <div class="points-12-grid">
          <div class="pt-row"><b>1. Pomysł:</b> ${escapeHtml(p.description || p.title)}</div>
          <div class="pt-row"><b>2. Materiały:</b> ${Array.isArray(p.materials) ? p.materials.map(m=>escapeHtml(m)).join(', ') : escapeHtml(p.materials||'Materiały podręczne')}</div>
          <div class="pt-row"><b>3. Narzędzia:</b> ${Array.isArray(p.tools) ? p.tools.map(t=>escapeHtml(t)).join(', ') : escapeHtml(p.tools||'Klucze podstawowe')}</div>
          
          <div class="pt-row">
            <b>4. Instrukcja wykonania krok po kroku:</b>
            <ol class="pt-inst-list">
              ${Array.isArray(p.instructions) ? p.instructions.map(step => `<li>${escapeHtml(step)}</li>`).join('') : `<li>${escapeHtml(p.instructions||'Brak szczegółowego opisu.')}</li>`}
            </ol>
          </div>

          <div class="pt-row"><b>5. Szacowany koszt:</b> ${escapeHtml(p.cost || '0 zł')}</div>
          <div class="pt-row"><b>6. Trudność:</b> Poziom ${p.level} / 5 (${lvl.name})</div>
          <div class="pt-row"><b>7. Przewidywana trwałość:</b> ${escapeHtml(p.durability || 'Zależna od wykonania')}</div>
          <div class="pt-row"><b>8. Zastosowanie:</b> ${escapeHtml(p.vehicle || 'Pojazdy mechaniczne')}</div>
          <div class="pt-row"><b>9. Ograniczenia i czego unikać:</b> ${escapeHtml(p.limits || 'Przestrzegaj zasad Czerwonej Linii.')}</div>
          <div class="pt-row"><b>10. Sposób sprawdzenia:</b> ${escapeHtml(p.testMethod || 'Test na postoju przed wyjazdem')}</div>
          <div class="pt-row"><b>11. Status testów:</b> ${p.isTested ? '✅ Sprawdzony i przetestowany w praktyce' : '🧪 Wymaga weryfikacji'}</div>
          
          <div class="pt-row" style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
            <div>
              <b>12. Ocena mechaników:</b>
              <span class="star-rating" title="Kliknij gwiazdkę, aby ocenić">
                ${[1,2,3,4,5].map(st => `
                  <span onclick="window.ratePatent('${p.id}', ${st})">${st <= Math.round(userRating) ? '★' : '☆'}</span>
                `).join('')}
              </span>
              <span style="font-size:11px; color:#94a3b8; margin-left:4px;">(${userRating}/5)</span>
            </div>

            ${isCustom ? `
              <button class="filter-chip" style="color:#ef4444; border-color:#ef4444;" onclick="window.deleteCustomPatent('${p.id}')">
                🗑️ Usuń patent
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // --- FILTROWANIE BAZY PATENTÓW ---
  function filterPatentsList() {
    let list = getAllPatents();

    if (activeFilterCategory !== 'all') {
      list = list.filter(p => p.category === activeFilterCategory);
    }
    if (activeFilterSafety !== 'all') {
      list = list.filter(p => p.safety === activeFilterSafety);
    }
    if (activeFilterLevel > 0) {
      list = list.filter(p => p.level === activeFilterLevel);
    }
    if (activeFilterZeroCost) {
      list = list.filter(p => (p.cost || '').toLowerCase().includes('0 zł'));
    }
    if (patentSearchQuery.trim()) {
      const q = normalizeDruciarstwo(patentSearchQuery);
      list = list.filter(p => {
        const text = [
          p.title,
          p.subtitle,
          p.description,
          Array.isArray(p.materials) ? p.materials.join(' ') : p.materials,
          Array.isArray(p.tools) ? p.tools.join(' ') : p.tools,
          Array.isArray(p.instructions) ? p.instructions.join(' ') : p.instructions
        ].join(' ');
        return normalizeDruciarstwo(text).includes(q);
      });
    }

    return list;
  }

  function normalizeDruciarstwo(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[ąćęłńóśźż]/g, m => ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[m] || m));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- OBSŁUGA GENERATORA JANUSZ 3000 ---
  function handleJanuszSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const problemSelect = document.getElementById('januszProblem');
    const customText = (document.getElementById('januszCustomText')?.value || '').trim();
    const problem = problemSelect ? problemSelect.value : 'wydech';
    const vehicle = document.getElementById('januszVehicle')?.value || '2t';
    const budget = document.getElementById('januszBudget')?.value || '0';
    const duration = document.getElementById('januszDuration')?.value || 'perm';

    const resultsContainer = document.getElementById('januszResultsContainer');
    if (!resultsContainer) return;

    // Dobór patentów
    let matches = [];
    const all = getAllPatents();

    // Mapowanie problemu na identyfikatory patentów
    const problemMap = {
      wydech: ['dtt-01', 'dtt-02'],
      klamka: ['dtt-03'],
      linka: ['dtt-04'],
      klin: ['met-01'],
      plastiki: ['pla-01', 'pla-02'],
      kickstarter: ['met-03'],
      simering: ['nar-01'],
      sprzeglo: ['nar-02', 'nar-03', 'met-02'],
      gaznik: ['eng-02', 'eng-01'],
      uszczelka: ['eng-01'],
      paliwo: ['abs-03'],
      chlodzenie: ['abs-01'],
      zawory: ['eng-04']
    };

    if (problem !== 'custom' && problemMap[problem]) {
      const ids = problemMap[problem];
      matches = all.filter(p => ids.includes(p.id));
    }

    // Jeśli brak bezpośrednich trafień lub własny problem — szukanie po tekście
    if (!matches.length) {
      const q = normalizeDruciarstwo(customText || problem);
      matches = all.filter(p => normalizeDruciarstwo(p.title + ' ' + (p.description||'')).includes(q));
    }

    // Jeśli nadal brak, dobierz 3 najpopularniejsze sprytne patenty 0 zł
    if (!matches.length) {
      matches = all.filter(p => (p.cost||'').includes('0 zł')).slice(0, 3);
    }

    resultsContainer.innerHTML = `
      <div style="margin-top:20px; animation: fadeIn 0.3s ease;">
        <div style="background:linear-gradient(135deg, #10b981, #047857); padding:12px 16px; border-radius:10px; margin-bottom:16px; color:#fff; display:flex; align-items:center; justify-content:space-between;">
          <span style="font-weight:800; font-size:14px;">🎯 JANUSZ 3000 DOPASOWAŁ ${matches.length} ROZWIĄZAŃ DLA CIEBIE:</span>
          <span style="font-size:12px; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:6px;">Tryb: ${budget==='0'?'0 zł':budget+' zł'}</span>
        </div>

        ${matches.map(p => renderPatentCardHtml(p)).join('')}
      </div>
    `;

    resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // --- INTERAKCJE I API GLOBALNE ---
  global.setDruciarstwoTab = function (tab) {
    activeTab = tab;
    renderDruciarstwo();
  };

  global.setFilterCategory = function (cat) {
    activeFilterCategory = cat;
    renderDruciarstwo();
  };

  global.setFilterSafety = function (saf) {
    activeFilterSafety = saf;
    renderDruciarstwo();
  };

  global.toggleFilterZeroCost = function () {
    activeFilterZeroCost = !activeFilterZeroCost;
    renderDruciarstwo();
  };

  global.handlePatentSearch = function (q) {
    patentSearchQuery = q;
    renderDruciarstwo();
  };

  global.activateZeroCostMode = function () {
    const sel = document.getElementById('januszBudget');
    if (sel) sel.value = '0';
    activeFilterZeroCost = true;
    alert('🪙 Aktywowano tryb 0 zł! Generator wybiera tylko patenty z darmowych materiałów garażowych.');
  };

  global.toggleFavorite = function (id) {
    let favs = getFavorites();
    if (favs.includes(id)) {
      favs = favs.filter(x => x !== id);
    } else {
      favs.push(id);
    }
    saveFavoritesList(favs);
    renderDruciarstwo();
  };

  global.ratePatent = function (id, stars) {
    let ratings = getRatings();
    ratings[id] = stars;
    saveRatingsMap(ratings);
    renderDruciarstwo();
  };

  global.clearPatentHistory = function () {
    localStorage.removeItem(STORAGE_HISTORY);
    renderDruciarstwo();
  };

  global.showPatentDetails = function (id) {
    addHistoryItem(id);
    activeTab = 'baza';
    patentSearchQuery = '';
    renderDruciarstwo();
    const el = document.getElementById('card-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // --- ZDJĘCIA W KREATORZE ---
  let tempPhotoBase64 = '';
  global.handlePhotoPreview = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      tempPhotoBase64 = e.target.result;
      const preview = document.getElementById('cPhotoPreview');
      const img = document.getElementById('cPhotoImg');
      if (preview && img) {
        img.src = tempPhotoBase64;
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  };

  global.handleCustomPatentSubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const title = (document.getElementById('cTitle')?.value || '').trim();
    const subtitle = (document.getElementById('cSubtitle')?.value || '').trim();
    const category = document.getElementById('cCategory')?.value || 'dtt';
    const cost = (document.getElementById('cCost')?.value || '0 zł').trim();
    const level = parseInt(document.getElementById('cLevel')?.value || '2', 10);
    const safety = document.getElementById('cSafety')?.value || 'temp';
    const materialsStr = (document.getElementById('cMaterials')?.value || '').trim();
    const toolsStr = (document.getElementById('cTools')?.value || '').trim();
    const instructionsStr = (document.getElementById('cInstructions')?.value || '').trim();

    if (!title || !instructionsStr) {
      alert('Podaj tytuł oraz instrukcję wykonania patentu!');
      return;
    }

    const newPatent = {
      id: 'cust-' + Date.now(),
      category: category,
      title: title,
      subtitle: subtitle || 'Własny patent garażowy',
      level: level,
      safety: safety,
      cost: cost,
      time: 'Własny czas',
      rating: 5.0,
      votes: 1,
      vehicle: 'Uniwersalne',
      materials: materialsStr ? materialsStr.split(',').map(s=>s.trim()) : ['Materiały z garażu'],
      tools: toolsStr ? toolsStr.split(',').map(s=>s.trim()) : ['Klucze'],
      description: title,
      instructions: instructionsStr.split('\n').filter(s=>s.trim()),
      durability: 'Zależna od wykonania',
      limits: 'Pamiętaj o zasadach Czerwonej Linii',
      testMethod: 'Test przed jazdą',
      isTested: true,
      photo: tempPhotoBase64 || null
    };

    const list = getCustomPatents();
    list.unshift(newPatent);
    saveCustomPatentsList(list);

    tempPhotoBase64 = '';
    alert('✅ Patent został pomyślnie zapisany w Twojej bazie!');
    renderDruciarstwo();
  };

  global.deleteCustomPatent = function (id) {
    if (!confirm('Czy na pewno chcesz usunąć ten patent ze swojej bazy?')) return;
    let list = getCustomPatents().filter(p => p.id !== id);
    saveCustomPatentsList(list);
    renderDruciarstwo();
  };

  // --- EKSPORT / IMPORT JSON ---
  global.exportDruciarstwoJson = function () {
    const data = {
      app: 'NAPRAWNIK',
      module: 'DRUCIARSTWO_ULTIMATE',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      customPatents: getCustomPatents(),
      favorites: getFavorites(),
      ratings: getRatings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `naprawnik-patenty-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  global.importDruciarstwoJson = function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.customPatents)) {
          const current = getCustomPatents();
          const existingIds = new Set(current.map(x => x.id));
          data.customPatents.forEach(p => {
            if (!existingIds.has(p.id)) current.push(p);
          });
          saveCustomPatentsList(current);
        }
        if (Array.isArray(data.favorites)) {
          const favs = Array.from(new Set([...getFavorites(), ...data.favorites]));
          saveFavoritesList(favs);
        }
        if (data.ratings && typeof data.ratings === 'object') {
          const rat = { ...getRatings(), ...data.ratings };
          saveRatingsMap(rat);
        }
        alert('✅ Pomyślnie zaimportowano patenty z pliku JSON!');
        renderDruciarstwo();
      } catch (err) {
        alert('Błąd podczas importu pliku JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  function attachDruciarstwoListeners() {
    const probSelect = document.getElementById('januszProblem');
    if (probSelect) {
      probSelect.addEventListener('change', function () {
        const customGroup = document.getElementById('januszCustomProblemGroup');
        if (customGroup) customGroup.style.display = (this.value === 'custom') ? 'block' : 'none';
      });
    }
  }

  // Eksport główny
  global.renderDruciarstwo = renderDruciarstwo;
  global.handleJanuszSubmit = handleJanuszSubmit;
  global.DRUCIARSTWO_DATABASE = BUILTIN_PATENTS;
  global.DRUCIARSTWO_RECYCLE = RECYCLE_DATABASE;
  global.DRUCIARSTWO_LEVELS = LEVELS;
  global.DRUCIARSTWO_SAFETY = SAFETY;

  console.log('✓ Moduł DRUCIARSTWO ULTIMATE zainicjalizowany.');
})(typeof window !== 'undefined' ? window : this);
