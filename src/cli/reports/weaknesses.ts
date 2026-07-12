import { ansi, duration, meter, paint, percent, table, type FormatSettings } from "@/cli/reports/terminal-format.ts";
import type { Weakness } from "@/progress/weaknesses.ts";

export function formatWeaknesses(rows: Weakness[], settings: FormatSettings): string {
  if (settings.mode === "json") return JSON.stringify(rows);
  if (!rows.length) return emptyReport(settings);
  if (settings.mode === "plain") return table(["skill", "accuracy", "missed", "total", "avg", "focus"], rows.map((row) => [row.skill, percent(row.accuracy), row.missed, row.total, duration(row.averageSeconds), row.label]));

  const needsAttention = rows.filter((row) => row.missed > 0);
  const clean = rows.filter((row) => row.missed === 0);
  const skillWidth = Math.max(...rows.map((row) => Bun.stringWidth(skillName(row))), 5);
  const output = [
    paint("weaknesses", settings, ansi.bold, ansi.cyan),
    weaknessSummary(rows, needsAttention, settings),
  ];

  if (needsAttention.length) {
    output.push("", paint("needs attention", settings, ansi.bold), weaknessHeader(skillWidth, settings));
    output.push(...weaknessRows(needsAttention, rows, skillWidth, settings));
  }
  if (clean.length) {
    output.push("", paint("clean so far", settings, ansi.bold), weaknessHeader(skillWidth, settings));
    output.push(...weaknessRows(clean, rows, skillWidth, settings));
  }
  return output.join("\n");
}

function emptyReport(settings: FormatSettings): string {
  if (settings.mode === "plain") return "No metadata-backed attempts yet.";
  return [
    paint("weaknesses", settings, ansi.bold, ansi.cyan),
    paint("No skill data yet. Answer a few questions to build a ranking.", settings, ansi.gray),
  ].join("\n");
}

function weaknessSummary(rows: Weakness[], needsAttention: Weakness[], settings: FormatSettings): string {
  if (!needsAttention.length) return paint(`${rows.length} skills tracked  ·  no current misses`, settings, ansi.green);
  const top = needsAttention[0];
  const count = `${needsAttention.length} ${needsAttention.length === 1 ? "skill needs" : "skills need"} attention`;
  const priority = `start with ${paint(top.skill, settings, ansi.cyan, ansi.bold)}  ${top.label}`;
  return `${count}  ·  ${priority}`;
}

function weaknessHeader(skillWidth: number, settings: FormatSettings): string {
  return paint(`    ${"skill".padEnd(skillWidth)}  ${"mastery".padEnd(19)}  missed  pace`, settings, ansi.gray);
}

function weaknessRows(section: Weakness[], allRows: Weakness[], skillWidth: number, settings: FormatSettings): string[] {
  return section.map((row) => {
    const rank = String(allRows.indexOf(row) + 1).padStart(2);
    const color = accuracyColor(row.accuracy);
    const mastery = `${meter(row.accuracy, 12, settings, color)} ${percent(row.accuracy).padStart(4)}`;
    return [
      paint(rank, settings, ansi.gray),
      skillName(row).padEnd(skillWidth),
      mastery,
      `${row.missed}/${row.total}`.padStart(6),
      duration(row.averageSeconds).padStart(4),
    ].join("  ");
  });
}

function skillName(row: Weakness): string {
  return `${row.skill}  ${row.label}`;
}

function accuracyColor(value: number): string {
  return value >= 0.9 ? ansi.green : value >= 0.75 ? ansi.yellow : ansi.red;
}
