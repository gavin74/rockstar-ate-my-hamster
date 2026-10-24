# Synthetic fixtures (not game data)

Everything in this folder is made by `tools/synthetic/make_fixtures.py`. None of it
comes from the original game, and it must not be replaced with real game files in
this repo.

| File | What it is | What it is for |
| --- | --- | --- |
| `side_a.tzx` | One `CODE1` header and 512 bytes of random filler. No game code. | Checks the TZX splitter and the `*_CODE1.bin` step of `setup_assets.sh`. |
| `side_b.tzx` | 50 headerless 250-byte blocks, the record count the setup script checks. | Checks the record count and the `*_headerless.bin` naming. |
| `gamedata.json` | Random-looking values with the `web/src/data.ts` schema. | Tests the web loader and the headless demo. Values have no meaning in the game. |

**Limits.** These tapes will not run in the emulator, so the rest of `setup_assets.sh`
(the SkoolKit load and the RAM-based `make_assets.py`) cannot produce real output from
them. The `gamedata.json` here is not what `make_assets.py` would write from a real
snapshot.

Real data needs the user's own tapes: `tools/setup_assets.sh <side-A.tzx> <side-B.tzx>`.
