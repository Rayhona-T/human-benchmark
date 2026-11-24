/**
 * Task 10.4 (owner-approved): clearing an ended session's data (FR-PRI-03)
 * and confirming departures from an active session. Browser-level behavior
 * (reload, Back/Forward, real downloads, completed sessions) is covered by
 * e2e/session-departure.spec.ts.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StroopExperimentPage } from "../stroop/StroopExperimentPage";

const PATH = "/experiments/stroop";

function renderStroop() {
  const router = createMemoryRouter(
    [
      { path: "/experiments", element: <h1>Experiments list</h1> },
      { path: PATH, element: <StroopExperimentPage seedOverride={1234} /> },
    ],
    { initialEntries: ["/experiments", PATH], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const key = (value: string) =>
  act(() => {
    fireEvent.keyDown(window, { key: value });
  });

function beginPractice() {
  fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
  for (const value of ["d", "f", "j", "k"]) key(value);
  fireEvent.click(
    screen.getByRole("button", { name: "Begin 12 practice trials" }),
  );
}

function exitSession() {
  fireEvent.click(
    within(
      screen.getByRole("group", { name: "Experiment controls" }),
    ).getByRole("button", { name: "Exit" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Exit session" }));
  expect(
    screen.getByRole("heading", { name: "Session ended" }),
  ).toBeInTheDocument();
}

/** True when a beforeunload event would make the browser ask to confirm. */
function beforeUnloadPrompts() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

const CLEAR = "Clear this session's data";

describe("session data clearing and departure warnings", () => {
  beforeEach(() => {
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
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("offers no clear action while a session runs", () => {
    renderStroop();
    beginPractice();
    expect(screen.queryByRole("button", { name: CLEAR })).toBeNull();
  });

  it("clears an incomplete session after confirmation and starts fresh", () => {
    renderStroop();
    beginPractice();
    exitSession();

    const clear = screen.getByRole("button", { name: CLEAR });
    expect(clear).toHaveAccessibleDescription(
      "This removes this session's trials and results from this page and returns you to the start. Nothing is stored by HUMAN BENCHMARK. Files you already downloaded are not affected; delete them yourself if you want them gone.",
    );

    // Cancel keeps everything and returns focus to the button.
    clear.focus();
    fireEvent.click(clear);
    const dialog = screen.getByRole("alertdialog", {
      name: "Clear this session's data?",
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(dialog).toHaveTextContent(
      "Files you already downloaded are not affected.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Session ended" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: CLEAR })).toHaveFocus();

    // Escape also cancels.
    fireEvent.click(screen.getByRole("button", { name: CLEAR }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // Confirm: back to the start, nothing of the session left on the page.
    fireEvent.click(screen.getByRole("button", { name: CLEAR }));
    fireEvent.click(screen.getByRole("button", { name: "Clear data" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const start = screen.getByRole("heading", {
      level: 1,
      name: "Respond to the ink color",
    });
    expect(start).toHaveFocus();
    expect(screen.getByRole("button", { name: "Start Stroop" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Session overview" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: CLEAR })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Download trial data (CSV)" }),
    ).toBeNull();
    // Nothing active, so no departure warning.
    expect(beforeUnloadPrompts()).toBe(false);

    // A new session starts from trial 1, with none of the cleared records.
    beginPractice();
    expect(screen.getByText("Practice 1 of 12")).toBeInTheDocument();
    exitSession();
    const practice = screen
      .getByText("Practice trials (not analysed)")
      .closest("div") as HTMLElement;
    expect(practice).toHaveTextContent("0 of 12");
  });

  it("warns before the browser leaves only while a session is active", () => {
    renderStroop();
    expect(beforeUnloadPrompts()).toBe(false); // intro
    fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    expect(beforeUnloadPrompts()).toBe(false); // instructions
    for (const value of ["d", "f", "j", "k"]) key(value);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    expect(beforeUnloadPrompts()).toBe(true); // practice
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(beforeUnloadPrompts()).toBe(true); // paused
    exitSession();
    expect(beforeUnloadPrompts()).toBe(false); // ended
  });

  it("in-app navigation pauses the session and asks; Stay resumes, Leave goes", async () => {
    const router = renderStroop();
    beginPractice();
    expect(screen.getByText("Practice 1 of 12")).toBeInTheDocument();

    await act(() => router.navigate("/experiments"));
    expect(
      screen.getByRole("alertdialog", { name: "Leave this session?" }),
    ).toHaveTextContent(
      "It will end as incomplete and its data will be discarded.",
    );
    expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus();
    expect(router.state.location.pathname).toBe(PATH);
    // No trial runs behind the dialog.
    expect(
      screen.getByRole("heading", { name: "Experiment paused", hidden: true }),
    ).toBeInTheDocument();

    // A second attempt while asking shows still one dialog.
    await act(() => router.navigate("/experiments"));
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Experiment paused" }),
    ).toBeNull();
    expect(router.state.location.pathname).toBe(PATH);

    // Back (history POP) is confirmed too.
    await act(() => router.navigate(-1));
    expect(
      screen.getByRole("alertdialog", { name: "Leave this session?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    await act(async () => {});
    expect(router.state.location.pathname).toBe("/experiments");
    expect(
      screen.getByRole("heading", { name: "Experiments list" }),
    ).toBeInTheDocument();
    expect(beforeUnloadPrompts()).toBe(false);
  });

  it("an already-paused session stays paused after Stay", async () => {
    const router = renderStroop();
    beginPractice();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await act(() => router.navigate("/experiments"));
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(
      screen.getByRole("heading", { name: "Experiment paused" }),
    ).toBeInTheDocument();
  });

  it("does not ask before leaving the intro or an ended session", async () => {
    const router = renderStroop();
    await act(() => router.navigate("/experiments"));
    expect(router.state.location.pathname).toBe("/experiments");

    await act(() => router.navigate(PATH));
    beginPractice();
    exitSession();
    await act(() => router.navigate("/experiments"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.state.location.pathname).toBe("/experiments");
  });
});
