// Mod/plugin host. A mod is an object with a name and a setup() function that
// subscribes to hooks. Hooks are observers: they receive a read-only snapshot
// of what happened and cannot change the rule outcome. Rule-changing extension
// points will be added deliberately, not by accident.

import type { DayOutcome, GameState } from "./state.ts";

export interface HookPayloads {
  /** After every day advance, before wages or Sunday are handled. */
  dayAdvanced: { outcome: DayOutcome; day: number; month: number; dayOfWeek: number };
  /** After Friday wages are charged. */
  wagesPaid: { amount: number; cash: number };
  /** After a career-mode 1 January roll-over. */
  careerYearStarted: { year: number; retired: number[] };
  /** When the game is decided (bankrupt, no stars, year over, won). */
  gameEnded: { reason: "bankrupt" | "noStars" | "yearOver" | "platinum" | "careerRetired" };
}

export type HookName = keyof HookPayloads;

export interface ModApi {
  on<K extends HookName>(hook: K, handler: (payload: HookPayloads[K], state: Readonly<GameState>) => void): void;
}

export interface Mod {
  name: string;
  setup(api: ModApi): void;
}

export class ModHost {
  private handlers: { [K in HookName]?: Array<(p: unknown, s: Readonly<GameState>) => void> } = {};
  readonly loaded: string[] = [];

  constructor(mods: Mod[] = []) {
    for (const mod of mods) this.load(mod);
  }

  load(mod: Mod): void {
    if (this.loaded.includes(mod.name)) throw new Error(`mod already loaded: ${mod.name}`);
    const api: ModApi = {
      on: (hook, handler) => {
        (this.handlers[hook] ??= []).push(handler as (p: unknown, s: Readonly<GameState>) => void);
      },
    };
    mod.setup(api);
    this.loaded.push(mod.name);
  }

  emit<K extends HookName>(hook: K, payload: HookPayloads[K], state: Readonly<GameState>): void {
    for (const h of this.handlers[hook] ?? []) h(payload, state);
  }
}
