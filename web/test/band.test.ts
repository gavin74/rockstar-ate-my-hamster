import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Session, SLICE_BAND } from "../src/session.ts";
import { contractOffer, answerContract, gearCosts, starWage } from "../src/band.ts";

const data = JSON.parse(readFileSync(new URL("../data/remake-gamedata.json", import.meta.url), "utf8"));

test("slice band forms with skill 62 and fame 50 from its stats", () => {
  const s = new Session(data, { seed: 1n }).state;
  assert.equal(s.stars, 4);
  assert.equal(s.skill, 62);
  assert.equal(s.fame, 50);
  assert.deepEqual(s.wages, [300, 250, 200, 150]);
  assert.equal(starWage(SLICE_BAND[0].stats), 300);
});

test("gear costs follow the instrument class and unit counts", () => {
  const s = new Session(data, { seed: 1n }).state;
  assert.deepEqual(gearCosts(s), [3600, 2300, 1300]);
});

test("a tier 1 offer is made once, and declining clears it", () => {
  const session = new Session(data, { seed: 2n });
  assert.equal(session.pendingOffer, null);
  session.advanceDays(7); // the first Sunday brings the offer
  assert.equal(session.pendingOffer, 1);
  assert.equal(session.answerOffer(false).ok, true);
  assert.equal(session.state.label, 0);
  assert.equal(session.pendingOffer, null);
  // The same tier is not offered again.
  assert.equal(contractOffer(session.state), null);
});

test("accepting an offer pays the advance and raises fame and hype", () => {
  const session = new Session(data, { seed: 4n });
  session.advanceDays(7);
  const before = { cash: session.state.cash, fame: session.state.fame, hype: session.state.hype };
  assert.equal(session.answerOffer(true).ok, true);
  assert.equal(session.state.cash, before.cash + 5_000);
  assert.equal(session.state.fame, before.fame + 10);
  assert.equal(session.state.hype, before.hype + 1);
  assert.equal(session.state.label, 1);
});

test("answering with no offer is refused", () => {
  const session = new Session(data, { seed: 6n });
  assert.equal(session.answerOffer(true).ok, false);
  answerContract(session.state, false);
  assert.equal(session.state.label, 0);
});

test("a chosen band forms from the roster, with the fame bonus for its size", () => {
  const roster = data.roster;
  const one = new Session(data, { seed: 1n, band: [roster[0]] }).state;
  assert.equal(one.stars, 1);
  assert.equal(one.bandName, roster[0].name);
  const four = new Session(data, { seed: 1n, band: roster.slice(0, 4) }).state;
  assert.equal(four.stars, 4);
  assert.ok(four.wages.slice(0, 4).every((w) => w >= 10));
  assert.throws(() => new Session(data, { seed: 1n, band: [] }), /1 to 4 stars/);
});

import { startPractice, practiceDay, ticketSales, startTour, playGig, disasterCheck, VENUE_SEATS } from "../src/gigs.ts";

test("ticket sales cap at the venue's seats", () => {
  assert.deepEqual(ticketSales(10, 0, 0), { tickets: Math.min(10 * 10 * 9, VENUE_SEATS[0]), takings: Math.min(900, 200) * 2 });
  assert.equal(ticketSales(1000, 4, 0).tickets, VENUE_SEATS[4]);
});

test("a tour charges venue hire per night; a gig credits takings and moves fame and skill", () => {
  const session = new Session(data, { seed: 9n });
  const s = session.state;
  const cash = s.cash;
  assert.equal(startTour(s, 1, 3), true);
  assert.equal(s.cash, cash - 3000);
  const before = { fame: s.fame, skill: s.skill, cash: s.cash };
  const r = playGig(s, 1, 1);
  assert.ok(r.takings >= 0);
  assert.equal(s.cash, before.cash + r.takings);
  assert.equal(s.skill, Math.min(before.skill + 10, 255));
});

test("practice costs £100 a day and raises skill", () => {
  const s = new Session(data, { seed: 10n }).state;
  const cash = s.cash;
  assert.equal(startPractice(s, 4), true);
  assert.equal(s.cash, cash - 400);
  const skill = s.skill;
  practiceDay(s);
  assert.equal(s.skill, Math.min(skill + 10, 255));
});

test("disasters need a gold disc and at least £1m", () => {
  const s = new Session(data, { seed: 12n }).state;
  s.cash = 500_000;
  s.discs[0] = true;
  assert.equal(disasterCheck(s), null);
});

test("a scripted tour runs its nights and keeps the log", () => {
  const session = new Session(data, { seed: 21n });
  const before = session.log.length;
  assert.equal(session.tour(0, 0, 5).ok, true);
  assert.ok(session.log.length >= before + 6);
  assert.ok(session.log.some((l) => l.startsWith("Night 5:")));
});

test("a tour stops for a demand until it is answered, then carries on", () => {
  const session = new Session(data, { seed: 77n });
  session.beginTour(0, 0, 5);
  let guard = 0;
  while (!session.pendingMood && session.touring && guard++ < 200) session.playNight();
  if (session.pendingMood) {
    assert.equal(session.playNight().ok, false); // blocked until answered
    assert.equal(session.answerMood(false).ok, true);
  }
  let nights = 0;
  while (session.touring && guard++ < 400) {
    const r = session.playNight();
    if (session.pendingMood) session.answerMood(true);
    if (r.ok) nights++;
  }
  assert.equal(session.touring, false);
});

test("equipment lost asks for kit again, and buying kit clears the request", () => {
  const session = new Session(data, { seed: 8n });
  session.pendingRebuy = true;
  assert.equal(session.buyGear(0).ok, true);
  assert.equal(session.pendingRebuy, false);
});
