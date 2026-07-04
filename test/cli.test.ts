import { describe, expect, test } from "bun:test";
import { defaultFocus } from "../src/focus.ts";
import {
  formatFocus,
  formatHistory,
  formatStats,
  formatWeak,
  parseArgs,
  runCliCommand,
} from "../src/cli.ts";
import { buildSummaryRows, recordAttempt } from "../src/state.ts";
import type { AttemptEvent, Focus, QuestionMeta } from "../src/types.ts";

describe("cli", () => {
  test("uses subcommands for report selection and flags for format", () => {
    expect(parseArgs([])).toEqual({ kind: "tui" });
    expect(parseArgs(["history"])).toEqual({ kind: "command", command: "history", format: "text" });
    expect(parseArgs(["history", "-p"])).toEqual({ kind: "command", command: "history", format: "pretty" });
    expect(parseArgs(["--json", "stats"])).toEqual({ kind: "command", command: "stats", format: "json" });
    expect(parseArgs(["weak", "--pretty", "--no-color"])).toEqual({ kind: "command", command: "weak", format: "pretty", color: false });
    expect(parseArgs(["review"])).toEqual({ kind: "review" });
    expect(parseArgs(["--version"])).toEqual({ kind: "version" });
    expect(parseArgs(["-V"])).toEqual({ kind: "version" });
    expect(parseArgs(["--history"])).toEqual({ kind: "error", message: "Unknown option: --history" });
    expect(parseArgs(["sync"])).toEqual({ kind: "error", message: "Unknown command: sync" });
  });

  test("prints the package version", async () => {
    const packageJson = await Bun.file(new URL("../package.json", import.meta.url)).json() as { version: string };
    let output = "";

    const code = await runCliCommand({ kind: "version" }, {
      write(value: string) {
        output += value;
      },
    });

    expect(code).toBe(0);
    expect(output).toBe(`sat ${packageJson.version}\n`);
  });

  test("rejects conflicting output format flags", () => {
    expect(parseArgs(["focus", "--json", "--pretty"])).toEqual({
      kind: "error",
      message: "Choose either `--pretty` or `--json`, not both.",
    });
  });

  test("parses and applies history filters", () => {
    expect(parseArgs(["history", "--wrong", "--corrected", "--limit", "5", "--since=7d"])).toEqual({
      kind: "command",
      command: "history",
      format: "text",
      filters: { wrong: true, corrected: true, limit: 5, since: "7d" },
    });
    expect(parseArgs(["stats", "--wrong"])).toEqual({
      kind: "error",
      message: "History filters only work with `sat history`.",
    });
    const attempts = new Map();
    recordAttempt(attempts, "old", false, 10, new Date("2026-01-01T00:00:00.000Z"));
    recordAttempt(attempts, "wrong", false, 20, new Date("2026-01-08T00:00:00.000Z"));
    recordAttempt(attempts, "fixed", false, 30, new Date("2026-01-08T00:00:00.000Z"));
    recordAttempt(attempts, "fixed", true, 40, new Date("2026-01-09T00:00:00.000Z"));

    expect(JSON.parse(formatHistory([...attempts.values()], "json", { filters: { wrong: true }, now: new Date("2026-01-10T00:00:00.000Z") }))).toEqual([
      {
        question_id: "wrong",
        outcome: "incorrect",
        updated_at: "2026-01-08T00:00:00.000Z",
        elapsed_seconds: 20,
      },
      {
        question_id: "old",
        outcome: "incorrect",
        updated_at: "2026-01-01T00:00:00.000Z",
        elapsed_seconds: 10,
      },
    ]);
    expect(JSON.parse(formatHistory([...attempts.values()], "json", {
      filters: { corrected: true, since: "7d", limit: 1 },
      now: new Date("2026-01-10T00:00:00.000Z"),
    }))).toEqual([
      {
        question_id: "fixed",
        outcome: "corrected",
        updated_at: "2026-01-09T00:00:00.000Z",
        elapsed_seconds: 40,
      },
    ]);
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

    const pretty = formatHistory([...attempts.values()], "pretty");
    expect(pretty).toContain("\x1b[");
    expect(stripAnsi(pretty)).toContain("history\n2 attempts  1 mastered  1 needs review");
    expect(stripAnsi(pretty)).toContain("newer");
    expect(stripAnsi(pretty)).toContain("correct");
    expect(stripAnsi(pretty)).toContain("1:05");
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
    const pretty = formatStats(rows, "pretty");
    expect(pretty).toContain("\x1b[");
    expect(stripAnsi(pretty)).toContain("stats\n2 answered  50% accuracy  0:30 avg");
    expect(stripAnsi(pretty)).toContain("correct     1");
    expect(stripAnsi(pretty)).toContain("incorrect   1");
    expect(pretty).toContain("\x1b[42m            \x1b[0m\x1b[100m            \x1b[0m");
    expect(stripAnsi(pretty)).not.toContain("#");
    expect(stripAnsi(pretty)).not.toContain("░");
    expect(formatStats(rows, "text")).toContain("avg seconds  30.0s");

    const noColor = formatStats(rows, "pretty", { color: false });
    expect(noColor).not.toContain("\x1b[");
    expect(noColor).toContain("[████████████            ]");
  });

  test("formats stats with streak and activity when events are available", () => {
    const attempts = new Map();
    recordAttempt(attempts, "a", true, 20, new Date("2026-01-09T12:00:00"));
    const rows = buildSummaryRows(attempts, new Date("2026-01-10T12:00:00"));
    const events: AttemptEvent[] = [
      attemptEvent("a", true, "2026-01-08T12:00:00"),
      attemptEvent("b", false, "2026-01-09T12:00:00"),
    ];

    expect(JSON.parse(formatStats(rows, "json", { events, now: new Date("2026-01-10T12:00:00") })).activity).toMatchObject({
      streak: 2,
      activeDays: 2,
      todayCount: 0,
      totalEvents: 2,
    });

    const rawPretty = formatStats(rows, "pretty", { events, now: new Date("2026-01-10T12:00:00") });
    const pretty = stripAnsi(rawPretty);
    expect(pretty).toContain("2 day streak");
    expect(pretty).toContain("activity\nlast 12 weeks");
    expect(pretty).toContain("Mon");
    expect(pretty).toContain("Wed");
    expect(pretty).toContain("Fri");
    expect(pretty).toContain("Oct");
    expect(pretty).toContain("Jan");
    expect(rawPretty).toContain("\x1b[38;5;238m■\x1b[0m");
    expect(rawPretty).toContain("\x1b[38;5;22m■\x1b[0m");
    expect(rawPretty).not.toContain("·");
  });

  test("formats focus as raw selections or labeled pretty output", () => {
    const focus: Focus = { difficulties: ["H"], domains: ["CAS"], skills: ["WIC"] };

    expect(formatFocus(focus, "json")).toBe(JSON.stringify(focus));
    expect(formatFocus(focus, "text")).toBe("difficulties: H\ndomains: CAS\nskills: WIC");
    expect(formatFocus(focus, "pretty")).toContain("\x1b[");
    expect(stripAnsi(formatFocus(focus, "pretty"))).toContain("H   Hard");
    expect(stripAnsi(formatFocus(defaultFocus, "pretty"))).toContain("10 skills");
  });

  test("formats weak spots from metadata-backed attempts", () => {
    const attempts = new Map();
    recordAttempt(attempts, "wic1", false, 50, new Date("2026-01-01T00:00:00.000Z"), sampleMeta);
    recordAttempt(
      attempts,
      "ctc1",
      true,
      20,
      new Date("2026-01-02T00:00:00.000Z"),
      { ...sampleMeta, questionId: "ctc1", skill_cd: "CTC", skill_desc: "Cross-Text Connections" },
    );

    expect(JSON.parse(formatWeak([...attempts.values()], "json"))[0]).toMatchObject({
      skill: "WIC",
      missed: 1,
      total: 1,
      accuracy: 0,
    });
    expect(formatWeak([...attempts.values()], "text")).toContain("WIC    0%");
    expect(stripAnsi(formatWeak([...attempts.values()], "pretty"))).toContain("weak spots\nWIC has 1 misses");
  });
});

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function attemptEvent(questionId: string, correct: boolean, answeredAt: string): AttemptEvent {
  return {
    question_id: questionId,
    correct,
    answered_at: answeredAt,
    elapsed_seconds: 20,
    difficulty: "M",
    domain: "CAS",
    domain_desc: "Craft and Structure",
    skill: "WIC",
    skill_desc: "Words in Context",
  };
}

const sampleMeta: QuestionMeta = {
  questionId: "wic1",
  uId: "wic1",
  external_id: "external-1",
  difficulty: "M",
  primary_class_cd: "CAS",
  primary_class_cd_desc: "Craft and Structure",
  skill_cd: "WIC",
  skill_desc: "Words in Context",
};
