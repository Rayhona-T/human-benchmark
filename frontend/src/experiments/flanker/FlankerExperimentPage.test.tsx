import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { TestRouter } from "../../test/TestRouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFlankerSchedule } from "./flankerSchedule";
import { FlankerExperimentPage } from "./FlankerExperimentPage";

const SEED = 1234;
let width = 1000;

function renderPage() {
  return render(
    <TestRouter>
      <FlankerExperimentPage seedOverride={SEED} />
    </TestRouter>,
  );
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const nextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });
const key = (value: string, repeat = false) =>
  act(() => {
    fireEvent.keyDown(window, { key: value, repeat });
  });
const status = () =>
  screen.getByRole("status").textContent?.replace(/\s+/g, " ").trim();

function useFakeTimers() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
}

function startAndPassMappingCheck() {
  fireEvent.click(screen.getByRole("button", { name: "Start Flanker" }));
  key("f");
  key("j");
  fireEvent.click(
    screen.getByRole("button", { name: "Begin 12 practice trials" }),
  );
}

const stage = () =>
  screen.getByRole("region", { name: "Active Flanker trial" });
const centerSymbol = () =>
  stage().querySelectorAll(".flanker-array .flanker-cell")[2]?.textContent ??
  null;

describe("FlankerExperimentPage", () => {
  beforeEach(() => {
    width = 1000;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      () => width,
    );
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("briefs the participant as HB-FLANKER-1.0 §3 and the approval require", () => {
    renderPage();
    const intro = screen
      .getByRole("heading", { name: "Respond to the center arrow" })
      .closest("article") as HTMLElement;
    const text = intro.textContent?.replace(/\s+/g, " ") ?? "";
    for (const required of [
      /center arrow only/,
      /not a diagnosis, IQ estimate, or validated measure of general ability/,
      /Congruent: all arrows point the same way/,
      /Incongruent: the surrounding arrows point the other way/,
      /Neutral: dashes surround the center arrow/,
      /12 practice trials with feedback/,
      /60 main trials without correctness feedback/,
      /after 2 seconds/,
      /break after trial 30/,
      /describe this task session only/,
      /Browser timing, keyboard, and display differences can affect responses/,
      /Nothing is saved or sent anywhere/,
      /You can stop at any time/,
      /Tab moves between buttons and Enter presses them/,
      /row 272 pixels wide that must fit fully inside your window/,
    ]) {
      expect(text).toMatch(required);
    }
    expect(
      within(intro).getByLabelText("Flanker response keys"),
    ).toHaveTextContent(/F\s*Left.*J\s*Right/);
  });

  it("runs the mapping check: F for left, then J for right; wrong keys repeat, others are ignored", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start Flanker" }));
    const begin = screen.getByRole("button", {
      name: "Begin 12 practice trials",
    });
    expect(
      screen.getByRole("heading", { name: "Check the response keys" }),
    ).toHaveFocus();
    expect(status()).toBe("Step 1 of 2: press the key for this arrow.");
    expect(screen.getByText("Arrow pointing left")).toBeInTheDocument();

    key("j");
    expect(status()).toBe(
      "That key means Right. This arrow points left: press F.",
    );
    key("x");
    key("Enter");
    expect(status()).toBe(
      "That key means Right. This arrow points left: press F.",
    );
    key("f", true); // auto-repeat never advances
    expect(begin).toBeDisabled();
    key("F"); // Shift+F: logical key, case-insensitive
    expect(status()).toBe("Step 2 of 2: press the key for this arrow.");
    expect(screen.getByText("Arrow pointing right")).toBeInTheDocument();
    key("f");
    expect(status()).toBe(
      "That key means Left. This arrow points right: press J.",
    );
    expect(begin).toBeDisabled();
    key("j");
    expect(status()).toBe(
      "Both keys recognized. You can begin the practice trials.",
    );
    expect(begin).toBeEnabled();
    key("f"); // further keys change nothing
    expect(begin).toBeEnabled();
  });

  it("presents the exact protocol array on the protocol background, with no scaling", () => {
    useFakeTimers();
    renderPage();
    startAndPassMappingCheck();
    expect(stage()).toHaveStyle({ background: "#111827" });
    expect(stage()).toHaveClass("flanker-trial-stage");
    expect(screen.getByText("+")).toBeInTheDocument();
    advance(500);
    nextFrame();
    const array = stage().querySelector(".flanker-array") as HTMLElement;
    expect(array).toHaveStyle({ width: "272px", gap: "8px", display: "flex" });
    const cells = Array.from(
      array.querySelectorAll<HTMLElement>(".flanker-cell"),
    );
    expect(cells).toHaveLength(5);
    for (const cell of cells) {
      expect(cell).toHaveStyle({
        width: "48px",
        height: "48px",
        fontSize: "40px",
        lineHeight: "48px",
        fontWeight: "700",
        color: "#F9FAFB",
      });
    }
    const expected = createFlankerSchedule(SEED).practice[0].stimulus.cells;
    expect([...cells].map((cell) => cell.textContent)).toEqual([...expected]);
    // Practice shows a text-only key reminder: the only arrows in the trial
    // area are the five stimulus cells (no extra directional distractors).
    expect(
      within(stage()).getByLabelText("Flanker response keys"),
    ).toHaveTextContent(/F\s*Left\s*J\s*Right/);
    const arrowsInStage = (stage().textContent ?? "").match(/[←→]/g) ?? [];
    const arrowsInArray = [...cells].filter((cell) =>
      /[←→]/.test(cell.textContent ?? ""),
    ).length;
    expect(arrowsInStage).toHaveLength(arrowsInArray);
    expect(stage().textContent).not.toMatch(/congruent|neutral/i);
  });

  it("blocks trials while the window is too narrow and resumes safely once the array fits", () => {
    useFakeTimers();
    width = 271;
    renderPage();
    nextFrame();
    expect(screen.getByText("Window too narrow")).toBeInTheDocument();
    startAndPassMappingCheck();
    expect(
      screen.getByRole("heading", { name: "Experiment paused" }),
    ).toHaveFocus();
    expect(screen.getByText("Window too narrow")).toBeInTheDocument();
    expect(
      screen.getByText(/No trial was started or recorded/),
    ).toBeInTheDocument();
    const resume = screen.getByRole("button", { name: "Resume" });
    expect(resume).toBeDisabled();
    advance(10_000);
    expect(screen.queryByText("+")).not.toBeInTheDocument();

    width = 272;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Practice 1 of 12")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("pauses trials behind the exit dialog and marks an exited session incomplete", () => {
    useFakeTimers();
    renderPage();
    startAndPassMappingCheck();
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(
      screen.getByRole("alertdialog", { name: "Exit this session?" }),
    ).toBeInTheDocument();
    advance(10_000);
    expect(screen.queryByText("+")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit session" }));
    expect(
      screen.getByRole("heading", { name: "Session ended" }),
    ).toHaveFocus();
    expect(screen.getByText("0 of 60")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows results that match an independent tally of a full session", () => {
    useFakeTimers();
    renderPage();
    startAndPassMappingCheck();
    const KEY = { "←": "f", "→": "j" } as const;
    const answer = (plan: "correct" | "wrong" | "none") => {
      advance(500);
      nextFrame();
      if (plan !== "none") {
        advance(400);
        const correct = KEY[centerSymbol() as "←" | "→"];
        key(plan === "correct" ? correct : correct === "f" ? "j" : "f");
        nextFrame();
        advance(500);
      } else {
        advance(2000);
        nextFrame();
        advance(500);
      }
    };
    for (let index = 0; index < 12; index++) answer("correct");
    fireEvent.click(
      screen.getByRole("button", { name: "Start 60 main trials" }),
    );
    const planFor = (index: number) =>
      index % 7 === 0 ? "none" : index % 5 === 0 ? "wrong" : "correct";
    for (let index = 1; index <= 60; index++) {
      answer(planFor(index));
      if (index === 30)
        fireEvent.click(screen.getByRole("button", { name: "Skip break" }));
    }
    expect(
      screen.getByRole("heading", { name: "Flanker session complete" }),
    ).toBeInTheDocument();

    // Independent tally from the verified schedule and the response plan.
    const tally: Record<
      string,
      { correct: number; wrong: number; none: number }
    > = {
      congruent: { correct: 0, wrong: 0, none: 0 },
      incongruent: { correct: 0, wrong: 0, none: 0 },
      neutral: { correct: 0, wrong: 0, none: 0 },
    };
    createFlankerSchedule(SEED).main.forEach((trial) => {
      tally[trial.condition][planFor(trial.index)] += 1;
    });
    const table = screen.getByRole("table", {
      name: "Main-trial results by condition (practice excluded)",
    });
    const row = (label: string) =>
      within(table)
        .getByRole("rowheader", { name: new RegExp(`^${label}`) })
        .closest("tr") as HTMLElement;
    const cells = (label: string) =>
      Array.from(row(label).querySelectorAll("td")).map((cell) =>
        cell.textContent?.replace(/\s+/g, " ").trim(),
      );
    const order = ["congruent", "incongruent", "neutral"] as const;
    expect(cells("Correct")).toEqual(
      order.map((c) => String(tally[c].correct)),
    );
    expect(cells("Incorrect")).toEqual(
      order.map((c) => String(tally[c].wrong)),
    );
    expect(cells("Timeouts")).toEqual(order.map((c) => String(tally[c].none)));
    expect(cells("Response accuracy")).toEqual(
      order.map((c) => {
        const { correct, wrong } = tally[c];
        return `${((correct / (correct + wrong)) * 100).toFixed(1)}%${correct} of ${correct + wrong}`;
      }),
    );
    // Every correct RT is exactly 400 ms, so each median and RT contrast is 400 / 0.
    expect(cells("Median correct response time")).toEqual(
      order.map((c) => `400 msfrom ${tally[c].correct} correct`),
    );
    const congruency = screen
      .getByRole("heading", { name: "Overall congruency" })
      .closest("section") as HTMLElement;
    const accuracy = (c: string) =>
      tally[c].correct / (tally[c].correct + tally[c].wrong);
    const points = (accuracy("congruent") - accuracy("incongruent")) * 100;
    const sign = points > 0 ? "+" : points < 0 ? "−" : "";
    // The accuracy value: shown with an explicit sign.
    expect(
      within(congruency).getAllByText(
        `${sign}${Math.abs(points).toFixed(1)} percentage points`,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    // Both rate rows use the rate order; only the RT row uses the RT order.
    expect(
      within(congruency).getAllByText("Congruent − Incongruent"),
    ).toHaveLength(2);
    expect(
      within(congruency).getAllByText("Incongruent − Congruent"),
    ).toHaveLength(1);
    expect(
      screen.getByText(
        /how often each condition followed each other condition was not controlled/,
      ),
    ).toBeInTheDocument();
    // Full 72-trial session plus the results page: allow time when the
    // suite runs in parallel (assertions unchanged).
  }, 30_000);
});
