import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGameData } from "../src/data.ts";

const url = new URL("../data/remake-gamedata.json", import.meta.url);

test("original remake data passes the loader schema and is labelled", () => {
  const json = JSON.parse(readFileSync(url, "utf8"));
  assert.match(json._notice, /ORIGINAL remake/);
  const d = parseGameData(json);
  assert.equal(d.rivals.length, 30);
});
