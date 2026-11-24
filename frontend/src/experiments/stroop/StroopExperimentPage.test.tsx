import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestRouter } from "../../test/TestRouter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StroopExperimentPage } from "./StroopExperimentPage";

function renderPage() {
  return render(
    <TestRouter>
      <StroopExperimentPage seedOverride={1234} />
    </TestRouter>,
  );
}

describe("StroopExperimentPage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the participant introduction and begins instructions", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        name: "Respond to the ink color",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    const heading = screen.getByRole("heading", {
      name: "Check the response keys",
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveFocus();
  });

  it("briefs participants as protocol §3 requires before they start", () => {
    renderPage();
    const intro = screen
      .getByRole("heading", { name: "Respond to the ink color" })
      .closest("article") as HTMLElement;
    const text = intro.textContent ?? "";
    for (const required of [
      /respond to the ink color, not to read the word/i,
      /not a diagnosis, IQ test, or validated assessment/i,
      /12 practice trials with feedback/i,
      /60 trials and no correctness feedback/i,
      /after 2 seconds/i,
      /break after trial 30/i,
      /describe this task session only/i,
      /Browser timing, keyboard, and color perception can affect responses/i,
      /Nothing is saved or sent anywhere/i,
      /You can stop at any time/i,
      /Leaving early is not a failure/i,
      /unfamiliar with the English color words/i,
      /cannot easily tell the four ink colors apart/i,
      /does not type the letters D, F, J, and K/i,
    ]) {
      expect(text).toMatch(required);
    }
    expect(
      within(intro).getByLabelText("Stroop response keys"),
    ).toBeInTheDocument();
  });

  it("requires all four logical keys and echoes each recognized key and color", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    const begin = screen.getByRole("button", {
      name: "Begin 12 practice trials",
    });
    expect(begin).toBeDisabled();
    expect(screen.getByText("D = Red: not pressed yet")).toBeInTheDocument();

    for (const key of ["d", "f", "j"]) {
      await userEvent.keyboard(key);
    }
    expect(screen.getByText("D = Red: recognized")).toBeInTheDocument();
    expect(begin).toBeDisabled();
    await userEvent.keyboard("{Shift>}K{/Shift}");
    expect(screen.getByText("K = Yellow: recognized")).toBeInTheDocument();
    expect(begin).toBeEnabled();
  });

  it("provides a confirmed abort flow", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    for (const key of ["d", "f", "j", "k"]) {
      await userEvent.keyboard(key);
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(
      screen.getByRole("alertdialog", { name: "Exit this session?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Exit session" }));
    expect(
      screen.getByRole("heading", { name: "Session ended" }),
    ).toHaveFocus();
  });

  it("resets page scroll on each screen change so the session bar is never under the sticky header", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const scroller = document.scrollingElement ?? document.documentElement;
    Object.defineProperty(scroller, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    });
    renderPage();
    scroller.scrollTop = 420; // participant scrolled down to the button
    fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    expect(scroller.scrollTop).toBe(0);
    for (const key of ["d", "f", "j", "k"]) fireEvent.keyDown(window, { key });
    scroller.scrollTop = 380;
    fireEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    expect(scroller.scrollTop).toBe(0);
    expect(
      screen.getByRole("group", { name: "Experiment controls" }),
    ).toBeInTheDocument();
    delete (scroller as unknown as Record<string, unknown>).scrollTop;
  });

  it("pauses trials behind the exit dialog and resumes on Continue", () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    for (const key of ["d", "f", "j", "k"]) {
      fireEvent.keyDown(window, { key });
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    expect(screen.getByText("+")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(
      screen.getByRole("alertdialog", { name: "Exit this session?" }),
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Nothing advanced behind the dialog.
    expect(screen.queryByText("+")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Experiment paused", hidden: true }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("Practice 1 of 12")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("shows the stimulus on the protocol background and locks controls during it", () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    for (const key of ["d", "f", "j", "k"]) {
      fireEvent.keyDown(window, { key });
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    const stage = screen.getByRole("region", { name: "Active Stroop trial" });
    expect(stage).toHaveStyle({ background: "#111827" });
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    const stimulus = stage.querySelector(".stroop-stimulus") as HTMLElement;
    expect(stimulus).not.toBeNull();
    expect(stimulus).toHaveStyle({ fontSize: "48px", fontWeight: "700" });
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exit" })).toBeDisabled();
    // Practice shows the key legend with the stimulus.
    expect(
      stage.querySelector('[aria-label="Stroop response keys"]'),
    ).not.toBeNull();
  });
});
