/**
 * Observatory route and navigation gating. The production build itself is
 * also checked (frontend/OBSERVATORY_UI.md, "Production gating"); these
 * tests cover the runtime side of the same rule.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { configure } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFakeBackend,
  fakeSession,
  API,
} from "../pages/observatory/fakeBackend";
import { createAppRoutes } from "./router";

function renderAt(path: string) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

function routePaths(): string[] {
  const shell = createAppRoutes()[0];
  return (shell.children ?? []).map((route) => route.path ?? "(index)");
}

function nav() {
  return screen.getByRole("navigation", { name: "Primary navigation" });
}

// The Observatory pages are lazily loaded routes; under a parallel full run
// their first load can take longer than Testing Library's 1 s default.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Observatory gating", () => {
  it.each([
    ["no local API configured", undefined],
    ["an IPv6 loopback address the backend refuses", "http://[::1]:8000"],
    ["an HTTPS address the backend does not serve", "https://127.0.0.1:8000"],
    ["a remote address", "http://192.168.1.20:8000"],
  ])("is absent with %s", async (_label, address) => {
    if (address !== undefined) vi.stubEnv("VITE_HB_LOCAL_SAVE_API", address);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    expect(routePaths()).not.toContain("observatory");
    renderAt("/observatory");
    expect(
      await screen.findByRole("heading", { level: 1, name: /not found/i }),
    ).toBeInTheDocument();
    expect(
      within(nav()).queryByRole("link", { name: "Observatory" }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is absent outside a dev-server build, even when configured", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_HB_LOCAL_SAVE_API", API);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    expect(routePaths()).not.toContain("observatory");
    expect(routePaths()).not.toContain("observatory/sessions/:sessionId");
    expect(routePaths()).not.toContain("observatory/trends");
    renderAt("/observatory/sessions/00000000-0000-4000-8000-000000000001");
    expect(
      await screen.findByRole("heading", { level: 1, name: /not found/i }),
    ).toBeInTheDocument();
    expect(
      within(nav()).queryByRole("link", { name: "Observatory" }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is offered in development with a supported local API", async () => {
    vi.stubEnv("VITE_HB_LOCAL_SAVE_API", API);
    const backend = createFakeBackend([fakeSession(1)]);
    vi.stubGlobal("fetch", backend.fetchImpl);

    expect(routePaths()).toEqual(
      expect.arrayContaining([
        "observatory",
        "observatory/sessions/:sessionId",
        "observatory/trends",
      ]),
    );
    renderAt("/");
    expect(
      within(nav()).getByRole("link", { name: "Observatory" }),
    ).toHaveAttribute("href", "/observatory");
    // The home page makes no Observatory request.
    expect(backend.fetchImpl).not.toHaveBeenCalled();
  });

  it("opens the history page, which asks only for summaries", async () => {
    vi.stubEnv("VITE_HB_LOCAL_SAVE_API", API);
    const backend = createFakeBackend([
      fakeSession(1),
      fakeSession(2, "flanker"),
    ]);
    vi.stubGlobal("fetch", backend.fetchImpl);

    renderAt("/observatory");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Saved sessions" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("row")).toHaveLength(3); // header + 2
    expect(
      backend.requests.map((r) => `${r.method} ${r.url.pathname}`),
    ).toEqual(["GET /api/v1/sessions"]);
  });
});
