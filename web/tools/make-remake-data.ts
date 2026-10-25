// Writes data/remake-gamedata.json: ORIGINAL data for the remake. Nothing here is
// taken from the Spectrum tapes. Names, titles and tuning are invented, and the
// values are chosen for play, not copied from the original.
//
// Usage: node --experimental-strip-types tools/make-remake-data.ts [out.json]

import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? new URL("../data/remake-gamedata.json", import.meta.url).pathname;

// Deterministic PRNG (mulberry32) so the file is reproducible.
let seed = 0x5eed;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (n: number) => Math.floor(rand() * n);

// The rng table must contain 0 and values 0...15 (see web/src/rng.ts).
const rngTable = Array.from({ length: 64 }, (_, i) => i % 16);
for (let i = 63; i > 0; i--) {
  const j = int(i + 1);
  [rngTable[i], rngTable[j]] = [rngTable[j], rngTable[i]];
}

const ADJ = ["Velvet", "Chrome", "Neon", "Static", "Hollow", "Crimson", "Electric", "Silver", "Midnight", "Paper"];
const NOUN = ["Engines", "Parade", "Mirrors", "Thunder", "Saints", "Vultures", "Lanterns", "Circuits", "Orchids", "Riots"];
const titleOf = (i: number) => `${ADJ[i % 10]} ${NOUN[Math.floor(i / 10) % 10]}`;

// 58 name strings: 0...9 single titles and rival songs, the rest album titles.
const nameStrings = Array.from({ length: 58 }, (_, i) => [{ t: "text", v: titleOf(i) }]);

const rivals = Array.from({ length: 30 }, (_, i) => ({
  single: [int(7), 20 + int(20), 30 + int(15), 3 + int(4), 4 + int(4)],
  album: [int(5), 15 + int(20), 25 + int(15), 5 + int(4), 6 + int(4)],
  songChoices: [i % 58, (i * 7 + 3) % 58],
  albumTitle: 30 + (i % 28),
}));

// 20 invented stars for the hire screen. stats: [portrait, voice, ability, mood,
// instrument kind, wage digits x4]. Wage = 10 * (1000*d5 + 100*d6 + 10*d7 + d8).
const FIRST = ["Dana", "Sol", "Ines", "Tom", "Ada", "Milo", "Ruth", "Kit", "Vera", "Jonah", "Lena", "Otis", "Mae", "Ezra", "Nell", "Rafa", "Cass", "Theo", "Ivy", "Bram"];
const LAST = ["Vox", "Reed", "Kade", "Brisk", "Lune", "Marsh", "Quill", "Strand", "Pike", "Orr", "Finch", "Dune", "Cole", "Ash", "Vale", "Hart", "Sable", "Rook", "Wren", "Stone"];
const roster = FIRST.map((first, i) => {
  const ability = 35 + int(40);
  const portrait = 15 + int(40);
  const wageUnits = 1 + int(9); // 10...90 pounds per unit of 10
  return {
    name: `${first} ${LAST[i]}`,
    stats: [portrait, i % 8, ability, 40 + int(40), [0x20 | 2, 0x40 | 1, 0x80 | 2, 1, 0x20 | 1][i % 5], 0, 0, Math.floor(wageUnits / 10), wageUnits % 10],
  };
});

const data = {
  _notice: "ORIGINAL remake data, invented for this project. Not taken from the original game.",
  rngTable,
  rivals,
  respawnScores: [25, 45, 33, 21, 19, 36],
  respawnStart: 3,
  nameStrings,
  bandNames: Array.from({ length: 8 }, (_, i) => [{ t: "text", v: `The ${NOUN[i]}` }]),
  videoRankTable: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => n * 2),
  // Starts at 0 so a band with no fame still ranks 10 (bottom of the top ten), not 11.
  fameRankTable: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180],
  royaltyPercent: [255, 10, 20, 30, 40, 50],
  studioDays: [5, 4, 3, 2, 2, 1],
  roster,
};

writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
console.log("wrote", out);
