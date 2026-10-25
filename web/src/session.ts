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
import { LABEL_NAMES } from "./band.ts";
import { stepDay } from "./turn.ts";
import { acceptStar, answerContract, buyEquipment, contractOffer, formBand, gearCosts, type StarStats } from "./band.ts";
import { VENUE_NAMES, TICKET_PRICES, startPractice, practiceDay, startTour, playGig, disasterCheck, type Disaster } from "./gigs.ts";
import * as E from "./events.ts";
import { HEADLINES } from "./headlines.ts";

export type Result = { ok: true; message: string } | { ok: false; message: string };

/** Video options from the original's three director, location and feature tiers. */
export const VIDEOS = {
  none: { label: "No video (hype -2)" },
  budget: { label: "Budget video (£20k)", director: 3, location: 2, feature: 0 },
  proper: { label: "Proper video (£100k)", director: 2, location: 0, feature: 2 },
} as const;
export type VideoChoice = keyof typeof VIDEOS;

export const PROMO_COST = 5_000;

/**
 * Slice band: four invented stars (not the original roster). Stats are
 * [portrait, voice, ability, mood, kind, wage digits 5...8]. Together they give
 * skill 62 and fame 50, enough for a tier 1 record offer.
 */
export const SLICE_BAND: StarStats[] = [
  { name: "Dana Vox", stats: [30, 1, 50, 60, 0x20 | 2, 0, 0, 3, 0] },
  { name: "Sol Reed", stats: [20, 2, 50, 60, 0x40 | 1, 0, 0, 2, 5] },
  { name: "Ines Kade", stats: [20, 3, 50, 60, 0x80 | 2, 0, 0, 2, 0] },
  { name: "Tom Brisk", stats: [20, 4, 50, 60, 1, 0, 0, 1, 5] },
];

export const LABEL_NAMES_UI = LABEL_NAMES;
export const VENUE_NAMES_UI = VENUE_NAMES;
export const SPONSOR_NAMES_UI = E.SPONSOR_NAMES;
export const TICKET_PRICES_UI = TICKET_PRICES;

export const STUDIOS = ["Garage (£2k)", "Small studio (£5k)", "Studio (£10k)", "Big studio (£16k)", "Pro studio (£20k)", "Top studio (£50k)"];

export type RosterStar = StarStats;

export class Session {
  readonly state: GameState;
  readonly host: ModHost;
  /** Human-readable log, newest last. */
  readonly log: string[] = [];
  /** Royalty income credited so far this year (for the summary and tests). */
  royaltyTotal = 0;
  /** A record offer waiting for an answer (tier 1...5). */
  pendingOffer: number | null = null;
  /** Prompts waiting for an answer. */
  pendingSponsor: number | null = null;
  pendingCharity = false;
  pendingBootleg = false;
  /** A demand or ultimatum from a star, waiting for pay or refuse. */
  pendingMood: { kind: "demand" | "ultimatum"; slot: number; cost: number } | null = null;
  /** Kit was lost; the band must buy kit again. */
  pendingRebuy = false;
  /** Whether a tour is running (for the page). */
  get touring(): boolean {
    return this.tourLeft !== null;
  }

  /** The tour in progress, if any. */
  private tourLeft: { venue: number; price: number; night: number; nights: number } | null = null;

