/**
 * The Trends loader's selection: summary limit, version filter, the
 * 60-session analysed window and its bounded replacements.
 * Uses the in-memory fake backend (real recorded replies), never a database.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API,
  createFakeBackend,
  fakeSession,
  type FakeSession,
} from "../../../pages/observatory/fakeBackend";
import { STROOP_CONFIGURATION } from "../../stroop/stroop";
import {
  createTrendCache,
  loadTrendInputs,
  MAX_ANALYSED,
  MAX_SUMMARIES,
  REPLACEMENT_LIMIT,
} from "./trendData";
import { buildTrendSeries, earlierSessionRange } from "./trends";

type Detail = FakeSession["detail"];

const unsupported = (d: Detail) => {
  d.protocol_version = "2.0";
};
const malformed = (d: Detail) => {
  const trial = d.trials.find(
    (t) => t.phase === "main" && t.outcome === "correct",
  );
  if (trial)
    (trial as { reaction_time_ms: number | null }).reaction_time_ms = null;
};

/** fakeSession(i): a higher index is saved earlier (index 1 = newest). */
function sessions(
  count: number,
  change?: (index: number) => ((d: Detail) => void) | undefined,
) {
  return Array.from({ length: count }, (_, i) =>
    fakeSession(i + 1, "stroop", change?.(i + 1)),
  );
}

async function load(
  list: FakeSession[],
  setup?: (b: ReturnType<typeof createFakeBackend>) => void,
) {
  const backend = createFakeBackend(list);
  setup?.(backend);
  vi.stubGlobal("fetch", backend.fetchImpl);
  const result = await loadTrendInputs(
    { apiBase: API },
    "stroop",
    createTrendCache(),
  );
  const details = backend.requests.filter((r) =>
    /\/api\/v1\/sessions\/[0-9a-f-]{36}$/.test(r.url.pathname),
  );
  const lists = backend.requests.filter(
    (r) => r.url.pathname === "/api/v1/sessions",
  );
  return { result, details, lists };
}

const idOf = (index: number) => fakeSession(index).detail.session_id;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analysed window", () => {
  it("keeps the limits unchanged", () => {
    expect(MAX_ANALYSED).toBe(60);
    expect(MAX_SUMMARIES).toBe(200);
    expect(REPLACEMENT_LIMIT).toBe(10);
  });

  it("analyses everything when there are fewer sessions than the cap", async () => {
    const { result, details } = await load(sessions(12));
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result).toMatchObject({
      retrieved: 12,
      truncatedList: false,
      unsupported: 0,
      notAnalysed: 0,
      replacementsUsed: 0,
    });
    expect(details).toHaveLength(12);
  });

  it("with more sessions than the cap, analyses exactly the 60 newest", async () => {
    const { result, details } = await load(sessions(65));
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result).toMatchObject({
      retrieved: 65,
      truncatedList: false,
      notAnalysed: 5,
      replacementsUsed: 0,
    });
    expect(details).toHaveLength(60);
    const loaded = new Set(details.map((r) => r.url.pathname.split("/").pop()));
    for (let index = 1; index <= 60; index++)
      expect(loaded.has(idOf(index))).toBe(true);
    for (let index = 61; index <= 65; index++)
      expect(loaded.has(idOf(index))).toBe(false);
  });

  it("numbers sessions from the oldest in the window, and ranges stay inside it", async () => {
    const { result } = await load(sessions(65));
    if (result.kind !== "ok") throw new Error(result.kind);
    const series = buildTrendSeries(
      "stroop",
      result.inputs,
      STROOP_CONFIGURATION.conditions,
    );
    expect(series.included).toHaveLength(60);
    // Session 1 is the oldest analysed session (index 60), not the oldest saved (65).
    expect(series.included[0]).toMatchObject({
      number: 1,
      sessionId: idOf(60),
    });
    expect(series.included.at(-1)).toMatchObject({
      number: 60,
      sessionId: idOf(1),
    });
    // Sessions older than the window are not in the series at all.
    expect(series.excluded).toHaveLength(0);
    const range = earlierSessionRange(series, 60, "congruent", "medianRt");
    expect(range).toMatchObject({ status: "available", count: 59 });
    if (range.status === "available") {
      expect(Math.min(...range.sessionNumbers)).toBe(1);
      expect(Math.max(...range.sessionNumbers)).toBe(59);
    }
  });
});

