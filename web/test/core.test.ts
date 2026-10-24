import { test } from "node:test";
import assert from "node:assert/strict";
import { SpectrumRNG } from "../src/rng.ts";
import { newGame, gameDecided, catalogFrom } from "../src/state.ts";
import { advanceDay, wageBill, payWages, charge, dateText } from "../src/calendar.ts";
import { retireChance, startNewCareerYear } from "../src/career.ts";
import { ModHost, type Mod } from "../src/plugins.ts";
import type { GameConfig } from "../src/config.ts";
import { stepDay } from "../src/turn.ts";

// Test table: 64 bytes with values 0..15 and a 0, so rnd(n) is well defined.
const TABLE = Array.from({ length: 64 }, (_, i) => i % 16);
const rng = () => new SpectrumRNG(TABLE, 1n);

// Minimal catalog: 30 rivals with zeroed entries and 10 rank values.
const catalog = () =>
  catalogFrom({
    rngTable: TABLE,
    rivals: Array.from({ length: 30 }, () => ({ single: [0, 0, 0, 0, 0], album: [0, 0, 0, 0, 0], songChoices: [0, 0], albumTitle: 0 })),
    respawnScores: [25, 45, 33, 21, 19, 36],
    respawnStart: 3,
    nameStrings: [],
    bandNames: [],
    videoRankTable: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    fameRankTable: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    royaltyPercent: [255, 10, 20, 30, 40, 50],
    studioDays: [5, 4, 3, 2, 2, 1],
  });

// A playable game: newGame() starts with an empty band, which counts as decided.
const band = (cfg: Partial<GameConfig> = {}) => {
  const s = newGame(rng(), catalog(), cfg);
  s.stars = 4;
  s.gone = [false, false, false, false];
  return s;
};

test("rnd(n) only returns values <= n, and the odds follow the table", () => {
  const r = rng();
  for (let i = 0; i < 1000; i++) assert.ok(r.rnd(5) <= 5);
  const total = [0, 1, 2, 3, 4, 5].reduce((a, v) => a + r.probability(v, 5), 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("rng is deterministic for a given seed", () => {
  const a = new SpectrumRNG(TABLE, 42n);
  const b = new SpectrumRNG(TABLE, 42n);
  for (let i = 0; i < 50; i++) assert.equal(a.rnd(15), b.rnd(15));
});

test("calendar: a week runs Monday to Sunday with wages on Friday", () => {
  const s = band();
  const seen: string[] = [];
  for (let i = 0; i < 7; i++) seen.push(advanceDay(s));
  assert.deepEqual(seen, ["quiet", "quiet", "quiet", "wages", "quiet", "sunday", "quiet"]);
  assert.equal(dateText(s), "MON 08 JAN");
});

test("calendar: 31 January rolls into February, and the year ends at 31 December", () => {
  const s = band();
  s.dayOfMonth = 31;
  advanceDay(s);
  assert.equal(s.month, 1);
  assert.equal(s.dayOfMonth, 1);
  s.month = 11;
  s.dayOfMonth = 31;
  assert.equal(advanceDay(s), "none");
  assert.equal(s.yearOver, true);
  assert.ok(gameDecided(s));
});

test("sandbox rolls the year over instead of ending it", () => {
  const s = band({ sandbox: true });
  s.month = 11;
  s.dayOfMonth = 31;
  advanceDay(s);
  assert.equal(s.yearOver, false);
  assert.equal(s.month, 0);
});

test("charge: overdraw sets bankrupt and zeroes cash, unless sandbox", () => {
  const s = band();
  charge(s, 60_000);
  assert.equal(s.bankrupt, true);
  assert.equal(s.cash, 0);
  const sb = band({ sandbox: true });
  charge(sb, 60_000);
  assert.equal(sb.bankrupt, false);
});

test("wages: difficulty scales the bill; faithful bug pays the first `stars` slots", () => {
  const s = band({ faithfulBugs: true });
  s.wages = [100, 200, 300, 400];
  s.stars = 2;
  s.gone = [true, false, false, true]; // slot 0 gone, 1 and 2 present
  assert.equal(wageBill(s), 300); // faithful: slots 0 and 1
  s.config.faithfulBugs = false;
  assert.equal(wageBill(s), 500); // fixed: slots 1 and 2
  s.config.difficulty = "hard";
  assert.equal(payWages(s), 750);
});

test("career: retire chance climbs by 10 per year, capped at 50", () => {
  assert.equal(retireChance(1), 0);
  assert.equal(retireChance(3), 20);
  assert.equal(retireChance(20), 50);
});

test("career: new year raises wages 10%, resets discs, counts platinum", () => {
  const s = band({ career: true });
  s.stars = 2;
  s.gone = [false, false, true, true];
  s.wages = [1000, 2000, 0, 0];
  s.discs = [true, true, true, true];
  const retired = startNewCareerYear(s, () => 99); // never retires at roll 99 < chance 0
  assert.deepEqual(retired, []);
  assert.deepEqual(s.wages.slice(0, 2), [1100, 2200]);
  assert.deepEqual(s.discs, [false, false, false, false]);
  assert.equal(s.config.platinums, 1);
  assert.equal(s.config.careerYear, 2);
});

test("hooks: mods receive day and wage events and cannot change the outcome", () => {
  const log: string[] = [];
  const mod: Mod = {
    name: "logger",
    setup(api) {
      api.on("dayAdvanced", (p) => log.push(`day:${p.outcome}`));
      api.on("wagesPaid", (p) => log.push(`wages:${p.amount}`));
    },
  };
  const host = new ModHost([mod]);
  const s = band();
  s.stars = 1;
  s.gone = [false, true, true, true];
  s.wages = [500, 0, 0, 0];
  for (let i = 0; i < 5; i++) stepDay(s, host);
  assert.deepEqual(log, ["day:quiet", "day:quiet", "day:quiet", "day:wages", "wages:500", "day:quiet"]);
  assert.throws(() => host.load(mod), /already loaded/);
});
