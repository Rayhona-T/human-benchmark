import type { TrialRecord } from "../../engine/contracts";
import type { ResultsSave } from "../shared/persistence/sessionPayload";
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
  saveData,
}: {
  results: StroopSessionResults;
  /** The session's own records, for the optional local CSV download. */
  records?: readonly TrialRecord<StroopStimulus, string, unknown>[];
  /** The finished session, for the optional development save panel. */
  saveData?: ResultsSave<StroopStimulus>;
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
      saveData={saveData}
    />
  );
}
