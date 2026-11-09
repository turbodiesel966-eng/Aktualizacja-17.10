/**
 * NAPRAWNIK — UNIFIED PLATFORM ADAPTER (PWA + ANDROID APK)
 *
 * Ujednolicony interfejs adaptera platformowego:
 * - isNative()
 * - exportFile(blob, fileName, title)
 * - openCheckout(url, purpose)
 * - renderApkCard()
 * - handleBack()
 * - share(data)
 *
 * W środowisku PWA adapter korzysta z natywnych API przeglądarki.
 * W środowisku APK adapter deleguje operacje do mostka Capacitor (100% offline).
 */
(function (global) {
  'use strict';

  function isNative() {
    if (typeof window === 'undefined') return false;
    if (window.__naprawnikNative === true) return true;
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
      return window.Capacitor.isNativePlatform();
    }
    return false;
  }

  async function exportFile(blob, fileName, title) {
    if (!blob) throw new Error('Brak danych pliku do wyeksportowania.');
    const safeName = String(fileName || 'NAPRAWNIK-dane.json')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .slice(0, 140);

    // W środowisku natywnym Capacitor Android
    if (isNative()) {
      if (typeof window.__naprawnikNativeExportFile === 'function') {
        return window.__naprawnikNativeExportFile(blob, safeName, title);
      }
      const Filesystem = window.Capacitor?.Plugins?.Filesystem;
      const Share = window.Capacitor?.Plugins?.Share;
      if (Filesystem && Share) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        const saved = await Filesystem.writeFile({
          path: safeName,
          data: base64,
          directory: 'CACHE',
          recursive: true
        });
        await Share.share({
          title: safeName,
          text: title || 'Plik NAPRAWNIK jest gotowy do zapisania.',
          files: [saved.uri],
          dialogTitle: title || 'Zapisz kopię NAPRAWNIKA'
        });
        return true;
      }
    }

    // W środowisku przeglądarkowym / PWA
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        a.remove();
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);
    return true;
  }

  async function openCheckout(url, purpose) {
    if (typeof url !== 'string' ||
        !/^https:\/\/(checkout\.stripe\.com|buy\.stripe\.com|billing\.stripe\.com)\//i.test(url)) {
      throw new Error('Odrzucono niebezpieczny adres zewnętrzny płatności.');
    }

    if (isNative() && typeof window.__naprawnikNativeCheckout === 'function') {
      await window.__naprawnikNativeCheckout(url, purpose);
      return;
    }

    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(url);
    }
  }

  function renderApkCard() {
    if (isNative()) {
      return '<div class="diag-card" style="border-color:#00f57a">' +
        '<h2 style="color:#00f57a">📱 Aplikacja Android (Wersja Warsztatowa Offline)</h2>' +
        '<div class="diag-sub">Zainstalowany pakiet APK działa w 100% lokalnie w warsztacie bez konieczności połączenia z internetem. Wszystkie dane diagnostyczne i moduły są dostępne bez dostępu do sieci.</div>' +
        '</div>';
    }
    return '<div class="diag-card" style="border-color:#00f57a">' +
      '<h2 style="color:#00f57a">📲 Aplikacja Android (APK)</h2>' +
      '<div class="diag-sub">Pobierz oficjalny instalator NAPRAWNIKA na telefon Android — działa w 100% offline w warsztacie.</div>' +
      '<a class="btn" style="border-color:#00f57a;color:#00f57a;text-decoration:none" href="https://naprawnik-download.pages.dev/" target="_blank" rel="noopener noreferrer">📲 Pobierz aplikację Android (APK) ↗</a>' +
      '</div>';
  }

  function handleBack() {
    const screen = typeof document !== 'undefined' ? document.getElementById('screen') : null;
    const inScreenBack = screen?.querySelector('.back, [data-native-back]');
    if (inScreenBack && typeof inScreenBack.click === 'function') {
      inScreenBack.click();
      return true;
    }

    const view = String(global.__naprawnikView || 'home');
    const activeTab = typeof document !== 'undefined' ? document.querySelector('.nav-item.active') : null;
    if (view !== 'home' || (activeTab?.dataset?.nav && activeTab.dataset.nav !== 'home')) {
      if (typeof global.nav === 'function') {
        global.nav('home');
        return true;
      }
    }

    if (isNative()) {
      const App = global.Capacitor?.Plugins?.App;
      if (App && typeof App.exitApp === 'function') {
        void App.exitApp();
        return true;
      }
    }

    if (typeof global.history !== 'undefined' && global.history.length > 1) {
      global.history.back();
      return true;
    }
    return false;
  }

  async function share(data) {
    if (isNative() && global.Capacitor?.Plugins?.Share) {
      return global.Capacitor.Plugins.Share.share(data);
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      return navigator.share(data);
    }
    return false;
  }

  const NaprawnikPlatform = {
    isNative,
    exportFile,
    openCheckout,
    renderApkCard,
    handleBack,
    share
  };

  global.NaprawnikPlatform = NaprawnikPlatform;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NaprawnikPlatform;
  }
})(typeof window !== 'undefined' ? window : globalThis);
