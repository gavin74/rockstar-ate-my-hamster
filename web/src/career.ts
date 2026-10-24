// Port of Sources/RockStar/Model/Career.swift. Career mode is not in the original.

import { type GameState } from "./state.ts";

/** Chance (percent) that a star retires at the end of career year `year`. */
export function retireChance(year: number): number {
  return Math.min(10 * (year - 1), 50);
}

/**
 * 1 January in career mode: count a platinum year, start a fresh year of records
 * (same label), raise wages 10%, and let some stars retire. `roll(100)` must
 * return 0..99. Returns the slots of the stars who retired.
 */
export function startNewCareerYear(
  s: GameState,
  roll: (n: number) => number = (n) => Math.floor(Math.random() * n),
): number[] {
  if (s.discs[3]) s.config.platinums += 1;
  s.config.careerYear += 1;
  s.discs = [false, false, false, false];
  s.discPoints = 0;
  s.albumInCan = false;
  s.albumReleased = false;
  s.singleReleased = false;
  s.tracksCut = 0;
  s.dialAccidentDone = false;
  s.singleTrack = 0;
  s.videoScore = 0;
  s.releasedTracks = new Array(10).fill(false);
  s.trackNames = new Array(10).fill("");
  s.albumName = "";
  s.singlePos = 0;
  s.albumPos = 0;
  s.singlePeak = 0;
  s.climbWeeks = 0;
  s.piracy = false;
  s.bootlegDone = false;
  const retired: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (s.gone[i]) continue;
    s.wages[i] = Math.floor((s.wages[i] * 11) / 10);
    if (roll(100) < retireChance(s.config.careerYear)) {
      s.gone[i] = true;
      s.stars -= 1;
      retired.push(i);
    }
  }
  return retired;
}
