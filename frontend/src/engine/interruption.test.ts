import { describe, expect, it } from "vitest";
import {
  InterruptionController,
  type InterruptionEventSource,
  type InterruptionReason,
} from "./interruption";

class TestInterruptionSource implements InterruptionEventSource {
  private listener: ((reason: InterruptionReason) => void) | null = null;
  subscribe(listener: (reason: InterruptionReason) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(reason: InterruptionReason): void {
    this.listener?.(reason);
  }
}

describe("InterruptionController", () => {
  it("supports injected interruptions and cleanup", () => {
    const source = new TestInterruptionSource();
    const controller = new InterruptionController(source);
    const received: InterruptionReason[] = [];
    controller.start((reason) => received.push(reason));
    source.emit("visibility_hidden");
    source.emit("window_blur");
    expect(received).toEqual(["visibility_hidden", "window_blur"]);
    controller.stop();
    source.emit("document_focus_lost");
    expect(received).toEqual(["visibility_hidden", "window_blur"]);
  });
});
