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
        // Pairing invokes the original ADMIN function directly, so mount the APK editor here too.
        // The existing ADMIN function has already validated the code with the server before rendering.
        mountOwnerEditor();
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


  // Owner editor for the Android bundle only. It is mounted only inside the existing
  // server-validated ADMIN panel; no second login or permission system is introduced.
  const CUSTOM_KEY = 'naprawnik_mobile_owner_customization_v1';
  const DEFAULTS = { title: 'NAPRAWNIK v5.18', welcome: '', accent: '#ff8c1a', highlight: '#ffe14d' };
  function readCustomization() {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}');
      return {
        title: String(saved.title || DEFAULTS.title).slice(0, 32),
        welcome: String(saved.welcome || '').slice(0, 180),
        accent: /^#[0-9a-fA-F]{6}$/.test(saved.accent || '') ? saved.accent : DEFAULTS.accent,
        highlight: /^#[0-9a-fA-F]{6}$/.test(saved.highlight || '') ? saved.highlight : DEFAULTS.highlight
      };
    } catch (_) { return { ...DEFAULTS }; }
  }
  function applyCustomization() {
    const value = readCustomization();
    document.documentElement.style.setProperty('--accent', value.accent);
    document.documentElement.style.setProperty('--hero', value.highlight);
    const topbar = document.querySelector('.topbar span:first-child');
    if (topbar) {
      const badge = topbar.querySelector('#planBadge');
      topbar.textContent = '⚙️ ' + value.title + ' ';
      if (badge) topbar.appendChild(badge);
    }
    document.title = value.title + ' — diagnostyka i naprawy';
    const screen = document.querySelector('#screen');
    if (screen && value.welcome && !screen.querySelector('#npOwnerWelcomeBanner') &&
        !screen.textContent.includes('Panel ADMINA') && !screen.querySelector('#npMobileOwnerCode')) {
      const banner = document.createElement('div');
      banner.id = 'npOwnerWelcomeBanner';
      banner.className = 'card';
      banner.style.borderColor = value.accent;
      const label = document.createElement('p');
      label.textContent = value.welcome;
      label.style.cssText = 'line-height:1.5;color:var(--text)';
      banner.appendChild(label);
      screen.prepend(banner);
    }
  }
  function mountOwnerEditor() {
    const root = document.querySelector('#screen');
    if (!root || !root.textContent.includes('Panel ADMINA') || root.querySelector('#npMobileOwnerEditor')) return;
    const value = readCustomization();
    const card = document.createElement('section');
    card.id = 'npMobileOwnerEditor';
    card.className = 'card';
    card.innerHTML =
      '<h2>🛠️ Edytor wyglądu APK</h2>' +
      '<p style="font-size:12px;line-height:1.5;color:var(--dim)">Pierwsza wersja edytora: zmiany dotyczą tylko tego APK i są zapisywane na tym telefonie. Uprawnienia ADMIN nadal sprawdza istniejący serwer.</p>' +
      '<label for="npOwnerAppTitle">Nazwa na górnym pasku</label><input id="npOwnerAppTitle" maxlength="32">' +
      '<label for="npOwnerWelcome">Wiadomość na ekranie głównym</label><textarea id="npOwnerWelcome" maxlength="180" rows="3" placeholder="Np. Witaj w swoim warsztacie"></textarea>' +
      '<div class="grid2"><div><label for="npOwnerAccent">Kolor akcentu</label><input id="npOwnerAccent" type="color"></div><div><label for="npOwnerHighlight">Kolor wyróżnień</label><input id="npOwnerHighlight" type="color"></div></div>' +
      '<button class="btn" id="npOwnerSaveCustomization" type="button">💾 Zapisz zmiany</button>' +
      '<button class="btn" id="npOwnerResetCustomization" type="button">Przywróć wygląd domyślny</button>' +
      '<button class="btn" id="npOwnerOpenFaultEditor" type="button">🧰 Edytuj / dodaj usterki</button>' +
      '<div id="npOwnerCustomizationStatus" role="status" style="font-size:12px;line-height:1.5;margin-top:8px"></div>';
    root.prepend(card);
    card.querySelector('#npOwnerAppTitle').value = value.title;
    card.querySelector('#npOwnerWelcome').value = value.welcome;
    card.querySelector('#npOwnerAccent').value = value.accent;
    card.querySelector('#npOwnerHighlight').value = value.highlight;
    const status = card.querySelector('#npOwnerCustomizationStatus');
    card.querySelector('#npOwnerOpenFaultEditor').addEventListener('click', () => {
      if (typeof window.npOpenOwnerFaultEditor === 'function') window.npOpenOwnerFaultEditor();
      else status.textContent = 'Edytor bazy usterek nie został dołączony do tej wersji APK.';
    });
    card.querySelector('#npOwnerSaveCustomization').addEventListener('click', () => {
      const next = {
        title: card.querySelector('#npOwnerAppTitle').value.trim() || DEFAULTS.title,
        welcome: card.querySelector('#npOwnerWelcome').value.trim(),
        accent: card.querySelector('#npOwnerAccent').value,
        highlight: card.querySelector('#npOwnerHighlight').value
      };
      if (next.title.length > 32 || next.welcome.length > 180 ||
          !/^#[0-9a-fA-F]{6}$/.test(next.accent) || !/^#[0-9a-fA-F]{6}$/.test(next.highlight)) {
        status.textContent = 'Sprawdź nazwę, wiadomość i kolory.';
        return;
      }
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
        applyCustomization();
        status.textContent = 'Zapisano. Zmiany są aktywne w tej instalacji APK.';
      } catch (_) { status.textContent = 'Nie udało się zapisać. Sprawdź wolne miejsce w aplikacji.'; }
    });
    card.querySelector('#npOwnerResetCustomization').addEventListener('click', () => {
      try { localStorage.removeItem(CUSTOM_KEY); } catch (_) {}
      card.querySelector('#npOwnerAppTitle').value = DEFAULTS.title;
      card.querySelector('#npOwnerWelcome').value = '';
      card.querySelector('#npOwnerAccent').value = DEFAULTS.accent;
      card.querySelector('#npOwnerHighlight').value = DEFAULTS.highlight;
      applyCustomization();
      status.textContent = 'Przywrócono ustawienia domyślne.';
    });
  }
  applyCustomization();
  const screenObserver = new MutationObserver(() => applyCustomization());
  const screenRoot = document.querySelector('#screen');
  if (screenRoot) screenObserver.observe(screenRoot, { childList: true, subtree: true });

  window.npOpenAdminPanel = async function() {
    let hasToken = false;
    try { hasToken = Boolean(localStorage.getItem(TOKEN_KEY)); } catch (_) {}
    if (!hasToken) {
      renderPairingScreen();
      return;
    }

    // If a stored token has expired, suppress the WebView prompt and use the pairing form.
    const previousProvider = window.__naprawnikAdminCodePrompt;
    let promptRequested = false;
    window.__naprawnikAdminCodePrompt = () => {
      promptRequested = true;
      return null;
    };
    try {
      await originalOpenAdminPanel();
      // The editor appears only after the existing server-authenticated ADMIN panel renders.
      mountOwnerEditor();
    } finally {
      window.__naprawnikAdminCodePrompt = previousProvider;
      if (promptRequested) renderPairingScreen();
    }
  };
})();
