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

  // Live OTA Web Sync: keep the installed Android APK automatically synchronized
  // with the published Web version on GitHub Pages while preserving offline cache.
  const WEB_LIVE_BASE = "https://turbodiesel966-eng.github.io/Aktualizacja-17.10";
  const OTA_HASH_KEY = "naprawnik_ota_live_sig";
  const bootTimestamp = Date.now();

  function simpleSig(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16) + ":" + str.length;
  }

  function instrumentHtml(html) {
    if (typeof html !== "string" || !html.includes("const APP_VERSION")) return null;
    let out = html;
    const navMarker = "function nav(view, arg){";
    if (!out.includes("window.__naprawnikView") && out.includes(navMarker)) {
      out = out.replace(navMarker, navMarker + '\n  window.__naprawnikView = String(view || "home");');
    }
    if (!out.includes("./native-bridge.js")) {
      const idx = out.lastIndexOf("</body>");
      if (idx >= 0) out = out.slice(0, idx) + '  <script src="./native-bridge.js"></script>\n' + out.slice(idx);
    }
    return out;
  }

  async function syncWithLiveWeb() {
    if (!navigator.onLine || typeof caches === "undefined") return false;
    try {
      const res = await fetch(WEB_LIVE_BASE + "/index.html?v=" + Date.now(), { cache: "no-store", mode: "cors", credentials: "omit" });
      if (!res.ok) return false;
      const rawHtml = await res.text();
      const patched = instrumentHtml(rawHtml);
      if (!patched) return false;
      const sig = simpleSig(patched);
      const prevSig = localStorage.getItem(OTA_HASH_KEY);
      const keys = await caches.keys();
      const nativeCacheName = keys.find(k => k.endsWith("-native")) || "naprawnik-v5-38-native";
      const cache = await caches.open(nativeCacheName);
      await cache.put("./index.html", new Response(patched, { status: 200, headers: { "Content-Type": "text/html;charset=utf-8" } }));
      localStorage.setItem(OTA_HASH_KEY, sig);
      if (prevSig && prevSig !== sig && (Date.now() - bootTimestamp < 4500) && String(window.__naprawnikView || "home") === "home") {
        window.location.reload();
      }
      return true;
    } catch {
      return false;
    }
  }

  window.__naprawnikWebSync = syncWithLiveWeb;
  setTimeout(() => { void syncWithLiveWeb(); }, 800);
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void syncWithLiveWeb();
  });
}
