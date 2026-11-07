const CACHE='naprawnik-v5-47';
const PRECACHE=['./index.html','./billing.js?v=17','./katalog-techniczny.js','./druciarstwo.js','./manifest.webmanifest','./assets/naprawnik-icon.svg','./assets/naprawnik-icon-192.svg','./assets/naprawnik-icon-512.svg','./assets/neon-tiles-art.jpg','./assets/tile-hud.jpg','./assets/tile-jetting.jpg','./assets/tile-cvt.jpg','./assets/tile-pinouts.jpg','./assets/tile-squish.jpg','./assets/tile-orders.jpg','./assets/tile-druciarstwo.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('naprawnik-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data&&e.data.action==='skipWaiting')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/.netlify/'))return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));}return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  if(['script','style','image','manifest'].includes(e.request.destination)){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request)));
  }
});
