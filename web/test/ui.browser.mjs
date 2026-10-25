// Browser test: loads the built page in Chromium and clicks through the controls.
// Needs `node tools/build.mjs` first, and Playwright with Chromium installed.
// Run: node test/ui.browser.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json" };

if (!existsSync(join(root, "index.html"))) {
  console.error("dist/ is missing: run node tools/build.mjs first");
  process.exit(1);
}

const server = createServer((req, res) => {
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(readFileSync(join(root, path)));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok" : "not ok"} - ${name}${detail && !ok ? ` (${detail})` : ""}`);
  if (!ok) failures++;
};

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.log("skipped: playwright is not installed");
  server.close();
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(url);
await page.waitForSelector("#roster input");

check("hire: start button disabled with no stars", await page.isDisabled("#startBand"));
for (let i = 1; i <= 4; i++) await page.click(`#roster label:nth-child(${i}) input`);
await page.click("#roster label:nth-child(5) input");
check("hire: a fifth star cannot be chosen", !(await page.isChecked("#roster label:nth-child(5) input")));
check("hire: start enabled with four stars", !(await page.isDisabled("#startBand")));
await page.click("#startBand");
await page.waitForSelector("#game:not([hidden])");

const dupes = await page.evaluate(() => {
  const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
  return ids.filter((id, i) => ids.indexOf(id) !== i);
});
check("page: no duplicate ids in the live DOM", dupes.length === 0, dupes.join(","));

check("single: disabled before any album is recorded", await page.isDisabled("#single"));
check("release album: disabled before any album is recorded", await page.isDisabled("#release"));
check("record: enabled at the start", !(await page.isDisabled("#record")));

await page.click("#record");
check("record: log says the album is in the can", (await page.textContent("#log")).includes("in the can"));
check("single: enabled after recording", !(await page.isDisabled("#single")));
check("release album: enabled once in the can", !(await page.isDisabled("#release")));

await page.click("#single");
check("single: clicking it changes the single stat", (await page.textContent("#singlePos")) !== "-",
  await page.textContent("#singlePos"));
check("single: message confirms the release", (await page.textContent("#msg")).includes("Single released"));

await page.click("#release");
check("album: clicking release changes the album stat", (await page.textContent("#albumPos")) !== "in can",
  await page.textContent("#albumPos"));

await page.click("#promo");
check("promo: cash drops by £5k", (await page.textContent("#msg")).includes("Promo push"));

await page.click("#tour");
check("tour: next night becomes available", !(await page.isDisabled("#nextNight")));
for (let i = 0; i < 12; i++) {
  if (await page.isVisible("#promptPanel")) await page.click("#promptButtons button");
  if (!(await page.isDisabled("#nextNight"))) await page.click("#nextNight");
  else break;
}
check("tour: log records a night", (await page.textContent("#log")).includes("Night 1"));

for (const id of ["day", "week", "practice", "publicity", "gearBuy"]) {
  if (!(await page.isDisabled(`#${id}`))) await page.click(`#${id}`);
}
check("actions: enabled buttons clicked without error", errors.length === 0, errors.join(" | "));

await browser.close();
server.close();
console.log(failures === 0 ? "# all browser checks passed" : `# ${failures} browser check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
