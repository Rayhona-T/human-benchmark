/**
 * Production bundle boundaries (Option A, client-only; Task 10.4).
 *
 * Reads the files `npm run build` wrote to dist/ (the Playwright web server
 * builds before any test runs) and checks that no development-only code
 * reached them: the save client and its endpoint, the provisional consent
 * notice, the Observatory, and the design-system preview. The development
 * build keeps all of these; that is checked by building in development mode
 * (see TESTING.md), not here.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const DIST = join(import.meta.dirname, "..", "dist");

/** Strings that only development-only modules contain. */
const DEVELOPMENT_ONLY = [
  "/api/v1", // backend endpoints (save client, Observatory client)
  "VITE_HB_LOCAL_SAVE_API", // the local backend address setting
  "HB-NOTICE-0.1-PROVISIONAL", // the unapproved consent notice
  "Save this session", // the save panel
  "save-session", // the save panel's styles
  "observatory", // Observatory pages, routes, and styles
  "Development preview", // the design-system page
  "design-system",
];

async function bundleFiles() {
  const assets = await readdir(join(DIST, "assets"));
  return ["index.html", ...assets.map((name) => join("assets", name))];
}

test("the production bundle contains no development-only code", async () => {
  const files = await bundleFiles();
  expect(files.some((file) => file.endsWith(".js"))).toBe(true);
  const found: string[] = [];
  for (const file of files) {
    if (!/\.(html|js|css)$/.test(file)) continue;
    const text = (await readFile(join(DIST, file), "utf-8")).toLowerCase();
    for (const marker of DEVELOPMENT_ONLY) {
      if (text.includes(marker.toLowerCase())) found.push(`${file}: ${marker}`);
    }
  }
  expect(found).toEqual([]);
});

test("the production bundle is one script and one stylesheet (no lazy development chunks)", async () => {
  const files = await bundleFiles();
  expect(files.filter((file) => file.endsWith(".js"))).toHaveLength(1);
  expect(files.filter((file) => file.endsWith(".css"))).toHaveLength(1);
});
