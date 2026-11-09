import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "shared-manifest.json");

let manifestData = null;

export async function getSharedManifest() {
  if (!manifestData) {
    const raw = await readFile(manifestPath, "utf8");
    manifestData = JSON.parse(raw);
  }
  return manifestData;
}

export function buildPrecacheList(baseList, assets) {
  const assetPaths = assets.map(a => `./assets/${a}`);
  return [...baseList, ...assetPaths];
}

export async function getPwaPrecache() {
  const manifest = await getSharedManifest();
  return buildPrecacheList(manifest.pwaPrecache, manifest.sharedAssets);
}

export async function getApkPrecache() {
  const manifest = await getSharedManifest();
  return buildPrecacheList(manifest.apkPrecache, manifest.sharedAssets);
}

export async function getRequiredWebFiles() {
  const manifest = await getSharedManifest();
  return manifest.requiredWebFiles;
}

export async function getSharedAssets() {
  const manifest = await getSharedManifest();
  return manifest.sharedAssets;
}

export async function getBlockedOtaTerms() {
  const manifest = await getSharedManifest();
  return manifest.blockedOtaTerms;
}

