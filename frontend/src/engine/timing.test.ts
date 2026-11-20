import { describe, expect, it } from "vitest";
import {
  calculateElapsedMs,
  calculateReactionTimeMs,
  FakeDeadlineScheduler,
  FakeMonotonicClock,
} from "./index";

describe("timing abstractions", () => {
  it("calculates monotonic elapsed and reaction time", () => {
    expect(calculateElapsedMs(100, 175)).toBe(75);
    expect(calculateReactionTimeMs(100, 175)).toBe(75);
  });

  it("does not fabricate missing or negative timing", () => {
    expect(calculateElapsedMs(null, 175)).toBeNull();
    expect(calculateElapsedMs(175, 100)).toBeNull();
    expect(calculateElapsedMs(Number.NaN, 100)).toBeNull();
  });

  it("supports deterministic fake clocks", () => {
    const clock = new FakeMonotonicClock(500);
    clock.advance(125);
    expect(clock.now()).toBe(625);
    clock.set(700);
    expect(clock.now()).toBe(700);
  });

  it("schedules, cancels, and advances deadlines deterministically", () => {
    const scheduler = new FakeDeadlineScheduler(100);
    let fired = 0;
    const handle = scheduler.schedule(() => {
      fired += 1;
    }, 50);
    scheduler.advanceTo(149);
    expect(fired).toBe(0);
    scheduler.advanceTo(150);
    expect(fired).toBe(1);
    const cancelled = scheduler.schedule(() => {
      fired += 1;
    }, 20);
    scheduler.cancel(cancelled);
    scheduler.advanceTo(170);
    expect(fired).toBe(1);
    expect(handle).not.toBeNull();
  });
});
