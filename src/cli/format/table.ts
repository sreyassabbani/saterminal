import { muted, padEndVisible, visibleLength } from "./style.ts";
import type { Style } from "../types.ts";

export function prettyTable(headers: string[], rows: string[][], style: Style): string {
  const widths = headers.map((header, index) => Math.max(visibleLength(header), ...rows.map((row) => visibleLength(row[index] ?? ""))));
  const lines = [
    headers.map((header, index) => muted(header.padEnd(widths[index] ?? visibleLength(header)), style)).join("  ").trimEnd(),
  ];

  lines.push(...rows.map((row) => row.map((value, index) => padEndVisible(value, widths[index] ?? visibleLength(value))).join("  ").trimEnd()));
  return lines.join("\n");
}

export function formatTable(headers: string[], rows: string[][], separator: boolean): string {
  const widths = headers.map((header, index) => Math.max(visibleLength(header), ...rows.map((row) => visibleLength(row[index] ?? ""))));
  const lines = [formatTableRow(headers, widths)];

  if (separator) {
    lines.push(widths.map((width) => "-".repeat(width)).join("  "));
  }

  lines.push(...rows.map((row) => formatTableRow(row, widths)));
  return lines.join("\n");
}

function formatTableRow(row: string[], widths: number[]): string {
  return row.map((value, index) => padEndVisible(value, widths[index] ?? visibleLength(value))).join("  ").trimEnd();
}
