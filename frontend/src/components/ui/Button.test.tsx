import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("uses a button element and handles activation", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Continue</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("is disabled while loading", () => {
    render(<Button isLoading>Continue</Button>);

    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });
});
