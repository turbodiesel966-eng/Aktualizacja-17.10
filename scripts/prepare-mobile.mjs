import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

const requiredFiles = [
  "index.html",
  "billing.js",
  "mobile-admin-pairing.js",
  "mobile-diagnostic-content.js",
  "mobile-workshop-calculators.js",
  "katalog-techniczny.js",
  "sw.js",
  "manifest.webmanifest"
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
for (const file of requiredFiles) {
  await cp(path.join(root, file), path.join(webDir, file));
}
const mobileBillingPath = path.join(webDir, "billing.js");
let mobileBilling = await readFile(mobileBillingPath, "utf8");
const adminPromptMarker = "const key = window.prompt('Aktywacja lub połączenie ADMINA.";
if (mobileBilling.split(adminPromptMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate the admin activation prompt for the Android-only pairing screen.");
}
mobileBilling = mobileBilling.replace(
  adminPromptMarker,
  "const key = typeof window.__naprawnikAdminCodePrompt === 'function' ? window.__naprawnikAdminCodePrompt() : window.prompt('Aktywacja lub połączenie ADMINA."
);
await writeFile(mobileBillingPath, mobileBilling, "utf8");

await mkdir(path.join(webDir, "assets"), { recursive: true });
for (const file of ["naprawnik-icon.svg", "naprawnik-icon-192.svg", "naprawnik-icon-512.svg", "workshop-icons.svg"]) {
  await cp(path.join(sourceAssets, file), path.join(webDir, "assets", file));
}

const workshopSpritePath = path.join(webDir, "assets", "workshop-icons.svg");
const workshopSprite = await readFile(workshopSpritePath, "utf8");
if (!workshopSprite.includes('<symbol id="diagnostyka"') || !workshopSprite.includes('<symbol id="baza-elektryczna"')) {
  throw new Error("Workshop SVG sprite is missing or incomplete in the generated Android bundle.");
}

// Instrument only the generated Android copy. The published web/PWA source is unchanged.
const mobileIndexPath = path.join(webDir, "index.html");
let mobileHtml = await readFile(mobileIndexPath, "utf8");

/* NAPRAWNIK_ANDROID_NEON_REDESIGN_V1 — Android-only; injected into www/index.html at build time. */
const androidWorkshopDesign = String.raw`
<style id="naprawnik-android-neon-redesign-v1">
  :root{
    --android-ink:#080817;
    --android-card:#101026;
    --android-white:#fff9ff;
    --android-muted:#e4dff5;
    --android-cyan:#23e8ff;
    --android-violet:#b64cff;
    --android-gold:#ffb52e;
  }
  body{background:#070713;color:var(--android-white)}
  .frame{max-width:520px;padding:12px 12px 8px}
  .screen{padding-top:12px}
  .topbar{
    background:linear-gradient(100deg,#101027 0%,#101b38 48%,#17102b 100%);
    border:2px solid #28eaff;border-radius:16px;color:#ffb33d;
    padding:12px 14px;font-size:clamp(12px,3vw,15px);
    box-shadow:0 0 16px rgba(35,232,255,.32),inset 0 0 16px rgba(35,232,255,.09);
  }
  .brand-hero{
    background:linear-gradient(115deg,#36115c 0%,#102448 52%,#321044 100%);
    border:2px solid #27eaff;box-shadow:0 0 18px rgba(35,232,255,.25),inset 0 0 30px rgba(0,0,0,.45)
  }
  .section-label{
    display:block;margin:16px 0 9px;padding:9px 13px;border:1px solid #2beaff;
    border-radius:12px;background:linear-gradient(90deg,#092e57,#11143a 58%,#30104d);
    color:#4ceeff;font-size:13px;letter-spacing:1.3px;font-weight:900;
    box-shadow:0 0 12px rgba(35,232,255,.18);text-shadow:0 0 8px rgba(35,232,255,.7)
  }
  .grid2{gap:10px}
  .grid2 .tile:nth-child(5n+1){grid-column:1/-1;min-height:218px}
  .grid2 .tile:nth-child(5n+4),.grid2 .tile:nth-child(5n+5){min-height:148px}
  .grid2 .tile:nth-child(5n+4) .tile-icon,.grid2 .tile:nth-child(5n+5) .tile-icon{width:62px;height:62px;font-size:40px}
  .tile{
    --tile-a:#6b25b7;--tile-b:#131d46;--tile-edge:#bd55ff;
    position:relative;isolation:isolate;overflow:hidden;
    min-height:184px;padding:14px 10px 13px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;
    border:2px solid var(--tile-edge);border-radius:17px;
    background:linear-gradient(145deg,var(--tile-a) 0%,var(--tile-b) 43%,#090d21 100%);
    box-shadow:0 0 13px color-mix(in srgb,var(--tile-edge) 42%,transparent),inset 0 0 0 1px rgba(255,255,255,.1),inset 0 -24px 45px rgba(0,0,0,.32);
    text-align:center;backdrop-filter:none
  }
  .tile::before{
    content:"";position:absolute;z-index:-1;inset:0;opacity:.78;pointer-events:none;
    background:
      radial-gradient(circle at 15% 18%,rgba(255,255,255,.22),transparent 23%),
      radial-gradient(circle at 88% 15%,color-mix(in srgb,var(--tile-edge) 48%,transparent),transparent 37%),
      linear-gradient(135deg,transparent 42%,rgba(255,255,255,.08) 43%,transparent 44%),
      repeating-linear-gradient(135deg,transparent 0 17px,rgba(255,255,255,.025) 18px 19px)
  }
  .tile:active{filter:brightness(1.18);transform:translateY(1px)}
  .tile-icon{
    display:flex;align-items:center;justify-content:center;
    width:76px;height:76px;margin:0 auto 9px;border-radius:15px;
    border:1px solid rgba(255,255,255,.4);
    background:linear-gradient(145deg,rgba(6,9,28,.35),rgba(4,8,24,.88));
    box-shadow:0 0 16px color-mix(in srgb,var(--tile-edge) 65%,transparent),inset 0 0 16px rgba(255,255,255,.12);
    font-size:49px;line-height:1;text-shadow:0 4px 12px rgba(0,0,0,.7);
    filter:drop-shadow(0 2px 3px rgba(0,0,0,.75))
  }
  .tile-label{
    display:block;position:relative;color:#fff;font-family:Arial,Helvetica,sans-serif;
    font-size:clamp(13px,3.5vw,16px);font-weight:900;letter-spacing:.35px;
    line-height:1.18;text-shadow:0 2px 4px #050510,0 0 8px rgba(255,255,255,.22)
  }
  .tile-desc{
    position:relative;color:#f4efff;font-family:Arial,Helvetica,sans-serif;
    font-size:clamp(11px,2.9vw,13px);font-weight:600;line-height:1.32;
    letter-spacing:.1px;text-shadow:0 1px 3px #050510;margin-top:7px
  }
  .tile .tile-desc[style*="var(--hero)"]{color:#ffe55d!important;font-weight:900}
  .grid2 .tile:nth-child(6n+1){--tile-a:#50127e;--tile-b:#111a49;--tile-edge:#e64dff}
  .grid2 .tile:nth-child(6n+2){--tile-a:#783006;--tile-b:#17234b;--tile-edge:#ffad28}
  .grid2 .tile:nth-child(6n+3){--tile-a:#075a9a;--tile-b:#111c49;--tile-edge:#27dfff}
  .grid2 .tile:nth-child(6n+4){--tile-a:#79182b;--tile-b:#1b123b;--tile-edge:#ff5d6c}
  .grid2 .tile:nth-child(6n+5){--tile-a:#075c48;--tile-b:#101d43;--tile-edge:#28efae}
  .grid2 .tile:nth-child(6n+6){--tile-a:#755007;--tile-b:#171b48;--tile-edge:#ffd642}
  .diag-card{
    border:2px solid #23dfff;border-radius:16px;
    background:linear-gradient(135deg,#0b3154 0%,#121a3b 58%,#211039 100%);
    box-shadow:0 0 14px rgba(35,223,255,.2),inset 0 0 24px rgba(0,0,0,.35)
  }
  .diag-card h2{color:#5ceeff;font-size:14px;font-family:Arial,Helvetica,sans-serif;font-weight:900}
  .diag-sub{color:#fff0dc;font-size:13px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;font-weight:600}
  .btn{
    min-height:54px;display:flex;align-items:center;justify-content:center;gap:8px;
    padding:13px 12px;border:2px solid #30dcff;border-radius:14px;
    color:#fff;background:linear-gradient(100deg,#092f54 0%,#101b42 55%,#241143 100%);
    font-family:Arial,Helvetica,sans-serif;font-size:clamp(12px,3.1vw,14px);
    font-weight:900;line-height:1.3;text-shadow:0 1px 3px #000;
    box-shadow:0 0 12px rgba(40,220,255,.18),inset 0 0 15px rgba(255,255,255,.06)
  }
  .btn:nth-of-type(2n){border-color:#bc53ff;background:linear-gradient(100deg,#35105b,#15183f 58%,#10152e)}
  .btn:active{filter:brightness(1.2);border-color:#ffe05a}
  .btn.back{background:transparent;border:0;box-shadow:none;color:#4deaff}
  .support-cta{border-radius:15px}
  .card{background:#11172f;border:1px solid #3b83b8;color:#fff}
  .alert{background:#351b20;border:2px solid #ff9c35;color:#ffe3a6;font-weight:700}
  .nav-item.active{color:#39eaff;text-shadow:0 0 9px rgba(39,225,255,.7)}
  @media(max-width:380px){
    .tile{min-height:168px;padding:11px 7px}
    .tile-icon{width:66px;height:66px;font-size:43px}
    .tile-label{font-size:12px}
    .tile-desc{font-size:10.5px}
    .grid2{gap:8px}
  }
</style>`;
if (mobileHtml.includes("naprawnik-android-neon-redesign-v1")) {
  throw new Error("Android neon redesign already injected into the generated mobile HTML.");
}
if (!mobileHtml.includes("</head>")) {
  throw new Error("Could not find </head> to inject Android-only neon styles.");
}
mobileHtml = mobileHtml.replace("</head>", androidWorkshopDesign + "\n</head>");
const navMarker = "function nav(view, arg){";
if (mobileHtml.split(navMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate NAPRAWNIK navigation function for the Android back button.");
}
mobileHtml = mobileHtml.replace(
  navMarker,
  navMarker + '\n  window.__naprawnikView = String(view || "home");'
);
const ownerCaseRuntimeMarker = "\nconst KNOW_LINKS={";
const ownerCaseRuntime = "window.__npKnowledgeCasesBaseSnapshot = knowledgeCases.map(function (c) {\n  return Object.assign({}, c, { areas: Array.isArray(c.areas) ? c.areas.map(function (p) { return p.slice(); }) : [] });\n});\nwindow.__npApplyOwnerDiagnosticCases = function () {\n  var base = window.__npKnowledgeCasesBaseSnapshot || [];\n  var data = {};\n  try { data = JSON.parse(localStorage.getItem('naprawnik_mobile_diagnostic_cases_v1') || '{}'); } catch (_) {}\n  var overrides = data && Array.isArray(data.cases) ? data.cases : [];\n  var deleted = new Set(data && Array.isArray(data.deletedIds) ? data.deletedIds : []);\n  var byId = new Map(base.map(function (c) { return [c.id, c]; }));\n  var supplements = Array.isArray(window.__npServiceManualSupplements) ? window.__npServiceManualSupplements : [];\n  supplements.forEach(function (item) { if (item && item.id && !byId.has(item.id)) byId.set(item.id, item); });\n  overrides.forEach(function (item) { if (item && item.id) byId.set(item.id, item); });\n  var merged = Array.from(byId.values()).filter(function (item) { return !deleted.has(item.id); });\n  knowledgeCases.splice(0, knowledgeCases.length);\n  merged.forEach(function (item) { knowledgeCases.push(item); });\n  window.__npKnowledgeCasesSnapshot = knowledgeCases;\n};\nwindow.__npApplyOwnerDiagnosticCases();";
if (mobileHtml.split(ownerCaseRuntimeMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate diagnostic knowledge cases for the Android-only owner editor.");
}
mobileHtml = mobileHtml.replace(ownerCaseRuntimeMarker, "\n" + ownerCaseRuntime + ownerCaseRuntimeMarker);

const closingBody = "</body>";
let closingBodyIndex = mobileHtml.lastIndexOf(closingBody);
if (closingBodyIndex < 0) {
  throw new Error("Could not locate the document body close tag for the Android bridge.");
}
mobileHtml = mobileHtml.slice(0, closingBodyIndex) +
  '  <script src="./mobile-admin-pairing.js"></script>\n' +
  '  <script src="./mobile-diagnostic-content.js"></script>\n' +
  '  <script src="./mobile-workshop-calculators.js"></script>\n' +
  '  <script src="./native-bridge.js"></script>\n' +
  mobileHtml.slice(closingBodyIndex);
await writeFile(mobileIndexPath, mobileHtml, "utf8");

// The native bridge must be available on first launch, including when offline.
// Use a native-only cache name so old local WebView caches cannot shadow this bundle.
const mobileSwPath = path.join(webDir, "sw.js");
let mobileSw = await readFile(mobileSwPath, "utf8");
if (mobileSw.split("const CACHE='naprawnik-v5-38';").length - 1 !== 1) {
  throw new Error("Unexpected source service-worker cache version; refusing to patch the Android cache blindly.");
}
mobileSw = mobileSw.replace("const CACHE='naprawnik-v5-38';", "const CACHE='naprawnik-v5-43-owner-editor-calculators';");
const precacheMarker = "const PRECACHE=['./index.html'";
if (mobileSw.split(precacheMarker).length - 1 !== 1) {
  throw new Error("Could not locate the service-worker precache list for Android.");
}
mobileSw = mobileSw.replace(precacheMarker, "const PRECACHE=['./index.html','./native-bridge.js','./mobile-admin-pairing.js','./mobile-diagnostic-content.js','./mobile-workshop-calculators.js'");
await writeFile(mobileSwPath, mobileSw, "utf8");

console.log("NAPRAWNIK Android web assets, branded native icon/splash, native bridge, owner pairing screen and offline precache prepared.");
