import { difficultyLabels, domainLabels, focusSummary, skillLabels } from "./focus.ts";
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
    return format === "pretty" ? "history\nNo attempts recorded." : "No attempts recorded.";
  }

  const table = formatTable(
    ["question", "outcome", "updated_at", "time"],
    rows.map((attempt) => [
      attempt.question_id,
      attempt.outcome,
      attempt.updated_at,
      formatDuration(attempt.elapsed_seconds),
    ]),
    format === "pretty",
  );

  return format === "pretty" ? `history\n${table}` : table;
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
  const table = formatTable(["metric", "value"], entries, format === "pretty");

  return format === "pretty" ? `stats\n${table}` : table;
}

export function formatFocus(focus: Focus, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(focus);
  }

  if (format === "pretty") {
    return [
      "focus",
      focusSummary(focus),
      "",
      "difficulties",
      ...focus.difficulties.map((value) => `  ${value}  ${difficultyLabels[value]}`),
      "",
      "domains",
      ...focus.domains.map((value) => `  ${value}  ${domainLabels[value]}`),
      "",
      "skills",
      ...focus.skills.map((value) => `  ${value}  ${skillLabels[value]}`),
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
    "  -p, --pretty  Use expanded human-readable output",
    "      --json    Output JSON",
    "  -h, --help    Show this help",
    "",
    "Run `sat` with no command to open the interactive TUI.",
  ].join("\n");
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
