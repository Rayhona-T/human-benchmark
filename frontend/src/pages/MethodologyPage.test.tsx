/**
 * FR-DIS-04 / NFR-SCI-01: the methodology page names the protocol and
 * analysis versions and lists verified references, each with its DOI link.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodologyPage } from "./MethodologyPage";

describe("MethodologyPage", () => {
  afterEach(cleanup);

  it("names the protocol and analysis versions", () => {
    render(<MethodologyPage />);
    const versions = screen
      .getByRole("heading", { name: "Versions" })
      .closest("section") as HTMLElement;
    expect(versions).toHaveTextContent("HB-STROOP-1.0 for Stroop");
    expect(versions).toHaveTextContent("HB-FLANKER-1.0 for Flanker");
    expect(versions).toHaveTextContent("HB-ANALYSIS-1.1");
  });

  it("separates published findings from HUMAN BENCHMARK's own decisions", () => {
    render(<MethodologyPage />);
    expect(
      screen.getByRole("heading", { name: "General findings" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Our implementation choices" }),
    ).toBeVisible();
    expect(
      screen.getByText(/The cited studies did not test HUMAN BENCHMARK/),
    ).toBeVisible();
  });

  it("lists each reference with a working DOI link and cites only listed numbers", () => {
    const { container } = render(<MethodologyPage />);
    const references = within(
      screen
        .getByRole("heading", { name: "References" })
        .closest("section") as HTMLElement,
    ).getAllByRole("listitem");
    expect(references).toHaveLength(10);
    for (const reference of references) {
      const link = within(reference).getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        expect.stringMatching(/^https:\/\/doi\.org\/10\.\d{4,}\/\S+$/),
      );
      expect(link).toHaveTextContent(link.getAttribute("href") ?? "");
    }
    // Every [n] cited in the text points at an existing reference.
    const cited = (container.textContent ?? "").match(/\[[\d,\s–]+\]/g) ?? [];
    expect(cited.length).toBeGreaterThan(0);
    for (const citation of cited) {
      for (const part of citation.slice(1, -1).split(",")) {
        const [from, to = from] = part.trim().split("–").map(Number);
        expect(from).toBeGreaterThanOrEqual(1);
        expect(to).toBeLessThanOrEqual(references.length);
      }
    }
  });
});
