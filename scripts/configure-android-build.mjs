import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "capacitor.config.json");
const gradlePath = path.join(root, "android", "app", "build.gradle");
const config = JSON.parse(await readFile(configPath, "utf8"));
if (config.appId !== "pl.turbodiesel.naprawnik.mobile") {
  throw new Error("Unexpected Android migration appId; refusing to package under an unintended identity.");
}

let gradle = await readFile(gradlePath, "utf8");
const appIdMatch = gradle.match(/^\s*applicationId\s*(?:=\s*)?["']([^"']+)["']\s*$/m);
if (!appIdMatch || appIdMatch[1] !== config.appId) {
  throw new Error("Generated Android applicationId does not match capacitor.config.json.");
}

const runNumber = Math.max(1, Number.parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10) || 1);
const codeMatches = [...gradle.matchAll(/^(\s*)versionCode\s*(?:=\s*)?\d+\s*$/gm)];
const nameMatches = [...gradle.matchAll(/^(\s*)versionName\s*(?:=\s*)?["'][^"']+["']\s*$/gm)];
if (codeMatches.length !== 1 || nameMatches.length !== 1) {
  throw new Error("Could not uniquely locate Android versionCode/versionName in generated Gradle file.");
}
gradle = gradle.replace(codeMatches[0][0], codeMatches[0][1] + "versionCode " + runNumber);
gradle = gradle.replace(nameMatches[0][0], nameMatches[0][1] + 'versionName "5.18.' + runNumber + '"');

const androidMarker = "android {";
if (gradle.split(androidMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate Android Gradle configuration.");
}
const signingVars = "def releaseKeyStorePath = System.getenv(\"ANDROID_KEYSTORE_FILE\")\n" +
  "def releaseStorePassword = System.getenv(\"ANDROID_KEYSTORE_PASSWORD\")\n" +
  "def releaseKeyAlias = System.getenv(\"ANDROID_KEY_ALIAS\")\n" +
  "def releaseKeyPassword = System.getenv(\"ANDROID_KEY_PASSWORD\")\n" +
  "def hasReleaseSigning = releaseKeyStorePath && releaseStorePassword && releaseKeyAlias && releaseKeyPassword\n\n";
gradle = gradle.replace(androidMarker, signingVars + androidMarker);

const buildTypesMarker = "    buildTypes {";
if (gradle.split(buildTypesMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate Android buildTypes.");
}
const signingConfigs = "    signingConfigs {\n" +
  "        if (hasReleaseSigning) {\n" +
  "            release {\n" +
  "                storeFile file(releaseKeyStorePath)\n" +
  "                storePassword releaseStorePassword\n" +
  "                keyAlias releaseKeyAlias\n" +
  "                keyPassword releaseKeyPassword\n" +
  "            }\n" +
  "        }\n" +
  "    }\n\n";
gradle = gradle.replace(buildTypesMarker, signingConfigs + buildTypesMarker);

const releaseTypeMarker = "    buildTypes {\n        release {";
if (gradle.split(releaseTypeMarker).length - 1 !== 1) {
  throw new Error("Could not uniquely locate the release build type.");
}
gradle = gradle.replace(
  releaseTypeMarker,
  releaseTypeMarker + "\n            if (hasReleaseSigning) signingConfig signingConfigs.release"
);

await writeFile(gradlePath, gradle, "utf8");
console.log("Configured Android package " + config.appId + " version 5.18." + runNumber + "; persistent release signing activates only when all signing variables are present.");
