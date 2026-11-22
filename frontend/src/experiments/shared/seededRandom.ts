/**
 * Shared deterministic randomization used by experiment schedules.
 *
 * Both HB-STROOP-1.0 §8 and HB-FLANKER-1.0 §8 specify the same
 * Mulberry32 recurrence and Fisher–Yates shuffle, so there is exactly one
 * implementation. It supports reproducibility, not cryptographic security.
 */

/** A source of uniformly distributed numbers in [0, 1). */
export type RandomSource = () => number;

export function isUint32Seed(seed: number): boolean {
  return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
}

/**
 * Mulberry32 exactly as specified in the protocols:
 *   t = state = (state + 0x6D2B79F5) mod 2^32
 *   t = imul(t XOR (t >>> 15), t OR 1) mod 2^32
 *   t = t XOR ((t + imul(t XOR (t >>> 7), t OR 61)) mod 2^32)
 *   return unsigned (t XOR (t >>> 14)) / 2^32
 */
export function mulberry32(seed: number): RandomSource {
  if (!isUint32Seed(seed)) {
    throw new Error("Seed must be an unsigned 32-bit integer.");
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ ((t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0)) >>> 0;
    t = (t ^ (t >>> 14)) >>> 0;
    return t / 0x100000000;
  };
}

/**
 * Fisher–Yates: iterate i from n−1 down to 1, choose
 * j = floor(random() * (i + 1)), and swap entries i and j. Returns a new array.
 */
export function fisherYates<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const chosen = Math.floor(random() * (index + 1));
    [copy[index], copy[chosen]] = [copy[chosen], copy[index]];
  }
  return copy;
}

/** Minimal shape of the Web Crypto API needed for seeding. */
export interface SeedEntropySource {
  getRandomValues<T extends Uint32Array>(array: T): T;
}

/**
 * Production session seed from a cryptographically secure source (the global
 * Web Crypto object when called without arguments). Returns null when no such
 * source exists — pass `null` to represent that explicitly. Callers must then
 * stop with a technical error rather than substituting a constant or
 * `Math.random`.
 */
export function createProductionSeed(
  ...args: [] | [source: SeedEntropySource | null]
): number | null {
  const source =
    args.length === 0
      ? typeof crypto === "undefined"
        ? null
        : crypto
      : args[0];
  if (!source || typeof source.getRandomValues !== "function") return null;
  const values = new Uint32Array(1);
  source.getRandomValues(values);
  return values[0] >>> 0;
}
