import { test } from "node:test";
import assert from "node:assert/strict";
import { SpectrumRNG } from "../src/rng.ts";
import { newGame, catalogFrom } from "../src/state.ts";
import {
  chartRank, finishRecording, producerRansomDue, makeVideo, launchSingle, royaltyIncome,
  weeklyRoyalties, bootCharts, tickRivals, runSinglesChart, dialAccident, startRecording,
} from "../src/records.ts";

// Synthetic catalog with the right shape. Values are invented, not game data.
const TABLE = Array.from({ length: 64 }, (_, i) => i % 16);
const catalog = () =>
  catalogFrom({
    rngTable: TABLE,
    rivals: Array.from({ length: 30 }, (_, i) => ({
      single: [i % 7, 20 + (i % 9), 30, 4, 5],
      album: [i % 5, 15 + (i % 11), 25, 6, 7],
      songChoices: [0, 1],
      albumTitle: 0,
    })),
    respawnScores: [25, 45, 33, 21, 19, 36],
    respawnStart: 3,
    nameStrings: [],
    bandNames: [],
    videoRankTable: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    fameRankTable: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    royaltyPercent: [255, 10, 20, 30, 40, 50],
    studioDays: [5, 4, 3, 2, 2, 1],
  });

const game = (cfg = {}) => newGame(new SpectrumRNG(TABLE, 3n), catalog(), cfg);

test("chartRank maps a score onto the top ten, 11 when below all", () => {
  assert.equal(chartRank(10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 1);
  assert.equal(chartRank(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 11);
  assert.equal(chartRank(100, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 1);
});

test("finishRecording: hype -2, skill +20, album in the can", () => {
  const s = game();
  s.hype = 5;
  finishRecording(s);
  assert.equal(s.hype, 3);
  assert.equal(s.skill, 20);
  assert.equal(s.albumInCan, true);
});

test("producer ransom: faithful mode tests only the 10^6 digit, so 10m is not rich", () => {
  const faithful = game({ faithfulBugs: true });
  faithful.cash = 10_000_000;
  assert.equal(producerRansomDue(faithful), false);
  const fixed = game({ faithfulBugs: false });
  fixed.cash = 10_000_000;
  assert.equal(producerRansomDue(fixed), true);
  assert.equal(producerRansomDue(fixed), false); // once per game
});

test("startRecording charges the studio and sets days per track", () => {
  const s = game();
  s.cash = 50_000;
  startRecording(s, 0);
  assert.equal(s.cash, 48_000);
  assert.equal(s.daysPerTrack, 5);
});

test("makeVideo sums scores and charges director plus location", () => {
  const s = game();
  s.cash = 50_000;
  const cost = makeVideo(s, 5, 3, 5); // director 5 (cost 5), location 3 (cost 50), feature 5 (score 1)
  assert.equal(cost, 55);
  assert.equal(s.cash, 49_945);
  assert.equal(s.videoScore, 1);
});

test("royalties: album position 1 with single at 11 pays 26,400 at 10%", () => {
  assert.equal(royaltyIncome(1, 11, false, 10), 26_400);
  assert.equal(royaltyIncome(1, 11, true, 10), 13_200); // piracy halves the album units
});

test("weekly royalties credit income and add disc points", () => {
  const s = game();
  s.label = 1;
  s.albumPos = 1;
  s.singlePos = 11;
  s.cash = 0;
  assert.equal(weeklyRoyalties(s), 26_400);
  assert.equal(s.cash, 26_400);
  assert.equal(s.discPoints, 9);
  for (let i = 0; i < 4; i++) weeklyRoyalties(s); // 45 points passes the first gold threshold of 40
  assert.equal(s.discs[0], true);
  assert.equal(s.discs[3], false);
});

test("launchSingle puts the single on the chart at 17...19 with a 5...6 week climb", () => {
  const s = game();
  launchSingle(s);
  assert.ok(s.singlePos >= 17 && s.singlePos <= 19);
  assert.ok(s.climbWeeks >= 5 && s.climbWeeks <= 6);
  assert.equal(s.singleReleased, true);
  assert.equal(s.releasedTracks[s.singleTrack], true);
});

test("rival movement keeps the 5-byte entries in range", () => {
  const s = game();
  bootCharts(s);
  for (let w = 0; w < 20; w++) tickRivals(s, false);
  for (const e of s.rivalSingles) {
    assert.equal(e.length, 5);
    assert.ok(e.every((b) => b >= 0 && b <= 255));
  }
});

test("singles chart has at most ten rows and marks every row", () => {
  const s = game();
  bootCharts(s);
  s.singleReleased = true;
  s.singlePos = 17;
  s.singlePeak = 11;
  s.climbWeeks = 5;
  const chart = runSinglesChart(s);
  assert.ok(chart.rows.length <= 10);
  assert.equal(chart.markers.length, chart.rows.length);
});

test("dial accident cannot happen before the first track is cut", () => {
  const s = game();
  s.tracksCut = 0;
  assert.equal(dialAccident(s), false);
});
