// One calendar step with hooks. Chart show (Sunday with a release) and the
// royalty and event rules are not ported yet; see README "Status".

import { advanceDay, payWages, dateText } from "./calendar.ts";
import { startNewCareerYear } from "./career.ts";
import type { ModHost } from "./plugins.ts";
import { type GameState, gameDecided } from "./state.ts";

export function stepDay(s: GameState, host: ModHost): void {
  const before = gameDecided(s);
  const outcome = advanceDay(s);
  host.emit("dayAdvanced", { outcome, day: s.dayOfMonth, month: s.month, dayOfWeek: s.dayOfWeek }, s);
  if (outcome === "wages") {
    const amount = payWages(s);
    host.emit("wagesPaid", { amount, cash: s.cash }, s);
  } else if (outcome === "newYear") {
    const retired = startNewCareerYear(s);
    host.emit("careerYearStarted", { year: s.config.careerYear, retired }, s);
  }
  if (!before && gameDecided(s)) {
    const reason = s.bankrupt ? "bankrupt" : s.stars === 0 ? "noStars" : s.discs[3] ? "platinum" : s.config.careerRetired ? "careerRetired" : "yearOver";
    host.emit("gameEnded", { reason }, s);
  }
}

export { dateText };
