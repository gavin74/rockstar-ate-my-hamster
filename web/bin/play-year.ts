// Headless demo: play one calendar year with a fixed band and print the ledger.
// Usage: node --experimental-strip-types bin/play-year.ts <gamedata.json> [wage,wage,...]
import { loadGameDataFile } from "../src/node.ts";
import { SpectrumRNG } from "../src/rng.ts";
import { newGame, gameDecided } from "../src/state.ts";
import { ModHost } from "../src/plugins.ts";
import { stepDay } from "../src/turn.ts";
import { dateText } from "../src/calendar.ts";

const [path, wageArg = "300,250"] = process.argv.slice(2);
if (!path) {
  console.error("usage: play-year.ts <gamedata.json> [wage,wage,...]");
  process.exit(1);
}
const data = loadGameDataFile(path);
const s = newGame(new SpectrumRNG(data.rngTable, 7n));
const wages = wageArg.split(",").map(Number);
s.stars = wages.length;
s.gone = [0, 1, 2, 3].map((i) => i >= wages.length);
wages.forEach((w, i) => (s.wages[i] = w));

const host = new ModHost([
  {
    name: "ledger",
    setup(api) {
      api.on("wagesPaid", (p) => console.log(`  wages paid £${p.amount}, cash £${p.cash}`));
      api.on("gameEnded", (p) => console.log(`  game over: ${p.reason}`));
    },
  },
]);

let days = 0;
while (!gameDecided(s) && days < 366) {
  stepDay(s, host);
  days++;
  if (s.dayOfWeek === 0 && s.dayOfMonth <= 7) console.log(`${dateText(s)}  cash £${s.cash}`);
}
console.log(`ended after ${days} days, cash £${s.cash}, bankrupt=${s.bankrupt}`);
