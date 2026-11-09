/* APK-only NAPRAWNIK MARKET UI. Production PWA source is not modified. */
(function () {
  "use strict";
  const API = "https://naprawnik-market-staging.turbodiesel966.workers.dev";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = p => p == null ? "Cena w sklepie" : new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN"}).format(p);
  async function request(path) {
    const response = await fetch(API + path, { headers: { "Accept":"application/json" } });
    if (!response.ok) throw new Error("Katalog chwilowo niedostępny (HTTP " + response.status + ").");
    return response.json();
  }
  async function open() {
    const screen = document.querySelector(".screen");
    if (!screen) return;
    screen.innerHTML = '<div class="btn back" onclick="renderHome()">← Wróć</div><div class="brand-hero"><div class="app-title">NAPRAWNIK MARKET</div><div class="app-sub">CZĘŚCI • NARZĘDZIA • DIAGNOSTYKA</div></div><div class="card"><h2>🔎 Wyszukiwarka produktów</h2><input id="marketQuery" placeholder="np. multimetr, gaźnik, klucz..." autocomplete="off"><select id="marketCategory"><option value="">Wszystkie kategorie</option></select><div id="marketStatus" class="empty">Łączenie z katalogiem…</div><div id="marketResults"></div></div><div class="card"><small style="color:var(--dim);font-size:10px;line-height:1.5">Linki afiliacyjne mogą przynosić NAPRAWNIKOWI prowizję. Nie podwyższa to ceny zakupu. Ceny i dostępność potwierdź w sklepie przed zakupem.</small></div>';
    const query = document.getElementById("marketQuery");
    const category = document.getElementById("marketCategory");
    const status = document.getElementById("marketStatus");
    const results = document.getElementById("marketResults");
    let timer;
    async function search() {
      status.textContent = "Wyszukiwanie…";
      try {
        const params = new URLSearchParams({limit:"40"});
        if (query.value.trim()) params.set("q",query.value.trim());
        if (category.value) params.set("category",category.value);
        const data = await request("/products?" + params.toString());
        const items = data.items || [];
        status.textContent = items.length ? "Znaleziono: " + items.length : "Brak produktów dla tych kryteriów.";
        results.innerHTML = items.map(item => '<div class="entry" style="display:flex;gap:10px;align-items:center">'+
          (item.image_url ? '<img src="'+esc(item.image_url)+'" alt="" loading="lazy" style="width:64px;height:64px;object-fit:contain;background:#fff;border-radius:6px">' : '')+
          '<div style="min-width:0;flex:1"><b>'+esc(item.title)+'</b><small>'+esc(item.program)+' • '+esc(item.brand||item.category)+'</small><small>'+esc(money(item.price))+'</small><a class="btn" style="margin:6px 0 0;text-decoration:none" href="'+esc(item.product_url)+'" target="_blank" rel="noopener noreferrer sponsored">Otwórz ofertę ↗</a></div></div>').join("");
      } catch (error) {
        status.textContent = error.message || "Nie udało się pobrać katalogu.";
        results.innerHTML = "";
      }
    }
    try {
      const data = await request("/categories");
      (data.categories || []).forEach(item => {
        const option = document.createElement("option");
        option.value = item.category;
        option.textContent = item.category + " (" + item.count + ")";
        category.appendChild(option);
      });
      await search();
    } catch (error) { status.textContent = error.message || "Katalog nie jest jeszcze gotowy."; }
    query.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(search,300);});
    category.addEventListener("change",search);
  }
  function attachHomeEntry() {
    if (typeof window.renderHome !== "function" || window.renderHome.__marketWrapped) return;
    const original = window.renderHome;
    const wrapped = function () {
      original.apply(this,arguments);
      const screen = document.querySelector(".screen");
      if (!screen || screen.querySelector("[data-market-entry]")) return;
      const card = document.createElement("div");
      card.className = "diag-card";
      card.style.borderColor = "var(--cyan)";
      card.setAttribute("data-market-entry","true");
      card.innerHTML = '<h2>🛒 NAPRAWNIK MARKET</h2><div class="diag-sub">Części, narzędzia, elektronika i wyposażenie warsztatu — katalog ofert partnerów.</div><div class="btn" data-open-market>Otwórz katalog produktów</div>';
      screen.insertBefore(card,screen.firstChild);
      card.querySelector("[data-open-market]").addEventListener("click",open);
    };
    wrapped.__marketWrapped = true;
    window.renderHome = wrapped;
  }
  attachHomeEntry();
  window.NaprawnikMarket = Object.freeze({open});
})();
