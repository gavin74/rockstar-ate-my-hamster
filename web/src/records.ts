// Port of Sources/RockStar/Model/Rules+Records.swift: recording, releases,
// rival and player charts, and weekly royalties and gold discs.
// Name text comes from catalog.titleFor, so this module does not need the
// message system.

import { charge, credit } from "./calendar.ts";
import { difficulty } from "./config.ts";
import { type GameState, type RivalEntry } from "./state.ts";

export const STUDIO_COST = [2_000, 5_000, 10_000, 16_000, 20_000, 50_000];
export const DIRECTOR_COST = [3_000_000, 1_000_000, 50_000, 10_000, 5_000, 5];
export const DIRECTOR_SCORE = [5, 4, 3, 2, 1, 0];
export const LOCATION_COST = [50_000, 20_000, 10_000, 50];
export const LOCATION_SCORE = [5, 3, 2, 0];
export const FEATURE_SCORE = [3, 1, 2, 0, 2, 1];

export type ChartEntrant = { kind: "rival"; slot: number } | { kind: "player" };
export type ChartMarker = "same" | "moved" | "new";
export interface ChartTable {
  albums: boolean;
  /** rows[0] is number 1 */
  rows: ChartEntrant[];
  markers: ChartMarker[];
}

// MARK: recording

/** Pay for studio `s` (0...5). The caller then advances days to record the tracks. */
export function startRecording(s: GameState, studio: number): void {
  s.skillAtRecording = s.skill;
  s.daysPerTrack = s.catalog.studioDays[studio];
  s.tracksCut = 0;
  charge(s, STUDIO_COST[studio]);
}

/** Once per game: the dial accident wipes the last track. Returns true if it happened. */
export function dialAccident(s: GameState): boolean {
  if (s.dialAccidentDone || s.tracksCut === 0 || s.rng.rnd(6) !== 5) return false;
  s.dialAccidentDone = true;
  return true;
}

/** After the 10th track: hype -2, skill +20, album in the can. */
export function finishRecording(s: GameState): void {
  hypeDown(s);
  hypeDown(s);
  skillUp(s);
  skillUp(s);
  s.albumInCan = true;
}

/**
 * $745E: producer ransom check, once per game. Faithful mode tests only the
 * 10^6 digit of cash, so 10,000,000 does not count as rich (see README).
 */
export function producerRansomDue(s: GameState): boolean {
  const rich = s.config.faithfulBugs
    ? Math.floor(s.cash / 1_000_000) % 10 !== 0
    : s.cash >= 1_000_000;
  if (!rich || (s.oneShot & 8) !== 0) return false;
  s.oneShot |= 8;
  return true;
}

export function answerRansom(s: GameState, pay: boolean): void {
  if (pay) charge(s, 1_000_000);
  else s.albumInCan = false;
}

// MARK: releases

export function releaseAlbum(s: GameState, name: string): void {
  s.albumName = name;
  s.albumReleased = true;
  s.albumPos = 11 + s.rng.rnd(1);
}

/** Start a single: pick the track and reset the video score. */
export function beginSingle(s: GameState, track: number): void {
  s.singleTrack = track;
  s.videoScore = 0;
}

/** No video: hype -2. */
export function skipVideo(s: GameState): void {
  hypeDown(s);
  hypeDown(s);
}

/** Make the video. Returns the total cost, which is charged. */
export function makeVideo(s: GameState, director: number, location: number, feature: number): number {
  s.videoScore += DIRECTOR_SCORE[director] + LOCATION_SCORE[location] + FEATURE_SCORE[feature];
  const cost = DIRECTOR_COST[director] + LOCATION_COST[location];
  charge(s, cost);
  return cost;
}

/** rank(x, T) from $7A63. */
export function chartRank(x: number, table: number[]): number {
  for (let i = 0; i < 10; i++) {
    if (x === table[i]) return 10 - i;
    if (x < table[i]) return 11 - i;
  }
  return 1;
}

/** $743F / $7A63: put the single on the chart. */
export function launchSingle(s: GameState): void {
  if (s.releasedTracks[s.singleTrack]) s.videoScore = 0;
  else s.releasedTracks[s.singleTrack] = true;
  const vid = chartRank(s.videoScore, s.catalog.videoRankTable);
  const fam = chartRank(s.fame, s.catalog.fameRankTable);
  s.singlePeak = Math.max(vid, fam);
  s.singlePos = 17 + s.rng.rnd(3);
  s.climbWeeks = 5 + s.rng.rnd(2);
  s.singleReleased = true;
}

