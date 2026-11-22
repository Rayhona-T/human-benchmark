import { describe, expect, it } from "vitest";
import {
  FLANKER_CONFIGURATION,
  FLANKER_MAPPING_CHECK,
  FLANKER_PRESENTATION,
  FLANKER_PRNG_ID,
  FLANKER_RESPONSE_MAPPING,
  canDisplayFlankerArray,
  flankerArrayFitsViewport,
  createFlankerStimulus,
  evaluateMappingCheckKey,
  getFlankerCorrectKey,
} from "./flanker";
import { flankerAdapter, flankerRandomizationMetadata } from "./flankerAdapter";
import { createFlankerSchedule } from "./flankerSchedule";

describe("Flanker protocol configuration (HB-FLANKER-1.0 §2, §6, §7)", () => {
  it("uses the approved HB-FLANKER-1.0 identity", () => {
    expect(FLANKER_CONFIGURATION.experimentId).toBe("flanker");
    expect(FLANKER_CONFIGURATION.protocolId).toBe("HB-FLANKER-1.0");
    expect(FLANKER_CONFIGURATION.protocolVersion).toBe("1.0");
    expect(FLANKER_PRNG_ID).toBe("HB-FLANKER-shuffle-v1");
  });

  it("uses the protocol's counts, timing, feedback, and break values", () => {
    expect(FLANKER_CONFIGURATION.practice).toEqual({
      trialCount: 12,
      responseDeadlineMs: 2000,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: true,
    });
    expect(FLANKER_CONFIGURATION.main).toEqual({
      trialCount: 60,
      responseDeadlineMs: 2000,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: false,
      breakAfterTrialIndex: 30,
    });
    expect(FLANKER_CONFIGURATION.conditions).toEqual([
      "congruent",
      "incongruent",
      "neutral",
    ]);
    expect(FLANKER_CONFIGURATION.neutralCondition).toBe("neutral");
    expect(FLANKER_CONFIGURATION.minimumCorrectResponsesForMedian).toBe(10);
  });
});

describe("Flanker stimuli (protocol §4 table)", () => {
  it("produces exactly the six arrays in the protocol table", () => {
    // Literal strings from the protocol, written independently of the code.
    const expected = {
      "congruent-left": "←←←←←",
      "congruent-right": "→→→→→",
      "incongruent-left": "→→←→→",
      "incongruent-right": "←←→←←",
      "neutral-left": "——←——",
      "neutral-right": "——→——",
    } as const;
    for (const [key, text] of Object.entries(expected)) {
      const [condition, direction] = key.split("-") as [
        "congruent" | "incongruent" | "neutral",
        "left" | "right",
      ];
      const stimulus = createFlankerStimulus(condition, direction);
      expect(stimulus.text, key).toBe(text);
      expect(stimulus.cells, key).toHaveLength(5);
      expect(stimulus.cells[2], key).toBe(direction === "left" ? "←" : "→");
    }
  });

  it("makes the target the only possible difference between flankers and response", () => {
    expect(createFlankerStimulus("incongruent", "left").flankerType).toBe(
      "right",
    );
    expect(createFlankerStimulus("congruent", "right").flankerType).toBe(
      "right",
    );
    expect(createFlankerStimulus("neutral", "left").flankerType).toBe(
      "neutral",
    );
  });

  it("specifies the protocol geometry and colors", () => {
    expect(FLANKER_PRESENTATION).toMatchObject({
      cellCount: 5,
      targetCellIndex: 2,
      cellSizePx: 48,
      cellGapPx: 8,
      fontSizePx: 40,
      lineHeightPx: 48,
      fontWeight: 700,
      fontFamily: "Arial, Helvetica, sans-serif",
      symbolColor: "#F9FAFB",
      background: "#111827",
    });
    // Derived values checked by arithmetic, not copied from the code.
    expect(FLANKER_PRESENTATION.arrayWidthPx).toBe(5 * 48 + 4 * 8);
    expect(FLANKER_PRESENTATION.symbolCenterSpacingPx).toBe(48 + 8);
  });

  it("refuses to start a trial when the full array cannot be displayed", () => {
    expect(canDisplayFlankerArray(272)).toBe(true);
    expect(canDisplayFlankerArray(271.9)).toBe(false);
    expect(canDisplayFlankerArray(Number.NaN)).toBe(false);
  });

  it("requires the array to be inside the visible window, not just the layout", () => {
    // Regression (browser-found): below ~339 px the site layout stops
    // shrinking and overflows. A 288 px stage at x=16 in a 240 px window
    // places the array at 24..296, partly off-screen.
    expect(flankerArrayFitsViewport(16, 288, 240)).toBe(false);
    // Same layout in a window wide enough to show it: 24 + 272 = 296.
    expect(flankerArrayFitsViewport(16, 288, 296)).toBe(true);
    expect(flankerArrayFitsViewport(16, 288, 295.5)).toBe(false);
    // Typical phone and desktop layouts.
    expect(flankerArrayFitsViewport(16, 358, 390)).toBe(true);
    expect(flankerArrayFitsViewport(80, 1120, 1280)).toBe(true);
    // Stage scrolled partly off the left edge.
    expect(flankerArrayFitsViewport(-40, 288, 400)).toBe(false);
    // Stage too narrow even if fully visible.
    expect(flankerArrayFitsViewport(0, 271, 1000)).toBe(false);
    expect(flankerArrayFitsViewport(Number.NaN, 300, 400)).toBe(false);
  });
});

