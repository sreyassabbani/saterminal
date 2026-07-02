import { buildSummaryRows } from "../state.ts";
import { focusSummary } from "../focus.ts";
import { htmlToText, wrapText } from "../text.ts";
import type { TextSegment } from "../text.ts";
import { focusGrid, normalizeFocusGridPosition, type FocusGridColumn, type FocusGridRow } from "./focus-grid.ts";
import { historyRows } from "./history.ts";
import {
  answerKeys,
  practiceQuestionApiUrl,
  practiceQuestionUrl,
  questionNeedsExternalDisplay,
  questionPageSize,
  questionRows,
} from "./question.ts";
import { elapsedQuestionSeconds, formatElapsed, timerStatus } from "./timer.ts";
import { terminalSize, tk, type TkDocument } from "./kit.ts";
import type { AppState, PaneLayout } from "./types.ts";
import type { Attempt, Outcome, QuestionMeta, SummaryRow } from "../types.ts";

type TextAttr = Record<string, unknown>;

export function createDocument(): TkDocument {
  return new tk.Document({
    eventSource: tk.terminal,
    outputDst: tk.terminal,
    backgroundAttr: {},
  });
}

export function render(doc: TkDocument, state: AppState): void {
  doc.clear();

  if (state.view === "practice" && state.timerPaused) {
    renderPaused(doc);
    footer(doc, state);
    doc.draw();
    return;
  }

  header(doc, state);

  if (state.view === "loading") {
    text(doc, 0, 3, "Loading...");
  } else if (state.view === "focus") {
    renderFocus(doc, state);
  } else if (state.view === "practice") {
    renderPractice(doc, state);
  } else if (state.view === "review") {
    renderReview(doc, state);
  } else if (state.view === "history") {
    renderHistory(doc, state);
  } else if (state.view === "summary") {
    renderSummary(doc, state);
  } else if (state.view === "detail") {
    renderDetail(doc, state);
  } else if (state.view === "error") {
    renderError(doc, state);
  }

  footer(doc, state);
  doc.draw();
}

function renderPaused(doc: TkDocument): void {
  const { width, height } = terminalSize();
  const label = "PAUSED";
  text(doc, Math.max(0, Math.floor((width - label.length) / 2)), Math.max(0, Math.floor(height / 2)), label, { bold: true });
}

function header(doc: TkDocument, state: AppState): void {
  const { width } = terminalSize();
  const answered = state.attempts.size;
  const timer = state.timerHidden ? "" : `  time ${formatElapsed(elapsedQuestionSeconds(state))}${timerStatus(state)}`;
  text(doc, 0, 0, "sat", { bold: true });
  text(doc, 7, 0, `reading/writing  answered ${answered}${timer}`, { color: "gray" }, width - 7);
  text(doc, 0, 1, "-".repeat(width), { color: "gray" }, width);
}

function footer(doc: TkDocument, state: AppState): void {
  const { width, height } = terminalSize();
  const controls = state.view === "practice"
    ? practiceControls(state)
    : state.view === "focus"
      ? "up/down or j/k row | tab/shift-tab group | space toggle | enter start | q quit"
    : state.view === "review"
      ? "pgup/pgdn or [/] scroll question | enter/n next | f focus | h history | s summary | q quit"
      : state.view === "history"
        ? "up/down or j/k move | enter open | f focus | p practice | s summary | q quit"
        : state.view === "detail"
          ? "pgup/pgdn or [/] scroll question | esc history | f focus | p practice | q quit"
          : state.view === "error"
            ? "r retry | q quit"
            : "p practice | h history | q quit";

  text(doc, 0, Math.max(0, height - 2), "-".repeat(width), { color: "gray" }, width);
  text(doc, 0, Math.max(0, height - 1), controls, { color: "gray" }, width);
}

function renderFocus(doc: TkDocument, state: AppState): void {
  const { width } = terminalSize();
  const columns = focusGrid(state.focus);
  const position = normalizeFocusGridPosition(columns, { column: state.focusColumn, row: state.focusRow });
  state.focusColumn = position.column;
  state.focusRow = position.row;

  const summary = focusSummary(state.focus);
  text(doc, 0, 3, "study focus", { bold: true });
  text(doc, Math.max(0, width - summary.length - 1), 3, summary, { color: "cyan" });
  text(doc, 0, 4, "Space toggles the selected row. Enter starts practice.", { color: "gray" }, width);

  renderDifficultyColumn(doc, columns[0], position.column === 0 ? position.row : -1);
  renderDomainColumns(doc, columns.slice(1), position.column - 1, position.row);
}

