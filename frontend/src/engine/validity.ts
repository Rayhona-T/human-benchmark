import type { EngineResponse, TrialOutcome } from "./contracts";

export function classifyResponseOutcome<TResponse>(
  actualResponse: EngineResponse<TResponse>,
  correctResponse: TResponse,
): TrialOutcome {
  if (!actualResponse.accepted) {
    return { category: "invalid", reason: "protocol_error" };
  }
  return actualResponse.value === correctResponse
    ? { category: "correct" }
    : { category: "incorrect" };
}

export function timeoutOutcome(): TrialOutcome {
  return { category: "timeout" };
}

export function invalidOutcome(
  reason:
    | "focus_lost"
    | "visibility_lost"
    | "presentation_failed"
    | "input_failed"
    | "timing_error"
    | "deadline_unavailable"
    | "interrupt"
    | "protocol_error",
): TrialOutcome {
  return { category: "invalid", reason };
}
