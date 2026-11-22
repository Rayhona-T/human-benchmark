import { describe, expect, it } from "vitest";
import {
  STROOP_COLORS,
  STROOP_COLOR_WORDS,
  STROOP_INK_HEX,
  STROOP_NEUTRAL_WORDS,
} from "./stroop";
import { stroopAdapter } from "./stroopAdapter";
import {
  createMainSchedule,
  createMulberry32,
  createPracticeSchedule,
  createStroopSchedule,
  enumerateDerangements,
  getCorrectKey,
  validateSeed,
} from "./stroopSchedule";

describe("Stroop adapter and schedule", () => {
  it("uses the approved identity, counts, timing, and break configuration", () => {
    expect(stroopAdapter.configuration.experimentId).toBe("stroop");
    expect(stroopAdapter.configuration.protocolId).toBe("HB-STROOP-1.0");
    expect(stroopAdapter.configuration.practice.trialCount).toBe(12);
    expect(stroopAdapter.configuration.main.trialCount).toBe(60);
    expect(stroopAdapter.configuration.practice.fixationMs).toBe(500);
    expect(stroopAdapter.configuration.main.fixationMs).toBe(500);
    expect(stroopAdapter.configuration.main.interTrialIntervalMs).toBe(500);
    expect(stroopAdapter.configuration.main.responseDeadlineMs).toBe(2000);
    expect(stroopAdapter.configuration.main.breakAfterTrialIndex).toBe(30);
  });

  it("maps display colors to D, F, J, and K correctly", () => {
    expect(getCorrectKey("red")).toBe("d");
    expect(getCorrectKey("blue")).toBe("f");
    expect(getCorrectKey("green")).toBe("j");
    expect(getCorrectKey("yellow")).toBe("k");
  });

  it("uses the approved display hex and font presentation values", () => {
    expect(STROOP_INK_HEX).toEqual({
      red: "#F87171",
      blue: "#60A5FA",
      green: "#4ADE80",
      yellow: "#FACC15",
    });
    const trial = createMainSchedule(8).trials[0];
    expect(trial.stimulus.fontSizePx).toBe(48);
    expect(trial.stimulus.fontWeight).toBe(700);
    expect(trial.stimulus.fontFamily).toBe("Arial, Helvetica, sans-serif");
    expect(trial.stimulus.background).toBe("#111827");
  });

  it("generates congruent, incongruent, and neutral stimuli correctly", () => {
    const main = createMainSchedule(1234).trials;
    for (const trial of main) {
      if (trial.condition === "congruent") {
        expect(STROOP_COLOR_WORDS).toContain(trial.stimulus.word);
        expect(trial.stimulus.word.toLowerCase()).toBe(trial.stimulus.inkColor);
        expect(stroopAdapter.getCorrectResponse(trial)).toBe(
          getCorrectKey(trial.stimulus.inkColor),
        );
      }
      if (trial.condition === "incongruent") {
        expect(STROOP_COLOR_WORDS).toContain(trial.stimulus.word);
        expect(trial.stimulus.word.toLowerCase()).not.toBe(
          trial.stimulus.inkColor,
        );
      }
      if (trial.condition === "neutral") {
        expect(STROOP_NEUTRAL_WORDS).toContain(trial.stimulus.word);
        expect(STROOP_COLORS).toContain(trial.stimulus.inkColor);
      }
    }
  });

  it("balances 60 main trials exactly 20 per condition", () => {
    const { trials } = createMainSchedule(90210);
    expect(trials).toHaveLength(60);
    expect(
      trials.filter((trial) => trial.condition === "congruent"),
    ).toHaveLength(20);
    expect(
      trials.filter((trial) => trial.condition === "incongruent"),
    ).toHaveLength(20);
    expect(
      trials.filter((trial) => trial.condition === "neutral"),
    ).toHaveLength(20);
  });

  it("balances main target colors and neutral words", () => {
    const { trials } = createMainSchedule(55);
    for (const condition of ["congruent", "incongruent", "neutral"] as const) {
      const trialsInCondition = trials.filter(
        (trial) => trial.condition === condition,
      );
      for (const color of STROOP_COLORS) {
        expect(
          trialsInCondition.filter(
            (trial) => trial.stimulus.inkColor === color,
          ),
        ).toHaveLength(5);
      }
    }
    const neutral = trials.filter((trial) => trial.condition === "neutral");
    for (const word of STROOP_NEUTRAL_WORDS) {
      expect(
        neutral.filter((trial) => trial.stimulus.word === word),
      ).toHaveLength(4);
    }
  });

  it("creates exactly 12 practice trials with four per condition", () => {
    const practice = createPracticeSchedule(123);
    expect(practice).toHaveLength(12);
    expect(
      practice.filter((trial) => trial.condition === "congruent"),
    ).toHaveLength(4);
    expect(
      practice.filter((trial) => trial.condition === "incongruent"),
    ).toHaveLength(4);
    expect(
      practice.filter((trial) => trial.condition === "neutral"),
    ).toHaveLength(4);

    const congruent = practice.filter(
      (trial) => trial.condition === "congruent",
    );
    for (const color of STROOP_COLORS) {
      expect(
        congruent.filter((trial) => trial.stimulus.inkColor === color),
      ).toHaveLength(1);
    }

    const incongruent = practice.filter(
      (trial) => trial.condition === "incongruent",
    );
    for (const trial of incongruent) {
      expect(trial.stimulus.word.toLowerCase()).not.toBe(
        trial.stimulus.inkColor,
      );
    }
    expect(new Set(incongruent.map((trial) => trial.stimulus.word)).size).toBe(
      4,
    );
    expect(
      new Set(incongruent.map((trial) => trial.stimulus.inkColor)).size,
    ).toBe(4);

    const neutral = practice.filter((trial) => trial.condition === "neutral");
    expect(new Set(neutral.map((trial) => trial.stimulus.word)).size).toBe(4);
    expect(new Set(neutral.map((trial) => trial.stimulus.inkColor)).size).toBe(
      4,
    );
  });

  it("is reproducible with the same seed and unique across realized trials", () => {
    const first = createStroopSchedule(424242);
    const second = createStroopSchedule(424242);
    expect(first.practice).toEqual(second.practice);
    expect(first.main).toEqual(second.main);
    expect(first.metadata.selectedDerangement).toEqual(
      second.metadata.selectedDerangement,
    );

    const ids = [
      ...first.practice.map((trial) => trial.trialId),
      ...first.main.map((trial) => trial.trialId),
    ];
    expect(new Set(ids).size).toBe(72);
  });

  it("produces different schedules for different seeds", () => {
    const first = createStroopSchedule(1);
    const second = createStroopSchedule(2);
    const firstMainIdentity = first.main.map(
      (trial) =>
        `${trial.condition}:${trial.stimulus.word}:${trial.stimulus.inkColor}`,
    );
    const secondMainIdentity = second.main.map(
      (trial) =>
        `${trial.condition}:${trial.stimulus.word}:${trial.stimulus.inkColor}`,
    );
    expect(firstMainIdentity).not.toEqual(secondMainIdentity);
  });

  it("uses nine valid derangements and respects main run constraints", () => {
    const derangements = enumerateDerangements();
    expect(derangements).toHaveLength(9);
    for (const derangement of derangements) {
      expect(derangement.every((target, source) => target !== source)).toBe(
        true,
      );
    }

    const { trials } = createMainSchedule(77);
    for (let index = 1; index < trials.length; index++) {
      expect(trials[index].trialId).not.toBe(trials[index - 1].trialId);
      const identity = (trial: (typeof trials)[number]) =>
        `${trial.stimulus.word}-${trial.stimulus.inkColor}`;
      expect(identity(trials[index])).not.toBe(identity(trials[index - 1]));
    }
    let conditionRun = 1;
    for (let index = 1; index < trials.length; index++) {
      if (trials[index].condition === trials[index - 1].condition) {
        conditionRun++;
        expect(conditionRun).toBeLessThanOrEqual(3);
      } else {
        conditionRun = 1;
      }
    }
  });

  it("uses each incongruent ordered pair once or twice as approved", () => {
    const { trials } = createMainSchedule(8128);
    const incongruent = trials.filter(
      (trial) => trial.condition === "incongruent",
    );
    const counts = new Map<string, number>();
    for (const trial of incongruent) {
      const pair = `${trial.stimulus.word}-${trial.stimulus.inkColor}`;
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    expect(
      [...counts.values()].every((count) => count === 1 || count === 2),
    ).toBe(true);
    expect([...counts.values()].filter((count) => count === 1)).toHaveLength(4);
  });

  it("preserves exact balances across multiple seeds", () => {
    for (let seed = 0; seed < 100; seed++) {
      const { trials } = createMainSchedule(seed);
      expect(trials).toHaveLength(60);
      for (const condition of [
        "congruent",
        "incongruent",
        "neutral",
      ] as const) {
        expect(
          trials.filter((trial) => trial.condition === condition),
        ).toHaveLength(20);
        const conditionTrials = trials.filter(
          (trial) => trial.condition === condition,
        );
        for (const color of STROOP_COLORS) {
          expect(
            conditionTrials.filter(
              (trial) => trial.stimulus.inkColor === color,
            ),
          ).toHaveLength(5);
        }
      }
    }
  });

  it("classifies mapped responses from ink color, not word meaning", () => {
    const trial = createMainSchedule(8).trials.find(
      (candidate) => candidate.condition === "incongruent",
    );
    expect(trial).toBeDefined();
    if (!trial) return;
    const correctKey = getCorrectKey(trial.stimulus.inkColor);
    expect(
      stroopAdapter.classifyResponse(trial, {
        value: correctKey,
        inputSource: "keyboard",
        timestampMs: 100,
        accepted: true,
      }),
    ).toEqual({ category: "correct" });
  });

  it("rejects invalid seeds and mismatched adapter configuration", () => {
    expect(() => validateSeed(-1)).toThrow();
    expect(() => validateSeed(0x100000000)).toThrow();
    expect(() => validateSeed(1.5)).toThrow();
    expect(stroopAdapter.createSchedule(123).practice).toHaveLength(12);
  });
});

/**
 * Reference values for HB-STROOP-1.0 §8 Mulberry32. Each value is the output
 * numerator (output × 2^32). They were computed independently from the
 * protocol text with Python integer arithmetic (no JavaScript), and agree with
 * the canonical published JavaScript Mulberry32. The previous implementation,
 * which omitted the `t +` term, fails every vector.
 */
const MULBERRY32_REFERENCE: ReadonlyArray<{
  seed: number;
  numerators: readonly number[];
}> = [
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
    // Practice stream for seed 1234: 1234 XOR 0x9E3779B9.
    seed: 2654436715,
    numerators: [1924724868, 3604359240, 2939103098, 3991777081, 3930147456],
  },
];

