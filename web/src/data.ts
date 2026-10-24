// Port of the GameData shape from Sources/RockStar/Model/GameData.swift.
// The JSON is generated from the user's own tapes (tools/make_assets.py). This
// module validates its shape and never ships game data itself.

export interface RivalData {
  /** $ABC8+5s: [counter|bit7 climbing, score, peak, respawn counter, after-peak counter] */
  single: number[];
  /** $AC5E+5s, same layout */
  album: number[];
  songChoices: number[];
  albumTitle: number;
}

export interface GameData {
  /** $BE59, 64 bytes, values 0..15 */
  rngTable: number[];
  rivals: RivalData[];
  respawnScores: number[];
  respawnStart: number;
  /** Message parts are kept opaque here; the text expansion port will type them. */
  nameStrings: unknown[];
  bandNames: unknown[];
  videoRankTable: number[];
  fameRankTable: number[];
  royaltyPercent: number[];
  studioDays: number[];
}

export class GameDataError extends Error {}

function fail(path: string, msg: string): never {
  throw new GameDataError(`gamedata.json: ${path} ${msg}`);
}

function isByteArray(v: unknown, len?: number): v is number[] {
  return (
    Array.isArray(v) &&
    (len === undefined || v.length === len) &&
    v.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)
  );
}

/** Validate parsed JSON and return it typed. Throws GameDataError with the bad path. */
export function parseGameData(json: unknown): GameData {
  if (typeof json !== "object" || json === null) fail("", "is not an object");
  const d = json as Record<string, unknown>;
  if (!isByteArray(d.rngTable, 64) || !(d.rngTable as number[]).includes(0)) {
    fail("rngTable", "must be 64 bytes and contain a 0");
  }
  if (!Array.isArray(d.rivals) || d.rivals.length !== 30) fail("rivals", "must have 30 entries");
  d.rivals.forEach((r, i) => {
    const o = r as Record<string, unknown>;
    if (!isByteArray(o.single, 5)) fail(`rivals[${i}].single`, "must be 5 bytes");
    if (!isByteArray(o.album, 5)) fail(`rivals[${i}].album`, "must be 5 bytes");
  });
  if (!isByteArray(d.respawnScores, 6)) fail("respawnScores", "must be 6 bytes");
  if (!Number.isInteger(d.respawnStart)) fail("respawnStart", "must be an integer");
  if (!Array.isArray(d.nameStrings) || d.nameStrings.length !== 58) fail("nameStrings", "must have 58 entries");
  if (!Array.isArray(d.bandNames) || d.bandNames.length !== 8) fail("bandNames", "must have 8 entries");
  if (!Array.isArray(d.royaltyPercent)) fail("royaltyPercent", "must be an array");
  return d as unknown as GameData;
}
