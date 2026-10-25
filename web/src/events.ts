// Port of Rules+Events.swift: mood checks, demands and ultimatums, trouble, gifts,
// publicity, the periodic scheduler, charity, sponsors, scandals and bootleggers.
// Each function returns the outcome; the caller shows the message. Random draws
// keep the original's order, so a seed plays the same way as the Swift rules.

import { charge, credit } from "./calendar.ts";
import { type Disaster, disasterCheck } from "./gigs.ts";
import { fameUp, hypeUp } from "./records.ts";
import { type GameState } from "./state.ts";

export type MoodEvent =
  | { kind: "content"; disaster: Disaster | null }
  | { kind: "demand"; slot: number; cost: number }
  | { kind: "quits"; slot: number }
  | { kind: "ultimatum"; slot: number; cost: number }
  | { kind: "trouble"; slot: number; cost: number };

export function halveFame(s: GameState): void {
  s.fame = (s.fame >> 1) | 1;
}

/** $75E4: every live mood -1 (0 and 255 are skipped). */
export function allMoodsDown(s: GameState): void {
  for (let i = 0; i < 4; i++) if (s.mood[i] !== 0 && s.mood[i] !== 0xff) s.mood[i] -= 1;
}

/** $75E0: every live mood +1 (8-bit). */
export function allMoodsUp(s: GameState): void {
  for (let i = 0; i < 4; i++) if (s.mood[i] !== 0 && s.mood[i] !== 0xff) s.mood[i] = (s.mood[i] + 1) & 0xff;
}

/** $7603: lowest mood among live stars (ties go to the later slot). Sets currentStar. */
export function unhappiestStar(s: GameState): { mood: number; slot: number } {
  let m = 0xff;
  let slot = 0;
  for (let i = 0; i < 4; i++) {
    if (!s.gone[i] && s.mood[i] <= m) {
      m = s.mood[i];
      slot = i;
    }
  }
  s.currentStar = slot;
  return { mood: m, slot };
}

/** $75E4 / $7565: a star leaves; fame is halved. */
export function starLeaves(s: GameState, slot: number): void {
  s.gone[slot] = true;
  s.stars -= 1;
  halveFame(s);
}

/** The pre-show mood check ($74B5). The caller answers any demand or ultimatum. */
export function moodCheck(s: GameState): MoodEvent {
  const { mood: m, slot: i } = unhappiestStar(s);
  if (m >= 9) {
    allMoodsDown(s);
    s.firstNight = false;
    if (s.rng.rnd(10) === 7) return { kind: "content", disaster: disasterCheck(s) };
    return { kind: "content", disaster: null };
  }
  const cost = (s.rng.rnd(8) + 1) * 10_000;
  if (m >= 4) {
    s.firstNight = false;
    if (s.discs[2]) {
      starLeaves(s, i);
      return { kind: "quits", slot: i };
    }
    return { kind: "demand", slot: i, cost };
  }
  if (s.rng.rnd(2) === 1 && !s.firstNight) {
    const bill = (s.rng.rnd(7) + 1) * 10_000;
    return { kind: "trouble", slot: i, cost: bill };
  }
  s.firstNight = false;
  if (s.discs[1]) {
    starLeaves(s, i);
    return { kind: "quits", slot: i };
  }
  return { kind: "ultimatum", slot: i, cost };
}

/** Answer a demand: paying sets that star's mood to 15 after the others go down. */
export function answerDemand(s: GameState, slot: number, cost: number, pay: boolean): void {
  if (pay) {
    charge(s, cost);
    allMoodsDown(s);
    s.mood[slot] = 15;
  } else {
    s.mood[slot] = 2;
  }
}

/** Answer an ultimatum: paying sets mood to 20; refusing fires the star. */
export function answerUltimatum(s: GameState, slot: number, cost: number, pay: boolean): void {
  if (pay) {
    charge(s, cost);
    allMoodsDown(s);
    s.mood[slot] = 20;
  } else {
    starLeaves(s, slot);
  }
}

/** After trouble: true = jailed, false = wrecked. */
export function troubleHeadline(s: GameState): boolean {
  const jailed = s.rng.rnd(2) === 1;
  if (jailed) s.rng.reseed();
  return jailed;
}

/** Pay the star's bill after trouble. */
export function payStarBill(s: GameState, slot: number, cost: number): void {
  charge(s, cost);
  allMoodsDown(s);
  s.mood[slot] = 15;
}

export const GIFT_PRICES = [20_000, 10_000, 5_000, 100, 50, 1];

/** Gifts: cost per star; the better the gift, the more mood gained. Returns the bill. */
export function giveGifts(s: GameState, choice: number): number {
  const bill = GIFT_PRICES[choice] * s.stars;
  for (let i = 0; i < 12 - choice; i++) allMoodsUp(s);
  charge(s, bill);
  return bill;
}

export type PublicityResult =
  | { kind: "nobodyCares"; headline: number; side: number }
  | { kind: "bandStory"; headline: number; side: number; victim: number; died: boolean };

/** $81DD: a random live star. */
export function pickRandomLiveStar(s: GameState): number {
  let i = s.stars > 1 ? s.rng.rnd(s.stars - 1) : 0;
  let guard = 0;
  while (s.gone[i % 4] && guard < 4) {
    i += 1;
    guard += 1;
  }
  return i % 4;
}

