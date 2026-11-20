import type { EngineResponse, ResponseMapping } from "./contracts";

export interface KeyboardEventLike {
  key: string;
  repeat: boolean;
}

export type RejectedInputResult = {
  accepted: false;
  reason:
    | "before_activation"
    | "trial_completed"
    | "trial_timed_out"
    | "trial_interrupted"
    | "repeat"
    | "unmapped"
    | "at_or_after_deadline"
    | "duplicate_response"
    | "timing_unavailable";
};

export type AcceptedInputResult<TResponse = string> = {
  accepted: true;
  reason?: undefined;
  response: EngineResponse<TResponse>;
};

export type InputResult<TResponse = string> =
  AcceptedInputResult<TResponse> | RejectedInputResult;

export interface KeyboardInputSource {
  subscribe(listener: (event: KeyboardEventLike) => void): () => void;
}

export class BrowserKeyboardInputSource implements KeyboardInputSource {
  subscribe(listener: (event: KeyboardEventLike) => void): () => void {
    const handler = (event: KeyboardEvent) =>
      listener({ key: event.key, repeat: event.repeat });
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }
}

export type TrialInputStatus =
  "inactive" | "active" | "completed" | "timed_out" | "interrupted";

export class ResponseInputController<TResponse = string> {
  private status: TrialInputStatus = "inactive";
  private unsubscribe: (() => void) | null = null;
  private responded = false;
  private stimulusOnsetMs: number | null = null;
  private deadlineMs: number | null = null;

  private readonly source: KeyboardInputSource;
  private readonly mappings: readonly ResponseMapping<TResponse>[];

  constructor(
    source: KeyboardInputSource,
    mappings: readonly ResponseMapping<TResponse>[],
  ) {
    this.source = source;
    this.mappings = mappings;
  }

  activate(stimulusOnsetMs: number | null, deadlineMs: number | null): void {
    this.status = "active";
    this.responded = false;
    this.stimulusOnsetMs = stimulusOnsetMs;
    this.deadlineMs = deadlineMs;
  }

  attach(
    timestampNow: () => number,
    onResult: (result: InputResult<TResponse>) => void,
  ): void {
    this.detach();
    this.unsubscribe = this.source.subscribe((event) => {
      onResult(this.process(event, timestampNow()));
    });
  }

  detach(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  process(
    event: KeyboardEventLike,
    timestampMs: number,
  ): InputResult<TResponse> {
    if (this.status === "inactive") {
      return { accepted: false, reason: "before_activation" };
    }
    if (this.status === "completed") {
      return { accepted: false, reason: "trial_completed" };
    }
    if (this.status === "timed_out") {
      return { accepted: false, reason: "trial_timed_out" };
    }
    if (this.status === "interrupted") {
      return { accepted: false, reason: "trial_interrupted" };
    }
    if (this.responded) {
      return { accepted: false, reason: "duplicate_response" };
    }
    if (event.repeat) {
      return { accepted: false, reason: "repeat" };
    }
    if (!Number.isFinite(timestampMs)) {
      return { accepted: false, reason: "timing_unavailable" };
    }
    if (this.stimulusOnsetMs === null || timestampMs < this.stimulusOnsetMs) {
      return { accepted: false, reason: "before_activation" };
    }
    if (this.deadlineMs !== null && timestampMs >= this.deadlineMs) {
      return { accepted: false, reason: "at_or_after_deadline" };
    }

    const key = event.key.toLocaleLowerCase();
    const mapping = this.mappings.find(
      (candidate) => candidate.logicalKey.toLocaleLowerCase() === key,
    );
    if (!mapping) {
      return { accepted: false, reason: "unmapped" };
    }

    this.responded = true;
    return {
      accepted: true,
      response: {
        value: mapping.responseValue,
        inputSource: "keyboard",
        timestampMs,
        accepted: true,
      },
    };
  }

  complete(): void {
    this.status = "completed";
    this.detach();
  }

  timeout(): void {
    this.status = "timed_out";
    this.detach();
  }

  interrupt(): void {
    this.status = "interrupted";
    this.detach();
  }

  reset(): void {
    this.status = "inactive";
    this.responded = false;
    this.stimulusOnsetMs = null;
    this.deadlineMs = null;
    this.detach();
  }
}
