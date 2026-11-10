import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";

if (Capacitor.isNativePlatform()) {
  window.__naprawnikNative = true;

  // Match the NAPRAWNIK dark workshop theme and keep status icons readable.
  void StatusBar.setBackgroundColor({ color: "#0a0a14" }).catch(() => {});
  void StatusBar.setStyle({ style: Style.Light }).catch(() => {});

  // Keep hosted Stripe Checkout/Portal in a native browser tab. Stripe returns to
  // the Worker's static return page, so this WebView's local API token is preserved.
  window.__naprawnikNativeCheckout = async (url, purpose) => {
    if (typeof url !== "string" ||
        !/^https:\/\/(checkout\.stripe\.com|buy\.stripe\.com|billing\.stripe\.com)\//i.test(url)) {
      throw new Error("Odrzucono niebezpieczny adres płatności.");
    }

    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    const listener = await Browser.addListener("browserFinished", () => finish(true));
    try {
      await Browser.open({ url, toolbarColor: "#0a0a14", presentationStyle: "fullscreen" });
      await finished;

      // Stripe webhooks are asynchronous. Refresh only the authenticated account and
      // poll for a short bounded window; never claim a purchase was successful from the URL.
      let tier = "amator";
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          if (typeof window.npBillingBoot === "function") await window.npBillingBoot();
          const license = typeof window.naprawnikGetVerifiedLicense === "function"
            ? window.naprawnikGetVerifiedLicense()
            : null;
          tier = license?.tier || "amator";
          if (tier !== "amator") break;
        } catch {
          // Continue the bounded server refresh loop; the visible status stays honest.
        }
        if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (typeof window.renderPlans === "function") window.renderPlans();
      const names = { amator: "AMATOR", pro: "PRO", warsztat: "WARSZTAT" };
      if (purpose === "portal") {
        if (tier !== "amator") {
          window.alert("Panel Stripe został zamknięty. Serwer potwierdza aktywny plan " + (names[tier] || tier.toUpperCase()) + ".");
        } else {
          window.alert("Panel Stripe został zamknięty. Nie udało się potwierdzić aktywnego dostępu na tym koncie; sprawdź status planu w aplikacji.");
        }
      } else if (tier !== "amator") {
        window.alert("Serwer potwierdził aktywny plan " + (names[tier] || tier.toUpperCase()) + ". Możesz wrócić do pracy w NAPRAWNIKU.");
      } else {
        window.alert("Karta płatności została zamknięta, ale nie potwierdzono jeszcze nowego dostępu. Jeśli płatność była wykonana, sprawdź plan ponownie za chwilę. Jeśli anulowano zakup, plan się nie zmienił.");
      }
    } finally {
      await listener.remove().catch(() => {});
    }
  };

  if (window.NaprawnikPlatform) {
    window.NaprawnikPlatform.openCheckout = window.__naprawnikNativeCheckout;
  }

  // Keep web and in-app navigation stable when opening external OEM PDF manuals.
  document.addEventListener("click", event => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;

    let url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(url.protocol) || url.origin === window.location.origin) return;

    event.preventDefault();
    event.stopPropagation();
    void Browser.open({ url: url.href, toolbarColor: "#0a0a14" }).catch(() => {
      // If the Custom Tab cannot be opened, keep the link usable as a last resort.
      window.location.assign(url.href);
    });
  }, true);

  // On Android, preserve file export/import: WebView downloads from Blob URLs are
  // routed to the native share sheet so a user can save the JSON to Downloads/Drive.
  let nativeSavePending = false;
  let deferredAlert = null;
  const browserAlert = window.alert.bind(window);
  window.alert = message => {
    if (nativeSavePending) {
      deferredAlert = String(message || "");
      return;
    }
    browserAlert(message);
  };

  async function toBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  document.addEventListener("click", event => {
    const anchor = event.target instanceof Element ? event.target.closest("a[download]") : null;
    if (!anchor || !anchor.href || !anchor.href.startsWith("blob:")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (nativeSavePending) return;
    nativeSavePending = true;
    deferredAlert = null;

    void (async () => {
      try {
        const response = await fetch(anchor.href);
        if (!response.ok) throw new Error("Nie udało się odczytać pliku kopii zapasowej.");
        const blob = await response.blob();
        const fileName = String(anchor.download || "NAPRAWNIK-kopia.json")
          .replace(/[^A-Za-z0-9._-]/g, "_")
          .slice(0, 140);
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: await toBase64(blob),
          directory: Directory.Cache,
          recursive: true
        });

        await Share.share({
          title: fileName,
          text: "Plik NAPRAWNIK jest gotowy do zapisania. Wybierz miejsce docelowe i zachowaj kopię w bezpiecznym miejscu.",
          files: [saved.uri],
          dialogTitle: "Zapisz kopię NAPRAWNIKA"
        });

        if (deferredAlert) {
          const originalMessage = deferredAlert;
          if (/kopi[ęe] zapasow/i.test(originalMessage)) {
            browserAlert("Plik kopii NAPRAWNIKA został przygotowany. W oknie Udostępnij wybierz miejsce, w którym chcesz go bezpiecznie zapisać.");
          } else if (/histori[ęe].*zdj[eę]ci/i.test(originalMessage)) {
            browserAlert("Plik historii asystenta ze zdjęciami został przygotowany. W oknie Udostępnij wybierz miejsce zapisu.");
          } else {
            browserAlert(originalMessage);
          }
        }
      } catch (error) {
        browserAlert("Nie udało się przygotować pliku do zapisania. Spróbuj ponownie. " + String(error?.message || ""));
      } finally {
        nativeSavePending = false;
        deferredAlert = null;
      }
    })();
  }, true);

  // Provide native Android sharing when the WebView does not expose Web Share API.
  if (typeof navigator.share !== "function") {
    navigator.share = async data => {
      const payload = {
        title: typeof data?.title === "string" ? data.title : "NAPRAWNIK",
        text: typeof data?.text === "string" ? data.text : ""
      };
      if (typeof data?.url === "string") payload.url = data.url;
      return Share.share(payload);
    };
  }

  // Android Back: close the current diagnostic detail first, return home next,
  // and exit only when already on the home view.
  void App.addListener("backButton", () => {
    if (window.NaprawnikPlatform && typeof window.NaprawnikPlatform.handleBack === "function") {
      window.NaprawnikPlatform.handleBack();
      return;
    }
    const screen = document.getElementById("screen");
    const inScreenBack = screen?.querySelector(".back, [data-native-back]");
    if (inScreenBack instanceof HTMLElement) {
      inScreenBack.click();
      return;
    }

    const view = String(window.__naprawnikView || "home");
    const activeTab = document.querySelector(".nav-item.active");
    if (view !== "home" || (activeTab?.dataset.nav && activeTab.dataset.nav !== "home")) {
      if (typeof window.nav === "function") {
        window.nav("home");
        return;
      }
    }

    void App.exitApp();
  });

  // =========================================================================
  // NATYWNY AKTUALIZATOR APK ANDROID (izolowany od mechanizmu PWA/ServiceWorker)
  // =========================================================================
  (function setupNativeApkUpdater() {
    const APK_META_URL = "https://naprawnik-download.pages.dev/apk-version.json";
    const APK_FALLBACK_URL = "https://naprawnik-download.pages.dev/app-debug.apk";
    const AUTO_CHECK_THROTTLE_MS = 15 * 60 * 1000;
    const LS_LAST_CHECK = "naprawnik_apk_last_check_ts";
    const LS_PENDING_INSTALL = "naprawnik_apk_pending_install";
    const LS_LAST_REMOTE = "naprawnik_apk_last_remote_meta";

    const getPlugin = () => (Capacitor && Capacitor.Plugins && Capacitor.Plugins.ApkUpdater) || null;

    const state = {
      status: "idle", // idle | checking | up_to_date | available | downloading | verifying | permission_needed | ready_to_install | installing | updated | error
      installed: null,
      remote: null,
      verified: null,
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      errorCode: "",
      errorMessage: "",
      lastCheckedAt: Number((() => { try { return localStorage.getItem(LS_LAST_CHECK) || 0; } catch { return 0; } })()),
      modalOpen: false,
      busy: false,
      inFlightCheck: null,
    };

    function escHtml(v) {
      return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function parseSemverParts(v) {
      const clean = String(v || "0").trim().replace(/^v/i, "").split("-")[0];
      return clean.split(".").map(p => {
        const n = parseInt(p.replace(/[^\d]/g, ""), 10);
        return Number.isFinite(n) ? n : 0;
      });
    }

    function compareSemver(a, b) {
      const pa = parseSemverParts(a);
      const pb = parseSemverParts(b);
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
      }
      return 0;
    }

    function isUpdateNewer(remote, installed) {
      if (!remote || !installed) return false;
      if (remote.appId && installed.packageName && remote.appId !== installed.packageName) {
        return false;
      }
      const rCode = Number(remote.versionCode || 0);
      const iCode = Number(installed.versionCode || 0);
      const semCmp = compareSemver(remote.versionName || "0", installed.versionName || "0");

      if (rCode > 0 && iCode > 0) {
        if (rCode < iCode) return false;
        if (semCmp < 0) return false;
        if (rCode > iCode) return true;
        return semCmp > 0;
      }
      if (semCmp !== 0) return semCmp > 0;
      const rBuild = Number(remote.build || 0);
      const iBuild = Number(installed.build || 0);
      return rBuild > 0 && iBuild > 0 && rBuild > iBuild;
    }

    function formatBytes(bytes) {
      const n = Number(bytes || 0);
      if (!Number.isFinite(n) || n <= 0) return "—";
      if (n < 1024) return n + " B";
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
      return (n / (1024 * 1024)).toFixed(1) + " MB";
    }

    function mapError(err) {
      const code = String((err && (err.code || err.data?.code)) || "").toUpperCase();
      const rawMsg = String((err && (err.message || err.errorMessage)) || err || "");
      const known = {
        NETWORK_ERROR: "Brak połączenia z internetem lub serwerem aktualizacji. Aplikacja działa normalnie w trybie offline.",
        HTTP_ERROR: "Serwer aktualizacji jest chwilowo niedostępny. Spróbuj ponownie za chwilę.",
        SERVER_ERROR: "Nie udało się pobrać pakietu APK z serwera aktualizacji. Spróbuj ponownie.",
        SHA256_MISMATCH: "Weryfikacja bezpieczeństwa nie powiodła się (niezgodna suma SHA-256). Plik został odrzucony.",
        SIZE_MISMATCH: "Pobrany plik APK jest niekompletny (niezgodny rozmiar). Spróbuj ponownie.",
        SIGNATURE_MISMATCH: "Podpis cyfrowy pobranego APK nie zgadza się z zainstalowaną aplikacją. Instalacja zablokowana dla ochrony danych.",
        PACKAGE_MISMATCH: "Identyfikator pakietu pobranego pliku nie odpowiada aplikacji NAPRAWNIK.",
        OLDER_OR_SAME_VERSION: "Pobrana wersja nie jest nowsza od obecnie zainstalowanej.",
        INSUFFICIENT_STORAGE: "Za mało wolnego miejsca w pamięci urządzenia. Zwolnij co najmniej ok. 50 MB i ponów.",
        DOWNLOAD_CANCELLED: "Pobieranie aktualizacji zostało anulowane.",
        DOWNLOAD_BUSY: "Pobieranie aktualizacji jest już uruchomione.",
        UNTRUSTED_URL: "Odrzucono adres pobierania spoza oficjalnego źródła NAPRAWNIKA.",
        APK_MISSING: "Brak zweryfikowanego pliku instalacyjnego w pamięci tymczasowej. Pobierz aktualizację ponownie.",
        INSTALL_ERROR: "Nie udało się uruchomić instalatora systemu Android.",
        PERMISSION_REQUIRED: "Wymagane jest jednorazowe zezwolenie Androida na instalację aktualizacji z tej aplikacji.",
      };
      return {
        code: code || "UNKNOWN_ERROR",
        message: known[code] || rawMsg || "Wystąpił nieoczekiwany błąd podczas aktualizacji APK.",
      };
    }

    async function readInstalledInfo() {
      const plugin = getPlugin();
      if (plugin && typeof plugin.getInstalledInfo === "function") {
        const info = await plugin.getInstalledInfo();
        state.installed = info;
        return info;
      }
      const fallback = {
        packageName: "pl.turbodiesel.naprawnik",
        versionName: typeof window.CURRENT_APP_VERSION === "string" ? window.CURRENT_APP_VERSION : "0.0",
        versionCode: 0,
        canRequestPackageInstalls: false,
        hasDownloadedApk: false,
      };
      state.installed = fallback;
      return fallback;
    }

    function checkPendingInstallSuccess(installed) {
      try {
        const raw = localStorage.getItem(LS_PENDING_INSTALL);
        if (!raw) return false;
        const pending = JSON.parse(raw);
        const curCode = Number(installed?.versionCode || 0);
        const prevCode = Number(pending?.prevVersionCode || 0);
        const targetCode = Number(pending?.targetVersionCode || 0);
        const semUp = pending?.targetVersionName && installed?.versionName &&
          compareSemver(installed.versionName, pending.prevVersionName || "0") > 0;
        if ((curCode > 0 && ((targetCode > 0 && curCode >= targetCode) || (prevCode > 0 && curCode > prevCode))) || semUp) {
          localStorage.removeItem(LS_PENDING_INSTALL);
          state.status = "updated";
          return true;
        }
      } catch {
        // Ignoruj uszkodzony znacznik pomocniczy — dane warsztatu są nienaruszone.
      }
      return false;
    }

    function ensureUi() {
      const frame = document.querySelector(".frame");
      if (!frame) return null;

      let bar = document.getElementById("nativeApkUpdateBar");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "nativeApkUpdateBar";
        bar.className = "top-update-bar";
        bar.innerHTML =
          '<button id="btnNativeApkUpdate" class="btn-update normal" type="button" title="Sprawdź lub zainstaluj aktualizację APK">' +
          '<span id="nativeApkUpdateIcon" class="update-icon">🔄</span>' +
          '<span id="nativeApkUpdateText">Sprawdź aktualizację APK</span>' +
          "</button>";
        const topUpdateBar = document.getElementById("topUpdateBar");
        if (topUpdateBar && topUpdateBar.parentNode === frame) {
          frame.insertBefore(bar, topUpdateBar);
        } else {
          const topbar = frame.querySelector(".topbar");
          if (topbar && topbar.nextSibling) frame.insertBefore(bar, topbar.nextSibling);
          else frame.insertBefore(bar, frame.firstChild);
        }
        const btn = document.getElementById("btnNativeApkUpdate");
        if (btn) {
          btn.addEventListener("click", () => {
            if (state.status === "available" || state.status === "ready_to_install" || state.status === "permission_needed" || state.status === "downloading" || state.status === "verifying") {
              openModal(false);
            } else {
              void checkForUpdates({ manual: true, openModalOnManual: true });
            }
          });
        }
      }

      let modal = document.getElementById("nativeApkUpdateModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "nativeApkUpdateModal";
        modal.style.cssText =
          "display:none;position:fixed;inset:0;z-index:1200;background:rgba(4,6,14,0.86);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px;";
        modal.addEventListener("click", ev => {
          if (ev.target === modal && !state.busy) closeModal();
        });
        document.body.appendChild(modal);
      }

      return { bar, modal };
    }

    function renderBar() {
      const ui = ensureUi();
      if (!ui) return;
      const btn = document.getElementById("btnNativeApkUpdate");
      const icon = document.getElementById("nativeApkUpdateIcon");
      const text = document.getElementById("nativeApkUpdateText");
      if (!btn || !icon || !text) return;

      const newVer = state.remote?.versionName ? "v" + state.remote.versionName : "nowa wersja";
      const curVer = state.installed?.versionName ? "v" + state.installed.versionName : "";

      let readyPulse = false;
      switch (state.status) {
        case "checking":
          icon.textContent = "⏳";
          text.textContent = "Sprawdzanie aktualizacji APK...";
          break;
        case "available":
          icon.textContent = "🚨";
          text.textContent = `NOWA WERSJA APK ${newVer} — Pobierz i zainstaluj`;
          readyPulse = true;
          break;
        case "downloading":
          icon.textContent = "⬇️";
          text.textContent = `Pobieranie aktualizacji... ${state.progressPercent}%`;
          break;
        case "verifying":
          icon.textContent = "🛡️";
          text.textContent = "Weryfikacja integralności APK (SHA-256)...";
          break;
        case "permission_needed":
          icon.textContent = "🔓";
          text.textContent = "Zezwól na instalację aktualizacji — Dotknij";
          readyPulse = true;
          break;
        case "ready_to_install":
          icon.textContent = "📦";
          text.textContent = `Gotowe (${newVer}) — Zainstaluj aktualizację`;
          readyPulse = true;
          break;
        case "installing":
          icon.textContent = "⚙️";
          text.textContent = "Uruchamianie instalatora Android...";
          break;
        case "updated":
          icon.textContent = "🎉";
          text.textContent = `Zaktualizowano do ${curVer || "nowej wersji"} (dane zachowane)`;
          break;
        case "up_to_date":
          icon.textContent = "✅";
          text.textContent = curVer ? `APK aktualny (${curVer})` : "APK jest aktualny";
          break;
        case "error":
          icon.textContent = "⚠️";
          text.textContent = "Błąd aktualizacji APK — Dotknij po szczegóły";
          break;
        default:
          icon.textContent = "🔄";
          text.textContent = curVer ? `Aktualizacja APK (${curVer})` : "Sprawdź aktualizację APK";
          break;
      }
      btn.className = readyPulse ? "btn-update update-ready" : "btn-update normal";
    }

    function renderModal() {
      const ui = ensureUi();
      if (!ui || !ui.modal) return;
      const modal = ui.modal;
      if (!state.modalOpen) {
        modal.style.display = "none";
        return;
      }

      const curVer = state.installed?.versionName ? `v${escHtml(state.installed.versionName)}` : "—";
      const curCode = state.installed?.versionCode ? ` (build ${escHtml(state.installed.versionCode)})` : "";
      const remVer = state.remote?.versionName ? `v${escHtml(state.remote.versionName)}` : "—";
      const remCode = state.remote?.versionCode ? ` (build ${escHtml(state.remote.versionCode)})` : "";
      const shaShort = state.remote?.sha256 ? escHtml(state.remote.sha256.slice(0, 16) + "…") : "—";
      const sizeTxt = state.remote?.size ? escHtml(formatBytes(state.remote.size)) : "—";
      const changelog = state.remote?.changelog ? escHtml(state.remote.changelog) : "Poprawki stabilności i aktualizacja bazy technicznej.";

      let bodyHtml = "";
      let actionsHtml = "";

      if (state.status === "checking") {
        bodyHtml = '<p style="color:#b8c7e0;margin:8px 0">Łączenie z oficjalnym kanałem aktualizacji NAPRAWNIKA...</p>';
        actionsHtml = '<button type="button" class="btn" id="apkUpdCloseBtn">Zamknij</button>';
      } else if (state.status === "available") {
        bodyHtml =
          `<div style="background:rgba(0,229,255,0.08);border:1px solid #00e5ff;border-radius:10px;padding:10px;margin:8px 0">` +
          `<div><b>Zainstalowana:</b> ${curVer}${curCode}</div>` +
          `<div><b>Dostępna:</b> <span style="color:#00f57a">${remVer}${remCode}</span></div>` +
          `<div><b>Rozmiar:</b> ${sizeTxt} | <b>SHA-256:</b> <code>${shaShort}</code></div>` +
          `</div>` +
          `<div style="font-size:13px;color:#d6e2f5;margin:8px 0"><b>Zmiany:</b> ${changelog}</div>` +
          `<div style="font-size:12px;color:#93f7c2">Twoje pojazdy, naprawy, zlecenia i ustawienia pozostaną nienaruszone.</div>`;
        actionsHtml =
          `<button type="button" class="btn" id="apkUpdDownloadBtn" style="border-color:#00f57a;color:#00f57a;font-weight:800">⬇️ Pobierz i zainstaluj (${sizeTxt})</button>` +
          `<button type="button" class="btn" id="apkUpdCloseBtn">Później</button>`;
      } else if (state.status === "downloading" || state.status === "verifying") {
        const pct = Math.max(0, Math.min(100, Number(state.progressPercent || 0)));
        const downloadedTxt = formatBytes(state.downloadedBytes);
        const totalTxt = formatBytes(state.totalBytes || state.remote?.size);
        const statusLine = state.status === "verifying"
          ? "Sprawdzanie sumy kontrolnej SHA-256, identyfikatora i podpisu cyfrowego..."
          : `Pobieranie pakietu APK: ${pct}% (${escHtml(downloadedTxt)} / ${escHtml(totalTxt)})`;
        bodyHtml =
          `<div style="margin:10px 0;color:#d6e2f5;font-size:13px">${statusLine}</div>` +
          `<div style="width:100%;height:12px;background:#14182b;border:1px solid #2b3556;border-radius:999px;overflow:hidden">` +
          `<div style="width:${state.status === "verifying" ? 100 : pct}%;height:100%;background:linear-gradient(90deg,#00e5ff,#00f57a);transition:width 0.2s"></div>` +
          `</div>`;
        actionsHtml = state.status === "downloading"
          ? '<button type="button" class="btn" id="apkUpdCancelBtn" style="border-color:#ff5577;color:#ff8899">✖ Anuluj pobieranie</button>'
          : "";
      } else if (state.status === "permission_needed") {
        bodyHtml =
          `<div style="background:rgba(255,179,0,0.12);border:1px solid #ffb300;border-radius:10px;padding:10px;margin:8px 0;color:#ffe699;font-size:13px">` +
          `<b>Wymagana zgoda systemu Android</b><br>` +
          `Plik aktualizacji <b>${remVer}</b> został pobrany i zweryfikowany pomyślnie.<br>` +
          `1. Dotknij przycisku poniżej.<br>` +
          `2. Włącz opcję <b>„Zezwalaj z tego źródła”</b> dla aplikacji NAPRAWNIK.<br>` +
          `3. Wróć do aplikacji — instalacja rozpocznie się automatycznie.` +
          `</div>`;
        actionsHtml =
          `<button type="button" class="btn" id="apkUpdPermBtn" style="border-color:#ffb300;color:#ffd24d;font-weight:800">🔓 Otwórz ustawienia uprawnień</button>` +
          `<button type="button" class="btn" id="apkUpdCloseBtn">Zamknij</button>`;
      } else if (state.status === "ready_to_install" || state.status === "installing") {
        bodyHtml =
          `<div style="background:rgba(0,245,122,0.10);border:1px solid #00f57a;border-radius:10px;padding:10px;margin:8px 0;font-size:13px">` +
          `✅ Pakiet <b>${remVer}</b> jest zweryfikowany (SHA-256 i podpis OK) i gotowy do instalacji.<br>` +
          (state.errorMessage ? `<div style="color:#ffd24d;margin-top:6px">${escHtml(state.errorMessage)}</div>` : "") +
          `</div>`;
        actionsHtml =
          `<button type="button" class="btn" id="apkUpdInstallBtn" style="border-color:#00f57a;color:#00f57a;font-weight:800">📦 Zainstaluj teraz</button>` +
          `<button type="button" class="btn" id="apkUpdCloseBtn">Zamknij</button>`;
      } else if (state.status === "updated") {
        bodyHtml =
          `<div style="background:rgba(0,245,122,0.12);border:1px solid #00f57a;border-radius:10px;padding:10px;margin:8px 0;font-size:13px">` +
          `🎉 Aplikacja została zaktualizowana do wersji <b>${curVer}</b>${curCode}.<br>` +
          `Wszystkie zapisane pojazdy, pomiary, zlecenia i ustawienia zostały zachowane.` +
          `</div>`;
        actionsHtml = '<button type="button" class="btn" id="apkUpdCloseBtn" style="border-color:#00f57a;color:#00f57a">OK</button>';
      } else if (state.status === "up_to_date") {
        bodyHtml =
          `<div style="background:rgba(0,229,255,0.08);border:1px solid #00e5ff;border-radius:10px;padding:10px;margin:8px 0;font-size:13px">` +
          `✅ Korzystasz z najnowszej wersji APK: <b>${curVer}</b>${curCode}.` +
          `</div>`;
        actionsHtml =
          `<button type="button" class="btn" id="apkUpdCheckBtn">🔄 Sprawdź ponownie</button>` +
          `<button type="button" class="btn" id="apkUpdCloseBtn">Zamknij</button>`;
      } else if (state.status === "error") {
        bodyHtml =
          `<div style="background:rgba(255,65,95,0.14);border:1px solid #ff415f;border-radius:10px;padding:10px;margin:8px 0;color:#ffb8c4;font-size:13px">` +
          `<b>Nie udało się dokończyć aktualizacji</b><br>${escHtml(state.errorMessage)}` +
          `</div>`;
        actionsHtml =
          `<button type="button" class="btn" id="apkUpdRetryBtn" style="border-color:#00e5ff;color:#00e5ff">🔄 Ponów sprawdzenie</button>` +
          `<button type="button" class="btn" id="apkUpdCloseBtn">Zamknij</button>`;
      } else {
        bodyHtml = `<p style="color:#b8c7e0;font-size:13px">Aktualnie zainstalowana wersja APK: <b>${curVer}</b>${curCode}.</p>`;
        actionsHtml =
          `<button type="button" class="btn" id="apkUpdCheckBtn" style="border-color:#00e5ff;color:#00e5ff">🔄 Sprawdź aktualizację</button>` +
          `<button type="button" class="btn" id="apkUpdCloseBtn">Zamknij</button>`;
      }

      modal.innerHTML =
        `<div style="width:100%;max-width:440px;background:#0f1324;border:1.5px solid #00e5ff;border-radius:14px;padding:16px;color:#eef4ff;box-shadow:0 18px 48px rgba(0,0,0,0.75)">` +
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">` +
        `<h3 style="margin:0;color:#00e5ff;font-size:16px">📲 Aktualizator APK NAPRAWNIKA</h3>` +
        `<span style="font-size:11px;color:#8ea0c0">${curVer}</span>` +
        `</div>` +
        bodyHtml +
        `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${actionsHtml}</div>` +
        `</div>`;
      modal.style.display = "flex";

      modal.querySelector("#apkUpdCloseBtn")?.addEventListener("click", closeModal);
      modal.querySelector("#apkUpdCheckBtn")?.addEventListener("click", () => void checkForUpdates({ manual: true, openModalOnManual: true }));
      modal.querySelector("#apkUpdRetryBtn")?.addEventListener("click", () => void checkForUpdates({ manual: true, openModalOnManual: true }));
      modal.querySelector("#apkUpdDownloadBtn")?.addEventListener("click", () => void downloadAndInstall());
      modal.querySelector("#apkUpdCancelBtn")?.addEventListener("click", () => void cancelDownload());
      modal.querySelector("#apkUpdPermBtn")?.addEventListener("click", () => void requestInstallPermissionAndProceed());
      modal.querySelector("#apkUpdInstallBtn")?.addEventListener("click", () => void triggerInstall());
    }

    function updateUi() {
      renderBar();
      renderModal();
    }

    function openModal(forceCheck) {
      state.modalOpen = true;
      updateUi();
      if (forceCheck && !state.busy && state.status !== "available" && state.status !== "ready_to_install" && state.status !== "permission_needed") {
        void checkForUpdates({ manual: true, openModalOnManual: true });
      }
    }

    function closeModal() {
      state.modalOpen = false;
      renderModal();
    }

    async function fetchRemoteMetadata() {
      const bustUrl = `${APK_META_URL}?_ts=${Date.now()}`;
      const plugin = getPlugin();
      if (plugin && typeof plugin.fetchUpdateMetadata === "function") {
        return await plugin.fetchUpdateMetadata({ url: bustUrl });
      }
      const res = await fetch(bustUrl, { cache: "no-store" });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.code = "HTTP_ERROR";
        throw err;
      }
      return await res.json();
    }

    async function checkForUpdates(opts = {}) {
      const manual = Boolean(opts.manual);
      const openModalOnManual = opts.openModalOnManual !== false;
      if (state.busy && !manual) return state.remote;
      if (state.inFlightCheck) return state.inFlightCheck;

      const now = Date.now();
      if (!manual && state.lastCheckedAt && (now - state.lastCheckedAt) < AUTO_CHECK_THROTTLE_MS) {
        return null;
      }

      const run = (async () => {
        try {
          if (manual) {
            state.status = "checking";
            state.errorCode = "";
            state.errorMessage = "";
            if (openModalOnManual) state.modalOpen = true;
            updateUi();
          }

          const installed = await readInstalledInfo();
          if (checkPendingInstallSuccess(installed) && !manual) {
            updateUi();
          }

          const remote = await fetchRemoteMetadata();
          state.remote = remote;
          state.lastCheckedAt = Date.now();
          try {
            localStorage.setItem(LS_LAST_CHECK, String(state.lastCheckedAt));
            localStorage.setItem(LS_LAST_REMOTE, JSON.stringify(remote));
          } catch {
            // Ignoruj limit localStorage.
          }

          if (isUpdateNewer(remote, installed)) {
            if (state.status !== "ready_to_install" && state.status !== "permission_needed" && state.status !== "downloading") {
              state.status = installed?.hasDownloadedApk && state.verified?.versionCode === remote.versionCode
                ? (installed.canRequestPackageInstalls ? "ready_to_install" : "permission_needed")
                : "available";
            }
          } else {
            state.status = checkPendingInstallSuccess(installed) ? "updated" : (manual ? "up_to_date" : "idle");
          }
          updateUi();
          return { updateAvailable: isUpdateNewer(remote, installed), installed, remote };
        } catch (err) {
          const mapped = mapError(err);
          state.errorCode = mapped.code;
          state.errorMessage = mapped.message;
          // Błąd sieci przy cichym sprawdzaniu w tle nie może zakłócać pracy offline w warsztacie.
          if (manual) {
            state.status = "error";
            updateUi();
          } else if (state.status === "checking") {
            state.status = "idle";
            updateUi();
          }
          return { updateAvailable: false, error: mapped };
        } finally {
          state.inFlightCheck = null;
        }
      })();

      state.inFlightCheck = run;
      return run;
    }

    async function downloadAndInstall() {
      const plugin = getPlugin();
      if (!plugin || typeof plugin.downloadAndVerifyApk !== "function") {
        const mapped = mapError({ code: "INSTALL_ERROR", message: "Brak natywnego modułu aktualizacji w tym pakiecie APK." });
        state.status = "error";
        state.errorCode = mapped.code;
        state.errorMessage = mapped.message;
        updateUi();
        return;
      }
      if (!state.remote) {
        const res = await checkForUpdates({ manual: true, openModalOnManual: true });
        if (!res || !res.updateAvailable) return;
      }

      state.busy = true;
      state.status = "downloading";
      state.progressPercent = 0;
      state.downloadedBytes = 0;
      state.totalBytes = Number(state.remote.size || 0);
      state.errorCode = "";
      state.errorMessage = "";
      state.modalOpen = true;
      updateUi();

      let listenerHandle = null;
      try {
        if (typeof plugin.addListener === "function") {
          listenerHandle = await plugin.addListener("downloadProgress", ev => {
            state.downloadedBytes = Number(ev?.downloadedBytes || 0);
            state.totalBytes = Number(ev?.totalBytes || state.remote?.size || 0);
            state.progressPercent = Number(ev?.percent || 0);
            if (state.progressPercent >= 100) {
              state.status = "verifying";
            }
            updateUi();
          });
        }

        const verified = await plugin.downloadAndVerifyApk({
          url: state.remote.apkUrl || APK_FALLBACK_URL,
          expectedSha256: state.remote.sha256 || "",
          expectedSize: Number(state.remote.size || 0),
          expectedPackageName: state.remote.appId || "pl.turbodiesel.naprawnik",
        });

        state.verified = verified;
        state.busy = false;

        const freshInstalled = await readInstalledInfo();
        if (!freshInstalled.canRequestPackageInstalls) {
          state.status = "permission_needed";
          updateUi();
          return;
        }

        state.status = "ready_to_install";
        updateUi();
        await triggerInstall();
      } catch (err) {
        state.busy = false;
        const mapped = mapError(err);
        state.errorCode = mapped.code;
        state.errorMessage = mapped.message;
        state.status = mapped.code === "DOWNLOAD_CANCELLED" && state.remote ? "available" : "error";
        updateUi();
      } finally {
        if (listenerHandle && typeof listenerHandle.remove === "function") {
          void listenerHandle.remove().catch(() => {});
        }
      }
    }

    async function cancelDownload() {
      const plugin = getPlugin();
      if (plugin && typeof plugin.cancelDownload === "function") {
        await plugin.cancelDownload().catch(() => {});
      }
    }

    async function requestInstallPermissionAndProceed() {
      const plugin = getPlugin();
      if (!plugin || typeof plugin.openInstallPermissionSettings !== "function") return;
      try {
        const res = await plugin.openInstallPermissionSettings();
        const installed = await readInstalledInfo();
        if (res?.canInstall || installed?.canRequestPackageInstalls) {
          state.status = "ready_to_install";
          state.errorMessage = "";
          updateUi();
          await triggerInstall();
        } else {
          state.status = "permission_needed";
          updateUi();
        }
      } catch (err) {
        const mapped = mapError(err);
        state.status = "error";
        state.errorCode = mapped.code;
        state.errorMessage = mapped.message;
        updateUi();
      }
    }

    async function triggerInstall() {
      const plugin = getPlugin();
      if (!plugin || typeof plugin.installVerifiedApk !== "function") return;

      const installedBefore = await readInstalledInfo();
      if (!installedBefore.canRequestPackageInstalls) {
        state.status = "permission_needed";
        updateUi();
        return;
      }

      try {
        localStorage.setItem(
          LS_PENDING_INSTALL,
          JSON.stringify({
            prevVersionName: installedBefore.versionName || "",
            prevVersionCode: Number(installedBefore.versionCode || 0),
            targetVersionName: state.remote?.versionName || state.verified?.versionName || "",
            targetVersionCode: Number(state.remote?.versionCode || state.verified?.versionCode || 0),
            startedAt: Date.now(),
          })
        );
      } catch {
        // Ignoruj limit localStorage.
      }

      state.status = "installing";
      state.errorMessage = "";
      updateUi();

      try {
        const res = await plugin.installVerifiedApk();
        if (res?.permissionRequired) {
          state.status = "permission_needed";
          updateUi();
          return;
        }
        if (res?.cancelled) {
          try { localStorage.removeItem(LS_PENDING_INSTALL); } catch {}
          state.status = "ready_to_install";
          state.errorMessage = "Instalacja została anulowana przed ukończeniem. Zweryfikowany plik jest nadal gotowy.";
          updateUi();
          return;
        }
        // Po potwierdzeniu przez użytkownika Android zamyka i podmienia proces aplikacji;
        // jeśli nadal tu jesteśmy, odśwież stan instalatora.
        const after = await readInstalledInfo();
        if (checkPendingInstallSuccess(after)) {
          updateUi();
        } else {
          state.status = "ready_to_install";
          updateUi();
        }
      } catch (err) {
        try { localStorage.removeItem(LS_PENDING_INSTALL); } catch {}
        const mapped = mapError(err);
        state.status = "error";
        state.errorCode = mapped.code;
        state.errorMessage = mapped.message;
        updateUi();
      }
    }

    async function bootUpdater() {
      ensureUi();
      const installed = await readInstalledInfo().catch(() => null);
      if (installed) {
        checkPendingInstallSuccess(installed);
      }
      renderBar();
      setTimeout(() => {
        void checkForUpdates({ manual: false });
      }, 2000);
    }

    if (App && typeof App.addListener === "function") {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        if (state.status === "permission_needed") {
          void readInstalledInfo().then(info => {
            if (info?.canRequestPackageInstalls) {
              state.status = "ready_to_install";
              updateUi();
              void triggerInstall();
            }
          }).catch(() => {});
          return;
        }
        void checkForUpdates({ manual: false });
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void checkForUpdates({ manual: false });
      }
    });

    window.__naprawnikApkUpdater = {
      check: opts => checkForUpdates(opts),
      download: () => downloadAndInstall(),
      install: () => triggerInstall(),
      cancel: () => cancelDownload(),
      openPermissions: () => requestInstallPermissionAndProceed(),
      openModal: forceCheck => openModal(forceCheck),
      closeModal: () => closeModal(),
      getState: () => ({ ...state }),
      compareSemver,
      isUpdateNewer,
      mapError,
      formatBytes,
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { void bootUpdater(); }, { once: true });
    } else {
      void bootUpdater();
    }
  })();
}
