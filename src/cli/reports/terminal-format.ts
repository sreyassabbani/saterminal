export type OutputMode = "pretty" | "plain" | "json";
export type FormatSettings = { mode: OutputMode; color: boolean };

export const ansi = {
  reset: "\x1b[0m", bold: "\x1b[1m", gray: "\x1b[90m", red: "\x1b[31m",
  green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

export function table(headers: string[], rows: (string | number)[][]): string {
  const values = [headers, ...rows.map((row) => row.map(String))];
  const widths = headers.map((_, column) => Math.max(...values.map((row) => Bun.stringWidth(row[column] ?? ""))));
  return values.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()).join("\n");
}

export function bar(ratio: number, width: number): string {
  const full = Math.round(Math.max(0, Math.min(1, ratio)) * width);
  return "█".repeat(full) + " ".repeat(width - full);
}

export function duration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function paint(value: string, settings: FormatSettings, ...codes: string[]): string {
  return settings.color && settings.mode === "pretty" ? `${codes.join("")}${value}${ansi.reset}` : value;
}