/** $7FF6: a bad press story costs a sponsor patience. */
export function badPress(s: GameState): void {
  if (s.sponsorPatience > 0) s.sponsorPatience -= 1;
}

/** Publicity stunt. Returns the headline shown. */
export function publicityStunt(s: GameState): PublicityResult {
  if (s.rng.rnd(3) >= 2) {
    s.rng.reseed();
    let h: number;
    do {
      h = 132 + (s.rng.rnd(6) >> 1);
    } while (h === s.lastHeadline);
    s.lastHeadline = h;
    const side = s.rng.rnd(2) + 136;
    return { kind: "nobodyCares", headline: h, side };
  }
  s.rng.reseed();
  let h: number;
  do {
    h = s.rng.rnd(4) + 140;
  } while (h === s.lastHeadline);
  s.lastHeadline = h;
  if (h === 143) badPress(s);
  const side = s.rng.rnd(3) + 132;
  const victim = pickRandomLiveStar(s);
  s.currentStar = victim;
  let died = false;
  if (h === 144) {
    s.gone[victim] = true;
    s.stars -= 1;
    died = true;
  }
  return { kind: "bandStory", headline: h, side, victim, died };
}

export type PeriodicEvent = "none" | "charity" | "bootleg";

/** $6ADF: decrement the turn counter and report what is due. */
export function tickEventCounter(s: GameState): PeriodicEvent {
  s.eventCounter -= 1;
  if (s.eventCounter === 0) {
    s.eventCounter = 15;
    return "charity";
  }
  if (s.eventCounter === 3) return "bootleg";
  return "none";
}

export const charityEligible = (s: GameState) => s.hype >= 10 && s.fame >= 100;

/** Charity answer. Returns whether the charity was genuine and the headline (193/194) if any. */
export function answerCharity(s: GameState, accept: boolean): { real: boolean; headline: number | null } {
  const real = (s.rng.rnd(15) & 1) === 1;
  if (real && accept) {
    hypeUp(s);
    fameUp(s);
    return { real, headline: null };
  }
  if (real && !accept) {
    halveFame(s);
    badPress(s);
    return { real, headline: 193 };
  }
  if (!real && accept) {
    hypeUp(s);
    halveFame(s);
    badPress(s);
    return { real, headline: 194 };
  }
  return { real, headline: null };
}

export const SPONSOR_NAMES = ["JOKA COLA", "BULLWISER BEER", "SOMA ELECTRICS", "LIEVIE JEANS", "FRAUD CARS"];

/** Unsponsored and famous enough: maybe a company offers. Returns its index 0...4. */
export function sponsorOffer(s: GameState): number | null {
  if (s.sponsor !== 0 || s.fame < 150 || s.rng.rnd(10) !== 7) return null;
  const c = s.rng.rnd(4);
  if (s.sponsorOffered[c]) return null;
  s.sponsorOffered[c] = true;
  s.sponsor = c + 1;
  return c;
}

export function answerSponsor(s: GameState, accept: boolean): void {
  if (accept) {
    credit(s, 100_000);
    s.sponsorPatience = 10;
  } else {
    s.sponsor = 0;
  }
}

/** The sponsor pulls out when patience runs out. */
export const sponsorPullOutDue = (s: GameState) => s.sponsor !== 0 && s.sponsorPatience === 0;

export function sponsorPullOut(s: GameState): void {
  charge(s, 100_000);
  s.sponsor = 0;
}

/** The sponsor's scandal breaks when the counter runs out. Returns the sponsor (1...5). */
export function sponsorScandalTick(s: GameState): number | null {
  if (s.sponsor === 0) return null;
  s.scandalCounter = (s.scandalCounter - 1) & 0xff;
  if (s.scandalCounter !== 0) return null;
  if (!s.config.faithfulBugs) s.scandalCounter = 20;
  halveFame(s);
  return s.sponsor;
}

export const bootlegEligible = (s: GameState) => !s.bootlegDone && (s.singleReleased || s.albumReleased) && s.fame >= 200;

export function startBootleg(s: GameState): void {
  s.bootlegDone = true;
  s.piracy = true;
}

/** Bootlegger menu choice. Returns the message id and the cost charged. */
export function resolveBootleg(s: GameState, choice: number): { message: number; cost: number } {
  let msg = 173;
  let cost = 0;
  switch (choice) {
    case 1:
      if (s.rng.rnd(2) === 2) {
        cost = (s.rng.rnd(3) + 1) * 100_000;
        msg = 174;
      } else {
        cost = (s.rng.rnd(8) + 1) * 10_000;
        msg = 175;
        s.piracy = false;
      }
      break;
    case 2:
      if (s.rng.rnd(2) === 2) {
        cost = (s.rng.rnd(8) + 1) * 10_000;
        msg = 177;
        s.piracy = false;
      } else {
        cost = (s.rng.rnd(8) + 1) * 10_000;
        msg = 176;
      }
      break;
    case 3:
      cost = (s.rng.rnd(3) + 1) * 100_000;
      msg = 172;
      // Faithful: "THAT'S STOPPED THEM" but piracy stays active.
      if (!s.config.faithfulBugs) s.piracy = false;
      break;
    default:
      break;
  }
  if (cost > 0) charge(s, cost);
  return { message: msg, cost };
}