  constructor(data: GameData, opts: { seed?: bigint; config?: Partial<GameConfig>; mods?: Mod[]; band?: StarStats[] } = {}) {
    const titleFor = (ref: number) => {
      const part = data.nameStrings[ref] as Array<{ t: string; v: string }> | undefined;
      return part?.[0]?.t === "text" ? part[0].v : "";
    };
    const catalog = catalogFrom(data, titleFor);
    // Slice default: easy money (£100k), until the band hiring and contracts are ported.
    this.state = newGame(new SpectrumRNG(data.rngTable, opts.seed ?? 1n), catalog, { difficulty: "easy", ...opts.config });
    // The band is hired from the roster (1 to 4 stars) and formed as in the original.
    const band = opts.band ?? SLICE_BAND;
    if (band.length < 1 || band.length > 4) throw new Error("a band has 1 to 4 stars");
    this.state.hiredCount = band.length;
    band.forEach((star, slot) => acceptStar(this.state, star, slot));
    formBand(this.state);
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
      const tier = contractOffer(s);
      if (tier !== null) {
        this.pendingOffer = tier;
        this.note(`A record label offers a tier ${tier} contract (${LABEL_NAMES[tier]}). Accept or decline.`);
      }
      this.periodicEvents();
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

  /** Sunday's periodic checks: charity, bootleggers, sponsors, scandals and pull-outs. */
  private periodicEvents(): void {
    const s = this.state;
    const due = E.tickEventCounter(s);
    if (due === "charity" && E.charityEligible(s)) {
      this.pendingCharity = true;
      this.note("A charity asks the band to play for free. Accept or decline.");
    }
    if (due === "bootleg" && E.bootlegEligible(s)) {
      E.startBootleg(s);
      this.pendingBootleg = true;
      this.note(HEADLINES.bootlegs + " Choose a response.");
    }
    if (this.pendingSponsor === null && s.sponsor === 0) {
      const c = E.sponsorOffer(s);
      if (c !== null) {
        this.pendingSponsor = c;
        this.note(`${E.SPONSOR_NAMES[c]} offers a sponsorship. Accept or decline.`);
      }
    }
    const scandal = E.sponsorScandalTick(s);
    if (scandal !== null) this.note(HEADLINES.scandal);
    if (E.sponsorPullOutDue(s)) {
      E.sponsorPullOut(s);
      this.note("The sponsor pulled out and charged £100,000.");
    }
  }

  /** Accept or decline a sponsorship offer. */
  answerSponsorOffer(accept: boolean): Result {
    if (this.pendingSponsor === null) return fail("No sponsor is waiting.");
    E.answerSponsor(this.state, accept);
    this.note(accept ? `Sponsored by ${E.SPONSOR_NAMES[this.pendingSponsor]}. £100,000 paid.` : "Sponsor declined.");
    this.pendingSponsor = null;
    return { ok: true, message: accept ? "Sponsorship signed." : "Sponsor declined." };
  }

  /** Accept or decline the charity. A real charity raises hype and fame; a fake one can end in a bad press story. */
  answerCharityOffer(accept: boolean): Result {
    if (!this.pendingCharity) return fail("No charity is waiting.");
    const r = E.answerCharity(this.state, accept);
    this.pendingCharity = false;
    this.note(r.real ? HEADLINES.charityGenuine : HEADLINES.charityScam);
    if (r.headline !== null) this.note(r.headline === 193 ? HEADLINES.badPressCharity : HEADLINES.charityScam);
    return { ok: true, message: "Charity answered." };
  }

  /** Bootleggers: 1 sue, 2 raid, 3 pay them off, 0 ignore. */
  answerBootleg(choice: number): Result {
    if (!this.pendingBootleg) return fail("No bootleg is waiting.");
    const r = E.resolveBootleg(this.state, choice);
    this.pendingBootleg = false;
    const plan = ["ignored them", "sued", "raided them", "paid them off"][choice] ?? "dealt with them";
    this.note(`The band ${plan}. Cost £${r.cost}.`);
    return { ok: true, message: `Bootleg dealt with. Cost £${r.cost}.` };
  }

  /** A publicity stunt. The story is logged and may hurt a star. */
  publicity(): Result {
    if (this.over) return fail("The game is over.");
    const r = E.publicityStunt(this.state);
    this.note(r.kind === "nobodyCares" ? HEADLINES.publicityNobody : r.died ? HEADLINES.publicityDeath : HEADLINES.publicityStory);
    return { ok: true, message: "Publicity done." };
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

  /** Accept or decline the pending record offer. */
  answerOffer(accept: boolean): Result {
    if (this.pendingOffer === null) return fail("No offer is waiting.");
    const tier = this.pendingOffer;
    answerContract(this.state, accept);
    this.pendingOffer = null;
    this.note(accept ? `Signed to ${LABEL_NAMES[tier]}. Advance paid.` : `Declined ${LABEL_NAMES[tier]}.`);
    return { ok: true, message: accept ? "Contract signed." : "Offer declined." };
  }

  /** Buy equipment at quality 0 (new), 1 (second hand) or 2 (dodgy). */
  buyGear(quality: number): Result {
    if (this.over) return fail("The game is over.");
    const cost = gearCosts(this.state)[quality];
    if (this.state.cash < cost) return fail(`That kit costs £${cost}.`);
    buyEquipment(this.state, quality);
    this.pendingRebuy = false;
    this.note(`Bought equipment for £${cost}.`);
    return { ok: true, message: `Equipment bought for £${cost}.` };
  }

  /** Practise for `days` days (£100 a day). Each day raises skill and lowers hype. */
  practice(days: number): Result {
    const s = this.state;
    if (this.over) return fail("The game is over.");
    if (!startPractice(s, days)) return fail("The band cannot pay for practice.");
    for (let i = 0; i < days; i++) practiceDay(s);
    this.note(`Practised for ${days} days.`);
    this.advanceDays(days);
    return { ok: true, message: `Practised for ${days} days.` };
  }

  /** Tour: pay the venue for `nights`. Then call playNight() for each night. */
  beginTour(venue: number, price: number, nights: number): Result {
    const s = this.state;
    if (this.over) return fail("The game is over.");
    if (this.tourLeft) return fail("A tour is already running.");
    if (!startTour(s, venue, nights)) return fail("The band cannot pay the venue hire.");
    this.tourLeft = { venue, price, night: 0, nights };
    this.note(`Touring: ${VENUE_NAMES[venue]}, tickets £${TICKET_PRICES[price]}, ${nights} nights.`);
    return { ok: true, message: "Tour started." };
  }

  /** Play one night. Stops for a demand or ultimatum until it is answered. */
  playNight(): Result {
    const t = this.tourLeft;
    if (!t) return fail("No tour is running.");
    if (this.pendingMood) return fail("Answer the star first.");
    const s = this.state;
    t.night += 1;
    this.moodCheck();
    if (this.pendingMood || this.over) return { ok: true, message: "A star is waiting for an answer." };
    const disaster = disasterCheck(s);
    if (disaster) this.reportDisaster(disaster);
    const r = playGig(s, t.venue, t.price);
    this.note(`Night ${t.night}: ${r.tickets} sold, £${r.takings} taken. Cash £${s.cash}.`);
    this.advanceDay();
    if (t.night >= t.nights || this.over) this.tourLeft = null;
    return { ok: true, message: `Night ${t.night} played.` };
  }

  /** Answer a star's demand (pay) or ultimatum (pay keeps the star; refusing fires them). */
  answerMood(pay: boolean): Result {
    const m = this.pendingMood;
    if (!m) return fail("No star is waiting.");
    const s = this.state;
    if (m.kind === "demand") E.answerDemand(s, m.slot, m.cost, pay);
    else E.answerUltimatum(s, m.slot, m.cost, pay);
    this.note(`${s.starNames[m.slot]} ${pay ? "was paid off" : "was refused"} (£${m.cost}).`);
    this.pendingMood = null;
    return { ok: true, message: pay ? "Paid." : "Refused." };
  }

  /** Tour in one call: every night played, with demands paid when affordable. */
  tour(venue: number, price: number, nights: number): Result {
    const started = this.beginTour(venue, price, nights);
    if (!started.ok) return started;
    while (this.tourLeft && !this.over) {
      const r = this.playNight();
      if (this.pendingMood) this.answerMood(this.state.cash >= this.pendingMood.cost);
      if (!r.ok) break;
    }
    return { ok: true, message: "Tour finished." };
  }

  /** The pre-show mood check. Demands and ultimatums are paid when the band can afford them, otherwise refused (the answer is shown in the log). */
  private moodCheck(): void {
    const s = this.state;
    const ev = E.moodCheck(s);
    if (ev.kind === "content") {
      if (ev.disaster) this.reportDisaster(ev.disaster);
      return;
    }
    if (ev.kind === "quits") {
      this.note(`${s.starNames[ev.slot]} quit the band. Fame halved.`);
    } else if (ev.kind === "demand" || ev.kind === "ultimatum") {
      this.pendingMood = { kind: ev.kind, slot: ev.slot, cost: ev.cost };
      this.note(`${HEADLINES.demand} ${s.starNames[ev.slot]} asks £${ev.cost} to stay happy.`);
    } else {
      const jailed = E.troubleHeadline(s);
      E.payStarBill(s, ev.slot, ev.cost);
      this.note(`${jailed ? HEADLINES.trouble.jailed : HEADLINES.trouble.wrecked} Bill £${ev.cost}.`);
    }
  }

  private reportDisaster(d: Disaster) {
    if (d.kind === "sued") this.note(HEADLINES.sued);
    else if (d.kind === "taxman") this.note(HEADLINES.taxman);
    else {
      this.pendingRebuy = true;
      this.note(HEADLINES.equipmentLost + " Buy kit again.");
    }
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
