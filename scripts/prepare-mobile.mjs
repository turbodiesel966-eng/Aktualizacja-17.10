import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const webDir = path.join(root, "www");
const requiredFiles = [
  "index.html",
  "billing.js",
  "mobile-admin-pairing.js",
  "katalog-techniczny.js",
  "sw.js",
  "manifest.webmanifest"
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
for (const file of requiredFiles) {
  await cp(path.join(root, file), path.join(webDir, file));
}
await cp(path.join(root, "assets"), path.join(webDir, "assets"), { recursive: true });
const mobileIndex = path.join(webDir, "index.html");
const index = await readFile(mobileIndex, "utf8");
const billingScript = '<script src="./billing.js?v=16"></script>';
if (!index.includes(billingScript)) throw new Error("Nie znaleziono skryptu billing.js do rozszerzenia APK.");
await writeFile(mobileIndex, index.replace(
  billingScript,
  billingScript + '\n<script src="./mobile-admin-pairing.js"></script>'
), "utf8");
console.log("NAPRAWNIK Android web assets prepared in ./www");
