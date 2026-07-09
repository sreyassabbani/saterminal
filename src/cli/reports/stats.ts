import type { SummaryRow } from "../../types.ts";
import { formatTable } from "../format/table.ts";
import { ansi, accuracyColor, heading, muted, paint, section, styleFor } from "../format/style.ts";
import { formatDuration } from "../format/time.ts";
import { heatmapLines } from "../format/heatmap.ts";
import { metricBar } from "../format/bars.ts";
import { activityPayload, buildActivityStats } from "./activity.ts";
import type { ActivityStats, FormatOptions, OutputFormat } from "../types.ts";

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

function formatPrettyStats(stats: ReturnType<typeof statsObject>, activity: ActivityStats | undefined, style: ReturnType<typeof styleFor>): string {
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
      muted(`last 12 weeks | ${activity.activeDays} active days | ${activity.todayCount} today`, style),
      ...heatmapLines(activity.days, style),
    );
  }

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
