# Rock Star Ate My Hamster: web core

A TypeScript remake of the rules core from `Sources/RockStar/Model/`, with a mod
hook API and a small playable slice in the browser.

## Status

| Area | Swift source | Web port |
| --- | --- | --- |
| SpectrumRNG (table-weighted `rnd`) | `SpectrumRNG.swift` | done, `src/rng.ts` |
| Config and difficulty | `GameState.swift` | done, `src/config.ts` |
| Calendar, wages, money | `Rules+Core.swift` §1, §5 | done, `src/calendar.ts` |
| Career year roll-over | `Career.swift` | done, `src/career.ts` |
| Mod hook host | none | `src/plugins.ts`, `src/turn.ts` |
| Band formation, equipment, record contracts | `Rules+Core.swift` §2 (formBand), §7.2, §8.1 | done, `src/band.ts` |
| Hiring from a star roster | `Rules+Core.swift` §4.1, `StarCreator.swift` | hire screen done, 20 invented stars in `data/remake-gamedata.json` |
| Recording, releases, rival and player charts, royalties and discs | `Rules+Records.swift` | done, `src/records.ts` (name text via `catalog.titleFor`) |
| Gigs, tours, practice, disasters | `Rules+Events.swift` (practice, disasters, gigs) | done, `src/gigs.ts` |
| Mood checks, demands, ultimatums, trouble, gifts | `Rules+Events.swift` | done, `src/events.ts`; the tour asks you to pay or refuse |
| Publicity, headlines, sponsors, scandals, charity, bootlegs | `Rules+Events.swift` | done, `src/events.ts`; headline text not ported |
| Event scheduling (per Sunday) | `$6ADF` | done, `Session.periodicEvents` |
| Text expansion (message and name strings) | `GameData.swift` `expand` | not ported; `titleFor` is injected |
| Game data loader (`gamedata.json`) | `GameData.swift` | shape check done, `src/data.ts`, `src/node.ts` |
| Remake data (original, invented) | none | `data/remake-gamedata.json`, `tools/make-remake-data.ts` |
| Tape records, portraits | `Assets.swift` | not ported |
| Playable slice (session and browser page) | `Game.swift` (flow only) | done, `src/session.ts`, `app/` |
| Browser UI, full screens | `Game.swift`, `Screen.swift`, `SidePanel.swift` | slice only |

Known gaps in the port:
- Money caps at 99,999,999 instead of wrapping on carry, following the Swift code and the notes it cites (`INFERRED` there).
- Rival title text comes from `catalog.titleFor`. The Swift `expand` also resolves random word groups, which is part of the text port.
- `newGame` does not run the boot step. Call `bootCharts(state)` once after it, as the Swift init does.
- The remake roster is invented and untuned. Some hires will not reach the contract thresholds (skill 60, fame 40).
- The slice's remaining shortcut is easy money by default.
- Headlines and log lines are the remake's own wording (`src/headlines.ts`). The original's message text is not used.
- Gig economics use the original's constants (venue hire, ticket prices, demand). Early tours lose money in the remake, so these need tuning.
- The page shows a kit re-buy request only through the kit controls; `pendingRebuy` is set but not displayed.
- After equipment is lost, re-buying kit (msg 116) is not ported. The loss is logged only.
- Faithful bugs ported so far: the wage bill's slot choice (`wageBill`), the producer ransom's 10^6 digit test (`producerRansomDue`), and the chart quirk that lands a 0 gap one place down (`movePlayerSingle`).

## Play it

    cd web
    node tools/build.mjs            # builds dist/ (no bundler, no dependencies)
    python3 -m http.server -d dist  # then open http://localhost:8000

The slice is one band of four stars with fixed wages, on easy money (£100k). Actions:
- **Hire**: pick one to four stars on the start screen. Their stats set the band's skill and fame.
- **Record album**: pick a studio. Days pass for each track.
- **Promo push** (£5k, +1 hype): a remake lever, not in the original. Hype speeds chart climbs.
- **Buy kit**: new, second hand or dodgy, priced by the instruments the stars play.
- **Tour**: five nights at a venue with a ticket price. Venue hire is charged up front. Click **Play next night** to go one night at a time. A star's demand or ultimatum stops the tour until you pay or refuse.
- **Practise**: three days at £100 a day. Raises skill and lowers hype.
- **Release single**: pick a recorded track and a video tier.
- **Release album**: once it is in the can.
- **Record offer**: after the first Sunday the label offers a contract. Sign to take the advance, or decline.
- Time: next day, next week, next 30 days. Wages on Friday, chart show and royalties on Sunday.

The band is hired from a roster of 20 invented stars, one to four at a time. Money is easy by default (£100k), and there are no events yet. The record offer and equipment are real rules.

## Run the tests and the demo

    npm test                          # unit, rules and static page checks
    node tools/build.mjs && node test/ui.browser.mjs   # clicks through the built page in Chromium (needs Playwright)

Requires Node 22.6 or later.

    cd web
    npm test
    node --experimental-strip-types bin/play-year.ts path/to/gamedata.json 300,250

Tests use the built-in test runner and Node's type stripping, so there are no dependencies to install. The demo plays one year with a band of the given weekly wages and prints the ledger. It needs a generated `gamedata.json`, which the tests do not.

## Data

The rules read tables that the original code keeps in RAM. Users generate them from their own tapes with the existing Python tools. Nothing from the game is committed here.

**Synthetic test data.** `fixtures/synthetic/` holds fake tapes and a fake `gamedata.json`, made by `tools/synthetic/make_fixtures.py`, for the tape parser tests. They are not game data. See `fixtures/synthetic/README.md`.

The web build uses `data/remake-gamedata.json`, which is original. It is generated by `tools/make-remake-data.ts` and invented for this project, so it needs no tapes or emulator.

The tape pipeline (`tools/setup_assets.sh`) is still in the repo for anyone who wants to check the Swift original against their own tapes. Its output is the input for `parseGameData` (browser-safe) and `loadGameDataFile` (Node). It is not used by the web build.

## Extension points

- **Mods.** Export a `Mod` with a `name` and a `setup(api)` function. Call `api.on(hook, handler)` to subscribe. Pass mods to `new ModHost([...])`.
- **Hooks** (`src/plugins.ts`, `HookPayloads`): `dayAdvanced`, `wagesPaid`, `careerYearStarted`, `gameEnded`. Hooks are observers. They receive a snapshot and cannot change outcomes. Rule-changing extension points will be added deliberately, one at a time.
- **Config.** `GameConfig` in `src/config.ts` holds the rule options (`faithfulBugs`, `sandbox`, `difficulty`, `career`).
- **RNG.** `SpectrumRNG` takes any 64-byte table and seed, so tests and mods can use a fixed sequence.

## Legal

Game text, graphics, music and data belong to their owners. This remake contains none of them: the web build's names, tables and tuning are original. The Swift tape pipeline still needs the user's own tapes, and its output stays on their machine.

## References

- Swift source of truth: `Sources/RockStar/Model/`, with rule notes in `docs/`.
- Swift tests to port next: `Tests/RockStarTests/RulesTests.swift` (630 lines), `AutoplayTests.swift`.
