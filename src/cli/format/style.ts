import type { Attempt } from "../../types.ts";
import type { FormatOptions, Style, Writable } from "../types.ts";

export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bgGray: "\x1b[100m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  heatEmpty: "\x1b[38;5;238m",
  heatLow: "\x1b[38;5;22m",
  heatMid: "\x1b[38;5;28m",
  heatHigh: "\x1b[38;5;34m",
  heatMax: "\x1b[38;5;40m",
} as const;

export function resolveColor(parsedColor: boolean | undefined, stdout: Writable): boolean {
  if (parsedColor === false) {
    return false;
  }
  return stdout.isTTY === true && process.env.NO_COLOR === undefined;
}

export function styleFor(options: FormatOptions): Style {
  return { color: options.color ?? true };
}

export function heading(value: string, style: Style): string {
  return paint(value, style, ansi.bold, ansi.cyan);
}

export function section(value: string, style: Style): string {
  return paint(value, style, ansi.bold);
}

export function option(code: string, label: string, color: string, style: Style): string {
  return `  ${paint(code.padEnd(3), style, color, ansi.bold)} ${label}`;
}

export function muted(value: string, style: Style): string {
  return paint(value, style, ansi.gray);
}

export function outcomeColor(outcome: Attempt["outcome"]): string {
  if (outcome === "correct") {
    return ansi.green;
  }
  if (outcome === "corrected") {
    return ansi.yellow;
  }
  return ansi.red;
}

export function accuracyColor(accuracy: number): string {
  if (accuracy >= 0.8) {
    return ansi.green;
  }
  if (accuracy >= 0.6) {
    return ansi.yellow;
  }
  return ansi.red;
}

export function paint(value: string, style: Style, ...styles: string[]): string {
  if (!style.color || styles.length === 0) {
    return value;
  }
  return `${styles.join("")}${value}${ansi.reset}`;
}

export function padEndVisible(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - visibleLength(value)))}`;
}

export function visibleLength(value: string): number {
  return Bun.stringWidth(value);
}
