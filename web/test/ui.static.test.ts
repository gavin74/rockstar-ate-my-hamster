// Static checks on the page: every id the script uses exists exactly once in the markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");

test("no duplicate element ids in the page", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Map<string, number>();
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(dupes, []);
});

test("every $(\"id\") the script uses exists in the markup", () => {
  const used = new Set([...js.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]));
  const have = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...used].filter((id) => !have.has(id));
  assert.deepEqual(missing, []);
});

test("every id-based button in the page has a click handler wired in the script", () => {
  const buttons = [...html.matchAll(/<button[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  const wired = new Set([...js.matchAll(/\$\("([^"]+)"\)\.onclick/g)].map((m) => m[1]));
  const unwired = buttons.filter((id) => !wired.has(id));
  assert.deepEqual(unwired, []);
});