describe("Flanker response mapping and mapping check (protocol §5)", () => {
  it("maps logical F to Left and J to Right", () => {
    expect(FLANKER_RESPONSE_MAPPING).toEqual([
      { responseValue: "f", logicalKey: "f", label: "Left" },
      { responseValue: "j", logicalKey: "j", label: "Right" },
    ]);
    expect(getFlankerCorrectKey("left")).toBe("f");
    expect(getFlankerCorrectKey("right")).toBe("j");
  });

  it("requires F for the left arrow, then J for the right arrow, repeating after a wrong key", () => {
    expect(FLANKER_MAPPING_CHECK).toEqual([
      { targetDirection: "left", requiredKey: "f" },
      { targetDirection: "right", requiredKey: "j" },
    ]);
    expect(evaluateMappingCheckKey(0, "j")).toBe("repeat");
    expect(evaluateMappingCheckKey(0, "F")).toBe("advance");
    expect(evaluateMappingCheckKey(1, "f")).toBe("repeat");
    expect(evaluateMappingCheckKey(1, "j")).toBe("advance");
    expect(evaluateMappingCheckKey(0, "x")).toBe("ignored");
    expect(evaluateMappingCheckKey(0, "f", true)).toBe("ignored");
    expect(evaluateMappingCheckKey(2, "f")).toBe("ignored");
  });
});

describe("Flanker adapter", () => {
  const schedule = createFlankerSchedule(1234);

  it("derives correctness from the center arrow only", () => {
    for (const trial of [...schedule.practice, ...schedule.main]) {
      const expectedKey = trial.stimulus.targetDirection === "left" ? "f" : "j";
      expect(trial.correctResponse).toBe(expectedKey);
      expect(flankerAdapter.getCorrectResponse(trial)).toBe(expectedKey);
    }
    const incongruent = schedule.main.find(
      (trial) => trial.condition === "incongruent",
    );
    if (!incongruent) throw new Error("no incongruent trial");
    const flankerKey = incongruent.stimulus.flankerType === "left" ? "f" : "j";
    const response = (value: "f" | "j") => ({
      value,
      inputSource: "keyboard" as const,
      timestampMs: 100,
      accepted: true,
    });
    expect(
      flankerAdapter.classifyResponse(incongruent, response(flankerKey)),
    ).toEqual({
      category: "incorrect",
    });
    expect(
      flankerAdapter.classifyResponse(
        incongruent,
        response(incongruent.correctResponse),
      ),
    ).toEqual({ category: "correct" });
    expect(
      flankerAdapter.classifyResponse(incongruent, {
        ...response(incongruent.correctResponse),
        accepted: false,
      }),
    ).toEqual({ category: "invalid", reason: "protocol_error" });
  });

  it("builds session randomization metadata sufficient to audit the schedule", () => {
    const metadata = flankerRandomizationMetadata(schedule);
    expect(metadata).toMatchObject({
      seedUnsigned32: 1234,
      prngAndScheduleId: "HB-FLANKER-shuffle-v1",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
    });
    expect(metadata.realizedMainOrder).toBe(schedule.main);
    expect(metadata.realizedPracticeOrder).toBe(schedule.practice);
    expect(metadata.allocationDetails).toEqual({
      practiceSeedUnsigned32: 2654436715,
      baseItemOrder: [
        "congruent-left",
        "congruent-right",
        "incongruent-left",
        "incongruent-right",
        "neutral-left",
        "neutral-right",
      ],
    });
  });
});
