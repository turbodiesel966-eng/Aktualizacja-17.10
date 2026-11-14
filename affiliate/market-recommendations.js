/* NAPRAWNIK MARKET — wspólna warstwa rekomendacji kontekstowych i listy zakupów.
 * Wyniki katalogu są wskazówkami wyszukiwania, nigdy automatycznym potwierdzeniem kompatybilności.
 */
(function () {
  "use strict";
  const API = "https://naprawnik-market-live.turbodiesel966.workers.dev";
  const KEY = "naprawnik_market_shopping_list_v1";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = value => value == null ? "Cena w sklepie" : new Intl.NumberFormat("pl-PL", {style:"currency",currency:"PLN"}).format(value);
  const readList = () => { try { const value=JSON.parse(localStorage.getItem(KEY)||"[]"); return Array.isArray(value)?value:[]; } catch (_) { return []; } };
  const writeList = items => { try { localStorage.setItem(KEY,JSON.stringify(items)); return true; } catch (_) { return false; } };
  const queries = {
    pinout: "multimetr sondy pomiarowe przewody pomiarowe konektory",
    jetting: "dysza gaźnika zestaw dysz iglica gaźnik śrubokręt regulacyjny",
    service: "olej silnikowy filtr oleju świeca zapłonowa płyn hamulcowy pasek CVT",
    brake: "klocki hamulcowe tarcza hamulcowa płyn hamulcowy",
    ignition: "świeca zapłonowa fajka świecy cewka zapłonowa multimetr",
    fuel: "gaźnik dysza zestaw naprawczy gaźnika filtr paliwa",
    cvt: "pasek CVT rolki wariatora ślizgi sprzęgło skuter",
    general: "narzędzia motocyklowe multimetr klucz dynamometryczny"
  };
  function searchTerm(context, query) {
    const explicit=String(query||"").trim();
    const mapped=queries[context]||"";
    return (explicit+" "+mapped).trim().slice(0,100);
  }
  function render(options) {
    const o=options||{};
    const context=String(o.context||"general");
    const term=searchTerm(context,o.query);
    const title=String(o.title||"Produkty i narzędzia do tej czynności");
    const reason=String(o.reason||"Sprawdź parametry przed zakupem.");
    return '<section class="card market-recommendations" data-market-context="'+esc(context)+'" data-market-query="'+esc(term)+'" style="border:1px solid rgba(255,145,48,.42);background:linear-gradient(120deg,rgba(255,140,26,.07),rgba(34,211,238,.04))">'+
      '<div style="display:flex;gap:8px;align-items:center"><img src="./assets/naprawnik-market-icon.svg" alt="" width="32" height="32" style="object-fit:contain"><div><b style="display:block;color:#ffad52;font-size:14px">NAPRAWNIK MARKET</b><small style="color:var(--dim)">Dobór do czynności warsztatowej</small></div></div>'+
      '<h3 style="margin:8px 0 4px">'+esc(title)+'</h3><small style="color:var(--dim)">'+esc(reason)+'</small>'+
      '<div class="market-recommendation-results" style="margin-top:8px"><button type="button" class="btn" style="margin:0;border-color:#ff991f;color:#ffb15c" onclick="window.NaprawnikMarketRecommendations.load(this)">🔎 Pokaż 3–6 produktów w Market</button></div>'+
      '<div style="margin-top:6px"><button type="button" class="btn" style="width:auto;margin:0;padding:5px 9px;font-size:11px" onclick="nav(\'market\',\''+esc(term.replace(/'/g,""))+'\')">Otwórz pełny Market →</button></div>'+
    '</section>';
  }
  async function load(button) {
    const card=button.closest(".market-recommendations");
    const host=card&&card.querySelector(".market-recommendation-results");
    if(!host)return;
    const context=card.dataset.marketContext||"general";
    const query=card.dataset.marketQuery||"";
    host.innerHTML='<div class="empty">Szukam dopasowanych ofert…</div>';
    try {
      const params=new URLSearchParams({q:query,limit:"60"});
      const response=await fetch(API+"/products?"+params.toString(),{headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("Katalog chwilowo niedostępny (HTTP "+response.status+").");
      const data=await response.json();
      const items=(data.items||[]).filter(item=>{
        const text=(item.title+" "+(item.description||"")+" "+(item.category||"")).toLocaleLowerCase("pl");
        const exclusions=/(kosiark|podkaszark|żywopłot|agregat malarski|klimatyzacj|kobyłki samochodow|dywaniki samochodow)/i;
        if(exclusions.test(text))return false;
        return true;
      }).slice(0,6);
      if(!items.length){host.innerHTML='<div class="empty">Brak pewnych ofert dla tej frazy. Otwórz Market i doprecyzuj wyszukiwanie.</div>';return;}
      const list=readList();
      host.innerHTML=items.map(item=>{
        const inList=list.some(x=>String(x.id)===String(item.id));
        const type=context==="pinout"||context==="general"?"Narzędzie":context==="service"?"Materiał / część":"Część / narzędzie — potwierdź parametry";
        return '<article class="entry" style="display:flex;gap:9px;align-items:center">'+
          (item.image_url?'<img src="'+esc(item.image_url)+'" alt="" loading="lazy" style="width:58px;height:58px;object-fit:contain;background:#fff;border-radius:7px">':'')+
          '<div style="min-width:0;flex:1"><b style="display:block;color:var(--text)">'+esc(item.title)+'</b>'+
          '<small>'+esc(item.program||"Sklep")+' · '+esc(item.category||"")+'</small>'+
          '<div style="color:var(--hero);font-weight:800;margin-top:3px">'+esc(money(item.price))+'</div>'+
          '<small style="color:var(--dim)">'+esc(type)+' · Kompatybilność niepotwierdzona</small>'+
          '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">'+
          '<button type="button" class="btn" data-market-add data-product-id="'+Number(item.id)+'" data-product-title="'+esc(item.title)+'" style="width:auto;margin:0;padding:4px 7px;font-size:10px">'+(inList?'✓ Na liście':'＋ Lista zakupów')+'</button>'+
          '<a class="btn" style="width:auto;margin:0;padding:4px 7px;font-size:10px;text-decoration:none" href="'+esc(item.product_url)+'" target="_blank" rel="noopener noreferrer sponsored" onclick="window.NaprawnikMarketRecommendations.clicked(\''+context+'\','+Number(item.id)+')">Sprawdź produkt ↗</a>'+
          '</div></div></article>';
      }).join("");
      const updated=readList();
      host.innerHTML+='<button class="btn" type="button" style="margin-top:8px;border-color:#ff991f;color:#ffb15c" onclick="window.NaprawnikMarketRecommendations.showList()">🛒 Lista zakupów ('+updated.length+')</button>';
    } catch(error) { host.innerHTML='<div class="empty">'+esc(error.message||"Błąd katalogu.")+'</div>'; }
  }
  function add(id,title) {
    const list=readList();
    if(!list.some(item=>String(item.id)===String(id)))list.push({id:Number(id),title:String(title).slice(0,180),addedAt:new Date().toISOString()});
    writeList(list);
    document.querySelectorAll("[data-market-add][data-product-id]").forEach(btn=>{if(String(btn.dataset.productId)===String(id))btn.textContent="✓ Na liście";});
  }
  function showList() {
    const list=readList();
    const screen=document.querySelector(".screen");
    if(!screen)return;
    screen.innerHTML='<div class="btn back" onclick="nav(\'market\')">← Powrót do Marketu</div><div class="card"><h2>🛒 Lista zakupów</h2>'+
      (list.length?list.map(item=>'<div class="entry"><b>'+esc(item.title)+'</b><button type="button" class="btn" style="width:auto;padding:4px 8px;margin:5px 0" onclick="window.NaprawnikMarketRecommendations.remove('+Number(item.id)+')">Usuń</button></div>').join(""):'<div class="empty">Lista jest pusta.</div>')+
      '<button class="btn" type="button" onclick="nav(\'market\')">Wróć do katalogu</button></div>';
  }
  function remove(id){writeList(readList().filter(item=>String(item.id)!==String(id)));showList();}
  function clicked(context,id){
    try {
      const key="naprawnik_market_clicks_v1";
      const items=JSON.parse(localStorage.getItem(key)||"[]");
      items.push({context:String(context),productId:Number(id),at:new Date().toISOString()});
      localStorage.setItem(key,JSON.stringify(items.slice(-500)));
    } catch (_) {}
  }
  document.addEventListener("click", event => {
    const addButton = event.target.closest("[data-market-add]");
    if (addButton) {
      add(Number(addButton.dataset.productId), addButton.dataset.productTitle || "");
      return;
    }
  });
  window.NaprawnikMarketRecommendations=Object.freeze({render,load,add,showList,remove,clicked});
})();
