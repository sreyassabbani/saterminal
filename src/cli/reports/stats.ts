import { ansi, duration, meter, paint, percent, table, type FormatSettings } from "@/cli/reports/terminal-format.ts";
import type { Activity } from "@/progress/activity.ts";
import type { ProgressStatistics } from "@/progress/statistics.ts";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatStats(stats: ProgressStatistics, activity: Activity, settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify({ ...stats, activity: { ...activity, heatmap: activity.days, days: undefined } });
  if (settings.mode === "plain") return table(["metric", "value"], [
    ["answered", stats.answered], ["correct", stats.correct], ["incorrect", stats.incorrect], ["corrected", stats.corrected],
    ["accuracy", percent(stats.accuracy)], ["avg seconds", stats.averageSeconds.toFixed(1)], ["streak", `${activity.streak} days`], ["active days", activity.activeDays],
  ]);

  return [
    paint("progress", settings, ansi.bold, ansi.cyan),
    progressSummary(stats, activity, settings),
    "",
    paint("outcomes", settings, ansi.bold),
    outcomeRow("correct", stats.correct, stats.answered, ansi.green, settings),
    outcomeRow("corrected", stats.corrected, stats.answered, ansi.yellow, settings),
    outcomeRow("incorrect", stats.incorrect, stats.answered, ansi.red, settings),
    "",
    paint("activity", settings, ansi.bold),
    paint(activitySummary(activity), settings, ansi.gray),
    ...heatmap(activity.days, settings),
    paint("    □ none   ▪ one   ■ 2–3   ▣ 4+", settings, ansi.gray),
  ].join("\n");
}

function progressSummary(stats: ProgressStatistics, activity: Activity, settings: FormatSettings): string {
  const streak = `${activity.streak}-day streak`;
  const streakStyle = activity.streak ? [ansi.green, ansi.bold] : [ansi.gray];
  return [
    `${paint(String(stats.answered), settings, ansi.bold)} answered`,
    `${paint(percent(stats.accuracy), settings, accuracyColor(stats.accuracy), ansi.bold)} accuracy`,
    `${paint(duration(stats.averageSeconds), settings, ansi.cyan)} average`,
    paint(streak, settings, ...streakStyle),
  ].join(paint("  ·  ", settings, ansi.gray));
}

function outcomeRow(label: string, value: number, total: number, color: string, settings: FormatSettings): string {
  const ratio = total ? value / total : 0;
  return [
    paint(label.padEnd(10), settings, color, ansi.bold),
    String(value).padStart(3),
    percent(ratio).padStart(4),
    meter(ratio, 20, settings, color),
  ].join("  ");
}

function activitySummary(activity: Activity): string {
  const range = activity.days.length
    ? `${shortDate(activity.days[0].date)} – ${shortDate(activity.days.at(-1)!.date)}`
    : "no recorded dates";
  const today = `${activity.todayCount} ${activity.todayCount === 1 ? "answer" : "answers"} today`;
  return `${range}  ·  ${activity.activeDays} active days  ·  ${today}`;
}

function heatmap(days: Activity["days"], settings: FormatSettings): string[] {
  const weeks = Math.ceil(days.length / 7);
  return weekdays.map((weekday, weekdayIndex) => {
    const cells = Array.from({ length: weeks }, (_, week) => days[week * 7 + weekdayIndex]?.count ?? 0)
      .map((count) => activityCell(count, settings));
    return `${weekday} ${cells.join(" ")}`;
  });
}

function activityCell(count: number, settings: FormatSettings): string {
  if (count === 0) return paint("□", settings, ansi.gray);
  if (count === 1) return paint("▪", settings, ansi.green);
  if (count <= 3) return paint("■", settings, ansi.green, ansi.bold);
  return paint("▣", settings, ansi.brightGreen, ansi.bold);
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month - 1]} ${day}`;
}

function accuracyColor(value: number): string {
  return value >= 0.8 ? ansi.green : value >= 0.6 ? ansi.yellow : ansi.red;
}
