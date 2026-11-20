import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

function renderShell(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<h1>Home test page</h1>} />
          <Route path="/experiments" element={<h1>Experiments test page</h1>} />
          <Route path="*" element={<h1>Not found test page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  afterEach(cleanup);
  it("renders primary navigation and marks the active route", () => {
    renderShell("/experiments");

    expect(screen.getByRole("link", { name: "Experiments" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens and closes the mobile menu disclosure", async () => {
    renderShell();

    const menuButton = screen.getByRole("button", { name: "Menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(menuButton);
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() =>
      expect(menuButton).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("renders a not-found route inside the shared shell", () => {
    renderShell("/unknown");

    expect(
      screen.getByRole("heading", { name: "Not found test page" }),
    ).toBeInTheDocument();
  });
});
