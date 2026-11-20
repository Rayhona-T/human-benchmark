import { describe, expect, it } from "vitest";
import {
  ResponseInputController,
  type KeyboardEventLike,
  type KeyboardInputSource,
} from "./input";

class TestKeyboardSource implements KeyboardInputSource {
  private listener: ((event: KeyboardEventLike) => void) | null = null;
  subscribe(listener: (event: KeyboardEventLike) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(event: KeyboardEventLike): void {
    this.listener?.(event);
  }
}

describe("ResponseInputController", () => {
  it("accepts mapped input and rejects repeat, unmapped, and duplicate input", () => {
    const source = new TestKeyboardSource();
    const input = new ResponseInputController(source, [
      { responseValue: "left", logicalKey: "f", label: "Left" },
    ]);
    input.activate(100, 1100);
    expect(input.process({ key: "f", repeat: true }, 500).reason).toBe(
      "repeat",
    );
    expect(input.process({ key: "x", repeat: false }, 500).reason).toBe(
      "unmapped",
    );
    expect(input.process({ key: "F", repeat: false }, 500)).toEqual({
      accepted: true,
      response: {
        value: "left",
        inputSource: "keyboard",
        timestampMs: 500,
        accepted: true,
      },
    });
    expect(input.process({ key: "f", repeat: false }, 600).reason).toBe(
      "duplicate_response",
    );
  });

  it("rejects input before activation and at or after deadline", () => {
    const input = new ResponseInputController(new TestKeyboardSource(), [
      { responseValue: "left", logicalKey: "f", label: "Left" },
    ]);
    expect(input.process({ key: "f", repeat: false }, 500).reason).toBe(
      "before_activation",
    );
    input.activate(100, 600);
    expect(input.process({ key: "f", repeat: false }, 99).reason).toBe(
      "before_activation",
    );
    expect(input.process({ key: "f", repeat: false }, 600).reason).toBe(
      "at_or_after_deadline",
    );
  });

  it("rejects input after timeout, completion, and interruption", () => {
    const input = new ResponseInputController(new TestKeyboardSource(), [
      { responseValue: "left", logicalKey: "f", label: "Left" },
    ]);
    input.activate(100, 1000);
    input.timeout();
    expect(input.process({ key: "f", repeat: false }, 500).reason).toBe(
      "trial_timed_out",
    );
    input.reset();
    input.activate(100, 1000);
    input.complete();
    expect(input.process({ key: "f", repeat: false }, 500).reason).toBe(
      "trial_completed",
    );
    input.reset();
    input.activate(100, 1000);
    input.interrupt();
    expect(input.process({ key: "f", repeat: false }, 500).reason).toBe(
      "trial_interrupted",
    );
  });
});
