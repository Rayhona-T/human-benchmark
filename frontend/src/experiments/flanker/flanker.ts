/**
 * Flanker protocol definitions (HB-FLANKER-1.0, approved in Cycle 6).
 *
 * Every value here is taken from docs/experiments/FLANKER_PROTOCOL.md. The
 * protocol is a DRAFT awaiting human approval; identifiers carry "-draft" until
 * it is approved. Nothing in this module renders UI.
 */
import type {
  EngineTrial,
  ExperimentConfiguration,
  ResponseMapping,
} from "../../engine/contracts";
import type { Schedule } from "../../engine/interfaces";

export const FLANKER_PROTOCOL_ID = "HB-FLANKER-1.0";
export const FLANKER_CONFIG_ID = "HB-FLANKER-1.0";
export const FLANKER_PRNG_ID = "HB-FLANKER-shuffle-v1";
export const FLANKER_RANDOMIZATION_VERSION = "1";

export type FlankerCondition = "congruent" | "incongruent" | "neutral";
export type FlankerDirection = "left" | "right";
export type FlankerResponse = "f" | "j";

/** Protocol §4 glyphs: U+2190, U+2192, and the em dash U+2014. */
export const FLANKER_SYMBOLS = {
  left: "←",
  right: "→",
  neutral: "—",
} as const;
export type FlankerSymbol =
  (typeof FLANKER_SYMBOLS)[keyof typeof FLANKER_SYMBOLS];

/** Direction (or none) indicated by the four flankers. */
export type FlankerFlankerType = FlankerDirection | "neutral";

export interface FlankerStimulus {
  condition: FlankerCondition;
  targetDirection: FlankerDirection;
  flankerType: FlankerFlankerType;
  /** Exactly five cells; index 2 is the target. */
  cells: readonly [
    FlankerSymbol,
    FlankerSymbol,
    FlankerSymbol,
    FlankerSymbol,
    FlankerSymbol,
  ];
  /** The five symbols without separators, e.g. "←←→←←". */
  text: string;
}

export type FlankerTrial = EngineTrial<
  FlankerStimulus,
  FlankerCondition,
  FlankerResponse
>;

export const FLANKER_CONDITIONS: readonly FlankerCondition[] = [
  "congruent",
  "incongruent",
  "neutral",
];
export const FLANKER_DIRECTIONS: readonly FlankerDirection[] = [
  "left",
  "right",
];

/** Protocol §4: congruent = same direction, incongruent = opposite, neutral = dashes. */
export function flankerTypeFor(
  condition: FlankerCondition,
  target: FlankerDirection,
): FlankerFlankerType {
  if (condition === "neutral") return "neutral";
  if (condition === "congruent") return target;
  return target === "left" ? "right" : "left";
}

export function createFlankerStimulus(
  condition: FlankerCondition,
  targetDirection: FlankerDirection,
): FlankerStimulus {
  const flankerType = flankerTypeFor(condition, targetDirection);
  const flanker = FLANKER_SYMBOLS[flankerType];
  const target = FLANKER_SYMBOLS[targetDirection];
  const cells = [flanker, flanker, target, flanker, flanker] as const;
  return {
    condition,
    targetDirection,
    flankerType,
    cells,
    text: cells.join(""),
  };
}

/**
 * Protocol §4 visual presentation (CSS pixels). These are layout rules, not
 * guarantees of visual angle or physical size.
 */
export const FLANKER_PRESENTATION = {
  cellCount: 5,
  targetCellIndex: 2,
  cellSizePx: 48,
  cellGapPx: 8,
  /** 5 × 48 + 4 × 8. */
  arrayWidthPx: 272,
  /** Adjacent symbol centers: 48 + 8. */
  symbolCenterSpacingPx: 56,
  fontFamily: "Arial, Helvetica, sans-serif",
  fontWeight: 700,
  fontSizePx: 40,
  lineHeightPx: 48,
  symbolColor: "#F9FAFB",
  background: "#111827",
} as const;

/**
 * Protocol §4: if the full array cannot be displayed at its specified
 * geometry, a timed trial must not start (no silent scaling).
 */
export function canDisplayFlankerArray(availableWidthPx: number): boolean {
  return (
    Number.isFinite(availableWidthPx) &&
    availableWidthPx >= FLANKER_PRESENTATION.arrayWidthPx
  );
}

