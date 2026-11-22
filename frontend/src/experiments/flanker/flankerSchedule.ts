/**
 * HB-FLANKER-1.0 §8 schedule generation ("HB-FLANKER-shuffle-v1").
 *
 * Main: 10 concealed six-item balancing sets from mulberry32(seed).
 * Practice: 2 sets from mulberry32((seed XOR 0x9E3779B9) >>> 0).
 * Each set is a Fisher–Yates shuffle of the six condition × direction items,
 * accepted only if, together with up to the last three accepted trials, there
 * is no run > 3 of one condition, no run > 3 of one target direction, and no
 * identical stimulus on adjacent trials. Rejected sets are reshuffled from the
 * same base order with the continuing stream; at most 10,000 candidates per
 * set, then an explicit error (no relaxed constraints, no fallback order).
 */
import {
  fisherYates,
  isUint32Seed,
  mulberry32,
  type RandomSource,
} from "../shared/seededRandom";
import {
  FLANKER_CONFIGURATION,
  FLANKER_PRNG_ID,
  FLANKER_RANDOMIZATION_VERSION,
  createFlankerStimulus,
  getFlankerCorrectKey,
  type FlankerCondition,
  type FlankerDirection,
  type FlankerSchedule,
  type FlankerTrial,
} from "./flanker";

export interface FlankerItem {
  condition: FlankerCondition;
  targetDirection: FlankerDirection;
}

/**
 * Base order: conditions then directions, as listed in protocol §8.3. The
 * protocol does not state this order explicitly; it is an implementation
 * choice that determines which schedule a seed produces (see FLANKER_ADAPTER.md).
 */
export const FLANKER_BASE_ITEMS: readonly FlankerItem[] = [
  { condition: "congruent", targetDirection: "left" },
  { condition: "congruent", targetDirection: "right" },
  { condition: "incongruent", targetDirection: "left" },
  { condition: "incongruent", targetDirection: "right" },
  { condition: "neutral", targetDirection: "left" },
  { condition: "neutral", targetDirection: "right" },
];

export const FLANKER_MAIN_SETS = 10;
export const FLANKER_PRACTICE_SETS = 2;
export const FLANKER_MAX_CANDIDATES_PER_SET = 10_000;
export const FLANKER_MAX_RUN = 3;
export const FLANKER_PRACTICE_SEED_XOR = 0x9e3779b9;

export const itemLabel = (item: FlankerItem) =>
  `${item.condition}-${item.targetDirection}`;

export class FlankerScheduleGenerationError extends Error {
  constructor(setIndex: number, maxCandidates: number) {
    super(
      `Flanker schedule generation failed: balancing set ${setIndex + 1} had no acceptable order within ${maxCandidates} candidates.`,
    );
    this.name = "FlankerScheduleGenerationError";
  }
}

export function validateFlankerSeed(seed: number): number {
  if (!isUint32Seed(seed)) {
    throw new Error("Flanker seed must be an unsigned 32-bit integer.");
  }
  return seed >>> 0;
}

export function flankerPracticeSeed(seed: number): number {
  return (validateFlankerSeed(seed) ^ FLANKER_PRACTICE_SEED_XOR) >>> 0;
}

/**
 * True when a sequence satisfies the protocol constraints: no run longer than
 * three of one condition or one target direction, and no two adjacent
 * identical stimuli (identical condition + direction ⇔ identical five-symbol
 * string, because the six patterns are distinct).
 */
export function meetsFlankerConstraints(
  sequence: readonly FlankerItem[],
): boolean {
  let conditionRun = 1;
  let directionRun = 1;
  for (let index = 1; index < sequence.length; index++) {
    const previous = sequence[index - 1];
    const current = sequence[index];
    if (
      previous.condition === current.condition &&
      previous.targetDirection === current.targetDirection
    ) {
      return false;
    }
    conditionRun =
      previous.condition === current.condition ? conditionRun + 1 : 1;
    directionRun =
      previous.targetDirection === current.targetDirection
        ? directionRun + 1
        : 1;
    if (conditionRun > FLANKER_MAX_RUN || directionRun > FLANKER_MAX_RUN) {
      return false;
    }
  }
  return true;
}

/** Protocol §8.4: check the candidate with up to the last three accepted trials. */
export function acceptsCandidate(
  accepted: readonly FlankerItem[],
  candidate: readonly FlankerItem[],
): boolean {
  return meetsFlankerConstraints([...accepted.slice(-3), ...candidate]);
}

export function generateBalancedSequence(
  random: RandomSource,
  setCount: number,
  maxCandidatesPerSet = FLANKER_MAX_CANDIDATES_PER_SET,
): { items: FlankerItem[]; candidatesPerSet: number[] } {
  const items: FlankerItem[] = [];
  const candidatesPerSet: number[] = [];
  for (let setIndex = 0; setIndex < setCount; setIndex++) {
    let accepted = false;
    for (let attempt = 1; attempt <= maxCandidatesPerSet; attempt++) {
      const candidate = fisherYates(FLANKER_BASE_ITEMS, random);
      if (acceptsCandidate(items, candidate)) {
        items.push(...candidate);
        candidatesPerSet.push(attempt);
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      throw new FlankerScheduleGenerationError(setIndex, maxCandidatesPerSet);
    }
  }
  return { items, candidatesPerSet };
}

function toTrials(
  items: readonly FlankerItem[],
  seed: number,
  phase: "practice" | "main",
): FlankerTrial[] {
  return items.map((item, index) => ({
    trialId: `${seed}-${phase}-${index + 1}`,
    index: index + 1,
    phase,
    condition: item.condition,
    stimulus: createFlankerStimulus(item.condition, item.targetDirection),
    correctResponse: getFlankerCorrectKey(item.targetDirection),
  }));
}

export function createFlankerMainSchedule(seed: number) {
  const validated = validateFlankerSeed(seed);
  const result = generateBalancedSequence(
    mulberry32(validated),
    FLANKER_MAIN_SETS,
  );
  return {
    trials: toTrials(result.items, validated, "main"),
    candidatesPerSet: result.candidatesPerSet,
  };
}

export function createFlankerPracticeSchedule(seed: number) {
  const validated = validateFlankerSeed(seed);
  const result = generateBalancedSequence(
    mulberry32(flankerPracticeSeed(validated)),
    FLANKER_PRACTICE_SETS,
  );
  return {
    trials: toTrials(result.items, validated, "practice"),
    candidatesPerSet: result.candidatesPerSet,
  };
}

export function createFlankerSchedule(seed: number): FlankerSchedule {
  const validated = validateFlankerSeed(seed);
  const practice = createFlankerPracticeSchedule(validated);
  const main = createFlankerMainSchedule(validated);
  if (
    practice.trials.length !== FLANKER_CONFIGURATION.practice.trialCount ||
    main.trials.length !== FLANKER_CONFIGURATION.main.trialCount
  ) {
    throw new Error("Flanker schedule length does not match configuration.");
  }
  return {
    practice: practice.trials,
    main: main.trials,
    metadata: {
      seedUnsigned32: validated,
      prngAndScheduleId: FLANKER_PRNG_ID,
      randomizationConfigurationVersion: FLANKER_RANDOMIZATION_VERSION,
      scheduleGenerationStatus: "generated",
      practiceSeedUnsigned32: flankerPracticeSeed(validated),
      baseItemOrder: FLANKER_BASE_ITEMS.map(itemLabel),
      candidatesPerSet: {
        practice: practice.candidatesPerSet,
        main: main.candidatesPerSet,
      },
      realizedPracticeOrder: practice.trials,
      realizedMainOrder: main.trials,
    },
  };
}
