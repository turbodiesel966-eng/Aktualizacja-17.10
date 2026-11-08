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
  "motocykle-multi-data.js",
  "motocykle-multi.js",
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

// Sanitize mobile HTML to guarantee complete isolation from production Web PWA:
// 1. Remove syncApkWithWebNow() function and all calls
// 2. Remove any text suggesting automatic sync/updates of APK from Web
const apkCardPattern = /function renderAndroidApkCard\(\)\{[\s\S]*?async function syncApkWithWebNow\(\)\{[\s\S]*?\n\}/;
if (!apkCardPattern.test(mobileHtml)) {
  throw new Error("Could not locate renderAndroidApkCard and syncApkWithWebNow in index.html for APK isolation transformation.");
}
mobileHtml = mobileHtml.replace(
  apkCardPattern,
  `function renderAndroidApkCard(){\n` +
  `  if (typeof window !== 'undefined' && window.__naprawnikNative) {\n` +
  `    return \`<div class="diag-card" style="border-color:#00f57a"><h2 style="color:#00f57a">📱 Aplikacja Android (Wersja Warsztatowa Offline)</h2><div class="diag-sub">Zainstalowany pakiet APK działa w 100% lokalnie w warsztacie bez konieczności połączenia z internetem.</div></div>\`;\n` +
  `  }\n` +
  `  return \`<div class="diag-card" style="border-color:#00f57a"><h2 style="color:#00f57a">📲 Aplikacja Android (APK)</h2><div class="diag-sub">Pobierz oficjalny instalator NAPRAWNIKA na telefon Android — działa w 100% offline w warsztacie.</div><a class="btn" style="border-color:#00f57a;color:#00f57a;text-decoration:none" href="https://naprawnik-download.pages.dev/" target="_blank" rel="noopener noreferrer">📲 Pobierz aplikację Android (APK) ↗</a></div>\`;\n` +
  `}`
);

if (mobileHtml.includes("__naprawnikWebSync") || mobileHtml.includes("syncApkWithWebNow")) {
  throw new Error("Sanitization failed: mobile HTML still contains OTA synchronization markers.");
}
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
// The APK is completely isolated from the production Web PWA and uses only local
// pre-packaged assets in www, ensuring 100% reliable offline operation with zero remote OTA fetching.
const mobileSwPath = path.join(webDir, "sw.js");
let mobileSw = await readFile(mobileSwPath, "utf8");
const sourceCacheMatch = mobileSw.match(/^const CACHE='(naprawnik-v5-\d+)';$/m);
if (!sourceCacheMatch || mobileSw.match(/^const CACHE=/gm)?.length !== 1) {
  throw new Error("Unexpected source service-worker cache version; refusing to patch the Android cache blindly.");
}
const nativeCacheName = sourceCacheMatch[1] + "-native";

const nativeSwContent = `const CACHE='${nativeCacheName}';
const PRECACHE=[
  './index.html',
  './native-bridge.js',
  './billing.js?v=17',
  './katalog-techniczny.js',
  './druciarstwo.js',
  './motocykle-multi-data.js',
  './motocykle-multi.js',
  './manifest.webmanifest',
  './assets/naprawnik-icon.svg',
  './assets/naprawnik-icon-192.svg',
  './assets/naprawnik-icon-512.svg',
  './assets/workshop-bg.jpg',
  './assets/mod-clients.jpg',
  './assets/mod-orders.jpg',
  './assets/mod-diag.jpg',
  './assets/mod-electric.jpg',
  './assets/mod-tech.jpg',
  './assets/mod-tools.jpg',
  './assets/neon-tiles-art.jpg',
  './assets/tile-hud.jpg',
  './assets/tile-jetting.jpg',
  './assets/tile-cvt.jpg',
  './assets/tile-pinouts.jpg',
  './assets/tile-squish.jpg',
  './assets/tile-orders.jpg',
  './assets/tile-druciarstwo.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(
        ks.filter(k => k.startsWith('naprawnik-') && k.endsWith('-native') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/.netlify/')) return;

  if (e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('/index.html')) {
    e.respondWith(
      caches.match('./index.html').then(cached => cached || fetch(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
`;

await writeFile(mobileSwPath, nativeSwContent, "utf8");

const rawBridge = await readFile(path.join(root, "scripts", "native-bridge.js"), "utf8");
const iifeBridge = "(function(){\nconst Capacitor = window.Capacitor || { isNativePlatform: () => false, Plugins: {} };\nconst { App, Browser, Filesystem, Share, StatusBar } = Capacitor.Plugins || {};\nconst Directory = { Cache: \"CACHE\" };\nconst Style = { Light: \"LIGHT\" };\n" + rawBridge.replace(/^import\s+.*$/gm, "") + "\n})();\n";
await writeFile(path.join(webDir, "native-bridge.js"), iifeBridge, "utf8");
console.log("NAPRAWNIK Android web assets, branded native icon/splash, native bridge and isolated offline precache prepared.");
