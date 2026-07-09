import { domainLabels, skillLabels } from "../../focus.ts";
import type { Attempt } from "../../types.ts";
import { bar } from "../format/bars.ts";
import { formatTable, prettyTable } from "../format/table.ts";
import { formatDuration } from "../format/time.ts";
import { accuracyColor, ansi, heading, muted, paint, styleFor } from "../format/style.ts";
import type { FormatOptions, OutputFormat, WeakRow } from "../types.ts";

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

function formatPrettyWeak(rows: WeakRow[], style: ReturnType<typeof styleFor>): string {
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
