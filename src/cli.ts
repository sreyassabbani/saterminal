import { difficultyLabels, domainLabels, focusSummary, skillLabels } from "./focus.ts";
import { progressBarText } from "./progress.ts";
import { buildSummaryRows, loadAttemptEvents, loadAttempts, loadFocus } from "./state.ts";
import type { Attempt, AttemptEvent, Focus, SummaryRow } from "./types.ts";

export type CliCommand = "history" | "stats" | "focus" | "weak";
export type OutputFormat = "text" | "pretty" | "json";

export type HistoryFilters = {
  wrong?: boolean;
  corrected?: boolean;
  limit?: number;
  since?: string;
};

export type ParsedCli =
  | { kind: "tui" }
  | { kind: "review" }
  | { kind: "help" }
  | { kind: "error"; message: string }
  | {
    kind: "command";
    command: CliCommand;
    format: OutputFormat;
    color?: boolean;
    filters?: HistoryFilters;
  };

type FormatOptions = {
  color?: boolean;
  events?: AttemptEvent[];
  filters?: HistoryFilters;
  now?: Date;
};

type Style = {
  color: boolean;
};

type Writable = {
  write(value: string): unknown;
  isTTY?: boolean;
};

type ActivityDay = {
  date: string;
  count: number;
};

type ActivityStats = {
  streak: number;
  activeDays: number;
  todayCount: number;
  totalEvents: number;
  days: ActivityDay[];
};

type WeakRow = {
  skill: string;
  label: string;
  domain: string;
  domainLabel: string;
  total: number;
  mastered: number;
  missed: number;
  accuracy: number;
  avg_seconds: number;
};

const reportCommands = new Set<CliCommand>(["history", "stats", "focus", "weak"]);
const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bgGray: "\x1b[100m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
} as const;

export function parseArgs(args: string[]): ParsedCli {
  if (args.length === 0) {
    return { kind: "tui" };
  }

  let command: string | undefined;
  let pretty = false;
  let json = false;
  let noColor = false;
  const filters: HistoryFilters = {};
  const extra: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";

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

    if (arg === "--no-color") {
      noColor = true;
      continue;
    }

    if (arg === "--wrong") {
      filters.wrong = true;
      continue;
    }

    if (arg === "--corrected") {
      filters.corrected = true;
      continue;
    }

    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const value = optionValue(args, index, "--limit");
      if (!value) {
        return { kind: "error", message: "Missing value for `--limit`." };
      }
      if (arg === "--limit") {
        index += 1;
      }
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit <= 0) {
        return { kind: "error", message: "`--limit` must be a positive integer." };
      }
      filters.limit = limit;
      continue;
    }

    if (arg === "--since" || arg.startsWith("--since=")) {
      const value = optionValue(args, index, "--since");
      if (!value) {
        return { kind: "error", message: "Missing value for `--since`." };
      }
      if (!isSinceValue(value)) {
        return { kind: "error", message: "`--since` must be an ISO date or a relative value like `7d` or `2w`." };
      }
      if (arg === "--since") {
        index += 1;
      }
      filters.since = value;
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
    return { kind: "error", message: "Missing command. Use `sat history`, `sat stats`, `sat focus`, `sat weak`, or `sat review`." };
  }

  if (extra.length > 0) {
    return { kind: "error", message: `Unexpected argument: ${extra[0]}` };
  }

  if (pretty && json) {
    return { kind: "error", message: "Choose either `--pretty` or `--json`, not both." };
  }

  if (command === "review") {
    if (pretty || json || hasHistoryFilters(filters)) {
      return { kind: "error", message: "`sat review` opens the TUI and does not support report flags." };
    }
    return { kind: "review" };
  }

  if (!reportCommands.has(command as CliCommand)) {
    return { kind: "error", message: `Unknown command: ${command}` };
  }

  if (command !== "history" && hasHistoryFilters(filters)) {
    return { kind: "error", message: "History filters only work with `sat history`." };
  }

  const parsed: ParsedCli = {
    kind: "command",
    command: command as CliCommand,
    format: json ? "json" : pretty ? "pretty" : "text",
    ...(noColor ? { color: false } : {}),
    ...(command === "history" && hasHistoryFilters(filters) ? { filters } : {}),
  };

  return parsed;
}

