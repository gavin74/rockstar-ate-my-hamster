// Port of band formation (Rules+Core.swift §2, formBand and acceptStar) and
// equipment and record contracts (§7.2, §8.1). The star stats here come from
// whatever roster the caller passes in; the remake roster is the next step.

import { charge, credit } from "./calendar.ts";
import { type GameState } from "./state.ts";
import { fameUp, hypeUp } from "./records.ts";

/** One star's stats as the tape record stores them: 10 bytes. */
export interface StarStats {
  name: string;
  /** [0] portrait, [1] voice, [2] ability, [3] mood, [4] instrument kind, [5..8] wage digits */
  stats: number[];
}

/** Weekly wage from the stat digits, $6... as in `GameState.wage(of:)`. */
export function starWage(stats: number[]): number {
  return 10 * (1000 * stats[5] + 100 * stats[6] + 10 * stats[7] + stats[8]);
}

/** `acceptStar`: copy a star into a slot (portrait, voice, ability, mood, kind, wage). */
export function acceptStar(s: GameState, star: StarStats, slot: number): void {
  const st = star.stats;
  s.starNames[slot] = star.name;
  s.image[slot] = st[0];
  s.imageBak[slot] = st[0];
  s.voice[slot] = st[1];
  s.ability[slot] = st[2];
  s.abilityBak[slot] = st[2];
  s.mood[slot] = st[3];
  s.kind[slot] = st[4];
  s.wages[slot] = starWage(st);
}

/** `formBand` (§2.2): set slot status, copy portraits for small bands, derive SKILL and FAME. */
export function formBand(s: GameState): void {
  s.gone = [true, true, true, true];
  s.stars = s.hiredCount;
  for (let i = 0; i < s.stars; i++) s.gone[i] = false;
  s.hype = 0;
  const n = s.stars;
  let bonus = 0;
  switch (n) {
    case 1:
      s.bandName = s.starNames[0];
      for (let i = 1; i <= 3; i++) {
        s.image[i] = s.image[0];
        s.ability[i] = s.ability[0];
        s.voice[i] = s.voice[0];
        s.kind[i] = s.kind[0];
      }
      break;
    case 2:
      s.image[2] = s.image[0];
      s.image[3] = s.image[1];
      s.voice[2] = s.voice[0];
      s.kind[2] = s.kind[0];
      if (!s.config.faithfulBugs) {
        s.ability[2] = s.ability[0];
        s.ability[3] = s.ability[1];
      }
      bonus = 40;
      break;
    case 3:
      s.image[3] = s.image[0];
      s.ability[3] = s.ability[2];
      bonus = 60;
      break;
    default:
      bonus = 80;
  }
  // $6609 sums five bytes, with slot 0's backup counted twice. Sums are 8-bit.
  const skillSum = (s.ability.reduce((a, b) => a + b, 0) + s.abilityBak[0]) & 0xff;
  const fameSum = (s.image.reduce((a, b) => a + b, 0) + s.imageBak[0] + bonus) & 0xff;
  s.skill = skillSum >> 2;
  s.fame = fameSum >> 2;
  s.bandVoice = (s.kind[0] & 0x80) !== 0 ? s.voice[2] & 7 : s.voice[0] & 7;
}

/** Unit prices (new, second hand, dodgy) by instrument class bits of the kind byte. */
export function gearUnitPrices(kind: number): number[] {
  if ((kind & 0x80) !== 0) return [500, 300, 200];
  if ((kind & 0x40) !== 0) return [1000, 600, 400];
  if ((kind & 0x20) !== 0) return [300, 200, 100];
  return [1000, 700, 300];
}

/** NUM0/1/2 prices for the current band: units times unit price, per quality. */
export function gearCosts(s: GameState): number[] {
  const t = [0, 0, 0];
  for (let i = 0; i < s.stars; i++) {
    const units = s.kind[i] & 7;
    const p = gearUnitPrices(s.kind[i]);
    for (let q = 0; q < 3; q++) t[q] += units * p[q];
  }
  return t;
}

export function buyEquipment(s: GameState, quality: number): number {
  s.equipment = quality;
  const cost = gearCosts(s)[quality];
  charge(s, cost);
  return cost;
}

// MARK: record contracts

export const CONTRACT_ADVANCE = [0, 5_000, 10_000, 20_000, 30_000, 50_000];
export const LABEL_NAMES = ["", "FLOPPY DISCS", "ROUGH RECORDS", "S+M RECORDS", "PHONEYGRAM RECORDS", "MEGA BIG RECORDS"];

/** `$6758`: the tier offered this turn, if any. Marks the offer as made and provisionally signs. */
export function contractOffer(s: GameState): number | null {
  if (s.label !== 0 || s.skill < 60 || s.fame < 40) return null;
  let tier: number;
  if (s.fame < 70) tier = 1;
  else if (s.fame < 110) tier = 2;
  else if (s.fame < 160) tier = 3;
  else if (s.fame < 250) tier = 4;
  else tier = 5;
  if (s.offerMade[tier]) return null;
  s.offerMade[tier] = true;
  s.label = tier;
  return tier;
}

export function answerContract(s: GameState, accept: boolean): void {
  if (accept) {
    fameUp(s);
    hypeUp(s);
    credit(s, CONTRACT_ADVANCE[s.label]);
  } else {
    s.label = 0;
  }
}
