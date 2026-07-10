import type { Activity } from "../../progress/activity.ts";
import type { ProgressStatistics } from "../../progress/statistics.ts";
import { ansi, bar, duration, paint, percent, table, type FormatSettings } from "./terminal-format.ts";

export function formatStats(stats: ProgressStatistics, activity: Activity, settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify({ ...stats, activity: { ...activity, heatmap: activity.days, days: undefined } });
  if (settings.mode === "plain") return table(["metric", "value"], [
    ["answered", stats.answered], ["correct", stats.correct], ["incorrect", stats.incorrect], ["corrected", stats.corrected],
    ["accuracy", percent(stats.accuracy)], ["avg seconds", stats.averageSeconds.toFixed(1)], ["streak", `${activity.streak} days`], ["active days", activity.activeDays],
  ]);
  return [
    paint("stats", settings, ansi.bold, ansi.cyan),
    `${paint(String(stats.answered), settings, ansi.bold)} answered  ${paint(percent(stats.accuracy), settings, accuracyColor(stats.accuracy), ansi.bold)} accuracy  ${paint(duration(stats.averageSeconds), settings, ansi.cyan)} avg  ${paint(String(activity.streak), settings, ansi.green, ansi.bold)} day streak`,
    "",
    metricBar("correct", stats.correct, stats.answered, ansi.green, settings),
    metricBar("incorrect", stats.incorrect, stats.answered, ansi.red, settings),
    metricBar("corrected", stats.corrected, stats.answered, ansi.yellow, settings),
    "",
    paint("activity", settings, ansi.bold),
    paint(`last 12 weeks | ${activity.activeDays} active days | ${activity.todayCount} today`, settings, ansi.gray),
    ...heatmap(activity.days, settings),
  ].join("\n");
}

function metricBar(label: string, value: number, total: number, color: string, settings: FormatSettings): string {
  return `${paint(label.padEnd(9), settings, color, ansi.bold)} ${String(value).padStart(3)}  [${bar(total ? value / total : 0, 24)}]`;
}

function heatmap(days: Activity["days"], settings: FormatSettings): string[] {
  const weeks = Math.ceil(days.length / 7);
  return Array.from({ length: 7 }, (_, weekday) => {
    const label = weekday === 1 ? "Mon" : weekday === 3 ? "Wed" : weekday === 5 ? "Fri" : "   ";
    const cells = Array.from({ length: weeks }, (_, week) => days[week * 7 + weekday]?.count ?? 0)
      .map((count) => paint(count ? "■" : "□", settings, count ? ansi.green : ansi.gray));
    return `${label} ${cells.join(" ")}`;
  });
}

function accuracyColor(value: number): string {
  return value >= 0.8 ? ansi.green : value >= 0.6 ? ansi.yellow : ansi.red;
}
