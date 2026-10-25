// Port of the GameState fields from Sources/RockStar/Model/GameState.swift.
// Band hiring, contracts, events and text expansion are still to port, so their
// fields are missing here (see web/README.md, "Status").

import { type GameConfig, defaultConfig } from "./config.ts";
import type { GameData, RivalData } from "./data.ts";
import type { SpectrumRNG } from "./rng.ts";

export const CASH_CAP = 99_999_999;
export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
export const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

/** Rule tables from gamedata.json, plus the title lookup for rival songs. */
export interface Catalog {
  rivals: RivalData[];
  respawnScores: number[];
  respawnStart: number;
  videoRankTable: number[];
  fameRankTable: number[];
  studioDays: number[];
  royaltyPercent: number[];
  /** Expands name-string reference `ref` (0...57) to its text. Supplied by the text port. */
  titleFor: (ref: number) => string;
}

export function catalogFrom(data: GameData, titleFor: (ref: number) => string = () => ""): Catalog {
  return {
    rivals: data.rivals,
    respawnScores: data.respawnScores,
    respawnStart: data.respawnStart,
    videoRankTable: data.videoRankTable,
    fameRankTable: data.fameRankTable,
    studioDays: data.studioDays,
    royaltyPercent: data.royaltyPercent,
    titleFor,
  };
}

/** Five-byte chart entry: [counter|bit7 climbing, score, peak, respawn counter, after-peak counter]. */
export type RivalEntry = number[];

export interface GameState {
  catalog: Catalog;
  config: GameConfig;
  rng: SpectrumRNG;

  // money
  /** $618D cash in pounds */
  cash: number;
  /** $BEE6 */
  bankrupt: boolean;

  // calendar
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

  // band
  /** $BF25 stars chosen at the start of the band */
  hiredCount: number;
  /** $BF24 stars still in the band */
  stars: number;
  /** Per slot: portrait ($BEF7), voice ($BEFF), ability ($BF03), mood ($BF0B), instrument kind ($BF13) */
  image: number[];
  imageBak: number[];
  voice: number[];
  ability: number[];
  abilityBak: number[];
  mood: number[];
  kind: number[];
  /** $BF28 band name, $C558 star names */
  bandName: string;
  starNames: string[];
  /** $BEF2 first music voice */
  bandVoice: number;
  /** $BEB9 0 new, 1 second hand, 2 dodgy */
  equipment: number;
  /** $BEE9...$BEF0: offer already made, by tier 1...5 */
  offerMade: boolean[];
  /** $619D per slot: true = empty / fired / quit / dead */
  gone: boolean[];
  /** $613F weekly wage per slot in pounds */
  wages: number[];
  /** $BEF5 SKILL */
  skill: number;
  /** $BEF6 FAME */
  fame: number;
  /** $BF23 hype 0...15 */
  hype: number;

  // contract and money events
  /** $BEE8 0 none, 1...5 */
  label: number;
  /** $BEC0-ish one-shot bits: b0 sued, b1 taxman, b2 equipment, b3 producer ransom */
  oneShot: number;
  /** $BEB3 "first night of the tour" */
  firstNight: boolean;
  /** $BEBB sponsor 0 none, 1...5 (sponsor rules not ported yet) */
  sponsor: number;

  // recording
  /** $BED4 */
  albumInCan: boolean;
  /** $BEC4 */
  albumReleased: boolean;
  singleReleased: boolean;
  /** STR1...STR10 */
  trackNames: string[];
  albumName: string;
  /** $BED1 */
  tracksCut: number;
  /** $BED2 */
  daysPerTrack: number;
  /** $BEF1 */
  skillAtRecording: number;
  /** $BEB8 bit0 */
  dialAccidentDone: boolean;
  /** $6183 track released as single */
  releasedTracks: boolean[];
  /** $BECD */
  singleTrack: number;
  /** $BEE7 */
  videoScore: number;
  /** $BED0 */
  piracy: boolean;
  /** $BECF */
  bootlegDone: boolean;

  // charts
  /** $BEED: 0 never released, 1...10 top ten, >10 outside */
  singlePos: number;
  /** $BEEE */
  albumPos: number;
  /** $BEC5 best position the single can reach */
  singlePeak: number;
  /** $BEEF bit7 = falling */
  climbWeeks: number;
  rivalSingles: RivalEntry[];
  rivalAlbums: RivalEntry[];
  rivalSongTitles: string[];
  rivalAlbumTitles: string[];
  /** $C7FB */
  respawnIndex: number;
  /** $5FB8 / $5FD6: last week's rows (rival slot, 0xFE player, 0xFF empty) */
  lastWeekSingles: number[];
  lastWeekAlbums: number[];
  /** $BED5 cumulative album disc points */
  discPoints: number;
  /** $BED6...$BED9; discs[3] = platinum = WIN */
  discs: boolean[];
}

export type DayOutcome = "none" | "quiet" | "wages" | "sunday" | "newYear";

export function emptyBand(n = 4): boolean[] {
  return Array.from({ length: n }, () => true);
}

export function newGame(rng: SpectrumRNG, catalog: Catalog, config: Partial<GameConfig> = {}): GameState {
  const cfg = defaultConfig(config);
  return {
    catalog,
    config: cfg,
    rng,
    cash: [100_000, 50_000, 25_000][["easy", "normal", "hard"].indexOf(cfg.difficulty)],
    bankrupt: false,
    dayOfWeek: 0,
    dayOfMonth: 1,
    month: 0,
    week: 0,
    yearOver: false,
    salesHistory: new Array(52).fill(0),
    hiredCount: 0,
    bandName: "",
    starNames: ["", "", "", ""],
    stars: 0,
    image: [0, 0, 0, 0],
    imageBak: [0, 0, 0, 0],
    voice: [0, 0, 0, 0],
    ability: [0, 0, 9, 7],
    abilityBak: [0, 0, 9, 7],
    mood: [0, 0, 0, 0],
    kind: [0, 0, 0, 0],
    bandVoice: 0,
    equipment: 0,
    offerMade: [false, false, false, false, false, false],
    gone: emptyBand(),
    wages: [0, 0, 0, 0],
    skill: 0,
    fame: 0,
    hype: 0,
    label: 0,
    oneShot: 0,
    firstNight: false,
    sponsor: 0,
    albumInCan: false,
    albumReleased: false,
    singleReleased: false,
    trackNames: new Array(10).fill(""),
    albumName: "",
    tracksCut: 0,
    daysPerTrack: 0,
    skillAtRecording: 0,
    dialAccidentDone: false,
    releasedTracks: new Array(10).fill(false),
    singleTrack: 0,
    videoScore: 0,
    piracy: false,
    bootlegDone: false,
    singlePos: 0,
    albumPos: 0,
    singlePeak: 0,
    climbWeeks: 0,
    rivalSingles: catalog.rivals.map((r) => [...r.single]),
    rivalAlbums: catalog.rivals.map((r) => [...r.album]),
    rivalSongTitles: new Array(30).fill(""),
    rivalAlbumTitles: new Array(30).fill(""),
    respawnIndex: catalog.respawnStart,
    lastWeekSingles: new Array(10).fill(0xff),
    lastWeekAlbums: new Array(10).fill(0xff),
    discPoints: 0,
    discs: [false, false, false, false],
  };
}

export function gameDecided(s: GameState): boolean {
  const won = s.discs[3];
  return s.bankrupt || s.stars === 0 || (won && !s.config.career) || s.yearOver || s.config.careerRetired;
}
