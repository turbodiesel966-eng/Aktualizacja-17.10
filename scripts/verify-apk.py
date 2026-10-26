#!/usr/bin/env python3
"""Verify that a built Android APK contains the full NAPRAWNIK app and branding."""
import re
import struct
import sys
import zipfile
from pathlib import Path

apk = Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build/outputs/apk/debug/app-debug.apk")
if not apk.is_file():
    raise SystemExit(f"APK not found: {apk}")

with zipfile.ZipFile(apk) as bundle:
    names = set(bundle.namelist())

    required = [
        "assets/public/index.html",
        "assets/public/billing.js",
        "assets/public/katalog-techniczny.js",
        "assets/public/sw.js",
        "assets/public/manifest.webmanifest",
        "assets/public/native-bridge.js",
        "assets/public/assets/naprawnik-icon.svg",
        "assets/public/assets/naprawnik-icon-192.svg",
        "assets/public/assets/naprawnik-icon-512.svg",
    ]
    missing = [name for name in required if name not in names]
    if missing:
        raise SystemExit("APK is missing web assets: " + ", ".join(missing))

    html = bundle.read("assets/public/index.html").decode("utf-8")
    billing = bundle.read("assets/public/billing.js").decode("utf-8")
    catalog = bundle.read("assets/public/katalog-techniczny.js").decode("utf-8")
    service_worker = bundle.read("assets/public/sw.js").decode("utf-8")
    manifest = bundle.read("assets/public/manifest.webmanifest").decode("utf-8")

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
    if "./billing.js?v=16" not in service_worker or "./native-bridge.js" not in service_worker or "naprawnik-v5-38-native" not in service_worker or "NAPRAWNIK" not in manifest:
        raise SystemExit("The packaged PWA/service-worker branding or billing version is inconsistent.")
    native_bridge = bundle.read("assets/public/native-bridge.js").decode("utf-8")
    for marker in ["backButton", "toolbarColor", "setBackgroundColor", "writeFile", "__naprawnikNativeCheckout", "browserFinished"]:
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
    f"backup/import, assistant photo/history, billing/admin, catalogue, "
    f"{len(launcher_paths)} launcher densities and {len(splash_paths)} splash sizes verified."
)
