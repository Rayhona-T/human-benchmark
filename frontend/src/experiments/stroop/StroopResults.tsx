import { SessionResults } from "../shared/SessionResults";
import type { StroopSessionResults } from "./stroopAnalysis";
import { STROOP_RESULTS_COPY } from "./stroopResultsFormat";

export function StroopResults({ results }: { results: StroopSessionResults }) {
  return <SessionResults results={results} copy={STROOP_RESULTS_COPY} />;
}
