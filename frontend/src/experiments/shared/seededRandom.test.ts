import { describe, expect, it } from "vitest";
import {
  createProductionSeed,
  fisherYates,
  isUint32Seed,
  mulberry32,
  type SeedEntropySource,
} from "./seededRandom";

/**
 * Output numerators (value × 2^32) computed independently in Python from the
 * protocol formula and cross-checked against the canonical JavaScript
 * Mulberry32 (same vectors as the Stroop adapter tests).
 */
const REFERENCE = [
  {
    seed: 0,
    numerators: [1144304738, 1416247, 958946056, 627933444, 2007157716],
  },
  {
    seed: 1,
    numerators: [2693262067, 11749833, 2265367787, 4213581821, 4159151403],
  },
  {
    seed: 1234,
    numerators: [314799534, 3021131492, 3877737075, 4168477787, 175938938],
  },
  {
    seed: 0xffffffff,
    numerators: [3850105811, 813802916, 3073704848, 4054706436, 3630262831],
  },
  {
    seed: 2654436715,
    numerators: [1924724868, 3604359240, 2939103098, 3991777081, 3930147456],
  },
];

describe("shared Mulberry32", () => {
  it("matches the protocol reference vectors", () => {
    for (const { seed, numerators } of REFERENCE) {
      const random = mulberry32(seed);
      expect(
        numerators.map(() => random() * 2 ** 32),
        `seed ${seed}`,
      ).toEqual(numerators);
    }
  });

  it("rejects seeds outside the unsigned 32-bit range", () => {
    for (const seed of [-1, 0x100000000, 0.5, Number.NaN]) {
      expect(isUint32Seed(seed)).toBe(false);
      expect(() => mulberry32(seed)).toThrow();
    }
  });
});

describe("shared Fisher–Yates", () => {
  it("swaps i with floor(random() * (i + 1)) from the end, without mutating input", () => {
    // Hand-computed: values give j = 1 (i=3), 2 (i=2), 0 (i=1).
    const values = [0.25, 0.9, 0.1];
    let call = 0;
    const input = ["a", "b", "c", "d"];
    const result = fisherYates(input, () => values[call++]);
    // i=3, j=1 → a d c b; i=2, j=2 → a d c b; i=1, j=0 → d a c b
    expect(result).toEqual(["d", "a", "c", "b"]);
    expect(input).toEqual(["a", "b", "c", "d"]);
    expect(call).toBe(3);
  });
});

describe("production seed", () => {
  it("uses the cryptographic source and returns an unsigned 32-bit integer", () => {
    const seed = createProductionSeed({
      getRandomValues: <T extends Uint32Array>(array: T) => {
        array[0] = 0xfedcba98;
        return array;
      },
    });
    expect(seed).toBe(0xfedcba98);
  });

  it("returns null rather than a fallback when no secure source exists", () => {
    expect(createProductionSeed(null)).toBeNull();
    expect(createProductionSeed({} as unknown as SeedEntropySource)).toBeNull();
  });

  it("produces a valid seed from the real environment source", () => {
    const seed = createProductionSeed();
    expect(seed).not.toBeNull();
    expect(isUint32Seed(seed as number)).toBe(true);
  });
});
