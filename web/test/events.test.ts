import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Session } from "../src/session.ts";
import { answerDemand, answerSponsor, giveGifts, sponsorScandalTick, tickEventCounter, allMoodsDown, unhappiestStar, starLeaves } from "../src/events.ts";

const data = JSON.parse(readFileSync(new URL("../data/remake-gamedata.json", import.meta.url), "utf8"));

test("the turn counter fires charity every 15 turns and bootlegs at 3", () => {
  const s = new Session(data, { seed: 1n }).state;
  s.eventCounter = 10;
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) seen.push(tickEventCounter(s));
  assert.ok(seen.includes("bootleg"));
  assert.ok(seen.includes("charity"));
});

test("gifts cost per star and raise moods", () => {
  const s = new Session(data, { seed: 2n }).state;
  s.mood = [5, 5, 5, 5];
  s.cash = 100_000;
  const bill = giveGifts(s, 2); // £5,000 a star, 10 moods up
  assert.equal(bill, 5_000 * s.stars);
  assert.ok(s.mood.slice(0, s.stars).every((m) => m > 5));
});

test("demands: paying sets the star to 15 after the others drop", () => {
  const s = new Session(data, { seed: 3n }).state;
  s.mood = [9, 9, 9, 9];
  s.cash = 100_000;
  answerDemand(s, 1, 10_000, true);
  assert.equal(s.mood[1], 15);
  assert.equal(s.mood[0], 8);
  assert.equal(s.cash, 90_000);
});

test("a star who leaves halves fame and drops the band size", () => {
  const s = new Session(data, { seed: 4n }).state;
  const stars = s.stars;
  s.fame = 100;
  starLeaves(s, 0);
  assert.equal(s.stars, stars - 1);
  assert.equal(s.fame, (100 >> 1) | 1);
  assert.equal(s.gone[0], true);
});

test("sponsor deal pays £100k and a scandal halves fame when its counter runs out", () => {
  const s = new Session(data, { seed: 5n }).state;
  s.cash = 0;
  answerSponsor(s, true);
  assert.equal(s.cash, 100_000);
  s.sponsor = 2;
  s.scandalCounter = 1;
  s.fame = 200;
  assert.equal(sponsorScandalTick(s), 2);
  assert.equal(s.fame, 100 | 1);
});

test("unhappiest star is the lowest mood among those still in the band", () => {
  const s = new Session(data, { seed: 6n }).state;
  s.mood = [50, 3, 70, 90];
  s.gone = [false, true, false, false];
  assert.deepEqual(unhappiestStar(s), { mood: 50, slot: 0 });
  allMoodsDown(s);
  assert.equal(s.mood[0], 49);
});
