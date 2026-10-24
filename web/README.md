# Rock Star Ate My Hamster: web core

A TypeScript port of the rules core from `Sources/RockStar/Model/`, with a mod
hook API. This is the first milestone, not a playable game yet.

## Status

| Area | Swift source | Web port |
| --- | --- | --- |
| SpectrumRNG (table-weighted `rnd`) | `SpectrumRNG.swift` | done, `src/rng.ts` |
| Config and difficulty | `GameState.swift` | done, `src/config.ts` |
| Calendar, wages, money | `Rules+Core.swift` §1, §5 | done, `src/calendar.ts` |
| Career year roll-over | `Career.swift` | done, `src/career.ts` (partial reset, see below) |
| Mod hook host | none | `src/plugins.ts`, `src/turn.ts` |
| Band hiring, equipment, contracts | `Rules+Core.swift` §2 to §8 | not ported |
| Records, releases, charts | `Rules+Records.swift`, `Rules+Events.swift` | not ported |
| Random events, sponsors, scandals | `Rules+Events.swift`, `NewEvents.swift` | not ported |
| Game data loader (`gamedata.json`) | `GameData.swift` | shape check done, `src/data.ts`, `src/node.ts` |
| Tape records, portraits | `Assets.swift` | not ported |
| Browser UI | `Game.swift`, `Screen.swift`, `SidePanel.swift` | not started |

Known gaps in the port:
- `startNewCareerYear` resets only the chart, disc and release fields it needs for this milestone. The Swift version also resets recording and track fields. Those will be added with the records port.
- Money caps at 99,999,999 instead of wrapping on carry, following the Swift code and the notes it cites (`INFERRED` there).

## Run the tests and the demo

Requires Node 22.6 or later.

    cd web
    npm test
    node --experimental-strip-types bin/play-year.ts path/to/gamedata.json 300,250

Tests use the built-in test runner and Node's type stripping, so there are no dependencies to install. The demo plays one year with a band of the given weekly wages and prints the ledger. It needs a generated `gamedata.json`, which the tests do not.

## Data

The rules read tables that the original code keeps in RAM. Users generate them from their own tapes with the existing Python tools. Nothing from the game is committed here.

1. Run `tools/setup_assets.sh` on your own side A and side B `.tzx` files, as the repo README describes.
2. The generated `Sources/RockStar/Resources/gamedata.json` is the input for `parseGameData` (browser-safe) and `loadGameDataFile` (Node).

## Extension points

- **Mods.** Export a `Mod` with a `name` and a `setup(api)` function. Call `api.on(hook, handler)` to subscribe. Pass mods to `new ModHost([...])`.
- **Hooks** (`src/plugins.ts`, `HookPayloads`): `dayAdvanced`, `wagesPaid`, `careerYearStarted`, `gameEnded`. Hooks are observers. They receive a snapshot and cannot change outcomes. Rule-changing extension points will be added deliberately, one at a time.
- **Config.** `GameConfig` in `src/config.ts` holds the rule options (`faithfulBugs`, `sandbox`, `difficulty`, `career`).
- **RNG.** `SpectrumRNG` takes any 64-byte table and seed, so tests and mods can use a fixed sequence.

## Legal

Game text, graphics, music and data belong to their owners. This code is MIT and contains none of them. Users must supply their own tapes, and the data stays on their machine.

## References

- Swift source of truth: `Sources/RockStar/Model/`, with rule notes in `docs/`.
- Swift tests to port next: `Tests/RockStarTests/RulesTests.swift` (630 lines), `AutoplayTests.swift`.
