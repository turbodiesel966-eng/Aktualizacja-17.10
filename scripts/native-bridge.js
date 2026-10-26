import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
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
