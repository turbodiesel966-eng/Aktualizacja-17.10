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
}