describe("summary limit and version filter", () => {
  it("reads at most 200 summaries and reports that older ones exist", async () => {
    const { result, details, lists } = await load(sessions(205));
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(lists).toHaveLength(2);
    expect(result).toMatchObject({
      retrieved: 200,
      truncatedList: true,
      notAnalysed: 140,
    });
    expect(details).toHaveLength(60);
  });

  it("with exactly 200 sessions nothing is truncated", async () => {
    const { result } = await load(sessions(200));
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result).toMatchObject({
      retrieved: 200,
      truncatedList: false,
      notAnalysed: 140,
    });
  });

  it("never claims older supported sessions it could not read", async () => {
    // 200 newest are of an unsupported version; 10 older supported ones are
    // beyond the summary limit and cannot be known.
    const list = sessions(210, (index) =>
      index <= 200 ? unsupported : undefined,
    );
    const { result, details } = await load(list);
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result).toMatchObject({
      retrieved: 200,
      truncatedList: true,
      unsupported: 200,
      notAnalysed: 0,
    });
    expect(details).toHaveLength(0);
  });

  it("never loads trials of unsupported-version sessions", async () => {
    const list = sessions(20, (index) =>
      index % 2 === 0 ? unsupported : undefined,
    );
    const { result, details } = await load(list);
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result.unsupported).toBe(10);
    expect(details).toHaveLength(10);
    for (const request of details) {
      const index = Number(request.url.pathname.slice(-12));
      expect(index % 2).toBe(1);
    }
  });
});

describe("invalid and unloadable sessions", () => {
  it("replaces invalid sessions with older valid ones instead of shrinking the window", async () => {
    const bad = new Set([5, 10, 15]);
    const list = sessions(70, (index) =>
      bad.has(index) ? malformed : undefined,
    );
    const { result, details } = await load(list);
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(result).toMatchObject({ notAnalysed: 7, replacementsUsed: 3 });
    expect(details).toHaveLength(63);
    const series = buildTrendSeries(
      "stroop",
      result.inputs,
      STROOP_CONFIGURATION.conditions,
    );
    expect(series.included).toHaveLength(60);
    expect(series.excluded.map((e) => e.reason)).toEqual([
      "invalid_data",
      "invalid_data",
      "invalid_data",
    ]);
    // The window is the newest 63 supported sessions, contiguous.
    expect(series.included[0].sessionId).toBe(idOf(63));
  });

  it("stops replacing after the fixed limit", async () => {
    const list = sessions(80, (index) => (index <= 15 ? malformed : undefined));
    const { result, details } = await load(list);
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(details).toHaveLength(MAX_ANALYSED + REPLACEMENT_LIMIT);
    expect(result).toMatchObject({ replacementsUsed: 10, notAnalysed: 10 });
    const series = buildTrendSeries(
      "stroop",
      result.inputs,
      STROOP_CONFIGURATION.conditions,
    );
    expect(series.included).toHaveLength(55);
  });

  it("bounds detail requests when details cannot be loaded at all", async () => {
    const { result, details } = await load(sessions(80), (backend) => {
      backend.failures.detail = 500;
    });
    if (result.kind !== "ok") throw new Error(result.kind);
    expect(details).toHaveLength(MAX_ANALYSED + REPLACEMENT_LIMIT);
    expect(result.inputs.filter((i) => i.kind === "not_loaded")).toHaveLength(
      70,
    );
    expect(result.notAnalysed).toBe(10);
  });
});
