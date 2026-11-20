import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox, Label, TextInput } from "./FormControls";

describe("Form controls", () => {
  it("associates a label with an input", async () => {
    render(
      <>
        <Label htmlFor="participant-name">Participant name</Label>
        <TextInput id="participant-name" />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Participant name" });
    await userEvent.type(input, "Guest");

    expect(input).toHaveValue("Guest");
  });

  it("renders an accessible checkbox", async () => {
    render(
      <>
        <Label htmlFor="consent">I understand</Label>
        <Checkbox id="consent" />
      </>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "I understand" });
    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });
});
