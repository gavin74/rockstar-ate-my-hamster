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