/**
 * Protocol §4 visibility check: the array, centered in a stage of
 * `stageWidthPx` whose left edge is at `stageLeftPx` (viewport coordinates),
 * must fit in the stage AND lie entirely inside the visible viewport
 * `[0, viewportWidthPx]`. A wide layout that extends past a narrow window
 * (horizontal page overflow) therefore does not count as fitting.
 */
export function flankerArrayFitsViewport(
  stageLeftPx: number,
  stageWidthPx: number,
  viewportWidthPx: number,
): boolean {
  if (
    !canDisplayFlankerArray(stageWidthPx) ||
    !Number.isFinite(stageLeftPx) ||
    !Number.isFinite(viewportWidthPx)
  ) {
    return false;
  }
  const arrayLeft =
    stageLeftPx + (stageWidthPx - FLANKER_PRESENTATION.arrayWidthPx) / 2;
  return (
    arrayLeft >= 0 &&
    arrayLeft + FLANKER_PRESENTATION.arrayWidthPx <= viewportWidthPx
  );
}

/** Protocol §5: logical keys, case-insensitive; F = Left, J = Right. */
export const FLANKER_RESPONSE_MAPPING: readonly ResponseMapping<FlankerResponse>[] =
  [
    { responseValue: "f", logicalKey: "f", label: "Left" },
    { responseValue: "j", logicalKey: "j", label: "Right" },
  ];

export function getFlankerCorrectKey(
  direction: FlankerDirection,
): FlankerResponse {
  return direction === "left" ? "f" : "j";
}

/**
 * Protocol §5 untimed mapping check: a central left arrow requiring F, then a
 * central right arrow requiring J. Not scored.
 */
export const FLANKER_MAPPING_CHECK: readonly {
  targetDirection: FlankerDirection;
  requiredKey: FlankerResponse;
}[] = [
  { targetDirection: "left", requiredKey: "f" },
  { targetDirection: "right", requiredKey: "j" },
];

export type MappingCheckResult =
  | "advance"
  /** Wrong mapped key: show the correct mapping and repeat this prompt. */
  | "repeat"
  /** Not a mapped key (or auto-repeat): no effect. */
  | "ignored";

export function evaluateMappingCheckKey(
  stepIndex: number,
  key: string,
  repeat = false,
): MappingCheckResult {
  const step = FLANKER_MAPPING_CHECK[stepIndex];
  if (!step || repeat) return "ignored";
  const pressed = key.toLowerCase();
  const mapped = FLANKER_RESPONSE_MAPPING.some(
    (mapping) => mapping.logicalKey === pressed,
  );
  if (!mapped) return "ignored";
  return pressed === step.requiredKey ? "advance" : "repeat";
}

export interface FlankerScheduleMetadata {
  seedUnsigned32: number;
  prngAndScheduleId: string;
  randomizationConfigurationVersion: string;
  scheduleGenerationStatus: "generated";
  practiceSeedUnsigned32: number;
  /** Base item order shuffled within every balancing set. */
  baseItemOrder: readonly string[];
  /** Candidates drawn for each balancing set (audit aid; 1 = first accepted). */
  candidatesPerSet: { practice: readonly number[]; main: readonly number[] };
  realizedPracticeOrder: readonly FlankerTrial[];
  realizedMainOrder: readonly FlankerTrial[];
}

export type FlankerSchedule = Schedule<FlankerTrial> & {
  metadata: FlankerScheduleMetadata;
};

export const FLANKER_CONFIGURATION: ExperimentConfiguration<
  FlankerStimulus,
  FlankerCondition,
  FlankerResponse
> = {
  experimentId: "flanker",
  protocolId: FLANKER_PROTOCOL_ID,
  protocolVersion: "1.0",
  configurationId: FLANKER_CONFIG_ID,
  configurationVersion: "1.0",
  practice: {
    trialCount: 12,
    responseDeadlineMs: 2000,
    fixationMs: 500,
    interTrialIntervalMs: 500,
    feedbackEnabled: true,
  },
  main: {
    trialCount: 60,
    responseDeadlineMs: 2000,
    fixationMs: 500,
    interTrialIntervalMs: 500,
    feedbackEnabled: false,
    breakAfterTrialIndex: 30,
  },
  stimulusDefinition: createFlankerStimulus("congruent", "left"),
  conditions: FLANKER_CONDITIONS,
  responseMapping: FLANKER_RESPONSE_MAPPING,
  minimumCorrectResponsesForMedian: 10,
  neutralCondition: "neutral",
};