function renderDifficultyColumn(doc: TkDocument, column: FocusGridColumn, selectedRow: number): void {
  text(doc, 0, 6, column.title, { color: "cyan", bold: true });

  for (const [index, row] of column.rows.entries()) {
    const output = focusOptionText(row, index === selectedRow);
    writeFocusOption(doc, 0, 7 + index, output, row, index === selectedRow, 32);
  }
}

function renderDomainColumns(doc: TkDocument, columns: FocusGridColumn[], selectedColumn: number, selectedRow: number): void {
  const { width } = terminalSize();
  const startY = 11;
  const gap = 4;
  const perRow = width >= 112 ? 4 : width >= 72 ? 2 : 1;
  const columnWidth = Math.max(24, Math.floor((width - gap * (perRow - 1)) / perRow));

  for (const [index, column] of columns.entries()) {
    const gridX = index % perRow;
    const gridY = Math.floor(index / perRow);
    const x = gridX * (columnWidth + gap);
    const y = startY + gridY * 7;
    const columnSelected = index === selectedColumn;

    text(doc, x, y, truncate(column.title, columnWidth), { color: "cyan", bold: columnSelected });
    for (const [rowIndex, row] of column.rows.entries()) {
      const focused = columnSelected && rowIndex === selectedRow;
      writeFocusOption(doc, x, y + rowIndex + 1, focusOptionText(row, focused), row, focused, columnWidth);
    }
  }
}

function focusOptionText(row: FocusGridRow, focused: boolean): string {
  const marker = focused ? ">" : " ";
  const checked = row.partial ? "◐" : row.checked ? "●" : "○";
  const indent = row.depth > 0 ? "  " : "";
  return `${marker} ${indent}${checked} ${row.label}`;
}

function writeFocusOption(
  doc: TkDocument,
  x: number,
  y: number,
  value: string,
  row: FocusGridRow,
  focused: boolean,
  width = terminalSize().width - x,
): void {
  const attr = focused ? { color: "yellow", bold: true } : row.checked || row.partial ? { color: "green" } : { color: "gray" };
  text(doc, x, y, value, attr, width);
}

function renderPractice(doc: TkDocument, state: AppState): void {
  if (!state.question) {
    return;
  }

  const panes = paneLayout();
  if (questionNeedsExternalDisplay(state.question.detail)) {
    renderUnsupportedQuestion(doc, state, panes);
    return;
  }

  renderQuestionPane(doc, state, panes.leftX, panes.leftWidth, state.questionScroll);

  let rightY = 3;
  for (const [index, key] of answerKeys(state.question).entries()) {
    const marker = index === state.selected ? ">" : " ";
    const answer = `${marker} ${key}. ${htmlToText(state.question.detail.answerOptions[key])}`;
    rightY = printWrappedAt(doc, answer, panes.rightX, rightY, panes.rightWidth, terminalSize().height - 4, index === state.selected);
    rightY++;
  }
}

function renderReview(doc: TkDocument, state: AppState): void {
  if (!state.question) {
    return;
  }

  const { meta, detail } = state.question;
  const panes = paneLayout();
  let rightY = 3;
  const correct = state.lastCorrect ? "correct" : "incorrect";

  text(doc, panes.rightX, rightY++, correct.toUpperCase(), { color: state.lastCorrect ? "green" : "red", bold: true }, panes.rightWidth);
  text(doc, panes.rightX, rightY++, `your answer: ${state.lastAnswer ?? "-"}`, { color: state.lastCorrect ? "green" : "red" }, panes.rightWidth);
  text(doc, panes.rightX, rightY++, `correct: ${detail.correct_answer.join(", ")}`, { color: "green" }, panes.rightWidth);
  text(doc, panes.rightX, rightY++, `time: ${formatElapsed(elapsedQuestionSeconds(state))}`, { color: "cyan" }, panes.rightWidth);
  rightY++;
  text(doc, panes.rightX, rightY++, formatDomain(meta), { color: "cyan" }, panes.rightWidth);
  text(doc, panes.rightX, rightY++, formatSkill(meta), { color: "cyan" }, panes.rightWidth);
  text(doc, panes.rightX, rightY++, `difficulty ${meta.difficulty} | ${meta.questionId}`, difficultyAttr(meta.difficulty), panes.rightWidth);
  rightY++;
  text(doc, panes.rightX, rightY++, "rationale", { bold: true }, panes.rightWidth);
  printWrappedAt(doc, htmlToText(detail.rationale), panes.rightX, rightY, panes.rightWidth, terminalSize().height - 4);

  renderQuestionPane(doc, state, panes.leftX, panes.leftWidth, state.questionScroll);
}

