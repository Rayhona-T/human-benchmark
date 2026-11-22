import { describe, expect, it } from "vitest";
import {
  FLANKER_CONFIGURATION,
  FLANKER_CONDITIONS,
  FLANKER_DIRECTIONS,
} from "./flanker";
import {
  FLANKER_BASE_ITEMS,
  FlankerScheduleGenerationError,
  acceptsCandidate,
  createFlankerMainSchedule,
  createFlankerPracticeSchedule,
  createFlankerSchedule,
  flankerPracticeSeed,
  generateBalancedSequence,
  itemLabel,
  meetsFlankerConstraints,
  validateFlankerSeed,
  type FlankerItem,
} from "./flankerSchedule";
import { mulberry32 } from "../shared/seededRandom";

/**
 * Reference schedules computed by an independent Python implementation of
 * protocol §8 (integer Mulberry32, Fisher–Yates, set acceptance with the last
 * three accepted trials), written from the protocol text — not from this code.
 * Base order assumed: congruent-left, congruent-right, incongruent-left,
 * incongruent-right, neutral-left, neutral-right.
 */
const REFERENCE: Record<
  string,
  {
    main: string[];
    practice: string[];
    mainCandidates: number[];
    practiceCandidates: number[];
  }
> = {
  "0": {
    main: [
      "neutral-right",
      "incongruent-left",
      "incongruent-right",
      "neutral-left",
      "congruent-left",
      "congruent-right",
      "congruent-left",
      "neutral-left",
      "congruent-right",
      "incongruent-left",
      "neutral-right",
      "incongruent-right",
      "neutral-left",
      "incongruent-left",
      "neutral-right",
      "incongruent-right",
      "congruent-left",
      "congruent-right",
      "neutral-right",
      "congruent-left",
      "congruent-right",
      "incongruent-left",
      "neutral-left",
      "incongruent-right",
      "incongruent-left",
      "incongruent-right",
      "congruent-left",
      "neutral-right",
      "neutral-left",
      "congruent-right",
      "neutral-left",
      "congruent-left",
      "incongruent-right",
      "congruent-right",
      "incongruent-left",
      "neutral-right",
      "incongruent-right",
      "incongruent-left",
      "congruent-left",
      "neutral-left",
      "neutral-right",
      "congruent-right",
      "congruent-left",
      "incongruent-right",
      "neutral-right",
      "congruent-right",
      "incongruent-left",
      "neutral-left",
      "incongruent-right",
      "congruent-left",
      "congruent-right",
      "neutral-left",
      "incongruent-left",
      "neutral-right",
      "neutral-left",
      "incongruent-left",
      "neutral-right",
      "congruent-left",
      "incongruent-right",
      "congruent-right",
    ],
    practice: [
      "congruent-right",
      "neutral-left",
      "incongruent-right",
      "neutral-right",
      "congruent-left",
      "incongruent-left",
      "congruent-left",
      "congruent-right",
      "incongruent-left",
      "neutral-left",
      "incongruent-right",
      "neutral-right",
    ],
    mainCandidates: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
    practiceCandidates: [1, 4],
  },
  "1": {
    main: [
      "neutral-left",
      "congruent-right",
      "neutral-right",
      "incongruent-left",
      "congruent-left",
      "incongruent-right",
      "congruent-left",
      "neutral-left",
      "neutral-right",
      "incongruent-left",
      "incongruent-right",
      "congruent-right",
      "neutral-left",
      "incongruent-right",
      "congruent-right",
      "congruent-left",
      "neutral-right",
      "incongruent-left",
      "incongruent-right",
      "neutral-left",
      "congruent-right",
      "neutral-right",
      "incongruent-left",
      "congruent-left",
      "incongruent-right",
      "incongruent-left",
      "neutral-right",
      "neutral-left",
      "congruent-left",
      "congruent-right",
      "incongruent-right",
      "incongruent-left",
      "neutral-right",
      "congruent-left",
      "congruent-right",
      "neutral-left",
      "neutral-right",
      "incongruent-right",
      "congruent-right",
      "incongruent-left",
      "congruent-left",
      "neutral-left",
      "incongruent-right",
      "neutral-left",
      "neutral-right",
      "congruent-left",
      "congruent-right",
      "incongruent-left",
      "incongruent-right",
      "incongruent-left",
      "neutral-left",
      "neutral-right",
      "congruent-right",
      "congruent-left",
      "incongruent-right",
      "congruent-left",
      "neutral-right",
      "incongruent-left",
      "neutral-left",
      "congruent-right",
    ],
    practice: [
      "congruent-left",
      "incongruent-left",
      "neutral-left",
      "incongruent-right",
      "neutral-right",
      "congruent-right",
      "congruent-left",
      "neutral-right",
      "incongruent-right",
      "congruent-right",
      "neutral-left",
      "incongruent-left",
    ],
    mainCandidates: [1, 1, 1, 1, 1, 1, 1, 2, 1, 1],
    practiceCandidates: [1, 3],
  },
  "1234": {
    main: [
      "congruent-right",
      "neutral-right",
      "incongruent-left",
      "neutral-left",
      "incongruent-right",
      "congruent-left",
      "incongruent-left",
      "neutral-left",
      "congruent-right",
      "incongruent-right",
      "neutral-right",
      "congruent-left",
      "incongruent-right",
      "congruent-right",
      "neutral-left",
      "congruent-left",
      "neutral-right",
      "incongruent-left",
      "congruent-left",
      "neutral-right",
      "incongruent-right",
      "neutral-left",
      "incongruent-left",
      "congruent-right",
      "incongruent-right",
      "neutral-right",
      "neutral-left",
      "incongruent-left",
      "congruent-left",
      "congruent-right",
      "neutral-left",
      "incongruent-right",
      "congruent-left",
      "congruent-right",
      "incongruent-left",
      "neutral-right",
      "congruent-right",
      "incongruent-right",
      "congruent-left",
      "incongruent-left",
      "neutral-left",
      "neutral-right",
      "neutral-left",
      "congruent-left",
      "neutral-right",
      "incongruent-right",
      "incongruent-left",
      "congruent-right",
      "neutral-left",
      "neutral-right",
      "incongruent-left",
      "congruent-left",
      "incongruent-right",
      "congruent-right",
      "congruent-left",
      "neutral-left",
      "congruent-right",
      "neutral-right",
      "incongruent-left",
      "incongruent-right",
    ],
    practice: [
      "congruent-left",
      "congruent-right",
      "incongruent-right",
      "neutral-right",
      "neutral-left",
      "incongruent-left",
      "congruent-right",
      "incongruent-right",
      "neutral-left",
      "neutral-right",
      "incongruent-left",
      "congruent-left",
    ],
    mainCandidates: [1, 1, 2, 2, 1, 1, 1, 3, 1, 1],
    practiceCandidates: [1, 1],
  },
  "4294967295": {
    main: [
      "neutral-left",
      "congruent-right",
      "incongruent-right",
      "incongruent-left",
      "congruent-left",
      "neutral-right",
      "incongruent-left",
      "neutral-left",
      "congruent-left",
      "congruent-right",
      "neutral-right",
      "incongruent-right",
      "incongruent-left",
      "congruent-right",
      "congruent-left",
      "neutral-right",
      "incongruent-right",
      "neutral-left",
      "incongruent-right",
      "congruent-left",
      "congruent-right",
      "incongruent-left",
      "neutral-left",
      "neutral-right",
      "incongruent-left",
      "congruent-left",
      "neutral-right",
      "congruent-right",
      "neutral-left",
      "incongruent-right",
      "congruent-right",
      "incongruent-left",
      "neutral-left",
      "incongruent-right",
      "congruent-left",
      "neutral-right",
      "congruent-right",
      "congruent-left",
      "incongruent-right",
      "neutral-right",
      "incongruent-left",
      "neutral-left",
      "congruent-left",
      "neutral-right",
      "neutral-left",
      "congruent-right",
      "incongruent-right",
      "incongruent-left",
      "congruent-left",
      "incongruent-right",
      "neutral-left",
      "neutral-right",
      "incongruent-left",
      "congruent-right",
      "incongruent-right",
      "congruent-left",
      "congruent-right",
      "neutral-left",
      "incongruent-left",
      "neutral-right",
    ],
    practice: [
      "incongruent-right",
      "neutral-left",
      "congruent-right",
      "congruent-left",
      "incongruent-left",
      "neutral-right",
      "neutral-left",
      "congruent-right",
      "incongruent-right",
      "incongruent-left",
      "congruent-left",
      "neutral-right",
    ],
    mainCandidates: [1, 1, 8, 1, 1, 1, 1, 1, 1, 1],
    practiceCandidates: [1, 1],
  },
};

