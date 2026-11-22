import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { StroopExperimentPage } from "./StroopExperimentPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <StroopExperimentPage seedOverride={1234} />
    </MemoryRouter>,
  );
}

describe("StroopExperimentPage", () => {
  afterEach(cleanup);

  it("renders the participant introduction and begins instructions", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        name: "Respond to the ink color",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    expect(
      screen.getByRole("heading", {
        name: "Check the response keys",
      }),
    ).toBeInTheDocument();
  });

  it("requires all four logical keys before practice starts", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    const begin = screen.getByRole("button", {
      name: "Begin 12 practice trials",
    });
    expect(begin).toBeDisabled();

    for (const key of ["d", "f", "j", "k"]) {
      await userEvent.keyboard(key);
    }
    expect(begin).toBeEnabled();
  });

  it("provides a confirmed abort flow", async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "Exit session" }));
    expect(
      screen.getByRole("heading", { name: "Session ended" }),
    ).toBeInTheDocument();
  });
});