function renderHistory(doc: TkDocument, state: AppState): void {
  const attempts = historyRows(state);
  const { width, height } = terminalSize();
  let y = 3;
  text(doc, 0, y++, "answered questions", { color: "cyan", bold: true });
  y++;

  if (attempts.length === 0) {
    text(doc, 0, y, "No attempts yet.", { color: "gray" });
    return;
  }

  text(doc, 0, y++, "  question   status     updated", { color: "gray" }, width);

  const visibleRows = Math.max(1, height - 8);
  const start = Math.max(0, Math.min(state.historyIndex - visibleRows + 1, attempts.length - visibleRows));
  for (const [offset, attempt] of attempts.slice(start, start + visibleRows).entries()) {
    const index = start + offset;
    renderHistoryRow(doc, attempt, index === state.historyIndex, y++, width);
  }
}

function renderSummary(doc: TkDocument, state: AppState): void {
  const { width } = terminalSize();
  let y = 3;
  text(doc, 0, y++, "stats summary", { color: "cyan", bold: true });
  text(doc, 0, y++, "practice progress from recorded attempts", { color: "gray" }, width);
  y++;
  for (const row of buildSummaryRows(state.attempts)) {
    renderSummaryRow(doc, row, y++, width);
  }
}

function renderDetail(doc: TkDocument, state: AppState): void {
  const panes = paneLayout();
  let rightY = 3;
  if (!state.detailQuestion) {
    text(doc, 0, 3, "Could not fetch details for this question.");
    return;
  }

  const { meta, detail } = state.detailQuestion;
  const attempt = state.attempts.get(meta.questionId);
  if (questionNeedsExternalDisplay(detail)) {
    renderUnsupportedQuestion(doc, { ...state, question: state.detailQuestion }, panes);
    return;
  }

  rightY = renderQuestionMetadata(doc, meta, attempt, panes.rightX, rightY, panes.rightWidth);
  rightY++;

  renderQuestionPane(doc, { ...state, question: state.detailQuestion }, panes.leftX, panes.leftWidth, state.questionScroll);

  text(doc, panes.rightX, rightY, "answer key", { color: "cyan", bold: true }, panes.rightWidth);
  text(doc, panes.rightX + 12, rightY++, `correct: ${detail.correct_answer.join(", ")}`, { color: "green", bold: true }, panes.rightWidth - 12);
  for (const key of answerKeys(state.detailQuestion)) {
    const correct = detail.correct_answer.includes(key);
    const label = correct ? "*" : " ";
    rightY = printWrappedAt(
      doc,
      `${label} ${key}. ${htmlToText(detail.answerOptions[key])}`,
      panes.rightX,
      rightY,
      panes.rightWidth,
      terminalSize().height - 4,
      correct,
      correct ? { color: "green" } : { color: "gray" },
    );
    rightY++;
  }

  if (detail.rationale && rightY < terminalSize().height - 7) {
    rightY++;
    text(doc, panes.rightX, rightY++, "rationale", { color: "cyan", bold: true }, panes.rightWidth);
    printWrappedAt(doc, htmlToText(detail.rationale), panes.rightX, rightY, panes.rightWidth, terminalSize().height - 4);
  }
}

function renderError(doc: TkDocument, state: AppState): void {
  text(doc, 0, 3, "Something went wrong.", { bold: true, color: "red" });
  printWrappedAt(doc, state.error ?? "Unknown error.", 0, 5, terminalSize().width - 1, terminalSize().height - 4);
}