export async function runCliCommand(
  parsed: Exclude<ParsedCli, { kind: "tui" | "review" }>,
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

  const color = parsed.format === "pretty" ? resolveColor(parsed.color, stdout) : false;
  const output = await commandOutput(parsed.command, parsed.format, {
    color,
    filters: parsed.filters,
  });
  stdout.write(`${output}\n`);
  return 0;
}

export async function commandOutput(command: CliCommand, format: OutputFormat, options: FormatOptions = {}): Promise<string> {
  if (command === "history") {
    const attempts = await loadAttempts();
    return formatHistory([...attempts.values()], format, options);
  }

  if (command === "stats") {
    const attempts = await loadAttempts();
    const events = await loadAttemptEvents();
    return formatStats(buildSummaryRows(attempts), format, { ...options, events });
  }

  if (command === "weak") {
    const attempts = await loadAttempts();
    return formatWeak([...attempts.values()], format, options);
  }

  return formatFocus(await loadFocus(), format, options);
}

export function formatHistory(attempts: Attempt[], format: OutputFormat, options: FormatOptions = {}): string {
  const rows = filterHistory(attempts, options.filters, options.now);
  const style = styleFor(options);

  if (format === "json") {
    return JSON.stringify(rows);
  }

  if (rows.length === 0) {
    return format === "pretty" ? [heading("history", style), muted("No attempts matched.", style)].join("\n") : "No attempts matched.";
  }

  if (format === "pretty") {
    return formatPrettyHistory(rows, style);
  }

  return formatTable(
    ["question", "outcome", "updated_at", "time"],
    rows.map((attempt) => [
      attempt.question_id,
      attempt.outcome,
      attempt.updated_at,
      formatDuration(attempt.elapsed_seconds),
    ]),
    false,
  );
}

export function formatStats(rows: SummaryRow[], format: OutputFormat, options: FormatOptions = {}): string {
  const stats = statsObject(rows);
  const activity = options.events ? buildActivityStats(options.events, options.now) : undefined;
  const style = styleFor(options);

  if (format === "json") {
    return JSON.stringify(activity ? { ...stats, activity: activityPayload(activity) } : stats);
  }

  const entries = [
    ["answered", String(stats.answered)],
    ["correct", String(stats.correct)],
    ["incorrect", String(stats.incorrect)],
    ["corrected", String(stats.corrected)],
    ["accuracy", `${Math.round(stats.accuracy * 100)}%`],
    ["avg seconds", `${stats.avg_seconds.toFixed(1)}s`],
    ...(activity ? [["streak", `${activity.streak} days`], ["active days", String(activity.activeDays)]] : []),
  ];

  if (format === "pretty") {
    return formatPrettyStats(stats, activity, style);
  }

  return formatTable(["metric", "value"], entries, false);
}

export function formatFocus(focus: Focus, format: OutputFormat, options: FormatOptions = {}): string {
  const style = styleFor(options);

  if (format === "json") {
    return JSON.stringify(focus);
  }

  if (format === "pretty") {
    return [
      heading("focus", style),
      muted(focusSummary(focus), style),
      "",
      section("difficulty", style),
      ...focus.difficulties.map((value) => option(value, difficultyLabels[value], ansi.yellow, style)),
      "",
      section("domains", style),
      ...focus.domains.map((value) => option(value, domainLabels[value], ansi.cyan, style)),
      "",
      section("skills", style),
      ...focus.skills.map((value) => option(value, skillLabels[value], ansi.green, style)),
    ].join("\n");
  }

  return [
    `difficulties: ${focus.difficulties.join(",")}`,
    `domains: ${focus.domains.join(",")}`,
    `skills: ${focus.skills.join(",")}`,
  ].join("\n");
}

export function formatWeak(attempts: Attempt[], format: OutputFormat, options: FormatOptions = {}): string {
  const rows = buildWeakRows(attempts);
  const style = styleFor(options);

  if (format === "json") {
    return JSON.stringify(rows);
  }

  if (rows.length === 0) {
    const message = "No metadata-backed attempts yet. Answer new questions to build this report.";
    return format === "pretty" ? [heading("weak spots", style), muted(message, style)].join("\n") : message;
  }

  if (format === "pretty") {
    return formatPrettyWeak(rows, style);
  }

  return formatTable(
    ["skill", "accuracy", "missed", "total", "avg", "focus"],
    rows.map((row) => [
      row.skill,
      `${Math.round(row.accuracy * 100)}%`,
      String(row.missed),
      String(row.total),
      formatDuration(Math.round(row.avg_seconds)),
      row.label,
    ]),
    false,
  );
}

