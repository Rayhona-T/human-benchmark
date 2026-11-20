import type { MonotonicClock } from "./interfaces";

export interface DeadlineScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export class BrowserMonotonicClock implements MonotonicClock {
  readonly isMonotonic = true as const;

  now(): number {
    return typeof performance !== "undefined" ? performance.now() : Number.NaN;
  }
}

export class FakeMonotonicClock implements MonotonicClock {
  readonly isMonotonic = true as const;
  private currentMs: number;

  constructor(initialMs = 0) {
    this.currentMs = initialMs;
  }

  now(): number {
    return this.currentMs;
  }

  set(valueMs: number): void {
    if (!Number.isFinite(valueMs) || valueMs < 0) {
      throw new Error(
        "Monotonic clock values must be finite and non-negative.",
      );
    }
    this.currentMs = valueMs;
  }

  advance(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error(
        "Monotonic clock advances must be finite and non-negative.",
      );
    }
    this.currentMs += deltaMs;
  }
}

export class BrowserDeadlineScheduler implements DeadlineScheduler {
  schedule(callback: () => void, delayMs: number): unknown {
    return window.setTimeout(callback, Math.max(0, delayMs));
  }

  cancel(handle: unknown): void {
    window.clearTimeout(handle as number);
  }
}

export class FakeDeadlineScheduler implements DeadlineScheduler {
  private sequence = 0;
  private currentMs: number;
  private readonly scheduled = new Map<
    number,
    { atMs: number; callback: () => void; cancelled: boolean }
  >();

  constructor(currentMs = 0) {
    this.currentMs = currentMs;
  }

  schedule(callback: () => void, delayMs: number): unknown {
    const handle = ++this.sequence;
    this.scheduled.set(handle, {
      atMs: this.currentMs + Math.max(0, delayMs),
      callback,
      cancelled: false,
    });
    return handle;
  }

  cancel(handle: unknown): void {
    const entry = this.scheduled.get(handle as number);
    if (entry) entry.cancelled = true;
  }

  setNow(valueMs: number): void {
    this.currentMs = valueMs;
  }

  advanceTo(valueMs: number): void {
    if (valueMs < this.currentMs) return;
    this.currentMs = valueMs;
    for (const entry of this.scheduled.values()) {
      if (!entry.cancelled && entry.atMs <= valueMs) {
        entry.cancelled = true;
        entry.callback();
      }
    }
  }

  pendingCount(): number {
    return [...this.scheduled.values()].filter((entry) => !entry.cancelled)
      .length;
  }
}

export function calculateElapsedMs(
  startMs: number | null,
  endMs: number | null,
): number | null {
  if (
    startMs === null ||
    endMs === null ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs < startMs
  ) {
    return null;
  }
  return endMs - startMs;
}

export function calculateReactionTimeMs(
  stimulusOnsetMs: number | null,
  responseTimestampMs: number | null,
): number | null {
  return calculateElapsedMs(stimulusOnsetMs, responseTimestampMs);
}
