import type { Attempt } from "../../types.ts";
import { formatDuration, formatTimestamp, parseSince } from "../format/time.ts";
import { formatTable, prettyTable } from "../format/table.ts";
import { ansi, heading, muted, outcomeColor, paint, styleFor } from "../format/style.ts";
import type { FormatOptions, HistoryFilters, OutputFormat } from "../types.ts";

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

function formatPrettyHistory(rows: Attempt[], style: ReturnType<typeof styleFor>): string {
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