function renderQuestionPane(doc: TkDocument, state: AppState, x: number, width: number, scroll: number): void {
  if (!state.question) {
    return;
  }

  const rows = questionRows(state.question.detail, width);
  const maxRows = questionPageSize();
  const maxScroll = Math.max(0, rows.length - maxRows);
  const start = Math.min(scroll, maxScroll);

  for (const [offset, row] of rows.slice(start, start + maxRows).entries()) {
    renderStyledLine(doc, x, 3 + offset, width, row.segments, row.bold);
  }

  const scrollX = Math.min(terminalSize().width - 1, x + width);
  if (start > 0) {
    text(doc, scrollX, 3, "^", { color: "gray" }, 1);
  }
  if (start < maxScroll) {
    text(doc, scrollX, terminalSize().height - 4, "v", { color: "gray" }, 1);
  }
}

function renderUnsupportedQuestion(doc: TkDocument, state: AppState, panes: PaneLayout): void {
  if (!state.question) {
    return;
  }

  const { meta, detail } = state.question;
  let y = 3;
  text(doc, panes.leftX, y++, "This question contains a table.", { color: "yellow", bold: true }, panes.leftWidth);
  y++;
  y = printWrappedAt(
    doc,
    "The terminal renderer cannot display this table accurately enough to answer the question here.",
    panes.leftX,
    y,
    panes.leftWidth,
    terminalSize().height - 4,
    false,
    { color: "gray" },
  );
  y++;
  y = printWrappedAt(
    doc,
    "Open it in PracticeSAT, search this question ID, then skip it in this app.",
    panes.leftX,
    y,
    panes.leftWidth,
    terminalSize().height - 4,
    false,
    { color: "gray" },
  );
  y++;
  y = printWrappedAt(doc, `Question ID: ${meta.questionId}`, panes.leftX, y, panes.leftWidth, terminalSize().height - 4, false, {
    color: "yellow",
  });
  y++;
  y = printWrappedAt(doc, practiceQuestionUrl(state.question), panes.leftX, y, panes.leftWidth, terminalSize().height - 4, false, {
    color: "cyan",
  });
  y++;
  printWrappedAt(
    doc,
    `API fallback: ${practiceQuestionApiUrl(state.question)}`,
    panes.leftX,
    y,
    panes.leftWidth,
    terminalSize().height - 4,
    false,
    { color: "cyan" },
  );

  let rightY = 3;
  rightY = renderQuestionMetadata(doc, meta, state.attempts.get(meta.questionId), panes.rightX, rightY, panes.rightWidth);
  rightY++;
  text(doc, panes.rightX, rightY++, "o open externally", { color: "green" }, panes.rightWidth);
  text(doc, panes.rightX, rightY++, "n/x/enter skip", { color: "yellow" }, panes.rightWidth);
  rightY++;
  printWrappedAt(doc, htmlToText(detail.stem), panes.rightX, rightY, panes.rightWidth, terminalSize().height - 4, true);
}

function renderStyledLine(doc: TkDocument, x: number, y: number, width: number, segments: TextSegment[], forceBold = false): void {
  let col = 0;
  for (const segment of segments) {
    if (col >= width) {
      break;
    }

    const output = segment.text.slice(0, width - col);
    if (!output) {
      continue;
    }

    text(doc, x + col, y, output, {
      bold: forceBold || segment.style.bold,
      underline: segment.style.underline,
      italic: segment.style.italic,
    });
    col += output.length;
  }
}

function printWrappedAt(
  doc: TkDocument,
  value: string | undefined,
  x: number,
  y: number,
  width: number,
  maxY: number,
  bold = false,
  attr: TextAttr = {},
): number {
  for (const row of wrapText(value ?? "", width)) {
    if (y > maxY) {
      text(doc, x, y, "...", { color: "gray" }, width);
      return y + 1;
    }
    text(doc, x, y++, row, { ...attr, ...(bold ? { bold: true } : {}) }, width);
  }
  return y;
}