export function helpText(): string {
  return [
    "usage: sat [command] [options]",
    "",
    "commands:",
    "  history  Show answered question attempts",
    "  stats    Show progress stats, streak, and activity",
    "  weak     Show weak skills from recorded attempts",
    "  focus    Show current practice focus",
    "  review   Practice missed and corrected questions in the TUI",
    "",
    "history filters:",
    "      --wrong       Show currently missed questions",
    "      --corrected   Show corrected questions",
    "      --limit N     Limit rows",
    "      --since WHEN  Show rows since an ISO date, 7d, or 2w",
    "",
    "options:",
    "  -p, --pretty    Use colorized human-readable output",
    "      --json      Output JSON",
    "      --no-color  Disable ANSI color in pretty output",
    "  -h, --help      Show this help",
    "",
    "Run `sat` with no command to open the interactive TUI.",
  ].join("\n");
}

export function filterHistory(attempts: Attempt[], filters: HistoryFilters = {}, now = new Date()): Attempt[] {
  let rows = [...attempts].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  if (filters.since) {
    const since = parseSince(filters.since, now);
    rows = rows.filter((attempt) => {
      const updated = new Date(attempt.updated_at);
      return Number.isFinite(updated.getTime()) && updated >= since;
    });
  }

  if (filters.wrong || filters.corrected) {
    rows = rows.filter((attempt) =>
      (filters.wrong && attempt.outcome === "incorrect") || (filters.corrected && attempt.outcome === "corrected")
    );
  }

  if (filters.limit) {
    rows = rows.slice(0, filters.limit);
  }

  return rows;
}

