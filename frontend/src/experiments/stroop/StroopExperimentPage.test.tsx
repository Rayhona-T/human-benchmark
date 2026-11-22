import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StroopExperimentPage } from "./StroopExperimentPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <StroopExperimentPage seedOverride={1234} />
    </MemoryRouter>,
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
