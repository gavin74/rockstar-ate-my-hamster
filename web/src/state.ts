// Subset of Sources/RockStar/Model/GameState.swift: money, calendar, band
// headcount and career fields. Rules that depend on charts, recording or events
// are not ported yet (see web/README.md, "Status").

import { type GameConfig, defaultConfig, difficulty } from "./config.ts";
import type { SpectrumRNG } from "./rng.ts";

export const CASH_CAP = 99_999_999;
export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
export const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

export interface GameState {
  config: GameConfig;
  rng: SpectrumRNG;
  /** $618D cash in pounds */
  cash: number;
  /** $BEE6 */
  bankrupt: boolean;
  /** $BEDD 0 = MON ... 6 = SUN */
  dayOfWeek: number;
  /** $C685 */
  dayOfMonth: number;
  /** $BEDC 0 = JAN */
  month: number;
  /** $BEDB chart week counter */
  week: number;
  /** $BEDE */
  yearOver: boolean;
  /** $614F weekly sales bars */
  salesHistory: number[];
  /** $BF24 stars still in the band */
  stars: number;
  /** $619D bit7 per slot: true = empty / fired / quit / dead */
  gone: boolean[];
  /** $613F weekly wage per slot in pounds */
  wages: number[];
  /** $BED6...$BED9; discs[3] = platinum = WIN */
  discs: boolean[];
  /** $BEEF */
  albumReleased: boolean;
  singleReleased: boolean;
  /** $BEBC bit0 sued */
  oneShot: number;
}

/** Calendar outcome of one day advance; the caller resolves wages and Sunday. */
export type DayOutcome = "none" | "quiet" | "wages" | "sunday" | "newYear";

export function newGame(rng: SpectrumRNG, config: Partial<GameConfig> = {}): GameState {
  const cfg = defaultConfig(config);
  return {
    config: cfg,
    rng,
    cash: difficulty.startingCash(cfg.difficulty),
    bankrupt: false,
    dayOfWeek: 0,
    dayOfMonth: 1,
    month: 0,
    week: 0,
    yearOver: false,
    salesHistory: new Array(52).fill(0),
    stars: 0,
    gone: [true, true, true, true],
    wages: [0, 0, 0, 0],
    discs: [false, false, false, false],
    albumReleased: false,
    singleReleased: false,
    oneShot: 0,
  };
}

export function gameDecided(s: GameState): boolean {
  const won = s.discs[3];
  return s.bankrupt || s.stars === 0 || (won && !s.config.career) || s.yearOver || s.config.careerRetired;
}
