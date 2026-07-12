import { ansi, duration, meter, paint, percent, table, type FormatSettings } from "@/cli/reports/terminal-format.ts";
import type { Weakness } from "@/progress/weaknesses.ts";

export function formatWeaknesses(rows: Weakness[], settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify(rows);
  if (!rows.length) return settings.mode === "plain"
    ? "No metadata-backed attempts yet."
    : `${paint("weak", settings, ansi.bold, ansi.cyan)}\n${paint("No skill data yet.", settings, ansi.gray)}`;
  if (settings.mode === "plain") return table(["skill", "accuracy", "missed", "total", "avg", "focus"], rows.map((row) => [row.skill, percent(row.accuracy), row.missed, row.total, duration(row.averageSeconds), row.label]));

  const skillWidth = Math.max(...rows.map((row) => Bun.stringWidth(skillName(row))), 5);
  return [
    paint("weak", settings, ansi.bold, ansi.cyan),
    paint(`${"skill".padEnd(skillWidth)}  acc   miss  avg   mastery`, settings, ansi.gray),
    ...rows.map((row) => weaknessRow(row, skillWidth, settings)),
  ].join("\n");
}

function weaknessRow(row: Weakness, skillWidth: number, settings: FormatSettings): string {
  const color = accuracyColor(row.accuracy);
  return [
    paint(skillName(row).padEnd(skillWidth), settings, color),
    paint(percent(row.accuracy).padStart(4), settings, color, ansi.bold),
    paint(`${row.missed}/${row.total}`.padStart(5), settings, row.missed ? ansi.red : ansi.gray),
    paint(duration(row.averageSeconds).padStart(4), settings, ansi.cyan),
    meter(row.accuracy, 20, settings, color),
  ].join("  ");
}

function skillName(row: Weakness): string {
  return `${row.skill}  ${row.label}`;
}

function accuracyColor(value: number): string {
  return value >= 0.9 ? ansi.green : value >= 0.75 ? ansi.yellow : ansi.red;
}
