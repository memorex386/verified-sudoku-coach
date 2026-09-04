import { sha256 } from "@verified-sudoku/domain";

/** Fixture tooling only: a deterministic stream, never security or core authority. */
export function fixtureAttempt(seed: string): number {
  if (typeof seed !== "string" || !/^vsc-fixture\/v1:(?:0|[1-9][0-9]{0,9})(?![\s\S])/.test(seed)) {
    throw new Error("invalid-fixture-seed");
  }
  const attempt = Number(seed.slice("vsc-fixture/v1:".length));
  if (attempt > 0xffffffff) throw new Error("invalid-fixture-seed");
  return attempt;
}

export function boundedDraw(next: () => number, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000) throw new Error("invalid-draw-bound");
  const limit = Math.floor(0x100000000 / bound) * bound;
  for (;;) {
    const value = next();
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0) || value > 0xffffffff) {
      throw new Error("invalid-random-word");
    }
    if (value < limit) return value % bound;
  }
}

const rotate = (value: number, bits: number): number => ((value << bits) | (value >>> (32 - bits))) >>> 0;

export function fixtureRandom(seed: string): Readonly<{
  next: () => number;
  bounded: (bound: number) => number;
  shuffle: <T>(input: readonly T[]) => T[];
}> {
  fixtureAttempt(seed);
  const hash = sha256(Uint8Array.from(seed, (character) => character.charCodeAt(0)));
  const words = Array.from({ length: 4 }, (_, word) => {
    let value = 0;
    for (let byte = 0; byte < 4; byte++) value |= Number.parseInt(hash.slice(word * 8 + byte * 2, word * 8 + byte * 2 + 2), 16) << (byte * 8);
    return value >>> 0;
  });
  if (words.reduce((combined, word) => combined | word, 0) === 0) words[0] = 0x9e3779b9;
  let [a, b, c, d] = words as [number, number, number, number];
  const next = (): number => {
    const result = Math.imul(rotate(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotate(d, 11);
    a >>>= 0; b >>>= 0; c >>>= 0;
    return result;
  };
  const bounded = (bound: number): number => boundedDraw(next, bound);
  const shuffle = <T>(input: readonly T[]): T[] => {
    const result = [...input];
    for (let i = result.length - 1; i > 0; i--) {
      const j = bounded(i + 1);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  };
  return Object.freeze({ next, bounded, shuffle });
}
