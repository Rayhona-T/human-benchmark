import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createAppRoutes } from "./router";

// Vitest runs as a development build (import.meta.env.DEV is true). The
// production side (the path shows "Page not found" and nothing of the page
// is bundled) is checked by e2e/app.spec.ts and e2e/bundle.spec.ts.
describe("development-only routes", () => {
  it("serves the design-system preview in development builds", async () => {
    expect(import.meta.env.DEV).toBe(true);
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ["/design-system"],
    });
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Design system" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Development preview")).toBeInTheDocument();
  });
});
