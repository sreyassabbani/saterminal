import type { Weakness } from "../../progress/weaknesses.ts";
import { ansi, bar, duration, paint, percent, table, type FormatSettings } from "./terminal-format.ts";

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
