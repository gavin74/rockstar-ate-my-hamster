// Port of Sources/RockStar/Model/SpectrumRNG.swift (rules_core §9).
// rnd(n) walks a fixed 64-byte table and returns the first value <= n, so the
// odds follow the table, not a uniform distribution.

export type Seed = bigint;

const MASK64 = (1n << 64n) - 1n;

export class SpectrumRNG {
  readonly table: readonly number[];
  /** $BE57 */
  index = 0;
  private seedState: bigint;

  constructor(table: readonly number[], seed: Seed = randomSeed()) {
    if (table.length !== 64 || !table.includes(0)) {
      throw new Error("rng table must be 64 bytes and contain a 0");
    }
    this.table = table;
    this.seedState = seed & MASK64;
    this.index = Number(this.nextSeed() & 63n);
  }

  /** Stand-in for reading the Z80 R register (SplitMix64). */
  nextSeed(): bigint {
    this.seedState = (this.seedState + 0x9e3779b97f4a7c15n) & MASK64;
    let z = this.seedState;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
  }

  /** $A53F */
  reseed(): void {
    this.index = Number(this.nextSeed() & 63n);
  }

  /** $A51F: 0...n inclusive, table-weighted. */
  rnd(n: number): number {
    for (;;) {
      const v = this.table[this.index];
      this.index = (this.index + 1) & 63;
      if (v <= n) return v;
    }
  }

  /** Exact P(rnd(n) === v) with a uniform start index. */
  probability(v: number, n: number): number {
    let hits = 0;
    for (let start = 0; start < 64; start++) {
      let i = start;
      while (this.table[i] > n) i = (i + 1) & 63;
      if (this.table[i] === v) hits++;
    }
    return hits / 64;
  }
}

export function randomSeed(): Seed {
  const b = new Uint32Array(2);
  globalThis.crypto.getRandomValues(b);
  return (BigInt(b[0]) << 32n) | BigInt(b[1]);
}
