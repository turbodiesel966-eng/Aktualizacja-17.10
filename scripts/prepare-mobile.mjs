import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const webDir = path.join(root, "www");
const requiredFiles = [
  "index.html",
  "billing.js",
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
console.log("NAPRAWNIK Android web assets prepared in ./www");
