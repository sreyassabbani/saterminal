import { buildSummaryRows } from "../../state.ts";
import { progressBarText } from "../../progress.ts";
import type { SummaryRow } from "../../types.ts";
import { Frame, type TextAttr } from "../frame.ts";
import { terminalSize } from "../kit.ts";
import type { AppState } from "../types.ts";
import { text } from "./shared.ts";

export function renderSummary(doc: Frame, state: AppState): void {
  const { width } = terminalSize();
  let y = 3;
  text(doc, 0, y++, "stats summary", { color: "cyan", bold: true });
  text(doc, 0, y++, "practice progress from recorded attempts", { color: "gray" }, width);
  y++;
  for (const row of buildSummaryRows(state.attempts)) {
    renderSummaryRow(doc, row, y++, width);
  }
}

function renderSummaryRow(doc: Frame, row: SummaryRow, y: number, width: number): void {
  const value = summaryValue(row);
  const attr = summaryAttr(row);

  text(doc, 0, y, summaryLabel(row.metric), { color: "gray" }, 16);
  text(doc, 17, y, value, attr, 10);

  const barWidth = width - 30;
  if (row.metric === "accuracy" && barWidth >= 10) {
    text(doc, 29, y, accuracyBar(row.value, Math.min(24, barWidth)), attr, barWidth);
  }
}

function summaryLabel(metric: string): string {
  if (metric === "avg_seconds") {
    return "avg seconds";
  }
  return metric;
}

function summaryValue(row: SummaryRow): string {
  if (row.metric === "accuracy") {
    return `${Math.round(readRatio(row.value) * 100)}%`;
  }
  if (row.metric === "avg_seconds") {
    return `${row.value}s`;
  }
  return row.value;
}

function summaryAttr(row: SummaryRow): TextAttr {
  if (row.metric === "answered") {
    return { color: "cyan" };
  }
  if (row.metric === "correct") {
    return { color: "green", bold: true };
  }
  if (row.metric === "incorrect") {
    return { color: "red", bold: true };
  }
  if (row.metric === "corrected") {
    return { color: "yellow", bold: true };
  }
  if (row.metric === "accuracy") {
    const ratio = readRatio(row.value);
    return ratio >= 0.8 ? { color: "green", bold: true } : ratio >= 0.6 ? { color: "yellow", bold: true } : { color: "red", bold: true };
  }
  return { color: "cyan" };
}

function accuracyBar(value: string, width: number): string {
  const barWidth = Math.max(8, width - 2);
  return `[${progressBarText(readRatio(value), barWidth)}]`;
}

function readRatio(value: string): number {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.min(1, Math.max(0, ratio));
}
