import {
  STROOP_COLOR_WORDS,
  STROOP_COLORS,
  STROOP_INK_HEX,
  STROOP_NEUTRAL_WORDS,
  STROOP_PRNG_ID,
  type StroopColor,
  type StroopSchedule,
  type StroopTrial,
  type StroopWord,
} from "./stroop";

interface Mulberry32 {
  (): number;
}

export function validateSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("Stroop seed must be an unsigned 32-bit integer.");
  }
  return seed >>> 0;
}

export function createMulberry32(seed: number): Mulberry32 {
  let state = validateSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= Math.imul(t ^ (t >>> 7), t | 61);
    t = (t ^ (t >>> 14)) >>> 0;
    return t / 0x100000000;
  };
}

export function enumerateDerangements(): readonly (readonly number[])[] {
  const result: number[][] = [];
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      for (let c = 0; c < 4; c++) {
        for (let d = 0; d < 4; d++) {
          const permutation = [a, b, c, d];
          if (
            new Set(permutation).size === 4 &&
            permutation.every((target, source) => target !== source)
          ) {
            result.push(permutation);
          }
        }
      }
    }
  }
  return result;
}

export function fisherYates<T>(items: readonly T[], random: Mulberry32): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const chosen = Math.floor(random() * (index + 1));
    [copy[index], copy[chosen]] = [copy[chosen], copy[index]];
  }
  return copy;
}

export function getCorrectKey(color: StroopColor): "d" | "f" | "j" | "k" {
  const mapping = {
    red: "d",
    blue: "f",
    green: "j",
    yellow: "k",
  } as const;
  return mapping[color];
}

function createStimulus(
  word: StroopWord,
  inkColor: StroopColor,
): StroopTrial["stimulus"] {
  return {
    word,
    inkColor,
    inkHex: STROOP_INK_HEX[inkColor],
    fontSizePx: 48,
    fontWeight: 700,
    fontFamily: "Arial, Helvetica, sans-serif",
    background: "#111827",
  };
}

export function createPracticeSchedule(seed: number): readonly StroopTrial[] {
  const practiceSeed = (validateSeed(seed) ^ 0x9e3779b9) >>> 0;
  const random = createMulberry32(practiceSeed);

  const derangements = enumerateDerangements();
  const derangementIndex = Math.floor(random() * derangements.length);
  const derangement = derangements[derangementIndex];
  const pool: StroopTrial[] = [];

  for (let colorIndex = 0; colorIndex < 4; colorIndex++) {
    const color = STROOP_COLORS[colorIndex];
    const word = STROOP_COLOR_WORDS[colorIndex];
    pool.push({
      trialId: `${seed >>> 0}-practice-${pool.length + 1}`,
      index: pool.length + 1,
      phase: "practice",
      condition: "congruent",
      stimulus: createStimulus(word, color),
      correctResponse: getCorrectKey(color),
    });
  }

  for (let sourceIndex = 0; sourceIndex < 4; sourceIndex++) {
    const inkIndex = derangement[sourceIndex];
    const word = STROOP_COLOR_WORDS[sourceIndex];
    const inkColor = STROOP_COLORS[inkIndex];
    pool.push({
      trialId: `${seed >>> 0}-practice-${pool.length + 1}`,
      index: pool.length + 1,
      phase: "practice",
      condition: "incongruent",
      stimulus: createStimulus(word, inkColor),
      correctResponse: getCorrectKey(inkColor),
    });
  }

  const words = fisherYates(STROOP_NEUTRAL_WORDS, random).slice(0, 4);
  const inkColors = fisherYates(STROOP_COLORS, random);
  for (let index = 0; index < 4; index++) {
    const inkColor = inkColors[index];
    pool.push({
      trialId: `${seed >>> 0}-practice-${pool.length + 1}`,
      index: pool.length + 1,
      phase: "practice",
      condition: "neutral",
      stimulus: createStimulus(words[index], inkColor),
      correctResponse: getCorrectKey(inkColor),
    });
  }

  return fisherYates(pool, random).map((trial, index) => ({
    ...trial,
    trialId: `${seed >>> 0}-practice-${index + 1}`,
    index: index + 1,
  }));
}

