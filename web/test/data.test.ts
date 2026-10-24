import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGameData, GameDataError } from "../src/data.ts";

// Synthetic fixture with the right shape only. It is not game data.
const fixture = () => ({
  rngTable: Array.from({ length: 64 }, (_, i) => i % 16),
  rivals: Array.from({ length: 30 }, () => ({ single: [0, 0, 0, 0, 0], album: [0, 0, 0, 0, 0], songChoices: [], albumTitle: 0 })),
  respawnScores: [25, 45, 33, 21, 19, 36],
  respawnStart: 3,
  nameStrings: Array.from({ length: 58 }, () => []),
  bandNames: Array.from({ length: 8 }, () => []),
  videoRankTable: [],
  fameRankTable: [],
  royaltyPercent: [255, 10, 20, 30, 40, 50],
  studioDays: [],
});

test("accepts a well-formed gamedata object", () => {
  assert.equal(parseGameData(fixture()).respawnStart, 3);
});

test("rejects a bad rng table with the path in the message", () => {
  const bad = fixture();
  bad.rngTable = bad.rngTable.map((v) => (v === 0 ? 1 : v));
  assert.throws(() => parseGameData(bad), (e: unknown) => e instanceof GameDataError && /rngTable/.test((e as Error).message));
});

test("rejects the wrong number of rivals", () => {
  const bad = fixture();
  bad.rivals.pop();
  assert.throws(() => parseGameData(bad), /rivals/);
});
