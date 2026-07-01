import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSummaryRows, loadAttempts, nextOutcome, recordAttempt, saveAttempts } from "../src/state.ts";

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
});
