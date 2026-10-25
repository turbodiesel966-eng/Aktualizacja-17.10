const CACHE='naprawnik-v5-22';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./index.html','./billing.js?v=5'])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/.netlify/'))return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));}return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  if(e.request.destination==='script'){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request)));
  }
});
