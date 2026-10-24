// Port of GameConfig and Difficulty (Sources/RockStar/Model/GameState.swift).

export type Difficulty = "easy" | "normal" | "hard";

const STARTING_CASH: Record<Difficulty, number> = { easy: 100_000, normal: 50_000, hard: 25_000 };
const WAGE_PERCENT: Record<Difficulty, number> = { easy: 50, normal: 100, hard: 150 };
const ROYALTY_PERCENT: Record<Difficulty, number> = { easy: 150, normal: 100, hard: 75 };
const DISC_THRESHOLDS: Record<Difficulty, number[]> = {
  easy: [25, 60, 100, 150],
  normal: [40, 100, 170, 250],
  hard: [40, 100, 170, 250],
};

export interface GameConfig {
  /** Reproduce behaviour the notes flag as probable bugs in the original. */
  faithfulBugs: boolean;
  /** Cheat menu: no bankruptcy, no year end; calendar rolls into a new year. */
  sandbox: boolean;
  /** Not in the original. */
  difficulty: Difficulty;
  /** Not in the original: the year rolls over, stars age and retire. */
  career: boolean;
  careerYear: number;
  platinums: number;
  careerRetired: boolean;
}

export function defaultConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    faithfulBugs: true,
    sandbox: false,
    difficulty: "normal",
    career: false,
    careerYear: 1,
    platinums: 0,
    careerRetired: false,
    ...overrides,
  };
}

export const difficulty = {
  startingCash: (d: Difficulty) => STARTING_CASH[d],
  wagePercent: (d: Difficulty) => WAGE_PERCENT[d],
  royaltyPercent: (d: Difficulty) => ROYALTY_PERCENT[d],
  discThresholds: (d: Difficulty) => DISC_THRESHOLDS[d],
};
