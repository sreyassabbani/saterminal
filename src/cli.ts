import { difficultyLabels, domainLabels, focusSummary, skillLabels } from "./focus.ts";
import { progressBar } from "./progress.ts";
import { buildSummaryRows, loadAttempts, loadFocus } from "./state.ts";
import type { Attempt, Focus, SummaryRow } from "./types.ts";

export type CliCommand = "history" | "stats" | "focus";
export type OutputFormat = "text" | "pretty" | "json";

export type ParsedCli =
  | { kind: "tui" }
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "command"; command: CliCommand; format: OutputFormat };

const commands = new Set<CliCommand>(["history", "stats", "focus"]);
const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

type Writable = {
  write(value: string): unknown;
};

export function parseArgs(args: string[]): ParsedCli {
  if (args.length === 0) {
    return { kind: "tui" };
  }

  let command: string | undefined;
  let pretty = false;
  let json = false;
  const extra: string[] = [];

  for (const arg of args) {
    if (arg === "-h" || arg === "--help" || arg === "help") {
      return { kind: "help" };
    }

    if (arg === "-p" || arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    }

    if (!command) {
      command = arg;
    } else {
      extra.push(arg);
    }
  }

  if (!command) {
    return { kind: "error", message: "Missing command. Use `sat history`, `sat stats`, or `sat focus`." };
  }

  if (!commands.has(command as CliCommand)) {
    return { kind: "error", message: `Unknown command: ${command}` };
  }

  if (extra.length > 0) {
    return { kind: "error", message: `Unexpected argument: ${extra[0]}` };
  }

  if (pretty && json) {
    return { kind: "error", message: "Choose either `--pretty` or `--json`, not both." };
  }

  return {
    kind: "command",
    command: command as CliCommand,
    format: json ? "json" : pretty ? "pretty" : "text",
  };
}

export async function runCliCommand(
  parsed: Exclude<ParsedCli, { kind: "tui" }>,
  stdout: Writable = process.stdout,
  stderr: Writable = process.stderr,
): Promise<number> {
  if (parsed.kind === "help") {
    stdout.write(`${helpText()}\n`);
    return 0;
  }

  if (parsed.kind === "error") {
    stderr.write(`${parsed.message}\n\n${helpText()}\n`);
    return 1;
  }

  const output = await commandOutput(parsed.command, parsed.format);
  stdout.write(`${output}\n`);
  return 0;
}

export async function commandOutput(command: CliCommand, format: OutputFormat): Promise<string> {
  if (command === "history") {
    const attempts = await loadAttempts();
    return formatHistory([...attempts.values()], format);
  }

  if (command === "stats") {
    return formatStats(buildSummaryRows(await loadAttempts()), format);
  }

  return formatFocus(await loadFocus(), format);
}

export function formatHistory(attempts: Attempt[], format: OutputFormat): string {
  const rows = [...attempts].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  if (format === "json") {
    return JSON.stringify(rows);
  }

  if (rows.length === 0) {
    return format === "pretty" ? [heading("history"), muted("No attempts recorded.")].join("\n") : "No attempts recorded.";
  }

  if (format === "pretty") {
    return formatPrettyHistory(rows);
  }

  const table = formatTable(
    ["question", "outcome", "updated_at", "time"],
    rows.map((attempt) => [
      attempt.question_id,
      attempt.outcome,
      attempt.updated_at,
      formatDuration(attempt.elapsed_seconds),
    ]),
    false,
  );

  return table;
}

export function formatStats(rows: SummaryRow[], format: OutputFormat): string {
  const stats = statsObject(rows);

  if (format === "json") {
    return JSON.stringify(stats);
  }

  const entries = [
    ["answered", String(stats.answered)],
    ["correct", String(stats.correct)],
    ["incorrect", String(stats.incorrect)],
    ["corrected", String(stats.corrected)],
    ["accuracy", `${Math.round(stats.accuracy * 100)}%`],
    ["avg seconds", `${stats.avg_seconds.toFixed(1)}s`],
  ];

  if (format === "pretty") {
    return formatPrettyStats(stats);
  }

  return formatTable(["metric", "value"], entries, false);
}

export function formatFocus(focus: Focus, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(focus);
  }

  if (format === "pretty") {
    return [
      heading("focus"),
      muted(focusSummary(focus)),
      "",
      section("difficulty"),
      ...focus.difficulties.map((value) => option(value, difficultyLabels[value], ansi.yellow)),
      "",
      section("domains"),
      ...focus.domains.map((value) => option(value, domainLabels[value], ansi.cyan)),
      "",
      section("skills"),
      ...focus.skills.map((value) => option(value, skillLabels[value], ansi.green)),
    ].join("\n");
  }

  return [
    `difficulties: ${focus.difficulties.join(",")}`,
    `domains: ${focus.domains.join(",")}`,
    `skills: ${focus.skills.join(",")}`,
  ].join("\n");
}

export function helpText(): string {
  return [
    "usage: sat [command] [options]",
    "",
    "commands:",
    "  history  Show answered question attempts",
    "  stats    Show progress stats",
    "  focus    Show current practice focus",
    "",
    "options:",
    "  -p, --pretty  Use colorized human-readable output",
    "      --json    Output JSON",
    "  -h, --help    Show this help",
    "",
    "Run `sat` with no command to open the interactive TUI.",
  ].join("\n");
}

