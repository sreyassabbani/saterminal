import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultFocus, normalizeFocus } from "../src/focus.ts";
import {
  appendAttemptEvent,
  buildSummaryRows,
  displayStateDir,
  ensureStateFiles,
  loadAttemptEvents,
  loadAttempts,
  loadFocus,
  nextOutcome,
  recordAttempt,
  resolveStateDir,
  saveAttempts,
  saveFocus,
  stateDirExists,
} from "../src/state.ts";
import type { QuestionMeta } from "../src/types.ts";

describe("state", () => {
  test("resolves state under the user home directory", () => {
    expect(resolveStateDir("/home/user")).toBe("/home/user/.saterminal");
  });

  test("displays state dir with a tilde prefix", () => {
    expect(displayStateDir("/home/user/.saterminal", "/home/user")).toBe("~/.saterminal");
    expect(displayStateDir("/home/user", "/home/user")).toBe("~");
  });

  test("detects whether the state directory exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    try {
      expect(await stateDirExists(dir)).toBe(true);
      expect(await stateDirExists(join(dir, "missing"))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("stores attempts, events, and focus in sqlite", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    const db = join(dir, "sat.db");
    try {
      await ensureStateFiles(db);
      const attempts = await loadAttempts(db);
      recordAttempt(attempts, "abc12345", false, 42, new Date("2026-01-01T00:00:00.000Z"), sampleMeta);
      await saveAttempts(attempts, db);

      expect(await loadAttempts(db)).toEqual(new Map([
        ["abc12345", {
          question_id: "abc12345",
          outcome: "incorrect",
          updated_at: "2026-01-01T00:00:00.000Z",
          elapsed_seconds: 42,
          difficulty: "H",
          domain: "CAS",
          domain_desc: "Craft and Structure",
          skill: "WIC",
          skill_desc: "Words in Context",
        }],
      ]));

      await appendAttemptEvent(sampleMeta, true, 31, new Date("2026-01-01T12:00:00.000Z"), db);
      expect(await loadAttemptEvents(db)).toEqual([{
        question_id: "abc12345",
        correct: true,
        answered_at: "2026-01-01T12:00:00.000Z",
        elapsed_seconds: 31,
        difficulty: "H",
        domain: "CAS",
        domain_desc: "Craft and Structure",
        skill: "WIC",
        skill_desc: "Words in Context",
      }]);

      await saveFocus({ difficulties: ["H"], domains: ["SEC"], skills: ["BOU", "FSS"] }, db);
      expect(await loadFocus(db)).toEqual({ difficulties: ["H"], domains: ["SEC"], skills: ["BOU", "FSS"] });
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
    expect(Object.fromEntries(buildSummaryRows(attempts, new Date("2026-01-03T00:00:00.000Z")).map((row) => [row.metric, row.value]))).toEqual({
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
});

const sampleMeta: QuestionMeta = {
  questionId: "abc12345",
  uId: "abc12345",
  external_id: "external-1",
  difficulty: "H",
  primary_class_cd: "CAS",
  primary_class_cd_desc: "Craft and Structure",
  skill_cd: "WIC",
  skill_desc: "Words in Context",
};