export function createMainSchedule(seed: number): {
  trials: readonly StroopTrial[];
  selectedDerangement: readonly number[];
} {
  const random = createMulberry32(seed);
  const derangements = enumerateDerangements();
  const derangementIndex = Math.floor(random() * derangements.length);
  const derangement = derangements[derangementIndex];
  const pool: StroopTrial[] = [];

  for (let colorIndex = 0; colorIndex < 4; colorIndex++) {
    const color = STROOP_COLORS[colorIndex];
    const word = STROOP_COLOR_WORDS[colorIndex];
    for (let repeat = 0; repeat < 5; repeat++) {
      pool.push({
        trialId: "",
        index: 0,
        phase: "main",
        condition: "congruent",
        stimulus: createStimulus(word, color),
        correctResponse: getCorrectKey(color),
      });
    }
  }

  for (let sourceIndex = 0; sourceIndex < 4; sourceIndex++) {
    const selectedInk = derangement[sourceIndex];
    pool.push({
      trialId: "",
      index: 0,
      phase: "main",
      condition: "incongruent",
      stimulus: createStimulus(
        STROOP_COLOR_WORDS[sourceIndex],
        STROOP_COLORS[selectedInk],
      ),
      correctResponse: getCorrectKey(STROOP_COLORS[selectedInk]),
    });
  }

  for (let sourceIndex = 0; sourceIndex < 4; sourceIndex++) {
    for (let inkIndex = 0; inkIndex < 4; inkIndex++) {
      if (inkIndex === sourceIndex || inkIndex === derangement[sourceIndex]) {
        continue;
      }
      pool.push({
        trialId: "",
        index: 0,
        phase: "main",
        condition: "incongruent",
        stimulus: createStimulus(
          STROOP_COLOR_WORDS[sourceIndex],
          STROOP_COLORS[inkIndex],
        ),
        correctResponse: getCorrectKey(STROOP_COLORS[inkIndex]),
      });
      pool.push({
        trialId: "",
        index: 0,
        phase: "main",
        condition: "incongruent",
        stimulus: createStimulus(
          STROOP_COLOR_WORDS[sourceIndex],
          STROOP_COLORS[inkIndex],
        ),
        correctResponse: getCorrectKey(STROOP_COLORS[inkIndex]),
      });
    }
  }

  for (const word of STROOP_NEUTRAL_WORDS) {
    for (const inkColor of STROOP_COLORS) {
      pool.push({
        trialId: "",
        index: 0,
        phase: "main",
        condition: "neutral",
        stimulus: createStimulus(word, inkColor),
        correctResponse: getCorrectKey(inkColor),
      });
    }
  }

  for (let candidate = 0; candidate < 10000; candidate++) {
    const shuffled = fisherYates(pool, random);
    if (meetsMainConstraints(shuffled)) {
      const realized = shuffled.map((trial, index) => ({
        ...trial,
        trialId: `${seed >>> 0}-main-${index + 1}`,
        index: index + 1,
      }));
      return {
        trials: realized,
        selectedDerangement: derangement,
      };
    }
  }
  throw new Error("Unable to generate a Stroop main schedule within limits.");
}

function meetsMainConstraints(trials: readonly StroopTrial[]): boolean {
  let conditionRun = 1;
  for (let index = 1; index < trials.length; index++) {
    if (trials[index].condition === trials[index - 1].condition) {
      conditionRun++;
      if (conditionRun > 3) return false;
    } else {
      conditionRun = 1;
    }
    const previous = trials[index - 1].stimulus;
    const current = trials[index].stimulus;
    if (
      previous.word === current.word &&
      previous.inkColor === current.inkColor
    ) {
      return false;
    }
  }
  return true;
}

export function createStroopSchedule(seed: number): StroopSchedule {
  const validatedSeed = validateSeed(seed);
  const practice = createPracticeSchedule(validatedSeed);
  const mainResult = createMainSchedule(validatedSeed);
  return {
    practice,
    main: mainResult.trials,
    metadata: {
      seedUnsigned32: validatedSeed,
      prngAndScheduleId: STROOP_PRNG_ID,
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
      selectedDerangement: mainResult.selectedDerangement,
      realizedPracticeOrder: practice,
      realizedMainOrder: mainResult.trials,
      practiceSeedUnsigned32: (validatedSeed ^ 0x9e3779b9) >>> 0,
    },
  };
}
