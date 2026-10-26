/* Android-only owner-device pairing screen. Included in the Capacitor bundle only. */
(() => {
  'use strict';
  // Keep the published web/PWA flow unchanged; Capacitor's Android WebView uses localhost.
  if (typeof location === 'undefined' || location.hostname !== 'localhost') return;

  const TOKEN_KEY = 'naprawnik_api_token';
  const CODE_PATTERN = /^NP-MOB-[A-F0-9]{24}$/;
  const originalOpenAdminPanel = window.npOpenAdminPanel;
  if (typeof originalOpenAdminPanel !== 'function') return;

  function renderPairingScreen() {
    const root = document.querySelector('#screen');
    if (!root) return originalOpenAdminPanel();

    root.innerHTML = '<div class="card"><h2>📱 Połącz telefon właściciela</h2>' +
      '<p style="line-height:1.5">Na urządzeniu, na którym panel właściciela już działa, otwórz Ustawienia → Właściciel aplikacji / ADMIN → Połącz telefon z kontem właściciela i wygeneruj kod.</p>' +
      '<p style="color:var(--dim);font-size:12px;line-height:1.5">To nie jest kod abonamentu. Kod połączenia działa 10 minut i można użyć go tylko raz. Po połączeniu telefon otrzyma dostęp do istniejącego konta właściciela.</p>' +
      '<label for="npMobileOwnerCode">Jednorazowy kod połączenia</label><input id="npMobileOwnerCode" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="31" placeholder="NP-MOB-…">' +
      '<button class="btn" id="npMobileOwnerSubmit" type="button">Połącz telefon</button><div id="npMobileOwnerStatus" role="status" aria-live="polite" style="font-size:12px;line-height:1.5;margin-top:10px"></div>' +
      '<button class="btn" type="button" id="npMobileOwnerBack">← Wróć do ustawień</button></div>';

    const input = document.getElementById('npMobileOwnerCode');
    const submit = document.getElementById('npMobileOwnerSubmit');
    const status = document.getElementById('npMobileOwnerStatus');

    document.getElementById('npMobileOwnerBack').addEventListener('click', () => {
      if (typeof window.nav === 'function') window.nav('settings');
    });

    async function connectOwner() {
      const code = String(input.value || '').trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) {
        status.textContent = 'Wpisz pełny kod w formacie NP-MOB-…';
        input.focus();
        return;
      }

      submit.disabled = true;
      status.textContent = 'Weryfikuję kod i łączę telefon z kontem właściciela…';

      // The Android-only copy of billing.js accepts this callback in place of window.prompt.
      // Its existing API flow validates the code and refreshes the owner's account/plan.
      const previousProvider = window.__naprawnikAdminCodePrompt;
      const previousAlert = window.alert;
      let lastAlert = '';
      window.__naprawnikAdminCodePrompt = () => code;
      window.alert = (message) => {
        lastAlert = String(message || '');
        status.textContent = lastAlert;
      };

      try {
        const pending = originalOpenAdminPanel();
        window.__naprawnikAdminCodePrompt = previousProvider;
        await pending;
        if (lastAlert) {
          status.textContent = lastAlert;
        } else {
          status.textContent = 'Nie udało się potwierdzić połączenia. Wygeneruj nowy kod i spróbuj ponownie.';
        }
      } catch (error) {
        status.textContent = String(error && error.message || 'Nie udało się połączyć telefonu. Sprawdź internet i spróbuj ponownie.');
      } finally {
        window.__naprawnikAdminCodePrompt = previousProvider;
        window.alert = previousAlert;
        if (submit.isConnected) submit.disabled = false;
      }
    }

    submit.addEventListener('click', connectOwner);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') connectOwner();
    });
    input.focus();
  }

  window.npOpenAdminPanel = function() {
    try {
      if (localStorage.getItem(TOKEN_KEY)) return originalOpenAdminPanel();
    } catch (_) {
      return originalOpenAdminPanel();
    }
    renderPairingScreen();
  };
})();
