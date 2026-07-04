import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultFocus, normalizeFocus } from "../src/focus.ts";
import {
  buildSummaryRows,
  displayStateDir,
  appendAttemptEvent,
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
  test("resolves state dir under the user home directory", () => {
    expect(resolveStateDir("/home/user")).toBe("/home/user/.saterminal/userlocal");
  });

  test("displays state dir with a tilde prefix", () => {
    expect(displayStateDir("/home/user/.saterminal/userlocal", "/home/user")).toBe("~/.saterminal/userlocal");
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

  test("creates and reads a compact attempts csv", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    const path = join(dir, "attempts.csv");

    try {
      const attempts = await loadAttempts(path);
      recordAttempt(attempts, "abc12345", false, 42, new Date("2026-01-01T00:00:00.000Z"), sampleMeta);
      await saveAttempts(attempts, path);

      const raw = await readFile(path, "utf8");
      expect(raw).toBe(
        [
          "question_id,outcome,updated_at,elapsed_seconds,difficulty,domain,domain_desc,skill,skill_desc",
          "abc12345,incorrect,2026-01-01T00:00:00.000Z,42,H,CAS,Craft and Structure,WIC,Words in Context",
          "",
        ].join("\n"),
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

  test("loads escaped csv fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    const path = join(dir, "attempts.csv");

    try {
      await writeFile(
        path,
        [
          "question_id,outcome,updated_at,elapsed_seconds,difficulty,domain,domain_desc,skill,skill_desc",
          "\"abc,123\",correct,\"2026-01-01T00:00:00.000Z\",12,M,INI,\"Information, Ideas\",CID,Central Ideas",
          "",
        ].join("\n"),
        "utf8",
      );

      expect(await loadAttempts(path)).toEqual(new Map([
        ["abc,123", {
          question_id: "abc,123",
          outcome: "correct",
          updated_at: "2026-01-01T00:00:00.000Z",
          elapsed_seconds: 12,
          difficulty: "M",
          domain: "INI",
          domain_desc: "Information, Ideas",
          skill: "CID",
          skill_desc: "Central Ideas",
        }],
      ]));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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

  test("appends and loads attempt events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    const path = join(dir, "events.csv");

    try {
      await appendAttemptEvent(sampleMeta, true, 31, new Date("2026-01-01T12:00:00.000Z"), path);
      await appendAttemptEvent(
        { ...sampleMeta, questionId: "def67890", skill_cd: "CTC", skill_desc: "Cross-Text Connections" },
        false,
        44,
        new Date("2026-01-02T12:00:00.000Z"),
        path,
      );

      expect(await loadAttemptEvents(path)).toEqual([
        {
          question_id: "abc12345",
          correct: true,
          answered_at: "2026-01-01T12:00:00.000Z",
          elapsed_seconds: 31,
          difficulty: "H",
          domain: "CAS",
          domain_desc: "Craft and Structure",
          skill: "WIC",
          skill_desc: "Words in Context",
        },
        {
          question_id: "def67890",
          correct: false,
          answered_at: "2026-01-02T12:00:00.000Z",
          elapsed_seconds: 44,
          difficulty: "H",
          domain: "CAS",
          domain_desc: "Craft and Structure",
          skill: "CTC",
          skill_desc: "Cross-Text Connections",
        },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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

  test("creates default focus when file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    const path = join(dir, "focus.json");

    try {
      expect(await loadFocus(path)).toEqual(defaultFocus);
      expect(await readFile(path, "utf8")).toContain("\"difficulties\"");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("saves and loads focus json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
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

  test("throws when focus json is invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-"));
    const path = join(dir, "focus.json");

    try {
      await writeFile(path, "{not json", "utf8");
      await expect(loadFocus(path)).rejects.toThrow(/Invalid focus file/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