// MARK: band fame helpers ($6856 to $68A1)

export const fameUp = (s: GameState) => { s.fame = Math.min(s.fame + 10, 255); };
export const fameDown = (s: GameState) => { s.fame = Math.max(s.fame - 10, 1); };
export const skillUp = (s: GameState) => { s.skill = Math.min(s.skill + 10, 255); };
export const hypeUp = (s: GameState) => { s.hype = Math.min(s.hype + 1, 15); };
export const hypeDown = (s: GameState) => { s.hype = Math.max(s.hype - 1, 0); };

// MARK: rival charts

/** $764B (once per boot): titles and the first movement of the rival charts. */
export function bootCharts(s: GameState): void {
  const c = s.catalog;
  for (let i = 0; i < 30; i++) {
    const k = s.rng.rnd(2);
    s.rivalSongTitles[i] = c.titleFor(c.rivals[i].songChoices[k]);
  }
  s.rng.reseed();
  for (let i = 0; i < 30; i++) {
    s.rivalAlbumTitles[i] = c.titleFor(c.rivals[i].albumTitle);
    s.rng.reseed();
  }
  const n = (s.rng.index & 7) | 1;
  for (let i = 0; i < n; i++) tickRivals(s, false);
}

/** $7741: one week of rival movement. */
export function tickRivals(s: GameState, albums: boolean): void {
  const table: RivalEntry[] = albums ? s.rivalAlbums : s.rivalSingles;
  const c = s.catalog;
  for (let slot = 0; slot < 30; slot++) {
    const e = [...table[slot]];
    if ((e[0] & 0x80) !== 0) {
      const r = 1 + s.rng.rnd(3);
      if (e[1] - r <= 0) {
        e[1] = e[2];
        e[0] = e[4];
        table[slot] = e;
        continue;
      }
      e[1] -= r;
    } else {
      e[1] = (e[1] + s.rng.rnd(4)) & 0xff;
    }
    e[0] = (e[0] - 1) & 0xff;
    if (e[0] === 0) {
      // $779E respawn
      e[0] = e[3];
      s.respawnIndex = (s.respawnIndex + 1) % 6;
      e[1] = c.respawnScores[s.respawnIndex];
      if (!albums) {
        // $77C8: new tune and title for the band's next single
        const k = s.rng.rnd(2);
        s.rivalSongTitles[slot] = c.titleFor(c.rivals[slot].songChoices[k]);
      }
    } else if ((e[0] & 0x3f) === 0) {
      e[0] = e[4];
    }
    table[slot] = e;
  }
}

/** $78D2: rivals sorted by score. Ties go below earlier entries. */
export function rivalTopTen(s: GameState, albums: boolean): ChartEntrant[] {
  const table = albums ? s.rivalAlbums : s.rivalSingles;
  const rows: Array<{ score: number; slot: number }> = [];
  for (let slot = 0; slot < 30; slot++) {
    const score = table[slot][1];
    if (score === 0xff) continue;
    const at = rows.findIndex((r) => score < r.score);
    if (at >= 0) rows.splice(at, 0, { score, slot });
    else rows.push({ score, slot });
    if (rows.length > 10) rows.pop();
  }
  return rows.map((r) => ({ kind: "rival", slot: r.slot }));
}

/** $7B22: weekly movement of the player's single. */
export function movePlayerSingle(s: GameState): void {
  if ((s.climbWeeks & 0x80) === 0) {
    const r = s.rng.rnd(s.hype < 5 ? 2 : s.hype < 10 ? 4 : 6);
    const d = s.singlePos - r;
    if (d > 0) {
      s.singlePos = Math.max(s.singlePeak, d);
    } else if (d === 0) {
      // Faithful quirk: B was incremented, so landing on 0 goes one place DOWN.
      s.singlePos = s.config.faithfulBugs ? Math.max(s.singlePeak, s.singlePos + 1) : Math.max(s.singlePeak, 1);
    } else {
      s.singlePos = s.singlePeak;
    }
    s.climbWeeks = (s.climbWeeks - 1) & 0xff;
    if (s.climbWeeks === 0) s.climbWeeks = 0x80;
  } else {
    if (s.singlePos >= 11) return;
    s.singlePos += s.rng.rnd(3);
  }
}

