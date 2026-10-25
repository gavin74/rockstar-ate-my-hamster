import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Session } from "../src/session.ts";

const data = JSON.parse(readFileSync(new URL("../data/remake-gamedata.json", import.meta.url), "utf8"));

test("scripted year: record, promote, release a single with a budget video, release the album, play out", () => {
  const session = new Session(data, { seed: 11n });

  assert.equal(session.recordAlbum(0, "Test Album").ok, true);
  assert.equal(session.state.albumInCan, true);
  assert.equal(session.state.tracksCut, 10);

  // Recording costs 2 hype, so promote after it. Hype 8 gives faster chart climbs.
  for (let i = 0; i < 8; i++) assert.equal(session.promote().ok, true);
  assert.equal(session.state.hype, 8);
  assert.equal(session.releaseSingle(0, "budget").ok, true);
  assert.equal(session.state.singleReleased, true);

  assert.equal(session.releaseAlbum().ok, true);
  assert.equal(session.state.albumReleased, true);

  if (session.pendingOffer !== null) assert.equal(session.answerOffer(true).ok, true);
  session.advanceDays(365);
  assert.equal(session.over, true);
  assert.ok(session.royaltyTotal > 0, "a top-ten single should earn royalties");
  assert.ok(session.log.some((l) => l.startsWith("Singles chart")), "chart show should have run");
});

test("releasing a single without recorded tracks is refused and changes nothing", () => {
  const session = new Session(data, { seed: 5n });
  const before = session.state.cash;
  const r = session.releaseSingle(0, "none");
  assert.equal(r.ok, false);
  assert.equal(session.state.singleReleased, false);
  assert.equal(session.state.cash, before);
});

test("recording is refused when the band cannot pay the studio", () => {
  const session = new Session(data, { seed: 3n });
  session.pay(session.state.cash); // broke
  const r = session.recordAlbum(0, "Broke");
  assert.equal(r.ok, false);
  assert.equal(session.state.albumInCan, false);
});
