import {existsSync, lstatSync, readFileSync, symlinkSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distManifestPath = resolve(rootDir, "dist", "manifest.json");
const rootManifestPath = resolve(rootDir, "manifest.json");
const rootLocalesPath = resolve(rootDir, "_locales");
const publicLocalesPath = resolve(rootDir, "public", "_locales");

if (!existsSync(distManifestPath)) {
  throw new Error("Missing dist/manifest.json. Run vite build before preparing the root extension.");
}

const manifest = JSON.parse(readFileSync(distManifestPath, "utf8"));

const prefixDist = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }

  if (
    value.startsWith("dist/") ||
    value.startsWith("/") ||
    value.startsWith("__MSG_") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return value;
  }

  return `dist/${value}`;
};

const prefixIconMap = (icons) => {
  if (!icons || typeof icons !== "object") {
    return icons;
  }

  return Object.fromEntries(
    Object.entries(icons).map(([size, path]) => [size, prefixDist(path)])
  );
};

const rootManifest = JSON.parse(JSON.stringify(manifest));

rootManifest.icons = prefixIconMap(rootManifest.icons);

if (rootManifest.action?.default_icon) {
  rootManifest.action.default_icon = prefixIconMap(rootManifest.action.default_icon);
}

if (rootManifest.background?.service_worker) {
  rootManifest.background.service_worker = prefixDist(rootManifest.background.service_worker);
}

if (rootManifest.side_panel?.default_path) {
  rootManifest.side_panel.default_path = prefixDist(rootManifest.side_panel.default_path);
}

if (rootManifest.options_ui?.page) {
  rootManifest.options_ui.page = prefixDist(rootManifest.options_ui.page);
}

for (const contentScript of rootManifest.content_scripts || []) {
  contentScript.js = contentScript.js?.map(prefixDist);
  contentScript.css = contentScript.css?.map(prefixDist);
}

for (const resource of rootManifest.web_accessible_resources || []) {
  resource.resources = resource.resources?.map(prefixDist);
}

writeFileSync(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`);

if (!existsSync(rootLocalesPath)) {
  const type = process.platform === "win32" ? "junction" : "dir";
  symlinkSync(publicLocalesPath, rootLocalesPath, type);
} else {
  const stat = lstatSync(rootLocalesPath);
  if (!stat.isSymbolicLink()) {
    console.warn("_locales already exists and is not a symlink. Leaving it unchanged.");
  }
}

console.log("Prepared root extension manifest. You can load the project root in Chrome.");
