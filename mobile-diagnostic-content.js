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

  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"version":1,"cases":[]}');
      if (!value || value.version !== BACKUP_VERSION || !Array.isArray(value.cases)) return [];
      return value.cases.filter(validCase).map(normalizeCase).slice(0, MAX_CASES);
    } catch (_) { return []; }
  }
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
  function baseCases() {
    try {
      if (Array.isArray(window.knowledgeCases)) return window.knowledgeCases;
    } catch (_) {}
    // knowledgeCases is a top-level const in the existing app bundle; this script
    // obtains a safe serialized snapshot through the APK-only bridge installed below.
    return Array.isArray(window.__npKnowledgeCasesSnapshot) ? window.__npKnowledgeCasesSnapshot : [];
  }
  function allCases() {
    const base = baseCases().map(normalizeCase);
    const saved = readSaved();
    const byId = new Map(base.map(item => [item.id, item]));
    saved.forEach(item => byId.set(item.id, item));
    return [...byId.values()];
  }
  function saveCases(cases) {
    if (!Array.isArray(cases) || cases.length > MAX_CASES) throw new Error('Przekroczono limit liczby usterek.');
    const seen = new Set();
    const normalized = cases.map(normalizeCase);
    for (const item of normalized) {
      if (!validCase(item)) throw new Error('Wpis ma nieprawidłowe lub puste pola.');
      if (seen.has(item.id)) throw new Error('Identyfikatory usterek muszą być unikalne.');
      seen.add(item.id);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version: BACKUP_VERSION, updatedAt: new Date().toISOString(), cases: normalized}));
    window.__npOwnerDiagnosticOverrides = normalized;
    if (typeof window.renderKnowledge === 'function') window.renderKnowledge();
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
      const data={format:'naprawnik-diagnostic-cases',version:BACKUP_VERSION,exportedAt:new Date().toISOString(),cases:readSaved()};
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
        if(!normalized.every(validCase)||new Set(normalized.map(c=>c.id)).size!==normalized.length)throw new Error('Dane nie przeszły walidacji lub identyfikatory się powtarzają.');
        if(!confirm('Import zastąpi wszystkie własne zmiany zapisane na tym telefonie. Wykonać import?'))return;
        saveCases(normalized);renderManager();statusText('Zaimportowano '+normalized.length+' wpisów. Zapisz kopię przed kolejnymi zmianami.');
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