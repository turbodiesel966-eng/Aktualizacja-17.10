import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const webDir = path.join(root, "www");
const sourceAssets = path.join(root, "assets");
const appIconPath = path.join(sourceAssets, "naprawnik-icon-512.svg");
const iconSvg = await readFile(appIconPath, "utf8");
const iconSvg1024 = iconSvg.replace('width="512" height="512"', 'width="1024" height="1024"');
const foregroundSvg = iconSvg1024
  .replace(/<rect width="512" height="512" rx="112" fill="#0a0a14"\/>\s*/, "")
  .replace(/<rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#33334d" stroke-width="10"\/>\s*/, "");

if (foregroundSvg === iconSvg1024) {
  throw new Error("Could not derive the transparent NAPRAWNIK launcher foreground from the SVG icon.");
}

try {
  const { default: sharp } = await import("sharp");
  // Generate the official Capacitor asset inputs from the existing vector logo.
  // These PNGs are build assets, not runtime app data, and are recreated on every build.
  await sharp(Buffer.from(iconSvg1024)).resize(1024, 1024).png().toFile(path.join(sourceAssets, "icon-only.png"));
  await sharp(Buffer.from(foregroundSvg)).resize(1024, 1024).png().toFile(path.join(sourceAssets, "icon-foreground.png"));
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: "#0a0a14" }
  }).png().toFile(path.join(sourceAssets, "icon-background.png"));

  const splashTitle = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="2732" height="340" viewBox="0 0 2732 340">
    <text x="1366" y="145" text-anchor="middle" fill="#ff8c1a" font-family="Courier New, monospace" font-size="146" font-weight="700" letter-spacing="8">NAPRAWNIK</text>
    <text x="1366" y="245" text-anchor="middle" fill="#22d3ee" font-family="Courier New, monospace" font-size="54" font-weight="700" letter-spacing="5">WARSZTAT • DIAGNOSTYKA • NAPRAWY</text>
  </svg>`);
  const splashForeground = await sharp(Buffer.from(foregroundSvg)).resize(1080, 1080).png().toBuffer();
  for (const name of ["splash.png", "splash-dark.png"]) {
    await sharp({
      create: { width: 2732, height: 2732, channels: 4, background: "#0a0a14" }
    }).composite([
      { input: splashForeground, left: 826, top: 560 },
      { input: splashTitle, left: 0, top: 1760 }
    ]).png().toFile(path.join(sourceAssets, name));
  }

} catch (_) {}

const requiredFiles = [
  "index.html",
  "billing.js",
  "katalog-techniczny.js",
  "druciarstwo.js",
  "sw.js",
  "manifest.webmanifest"
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
for (const file of requiredFiles) {
  await cp(path.join(root, file), path.join(webDir, file));
}
await mkdir(path.join(webDir, "assets"), { recursive: true });
for (const file of [
  "naprawnik-icon.svg",
  "naprawnik-icon-192.svg",
  "naprawnik-icon-512.svg",
  "neon-tiles-art.jpg",
  "tile-hud.jpg",
  "tile-jetting.jpg",
  "tile-cvt.jpg",
  "tile-pinouts.jpg",
  "tile-squish.jpg",
  "tile-orders.jpg",
  "tile-druciarstwo.jpg",
  "workshop-bg.jpg",
  "mod-clients.jpg",
  "mod-orders.jpg",
  "mod-diag.jpg",
  "mod-electric.jpg",
  "mod-tech.jpg",
  "mod-tools.jpg"
]) {
  await cp(path.join(sourceAssets, file), path.join(webDir, "assets", file));
}

// Instrument only the generated Android copy. The published web/PWA source is unchanged.
const mobileIndexPath = path.join(webDir, "index.html");
let mobileHtml = await readFile(mobileIndexPath, "utf8");
const navMarker = "function nav(view, arg, restoreState){";
if (mobileHtml.split(navMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate NAPRAWNIK navigation function for the Android back button.");
}
mobileHtml = mobileHtml.replace(
  navMarker,
  navMarker + '\n  window.__naprawnikView = String(view || "home");'
);
const closingBody = "</body>";
const closingBodyIndex = mobileHtml.lastIndexOf(closingBody);
if (closingBodyIndex < 0) {
  throw new Error("Could not locate the document body close tag for the Android bridge.");
}
mobileHtml = mobileHtml.slice(0, closingBodyIndex) +
  '  <script src="./native-bridge.js"></script>\n' +
  mobileHtml.slice(closingBodyIndex);
await writeFile(mobileIndexPath, mobileHtml, "utf8");

// The native bridge must be available on first launch, including when offline.
// In addition, when online, the native Service Worker transparently syncs the latest
// index.html, billing.js, katalog-techniczny.js and assets from the live GitHub Pages
// deployment so any change to the Web app immediately updates the installed APK too.
const mobileSwPath = path.join(webDir, "sw.js");
let mobileSw = await readFile(mobileSwPath, "utf8");
const sourceCacheMatch = mobileSw.match(/^const CACHE='(naprawnik-v5-\d+)';$/m);
if (!sourceCacheMatch || mobileSw.match(/^const CACHE=/gm)?.length !== 1) {
  throw new Error("Unexpected source service-worker cache version; refusing to patch the Android cache blindly.");
}
const nativeCacheName = sourceCacheMatch[1] + "-native";

const nativeSwContent = `const CACHE='${nativeCacheName}';
const WEB_LIVE_BASE='https://turbodiesel966-eng.github.io/Aktualizacja-17.10';
const PRECACHE=['./index.html','./native-bridge.js','./billing.js?v=17','./katalog-techniczny.js','./druciarstwo.js','./manifest.webmanifest','./assets/naprawnik-icon.svg','./assets/naprawnik-icon-192.svg','./assets/naprawnik-icon-512.svg','./assets/neon-tiles-art.jpg','./assets/workshop-bg.jpg','./assets/mod-clients.jpg','./assets/mod-orders.jpg','./assets/mod-diag.jpg','./assets/mod-electric.jpg','./assets/mod-tech.jpg','./assets/mod-tools.jpg'];
function instrumentNativeHtml(html){
  if(typeof html!=='string'||!html.includes('const APP_VERSION')||!html.includes('const MAIN_MODULES'))return null;
  let out=html;
  const navMarker='function nav(view, arg, restoreState){';
  if(!out.includes('window.__naprawnikView')&&out.includes(navMarker)){
    out=out.replace(navMarker,navMarker+'\\n  window.__naprawnikView = String(view || "home");');
  }
  if(!out.includes('./native-bridge.js')){
    const idx=out.lastIndexOf('</body>');
    if(idx>=0)out=out.slice(0,idx)+'  <script src="./native-bridge.js"></script>\\n'+out.slice(idx);
  }
  return out;
}
async function fetchLiveWithTimeout(url,ms){
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),ms||4000);
  try{
    return await fetch(url,{cache:'no-cache',mode:'cors',credentials:'omit',signal:ctl.signal});
  }finally{
    clearTimeout(t);
  }
}
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('naprawnik-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/.netlify/'))return;
  if(e.request.mode==='navigate'||u.pathname==='/'||u.pathname.endsWith('/index.html')){
    e.respondWith((async()=>{
      try{
        const liveRes=await fetchLiveWithTimeout(WEB_LIVE_BASE+'/index.html?v='+Date.now(),4000);
        if(liveRes&&liveRes.ok){
          const rawHtml=await liveRes.text();
          const patched=instrumentNativeHtml(rawHtml);
          if(patched){
            const resp=new Response(patched,{status:200,headers:{'Content-Type':'text/html;charset=utf-8'}});
            const c=await caches.open(CACHE);
            await c.put('./index.html',resp.clone());
            return resp;
          }
        }
      }catch(_){}
      const cached=await caches.match('./index.html');
      if(cached)return cached;
      return fetch(e.request);
    })());
    return;
  }
  if(u.pathname.endsWith('/native-bridge.js')){
    e.respondWith(caches.match('./native-bridge.js').then(r=>r||fetch(e.request)));
    return;
  }
  if(['script','style','image','manifest'].includes(e.request.destination)){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
    return;
  }
  if(false){
    e.respondWith((async()=>{
      try{
        const relPath=u.pathname.replace(/^\\/+/, '');
        const liveUrl=WEB_LIVE_BASE+'/'+relPath+(u.search||'');
        const liveRes=await fetchLiveWithTimeout(liveUrl,4000);
        if(liveRes&&liveRes.ok){
          const c=await caches.open(CACHE);
          await c.put(e.request,liveRes.clone());
          return liveRes;
        }
      }catch(_){}
      const cached=await caches.match(e.request);
      if(cached)return cached;
      return fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r;});
    })());
  }
});
`;

await writeFile(mobileSwPath, nativeSwContent, "utf8");

const rawBridge = await readFile(path.join(root, "scripts", "native-bridge.js"), "utf8");
const iifeBridge = "(function(){\nconst Capacitor = window.Capacitor || { isNativePlatform: () => false, Plugins: {} };\nconst { App, Browser, Filesystem, Share, StatusBar } = Capacitor.Plugins || {};\nconst Directory = { Cache: \"CACHE\" };\nconst Style = { Light: \"LIGHT\" };\n" + rawBridge.replace(/^import\s+.*$/gm, "") + "\n})();\n";
await writeFile(path.join(webDir, "native-bridge.js"), iifeBridge, "utf8");
console.log("NAPRAWNIK Android web assets, branded native icon/splash, native bridge, live OTA web-sync and offline precache prepared.");