/** $7AC2: weekly movement of the album, driven by the single. */
export function movePlayerAlbum(s: GameState): void {
  const single = s.singlePos;
  let a = s.albumPos;
  let climb = single >= 1 && single <= 8;
  if (climb && a >= 1 && a <= 5 && !(single >= 1 && single <= 5)) climb = false;
  if (climb) {
    const steps = ((9 - single) | 4) >> 2;
    for (let i = 0; i < steps; i++) {
      if (a === 1) break;
      a -= 1;
    }
  } else if (a !== 20) {
    a += 1;
  }
  s.albumPos = a;
}

function markers(rows: ChartEntrant[], last: number[]): ChartMarker[] {
  return rows.map((e, i) => {
    const code = e.kind === "rival" ? e.slot : 0xfe;
    if (i < last.length && last[i] === code) return "same";
    return last.includes(code) ? "moved" : "new";
  });
}

function codes(rows: ChartEntrant[]): number[] {
  const c = rows.map((e) => (e.kind === "rival" ? e.slot : 0xfe));
  while (c.length < 10) c.push(0xff);
  return c;
}

/** $7861 with the singles flag. */
export function runSinglesChart(s: GameState): ChartTable {
  tickRivals(s, false);
  const rows = rivalTopTen(s, false);
  movePlayerSingle(s);
  if (s.singlePos >= 1 && s.singlePos < 11) {
    rows.splice(Math.min(s.singlePos - 1, rows.length), 0, { kind: "player" });
    if (rows.length > 10) rows.pop();
  }
  const table: ChartTable = { albums: false, rows, markers: markers(rows, s.lastWeekSingles) };
  // $7A26: a climbing rival at #1 starts to fall.
  const first = rows[0];
  if (first && first.kind === "rival" && (s.rivalSingles[first.slot][0] & 0x80) !== 0) {
    s.rivalSingles[first.slot][0] = 4 + s.rng.rnd(4);
  }
  s.lastWeekSingles = codes(rows);
  return table;
}

/** $785C: the albums chart. */
export function runAlbumsChart(s: GameState): ChartTable {
  tickRivals(s, true);
  const rows = rivalTopTen(s, true);
  movePlayerAlbum(s);
  if (s.albumPos >= 1 && s.albumPos < 11) {
    rows.splice(Math.min(s.albumPos - 1, rows.length), 0, { kind: "player" });
    if (rows.length > 10) rows.pop();
  }
  const table: ChartTable = { albums: true, rows, markers: markers(rows, s.lastWeekAlbums) };
  s.lastWeekAlbums = codes(rows);
  return table;
}

/** $781A: compute the charts that are due. */
export function runChartShow(s: GameState): ChartTable[] {
  const out: ChartTable[] = [];
  if (s.singleReleased) out.push(runSinglesChart(s));
  if (s.albumReleased) out.push(runAlbumsChart(s));
  return out;
}

// MARK: royalties and discs ($7004)

/** Weekly income for given positions, before the difficulty scale. */
export function royaltyIncome(albumPos: number, singlePos: number, piracy: boolean, percent: number): number {
  const ua = albumPos >= 1 && albumPos <= 10 ? 12 - albumPos : 0;
  const us = singlePos >= 1 && singlePos <= 10 ? 12 - singlePos : 0;
  const units = (piracy ? ua : 2 * ua) + us;
  return 120 * units * percent;
}

export function royaltyPercent(s: GameState, tier: number): number {
  return tier >= 1 && tier <= 5 ? s.catalog.royaltyPercent[tier] : 0;
}

/** Sunday: sales bar, royalties, gold discs. Returns the income credited. */
export function weeklyRoyalties(s: GameState): number {
  const ua = s.albumPos >= 1 && s.albumPos <= 10 ? 12 - s.albumPos : 0;
  const us = s.singlePos >= 1 && s.singlePos <= 10 ? 12 - s.singlePos : 0;
  if (s.week < s.salesHistory.length) s.salesHistory[s.week] = ua + us + 1;
  s.week += 1;
  const income =
    Math.floor(
      (royaltyIncome(s.albumPos, s.singlePos, s.piracy, royaltyPercent(s, s.label)) *
        difficulty.royaltyPercent(s.config.difficulty)) /
        100,
    );
  if (income > 0) credit(s, income);
  if (s.albumPos >= 1 && s.albumPos <= 9) {
    s.discPoints = (s.discPoints + 10 - s.albumPos) & 0xff;
    const t = difficulty.discThresholds(s.config.difficulty);
    if (s.discPoints >= t[3]) s.discs[3] = true;
    else if (s.discPoints >= t[2]) s.discs[2] = true;
    else if (s.discPoints >= t[1]) s.discs[1] = true;
    else if (s.discPoints >= t[0]) s.discs[0] = true;
  }
  return income;
}
