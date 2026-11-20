import { describe, expect, it } from "vitest";
import { transitionSession } from "./sessionState";

describe("session state transitions", () => {
  it("allows the practice-to-main progression", () => {
    expect(transitionSession("idle", { type: "OPEN_INSTRUCTIONS" })).toEqual({
      allowed: true,
      to: "instructions",
    });
    expect(
      transitionSession("instructions", { type: "BEGIN_PRACTICE" }),
    ).toEqual({ allowed: true, to: "practice" });
    expect(
      transitionSession("practice", { type: "PRACTICE_COMPLETE" }),
    ).toEqual({ allowed: true, to: "ready" });
    expect(transitionSession("ready", { type: "BEGIN_MAIN" })).toEqual({
      allowed: true,
      to: "main",
    });
  });

  it("allows break and pause progression", () => {
    expect(transitionSession("main", { type: "OFFER_BREAK" })).toEqual({
      allowed: true,
      to: "break",
    });
    expect(
      transitionSession("break", { type: "CONTINUE_AFTER_BREAK" }),
    ).toEqual({ allowed: true, to: "main" });
    expect(transitionSession("main", { type: "FOCUS_LOST" })).toEqual({
      allowed: true,
      to: "paused",
    });
    expect(
      transitionSession("paused", {
        type: "FOCUS_RESTORED",
        resumeTo: "main",
      }),
    ).toEqual({ allowed: true, to: "main" });
    expect(
      transitionSession("break", { type: "PAUSE", resumeTo: "break" }),
    ).toEqual({ allowed: true, to: "paused" });
    expect(
      transitionSession("paused", { type: "RESUME", resumeTo: "break" }),
    ).toEqual({ allowed: true, to: "break" });
  });

  it("rejects transitions outside the model", () => {
    expect(transitionSession("completed", { type: "BEGIN_MAIN" })).toEqual({
      allowed: false,
      from: "completed",
      transition: "BEGIN_MAIN",
    });
  });
});
