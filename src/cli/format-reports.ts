import type { Focus } from "../questions/focus.ts";
import { selectedDomains } from "../questions/focus.ts";
import { difficultyLabels, domainLabels, skillLabels } from "../questions/taxonomy.ts";
import type { Activity } from "../progress/activity.ts";
import type { Attempt } from "../progress/attempt.ts";
import type { ProgressStatistics } from "../progress/statistics.ts";
import type { Weakness } from "../progress/weaknesses.ts";

type Mode = "pretty" | "plain" | "json";
type FormatSettings = { mode: Mode; color: boolean };

const ansi = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", gray: "\x1b[90m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m" };

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

export function formatHistory(attempts: Attempt[], settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify(attempts);
  if (!attempts.length) return settings.mode === "pretty" ? `${paint("history", settings, ansi.bold, ansi.cyan)}\n${paint("No attempts matched.", settings, ansi.gray)}` : "No attempts matched.";
  if (settings.mode === "plain") return table(["question", "outcome", "answered at", "time"], attempts.map((attempt) => [attempt.questionId, attempt.outcome, attempt.answeredAt, duration(attempt.durationSeconds)]));
  const mastered = attempts.filter((attempt) => attempt.outcome !== "incorrect").length;
  const missed = attempts.length - mastered;
  return [
    paint("history", settings, ansi.bold, ansi.cyan),
    `${attempts.length} attempts  ${paint(String(mastered), settings, ansi.green, ansi.bold)} mastered  ${paint(String(missed), settings, missed ? ansi.red : ansi.gray, ansi.bold)} needs review`,
    "",
    table(["question", "result", "skill", "time", "updated"], attempts.map((attempt) => [attempt.questionId, attempt.outcome, attempt.skill ?? "-", duration(attempt.durationSeconds), timestamp(attempt.answeredAt)])),
  ].join("\n");
}

export function formatWeaknesses(rows: Weakness[], settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify(rows);
  if (!rows.length) return "No metadata-backed attempts yet.";
  if (settings.mode === "plain") return table(["skill", "accuracy", "missed", "total", "avg", "focus"], rows.map((row) => [row.skill, percent(row.accuracy), row.missed, row.total, duration(row.averageSeconds), row.label]));
  const top = rows[0];
  return [
    paint("weak spots", settings, ansi.bold, ansi.cyan),
    `${paint(top.skill, settings, ansi.cyan, ansi.bold)} has ${paint(String(top.missed), settings, top.missed ? ansi.red : ansi.green, ansi.bold)} misses`,
    "",
    table(["skill", "acc", "miss", "avg", "mastery", "focus"], rows.map((row) => [row.skill, percent(row.accuracy), `${row.missed}/${row.total}`, duration(row.averageSeconds), bar(row.accuracy, 20), row.label])),
  ].join("\n");
}

export function formatFocus(focus: Focus, settings: FormatSettings): string {
  const domains = selectedDomains(focus);
  if (settings.mode === "json") return JSON.stringify({ ...focus, domains });
  if (settings.mode === "plain") return `difficulties: ${focus.difficulties.join(",")}\ndomains: ${domains.join(",")}\nskills: ${focus.skills.join(",")}`;
  return [
    paint("focus", settings, ansi.bold, ansi.cyan),
    paint(`${focus.skills.length} skills · ${focus.difficulties.join(",")} · ${domains.length} domains`, settings, ansi.gray),
    "",
    paint("difficulty", settings, ansi.bold),
    ...focus.difficulties.map((value) => `  ${paint(value.padEnd(3), settings, ansi.yellow, ansi.bold)} ${difficultyLabels[value]}`),
    "",
    paint("domains", settings, ansi.bold),
    ...domains.map((value) => `  ${paint(value.padEnd(3), settings, ansi.cyan, ansi.bold)} ${domainLabels[value]}`),
    "",
    paint("skills", settings, ansi.bold),
    ...focus.skills.map((value) => `  ${paint(value.padEnd(3), settings, ansi.green, ansi.bold)} ${skillLabels[value]}`),
  ].join("\n");
}

function table(headers: string[], rows: (string | number)[][]): string {
  const values = [headers, ...rows.map((row) => row.map(String))];
  const widths = headers.map((_, column) => Math.max(...values.map((row) => Bun.stringWidth(row[column] ?? ""))));
  return values.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()).join("\n");
}

function metricBar(label: string, value: number, total: number, color: string, settings: FormatSettings): string {
  return `${paint(label.padEnd(9), settings, color, ansi.bold)} ${String(value).padStart(3)}  [${bar(total ? value / total : 0, 24)}]`;
}

function bar(ratio: number, width: number): string {
  const full = Math.round(Math.max(0, Math.min(1, ratio)) * width);
  return "█".repeat(full) + " ".repeat(width - full);
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

function duration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function timestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function percent(value: number): string { return `${Math.round(value * 100)}%`; }
function accuracyColor(value: number): string { return value >= 0.8 ? ansi.green : value >= 0.6 ? ansi.yellow : ansi.red; }
function paint(value: string, settings: FormatSettings, ...codes: string[]): string { return settings.color && settings.mode === "pretty" ? `${codes.join("")}${value}${ansi.reset}` : value; }
