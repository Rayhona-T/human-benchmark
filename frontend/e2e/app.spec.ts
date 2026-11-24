/**
 * Application smoke tests against the production build: routes, navigation,
 * not-found handling, development-only features absent, and no uncaught
 * errors. Deep links work here because `vite preview` falls back to
 * index.html; the real host's fallback rule is not verified (Task 10.9).
 */
import { expect, test, type Page } from "@playwright/test";

/** Collects uncaught page errors and console errors for one test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /Observe a task\. Understand its limits\./ },
  { path: "/experiments", heading: /^Experiments$/ },
  { path: "/methodology", heading: /How to interpret the platform/ },
  { path: "/experiments/stroop", heading: /Respond to the ink color/ },
  { path: "/experiments/flanker", heading: /Respond to the center arrow/ },
];

for (const route of ROUTES) {
  test(`deep link ${route.path} loads without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("primary navigation reaches each page", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("link", { name: "Experiments" }).click();
  await expect(page).toHaveURL(/\/experiments$/);
  await page.getByRole("link", { name: "Start Stroop" }).click();
  await expect(page).toHaveURL(/\/experiments\/stroop$/);
  await nav.getByRole("link", { name: "Methodology" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /How to interpret/,
  );
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("unknown routes show the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});

test("development-only features are absent from the production build", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav.getByRole("link", { name: "Observatory" })).toHaveCount(0);
  for (const path of [
    "/observatory",
    "/observatory/trends",
    "/observatory/sessions/00000000-0000-4000-8000-000000000001",
    // Development preview only (Task 10.4 owner decision).
    "/design-system",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
  }
});