export function buildActivityStats(events: AttemptEvent[], now = new Date(), days = 84): ActivityStats {
  const counts = new Map<string, number>();
  for (const event of events) {
    const answered = new Date(event.answered_at);
    if (Number.isNaN(answered.getTime())) {
      continue;
    }
    const key = dateKey(answered);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = startOfDay(now);
  const rangeStart = addDays(today, -(days - 1));
  const activityDays: ActivityDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(rangeStart, offset);
    const key = dateKey(date);
    activityDays.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return {
    streak: streakDays(counts, today),
    activeDays: activityDays.filter((day) => day.count > 0).length,
    todayCount: counts.get(dateKey(today)) ?? 0,
    totalEvents: events.length,
    days: activityDays,
  };
}

export function buildWeakRows(attempts: Attempt[]): WeakRow[] {
  const groups = new Map<string, WeakRow>();

  for (const attempt of attempts) {
    if (!attempt.skill) {
      continue;
    }

    const existing = groups.get(attempt.skill) ?? {
      skill: attempt.skill,
      label: attempt.skill_desc || skillLabels[attempt.skill as keyof typeof skillLabels] || attempt.skill,
      domain: attempt.domain ?? "",
      domainLabel: attempt.domain_desc || (attempt.domain ? domainLabels[attempt.domain as keyof typeof domainLabels] : "") || "",
      total: 0,
      mastered: 0,
      missed: 0,
      accuracy: 0,
      avg_seconds: 0,
    };

    existing.total += 1;
    existing.avg_seconds += attempt.elapsed_seconds;
    if (attempt.outcome === "incorrect") {
      existing.missed += 1;
    } else {
      existing.mastered += 1;
    }
    groups.set(attempt.skill, existing);
  }

  return [...groups.values()]
    .map((row) => ({
      ...row,
      accuracy: row.total === 0 ? 0 : row.mastered / row.total,
      avg_seconds: row.total === 0 ? 0 : row.avg_seconds / row.total,
    }))
    .sort((a, b) =>
      b.missed - a.missed ||
      a.accuracy - b.accuracy ||
      b.total - a.total ||
      a.skill.localeCompare(b.skill)
    );
}

function formatPrettyHistory(rows: Attempt[], style: Style): string {
  const mastered = rows.filter((attempt) => attempt.outcome === "correct" || attempt.outcome === "corrected").length;
  const missed = rows.filter((attempt) => attempt.outcome === "incorrect").length;
  const averageSeconds = rows.reduce((sum, attempt) => sum + attempt.elapsed_seconds, 0) / rows.length;
  const tableRows = rows.map((attempt) => [
    paint(attempt.question_id, style, ansi.cyan),
    paint(attempt.outcome, style, outcomeColor(attempt.outcome), ansi.bold),
    paint(attempt.skill ?? "-", style, ansi.green),
    paint(formatDuration(attempt.elapsed_seconds), style, ansi.yellow),
    muted(formatTimestamp(attempt.updated_at), style),
  ]);

  return [
    heading("history", style),
    [
      `${paint(String(rows.length), style, ansi.bold)} attempts`,
      `${paint(String(mastered), style, ansi.green, ansi.bold)} mastered`,
      `${paint(String(missed), style, missed > 0 ? ansi.red : ansi.gray, ansi.bold)} needs review`,
      `${paint(formatDuration(Math.round(averageSeconds)), style, ansi.cyan, ansi.bold)} avg`,
    ].join("  "),
    "",
    prettyTable(["question", "result", "skill", "time", "updated"], tableRows, style),
  ].join("\n");
}

function formatPrettyStats(stats: ReturnType<typeof statsObject>, activity: ActivityStats | undefined, style: Style): string {
  const accuracyPercent = Math.round(stats.accuracy * 100);
  const lines = [
    heading("stats", style),
    [
      `${paint(String(stats.answered), style, ansi.bold)} answered`,
      `${paint(`${accuracyPercent}%`, style, accuracyColor(stats.accuracy), ansi.bold)} accuracy`,
      `${paint(formatDuration(Math.round(stats.avg_seconds)), style, ansi.cyan, ansi.bold)} avg`,
      ...(activity ? [`${paint(String(activity.streak), style, ansi.green, ansi.bold)} day streak`] : []),
    ].join("  "),
    "",
    metricBar("correct", stats.correct, stats.answered, ansi.green, ansi.bgGreen, style),
    metricBar("incorrect", stats.incorrect, stats.answered, ansi.red, ansi.bgRed, style),
    metricBar("corrected", stats.corrected, stats.answered, ansi.yellow, ansi.bgYellow, style),
  ];

  if (activity) {
    lines.push(
      "",
      section("activity", style),
      muted(`last 12 weeks · ${activity.activeDays} active days · ${activity.todayCount} today`, style),
      ...heatmapLines(activity.days, style),
    );
  }

  return lines.join("\n");
}

function formatPrettyWeak(rows: WeakRow[], style: Style): string {
  const top = rows[0];
  const tableRows = rows.map((row) => [
    paint(row.skill, style, ansi.cyan, ansi.bold),
    paint(`${Math.round(row.accuracy * 100)}%`, style, accuracyColor(row.accuracy), ansi.bold),
    paint(`${row.missed}/${row.total}`, style, row.missed > 0 ? ansi.red : ansi.green),
    paint(formatDuration(Math.round(row.avg_seconds)), style, ansi.yellow),
    bar(row.mastered, row.total, ansi.green, ansi.bgGreen, style),
    row.label,
  ]);

  return [
    heading("weak spots", style),
    top
      ? `${paint(top.skill, style, ansi.cyan, ansi.bold)} has ${paint(String(top.missed), style, top.missed > 0 ? ansi.red : ansi.green, ansi.bold)} misses`
      : muted("No weak spots yet.", style),
    "",
    prettyTable(["skill", "acc", "miss", "avg", "mastery", "focus"], tableRows, style),
  ].join("\n");
}

function metricBar(label: string, value: number, total: number, color: string, bgColor: string, style: Style): string {
  const labelText = paint(label.padEnd(9), style, color, ansi.bold);
  const valueText = paint(String(value).padStart(3), style, ansi.bold);
  return `${labelText} ${valueText}  ${bar(value, total, color, bgColor, style)}`;
}

function bar(value: number, total: number, color: string, bgColor: string, style: Style): string {
  const width = 24;
  const ratio = total === 0 ? 0 : Math.min(1, Math.max(0, value / total));

  if (!style.color) {
    return `[${progressBarText(ratio, width)}]`;
  }

  const exact = ratio * width;
  const filledCells = Math.min(width, value > 0 && exact < 1 ? 1 : Math.round(exact));
  const emptyCells = Math.max(0, width - filledCells);
  const filled = filledCells > 0 ? paint(" ".repeat(filledCells), style, bgColor) : "";
  const empty = emptyCells > 0 ? paint(" ".repeat(emptyCells), style, ansi.bgGray) : "";
  return `${filled}${empty}`;
}

function prettyTable(headers: string[], rows: string[][], style: Style): string {
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => visibleLength(row[index] ?? ""))));
  const lines = [
    headers.map((header, index) => muted(header.padEnd(widths[index] ?? header.length), style)).join("  ").trimEnd(),
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

function activityPayload(activity: ActivityStats): Omit<ActivityStats, "days"> & { heatmap: ActivityDay[] } {
  return {
    streak: activity.streak,
    activeDays: activity.activeDays,
    todayCount: activity.todayCount,
    totalEvents: activity.totalEvents,
    heatmap: activity.days,
  };
}

function heatmapLines(days: ActivityDay[], style: Style): string[] {
  if (days.length === 0) {
    return [];
  }

  const first = parseDateKey(days[0]?.date ?? dateKey(new Date()));
  const last = parseDateKey(days[days.length - 1]?.date ?? dateKey(new Date()));
  const start = startOfWeek(first);
  const dayMap = new Map(days.map((day) => [day.date, day.count]));
  const weeks = Math.floor((startOfDay(last).getTime() - start.getTime()) / (7 * 86_400_000)) + 1;
  const labels = ["   ", "mon", "   ", "wed", "   ", "fri", "   "];
  const lines: string[] = [];

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const cells: string[] = [];
    for (let week = 0; week < weeks; week += 1) {
      const date = addDays(start, week * 7 + weekday);
      if (date < first || date > last) {
        cells.push(" ");
        continue;
      }
      const count = dayMap.get(dateKey(date)) ?? 0;
      cells.push(heatGlyph(count, style));
    }
    lines.push(`${labels[weekday]} ${cells.join("")}`);
  }

  return lines;
}

