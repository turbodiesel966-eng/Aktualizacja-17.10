#!/usr/bin/env python3
"""Verify that a built Android APK contains the full NAPRAWNIK app, multicylinder modules, offline assets and complete PWA isolation."""
import json
import re
import struct
import sys
import zipfile
from pathlib import Path

apk = Path(sys.argv[1] if len(sys.argv) > 1 else ("android/app/build/outputs/apk/release/app-release.apk" if Path("android/app/build/outputs/apk/release/app-release.apk").is_file() else "android/app/build/outputs/apk/debug/app-debug.apk"))
if not apk.is_file():
    raise SystemExit(f"APK not found: {apk}")

with zipfile.ZipFile(apk) as bundle:
    names = set(bundle.namelist())

    required = [
        "assets/public/index.html",
        "assets/public/platform-adapter.js",
        "assets/public/billing.js",
        "assets/public/katalog-techniczny.js",
        "assets/public/druciarstwo.js",
        "assets/public/motocykle-multi-data.js",
        "assets/public/motocykle-multi.js",
        "assets/public/vin-decoder.js",
        "assets/public/sw.js",
        "assets/public/manifest.webmanifest",
        "assets/public/native-bridge.js",
        "assets/public/affiliate/catalog.js",
        "assets/public/affiliate/catalog.json",
        "assets/public/affiliate/market-ui.js",
        "assets/public/assets/naprawnik-market-icon.svg",
        "assets/public/assets/naprawnik-icon.svg",
        "assets/public/assets/naprawnik-icon-192.svg",
        "assets/public/assets/naprawnik-icon-512.svg",
        "assets/public/assets/workshop-bg.jpg",
        "assets/public/assets/mod-clients.jpg",
        "assets/public/assets/mod-orders.jpg",
        "assets/public/assets/mod-diag.jpg",
        "assets/public/assets/mod-electric.jpg",
        "assets/public/assets/mod-tech.jpg",
        "assets/public/assets/mod-tools.jpg",
        "assets/public/assets/neon-tiles-art.jpg",
        "assets/public/assets/tile-hud.jpg",
        "assets/public/assets/tile-jetting.jpg",
        "assets/public/assets/tile-cvt.jpg",
        "assets/public/assets/tile-pinouts.jpg",
        "assets/public/assets/tile-squish.jpg",
        "assets/public/assets/tile-orders.jpg",
        "assets/public/assets/tile-druciarstwo.jpg",
    ]

    manifest_path = Path("scripts/shared-manifest.json")
    if manifest_path.is_file():
        with open(manifest_path, "r", encoding="utf-8") as f:
            shared_manifest = json.load(f)
        for asset in shared_manifest.get("sharedAssets", []):
            asset_path = f"assets/public/assets/{asset}"
            if asset_path not in names:
                raise SystemExit(f"APK is missing shared asset from manifest: {asset_path}")
        for script in shared_manifest.get("sharedScripts", []):
            script_path = f"assets/public/{script}"
            if script_path not in names:
                raise SystemExit(f"APK is missing shared script from manifest: {script_path}")

    missing = [name for name in required if name not in names]
    if missing:
        raise SystemExit("APK is missing web assets: " + ", ".join(missing))

    html = bundle.read("assets/public/index.html").decode("utf-8")
    platform_adapter = bundle.read("assets/public/platform-adapter.js").decode("utf-8")
    billing = bundle.read("assets/public/billing.js").decode("utf-8")
    catalog = bundle.read("assets/public/katalog-techniczny.js").decode("utf-8")
    service_worker = bundle.read("assets/public/sw.js").decode("utf-8")
    manifest = bundle.read("assets/public/manifest.webmanifest").decode("utf-8")
    native_bridge = bundle.read("assets/public/native-bridge.js").decode("utf-8")
    multi_data = bundle.read("assets/public/motocykle-multi-data.js").decode("utf-8")
    multi_logic = bundle.read("assets/public/motocykle-multi.js").decode("utf-8")

    # Weryfikacja obecności i inicjalizacji adaptera platformowego
    if "NaprawnikPlatform" not in platform_adapter or "isNative" not in platform_adapter:
        raise SystemExit("Unified platform adapter is missing NaprawnikPlatform or isNative in APK bundle.")

    # Weryfikacja obecności i inicjalizacji modułu motocykli wielocylindrowych
    if "NAPRAWNIK_MULTICYL_DATA" not in multi_data:
        raise SystemExit("Multicylinder motorcycle data module is present but NAPRAWNIK_MULTICYL_DATA is missing.")
    if "NAPRAWNIK_MULTICYL" not in multi_logic or "renderMulticyl" not in multi_logic:
        raise SystemExit("Multicylinder motorcycle logic module is present but NAPRAWNIK_MULTICYL is missing.")
    if "./motocykle-multi-data.js" not in html or "./motocykle-multi.js" not in html:
        raise SystemExit("Packaged APK index.html does not load multicylinder motorcycle scripts.")
    if "./motocykle-multi-data.js" not in service_worker or "./motocykle-multi.js" not in service_worker:
        raise SystemExit("Packaged APK service worker does not precache multicylinder motorcycle modules.")

    # Weryfikacja pełnej izolacji od produkcyjnego PWA i braku mechanizmu OTA
    blocked_terms = ["WEB_LIVE_BASE", "turbodiesel966-eng.github.io", "fetchLiveWithTimeout", "__naprawnikWebSync", "OTA_HASH_KEY", "syncApkWithWebNow"]
    for blocked in blocked_terms:
        if blocked in service_worker:
            raise SystemExit(f"APK service worker violates isolation: found {blocked}")
        if blocked in native_bridge:
            raise SystemExit(f"APK native bridge violates isolation: found {blocked}")
        if blocked in html:
            raise SystemExit(f"APK HTML violates isolation: found {blocked}")
        if blocked in platform_adapter:
            raise SystemExit(f"APK platform adapter violates isolation: found {blocked}")

    try:
        case_block = html.split("const knowledgeCases = [", 1)[1].split("const KNOW_LINKS={", 1)[0]
    except IndexError:
        raise SystemExit("Diagnostic knowledge base was not found in the packaged HTML.")
    case_ids = re.findall(r"""\{\s*["']?id["']?\s*:\s*["']([^"']+)["']""", case_block)
    if len(case_ids) < 70 or len(case_ids) != len(set(case_ids)):
        raise SystemExit(f"Expected at least 70 unique diagnostic cases; found {len(case_ids)}.")

    for marker in ["exportBackup()", "importBackup(event)", "paExportCases()", "paImportCases(event)", "paCamera", "paGallery"]:
        if marker not in html:
            raise SystemExit(f"Missing app capability in APK HTML: {marker}")
    market_ui = bundle.read("assets/public/affiliate/market-ui.js").decode("utf-8")
    affiliate_data = json.loads(bundle.read("assets/public/affiliate/catalog.json").decode("utf-8"))
    html_text = bundle.read("assets/public/index.html").decode("utf-8")
    if "NAPRAWNIK MARKET" not in market_ui or "NaprawnikMarket" not in market_ui or "naprawnik-market-icon.svg" not in html_text or "data-market-open" not in html_text:
        raise SystemExit("APK-only NAPRAWNIK MARKET UI/tile is missing.")
    if "assets/public/assets/naprawnik-market-icon.svg" not in names:
        raise SystemExit("Dedicated NAPRAWNIK MARKET icon is missing from the APK.")

    if not affiliate_data.get("categories") or not affiliate_data.get("merchants"):
        raise SystemExit("Affiliate catalog categories or merchant registry is missing.")
    if "./affiliate/market-ui.js" not in service_worker or "./affiliate/catalog.json" not in service_worker:
        raise SystemExit("Affiliate catalog and Market UI are not included in the APK offline precache.")
    if "NAPRAWNIK_KATALOG" not in catalog:
        raise SystemExit("Technical catalogue module is present but not initialized.")
    if "naprawnik-subscriptions-live.turbodiesel966.workers.dev" not in billing:
        raise SystemExit("Production billing/API integration is missing from the packaged app.")
    for endpoint in ["/api/admin/device-link", "/api/admin/mobile-login", "/api/checkout", "/api/one-time-checkout", "/api/promo/redeem"]:
        if endpoint not in billing:
            raise SystemExit(f"Missing billing/admin endpoint in packaged billing bridge: {endpoint}")
    if "openHostedBillingUrl(data.url, 'subscription')" not in billing or \
       "openHostedBillingUrl(data.url, 'one-time')" not in billing or \
       "openHostedBillingUrl(data.url, 'portal')" not in billing:
        raise SystemExit("Native Stripe Checkout / one-time / Billing Portal bridge is not connected from billing.js.")
    if "./billing.js?v=17" not in service_worker or "./native-bridge.js" not in service_worker or "./platform-adapter.js" not in service_worker or not re.search(r"naprawnik-v5-\d+-native", service_worker) or "NAPRAWNIK" not in manifest:
        raise SystemExit("The packaged PWA/service-worker branding or billing version is inconsistent.")
    for marker in ["backButton", "toolbarColor", "setBackgroundColor", "writeFile", "__naprawnikNativeCheckout", "browserFinished", "ApkUpdater", "apk-version.json", "downloadAndVerifyApk", "installVerifiedApk", "__naprawnikApkUpdater"]:
        if marker not in native_bridge:
            raise SystemExit(f"Android-native integration missing from packaged bridge: {marker}")

    launcher_paths = sorted(
        name for name in names
        if re.fullmatch(r"res/mipmap-[^/]+/ic_launcher\.png", name)
    )
    if len(launcher_paths) < 4:
        raise SystemExit(f"Expected branded launcher icons in multiple Android densities; found {len(launcher_paths)}.")
    largest = bundle.read(launcher_paths[-1])
    if not largest.startswith(b"\x89PNG\r\n\x1a\n") or len(largest) < 1200:
        raise SystemExit("Launcher icon is missing, not PNG, or suspiciously small.")
    width, height = struct.unpack(">II", largest[16:24])
    if min(width, height) < 180:
        raise SystemExit(f"Launcher icon resolution is too low: {width}x{height}.")

    splash_paths = [
        name for name in names
        if re.fullmatch(r"res/drawable-port-[^/]+/splash\.png", name)
    ]
    if len(splash_paths) < 3:
        raise SystemExit(f"Expected generated portrait splash assets; found {len(splash_paths)}.")

print(
    f"OK: {apk.name}; {len(case_ids)} unique diagnostic cases; "
    f"multicylinder motorcycle modules, unified platform adapter, complete PWA isolation (zero OTA), "
    f"backup/import, assistant photo/history, billing/admin, catalogue, affiliate Market, "
    f"{len(launcher_paths)} launcher densities and {len(splash_paths)} splash sizes verified."
)
