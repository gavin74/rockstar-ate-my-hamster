// Node-only helpers: read a generated gamedata.json from disk.
import { readFileSync } from "node:fs";
import { type GameData, parseGameData } from "./data.ts";

export function loadGameDataFile(path: string): GameData {
  return parseGameData(JSON.parse(readFileSync(path, "utf8")));
}