const labels = (
  trials: readonly {
    condition: string;
    stimulus: { targetDirection: string };
  }[],
) =>
  trials.map((trial) => `${trial.condition}-${trial.stimulus.targetDirection}`);

const item = (label: string): FlankerItem => {
  const [condition, targetDirection] = label.split("-") as [
    FlankerItem["condition"],
    FlankerItem["targetDirection"],
  ];
  return { condition, targetDirection };
};

describe("Flanker schedule: independent reference schedules (protocol §8)", () => {
  for (const [seed, expected] of Object.entries(REFERENCE)) {
    it(`reproduces the reference practice and main orders for seed ${seed}`, () => {
      const schedule = createFlankerSchedule(Number(seed));
      expect(labels(schedule.practice)).toEqual(expected.practice);
      expect(labels(schedule.main)).toEqual(expected.main);
      expect(schedule.metadata.candidatesPerSet).toEqual({
        practice: expected.practiceCandidates,
        main: expected.mainCandidates,
      });
    });
  }

  it("is identical for the same seed and differs for different seeds", () => {
    expect(createFlankerSchedule(424242)).toEqual(
      createFlankerSchedule(424242),
    );
    expect(labels(createFlankerSchedule(1).main)).not.toEqual(
      labels(createFlankerSchedule(2).main),
    );
  });

  it("derives practice from the separate stream seed XOR 0x9E3779B9", () => {
    expect(flankerPracticeSeed(1234)).toBe(2654436715);
    expect(flankerPracticeSeed(0)).toBe(0x9e3779b9);
    expect(flankerPracticeSeed(0xffffffff)).toBe(
      (0xffffffff ^ 0x9e3779b9) >>> 0,
    );
    const direct = generateBalancedSequence(mulberry32(2654436715), 2);
    expect(direct.items.map(itemLabel)).toEqual(REFERENCE["1234"].practice);
  });

  it("rejects seeds that are not unsigned 32-bit integers", () => {
    for (const seed of [-1, 0x100000000, 1.5, Number.NaN, Infinity]) {
      expect(() => validateFlankerSeed(seed)).toThrow();
      expect(() => createFlankerSchedule(seed)).toThrow();
    }
    expect(validateFlankerSeed(0)).toBe(0);
    expect(validateFlankerSeed(0xffffffff)).toBe(0xffffffff);
  });
});

