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
  // Zweryfikowane aktywne ceny subskrypcji LIVE. Aktualizuj je razem z cenami w Stripe.
  const DISPLAY_PRICES = {
    pro: { month: '14,99 zł / miesiąc', year: '149,99 zł / rok (oszczędzasz 29,89 zł)' },
    warsztat: { month: '29 zł / miesiąc', year: '300 zł / rok (oszczędzasz 48 zł)' }
  };
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
      if (/active subscription already exists|awaiting payment/i.test(message)) {
        return 'Serwer zgłasza istniejącą albo nieopłaconą subskrypcję na tym koncie (HTTP 409). Odśwież status planu; jeśli to pozostałość po teście, potrzebna jest weryfikacja konta testowego.';
      }
      if (/different plan is already open/i.test(message)) {
        return 'Masz otwartą sesję Stripe dla innego planu. Wróć do tej sesji i ją zakończ albo zamknij; dopiero potem wybierz PRO.';
      }
      if (/checkout is already being prepared|another checkout session is already being prepared/i.test(message)) {
        return 'Poprzednia próba zakupu nadal jest przygotowywana. Odczekaj 30 sekund i spróbuj ponownie.';
      }
      if (/checkout was completed/i.test(message)) {
        return 'Poprzedni zakup został już zakończony. Odśwież status subskrypcji przed rozpoczęciem kolejnego zakupu.';
      }
      return 'Konflikt płatności (HTTP 409): ' + message;
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

  async function checkoutOneTime(tier, durationDays) {
    if (!['pro', 'warsztat'].includes(tier) || ![3, 7].includes(Number(durationDays))) return;
    if (!API) { alert('Płatności są wyłączone dla tej domeny. Otwórz oficjalną aplikację NAPRAWNIK.'); return; }
    try {
      const token = await accountEnsure();
      const key = 'np-onetime-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
      const response = await fetch(API + '/api/one-time-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': key },
        body: JSON.stringify({ tier, durationDays: Number(durationDays) }),
        credentials: 'omit',
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || ('Błąd API płatności: HTTP ' + response.status));
        error.status = response.status;
        throw error;
      }
      if (!isSafeCheckoutUrl(data.url)) throw new Error('Stripe nie zwrócił bezpiecznego adresu Checkout.');
      window.location.assign(data.url);
    } catch (error) {
      alert(friendlyError(error, 'rozpocząć zakupu jednorazowego pakietu') + (error.message ? '\n' + error.message : ''));
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
          buttons = '<div class="btn" data-np-portal="1">Otwórz panel Stripe — zarządzaj subskrypcją</div>';
        } else {
          const prices = DISPLAY_PRICES[tier];
          const monthly = prices ? prices.month : 'Cena miesięczna';
          const yearly = prices ? prices.year : 'Cena roczna';
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
    const oneTimeOffers = [
      { tier: 'pro', days: 3, price: '3,00 zł', title: 'PRO' },
      { tier: 'pro', days: 7, price: '7,00 zł', title: 'PRO' },
      { tier: 'warsztat', days: 3, price: '5,00 zł', title: 'WARSZTAT' },
      { tier: 'warsztat', days: 7, price: '10,00 zł', title: 'WARSZTAT' }
    ].filter(offer => ORDER[current] < ORDER[offer.tier]);
    const oneTimePackages = '<div class="card" style="border-color:var(--accent)"><h2>⚡ Pakiety jednorazowe</h2>' +
      (oneTimeOffers.length
        ? '<p style="font-size:12px;line-height:1.5">Dostęp na określony czas. Jednorazowa płatność — bez automatycznego odnowienia.</p>' +
          oneTimeOffers.map(offer => '<div class="entry"><b>' + esc(offer.title) + ' · ' + esc(String(offer.days)) + ' dni — ' + esc(offer.price) + '</b><button class="btn" type="button" data-one-time-tier="' + esc(offer.tier) + '" data-one-time-days="' + esc(String(offer.days)) + '">Kup ' + esc(offer.title) + ' na ' + esc(String(offer.days)) + ' dni</button></div>').join('')
        : '<p style="font-size:12px;line-height:1.5">Masz już aktywny plan WARSZTAT. Pakiety równe lub niższe od aktywnego planu są ukryte, aby nie proponować zbędnego zakupu.</p>') + '</div>';
    root.innerHTML = (typeof back === 'function' ? back() : '') +
      '<div class="card"><h2>💎 Plany NAPRAWNIK</h2><p style="font-size:12px;line-height:1.5">AMATOR to bezpłatna diagnostyka. PRO rozszerza bazę elektryki i funkcje diagnostyczne; analiza zdjęć AI jest chwilowo wyłączona. WARSZTAT zawiera funkcje PRO oraz narzędzia obsługi klientów i dokumentacji. Abonamentem zarządzasz w panelu Stripe.</p></div>' +
      activation + card('amator') + card('pro') + card('warsztat') + oneTimePackages +
      '<div class="card"><small style="color:var(--dim)">Dostęp PRO/WARSZTAT jest sprawdzany po stronie serwera, a płatność potwierdzana przez Stripe.</small></div>';
  }
  window.renderPlans = renderPlansBridge;
  window.npStartCheckout = checkout;
  window.npStartOneTimeCheckout = checkoutOneTime;
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

  function secureRandomId() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  function trackVisit() {
    if (!API || localStorage.getItem('naprawnik_analytics_consent') !== 'yes') return;
    try {
      let visitorId = localStorage.getItem('naprawnik_visitor_id') || '';
      if (!visitorId) {
        visitorId = secureRandomId();
        if (!visitorId) return;
        localStorage.setItem('naprawnik_visitor_id', visitorId);
      }
      let sessionId = sessionStorage.getItem('naprawnik_session_id') || '';
      if (!sessionId) {
        sessionId = secureRandomId();
        if (!sessionId) return;
        sessionStorage.setItem('naprawnik_session_id', sessionId);
      }
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const token = tokenGet();
      if (token) headers.Authorization = 'Bearer ' + token;
      fetch(API + '/api/analytics/visit', {
        method: 'POST', headers,
        body: JSON.stringify({ visitorId, sessionId }),
        credentials: 'omit', cache: 'no-store', keepalive: true
      }).catch(() => {});
    } catch (_) { /* Analytics must never break normal app startup. */ }
  }

  window.npSetAnalyticsConsent = function(enabled) {
    try {
      if (enabled) {
        localStorage.setItem('naprawnik_analytics_consent', 'yes');
        alert('Anonimowe statystyki zostały włączone. Zapisywane są losowe identyfikatory jako skróty; nie zapisujemy surowych adresów IP.');
        trackVisit();
      } else {
        localStorage.removeItem('naprawnik_analytics_consent');
        localStorage.removeItem('naprawnik_visitor_id');
        sessionStorage.removeItem('naprawnik_session_id');
        alert('Statystyki na tym urządzeniu zostały wyłączone. Wcześniej zapisane zagregowane wpisy mogą pozostać do końca retencji.');
      }
    } catch (_) { alert('Nie udało się zmienić ustawień statystyk w tej przeglądarce.'); }
  };

  function adminDate(seconds) {
    const value = Number(seconds || 0);
    return value > 0 ? new Date(value * 1000).toLocaleString('pl-PL') : '—';
  }
  async function fetchAdminData() {
    const token = tokenGet();
    if (!token) throw new Error('Brak klucza dostępu do konta. Otwórz Plany, aby zarejestrować konto, lub aktywuj panel kluczem administratora.');
    const [stats, promos, redemptions, aiBudget] = await Promise.all([
      api('/api/admin/stats', undefined, 'GET', token),
      api('/api/admin/promos', undefined, 'GET', token),
      api('/api/admin/promo-redemptions?limit=100', undefined, 'GET', token),
      api('/api/admin/photo-budget', undefined, 'GET', token)
    ]);
    return {
      stats,
      promos: Array.isArray(promos.promos) ? promos.promos : [],
      redemptions: Array.isArray(redemptions.redemptions) ? redemptions.redemptions : [],
      aiBudget
    };
  }
  function renderAdminPanel(stats, promos, redemptions, aiBudget, newCode) {
    const root = document.querySelector('#screen');
    if (!root) return;
    const metric = (label, value, note) => '<div class="card"><b style="color:var(--cyan)">' + esc(label) + '</b><div style="font-size:24px;color:var(--hero);margin:8px 0">' + esc(value) + '</div><small style="color:var(--dim)">' + esc(note || '') + '</small></div>';
    const redemptionRows = redemptions.length ? redemptions.map(r => '<div class="entry"><b>' + esc(r.label || 'Kampania') + ' · ' + esc(String(r.code_hint || '••••')) + '</b><small>Pakiet: ' + esc(String(r.tier || '').toUpperCase()) + ' · konto ID: ' + esc(String(r.user_id || '').slice(0, 8)) + '<br>Aktywowano: ' + esc(adminDate(r.redeemed_at)) + '<br>Ważność dostępu do: ' + esc(adminDate(r.expires_at)) + '</small></div>').join('') : '<div class="empty">Brak zapisanych wykorzystań kodów.</div>';
    const aiBudgetCard = '<div class="card"><h2>🧮 Budżet analizy zdjęć AI</h2><div class="grid2">' +
      '<div><small>Limit miesięczny</small><div style="font-size:20px;color:var(--hero)">' + esc(Number(aiBudget?.budgetUsd || 0).toFixed(2)) + ' USD</div></div>' +
      '<div><small>Zużycie szacowane</small><div style="font-size:20px;color:var(--hero)">' + esc(Number(aiBudget?.actualEstimatedUsd || 0).toFixed(4)) + ' USD</div></div>' +
      '<div><small>Zarezerwowane</small><div style="font-size:16px">' + esc(Number(aiBudget?.reservedUsd || 0).toFixed(4)) + ' USD</div></div>' +
      '<div><small>Żądania w tym miesiącu</small><div style="font-size:16px">' + esc(String(aiBudget?.requests || 0)) + '</div></div>' +
      '</div><small style="color:var(--dim)">' + esc(aiBudget?.modelPricing || 'Limit budżetu działa po stronie serwera; analiza pozostaje domyślnie wyłączona.') + '</small></div>';
    const newCodes = Array.isArray(newCode) ? newCode : (newCode ? [{ code: newCode, label: 'Nowy kod' }] : []);
    const newCodeContent = newCodes.length
      ? '<div class="card" style="border-color:var(--hero)"><b>Nowe kody — skopiuj i przekaż znajomym teraz</b><small style="display:block;color:var(--dim);margin:6px 0 10px">Pełne kody są pokazywane tylko w chwili utworzenia.</small>' +
        newCodes.map((item, i) => '<div class="entry"><b>' + esc(item.label || ('Kod ' + (i + 1))) + '</b><input id="npPromoCreatedCode' + i + '" readonly value="' + esc(item.code || '') + '"><button class="btn" onclick="window.npCopyAdminPromoCode(' + i + ')">Skopiuj kod</button></div>').join('') +
        '</div>'
      : '';
    const rows = promos.length ? promos.map(p => '<div class="entry"><b>' + esc(p.label || 'Kod promocyjny') + ' · ' + esc(String(p.code_hint || '••••')) + '</b><small>' + esc(String(p.tier || '').toUpperCase()) + ' · ' + esc(String(p.duration_days)) + ' dni · użycia: ' + esc(String(p.redemption_count)) + '/' + esc(String(p.max_redemptions)) + '<br>Ważny do: ' + esc(adminDate(p.expires_at)) + '<br>' + (Number(p.enabled) === 1 ? 'Aktywny' : 'Wyłączony') + '</small>' + (Number(p.enabled) === 1 ? '<button class="btn" type="button" onclick="window.npDisablePromo(\'' + esc(p.id) + '\')">Wyłącz kod</button>' : '') + '</div>').join('') : '<div class="empty">Nie utworzono jeszcze kodów promocyjnych.</div>';
    root.innerHTML = '<div class="card"><h2>🛡️ Panel ADMINA</h2><p style="font-size:12px;line-height:1.5">Statystyki i kody są widoczne tylko po potwierdzeniu uprawnień przez serwer.</p><div class="grid2">' +
      metric('Zarejestrowane konta', stats.registeredAccounts, 'Dokładna liczba kont') +
      metric('Aktywne 24 godz.', stats.activeAccounts24h, 'Zalogowane konta z ruchem w tym okresie') +
      metric('Aktywne 7 dni', stats.activeAccounts7d, 'Unikalne konta zalogowane') +
      metric('Aktywne 30 dni', stats.activeAccounts30d, 'Unikalne konta zalogowane') +
      metric('Sesje 24 godz.', stats.sessions24h, 'Ponowne otwarcie karty może tworzyć nową sesję') +
      metric('Unikalne przeglądarki · 7 dni', stats.uniqueBrowsers7dEstimate, 'Szacunek, nie dokładna liczba osób') +
      '</div><p style="font-size:11px;line-height:1.5;color:var(--dim)">' + esc(stats.note || '') + '</p><button class="btn" onclick="window.npOpenAdminPanel()">↻ Odśwież statystyki</button></div>' +
      '<div class="card"><h2>🔎 Diagnostyka bramki płatności</h2><p style="font-size:12px;color:var(--dim);line-height:1.5">Sprawdza połączenie serwera ze Stripe i cztery skonfigurowane ceny. To jest odczyt — nie tworzy Checkoutu ani nie pobiera pieniędzy.</p><button class="btn" type="button" onclick="window.npCheckStripeConfig()">Sprawdź Stripe bez płatności</button><div id="npAdminStripeDiag" style="font-size:12px;line-height:1.6;margin-top:10px"></div></div>' +
      '<div class="card"><h2>🎟️ Utwórz kod promocyjny</h2><label for="npPromoTier">Pakiet</label><select id="npPromoTier"><option value="pro">PRO</option><option value="warsztat">WARSZTAT</option></select><label for="npPromoDuration">Czas dostępu</label><select id="npPromoDuration"><option value="3">3 dni</option><option value="7">7 dni</option><option value="180">6 miesięcy (180 dni)</option></select><div class="grid2"><div><label for="npPromoMax">Maks. użyć</label><input id="npPromoMax" type="number" min="1" max="10000" value="1"></div><div><label for="npPromoExpires">Ważność kodu (dni)</label><input id="npPromoExpires" type="number" min="1" max="365" value="14"></div></div><label for="npPromoLabel">Opis kampanii (opcjonalnie)</label><input id="npPromoLabel" maxlength="120" placeholder="np. testy znajomych / konkurs"><button class="btn" onclick="window.npCreatePromo()">＋ Generuj kod</button><button class="btn" onclick="window.npCreateJohnnyCodes()">🎁 Generuj 5 kodów Johnny — WARSZTAT / 6 miesięcy</button>' +
      (newCode ? '<div class="entry" style="border-color:var(--hero)"><b>Nowy kod — pokaż go odbiorcy tylko teraz</b><input id="npPromoCreatedCode" readonly value="' + esc(newCode) + '"><button class="btn" onclick="navigator.clipboard.writeText(document.getElementById(\'npPromoCreatedCode\').value).then(()=>alert(\'Skopiowano kod.\')).catch(()=>alert(\'Skopiuj kod ręcznie.\'))">Skopiuj kod</button></div>' : '') +
      '</div><div class="card"><h2>📋 Kody promocyjne</h2>' + rows + '</div>' +
      aiBudgetCard + '<div class="card"><h2>🧾 Historia wykorzystania kodów</h2><small style="color:var(--dim)">Maksymalnie 100 ostatnich wpisów. Pokazujemy skrócone ID konta, bez adresów e-mail. Historia jest przechowywana przez 12 miesięcy.</small>' + redemptionRows + '</div>' +
      '<div class="card"><button class="btn" onclick="nav(\'settings\')">← Wróć do ustawień</button></div>';
  }
  window.npOpenAdminPanel = async function() {
    if (!API) { alert('Panel dostępny wyłącznie w oficjalnej aplikacji.'); return; }
    const token = tokenGet();
    if (token) {
      try {
        const data = await fetchAdminData();
        renderAdminPanel(data.stats, data.promos, data.redemptions, data.aiBudget, '');
        return;
      } catch (error) {
        if (error.status !== 401 && error.status !== 403) {
          alert(friendlyError(error, 'otworzyć panelu ADMINA'));
          return;
        }
      }
    }
    const key = window.prompt('Aktywacja panelu właściciela. Wpisz jednorazowy kod aktywacyjny otrzymany od twórcy aplikacji:');
    if (!key) return;
    try {
      const userToken = await accountEnsure();
      const data = await api('/api/admin/bootstrap', { key: key.trim() }, 'POST', userToken);
      alert(data.message || 'Uprawnienia administratora aktywowane.');
      const panel = await fetchAdminData();
      renderAdminPanel(panel.stats, panel.promos, panel.redemptions, panel.aiBudget, '');
    } catch (error) {
      alert(friendlyError(error, 'aktywować panelu ADMINA') + (error.message ? '\n' + error.message : ''));
    }
  };
  window.npCheckStripeConfig = async function() {
    const root = document.getElementById('npAdminStripeDiag');
    if (!root) return;
    root.textContent = 'Sprawdzam konfigurację po stronie serwera…';
    try {
      const token = tokenGet();
      if (!token) throw new Error('Zaloguj się na konto administratora.');
      const result = await api('/api/admin/stripe-diagnostics', undefined, 'GET', token);
      const reasonLabels = {
        ok: 'OK',
        missing_price_id: 'Brak identyfikatora ceny w konfiguracji',
        missing_secret: 'Brak sekretu Stripe',
        network_error: 'Serwer nie może połączyć się ze Stripe',
        stripe_key_rejected: 'Stripe odrzucił klucz API — sprawdź LIVE/TEST',
        stripe_api_error: 'Stripe zwrócił błąd API',
        price_inactive_or_mismatch: 'Cena nieaktywna lub inny identyfikator',
        livemode_mismatch: 'Niezgodny tryb LIVE/TEST',
        currency_mismatch: 'Niezgodna waluta (wymagane PLN)',
        interval_mismatch: 'Niezgodny okres rozliczenia',
        invalid_amount: 'Nieprawidłowa kwota'
      };
      const row = (label, ok, detail) => '<div style="padding:7px 0;border-bottom:1px solid var(--line)"><b>' + (ok ? '✅ ' : '❌ ') + esc(label) + '</b><div style="color:var(--dim)">' + esc(detail) + '</div></div>';
      const infoRow = (label, detail) => '<div style="padding:7px 0;border-bottom:1px solid var(--line)"><b>ℹ️ ' + esc(label) + '</b><div style="color:var(--dim)">' + esc(detail) + '</div></div>';
      const keyKindLabel = result.stripeSecretKind === 'standard' ? 'standardowy klucz tajny' : result.stripeSecretKind === 'restricted' ? 'klucz ograniczony (restricted)' : result.stripeSecretKind === 'missing' ? 'brak' : 'nierozpoznany';
      const keyModeLabel = result.stripeSecretMode ? result.stripeSecretMode.toUpperCase() : 'nie można rozpoznać trybu po prefiksie';
      let output = row('Worker włączony', result.productionEnabled === true, result.productionEnabled ? 'PRODUCTION_ENABLED = true' : 'PRODUCTION_ENABLED nie jest true') +
        row('Tryb środowiska Stripe', result.expectedMode === 'live', 'Oczekiwany tryb: ' + String(result.expectedMode || 'brak')) +
        row('Sekret Stripe istnieje', result.stripeSecretConfigured === true, result.stripeSecretConfigured ? 'Sekret jest skonfigurowany; jego treść nie jest wyświetlana.' : 'STRIPE_SECRET_KEY nie jest skonfigurowany') +
        infoRow('Typ klucza Stripe', 'Wykryto: ' + keyKindLabel + '. Wartość sekretu nie jest wyświetlana.') +
        row('Tryb klucza Stripe', result.stripeSecretModeMatchesExpected === true, 'Wykryty tryb: ' + keyModeLabel + ' · oczekiwany: ' + String(result.expectedMode || 'brak')) +
        row('Sekret bez białych znaków na końcach', result.stripeSecretHasOuterWhitespace !== true, result.stripeSecretHasOuterWhitespace ? 'Wykryto spację lub znak końca linii poza treścią klucza.' : 'Nie wykryto spacji ani znaku końca linii na początku lub końcu sekretu.') +
        row('Adresy powrotu Checkout', result.checkoutReturnUrlsValid === true, result.checkoutReturnUrlsValid ? 'HTTPS i zgodny adres aplikacji' : 'Adresy powrotu są nieprawidłowe lub niezgodne z adresem aplikacji') +
        row('Adres aplikacji', result.appBaseConfigured === true, result.appBaseConfigured ? 'APP_BASE_URL jest ustawiony' : 'Brak APP_BASE_URL');
      (Array.isArray(result.prices) ? result.prices : []).forEach(price => {
        const good = price.valid === true;
        let detail = reasonLabels[price.reason] || 'Wynik: ' + String(price.reason || 'nieznany');
        if (price.stripeHttpStatus) detail += ' · HTTP ' + price.stripeHttpStatus;
        if (price.stripeErrorCode) detail += ' · kod: ' + price.stripeErrorCode;
        if (price.stripeErrorType) detail += ' · typ: ' + price.stripeErrorType;
        if (price.stripeErrorHint) detail += ' · ' + price.stripeErrorHint;
        if (price.stripeRequestId) detail += ' · Request ID: ' + price.stripeRequestId;
        if (price.currency && price.interval) detail += ' · ' + price.currency.toUpperCase() + ' · ' + price.interval + (price.intervalCount > 1 ? ' × ' + price.intervalCount : '');
        output += row(price.label || price.key, good, detail);
      });
      output = row('Wynik całościowy', result.ready === true, result.ready ? 'Konfiguracja jest gotowa do uruchomienia płatności.' : 'Konfiguracja wymaga poprawki; niżej widać konkretny powód.') + output;
      root.innerHTML = output + '<div style="color:var(--dim);font-size:11px;margin-top:8px">Sprawdzono: ' + esc(result.checkedAt || '') + '. Wykonano wyłącznie żądania GET do API Stripe.</div>';
    } catch (error) {
      root.textContent = friendlyError(error, 'sprawdzić konfiguracji Stripe') + (error && error.status ? ' (HTTP ' + error.status + ')' : '');
    }
  };

  window.npCreatePromo = async function() {
    try {
      const tier = document.getElementById('npPromoTier')?.value;
      const durationDays = Number(document.getElementById('npPromoDuration')?.value);
      const maxRedemptions = Number(document.getElementById('npPromoMax')?.value);
      const expiresInDays = Number(document.getElementById('npPromoExpires')?.value);
      const label = document.getElementById('npPromoLabel')?.value || '';
      const token = tokenGet();
      if (!token) throw new Error('Zaloguj się na konto administratora.');
      const created = await api('/api/admin/promos', { tier, durationDays, maxRedemptions, expiresInDays, label }, 'POST', token);
      const panel = await fetchAdminData();
      renderAdminPanel(panel.stats, panel.promos, panel.redemptions, panel.aiBudget, created.code);
    } catch (error) {
      alert(friendlyError(error, 'utworzyć kodu promocyjnego') + (error.message ? '\n' + error.message : ''));
    }
  };
  window.npDisablePromo = async function(id) {
    if (!id || !confirm('Wyłączyć ten kod promocyjny? Dotychczas przyznane dostępy pozostaną ważne do końca okresu.')) return;
    try {
      const token = tokenGet();
      await api('/api/admin/promos/disable', { id }, 'POST', token);
      const panel = await fetchAdminData();
      renderAdminPanel(panel.stats, panel.promos, panel.redemptions, panel.aiBudget, '');
    } catch (error) {
      alert(friendlyError(error, 'wyłączyć kodu promocyjnego') + (error.message ? '\n' + error.message : ''));
    }
  };
  window.npRedeemPromo = async function() {
    const input = document.getElementById('npPromoCode');
    const code = input && input.value ? input.value.trim().toUpperCase() : '';
    if (!code) { alert('Wpisz kod promocyjny.'); return; }
    try {
      const token = await accountEnsure();
      const data = await api('/api/promo/redeem', { code }, 'POST', token);
      await refresh(true);
      alert(data.messageStyleKey === 'johnny-6m' ? (data.message + '\n\n' + data.messageSubtext) : (data.message || ('Aktywowano dostęp ' + String(data.tier || '').toUpperCase() + ' na ' + data.durationDays + ' dni.')));
      renderPlansBridge();
    } catch (error) {
      alert(friendlyError(error, 'aktywować kodu promocyjnego') + (error.message ? '\n' + error.message : ''));
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
    const button = event.target.closest('[data-one-time-tier][data-one-time-days], [data-plan][data-interval], .np-buy, [data-np-copy], [data-np-refresh], [data-np-portal], [data-np-logout], [data-np-activate], [data-billing-nav]');
    if (!button) return;
    if (button.hasAttribute('data-one-time-tier')) { await checkoutOneTime(button.dataset.oneTimeTier, Number(button.dataset.oneTimeDays)); return; }
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
      if (tier !== 'amator') alert('Dziękujemy! Dostęp ' + NAMES[tier] + ' jest aktywny.');
      else alert('Płatność wróciła do aplikacji, ale potwierdzenie jeszcze nie dotarło. Za chwilę kliknij „Sprawdź abonament” w zakładce Plany.');
      renderPlansBridge();
    } else if (cancelled) {
      alert('Zakup został anulowany. Nie pobrano płatności.');
    }
  };
  // Replace the legacy, broken Netlify activation callbacks with the Cloudflare API path.
  window.licBoot = window.npBillingBoot;
  trackVisit();
  window.npBillingBoot();
})();
