/* NAPRAWNIK billing bridge — served from the same GitHub Pages project. */
(() => {
  'use strict';
  const API = 'https://naprawnik-subscriptions-live.turbodiesel966.workers.dev';
  const TOKEN_KEY = 'naprawnik_api_token';
  const ORDER = { amator: 0, pro: 1, warsztat: 2 };
  const NAMES = { amator: 'AMATOR', pro: 'PRO', warsztat: 'WARSZTAT' };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function tokenGet() {
    try { return localStorage.getItem(TOKEN_KEY) || ((JSON.parse(localStorage.getItem('naprawnik_license') || 'null') || {}).token) || ''; }
    catch (_) { return ''; }
  }
  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
  }
  async function api(path, body, method, bearer) {
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
    if (!response.ok) throw new Error(data.error || ('Błąd API płatności: HTTP ' + response.status));
    return data;
  }
  async function accountEnsure() {
    let token = tokenGet();
    if (token) {
      try {
        await api('/api/me', undefined, 'GET', token);
        localStorage.setItem(TOKEN_KEY, token);
        return token;
      } catch (error) {
        if (!/401|unauthorized|user not found/i.test(error.message || '')) throw error;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('naprawnik_license');
        token = '';
      }
    }
    const user = await api('/api/register', {}, 'POST', '');
    if (!user || !user.token) throw new Error('API nie utworzyło klucza dostępu.');
    token = user.token;
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  }
  function savePlan(data, token) {
    const user = data && data.user || {};
    const tier = ORDER[user.tier] !== undefined ? user.tier : 'amator';
    const subscriptions = Array.isArray(data && data.subscriptions) ? data.subscriptions : [];
    const active = subscriptions.filter(item =>
      ['active', 'trialing'].includes(item.status) ||
      (item.status === 'past_due' && Number(item.grace_until || 0) > Date.now() / 1000)
    );
    const periods = active.map(item => Math.max(Number(item.current_period_end || 0), Number(item.grace_until || 0))).filter(Boolean);
    const expires = periods.length ? Math.max(...periods) * 1000 : Date.now() + 86400000;
    if (tier === 'amator') localStorage.removeItem('naprawnik_license');
    else localStorage.setItem('naprawnik_license', JSON.stringify({ token, tier, exp: expires, checkedAt: Date.now() }));
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (typeof updatePlanBadge === 'function') updatePlanBadge();
    return tier;
  }
  async function refresh(silent) {
    const token = tokenGet();
    if (!token) {
      if (!silent) alert('Nie ma zapisanego klucza dostępu. Wybierz abonament lub wklej klucz z innego urządzenia.');
      return 'amator';
    }
    try {
      const data = await api('/api/me', undefined, 'GET', token);
      const tier = savePlan(data, token);
      if (!silent) alert(tier === 'amator' ? 'Nie znaleziono aktywnego abonamentu.' : 'Aktywny abonament: ' + NAMES[tier] + '.');
      return tier;
    } catch (error) {
      if (!silent) alert('Nie udało się sprawdzić abonamentu: ' + (error.message || error));
      return 'amator';
    }
  }
  async function checkout(tier, interval) {
    if (!['pro', 'warsztat'].includes(tier) || !['month', 'year'].includes(interval)) return;
    try {
      const token = await accountEnsure();
      const key = 'np-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
      const data = await api('/api/checkout', { tier, interval }, 'POST', token);
      // The Worker requires an idempotency header. Retry with a fresh request only if the client
      // did not have one attached in the request helper (see checkoutRequest below).
      if (!data.url || !/^https:\/\//i.test(data.url)) throw new Error('Stripe nie zwrócił poprawnego adresu płatności.');
      window.location.assign(data.url);
    } catch (error) {
      if (/active subscription already exists/i.test(error.message || '')) {
        await refresh(true);
        alert('Masz już aktywny abonament. Sprawdź swój plan lub zarządzaj subskrypcją.');
        window.renderPlans();
        return;
      }
      alert('Nie udało się rozpocząć zakupu: ' + (error.message || error));
    }
  }
  async function checkoutRequest(tier, interval, token) {
    const key = 'np-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': key };
    const response = await fetch(API + '/api/checkout', { method: 'POST', headers, body: JSON.stringify({ tier, interval }), credentials: 'omit', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || ('Błąd API płatności: HTTP ' + response.status));
    return data;
  }
  // Use the explicit idempotency-key path required by the Worker.
  checkout = async function(tier, interval) {
    if (!['pro', 'warsztat'].includes(tier) || !['month', 'year'].includes(interval)) return;
    try {
      const token = await accountEnsure();
      const data = await checkoutRequest(tier, interval, token);
      if (!data.url || !/^https:\/\//i.test(data.url)) throw new Error('Stripe nie zwrócił poprawnego adresu płatności.');
      window.location.assign(data.url);
    } catch (error) {
      if (/active subscription already exists/i.test(error.message || '')) {
        await refresh(true);
        alert('Masz już aktywny abonament. Sprawdź swój plan lub zarządzaj subskrypcją.');
        window.renderPlans();
        return;
      }
      alert('Nie udało się rozpocząć zakupu: ' + (error.message || error));
    }
  };

  function listHtml(tier) {
    try { return typeof planBullets === 'function' ? planBullets(tier) : ''; }
    catch (_) { return ''; }
  }
  function renderPlansBridge() {
    const current = (() => {
      try {
        const license = JSON.parse(localStorage.getItem('naprawnik_license') || 'null');
        return license && license.exp > Date.now() && ORDER[license.tier] !== undefined ? license.tier : 'amator';
      } catch (_) { return 'amator'; }
    })();
    const root = document.querySelector('#screen');
    if (!root) return;
    const card = tier => {
      const own = current === tier;
      const titles = { amator: '🛵 AMATOR', pro: '💎 PRO', warsztat: '🛠️ WARSZTAT' };
      let buttons = '';
      if (tier !== 'amator' && !own && ORDER[current] < ORDER[tier]) {
        const monthly = tier === 'pro' ? '9 zł/mies.' : '29 zł/mies.';
        const yearly = tier === 'pro' ? '100 zł/rok' : '300 zł/rok';
        buttons = '<div class="btn np-buy" data-plan="' + tier + '" data-interval="month">Wybieram ' + titles[tier].replace(/^\S+ /, '') + ' — ' + monthly + '</div>' +
          '<div class="btn np-buy" data-plan="' + tier + '" data-interval="year">Wybieram ' + titles[tier].replace(/^\S+ /, '') + ' — ' + yearly + '</div>';
      }
      return '<div class="card" style="' + (own ? 'border-color:var(--hero)' : '') + '"><h2>' + titles[tier] + (own ? ' — Twój plan' : '') + '</h2><small style="color:var(--dim)">' + (tier === 'amator' ? 'Bezpłatny, bez konta' : 'Abonament przez Stripe; anulowanie w panelu subskrypcji') + '</small>' + listHtml(tier) + buttons + '</div>';
    };
    const license = (() => { try { return JSON.parse(localStorage.getItem('naprawnik_license') || 'null'); } catch (_) { return null; } })();
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
      alert('Nie udało się sprawdzić klucza: ' + (error.message || error));
    }
    renderPlansBridge();
  };
  window.licDeactivate = function() {
    if (!confirm('Wylogować dostęp z tego urządzenia? Abonament w Stripe nie zostanie anulowany.')) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('naprawnik_license');
    if (typeof updatePlanBadge === 'function') updatePlanBadge();
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
      alert('Nie udało się otworzyć panelu subskrypcji: ' + (error.message || error));
    }
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
    const returned = query.get('checkout') === 'success';
    const cancelled = query.get('checkout') === 'cancelled';
    const billing = query.has('billing');
    if (returned || cancelled || billing || query.has('session_id')) history.replaceState(null, '', location.pathname);
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