describe("Flanker schedule: constraint checker against the protocol", () => {
  it("accepts the protocol's feasible witness order repeated ten times", () => {
    const witness = [
      "congruent-left",
      "incongruent-right",
      "neutral-left",
      "congruent-right",
      "incongruent-left",
      "neutral-right",
    ].map(item);
    const repeated = Array.from({ length: 10 }, () => witness).flat();
    expect(meetsFlankerConstraints(repeated)).toBe(true);
  });

  it("rejects a run of four of one condition, four of one direction, and adjacent identical stimuli", () => {
    expect(
      meetsFlankerConstraints(
        ["neutral-left", "neutral-right", "neutral-left", "neutral-right"].map(
          item,
        ),
      ),
    ).toBe(false);
    expect(
      meetsFlankerConstraints(
        [
          "congruent-left",
          "neutral-left",
          "incongruent-left",
          "congruent-left",
        ].map(item),
      ),
    ).toBe(false);
    expect(
      meetsFlankerConstraints(
        ["incongruent-right", "incongruent-right"].map(item),
      ),
    ).toBe(false);
    // Exactly three is allowed.
    expect(
      meetsFlankerConstraints(
        [
          "neutral-left",
          "neutral-right",
          "neutral-left",
          "congruent-right",
        ].map(item),
      ),
    ).toBe(true);
    expect(
      meetsFlankerConstraints(
        [
          "congruent-left",
          "neutral-left",
          "incongruent-left",
          "congruent-right",
        ].map(item),
      ),
    ).toBe(true);
  });

  it("checks a candidate set together with the last three accepted trials", () => {
    const accepted = [
      "congruent-right",
      "neutral-left",
      "incongruent-left",
      "congruent-left",
    ].map(item);
    // Candidate starting with a left target makes four lefts across the boundary.
    const candidate = [
      "neutral-left",
      "congruent-right",
      "incongruent-right",
      "neutral-right",
      "congruent-left",
      "incongruent-left",
    ].map(item);
    expect(acceptsCandidate(accepted, candidate)).toBe(false);
    // Only the last three accepted trials matter: dropping the earlier ones changes nothing.
    expect(acceptsCandidate(accepted.slice(-3), candidate)).toBe(false);
  });

  it("throws an explicit generation error instead of relaxing constraints", () => {
    expect(() => generateBalancedSequence(mulberry32(1), 10, 0)).toThrow(
      FlankerScheduleGenerationError,
    );
    expect(() => generateBalancedSequence(mulberry32(1), 10, 0)).toThrow(
      /balancing set 1 had no acceptable order within 0 candidates/,
    );
  });
});

