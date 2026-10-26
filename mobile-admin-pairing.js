/* Android-only owner-device pairing UI. This file is copied into www/ only. */
(() => {
  'use strict';

  // Do not change the browser application: this enhancement exists only in the Capacitor bundle.
  if (typeof location === 'undefined' || location.hostname !== 'localhost') return;

  const API = 'https://naprawnik-subscriptions-live.turbodiesel966.workers.dev';
  const TOKEN_KEY = 'naprawnik_api_token';
  const CODE_PATTERN = /^NP-MOB-[A-F0-9]{24}$/;
  const originalOpenAdminPanel = window.npOpenAdminPanel;
  if (typeof originalOpenAdminPanel !== 'function') return;

  function messageFor(error) {
    if (error && error.status === 401) return 'Kod jest nieprawidłowy, wykorzystany albo wygasł. Wygeneruj nowy kod na działającym urządzeniu właściciela.';
    if (error && error.status === 403) return 'Ten kod nie jest przypisany do aktywnego konta właściciela.';
    if (error && error.status === 429) return 'Wykonano zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
    return 'Nie udało się połączyć telefonu. Sprawdź internet i spróbuj ponownie.';
  }

  async function pairExistingOwner(code) {
    const response = await fetch(API + '/api/admin/mobile-login', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      credentials: 'omit',
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || !/^[a-f0-9]{64}$/.test(String(data.token || ''))) {
      const error = new Error('Pairing failed');
      error.status = response.status;
      throw error;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  function renderPairingScreen() {
    const root = document.querySelector('#screen');
    if (!root) return originalOpenAdminPanel();
    root.innerHTML = '<div class="card"><h2>📱 Połącz telefon właściciela</h2>' +
      '<p style="line-height:1.5">To nie jest kod abonamentu. Na urządzeniu, na którym panel właściciela już działa, otwórz Ustawienia → Właściciel aplikacji / ADMIN → Połącz telefon z kontem właściciela i wygeneruj kod.</p>' +
      '<p style="color:var(--dim);font-size:12px;line-height:1.5">Kod działa 10 minut i tylko raz. Po połączeniu ten telefon uzyska dostęp do tego samego konta właściciela.</p>' +
      '<label for="npMobileOwnerCode">Kod połączenia telefonu</label><input id="npMobileOwnerCode" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="31" placeholder="NP-MOB-…">' +
      '<button class="btn" id="npMobileOwnerSubmit" type="button">Połącz telefon</button><div id="npMobileOwnerStatus" role="status" style="font-size:12px;line-height:1.5;margin-top:10px"></div>' +
      '<button class="btn" type="button" id="npMobileOwnerBack">← Wróć do ustawień</button></div>';
    const input = document.getElementById('npMobileOwnerCode');
    const status = document.getElementById('npMobileOwnerStatus');
    document.getElementById('npMobileOwnerBack').addEventListener('click', () => {
      if (typeof window.nav === 'function') window.nav('settings');
    });
    document.getElementById('npMobileOwnerSubmit').addEventListener('click', async () => {
      const code = String(input.value || '').trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) {
        status.textContent = 'Wpisz pełny kod połączenia w formacie NP-MOB-…';
        return;
      }
      status.textContent = 'Łączę telefon z istniejącym kontem właściciela…';
      try {
        await pairExistingOwner(code);
        await originalOpenAdminPanel();
      } catch (error) {
        status.textContent = messageFor(error);
      }
    });
    input.focus();
  }

  window.npOpenAdminPanel = function() {
    try {
      if (localStorage.getItem(TOKEN_KEY)) return originalOpenAdminPanel();
    } catch (_) { return originalOpenAdminPanel(); }
    renderPairingScreen();
  };
})();