function renderHistoryRow(doc: TkDocument, attempt: Attempt, selected: boolean, y: number, width: number): void {
  const strong = selected ? { bold: true } : {};
  text(doc, 0, y, selected ? ">" : " ", selected ? { color: "yellow", bold: true } : { color: "gray" }, 1);
  text(doc, 2, y, attempt.question_id, { color: selected ? "yellow" : "cyan", ...strong }, 10);
  text(doc, 13, y, attempt.outcome, { ...outcomeAttr(attempt.outcome), ...strong }, 9);
  text(doc, 24, y, attempt.updated_at, { color: selected ? "yellow" : "gray", ...strong }, width - 24);
}

function renderSummaryRow(doc: TkDocument, row: SummaryRow, y: number, width: number): void {
  const value = summaryValue(row);
  const attr = summaryAttr(row);

  text(doc, 0, y, summaryLabel(row.metric), { color: "gray" }, 16);
  text(doc, 17, y, value, attr, 10);

  const barWidth = width - 30;
  if (row.metric === "accuracy" && barWidth >= 10) {
    text(doc, 29, y, accuracyBar(row.value, Math.min(24, barWidth)), attr, barWidth);
  }
}

function renderQuestionMetadata(
  doc: TkDocument,
  meta: QuestionMeta,
  attempt: Attempt | undefined,
  x: number,
  y: number,
  width: number,
): number {
  if (attempt) {
    text(doc, x, y++, attempt.outcome.toUpperCase(), { ...outcomeAttr(attempt.outcome), bold: true }, width);
  }

  text(doc, x, y++, formatDomain(meta), { color: "cyan" }, width);
  text(doc, x, y++, formatSkill(meta), { color: "cyan" }, width);
  text(doc, x, y++, `difficulty ${meta.difficulty} | ${meta.questionId}`, difficultyAttr(meta.difficulty), width);

  return y;
}

function formatDomain(meta: QuestionMeta): string {
  return meta.primary_class_cd_desc ? `${meta.primary_class_cd}  ${meta.primary_class_cd_desc}` : meta.primary_class_cd;
}

function formatSkill(meta: QuestionMeta): string {
  return meta.skill_desc ? `${meta.skill_cd}  ${meta.skill_desc}` : meta.skill_cd;
}

function outcomeAttr(outcome: Outcome): TextAttr {
  if (outcome === "correct") {
    return { color: "green" };
  }
  if (outcome === "incorrect") {
    return { color: "red" };
  }
  return { color: "yellow" };
}

function difficultyAttr(difficulty: string): TextAttr {
  if (difficulty === "E") {
    return { color: "green" };
  }
  if (difficulty === "H") {
    return { color: "red" };
  }
  return { color: "yellow" };
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
  const ratio = readRatio(value);
  const filled = Math.round(ratio * barWidth);
  return `[${"#".repeat(filled)}${"-".repeat(barWidth - filled)}]`;
}

function readRatio(value: string): number {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.min(1, Math.max(0, ratio));
}

function paneLayout(): PaneLayout {
  const { width } = terminalSize();
  const gutter = 2;
  const usable = Math.max(40, width - gutter);
  const leftWidth = Math.max(20, Math.floor(usable / 2));
  const rightX = leftWidth + gutter;
  const rightWidth = Math.max(20, width - rightX);

  return {
    leftX: 0,
    leftWidth,
    rightX,
    rightWidth,
  };
}

function text(doc: TkDocument, x: number, y: number, value: string, attr: TextAttr = {}, width = terminalSize().width - x): void {
  if (y < 0 || y >= terminalSize().height || width <= 0) {
    return;
  }

  const content = truncate(value, width);
  if (!content) {
    return;
  }

  new tk.Text({
    parent: doc,
    x,
    y,
    content,
    attr,
    noDraw: true,
  });
}

function truncate(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }
  if (width <= 1) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 1)}…`;
}

function practiceControls(state: AppState): string {
  if (state.question && questionNeedsExternalDisplay(state.question.detail)) {
    return "space pause/resume | t timer | o open externally | n/x/enter skip | f focus | h history | s summary | q quit";
  }

  return "space pause/resume | t timer | up/down or j/k move | pgup/pgdn or [/] scroll question | enter submit | f focus | h history | s summary | q quit";
}
