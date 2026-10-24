// Port of Sources/RockStar/Model/Career.swift. Career mode is not in the original.

import type { GameState } from "./state.ts";

/** Chance (percent) that a star retires at the end of career year `year`. */
export function retireChance(year: number): number {
  return Math.min(10 * (year - 1), 50);
}

/**
 * 1 January in career mode: count a platinum year, reset the year's records,
 * raise wages 10%, and let some stars retire. `roll(100)` must return 0..99.
 * Returns the slots of the stars who retired.
 */
export function startNewCareerYear(
  s: GameState,
  roll: (n: number) => number = (n) => Math.floor(Math.random() * n),
): number[] {
  if (s.discs[3]) s.config.platinums += 1;
  s.config.careerYear += 1;
  s.discs = [false, false, false, false];
  s.albumReleased = false;
  s.singleReleased = false;
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
