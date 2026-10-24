// Port of Rules+Core.swift §5 (calendar), §1 (money) and the career year
// roll-over from Career.swift. Pure functions over GameState; no UI.

import { type GameState, type DayOutcome, CASH_CAP, MONTH_LENGTHS, DAY_NAMES, MONTH_NAMES, gameDecided } from "./state.ts";
import { difficulty } from "./config.ts";

/** $6F3B: one day passes. The caller handles wages (Friday) and Sunday. */
export function advanceDay(s: GameState): DayOutcome {
  if (gameDecided(s)) return "none";
  s.dayOfWeek = (s.dayOfWeek + 1) % 7;
  if (s.dayOfMonth === MONTH_LENGTHS[s.month]) {
    s.month += 1;
    if (s.month === 12 && s.config.career) {
      s.month = 0;
      s.week = 0;
      s.dayOfMonth = 1;
      s.salesHistory.fill(0);
      return "newYear";
    }
    if (s.month === 12) {
      if (!s.config.sandbox) {
        s.yearOver = true;
        return "none";
      }
      s.month = 0;
      s.week = 0;
      s.salesHistory.fill(0);
    }
    s.dayOfMonth = 1;
  } else {
    s.dayOfMonth += 1;
  }
  switch (s.dayOfWeek) {
    case 4:
      return "wages";
    case 6:
      return "sunday";
    default:
      return "quiet";
  }
}

/**
 * Weekly wage bill ($6FA6). With faithfulBugs on, the original pays the first
 * `stars` slots rather than the slots still in the band (see README "Known bugs").
 */
export function wageBill(s: GameState): number {
  const slots = s.config.faithfulBugs
    ? [...Array(s.stars).keys()]
    : [0, 1, 2, 3].filter((i) => !s.gone[i]);
  return slots.reduce((sum, i) => sum + s.wages[i], 0);
}

/** Friday wages after message 44. Returns the amount charged. */
export function payWages(s: GameState): number {
  const bill = Math.floor((wageBill(s) * difficulty.wagePercent(s.config.difficulty)) / 100);
  if (!s.bankrupt) charge(s, bill); // $63EC skips when already bankrupt
  return bill;
}

/** $635D / $636A: credit, capped at 99,999,999. The original wraps; see README. */
export function credit(s: GameState, amount: number): void {
  s.cash = Math.min(s.cash + amount, CASH_CAP);
}

/**
 * $63F8: overdrawing sets BANKRUPT (unless sandbox) and zeroes cash. The
 * purchase still happens.
 */
export function charge(s: GameState, amount: number): void {
  if (amount > s.cash) {
    s.bankrupt = !s.config.sandbox;
    s.cash = 0;
  } else {
    s.cash -= amount;
  }
}

export function dateText(s: GameState): string {
  const day = String(s.dayOfMonth).padStart(2, "0");
  return `${DAY_NAMES[s.dayOfWeek]} ${day} ${MONTH_NAMES[Math.min(s.month, 11)]}`;
}
