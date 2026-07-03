import { describe, expect, test } from "bun:test";
import { defaultFocus } from "../src/focus.ts";
import {
  formatFocus,
  formatHistory,
  formatStats,
  parseArgs,
} from "../src/cli.ts";
import { buildSummaryRows, recordAttempt } from "../src/state.ts";
import type { Focus } from "../src/types.ts";

describe("cli", () => {
  test("uses subcommands for report selection and flags for format", () => {
    expect(parseArgs([])).toEqual({ kind: "tui" });
    expect(parseArgs(["history"])).toEqual({ kind: "command", command: "history", format: "text" });
    expect(parseArgs(["history", "-p"])).toEqual({ kind: "command", command: "history", format: "pretty" });
    expect(parseArgs(["--json", "stats"])).toEqual({ kind: "command", command: "stats", format: "json" });
    expect(parseArgs(["--history"])).toEqual({ kind: "error", message: "Unknown option: --history" });
  });

  test("rejects conflicting output format flags", () => {
    expect(parseArgs(["focus", "--json", "--pretty"])).toEqual({
      kind: "error",
      message: "Choose either `--pretty` or `--json`, not both.",
    });
  });

  test("formats history as sorted JSON and pretty table output", () => {
    const attempts = new Map();
    recordAttempt(attempts, "older", false, 65, new Date("2026-01-01T00:00:00.000Z"));
    recordAttempt(attempts, "newer", true, 5, new Date("2026-01-02T00:00:00.000Z"));

    expect(JSON.parse(formatHistory([...attempts.values()], "json"))).toEqual([
      {
        question_id: "newer",
        outcome: "correct",
        updated_at: "2026-01-02T00:00:00.000Z",
        elapsed_seconds: 5,
      },
      {
        question_id: "older",
        outcome: "incorrect",
        updated_at: "2026-01-01T00:00:00.000Z",
        elapsed_seconds: 65,
      },
    ]);

    expect(formatHistory([...attempts.values()], "pretty")).toContain("history\nquestion");
    expect(formatHistory([...attempts.values()], "pretty")).toContain("newer");
    expect(formatHistory([...attempts.values()], "pretty")).toContain("correct");
    expect(formatHistory([...attempts.values()], "pretty")).toContain("1:05");
  });

  test("formats stats with numeric JSON and human percentages", () => {
    const attempts = new Map();
    recordAttempt(attempts, "a", true, 20, new Date("2026-01-01T00:00:00.000Z"));
    recordAttempt(attempts, "b", false, 40, new Date("2026-01-01T00:00:00.000Z"));
    const rows = buildSummaryRows(attempts, new Date("2026-01-02T00:00:00.000Z"));

    expect(JSON.parse(formatStats(rows, "json"))).toEqual({
      answered: 2,
      correct: 1,
      incorrect: 1,
      corrected: 0,
      accuracy: 0.5,
      avg_seconds: 30,
    });
    expect(formatStats(rows, "pretty")).toContain("accuracy     50%");
    expect(formatStats(rows, "text")).toContain("avg seconds  30.0s");
  });

  test("formats focus as raw selections or labeled pretty output", () => {
    const focus: Focus = { difficulties: ["H"], domains: ["CAS"], skills: ["WIC"] };

    expect(formatFocus(focus, "json")).toBe(JSON.stringify(focus));
    expect(formatFocus(focus, "text")).toBe("difficulties: H\ndomains: CAS\nskills: WIC");
    expect(formatFocus(focus, "pretty")).toContain("H  Hard");
    expect(formatFocus(defaultFocus, "pretty")).toContain("10 skills");
  });
});
