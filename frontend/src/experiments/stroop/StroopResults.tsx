import type { TrialRecord } from "../../engine/contracts";
import { SessionResults } from "../shared/SessionResults";
import { STROOP_CONFIGURATION, type StroopStimulus } from "./stroop";
import type { StroopSessionResults } from "./stroopAnalysis";
import {
  STROOP_EXPORT_COLUMNS,
  STROOP_RESULTS_COPY,
} from "./stroopResultsFormat";

export function StroopResults({
  results,
  records,
}: {
  results: StroopSessionResults;
  /** The session's own records, for the optional local CSV download. */
  records?: readonly TrialRecord<StroopStimulus, string, unknown>[];
}) {
  return (
    <SessionResults
      results={results}
      copy={STROOP_RESULTS_COPY}
      responseWindowMs={STROOP_CONFIGURATION.main.responseDeadlineMs}
      exportData={
        records
          ? {
              experimentId: "stroop",
              records,
              stimulusColumns: STROOP_EXPORT_COLUMNS,
            }
          : undefined
      }
    />
  );
}
