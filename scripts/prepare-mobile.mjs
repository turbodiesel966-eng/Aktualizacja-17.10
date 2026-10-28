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
for (const file of ["naprawnik-icon.svg", "naprawnik-icon-192.svg", "naprawnik-icon-512.svg"]) {
  await cp(path.join(sourceAssets, file), path.join(webDir, "assets", file));
}

// Instrument only the generated Android copy. The published web/PWA source is unchanged.
const mobileIndexPath = path.join(webDir, "index.html");
let mobileHtml = await readFile(mobileIndexPath, "utf8");
const navMarker = "function nav(view, arg){";
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
// Inject a runtime bridge into the generated APK copy only. The source website remains unchanged.
const ownerCaseRuntimeMarker = "\nconst KNOW_LINKS={";
const ownerCaseRuntime = `
window.__npKnowledgeCasesBaseSnapshot = knowledgeCases.map(function (c) {
  return Object.assign({}, c, { areas: Array.isArray(c.areas) ? c.areas.map(function (p) { return p.slice(); }) : [] });
});
window.__npApplyOwnerDiagnosticCases = function () {
  var base = window.__npKnowledgeCasesBaseSnapshot || [];
  var data = {};
  try { data = JSON.parse(localStorage.getItem('naprawnik_mobile_diagnostic_cases_v1') || '{}'); } catch (_) {}
  var overrides = data && Array.isArray(data.cases) ? data.cases : [];
  var deleted = new Set(data && Array.isArray(data.deletedIds) ? data.deletedIds : []);
  var byId = new Map(base.map(function (c) { return [c.id, c]; }));
  overrides.forEach(function (item) { if (item && item.id) byId.set(item.id, item); });
  var merged = Array.from(byId.values()).filter(function (item) { return !deleted.has(item.id); });
  knowledgeCases.splice(0, knowledgeCases.length);
  merged.forEach(function (item) { knowledgeCases.push(item); });
  window.__npKnowledgeCasesSnapshot = knowledgeCases;
};
window.__npApplyOwnerDiagnosticCases();
`;
if (mobileHtml.split(ownerCaseRuntimeMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate diagnostic knowledge cases for the Android-only owner editor.");
}
mobileHtml = mobileHtml.replace(ownerCaseRuntimeMarker, "\n" + ownerCaseRuntime + ownerCaseRuntimeMarker);
mobileHtml = mobileHtml.slice(0, closingBodyIndex) +
  '  <script src="./mobile-admin-pairing.js"></script>\n' +
  '  <script src="./mobile-diagnostic-content.js"></script>\n' +
  '  <script src="./native-bridge.js"></script>\n' +
  mobileHtml.slice(closingBodyIndex);
await writeFile(mobileIndexPath, mobileHtml, "utf8");

// The native bridge must be available on first launch, including when offline.
// Use a native-only cache name so old local WebView caches cannot shadow this bundle.
const mobileSwPath = path.join(webDir, "sw.js");
let mobileSw = await readFile(mobileSwPath, "utf8");
if (mobileSw.split("const CACHE='naprawnik-v5-37';").length - 1 !== 1) {
  throw new Error("Unexpected source service-worker cache version; refusing to patch the Android cache blindly.");
}
mobileSw = mobileSw.replace("const CACHE='naprawnik-v5-37';", "const CACHE='naprawnik-v5-41-owner-fault-editor';");
const precacheMarker = "const PRECACHE=['./index.html'";
if (mobileSw.split(precacheMarker).length - 1 !== 1) {
  throw new Error("Could not locate the service-worker precache list for Android.");
}
mobileSw = mobileSw.replace(precacheMarker, "const PRECACHE=['./index.html','./native-bridge.js','./mobile-admin-pairing.js','./mobile-diagnostic-content.js'");
await writeFile(mobileSwPath, mobileSw, "utf8");

console.log("NAPRAWNIK Android web assets, branded native icon/splash, native bridge, owner pairing screen and offline precache prepared.");
