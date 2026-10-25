// Playable slice: one band, one year, the player's actions. Each action calls
// the ported rules and returns a message for the log. Hiring, contracts, events
// and the ransom are not in the slice yet (see README "Status").

import { charge, dateText, wageBill } from "./calendar.ts";
import { type GameConfig } from "./config.ts";
import type { GameData } from "./data.ts";
import { ModHost, type Mod } from "./plugins.ts";
import * as R from "./records.ts";
import { SpectrumRNG } from "./rng.ts";
import { catalogFrom, gameDecided, newGame, type GameState } from "./state.ts";
import { stepDay } from "./turn.ts";

export type Result = { ok: true; message: string } | { ok: false; message: string };

/** Video options from the original's three director, location and feature tiers. */
export const VIDEOS = {
  none: { label: "No video (hype -2)" },
  budget: { label: "Budget video (£20k)", director: 3, location: 2, feature: 0 },
  proper: { label: "Proper video (£100k)", director: 2, location: 0, feature: 2 },
} as const;
export type VideoChoice = keyof typeof VIDEOS;

export const PROMO_COST = 5_000;

export const STUDIOS = ["Garage (£2k)", "Small studio (£5k)", "Studio (£10k)", "Big studio (£16k)", "Pro studio (£20k)", "Top studio (£50k)"];

export class Session {
  readonly state: GameState;
  readonly host: ModHost;
  /** Human-readable log, newest last. */
  readonly log: string[] = [];
  /** Royalty income credited so far this year (for the summary and tests). */
  royaltyTotal = 0;

  constructor(data: GameData, opts: { seed?: bigint; config?: Partial<GameConfig>; mods?: Mod[] } = {}) {
    const titleFor = (ref: number) => {
      const part = data.nameStrings[ref] as Array<{ t: string; v: string }> | undefined;
      return part?.[0]?.t === "text" ? part[0].v : "";
    };
    const catalog = catalogFrom(data, titleFor);
    // Slice default: easy money (£100k), until the band hiring and contracts are ported.
    this.state = newGame(new SpectrumRNG(data.rngTable, opts.seed ?? 1n), catalog, { difficulty: "easy", ...opts.config });
    // Slice band: four stars with fixed weekly wages (pounds).
    this.state.stars = 4;
    this.state.gone = [false, false, false, false];
    this.state.wages = [300, 250, 200, 150];
    // Slice shortcut: the band starts on contract tier 1. Contracts are not ported yet, and tier 0 pays no royalties.
    this.state.label = 1;
    R.bootCharts(this.state);
    this.host = new ModHost([
      {
        name: "session-log",
        setup: (api) => {
          api.on("wagesPaid", (p) => this.note(`Wages paid £${p.amount}. Cash £${p.cash}.`));
          api.on("careerYearStarted", (p) => this.note(`New year ${p.year}. ${p.retired.length} star(s) retired.`));
          api.on("gameEnded", (p) => this.note(`Game over: ${p.reason}.`));
        },
      },
      ...(opts.mods ?? []),
    ]);
    this.note(`Week of ${dateText(this.state)}. You have £${this.state.cash} and four stars.`);
  }

  get over(): boolean {
    return gameDecided(this.state);
  }

  private note(msg: string) {
    this.log.push(msg);
  }

  /** One day: calendar, wages on Friday, and the chart show and royalties on Sunday. */
  advanceDay(): void {
    const s = this.state;
    const outcome = stepDay(s, this.host);
    if (outcome === "sunday") {
      if (s.singleReleased || s.albumReleased) {
        for (const chart of R.runChartShow(s)) this.reportChart(chart);
      }
      const income = R.weeklyRoyalties(s);
      if (income > 0) {
        this.royaltyTotal += income;
        this.note(`Royalties £${income}. Cash £${s.cash}.`);
      }
    }
  }

  advanceDays(n: number): void {
    for (let i = 0; i < n && !this.over; i++) this.advanceDay();
  }

  private reportChart(chart: R.ChartTable) {
    const name = chart.albums ? "Albums" : "Singles";
    const pos = chart.albums ? this.state.albumPos : this.state.singlePos;
    this.note(`${name} chart: ${pos > 0 && pos <= 10 ? `you are at #${pos}` : "you are outside the top ten"}.`);
  }

  /** Record ten tracks at studio `studio`. Takes days per track; a dial accident can wipe the tracks once. */
  recordAlbum(studio: number, albumName: string): Result {
    const s = this.state;
    if (this.over) return fail("The game is over.");
    if (s.albumInCan) return fail("The album is already in the can.");
    if (s.cash < R.STUDIO_COST[studio]) return fail("You cannot afford that studio.");
    R.startRecording(s, studio);
    this.note(`Recording at ${STUDIOS[studio]}. ${s.daysPerTrack} days a track.`);
    let guard = 0;
    while (s.tracksCut < 10 && !this.over && guard++ < 200) {
      this.advanceDays(s.daysPerTrack);
      if (this.over) break;
      s.trackNames[s.tracksCut] = `Track ${s.tracksCut + 1}`;
      s.tracksCut += 1;
      if (R.dialAccident(s)) {
        this.note("The dial accident wiped the last track. Recording the tracks again.");
        s.tracksCut = 0;
      }
    }
    if (this.over) return fail("The game ended during recording.");
    R.finishRecording(s);
    this.note(`The album "${albumName}" is in the can. Hype and skill went up.`);
    s.albumName = albumName;
    return { ok: true, message: "Album recorded." };
  }

  /** Release a single from track `track` (0...9) with a video choice. */
  releaseSingle(track: number, video: VideoChoice): Result {
    const s = this.state;
    if (this.over) return fail("The game is over.");
    if (track < 0 || track > 9 || !s.trackNames[track]) return fail("Record that track first.");
    if (s.singleReleased && s.singleTrack === track) return fail("That track is already a single.");
    R.beginSingle(s, track);
    if (video === "none") {
      R.skipVideo(s);
    } else {
      const v = VIDEOS[video];
      const cost = R.makeVideo(s, v.director, v.location, v.feature);
      this.note(`Video made for £${cost}.`);
    }
    R.launchSingle(s);
    this.note(`"${s.trackNames[track]}" released as a single. Chart peak target #${s.singlePeak}.`);
    return { ok: true, message: "Single released." };
  }

  /** Release the album once it is in the can. */
  releaseAlbum(): Result {
    const s = this.state;
    if (this.over) return fail("The game is over.");
    if (!s.albumInCan) return fail("Record the album first.");
    if (s.albumReleased) return fail("The album is already out.");
    R.releaseAlbum(s, s.albumName || "Untitled");
    this.note(`Album "${s.albumName || "Untitled"}" released.`);
    return { ok: true, message: "Album released." };
  }

  /** Promo push (remake lever, not in the original): £5k for +1 hype. Hype 5+ speeds chart climbs. */
  promote(): Result {
    const s = this.state;
    if (this.over) return fail("The game is over.");
    if (s.cash < PROMO_COST) return fail(`A promo push costs £${PROMO_COST}.`);
    charge(s, PROMO_COST);
    R.hypeUp(s);
    this.note(`Promo push. Hype is now ${s.hype}.`);
    return { ok: true, message: `Promo push done. Hype ${s.hype}.` };
  }

  /** Charge a fee outside the rules (for the cheat menu and tests). */
  pay(amount: number): void {
    charge(this.state, amount);
  }

  /** Wages for the current week, for the summary panel. */
  weeklyWages(): number {
    return wageBill(this.state);
  }
}

function fail(message: string): Result {
  return { ok: false, message };
}
