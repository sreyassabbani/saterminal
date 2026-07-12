import { ansi, duration, meter, paint, percent, table, type FormatSettings } from "@/cli/reports/terminal-format.ts";
import type { Activity } from "@/progress/activity.ts";
import type { ProgressStatistics } from "@/progress/statistics.ts";

export function formatStats(stats: ProgressStatistics, activity: Activity, settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify({ ...stats, activity: { ...activity, heatmap: activity.days, days: undefined } });
  if (settings.mode === "plain") return table(["metric", "value"], [
    ["answered", stats.answered], ["correct", stats.correct], ["incorrect", stats.incorrect], ["corrected", stats.corrected],
    ["accuracy", percent(stats.accuracy)], ["avg seconds", stats.averageSeconds.toFixed(1)], ["streak", `${activity.streak} days`], ["active days", activity.activeDays],
  ]);

  return [
    paint("stats", settings, ansi.bold, ansi.cyan),
    summary(stats, activity, settings),
    "",
    outcome("correct", stats.correct, stats.answered, ansi.green, settings),
    outcome("incorrect", stats.incorrect, stats.answered, ansi.red, settings),
    outcome("corrected", stats.corrected, stats.answered, ansi.yellow, settings),
    "",
    activityHeading(activity, settings),
    ...heatmap(activity.days, settings),
  ].join("\n");
}

function summary(stats: ProgressStatistics, activity: Activity, settings: FormatSettings): string {
  return [
    `${paint(String(stats.answered), settings, ansi.bold)} answered`,
    `${paint(percent(stats.accuracy), settings, accuracyColor(stats.accuracy), ansi.bold)} accuracy`,
    `${paint(duration(stats.averageSeconds), settings, ansi.cyan)} avg`,
    `${paint(String(activity.streak), settings, ansi.green, ansi.bold)}-day streak`,
  ].join(paint("  ·  ", settings, ansi.gray));
}

function outcome(label: string, value: number, total: number, color: string, settings: FormatSettings): string {
  const ratio = total ? value / total : 0;
  return `${paint(label.padEnd(10), settings, color, ansi.bold)} ${String(value).padStart(3)}  ${meter(ratio, 20, settings, color)}`;
}

function activityHeading(activity: Activity, settings: FormatSettings): string {
  return [
    paint("activity", settings, ansi.bold),
    paint(`${activity.activeDays} days`, settings, ansi.green),
    paint(`${activity.todayCount} today`, settings, ansi.cyan),
  ].join(paint("  ·  ", settings, ansi.gray));
}

function heatmap(days: Activity["days"], settings: FormatSettings): string[] {
  const weeks = Math.ceil(days.length / 7);
  return Array.from({ length: 7 }, (_, weekday) => {
    const label = weekday === 1 ? "Mon" : weekday === 3 ? "Wed" : weekday === 5 ? "Fri" : "   ";
    const cells = Array.from({ length: weeks }, (_, week) => days[week * 7 + weekday]?.count ?? 0)
      .map((count) => activityCell(count, settings));
    return `${label} ${cells.join(" ")}`;
  });
}

function activityCell(count: number, settings: FormatSettings): string {
  if (count === 0) return paint("□", settings, ansi.gray);
  if (count === 1) return paint("■", settings, ansi.green);
  if (count <= 3) return paint("■", settings, ansi.cyan);
  return paint("■", settings, ansi.yellow, ansi.bold);
}

function accuracyColor(value: number): string {
  return value >= 0.8 ? ansi.green : value >= 0.6 ? ansi.yellow : ansi.red;
}
