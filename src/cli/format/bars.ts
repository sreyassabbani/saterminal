import { progressBarText } from "../../progress.ts";
import { ansi, paint } from "./style.ts";
import type { Style } from "../types.ts";

export function metricBar(label: string, value: number, total: number, color: string, bgColor: string, style: Style): string {
  const labelText = paint(label.padEnd(9), style, color, ansi.bold);
  const valueText = paint(String(value).padStart(3), style, ansi.bold);
  return `${labelText} ${valueText}  ${bar(value, total, color, bgColor, style)}`;
}

export function bar(value: number, total: number, color: string, bgColor: string, style: Style): string {
  const width = 24;
  const ratio = total === 0 ? 0 : Math.min(1, Math.max(0, value / total));

  if (!style.color) {
    return `[${progressBarText(ratio, width)}]`;
  }

  const exact = ratio * width;
  const filledCells = Math.min(width, value > 0 && exact < 1 ? 1 : Math.round(exact));
  const emptyCells = Math.max(0, width - filledCells);
  const filled = filledCells > 0 ? paint(" ".repeat(filledCells), style, bgColor) : "";
  const empty = emptyCells > 0 ? paint(" ".repeat(emptyCells), style, ansi.bgGray) : "";
  return `${filled}${empty}`;
}
