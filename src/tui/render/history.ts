import type { Attempt } from "../../types.ts";
import { Frame } from "../frame.ts";
import { historyRows } from "../history.ts";
import { terminalSize } from "../kit.ts";
import type { AppState } from "../types.ts";
import { outcomeAttr, shortTimestamp, text } from "./shared.ts";

export function renderHistory(doc: Frame, state: AppState): void {
  const attempts = historyRows(state);
  const { width, height } = terminalSize();
  let y = 3;
  text(doc, 0, y++, "answered questions", { color: "cyan", bold: true });
  if (state.notice) {
    text(doc, 0, y++, state.notice, { color: "yellow" }, width);
  }
  y++;

  if (attempts.length === 0) {
    text(doc, 0, y, "No attempts yet.", { color: "gray" });
    return;
  }

  text(doc, 0, y++, "  question   status     skill  updated", { color: "gray" }, width);

  const visibleRows = Math.max(1, height - 8);
  const start = Math.max(0, Math.min(state.historyIndex - visibleRows + 1, attempts.length - visibleRows));
  for (const [offset, attempt] of attempts.slice(start, start + visibleRows).entries()) {
    const index = start + offset;
    renderHistoryRow(doc, attempt, index === state.historyIndex, y++, width);
  }
}

function renderHistoryRow(doc: Frame, attempt: Attempt, selected: boolean, y: number, width: number): void {
  const strong = selected ? { bold: true } : {};
  text(doc, 0, y, selected ? ">" : " ", selected ? { color: "yellow", bold: true } : { color: "gray" }, 1);
  text(doc, 2, y, attempt.question_id, { color: selected ? "yellow" : "cyan", ...strong }, 10);
  text(doc, 13, y, attempt.outcome, { ...outcomeAttr(attempt.outcome), ...strong }, 9);
  text(doc, 24, y, attempt.skill ?? "-", { color: selected ? "yellow" : "green", ...strong }, 5);
  text(doc, 31, y, shortTimestamp(attempt.updated_at), { color: selected ? "yellow" : "gray", ...strong }, width - 31);
}
