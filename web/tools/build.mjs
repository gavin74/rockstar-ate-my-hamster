// Builds the browser bundle into dist/: strips TypeScript types from src/ (no
// bundler needed), rewrites .ts import paths to .js, and copies the app page and
// the remake data. Usage: node tools/build.mjs
import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

// node.ts uses node:fs and is for the command line only, so it is not in the browser build.
for (const file of readdirSync(join(root, "src"))) {
  if (!file.endsWith(".ts") || file === "node.ts") continue;
  const src = readFileSync(join(root, "src", file), "utf8");
  const js = stripTypeScriptTypes(src).replace(/(from\s+["'])(\.\.?\/[^"']+)\.ts(["'])/g, "$1$2.js$3");
  writeFileSync(join(dist, file.replace(/\.ts$/, ".js")), js);
}
copyFileSync(join(root, "app", "index.html"), join(dist, "index.html"));
copyFileSync(join(root, "app", "app.js"), join(dist, "app.js"));
copyFileSync(join(root, "data", "remake-gamedata.json"), join(dist, "remake-gamedata.json"));
console.log("built", dist);
