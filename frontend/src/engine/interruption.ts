export type InterruptionReason =
  "visibility_hidden" | "window_blur" | "document_focus_lost";

export interface InterruptionEventSource {
  subscribe(listener: (reason: InterruptionReason) => void): () => void;
}

export class BrowserInterruptionEventSource implements InterruptionEventSource {
  subscribe(listener: (reason: InterruptionReason) => void): () => void {
    const handleVisibility = () => {
      if (document.hidden) listener("visibility_hidden");
    };
    const handleBlur = () => listener("window_blur");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }
}

export class InterruptionController {
  private unsubscribe: (() => void) | null = null;
  private readonly source: InterruptionEventSource;

  constructor(source: InterruptionEventSource) {
    this.source = source;
  }

  start(listener: (reason: InterruptionReason) => void): void {
    this.stop();
    this.unsubscribe = this.source.subscribe(listener);
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