function heatGlyph(count: number, style: Style): string {
  const glyph = count === 0 ? "·" : count <= 2 ? "▁" : count <= 4 ? "▃" : count <= 6 ? "▅" : "█";
  if (count === 0) {
    return paint(glyph, style, ansi.gray);
  }
  if (count <= 2) {
    return paint(glyph, style, ansi.cyan);
  }
  if (count <= 4) {
    return paint(glyph, style, ansi.green);
  }
  return paint(glyph, style, ansi.yellow);
}

function streakDays(counts: Map<string, number>, today: Date): number {
  if (counts.size === 0) {
    return 0;
  }

  let cursor = startOfDay(today);
  if ((counts.get(dateKey(cursor)) ?? 0) === 0) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while ((counts.get(dateKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function parseSince(value: string, now: Date): Date {
  const relative = /^(\d+)(d|w)$/.exec(value);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    return addDays(startOfDay(now), -(unit === "w" ? amount * 7 : amount));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid --since value: ${value}`);
  }
  return date;
}

function isSinceValue(value: string): boolean {
  return /^(\d+)(d|w)$/.test(value) || !Number.isNaN(new Date(value).getTime());
}

function optionValue(args: string[], index: number, name: "--limit" | "--since"): string | undefined {
  const arg = args[index] ?? "";
  if (arg.startsWith(`${name}=`)) {
    return arg.slice(name.length + 1);
  }
  const next = args[index + 1];
  return next && !next.startsWith("-") ? next : undefined;
}

function hasHistoryFilters(filters: HistoryFilters): boolean {
  return Boolean(filters.wrong || filters.corrected || filters.limit || filters.since);
}

function resolveColor(parsedColor: boolean | undefined, stdout: Writable): boolean {
  if (parsedColor === false) {
    return false;
  }
  return stdout.isTTY === true && process.env.NO_COLOR === undefined;
}

function styleFor(options: FormatOptions): Style {
  return { color: options.color ?? true };
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
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
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

function heading(value: string, style: Style): string {
  return paint(value, style, ansi.bold, ansi.cyan);
}

function section(value: string, style: Style): string {
  return paint(value, style, ansi.bold);
}

function option(code: string, label: string, color: string, style: Style): string {
  return `  ${paint(code.padEnd(3), style, color, ansi.bold)} ${label}`;
}

function muted(value: string, style: Style): string {
  return paint(value, style, ansi.gray);
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

function paint(value: string, style: Style, ...styles: string[]): string {
  if (!style.color || styles.length === 0) {
    return value;
  }
  return `${styles.join("")}${value}${ansi.reset}`;
}

function padEndVisible(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - visibleLength(value)))}`;
}

function visibleLength(value: string): number {
  return value.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year = "0", month = "1", day = "1"] = value.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}