const identity = (trial: {
  condition: string;
  stimulus: { word: string; inkColor: string };
}) => `${trial.condition}:${trial.stimulus.word}:${trial.stimulus.inkColor}`;

describe("Mulberry32 protocol conformance (HB-STROOP-1.0 §8)", () => {
  it("matches independently computed reference vectors", () => {
    for (const { seed, numerators } of MULBERRY32_REFERENCE) {
      const random = createMulberry32(seed);
      const actual = numerators.map(() => random() * 2 ** 32);
      expect(actual, `seed ${seed}`).toEqual(numerators);
    }
  });

  it("returns values in [0, 1)", () => {
    const random = createMulberry32(0xffffffff);
    for (let index = 0; index < 10_000; index++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("selects derangements by floor(random() * 9) in lexicographic order", () => {
    expect(enumerateDerangements()).toEqual([
      [1, 0, 3, 2],
      [1, 2, 3, 0],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
      [2, 3, 0, 1],
      [2, 3, 1, 0],
      [3, 0, 1, 2],
      [3, 2, 0, 1],
      [3, 2, 1, 0],
    ]);
    // Expected indices = floor(firstNumerator * 9 / 2^32) from the reference.
    const expectedIndex: Record<number, number> = {
      0: 2,
      1: 5,
      1234: 0,
      0xffffffff: 8,
    };
    for (const [seed, index] of Object.entries(expectedIndex)) {
      expect(createMainSchedule(Number(seed)).selectedDerangement).toEqual(
        enumerateDerangements()[index],
      );
    }
  });

  it("uses the practice stream seed and its derangement for seed 1234", () => {
    const schedule = createStroopSchedule(1234);
    expect(schedule.metadata.practiceSeedUnsigned32).toBe(2654436715);
    // Practice stream first numerator 1924724868 → index 4 → [2, 3, 0, 1].
    const pairs = schedule.practice
      .filter((trial) => trial.condition === "incongruent")
      .map((trial) => `${trial.stimulus.word}:${trial.stimulus.inkColor}`)
      .sort();
    expect(pairs).toEqual(
      ["BLUE:yellow", "GREEN:red", "RED:green", "YELLOW:blue"].sort(),
    );
  });

  it("identifies the algorithm and seed in schedule metadata", () => {
    const schedule = createStroopSchedule(1234);
    expect(schedule.metadata.prngAndScheduleId).toBe("HB-STROOP-shuffle-v1");
    expect(schedule.metadata.seedUnsigned32).toBe(1234);
    expect(schedule.metadata.scheduleGenerationStatus).toBe("generated");
    expect(schedule.metadata.selectedDerangement).toEqual([1, 0, 3, 2]);
    expect(schedule.metadata.realizedMainOrder).toEqual(schedule.main);
    expect(schedule.metadata.realizedPracticeOrder).toEqual(schedule.practice);
  });

  /**
   * Regression snapshot of the realized seed-1234 schedule produced by the
   * corrected implementation. Its PRNG stream is verified by the reference
   * vectors above; the pool order and shuffle are the approved Task 1 code.
   */
  it("pins the realized seed-1234 practice and main orders", () => {
    const schedule = createStroopSchedule(1234);
    expect(schedule.practice.map(identity)).toEqual([
      "congruent:RED:red",
      "incongruent:RED:green",
      "neutral:CHAIR:yellow",
      "neutral:HOUSE:red",
      "congruent:GREEN:green",
      "incongruent:BLUE:yellow",
      "neutral:TABLE:blue",
      "incongruent:YELLOW:blue",
      "incongruent:GREEN:red",
      "congruent:YELLOW:yellow",
      "congruent:BLUE:blue",
      "neutral:BOOK:green",
    ]);
    expect(schedule.main.map(identity)).toEqual([
      "incongruent:YELLOW:blue",
      "congruent:GREEN:green",
      "neutral:CHAIR:red",
      "incongruent:GREEN:red",
      "congruent:RED:red",
      "congruent:GREEN:green",
      "incongruent:RED:green",
      "incongruent:GREEN:blue",
      "incongruent:RED:yellow",
      "neutral:HOUSE:green",
      "congruent:RED:red",
      "neutral:TABLE:red",
      "neutral:BOOK:yellow",
      "congruent:YELLOW:yellow",
      "congruent:BLUE:blue",
      "incongruent:YELLOW:green",
      "congruent:YELLOW:yellow",
      "congruent:RED:red",
      "congruent:YELLOW:yellow",
      "neutral:TABLE:green",
      "neutral:MUSIC:yellow",
      "incongruent:GREEN:red",
      "incongruent:GREEN:yellow",
      "congruent:GREEN:green",
      "incongruent:BLUE:red",
      "congruent:BLUE:blue",
      "incongruent:YELLOW:blue",
      "incongruent:BLUE:yellow",
      "congruent:GREEN:green",
      "congruent:YELLOW:yellow",
      "neutral:CHAIR:yellow",
      "incongruent:RED:blue",
      "neutral:MUSIC:blue",
      "congruent:BLUE:blue",
      "neutral:CHAIR:blue",
      "incongruent:GREEN:blue",
      "neutral:TABLE:yellow",
      "neutral:HOUSE:red",
      "incongruent:RED:yellow",
      "congruent:RED:red",
      "congruent:GREEN:green",
      "neutral:HOUSE:blue",
      "incongruent:BLUE:green",
      "congruent:RED:red",
      "neutral:MUSIC:red",
      "neutral:BOOK:blue",
      "neutral:CHAIR:green",
      "incongruent:BLUE:green",
      "incongruent:YELLOW:red",
      "congruent:BLUE:blue",
      "neutral:BOOK:green",
      "incongruent:BLUE:yellow",
      "neutral:HOUSE:yellow",
      "incongruent:RED:green",
      "incongruent:YELLOW:red",
      "neutral:MUSIC:green",
      "neutral:TABLE:blue",
      "congruent:BLUE:blue",
      "neutral:BOOK:red",
      "congruent:YELLOW:yellow",
    ]);
  });

  it("satisfies every main constraint and balance across 300 seeds", () => {
    for (let seed = 0; seed < 300; seed++) {
      const { trials, selectedDerangement } = createMainSchedule(seed);
      expect(trials).toHaveLength(60);
      let run = 1;
      for (let index = 1; index < trials.length; index++) {
        expect(identity(trials[index])).not.toBe(identity(trials[index - 1]));
        run =
          trials[index].condition === trials[index - 1].condition ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(3);
      }
      const counts = new Map<string, number>();
      for (const trial of trials) {
        counts.set(identity(trial), (counts.get(identity(trial)) ?? 0) + 1);
      }
      for (let source = 0; source < 4; source++) {
        const word = STROOP_COLOR_WORDS[source];
        expect(counts.get(`congruent:${word}:${STROOP_COLORS[source]}`)).toBe(
          5,
        );
        for (let ink = 0; ink < 4; ink++) {
          if (ink === source) continue;
          const expected = selectedDerangement[source] === ink ? 1 : 2;
          expect(counts.get(`incongruent:${word}:${STROOP_COLORS[ink]}`)).toBe(
            expected,
          );
        }
      }
      for (const word of STROOP_NEUTRAL_WORDS) {
        for (const color of STROOP_COLORS) {
          expect(counts.get(`neutral:${word}:${color}`)).toBe(1);
        }
      }
      const practice = createPracticeSchedule(seed);
      expect(practice).toHaveLength(12);
      for (const condition of ["congruent", "incongruent", "neutral"]) {
        const inCondition = practice.filter(
          (trial) => trial.condition === condition,
        );
        expect(inCondition).toHaveLength(4);
        expect(
          new Set(inCondition.map((trial) => trial.stimulus.inkColor)).size,
        ).toBe(4);
      }
    }
  });
});
