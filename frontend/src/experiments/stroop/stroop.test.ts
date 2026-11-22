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
