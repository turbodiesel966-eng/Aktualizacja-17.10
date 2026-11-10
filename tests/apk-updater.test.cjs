const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    _dump() { return Object.fromEntries(map.entries()); },
  };
}

function createDomStub() {
  const elements = new Map();
  function makeEl(tag, id = "") {
    const listeners = new Map();
    const el = {
      tagName: String(tag || "DIV").toUpperCase(),
      id,
      className: "",
      style: { cssText: "", display: "" },
      dataset: {},
      children: [],
      parentNode: null,
      textContent: "",
      _innerHTML: "",
      get innerHTML() { return this._innerHTML; },
      set innerHTML(val) {
        this._innerHTML = String(val || "");
        // Rejestruj podstawowe id ze wstawionego HTML dla querySelector/getElementById
        const idMatches = [...this._innerHTML.matchAll(/id=["']([^"']+)["']/g)];
        for (const m of idMatches) {
          if (!elements.has(m[1])) {
            const child = makeEl("SPAN", m[1]);
            child.parentNode = el;
            elements.set(m[1], child);
          }
        }
      },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatch(type, ev = {}) {
        for (const fn of listeners.get(type) || []) fn(ev);
      },
      click() { this.dispatch("click", { target: this }); },
      appendChild(node) {
        node.parentNode = this;
        this.children.push(node);
        if (node.id) elements.set(node.id, node);
        return node;
      },
      insertBefore(node, ref) {
        node.parentNode = this;
        const idx = this.children.indexOf(ref);
        if (idx >= 0) this.children.splice(idx, 0, node);
        else this.children.push(node);
        if (node.id) elements.set(node.id, node);
        return node;
      },
      querySelector(sel) {
        if (sel.startsWith("#")) return elements.get(sel.slice(1)) || null;
        if (sel === ".topbar") return elements.get("__topbar") || null;
        return null;
      },
    };
    return el;
  }

  const frame = makeEl("DIV", "__frame");
  const topbar = makeEl("DIV", "__topbar");
  const topUpdateBar = makeEl("DIV", "topUpdateBar");
  elements.set("__frame", frame);
  elements.set("__topbar", topbar);
  elements.set("topUpdateBar", topUpdateBar);
  frame.appendChild(topbar);
  frame.appendChild(topUpdateBar);

  const body = makeEl("BODY", "__body");
  const docListeners = new Map();

  return {
    elements,
    document: {
      readyState: "complete",
      visibilityState: "visible",
      body,
      createElement(tag) { return makeEl(tag); },
      getElementById(id) { return elements.get(id) || null; },
      querySelector(sel) {
        if (sel === ".frame") return frame;
        if (sel.startsWith("#")) return elements.get(sel.slice(1)) || null;
        return null;
      },
      addEventListener(type, fn) {
        if (!docListeners.has(type)) docListeners.set(type, []);
        docListeners.get(type).push(fn);
      },
      dispatch(type, ev = {}) {
        for (const fn of docListeners.get(type) || []) fn(ev);
      },
    },
  };
}

