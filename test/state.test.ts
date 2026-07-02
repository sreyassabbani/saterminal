import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultFocus, normalizeFocus } from "../src/focus.ts";
import {
  buildSummaryRows,
  loadAttempts,
  loadFocus,
  nextOutcome,
  recordAttempt,
  saveAttempts,
  saveFocus,
} from "../src/state.ts";

describe("state", () => {
  test("creates and reads a compact attempts csv", async () => {
    const dir = await mkdtemp(join(tmpdir(), "satui-"));
    const path = join(dir, "attempts.csv");

    try {
      const attempts = await loadAttempts(path);
      recordAttempt(attempts, "abc12345", false, 42, new Date("2026-01-01T00:00:00.000Z"));
      await saveAttempts(attempts, path);

      const raw = await readFile(path, "utf8");
      expect(raw).toBe(
        "question_id,outcome,updated_at,elapsed_seconds\nabc12345,incorrect,2026-01-01T00:00:00.000Z,42\n",
      );
      expect(await loadAttempts(path)).toEqual(attempts);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("uses corrected for a later right answer after a miss", () => {
    const attempts = new Map();
    recordAttempt(attempts, "abc12345", false, 12, new Date("2026-01-01T00:00:00.000Z"));
    recordAttempt(attempts, "abc12345", true, 10, new Date("2026-01-02T00:00:00.000Z"));

    expect(attempts.get("abc12345")?.outcome).toBe("corrected");
  });

  test("does not downgrade mastered outcomes", () => {
    expect(nextOutcome("correct", false)).toBe("correct");
    expect(nextOutcome("corrected", false)).toBe("corrected");
  });

  test("builds summary rows from attempts", () => {
    const attempts = new Map();
    recordAttempt(attempts, "a", true, 20, new Date("2026-01-01T00:00:00.000Z"));
    recordAttempt(attempts, "b", false, 10, new Date("2026-01-01T00:00:00.000Z"));
    recordAttempt(attempts, "b", true, 40, new Date("2026-01-02T00:00:00.000Z"));

    const rows = buildSummaryRows(attempts, new Date("2026-01-03T00:00:00.000Z"));
    expect(Object.fromEntries(rows.map((row) => [row.metric, row.value]))).toEqual({
      answered: "2",
      correct: "1",
      incorrect: "0",
      corrected: "1",
      accuracy: "1.00",
      avg_seconds: "30.0",
    });
  });

  test("normalizes invalid focus selections to valid defaults", () => {
    expect(normalizeFocus({ difficulties: [], domains: ["NOPE"], skills: ["CID"] })).toEqual({
      difficulties: defaultFocus.difficulties,
      domains: ["INI"],
      skills: ["CID"],
    });
  });

  test("derives focus domains from selected skills", () => {
    expect(normalizeFocus({ difficulties: ["H"], domains: ["INI"], skills: ["WIC"] })).toEqual({
      difficulties: ["H"],
      domains: ["CAS"],
      skills: ["WIC"],
    });
  });

  test("saves and loads focus json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "satui-"));
    const path = join(dir, "focus.json");

    try {
      await saveFocus({ difficulties: ["H"], domains: ["SEC"], skills: ["BOU", "FSS"] }, path);
      expect(await loadFocus(path)).toEqual({ difficulties: ["H"], domains: ["SEC"], skills: ["BOU", "FSS"] });

      await writeFile(path, "{\"difficulties\":[],\"domains\":[],\"skills\":[]}", "utf8");
      expect(await loadFocus(path)).toEqual(defaultFocus);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
