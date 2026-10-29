/* NAPRAWNIK — Android-only owner editor for the diagnostic knowledge base.
 * Included only in the Capacitor APK bundle. Never modifies the web/PWA build.
 * Existing server-authorized ADMIN panel remains the access gate.
 */
(() => {
  'use strict';
  if (typeof location === 'undefined' || location.hostname !== 'localhost') return;

  const STORAGE_KEY = 'naprawnik_mobile_diagnostic_cases_v1';
  const BACKUP_VERSION = 1;
  const MAX_CASES = 600;
  const MAX_TEXT = 5000;
  const AREA_TITLES = ['Objawy i rozpoznanie', 'Możliwe przyczyny', 'Testy i potwierdzenie', 'Zalecane rozwiązanie'];
  const idPattern = /^[a-z0-9][a-z0-9_-]{2,63}$/;
  const originalNav = window.nav;

  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"version":1,"cases":[],"deletedIds":[]}');
      if (!value || value.version !== BACKUP_VERSION || !Array.isArray(value.cases)) return { cases: [], deletedIds: [] };
      return { cases: value.cases.filter(validCase).map(normalizeCase).slice(0, MAX_CASES),
        deletedIds: Array.isArray(value.deletedIds) ? value.deletedIds.filter(x => idPattern.test(String(x))).slice(0, MAX_CASES) : [] };
    } catch (_) { return { cases: [], deletedIds: [] }; }
  }
  function readSaved() { return readState().cases; }
  function normalizeCase(item) {
    return {
      id: String(item.id).trim(),
      title: String(item.title || '').trim().slice(0, 180),
      tags: String(item.tags || '').trim().slice(0, 400),
      category: String(item.category || 'Diagnostyka ogólna').trim().slice(0, 100),
      evidence: ['confirmed','partial','unlinked'].includes(item.evidence) ? item.evidence : 'unlinked',
      source: item.source && typeof item.source === 'object' ? {
        label: String(item.source.label || '').trim().slice(0, 180),
        url: /^https:\/\//i.test(String(item.source.url || '')) ? String(item.source.url).slice(0, 1000) : ''
      } : null,
      areas: (Array.isArray(item.areas) ? item.areas : []).slice(0, 8).map(pair => [
        String(pair && pair[0] || '').trim().slice(0, 120),
        String(pair && pair[1] || '').trim().slice(0, MAX_TEXT)
      ]).filter(pair => pair[0] && pair[1])
    };
  }
  function validCase(item) {
    if (!item || typeof item !== 'object' || !idPattern.test(String(item.id || ''))) return false;
    if (!String(item.title || '').trim() || String(item.title).length > 180) return false;
    if (!Array.isArray(item.areas) || !item.areas.length || item.areas.length > 8) return false;
    return item.areas.every(pair => Array.isArray(pair) && String(pair[0] || '').trim() &&
      String(pair[0]).length <= 120 && String(pair[1] || '').trim() && String(pair[1]).length <= MAX_TEXT);
  }

  // Additional symptom cards cross-checked against published scooter service manuals.
  // These are diagnostic leads, not proof that any single component has failed.
  const SERVICE_MANUAL_SUPPLEMENTS = [
    {
      id:'manual-fuel-starvation-after-minutes',
      title:'Silnik gaśnie po kilku minutach, po postoju znów odpala',
      tags:'gaśnie po czasie odpowietrznik baku przepływ paliwa kranik podciśnieniowy filtr',
      category:'Paliwo i dolot', evidence:'partial',
      source:{label:'Honda SA50 Service Manual — troubleshooting',url:'https://www.49ccscoot.com/manuals/Honda_SA50_Service_Manual.pdf'},
      areas:[
        ['Objaw i rozpoznanie','Silnik uruchamia się normalnie, następnie traci moc lub gaśnie; po krótkim postoju może ponownie odpalać. Objaw nie przesądza o przyczynie.'],
        ['Możliwe przyczyny','Ograniczone odpowietrzenie zbiornika, częściowo zatkany filtr lub przewód paliwowy, kranik podciśnieniowy albo pompa nie zapewnia stałego przepływu.'],
        ['Testy i potwierdzenie','Po bezpiecznym zatrzymaniu porównaj objaw przy sprawnym odpowietrzeniu i sprawdź przepływ paliwa według instrukcji konkretnego modelu. Zapisz, czy w chwili awarii iskra jest nadal obecna.'],
        ['Zalecane rozwiązanie','Usuń potwierdzone ograniczenie przepływu lub napraw element wskazany testem. Nie wymieniaj pompy ani kranika wyłącznie na podstawie tego objawu.']
      ]
    },
    {
      id:'manual-plug-wet-flooded-start',
      title:'Świeca mokra po nieudanych próbach rozruchu',
      tags:'mokra świeca zalany silnik ssanie automatyczne gaźnik rozruch',
      category:'Paliwo i dolot', evidence:'partial',
      source:{label:'Honda SA50 Service Manual — engine troubleshooting',url:'https://www.49ccscoot.com/manuals/Honda_SA50_Service_Manual.pdf'},
      areas:[
        ['Objaw i rozpoznanie','Po kilku próbach rozruchu elektroda świecy jest mokra. Mokra świeca może wynikać zarówno z zalania, jak i z braku skutecznego spalania.'],
        ['Możliwe przyczyny','Zalanie gaźnika, nadmierna dawka paliwa, ssanie automatyczne niedziałające prawidłowo, słaba iskra lub niska kompresja.'],
        ['Testy i potwierdzenie','Sprawdź stan świecy, działanie ssania i poziom paliwa, a następnie potwierdź iskrę odpowiednim testerem oraz kompresję zgodnie z DTR.'],
        ['Zalecane rozwiązanie','Osusz lub wymień świecę zgodnie z procedurą producenta i usuń potwierdzoną przyczynę zalewania. Nie zwiększaj liczby prób rozruchu bez diagnozy.']
      ]
    },
    {
      id:'manual-afterfire-deceleration',
      title:'Strzały w wydech po zamknięciu gazu',
      tags:'strzały wydech odpuszczenie gazu air cut zawór powietrze wtórne podciśnienie',
      category:'Paliwo i dolot', evidence:'partial',
      source:{label:'KYMCO Agility City 125 Service Manual — emission troubleshooting',url:'https://www.manualslib.com/manual/869243/Honda-Agility-City-125.html?page=182'},
      areas:[
        ['Objaw i rozpoznanie','Pojawiają się trzaski lub strzały w wydechu po odpuszczeniu przepustnicy. Drobny odgłos nie identyfikuje automatycznie uszkodzonego elementu.'],
        ['Możliwe przyczyny','Nieszczelność wydechu lub dolotu, problem z przewodem podciśnienia, regulacją gaźnika albo zaworem odcinającym powietrze (air-cut), jeśli występuje w danym modelu.'],
        ['Testy i potwierdzenie','Sprawdź szczelność układu wydechowego, przewody podciśnienia i regulację według instrukcji modelowej. Jeśli pojazd ma air-cut/układ powietrza wtórnego, sprawdź go według właściwej procedury.'],
        ['Zalecane rozwiązanie','Napraw tylko znalezioną nieszczelność lub niesprawny element. Nie reguluj gaźnika według uniwersalnych wartości.']
      ]
    },
    {
      id:'manual-power-loss-wide-open-throttle',
      title:'Silnik traci moc tylko przy dużym otwarciu gazu',
      tags:'brak mocy pełny gaz wysokie obroty dysza główna odpowietrznik baku filtr paliwo',
      category:'Paliwo i dolot', evidence:'partial',
      source:{label:'Honda SA50 Service Manual — poor high-speed performance',url:'https://www.49ccscoot.com/manuals/Honda_SA50_Service_Manual.pdf'},
      areas:[
        ['Objaw i rozpoznanie','Na małym gazie pojazd pracuje lepiej, a pod większym obciążeniem dławi się lub traci moc. Najpierw odróżnij przerwę pracy silnika od poślizgu CVT.'],
        ['Możliwe przyczyny','Ograniczony dopływ paliwa, zatkany odpowietrznik zbiornika, filtr lub dysza główna, ograniczony dolot/wydech albo słaby zapłon pod obciążeniem.'],
        ['Testy i potwierdzenie','Sprawdź przepływ paliwa i drożność elementów według DTR. Jeśli obroty rosną bez przyrostu prędkości, skontroluj pasek, wariator i sprzęgło CVT osobno. Nie wykonuj prób maksymalnej prędkości na drodze publicznej.'],
        ['Zalecane rozwiązanie','Przywróć drożność lub napraw element potwierdzony testem. Nie zmieniaj dyszy ani masy rolek bez identyfikacji dokładnej konfiguracji.']
      ]
    },
    {
      id:'manual-scooter-creeps-at-idle',
      title:'Skuter próbuje ruszać na biegu jałowym',
      tags:'ciągnie na postoju rusza sam sprzęgło odśrodkowe szczęki sprężyna CVT',
      category:'CVT / napęd', evidence:'partial',
      source:{label:'Honda Common Service Manual — V-Matic drive troubleshooting',url:'https://scootertuub.nl/motoren/Honda/Honda%20Common%20Service%20Manual%20MOTORCYCLES%20.pdf'},
      areas:[
        ['Objaw i rozpoznanie','Tylne koło jest napędzane mocniej niż oczekiwano przy wolnych obrotach albo pojazd próbuje ruszać bez dodania gazu.'],
        ['Możliwe przyczyny','Sprzęgło odśrodkowe nie odłącza napędu prawidłowo, mechanizm szczęk lub sprężyny jest uszkodzony, albo prędkość biegu jałowego jest nieprawidłowa.'],
        ['Testy i potwierdzenie','Zabezpiecz skuter stabilnie, sprawdź prędkość jałową oraz stan sprzęgła według DTR. Obejrzyj szczęki, sprężyny i elementy współpracujące po wyłączeniu silnika.'],
        ['Zalecane rozwiązanie','Nie kontynuuj jazdy, jeśli skuter sam próbuje ruszać. Napraw układ po znalezieniu przyczyny; nie uruchamiaj napędu z otwartą osłoną CVT.']
      ]
    },
    {
      id:'manual-engine-running-scooter-no-drive',
      title:'Silnik pracuje, lecz skuter nie przenosi napędu',
      tags:'silnik pracuje nie jedzie pasek CVT sprzęgło wariator przekładnia',
      category:'CVT / napęd', evidence:'partial',
      source:{label:'Honda Common Service Manual — V-Matic drive troubleshooting',url:'https://scootertuub.nl/motoren/Honda/Honda%20Common%20Service%20Manual%20MOTORCYCLES%20.pdf'},
      areas:[
        ['Objaw i rozpoznanie','Silnik daje się uruchomić, lecz tylne koło nie otrzymuje napędu lub prędkość nie rośnie w normalny sposób.'],
        ['Możliwe przyczyny','Pęknięty/zużyty pasek napędowy, uszkodzenie wariatora, sprzęgła odśrodkowego lub przekładni końcowej.'],
        ['Testy i potwierdzenie','Wyłącz silnik i sprawdź pasek, wariator, sprzęgło i widoczne elementy przekładni. Zmierz pasek i porównaj z limitem serwisowym dokładnego wariantu.'],
        ['Zalecane rozwiązanie','Wymień jedynie część potwierdzoną oględzinami/pomiarem i użyj właściwej blokady oraz momentów dokręcania według instrukcji. Nie uruchamiaj silnika z odsłoniętym napędem.']
      ]
    },
    {
      id:'manual-runs-rough-after-long-storage',
      title:'Nierówna praca po dłuższym postoju',
      tags:'stare paliwo gaźnik dysze zaworek iglicowy ssanie automatyczne',
      category:'Paliwo i dolot', evidence:'partial',
      source:{label:'KYMCO Agility City 125 Service Manual — fuel system troubleshooting',url:'https://www.manualslib.com/manual/869243/Honda-Agility-City-125.html?page=57'},
      areas:[
        ['Objaw i rozpoznanie','Po dłuższym postoju silnik odpala, lecz pracuje nierówno, gaśnie albo słabo reaguje na gaz.'],
        ['Możliwe przyczyny','Stare lub zanieczyszczone paliwo, zatkane kanały gaźnika/dysze, zacinający się zaworek iglicowy lub niedziałające automatyczne ssanie.'],
        ['Testy i potwierdzenie','Zweryfikuj stan paliwa, filtr, napełnianie komory pływakowej i działanie ssania według instrukcji konkretnego gaźnika. Nie rozwiercaj dysz.'],
        ['Zalecane rozwiązanie','Usuń zanieczyszczone paliwo w bezpieczny sposób i wyczyść/sprawdź element wskazany testem; ustawienia i poziom pływaka tylko według DTR.']
      ]
    },
    {
      id:'manual-spark-no-start-compression-reeds',
      title:'Jest iskra, ale silnik nadal nie odpala',
      tags:'jest iskra nie odpala kompresja zawór membranowy 2T zawory rozrząd 4T',
      category:'Diagnostyka ogólna', evidence:'partial',
      source:{label:'Honda SA50 Service Manual — engine troubleshooting',url:'https://www.49ccscoot.com/manuals/Honda_SA50_Service_Manual.pdf'},
      areas:[
        ['Objaw i rozpoznanie','Widoczna iskra poza cylindrem nie potwierdza, że zapłon działa pod ciśnieniem ani że paliwo i kompresja są prawidłowe.'],
        ['Możliwe przyczyny','Niska kompresja, niewłaściwa mieszanka lub brak dostarczania paliwa, nieszczelność dolotu/skrzy­ni korbowej albo uszkodzona membrana w 2T; w 4T także luz zaworowy lub fazy rozrządu.'],
        ['Testy i potwierdzenie','Potwierdź paliwo, kompresję i szczelność według instrukcji silnika. W 4T sprawdź rozrząd i luz zaworowy zgodnie z DTR.'],
        ['Zalecane rozwiązanie','Nie wymieniaj modułu CDI wyłącznie dlatego, że silnik nie odpala. Przejdź kolejno przez zapłon, paliwo, dolot i testy mechaniczne.']
      ]
    }
  ].map(item => Object.assign({tags:''}, item));

  function baseCases() {
    if (Array.isArray(window.__npKnowledgeCasesBaseSnapshot)) return window.__npKnowledgeCasesBaseSnapshot;
    if (Array.isArray(window.knowledgeCases)) return window.knowledgeCases;
    if (Array.isArray(window.__npKnowledgeCasesSnapshot)) {
      const snapshot = window.__npKnowledgeCasesSnapshot;
      const known = new Set(snapshot.map(item => item.id));
      return snapshot.concat(SERVICE_MANUAL_SUPPLEMENTS.filter(item => !known.has(item.id)));
    }
    return SERVICE_MANUAL_SUPPLEMENTS.slice();
  }
  function allCases() {
    const base = baseCases().map(normalizeCase);
    const state = readState();
    const byId = new Map(base.map(item => [item.id, item]));
    state.cases.forEach(item => byId.set(item.id, item));
    return [...byId.values()].filter(item => !state.deletedIds.includes(item.id));
  }
  function saveCases(cases, deletedIds) {
    if (!Array.isArray(cases) || cases.length > MAX_CASES) throw new Error('Przekroczono limit liczby usterek.');
    const seen = new Set();
    const normalized = cases.map(normalizeCase);
    for (const item of normalized) {
      if (!validCase(item)) throw new Error('Wpis ma nieprawidłowe lub puste pola.');
      if (seen.has(item.id)) throw new Error('Identyfikatory usterek muszą być unikalne.');
      seen.add(item.id);
    }
    const deleted = Array.from(new Set((deletedIds || readState().deletedIds).filter(x => idPattern.test(String(x))))).slice(0, MAX_CASES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version: BACKUP_VERSION, updatedAt: new Date().toISOString(), cases: normalized, deletedIds: deleted}));
    window.__npOwnerDiagnosticOverrides = normalized;
    if (typeof window.__npApplyOwnerDiagnosticCases === 'function') window.__npApplyOwnerDiagnosticCases();
    if (document.querySelector('#knowledgeCards') && typeof window.renderKnowledge === 'function') window.renderKnowledge();
  }
  function makeId(title) {
    const stem = String(title || 'usterka').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,38) || 'usterka';
    const base = 'owner-' + stem;
    let id = base, n = 2;
    const ids = new Set(allCases().map(item => item.id));
    while (ids.has(id)) id = base + '-' + n++;
    return id;
  }
  function statusText(message, isError) {
    const el = document.getElementById('npOwnerFaultStatus');
    if (el) { el.textContent = message; el.style.color = isError ? '#ff7878' : 'var(--cyan)'; }
  }
  function openEditor(id) {
    const item = id ? allCases().find(c => c.id === id) : null;
    const form = document.getElementById('npOwnerFaultForm');
    if (!form) return;
    const current = item || {id:'', title:'', tags:'', category:'Diagnostyka ogólna', evidence:'unlinked', source:{label:'',url:''}, areas:[['Objawy i rozpoznanie','',''],['Możliwe przyczyny',''],['Testy i potwierdzenie',''],['Zalecane rozwiązanie','']]};
    form.innerHTML =
      '<h3 style="margin:8px 0;color:var(--hero)">'+(item?'✏️ Edytuj usterkę':'➕ Dodaj nową usterkę')+'</h3>' +
      '<label for="npFaultTitle">Nazwa usterki / objaw</label><input id="npFaultTitle" maxlength="180" value="'+escapeHtml(current.title)+'" placeholder="Np. Silnik gaśnie po rozgrzaniu">' +
      '<label for="npFaultTags">Słowa kluczowe</label><input id="npFaultTags" maxlength="400" value="'+escapeHtml(current.tags)+'" placeholder="np. 2T, CDI, gaśnie, cewka">' +
      '<label for="npFaultCategory">Kategoria</label><select id="npFaultCategory">'+['Diagnostyka ogólna','Silnik 2T','Silnik 4T','Paliwo i dolot','Elektryka / zapłon','CVT / napęd','Hamulce i podwozie','Chłodzenie','EFI / wtrysk','AM6 / Derbi','Inne'].map(v=>'<option'+(current.category===v?' selected':'')+'>'+escapeHtml(v)+'</option>').join('')+'</select>' +
      '<label for="npFaultEvidence">Status weryfikacji</label><select id="npFaultEvidence"><option value="unlinked"'+(current.evidence==='unlinked'?' selected':'')+'>Do weryfikacji / bez serwisówki</option><option value="partial"'+(current.evidence==='partial'?' selected':'')+'>Częściowo potwierdzone</option><option value="confirmed"'+(current.evidence==='confirmed'?' selected':'')+'>Potwierdzone w dokumentacji</option></select>' +
      '<label for="npFaultSourceLabel">Źródło / serwisówka (opcjonalnie)</label><input id="npFaultSourceLabel" maxlength="180" value="'+escapeHtml(current.source?.label||'')+'" placeholder="Nazwa dokumentu lub model">' +
      '<label for="npFaultSourceUrl">Link do źródła HTTPS (opcjonalnie)</label><input id="npFaultSourceUrl" maxlength="1000" value="'+escapeHtml(current.source?.url||'')+'" placeholder="https://…">' +
      AREA_TITLES.map((label,i)=>'<label for="npFaultAreaTitle'+i+'">'+label+' — nagłówek</label><input id="npFaultAreaTitle'+i+'" maxlength="120" value="'+escapeHtml(current.areas[i]?.[0]||label)+'"><label for="npFaultAreaText'+i+'">'+label+' — treść</label><textarea id="npFaultAreaText'+i+'" rows="3" maxlength="'+MAX_TEXT+'" placeholder="Opisz kroki, testy i ograniczenia…">'+escapeHtml(current.areas[i]?.[1]||'')+'</textarea>').join('') +
      '<button class="btn" id="npFaultSave" type="button">💾 Zapisz usterkę</button><button class="btn" id="npFaultCancel" type="button">Anuluj edycję</button>';
    document.getElementById('npFaultSave').addEventListener('click', () => {
      const title = document.getElementById('npFaultTitle').value.trim();
      const next = normalizeCase({
        id: item ? item.id : makeId(title), title,
        tags: document.getElementById('npFaultTags').value,
        category: document.getElementById('npFaultCategory').value,
        evidence: document.getElementById('npFaultEvidence').value,
        source: {label:document.getElementById('npFaultSourceLabel').value,url:document.getElementById('npFaultSourceUrl').value},
        areas: AREA_TITLES.map((label,i)=>[document.getElementById('npFaultAreaTitle'+i).value || label,document.getElementById('npFaultAreaText'+i).value])
      });
      if (!validCase(next)) { statusText('Uzupełnij nazwę i co najmniej jeden opis. Sprawdź długość pól.', true); return; }
      if (next.source.url && !/^https:\/\//i.test(next.source.url)) { statusText('Link do źródła musi zaczynać się od https://', true); return; }
      try {
        const currentCases = allCases();
        const id = item ? item.id : next.id;
        const without = currentCases.filter(c=>c.id!==id && !readSaved().some(s=>s.id===c.id));
        // Store only custom changes to avoid copying the entire baked-in reference library to localStorage.
        const custom = readSaved().filter(c=>c.id!==id);
        const replacement = item && !item.id.startsWith('owner-') ? next : next;
        custom.push(replacement);
        saveCases(custom);
        statusText('Zapisano lokalnie. Zmiana jest na tym urządzeniu; eksportuj kopię przed aktualizacją APK.', false);
        openEditor(next.id);
      } catch(e) { statusText('Nie udało się zapisać: '+(e.message||e), true); }
    });
    document.getElementById('npFaultCancel').addEventListener('click', () => { form.innerHTML=''; });
  }
  function renderManager() {
    const host = document.getElementById('npOwnerFaultManager');
    if (!host) return;
    const query = (document.getElementById('npFaultSearch')?.value || '').toLocaleLowerCase('pl');
    const list = allCases().filter(c=>(c.title+' '+c.tags+' '+c.category).toLocaleLowerCase('pl').includes(query));
    host.innerHTML = list.map(c => '<div class="entry"><b>'+escapeHtml(c.title)+'</b><small>'+escapeHtml(c.category)+' · '+escapeHtml(c.id)+'</small><button class="btn" type="button" data-edit-fault="'+escapeHtml(c.id)+'">Edytuj</button><button class="btn" type="button" data-remove-fault="'+escapeHtml(c.id)+'">Usuń zmianę</button></div>').join('') || '<p class="empty">Brak wyników.</p>';
    host.querySelectorAll('[data-edit-fault]').forEach(button=>button.addEventListener('click',()=>openEditor(button.dataset.editFault)));
    host.querySelectorAll('[data-remove-fault]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.removeFault;
      if (!confirm('Usunąć własną zmianę dla tej usterki? Wpis bazowy zostanie, jeśli nie był dodany przez Ciebie.')) return;
      const updated=readSaved().filter(c=>c.id!==id);
      try { saveCases(updated); renderManager(); statusText('Usunięto własną zmianę. Oryginalne karty bazowe pozostają bez zmian.'); }
      catch(e) { statusText(e.message||'Nie udało się usunąć wpisu.',true); }
    }));
  }
  function openManager() {
    const root=document.querySelector('#screen');
    if(!root) return;
    root.innerHTML =
      '<button class="btn back" id="npFaultBack" type="button">← Wróć do ADMINA</button>' +
      '<div class="card"><h2>🧰 Edytor bazy usterek</h2><p style="font-size:12px;line-height:1.5;color:var(--dim)">Edycje są zapisywane na tym telefonie i nie publikują się jeszcze innym użytkownikom. Nie potwierdzaj danych technicznych bez serwisówki konkretnego modelu.</p>' +
      '<input id="npFaultSearch" placeholder="Szukaj usterek, słów kluczowych lub kategorii">' +
      '<button class="btn" id="npFaultAdd" type="button">➕ Dodaj nową usterkę</button>' +
      '<div id="npOwnerFaultStatus" role="status" style="font-size:12px;margin:8px 0"></div><div id="npOwnerFaultForm"></div><div id="npOwnerFaultManager"></div>' +
      '<button class="btn" id="npFaultExport" type="button">⬇️ Eksportuj kopię JSON</button><label for="npFaultImportFile">Importuj kopię JSON</label><input id="npFaultImportFile" type="file" accept="application/json,.json">' +
      '</div>';
    document.getElementById('npFaultBack').addEventListener('click',()=>originalNav ? originalNav('settings') : null);
    document.getElementById('npFaultSearch').addEventListener('input',renderManager);
    document.getElementById('npFaultAdd').addEventListener('click',()=>openEditor(null));
    document.getElementById('npFaultExport').addEventListener('click',()=>{
      const state=readState();
      const data={format:'naprawnik-diagnostic-cases',version:BACKUP_VERSION,exportedAt:new Date().toISOString(),cases:state.cases,deletedIds:state.deletedIds};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='naprawnik-usterki-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
      statusText('Eksportowano '+data.cases.length+' własnych zmian do JSON.');
    });
    document.getElementById('npFaultImportFile').addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      if(file.size>2*1024*1024){statusText('Plik kopii jest za duży (limit 2 MB).',true);event.target.value='';return;}
      try {
        const data=JSON.parse(await file.text());
        if(!data||data.format!=='naprawnik-diagnostic-cases'||data.version!==BACKUP_VERSION||!Array.isArray(data.cases)||data.cases.length>MAX_CASES)throw new Error('Nieprawidłowy format kopii JSON.');
        const normalized=data.cases.map(normalizeCase);
        const deleted=Array.isArray(data.deletedIds)?data.deletedIds.filter(x=>idPattern.test(String(x))):[];
        if(!normalized.every(validCase)||new Set(normalized.map(c=>c.id)).size!==normalized.length||new Set(deleted).size!==deleted.length)throw new Error('Dane nie przeszły walidacji lub identyfikatory się powtarzają.');
        if(!confirm('Import zastąpi wszystkie własne zmiany oraz listę ukrytych kart zapisane na tym telefonie. Wykonać import?'))return;
        saveCases(normalized, deleted);renderManager();statusText('Zaimportowano '+normalized.length+' wpisów i '+deleted.length+' ukrytych kart.');
      } catch(e) { statusText('Import nieudany: '+(e.message||e),true); }
      finally { event.target.value=''; }
    });
    renderManager();
  }

  window.__npOwnerDiagnosticOverrides = readSaved();
  window.npOpenOwnerFaultEditor = openManager;
  window.npReadOwnerFaultOverrides = readSaved;
  window.npAllDiagnosticCases = allCases;

  // Wrap the existing knowledge browser so local owner edits are included. This is only
  // active when the APK's script is bundled; the web deployment never loads this file.
  const originalRenderKnowledge = window.renderKnowledge;
  if (typeof originalRenderKnowledge === 'function') {
    window.renderKnowledge = function() {
      const previous = window.__npKnowledgeCasesSnapshot;
      window.__npKnowledgeCasesSnapshot = previous || [];
      return originalRenderKnowledge.apply(this, arguments);
    };
  }
})();