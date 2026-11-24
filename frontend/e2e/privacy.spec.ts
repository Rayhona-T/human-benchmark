/**
 * Client-only privacy checks on the production build (Cycle 10 scope:
 * Option A). The full-session tests in experiments.spec.ts also record the
 * network while participant data exists; this spec covers ordinary browsing
 * and browser storage. See support/network.ts for what is and is not proven.
 */
import { expect, test } from "@playwright/test";
import { recordNetwork } from "./support/network";

test("browsing every main page makes only same-origin static requests and stores nothing", async ({
  page,
  context,
  baseURL,
}) => {
  const network = recordNetwork(page, baseURL ?? "");
  for (const path of [
    "/",
    "/experiments",
    "/methodology",
    "/experiments/stroop",
    "/experiments/flanker",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  // Start a session as far as the instructions, where the page is live.
  await page.getByRole("button", { name: "Start Flanker" }).click();
  await expect(
    page.getByRole("heading", { name: "Check the response keys" }),
  ).toBeVisible();

  expect(network.violations()).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(context.serviceWorkers()).toEqual([]);
  const storage = await page.evaluate(async () => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
    indexedDb: (await indexedDB.databases()).length,
  }));
  expect(storage).toEqual({ local: 0, session: 0, indexedDb: 0 });
});

test("the network recorder flags requests a client-only app must not make", async ({
  page,
  baseURL,
}) => {
  // Self-test: proves the check above can fail. Nothing leaves the machine:
  // the cross-origin target is a closed local port.
  const network = recordNetwork(page, baseURL ?? "");
  await page.goto("/");
  await page.evaluate(async () => {
    await fetch("http://127.0.0.1:9/collect", {
      method: "POST",
      body: "x",
    }).catch(() => undefined);
    await fetch("/api/v1/sessions", { method: "POST", body: "{}" }).catch(
      () => undefined,
    );
  });
  const violations = network.violations();
  expect(violations.some((v) => v.includes("http://127.0.0.1:9/collect"))).toBe(
    true,
  );
  expect(
    violations.some(
      (v) => v.startsWith("POST") && v.includes("/api/v1/sessions"),
    ),
  ).toBe(true);
});
