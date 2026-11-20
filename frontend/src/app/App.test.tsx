import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the HUMAN BENCHMARK placeholder home page", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Observe a task. Understand its limits.",
        level: 1,
      }),
    ).toBeInTheDocument();
  });
});
