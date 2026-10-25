/* NAPRAWNIK billing bridge — served from the same GitHub Pages project. */
(() => {
  'use strict';
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isStagingHost = host === 'naprawnik-pwa-staging.turbodiesel966.workers.dev';
  const isProductionHost = host === 'turbodiesel966-eng.github.io';
  const API = isStagingHost
    ? 'https://naprawnik-subscriptions-v2-staging.turbodiesel966.workers.dev'
    : isProductionHost
      ? 'https://naprawnik-subscriptions-live.turbodiesel966.workers.dev'
      : null;
  const TOKEN_KEY = 'naprawnik_api_token';
  const ORDER = { amator: 0, pro: 1, warsztat: 2 };
  const NAMES = { amator: 'AMATOR', pro: 'PRO', warsztat: 'WARSZTAT' };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let verifiedLicenseState = null;
  function applyVerifiedPlan(state) {
    if (state && state.verified === true &&
        Object.prototype.hasOwnProperty.call(ORDER, state.tier) &&
        state.tier !== 'amator' &&
        Number.isFinite(Number(state.exp)) && Number(state.exp) > Date.now()) {
      verifiedLicenseState = { tier: state.tier, exp: Number(state.exp), token: typeof state.token === 'string' ? state.token : '', verified: true };
    } else {
      verifiedLicenseState = null;
    }
    if (typeof updatePlanBadge === 'function') updatePlanBadge();
  }
  function clearVerifiedPlan() {
    const hadPaid = !!(verifiedLicenseState && verifiedLicenseState.tier !== 'amator');
    verifiedLicenseState = null;
    if (typeof updatePlanBadge === 'function') updatePlanBadge();
    if (hadPaid && typeof nav === 'function') nav('home');
  }
  Object.defineProperty(window, 'naprawnikGetVerifiedLicense', {
    value: function() {
      if (verifiedLicenseState && Number(verifiedLicenseState.exp) <= Date.now()) verifiedLicenseState = null;
      return verifiedLicenseState ? { ...verifiedLicenseState } : null;
    },
    enumerable: false,
    writable: false,
    configurable: false
  });

  function tokenGet() {
    try { return localStorage.getItem(TOKEN_KEY) || ((JSON.parse(localStorage.getItem('naprawnik_license') || 'null') || {}).token) || ''; }
    catch (_) { return ''; }
  }
  function friendlyError(error, action) {
    const message = String(error && error.message || error || '');
    const status = Number(error && error.status || 0);
    if (message.includes('Płatności są wyłączone dla tej domeny') || message.includes('Nie utworzono nowego konta')) return message;
    if (status === 401 || /\bunauthorized\b|user not found|invalid token|token expired/i.test(message)) {
      return 'Klucz dostępu został odrzucony lub wygasł. Zaloguj się ponownie albo odzyskaj poprzedni klucz; nie utworzono nowego konta automatycznie.';
    }
    if (status === 403 || /origin not allowed|active subscription for the required plan is needed/i.test(message)) {
      return 'Serwer odmówił dostępu. Sprawdź, czy otwierasz oficjalną aplikację i czy Twój plan obejmuje tę funkcję.';
    }
    if (status === 409 || /active subscription already exists|checkout.*already|different plan is already open|checkout was completed|another checkout session/i.test(message)) {
      return 'Masz już aktywną subskrypcję albo otwartą sesję zakupu. Odśwież status planu lub zarządzaj istniejącą subskrypcją.';
    }
    if (status === 429) return 'Wykonano zbyt wiele prób w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.';
    if (status === 503 || /production service is not enabled|stripe is not configured|price is not configured|checkout return urls/i.test(message)) {
      return 'Płatności są chwilowo niedostępne albo wymagają konfiguracji. Spróbuj ponownie później.';
    }
    if (/failed to fetch|networkerror|load failed|could not reach stripe|network request failed/i.test(message)) {
      return 'Nie udało się połączyć z serwerem płatności. Sprawdź połączenie internetowe i spróbuj ponownie.';
    }
    return 'Nie udało się ' + (action || 'wykonać operacji') + '. Spróbuj ponownie później.';
  }
  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
  }
  async function api(path, body, method, bearer) {
    if (!API) throw new Error('Płatności są wyłączone dla tej domeny. Otwórz oficjalną aplikację NAPRAWNIK.');
    const token = bearer === undefined ? tokenGet() : bearer;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(API + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.error || ('Błąd API płatności: HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function accountEnsure() {
    const token = tokenGet();
    if (token) {
      try {
        await api('/api/me', undefined, 'GET', token);
        localStorage.setItem(TOKEN_KEY, token);
        return token;
      } catch (error) {
        if (error.status !== 401 && !/unauthorized|user not found/i.test(error.message || '')) throw error;
        localStorage.removeItem('naprawnik_license');
        clearVerifiedPlan();
        const createNew = window.confirm('Zapisany klucz dostępu został odrzucony przez serwer. Czy utworzyć NOWE konto? Nowe konto nie odzyska poprzedniego abonamentu. Jeśli masz aktywną lub opłaconą subskrypcję, wybierz Anuluj i odzyskaj poprzedni klucz.');
        if (!createNew) {
          throw new Error('Nie utworzono nowego konta. Zachowaj poprzedni klucz i odzyskaj dostęp do istniejącej subskrypcji.');
        }
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    const user = await api('/api/register', {}, 'POST', '');
    if (!user || !user.token) throw new Error('API nie utworzyło klucza dostępu.');
    localStorage.setItem(TOKEN_KEY, user.token);
    return user.token;
  }
  function savePlan(data, token) {
    const user = data && data.user || {};
    const requestedTier = Object.prototype.hasOwnProperty.call(ORDER, user.tier) ? user.tier : 'amator';
    const now = Date.now();
    const nowSeconds = now / 1000;
    const subscriptions = Array.isArray(data && data.subscriptions) ? data.subscriptions : [];
    const active = subscriptions.filter(item => {
      if (!item || !Object.prototype.hasOwnProperty.call(ORDER, item.tier) || item.tier === 'amator') return false;
      if (['active', 'trialing'].includes(item.status)) return Number(item.current_period_end || 0) > nowSeconds;
      return item.status === 'past_due' && Number(item.grace_until || 0) > nowSeconds;
    });
    const activeTier = active.reduce((best, item) =>
      ORDER[item.tier] > ORDER[best] ? item.tier : best, 'amator');
    // Expiry must come from the active subscription for the granted tier, not another lower-tier plan.
    const matchingPeriods = active.filter(item => item.tier === requestedTier).map(item =>
      Number(item.status === 'past_due' ? item.grace_until : item.current_period_end)
    ).filter(value => Number.isFinite(value) && value > nowSeconds);
    const expires = requestedTier === activeTier && matchingPeriods.length ? Math.max(...matchingPeriods) * 1000 : 0;
    // The server's calculated tier and the current subscription tier must agree; mismatches fail closed.
    const tier = requestedTier !== 'amator' && requestedTier === activeTier && expires > now ? requestedTier : 'amator';
    if (tier === 'amator') {
      localStorage.removeItem('naprawnik_license');
    } else {
      localStorage.setItem('naprawnik_license', JSON.stringify({ token, tier, exp: expires, checkedAt: Date.now() }));
    }
    if (token) localStorage.setItem(TOKEN_KEY, token);
    applyVerifiedPlan({ verified: true, tier, exp: expires, token });
    if (typeof updatePlanBadge === 'function') updatePlanBadge();
    return tier;
  }
  async function refresh(silent) {
    const token = tokenGet();
    if (!token) {
      clearVerifiedPlan();
      if (!silent) alert('Nie ma zapisanego klucza dostępu. Wybierz abonament lub wklej klucz z innego urządzenia.');
      return 'amator';
    }
    try {
      const data = await api('/api/me', undefined, 'GET', token);
      return savePlan(data, token);
    } catch (error) {
      clearVerifiedPlan();
      if (error.status === 401 || /unauthorized|user not found/i.test(error.message || '')) {
        localStorage.removeItem('naprawnik_license');
      }
      if (!silent) {
        const message = error.status === 401
          ? 'Klucz dostępu został odrzucony. Nie utworzono nowego konta. Sprawdź zapisany klucz lub odzyskaj poprzedni dostęp.'
          : friendlyError(error, 'sprawdzić abonamentu');
        alert(message);
      }
      return 'amator';
    }
  }
  function isSafeCheckoutUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['checkout.stripe.com', 'buy.stripe.com'].includes(url.hostname.toLowerCase());
    } catch (_) {
      return false;
    }
  }
  async function checkoutRequest(tier, interval, token) {
    if (!API) throw new Error('Płatności są wyłączone dla tej domeny. Otwórz oficjalną aplikację NAPRAWNIK.');
    const key = 'np-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': key };
    const response = await fetch(API + '/api/checkout', {
      method: 'POST', headers, body: JSON.stringify({ tier, interval }), credentials: 'omit', cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || ('Błąd API płatności: HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function checkout(tier, interval) {
    if (!['pro', 'warsztat'].includes(tier) || !['month', 'year'].includes(interval)) return;
    try {
      const token = await accountEnsure();
      const data = await checkoutRequest(tier, interval, token);
      if (!isSafeCheckoutUrl(data.url)) throw new Error('Stripe nie zwrócił bezpiecznego adresu Checkout.');
      window.location.assign(data.url);
    } catch (error) {
      if (/active subscription already exists/i.test(error.message || '')) {
        await refresh(true);
        alert('Masz już aktywny abonament. Sprawdź swój plan lub zarządzaj subskrypcją.');
        window.renderPlans();
        return;
      }
      alert(friendlyError(error, 'rozpocząć zakupu'));
    }
  }

  function listHtml(tier) {
    try { return typeof planBullets === 'function' ? planBullets(tier) : ''; }
    catch (_) { return ''; }
  }
  function renderPlansBridge() {
    const license = typeof window.naprawnikGetVerifiedLicense === 'function'
      ? window.naprawnikGetVerifiedLicense()
      : null;
    const current = license ? license.tier : 'amator';
    const root = document.querySelector('#screen');
    if (!root) return;
    const card = tier => {
      const own = current === tier;
      const titles = { amator: '🛵 AMATOR', pro: '💎 PRO', warsztat: '🛠️ WARSZTAT' };
      let buttons = '';
      if (tier !== 'amator' && !own && ORDER[current] < ORDER[tier]) {
        if (current !== 'amator') {
          // Checkout refuses a second subscription; paid customers manage existing billing in Stripe.
          buttons = '<div class="btn" data-np-portal="1">Zarządzaj subskrypcją w Stripe, aby zmienić plan</div>';
        } else {
          const monthly = 'Miesięcznie (cena w Stripe)';
          const yearly = 'Rocznie (cena w Stripe)';
          buttons = '<div class="btn np-buy" data-plan="' + tier + '" data-interval="month">Wybieram ' + titles[tier].replace(/^\S+ /, '') + ' — ' + monthly + '</div>' +
            '<div class="btn np-buy" data-plan="' + tier + '" data-interval="year">Wybieram ' + titles[tier].replace(/^\S+ /, '') + ' — ' + yearly + '</div>';
        }
      }
      return '<div class="card" style="' + (own ? 'border-color:var(--hero)' : '') + '"><h2>' + titles[tier] + (own ? ' — Twój plan' : '') + '</h2><small style="color:var(--dim)">' + (tier === 'amator' ? 'Bezpłatny, bez konta' : 'Abonament przez Stripe; anulowanie w panelu subskrypcji') + '</small>' + listHtml(tier) + buttons + '</div>';
    };
    let activation;
    if (license && license.token && license.tier !== 'amator' && license.exp > Date.now()) {
      activation = '<div class="card"><h2>🔑 Dostęp aktywny</h2><p>Plan: <b>' + NAMES[license.tier] + '</b></p><p>Ważny do ' + esc(new Date(license.exp).toLocaleDateString('pl-PL')) + '.</p><textarea id="licKeyShow" readonly style="min-height:70px">' + esc(license.token) + '</textarea><div class="btn" data-np-copy="1">📋 Skopiuj klucz dostępu</div><div class="btn" data-np-refresh="1">🔄 Sprawdź abonament</div><div class="btn" data-np-portal="1">⚙️ Zarządzaj subskrypcją / anuluj</div><div class="btn" data-np-logout="1">🚪 Wyloguj z tego urządzenia</div></div>';
    } else {
      activation = '<div class="card"><h2>🔑 Aktywacja / odzyskanie dostępu</h2><p style="font-size:12px;line-height:1.5">Po zakupie dostęp aktywuje się po potwierdzeniu Stripe. Na innym urządzeniu wklej klucz dostępu zapisany po zakupie.</p><input id="licKeyIn" placeholder="Wklej klucz dostępu"><div class="btn" data-np-activate="1">✅ Aktywuj / sprawdź klucz</div></div>';
    }
    root.innerHTML = (typeof back === 'function' ? back() : '') +
      '<div class="card"><h2>💎 Plany NAPRAWNIK</h2><p style="font-size:12px;line-height:1.5">AMATOR to bezpłatna diagnostyka. PRO dodaje analizę AI i pełną bazę elektryki. WARSZTAT zawiera PRO oraz narzędzia obsługi klientów i dokumentacji. Abonamentem zarządzasz w panelu Stripe.</p></div>' +
      activation + card('amator') + card('pro') + card('warsztat') +
      '<div class="card"><small style="color:var(--dim)">Dostęp PRO/WARSZTAT jest sprawdzany po stronie serwera, a płatność potwierdzana przez Stripe.</small></div>';
  }
  window.renderPlans = renderPlansBridge;
  window.npStartCheckout = checkout;
  window.licRefresh = refresh;
  window.licActivateInput = async function() {
    const input = document.querySelector('#licKeyIn');
    const token = (input && input.value || '').trim();
    if (!token) return;
    try {
      const data = await api('/api/me', undefined, 'GET', token);
      const tier = savePlan(data, token);
      alert(tier === 'amator' ? 'Klucz działa, ale konto nie ma aktywnego abonamentu.' : 'Dostęp ' + NAMES[tier] + ' został aktywowany.');
    } catch (error) {
      alert(friendlyError(error, 'zweryfikować klucz dostępu'));
    }
    renderPlansBridge();
  };
  window.licDeactivate = function() {
    if (!confirm('Wylogować dostęp z tego urządzenia? Abonament w Stripe nie zostanie anulowany.')) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('naprawnik_license');
    clearVerifiedPlan();
    renderPlansBridge();
  };
  window.licCopy = function() {
    const input = document.querySelector('#licKeyShow');
    const value = input && input.value || '';
    if (navigator.clipboard && value) navigator.clipboard.writeText(value).then(() => alert('Skopiowano klucz dostępu. Zapisz go bezpiecznie.')).catch(() => alert('Skopiuj klucz ręcznie.'));
    else alert('Skopiuj klucz ręcznie.');
  };
  window.openBillingPortal = async function() {
    try {
      const token = await accountEnsure();
      const data = await api('/api/billing-portal', {}, 'POST', token);
      if (!data.url || !/^https:\/\/billing\.stripe\.com\//i.test(data.url)) throw new Error('Stripe nie zwrócił poprawnego panelu subskrypcji.');
      window.location.assign(data.url);
    } catch (error) {
      alert(friendlyError(error, 'otworzyć panelu subskrypcji'));
    }
  };

  window.npPhotoDiagnosis = async function(formData, options) {
    const license = typeof window.naprawnikGetVerifiedLicense === 'function'
      ? window.naprawnikGetVerifiedLicense()
      : null;
    if (!license || license.verified !== true ||
        !['pro', 'warsztat'].includes(license.tier) ||
        !Number.isFinite(Number(license.exp)) || Number(license.exp) <= Date.now() ||
        typeof license.token !== 'string' || !license.token) {
      throw new Error('Do analizy zdjęć AI potrzebny jest aktywny abonament PRO lub WARSZTAT.');
    }
    if (!API) throw new Error('Płatności i analiza AI są wyłączone dla tej domeny. Otwórz oficjalną aplikację NAPRAWNIK.');
    if (!formData || typeof formData.append !== 'function') throw new Error('Nie udało się przygotować formularza zdjęć.');
    const response = await fetch(API + '/api/photo-diagnosis', {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + license.token },
      body: formData,
      credentials: 'omit',
      cache: 'no-store',
      signal: options && options.signal
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.error || ('Usługa analizy AI zwróciła HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  };
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-plan][data-interval], .np-buy, [data-np-copy], [data-np-refresh], [data-np-portal], [data-np-logout], [data-np-activate], [data-billing-nav]');
    if (!button) return;
    if (button.hasAttribute('data-billing-nav')) { if (typeof nav === 'function') nav('plans'); return; }
    if (button.dataset.plan && button.dataset.interval) { await checkout(button.dataset.plan, button.dataset.interval); return; }
    if (button.hasAttribute('data-np-copy')) { window.licCopy(); return; }
    if (button.hasAttribute('data-np-refresh')) { await refresh(false); renderPlansBridge(); return; }
    if (button.hasAttribute('data-np-portal')) { await window.openBillingPortal(); return; }
    if (button.hasAttribute('data-np-logout')) { window.licDeactivate(); return; }
    if (button.hasAttribute('data-np-activate')) { await window.licActivateInput(); }
  });
  window.npBillingBoot = async function() {
    const query = new URLSearchParams(location.search);
    const returned = query.get('checkout') === 'success' || query.has('session_id') || query.get('billing') === 'success';
    const cancelled = query.get('checkout') === 'cancelled' || query.get('billing') === 'cancelled';
    const billing = query.has('billing');
    if (returned || cancelled || billing) history.replaceState(null, '', location.pathname);
    let tier = 'amator';
    const token = tokenGet();
    if (token) {
      const attempts = returned ? 8 : 1;
      for (let i = 0; i < attempts; i++) {
        tier = await refresh(true);
        if (tier !== 'amator') break;
        if (i + 1 < attempts) await delay(1500);
      }
    }
    if (returned) {
      if (tier !== 'amator') alert('Dziękujemy! Abonament ' + NAMES[tier] + ' jest aktywny.');
      else alert('Płatność wróciła do aplikacji, ale potwierdzenie jeszcze nie dotarło. Za chwilę kliknij „Sprawdź abonament” w zakładce Plany.');
      renderPlansBridge();
    } else if (cancelled) {
      alert('Zakup został anulowany. Nie pobrano płatności.');
    }
  };
  // Replace the legacy, broken Netlify activation callbacks with the Cloudflare API path.
  window.licBoot = window.npBillingBoot;
  window.npBillingBoot();
})();
