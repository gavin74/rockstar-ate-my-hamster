// Port of Rules+Events.swift §disasters and gigs (rules_core §6.5, rules_gigs §2 and §3).
// Mood checks, demands, ultimatums, headlines and sponsors are not ported yet.

import { charge, credit } from "./calendar.ts";
import { fameDown, fameUp, hypeUp, skillUp, hypeDown } from "./records.ts";
import { type GameState } from "./state.ts";

export const PRACTICE_COST_PER_DAY = 100;
export const VENUE_SEATS = [200, 500, 1_500, 4_000, 10_000];
export const VENUE_HIRE = [10, 1_000, 2_800, 7_000, 16_500];
export const VENUE_NAMES = ["Pub", "Club", "University", "Concert hall", "Stadium"];
export const TICKET_PRICES = [2, 5, 10, 15, 20];
export const DEMAND_PER_FAME = [9, 6, 4, 2, 1];

export type Disaster =
  | { kind: "sued" }
  | { kind: "taxman" }
  | { kind: "equipmentLost"; quality: number };

/** Practice: £100 a day up front, then one practice day at a time. */
export function startPractice(s: GameState, days: number): boolean {
  if (!s.bankrupt) charge(s, PRACTICE_COST_PER_DAY * days);
  return !s.bankrupt;
}

export function practiceDay(s: GameState): void {
  skillUp(s);
  hypeDown(s);
  s.rng.reseed();
}

/** `$7260`: at most one disaster per check, each only once a game. */
export function disasterCheck(s: GameState): Disaster | null {
  if (!s.discs[0] || s.cash < 1_000_000) return null;
  if ((s.oneShot & 1) === 0 && s.rng.rnd(4) === 3 && s.discs[1]) {
    s.oneShot |= 1;
    charge(s, 1_000_000);
    return { kind: "sued" };
  }
  if ((s.oneShot & 2) === 0 && s.rng.rnd(1) === 1 && s.discs[2]) {
    s.oneShot |= 2;
    charge(s, 1_000_000);
    return { kind: "taxman" };
  }
  if ((s.oneShot & 4) === 0) {
    s.oneShot |= 4;
    return { kind: "equipmentLost", quality: s.equipment };
  }
  return null;
}

/** `$6D06`: tickets = min(fame * 10 * demand, seats); takings = tickets * price. */
export function ticketSales(fame: number, venue: number, price: number): { tickets: number; takings: number } {
  const tickets = Math.min(fame * 10 * DEMAND_PER_FAME[price], VENUE_SEATS[venue]);
  return { tickets, takings: tickets * TICKET_PRICES[price] };
}

/** Pay venue hire for the whole tour. Returns false if that bankrupted the band. */
export function startTour(s: GameState, venue: number, nights: number): boolean {
  if (!s.bankrupt) charge(s, VENUE_HIRE[venue] * nights);
  if (s.bankrupt) return false;
  s.firstNight = true;
  if (s.sponsor !== 0) {
    fameDown(s);
    fameDown(s);
  }
  return true;
}

/** One show: takings, skill +10, hype +1, fame up if skill is 70 or more, else down. */
export function playGig(s: GameState, venue: number, price: number): { tickets: number; takings: number } {
  const r = ticketSales(s.fame, venue, price);
  credit(s, r.takings);
  skillUp(s);
  hypeUp(s);
  if (s.skill >= 70) fameUp(s);
  else fameDown(s);
  return r;
}