function loadNativeBridgeInVm({ pluginOverrides = {}, initialStorage = {} } = {}) {
  const bridgeSrc = fs.readFileSync(path.join(root, "www", "native-bridge.js"), "utf8");
  const { document, elements } = createDomStub();
  const localStorage = createStorage(initialStorage);
  const appListeners = new Map();
  const progressListeners = [];

  const ApkUpdater = {
    async getInstalledInfo() {
      return {
        packageName: "pl.turbodiesel.naprawnik",
        versionName: "5.49",
        versionCode: 3065300,
        canRequestPackageInstalls: true,
        hasDownloadedApk: false,
      };
    },
    async fetchUpdateMetadata({ url }) {
      return {
        appId: "pl.turbodiesel.naprawnik",
        versionName: "5.50",
        versionCode: 3065305,
        apkUrl: "https://naprawnik-download.pages.dev/app-debug.apk",
        sha256: "a".repeat(64),
        size: 28000000,
        changelog: "Nowa baza diagnostyczna",
      };
    },
    async downloadAndVerifyApk(opts) {
      for (const l of progressListeners) {
        l({ downloadedBytes: 14000000, totalBytes: opts.expectedSize || 28000000, percent: 50 });
        l({ downloadedBytes: opts.expectedSize || 28000000, totalBytes: opts.expectedSize || 28000000, percent: 100 });
      }
      return {
        verified: true,
        sha256: opts.expectedSha256,
        size: opts.expectedSize,
        packageName: "pl.turbodiesel.naprawnik",
        versionName: "5.50",
        versionCode: 3065305,
      };
    },
    async cancelDownload() { return { cancelled: true }; },
    async openInstallPermissionSettings() { return { canInstall: true }; },
    async installVerifiedApk() { return { launched: true, cancelled: false, ok: true }; },
    async addListener(name, fn) {
      if (name === "downloadProgress") progressListeners.push(fn);
      return { remove: async () => {} };
    },
    ...pluginOverrides,
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    Date,
    Math,
    Number,
    String,
    Boolean,
    JSON,
    Promise,
    Error,
    localStorage,
    document,
    navigator: {},
    alert: () => {},
    confirm: () => true,
    location: { href: "https://localhost/", origin: "https://localhost" },
    HTMLElement: class HTMLElement {},
    window: null,
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: {
        StatusBar: { setBackgroundColor: async () => {}, setStyle: async () => {} },
        Browser: { open: async () => {}, addListener: async () => ({ remove: async () => {} }) },
        Filesystem: { writeFile: async () => ({ uri: "file:///tmp/x" }) },
        Share: { share: async () => {} },
        App: {
          addListener: async (name, fn) => {
            if (!appListeners.has(name)) appListeners.set(name, []);
            appListeners.get(name).push(fn);
            return { remove: async () => {} };
          },
          exitApp: async () => {},
        },
        ApkUpdater,
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(bridgeSrc, sandbox);

  return {
    window: sandbox,
    localStorage,
    elements,
    document,
    appListeners,
    updater: sandbox.__naprawnikApkUpdater,
  };
}

test("configure-android-project computes monotonic versionCode and patches files safely", async () => {
  const mod = await import(pathToFileURL(path.join(root, "scripts", "configure-android-project.mjs")).href);

  const m1 = mod.computeVersionMeta({ version: "5.49", build: 1730653000000 }, 10);
  const m2 = mod.computeVersionMeta({ version: "5.50", build: 1730653000000 }, 11);
  assert.equal(m1.versionName, "5.49");
  assert.ok(m1.versionCode > 1, "versionCode musi być większy od domyślnego Capacitor 1");
  assert.ok(m2.versionCode > m1.versionCode, "kolejny build CI musi zwiększać versionCode");

  const origMain = `package pl.turbodiesel.naprawnik;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n`;
  const patchedMain = mod.patchMainActivity(origMain);
  assert.match(patchedMain, /import android\.os\.Bundle;/);
  assert.match(patchedMain, /registerPlugin\(ApkUpdaterPlugin\.class\);/);
  assert.match(patchedMain, /super\.onCreate\(savedInstanceState\);/);

  const origManifest = `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application>\n    </application>\n</manifest>`;
  const patchedManifest = mod.patchManifest(origManifest);
  assert.match(patchedManifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(patchedManifest, /android\.permission\.ACCESS_NETWORK_STATE/);
  assert.match(patchedManifest, /apkupdater\.provider/);
  assert.match(patchedManifest, /apk_updater_paths/);

  const origGradle = `android {\n    defaultConfig {\n        versionCode 1\n        versionName "1.0"\n    }\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}`;
  const patchedGradle = mod.patchBuildGradle(origGradle, { versionCode: m2.versionCode, versionName: "5.50", keystoreConfigured: true });
  assert.match(patchedGradle, new RegExp(`versionCode ${m2.versionCode}`));
  assert.match(patchedGradle, /versionName "5\.50"/);
  assert.match(patchedGradle, /signingConfigs\.naprawnik/);
});

test("APK updater rejects downgrade, older/equal versions and cross-package payloads", async () => {
  const { updater } = loadNativeBridgeInVm();
  assert.ok(updater, "window.__naprawnikApkUpdater musi być zarejestrowany");

  const installed = { packageName: "pl.turbodiesel.naprawnik", versionName: "5.50", versionCode: 3065310 };
  assert.equal(updater.isUpdateNewer({ appId: "pl.turbodiesel.naprawnik", versionName: "5.51", versionCode: 3065311 }, installed), true);
  assert.equal(updater.isUpdateNewer({ appId: "pl.turbodiesel.naprawnik", versionName: "5.50", versionCode: 3065310 }, installed), false);
  assert.equal(updater.isUpdateNewer({ appId: "pl.turbodiesel.naprawnik", versionName: "5.49", versionCode: 3065305 }, installed), false);
  assert.equal(updater.isUpdateNewer({ appId: "pl.turbodiesel.naprawnik", versionName: "5.48", versionCode: 3065399 }, installed), false);
  assert.equal(updater.isUpdateNewer({ appId: "com.other.app", versionName: "9.99", versionCode: 9999999 }, installed), false);
});

test("APK updater throttles background checks, bypasses throttle manually and stays safe offline", async () => {
  let metadataCalls = 0;
  let shouldFail = false;
  const workshopVehicles = JSON.stringify([{ id: "v1", brand: "Yamaha", model: "MT-07" }]);
  const { updater, localStorage } = loadNativeBridgeInVm({
    initialStorage: { naprawnik_vehicles: workshopVehicles },
    pluginOverrides: {
      async fetchUpdateMetadata() {
        metadataCalls++;
        if (shouldFail) {
          const e = new Error("Offline");
          e.code = "NETWORK_ERROR";
          throw e;
        }
        return {
          appId: "pl.turbodiesel.naprawnik",
          versionName: "5.50",
          versionCode: 3065315,
          apkUrl: "https://naprawnik-download.pages.dev/app-debug.apk",
          sha256: "b".repeat(64),
          size: 26000000,
        };
      },
    },
  });

  const first = await updater.check({ manual: false });
  assert.equal(first.updateAvailable, true);
  assert.equal(metadataCalls, 1);
  assert.equal(updater.getState().status, "available");

  // Ponowne automatyczne sprawdzenie w obrębie okna throttling (< 15 min) nie odpytuje serwera
  const throttled = await updater.check({ manual: false });
  assert.equal(throttled, null);
  assert.equal(metadataCalls, 1);

  // Ręczne kliknięcie omija throttling
  const manual = await updater.check({ manual: true, openModalOnManual: false });
  assert.equal(manual.updateAvailable, true);
  assert.equal(metadataCalls, 2);

  // Błąd sieci przy ręcznym sprawdzeniu daje przyjazny status error i nie kasuje danych użytkownika
  shouldFail = true;
  const offlineRes = await updater.check({ manual: true, openModalOnManual: false });
  assert.equal(offlineRes.updateAvailable, false);
  assert.equal(updater.getState().status, "error");
  assert.match(updater.getState().errorMessage, /offline/i);
  assert.equal(localStorage.getItem("naprawnik_vehicles"), workshopVehicles);
});

test("APK updater handles download progress, SHA-256 mismatch, permissions, install cancellation and post-update confirmation", async () => {
  let canInstall = false;
  let cancelNextInstall = true;
  let currentVersionCode = 3065300;
  let currentVersionName = "5.49";
  let failDownloadCode = "";

  const vehicles = JSON.stringify([{ id: "v-1", model: "CBR600RR" }]);
  const { updater, localStorage } = loadNativeBridgeInVm({
    initialStorage: { naprawnik_vehicles: vehicles },
    pluginOverrides: {
      async getInstalledInfo() {
        return {
          packageName: "pl.turbodiesel.naprawnik",
          versionName: currentVersionName,
          versionCode: currentVersionCode,
          canRequestPackageInstalls: canInstall,
          hasDownloadedApk: false,
        };
      },
      async downloadAndVerifyApk(opts) {
        if (failDownloadCode) {
          const e = new Error("Błąd pobierania: " + failDownloadCode);
          e.code = failDownloadCode;
          throw e;
        }
        return {
          verified: true,
          sha256: opts.expectedSha256,
          size: opts.expectedSize,
          packageName: "pl.turbodiesel.naprawnik",
          versionName: "5.50",
          versionCode: 3065320,
        };
      },
      async openInstallPermissionSettings() {
        canInstall = true;
        return { canInstall: true };
      },
      async installVerifiedApk() {
        if (cancelNextInstall) return { launched: true, cancelled: true, ok: false };
        return { launched: true, cancelled: false, ok: true };
      },
    },
  });

  await updater.check({ manual: true, openModalOnManual: false });

  // 1. Błąd sumy kontrolnej SHA-256
  failDownloadCode = "SHA256_MISMATCH";
  await updater.download();
  assert.equal(updater.getState().status, "error");
  assert.equal(updater.getState().errorCode, "SHA256_MISMATCH");
  assert.match(updater.getState().errorMessage, /SHA-256/i);

  // 2. Poprawne pobranie bez uprawnień -> permission_needed
  failDownloadCode = "";
  await updater.download();
  assert.equal(updater.getState().status, "permission_needed");

  // 3. Nadanie uprawnień -> próba instalacji anulowana przez użytkownika -> NIE udaje sukcesu
  await updater.openPermissions();
  assert.equal(updater.getState().status, "ready_to_install");
  assert.match(updater.getState().errorMessage, /anulowana/i);

  // 4. Uruchomienie instalacji + symulacja ponownego uruchomienia w nowej wersji
  cancelNextInstall = false;
  await updater.install();
  const pendingRaw = localStorage.getItem("naprawnik_apk_pending_install");
  assert.ok(pendingRaw, "powinien zapisać znacznik oczekującej aktualizacji przed instalacją");

  const reloaded = loadNativeBridgeInVm({
    initialStorage: localStorage._dump(),
    pluginOverrides: {
      async getInstalledInfo() {
        return {
          packageName: "pl.turbodiesel.naprawnik",
          versionName: "5.50",
          versionCode: 3065320,
          canRequestPackageInstalls: true,
          hasDownloadedApk: false,
        };
      },
      async fetchUpdateMetadata() {
        return {
          appId: "pl.turbodiesel.naprawnik",
          versionName: "5.50",
          versionCode: 3065320,
          apkUrl: "https://naprawnik-download.pages.dev/app-debug.apk",
          sha256: "a".repeat(64),
          size: 28000000,
        };
      },
    },
  });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(reloaded.updater.getState().status, "updated");
  assert.equal(reloaded.localStorage.getItem("naprawnik_apk_pending_install"), null);
  assert.equal(reloaded.localStorage.getItem("naprawnik_vehicles"), vehicles);
});

test("APK and PWA remain strictly isolated", () => {
  const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const wwwBridge = fs.readFileSync(path.join(root, "www", "native-bridge.js"), "utf8");
  const wwwHtml = fs.readFileSync(path.join(root, "www", "index.html"), "utf8");

  assert.equal(rootHtml.includes("__naprawnikApkUpdater"), false, "PWA nie może ładować natywnego instalatora APK");
  assert.equal(rootHtml.includes("ApkUpdaterPlugin"), false);
  assert.match(wwwBridge, /__naprawnikApkUpdater/);
  assert.match(wwwBridge, /naprawnik-download\.pages\.dev\/apk-version\.json/);
  assert.match(wwwHtml, /id="topUpdateBar" class="top-update-bar" style="display:none !important"/);
});
