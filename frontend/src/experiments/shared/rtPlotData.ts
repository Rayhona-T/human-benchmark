/**
 * Pure data preparation for the per-condition response-time dot plot.
 * Uses only values already computed by `computeSessionResults`; nothing is
 * recalculated, trimmed, or inferred here.
 */
import type {
  MedianValue,
  SessionResults,
  TrialPoint,
} from "./sessionAnalysis";

export interface RtPlotRow<TCondition extends string = string> {
  condition: TCondition;
  /** RTs of correct responses with a usable time (each one is plotted). */
  correctMs: readonly number[];
  /** RTs of incorrect responses (plotted distinctly; never in the median). */
  incorrectMs: readonly number[];
  timeouts: number;
  invalid: number;
  /** Correct responses without a usable RT (cannot be plotted). */
  correctMissingRt: number;
  /** The approved median (shown only when it meets the display rule). */
  median: MedianValue;
}

export interface RtPlotData<TCondition extends string = string> {
  rows: readonly RtPlotRow<TCondition>[];
  /** Axis maximum: the response window, or a larger observed RT (never hide). */
  domainMaxMs: number;
}

/**
 * Builds plot rows from a complete session's results. Returns null for
 * incomplete sessions (counts-only rule) or when no trial series exists.
 */
export function buildRtPlotData<TCondition extends string>(
  results: SessionResults<TCondition>,
  responseWindowMs: number,
): RtPlotData<TCondition> | null {
  if (!results.isComplete || !results.conditions || !results.trialSeries) {
    return null;
  }
  const byCondition = new Map<TCondition, TrialPoint<TCondition>[]>();
  for (const point of results.trialSeries) {
    const list = byCondition.get(point.condition) ?? [];
    list.push(point);
    byCondition.set(point.condition, list);
  }
  let largest = 0;
  const rows = results.conditions.map((summary) => {
    const points = byCondition.get(summary.condition) ?? [];
    const withRt = (outcome: "correct" | "incorrect") =>
      points
        .filter(
          (point) => point.outcome === outcome && point.reactionTimeMs !== null,
        )
        .map((point) => point.reactionTimeMs as number);
    const correctMs = withRt("correct");
    const incorrectMs = withRt("incorrect");
    for (const value of [...correctMs, ...incorrectMs]) {
      largest = Math.max(largest, value);
    }
    return {
      condition: summary.condition,
      correctMs,
      incorrectMs,
      timeouts: summary.counts.timeout,
      invalid: summary.counts.invalid,
      correctMissingRt: summary.correctMissingRt,
      median: summary.medianCorrectRt,
    };
  });
  return { rows, domainMaxMs: Math.max(responseWindowMs, largest) };
}

/**
 * Deterministic "dodge" layout: assigns each x position (in pixels) a lane
 * 0, +1, −1, +2, −2, … so that markers whose centers are closer than
 * `minGapPx` never share a lane. Returns one lane per input, in input order.
 */
export function dodgeLanes(xs: readonly number[], minGapPx: number): number[] {
  const order = xs
    .map((x, index) => ({ x, index }))
    .sort((a, b) => a.x - b.x || a.index - b.index);
  const lastXInLane = new Map<number, number>();
  const lanes = new Array<number>(xs.length);
  for (const { x, index } of order) {
    for (let step = 0; ; step++) {
      const lane = step === 0 ? 0 : step % 2 === 1 ? (step + 1) / 2 : -step / 2;
      const last = lastXInLane.get(lane);
      if (last === undefined || x - last >= minGapPx) {
        lastXInLane.set(lane, x);
        lanes[index] = lane;
        break;
      }
    }
  }
  return lanes;
}

/**
 * Greedy line wrapping for SVG text (which cannot wrap by itself): joins
 * tokens with `separator` while a line stays within `maxChars`. A single
 * token longer than `maxChars` gets its own line rather than being cut.
 */
export function wrapTokens(
  tokens: readonly string[],
  separator: string,
  maxChars: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    const candidate = current === "" ? token : `${current}${separator}${token}`;
    if (current !== "" && candidate.length > maxChars) {
      lines.push(current);
      current = token;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}