describe("Flanker schedule: balance and constraints across 2,000 seeds", () => {
  it("meets every protocol count and sequence constraint", () => {
    const allItems = FLANKER_BASE_ITEMS.map(itemLabel).sort();
    for (let seed = 0; seed < 2000; seed++) {
      const { trials: main } = createFlankerMainSchedule(seed);
      const { trials: practice } = createFlankerPracticeSchedule(seed);
      const mainLabels = labels(main);
      const practiceLabels = labels(practice);

      expect(main).toHaveLength(60);
      expect(practice).toHaveLength(12);
      // Every six-trial set contains each condition × direction item once.
      for (let start = 0; start < 60; start += 6) {
        expect(mainLabels.slice(start, start + 6).sort()).toEqual(allItems);
      }
      for (let start = 0; start < 12; start += 6) {
        expect(practiceLabels.slice(start, start + 6).sort()).toEqual(allItems);
      }
      for (const condition of FLANKER_CONDITIONS) {
        for (const direction of FLANKER_DIRECTIONS) {
          const key = `${condition}-${direction}`;
          expect(mainLabels.filter((label) => label === key)).toHaveLength(10);
          expect(practiceLabels.filter((label) => label === key)).toHaveLength(
            2,
          );
        }
      }
      expect(meetsFlankerConstraints(mainLabels.map(item))).toBe(true);
      expect(meetsFlankerConstraints(practiceLabels.map(item))).toBe(true);
      expect(main.map((trial) => trial.index)).toEqual(
        Array.from({ length: 60 }, (_, index) => index + 1),
      );
      expect(new Set(main.map((trial) => trial.trialId)).size).toBe(60);
    }
    // 2,000 seeds × 72 trials of assertions: allow time when the whole suite
    // runs in parallel (the checks themselves are unchanged).
  }, 60_000);

  it("matches the configured counts", () => {
    const schedule = createFlankerSchedule(7);
    expect(schedule.main).toHaveLength(FLANKER_CONFIGURATION.main.trialCount);
    expect(schedule.practice).toHaveLength(
      FLANKER_CONFIGURATION.practice.trialCount,
    );
  });
});