function formatPrettyHistory(rows: Attempt[]): string {
  const mastered = rows.filter((attempt) => attempt.outcome === "correct" || attempt.outcome === "corrected").length;
  const missed = rows.filter((attempt) => attempt.outcome === "incorrect").length;
  const averageSeconds = rows.reduce((sum, attempt) => sum + attempt.elapsed_seconds, 0) / rows.length;
  const tableRows = rows.map((attempt) => [
    paint(attempt.question_id, ansi.cyan),
    paint(attempt.outcome, outcomeColor(attempt.outcome), ansi.bold),
    paint(formatDuration(attempt.elapsed_seconds), ansi.yellow),
    muted(formatTimestamp(attempt.updated_at)),
  ]);

  return [
    heading("history"),
    [
      `${paint(String(rows.length), ansi.bold)} attempts`,
      `${paint(String(mastered), ansi.green, ansi.bold)} mastered`,
      `${paint(String(missed), missed > 0 ? ansi.red : ansi.gray, ansi.bold)} needs review`,
      `${paint(formatDuration(Math.round(averageSeconds)), ansi.cyan, ansi.bold)} avg`,
    ].join("  "),
    "",
    prettyTable(["question", "result", "time", "updated"], tableRows),
  ].join("\n");
}

function formatPrettyStats(stats: ReturnType<typeof statsObject>): string {
  const accuracyPercent = Math.round(stats.accuracy * 100);

  return [
    heading("stats"),
    [
      `${paint(String(stats.answered), ansi.bold)} answered`,
      `${paint(`${accuracyPercent}%`, accuracyColor(stats.accuracy), ansi.bold)} accuracy`,
      `${paint(formatDuration(Math.round(stats.avg_seconds)), ansi.cyan, ansi.bold)} avg`,
    ].join("  "),
    "",
    metricBar("correct", stats.correct, stats.answered, ansi.green),
    metricBar("incorrect", stats.incorrect, stats.answered, ansi.red),
    metricBar("corrected", stats.corrected, stats.answered, ansi.yellow),
  ].join("\n");
}

function metricBar(label: string, value: number, total: number, color: string): string {
  const labelText = paint(label.padEnd(9), color, ansi.bold);
  const valueText = paint(String(value).padStart(3), ansi.bold);
  return `${labelText} ${valueText}  ${bar(value, total, color)}`;
}

function bar(value: number, total: number, color: string): string {
  const width = 24;
  const ratio = total === 0 ? 0 : value / total;
  const parts = progressBar(ratio, width);
  const filled = parts.filled ? paint(parts.filled, color) : "";
  return `${filled}${muted(parts.empty)}`;
}

function prettyTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => visibleLength(row[index] ?? ""))));
  const lines = [
    headers.map((header, index) => muted(header.padEnd(widths[index] ?? header.length))).join("  ").trimEnd(),
  ];

  lines.push(...rows.map((row) => row.map((value, index) => padEndVisible(value, widths[index] ?? visibleLength(value))).join("  ").trimEnd()));
  return lines.join("\n");
}

function statsObject(rows: SummaryRow[]): {
  answered: number;
  correct: number;
  incorrect: number;
  corrected: number;
  accuracy: number;
  avg_seconds: number;
} {
  const values = Object.fromEntries(rows.map((row) => [row.metric, row.value]));
  return {
    answered: readNumber(values.answered),
    correct: readNumber(values.correct),
    incorrect: readNumber(values.incorrect),
    corrected: readNumber(values.corrected),
    accuracy: readNumber(values.accuracy),
    avg_seconds: readNumber(values.avg_seconds),
  };
}

function readNumber(value: string | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day} ${date.getUTCFullYear()} ${hour}:${minute}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatTable(headers: string[], rows: string[][], separator: boolean): string {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)));
  const lines = [formatTableRow(headers, widths)];

  if (separator) {
    lines.push(widths.map((width) => "-".repeat(width)).join("  "));
  }

  lines.push(...rows.map((row) => formatTableRow(row, widths)));
  return lines.join("\n");
}

function formatTableRow(row: string[], widths: number[]): string {
  return row.map((value, index) => value.padEnd(widths[index] ?? value.length)).join("  ").trimEnd();
}

function heading(value: string): string {
  return paint(value, ansi.bold, ansi.cyan);
}

function section(value: string): string {
  return paint(value, ansi.bold);
}

function option(code: string, label: string, color: string): string {
  return `  ${paint(code.padEnd(3), color, ansi.bold)} ${label}`;
}

function muted(value: string): string {
  return paint(value, ansi.gray);
}

function outcomeColor(outcome: Attempt["outcome"]): string {
  if (outcome === "correct") {
    return ansi.green;
  }
  if (outcome === "corrected") {
    return ansi.yellow;
  }
  return ansi.red;
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.8) {
    return ansi.green;
  }
  if (accuracy >= 0.6) {
    return ansi.yellow;
  }
  return ansi.red;
}

function paint(value: string, ...styles: string[]): string {
  return `${styles.join("")}${value}${ansi.reset}`;
}

function padEndVisible(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - visibleLength(value)))}`;
}

function visibleLength(value: string): number {
  return value.replace(/\x1b\[[0-9;]*m/g, "").length;
}
