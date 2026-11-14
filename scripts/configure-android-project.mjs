#!/usr/bin/env node
/**
 * Konfiguruje wygenerowany projekt Capacitor Android:
 * - wstrzykuje natywny plugin ApkUpdaterPlugin i rejestruje go w MainActivity
 * - dodaje uprawnienia REQUEST_INSTALL_PACKAGES / ACCESS_NETWORK_STATE i FileProvider
 * - ustawia deterministyczny, rosnący versionCode oraz versionName z version.json
 * - konfiguruje opcjonalny stały keystore (NAPRAWNIK_KEYSTORE_PATH) dla podpisu debug/release
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const androidDir = path.join(root, "android");
const appDir = path.join(androidDir, "app");
const mainDir = path.join(appDir, "src", "main");
const pkgDir = path.join(mainDir, "java", "pl", "turbodiesel", "naprawnik");

export function computeVersionMeta(versionJson, runNumber = 0) {
  const versionName = String(versionJson?.version || "5.49").trim();
  const rawBuild = Number(versionJson?.build || 1731571200000);
  const calculatedBase = rawBuild > 1700000000000
    ? Math.floor((rawBuild - 1700000000000) / 10000)
    : Math.floor(rawBuild);
  // baseCode musi być bezwzględnie większy od 3065474 (najwyższy build testowy/debug u użytkowników)
  const baseCode = Math.max(3070000, calculatedBase);
  const versionCode = Math.min(2147000000, baseCode + Math.max(1, Number(runNumber) || 1));
  return { versionName, versionCode, build: rawBuild };
}

export function patchMainActivity(source) {
  let out = source;
  if (!out.includes("import android.os.Bundle;")) {
    out = out.replace(/package\s+[^\n;]+;\s*/, (m) => m + "\nimport android.os.Bundle;\n");
  }
  if (!out.includes("registerPlugin(ApkUpdaterPlugin.class)")) {
    if (out.includes("super.onCreate(")) {
      out = out.replace("super.onCreate(", "registerPlugin(ApkUpdaterPlugin.class);\n        super.onCreate(");
    } else {
      out = out.replace(
        /public class MainActivity extends BridgeActivity\s*\{/,
        `public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(ApkUpdaterPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n`
      );
    }
  }
  return out;
}

export function patchManifest(manifest) {
  let out = manifest;
  const permissions = [
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.ACCESS_NETWORK_STATE"
  ];
  for (const perm of permissions) {
    if (!out.includes(perm)) {
      out = out.replace(
        /<manifest\b([^>]*)>/,
        `<manifest$1>\n    <uses-permission android:name="${perm}" />`
      );
    }
  }
  if (!out.includes(".apkupdater.provider")) {
    const providerBlock = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.apkupdater.provider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/apk_updater_paths" />
        </provider>`;
    out = out.replace("</application>", `${providerBlock}\n    </application>`);
  }
  return out;
}

export function patchBuildGradle(gradle, { versionCode, versionName, keystoreConfigured }) {
  let out = gradle;
  if (/versionCode\s+\d+/.test(out)) {
    out = out.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  } else {
    out = out.replace(/defaultConfig\s*\{/, `defaultConfig {\n        versionCode ${versionCode}`);
  }
  if (/versionName\s+"[^"]*"/.test(out)) {
    out = out.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
  } else {
    out = out.replace(/defaultConfig\s*\{/, `defaultConfig {\n        versionName "${versionName}"`);
  }

  if (keystoreConfigured && !out.includes("signingConfigs {")) {
    const signingBlock = `    signingConfigs {
        naprawnik {
            storeFile file(System.getenv("NAPRAWNIK_KEYSTORE_PATH"))
            storePassword System.getenv("NAPRAWNIK_KEYSTORE_PASS")
            keyAlias System.getenv("NAPRAWNIK_KEYSTORE_ALIAS")
            keyPassword System.getenv("NAPRAWNIK_KEYSTORE_KEY_PASS")
        }
    }
    buildTypes {`;
    out = out.replace(/\s*buildTypes\s*\{/, "\n" + signingBlock);
    out = out.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/, "$1\n            signingConfig signingConfigs.naprawnik\n            debuggable false");
    if (/(buildTypes\s*\{[\s\S]*?)debug\s*\{/.test(out)) {
      out = out.replace(/(buildTypes\s*\{[\s\S]*?debug\s*\{)/, "$1\n            signingConfig signingConfigs.naprawnik");
    } else {
      out = out.replace(/(buildTypes\s*\{)/, "$1\n        debug {\n            signingConfig signingConfigs.naprawnik\n        }");
    }
  } else {
    if (out.includes("buildTypes {")) {
      out = out.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/, "$1\n            debuggable false");
    }
  }
  return out;
}

async function main() {
  if (!existsSync(appDir)) {
    throw new Error("Katalog android/app nie istnieje. Najpierw uruchom 'npx cap add android'.");
  }

  const versionJson = JSON.parse(await readFile(path.join(root, "version.json"), "utf8"));
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 0);
  const meta = computeVersionMeta(versionJson, runNumber);

  // 1. Natywny plugin ApkUpdaterPlugin.java
  await mkdir(pkgDir, { recursive: true });
  await copyFile(
    path.join(root, "scripts", "android-native", "ApkUpdaterPlugin.java"),
    path.join(pkgDir, "ApkUpdaterPlugin.java")
  );

  // 2. Rejestracja w MainActivity.java
  const mainActPath = path.join(pkgDir, "MainActivity.java");
  const mainActSrc = await readFile(mainActPath, "utf8");
  await writeFile(mainActPath, patchMainActivity(mainActSrc), "utf8");

  // 3. XML FileProvider dla katalogu cache/updates
  const xmlDir = path.join(mainDir, "res", "xml");
  await mkdir(xmlDir, { recursive: true });
  await writeFile(
    path.join(xmlDir, "apk_updater_paths.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    <cache-path name="apk_updates" path="updates/" />\n</paths>\n`,
    "utf8"
  );

  // 4. AndroidManifest.xml
  const manifestPath = path.join(mainDir, "AndroidManifest.xml");
  const manifestSrc = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, patchManifest(manifestSrc), "utf8");

  // 5. android/app/build.gradle
  const gradlePath = path.join(appDir, "build.gradle");
  const gradleSrc = await readFile(gradlePath, "utf8");
  const keystoreConfigured = Boolean(
    process.env.NAPRAWNIK_KEYSTORE_PATH &&
    process.env.NAPRAWNIK_KEYSTORE_PASS &&
    process.env.NAPRAWNIK_KEYSTORE_ALIAS &&
    process.env.NAPRAWNIK_KEYSTORE_KEY_PASS &&
    existsSync(process.env.NAPRAWNIK_KEYSTORE_PATH)
  );
  await writeFile(gradlePath, patchBuildGradle(gradleSrc, { ...meta, keystoreConfigured }), "utf8");

  // Zapisz wyliczone metadane wersji dla kroku przygotowania publikacji
  await writeFile(
    path.join(androidDir, "apk-build-meta.json"),
    JSON.stringify({ ...meta, keystoreConfigured }, null, 2) + "\n",
    "utf8"
  );

  console.log(`Configured Android project: versionName=${meta.versionName}, versionCode=${meta.versionCode}, customKeystore=${keystoreConfigured}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isCli) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

