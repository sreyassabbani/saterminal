import { buildSummaryRows, displayStateDir, stateDir } from "../state.ts";
import { focusSummary } from "../focus.ts";
import { htmlToText, wrapText } from "../text.ts";
import type { TextSegment } from "../text.ts";
import { progressBarText } from "../progress.ts";
import { Frame, FrameRenderer, TerminalFrameOutput, truncate, type TextAttr } from "./frame.ts";
import { focusGrid, normalizeFocusGridPosition, type FocusGridColumn, type FocusGridRow } from "./focus-grid.ts";
import { historyRows } from "./history.ts";
import {
  practiceQuestionApiUrl,
  practiceQuestionUrl,
  questionNeedsExternalDisplay,
  questionRows,
} from "./question.ts";
import { elapsedQuestionSeconds, formatElapsed, timerStatus } from "./timer.ts";
import { term, terminalSize } from "./kit.ts";
import { PANE_BODY_Y, PANE_HEADER_Y, paneLayout, paneViewportHeight } from "./layout.ts";
import { detailPaneRows, practiceAnswerPaneRows, reviewPaneRows, type PaneTextRow } from "./pane-content.ts";
import type { AppState, PaneLayout } from "./types.ts";
import type { Attempt, Outcome, QuestionMeta, SummaryRow } from "../types.ts";
import { clampScroll, maxScroll, type PaneViewport } from "./viewport.ts";

export function createFrameRenderer(): FrameRenderer {
  return new FrameRenderer(new TerminalFrameOutput(term));
}

export function render(renderer: FrameRenderer, state: AppState): void {
  const { width, height } = terminalSize();
  const frame = new Frame(width, height);

  if (state.view === "practice" && state.timerPaused) {
    renderPaused(frame);
    footer(frame, state);
    renderer.draw(frame);
    return;
  }

  header(frame, state);

  if (state.view === "loading") {
    renderLoading(frame);
  } else if (state.view === "setup") {
    renderSetup(frame);
  } else if (state.view === "focus") {
    renderFocus(frame, state);
  } else if (state.view === "practice") {
    renderPractice(frame, state);
  } else if (state.view === "review") {
    renderReview(frame, state);
  } else if (state.view === "history") {
    renderHistory(frame, state);
  } else if (state.view === "summary") {
    renderSummary(frame, state);
  } else if (state.view === "detail") {
    renderDetail(frame, state);
  } else if (state.view === "error") {
    renderError(frame, state);
  }

  footer(frame, state);
  renderer.draw(frame);
}

function renderLoading(doc: Frame): void {
  text(doc, 0, 3, "Loading...");
}

function renderSetup(doc: Frame): void {
  const { width } = terminalSize();
  const location = displayStateDir(stateDir);

  text(doc, 0, 3, "storage location", { bold: true });
  text(doc, 0, 5, "Sat saves progress, focus settings, summary stats, and the local question cache.", { color: "gray" }, width);
  text(doc, 0, 7, "Allow creating this directory?", { bold: true }, width);
  text(doc, 0, 9, location, { color: "cyan" }, width);
}

function renderPaused(doc: Frame): void {
  const { width, height } = terminalSize();
  const label = "PAUSED";
  text(doc, Math.max(0, Math.floor((width - label.length) / 2)), Math.max(0, Math.floor(height / 2)), label, { bold: true });
}

function header(doc: Frame, state: AppState): void {
  const { width } = terminalSize();
  const answered = state.attempts.size;
  const mode = state.reviewMode ? "review queue" : "reading/writing";
  const timer = state.timerHidden ? "" : `  time ${formatElapsed(elapsedQuestionSeconds(state))}${timerStatus(state)}`;
  text(doc, 0, 0, "sat", { bold: true });
  text(doc, 7, 0, `${mode}  answered ${answered}${timer}`, { color: "gray" }, width - 7);
  text(doc, 0, 1, "-".repeat(width), { color: "gray" }, width);
}

function footer(doc: Frame, state: AppState): void {
  const { width, height } = terminalSize();
  const controls = state.view === "setup"
    ? "y allow | n decline | q quit"
    : state.view === "practice"
    ? practiceControls(state)
    : state.view === "focus"
      ? "up/down or j/k row | tab/shift-tab group | space toggle | enter start | q quit"
    : state.view === "review"
      ? "tab pane | up/down/j/k scroll | pg/[ ] page | g/G edge | enter next | f focus | h history | q quit"
      : state.view === "history"
        ? "up/down or j/k move | enter open | f focus | p practice | s summary | q quit"
        : state.view === "detail"
          ? "tab pane | up/down/j/k scroll | pg/[ ] page | g/G edge | esc history | p practice | q quit"
          : state.view === "error"
            ? "r retry | q quit"
            : "p practice | h history | q quit";

  text(doc, 0, Math.max(0, height - 2), "-".repeat(width), { color: "gray" }, width);
  text(doc, 0, Math.max(0, height - 1), controls, { color: "gray" }, width);
}

function renderFocus(doc: Frame, state: AppState): void {
  const { width } = terminalSize();
  const columns = focusGrid(state.focus);
  const position = normalizeFocusGridPosition(columns, { column: state.focusColumn, row: state.focusRow });
  state.focusColumn = position.column;
  state.focusRow = position.row;

  const summary = focusSummary(state.focus);
  text(doc, 0, 3, "study focus", { bold: true });
  text(doc, Math.max(0, width - summary.length - 1), 3, summary, { color: "cyan" });
  text(doc, 0, 4, "Space toggles the selected row. Enter starts practice.", { color: "gray" }, width);
  if (state.notice) {
    text(doc, 0, 5, state.notice, { color: "yellow" }, width);
  }

  renderDifficultyColumn(doc, columns[0], position.column === 0 ? position.row : -1);
  renderDomainColumns(doc, columns.slice(1), position.column - 1, position.row);
}

function renderDifficultyColumn(doc: Frame, column: FocusGridColumn, selectedRow: number): void {
  text(doc, 0, 6, column.title, { color: "cyan", bold: true });

  for (const [index, row] of column.rows.entries()) {
    const output = focusOptionText(row, index === selectedRow);
    writeFocusOption(doc, 0, 7 + index, output, row, index === selectedRow, 32);
  }
}

function renderDomainColumns(doc: Frame, columns: FocusGridColumn[], selectedColumn: number, selectedRow: number): void {
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
  doc: Frame,
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

function renderPractice(doc: Frame, state: AppState): void {
  if (!state.question) {
    return;
  }

  const panes = paneLayout();
  if (questionNeedsExternalDisplay(state.question.detail)) {
    renderUnsupportedQuestion(doc, state, panes);
    return;
  }

  const questionContent = questionRows(state.question.detail, panes.leftWidth);
  const answerContent = practiceAnswerPaneRows(state.question, state.selected, panes.rightWidth).rows;
  const questionViewport = clampedViewport(state.questionScroll, questionContent.length);
  const answerViewport = clampedViewport(state.answerScroll, answerContent.length);
  state.questionScroll = questionViewport.scroll;
  state.answerScroll = answerViewport.scroll;

  renderPaneHeaders(doc, panes, state, questionViewport, answerViewport, "answers");
  renderQuestionRows(doc, questionContent, panes.leftX, panes.leftWidth, questionViewport, state.activePane === "question");
  renderPaneRows(doc, answerContent, panes.rightX, panes.rightWidth, answerViewport, state.activePane === "answers");
}

function renderReview(doc: Frame, state: AppState): void {
  if (!state.question) {
    return;
  }

  const panes = paneLayout();
  const questionContent = questionRows(state.question.detail, panes.leftWidth);
  const reviewContent = reviewPaneRows(state.question, {
    lastAnswer: state.lastAnswer,
    lastCorrect: state.lastCorrect,
    elapsed: formatElapsed(elapsedQuestionSeconds(state)),
  }, panes.rightWidth);
  const questionViewport = clampedViewport(state.questionScroll, questionContent.length);
  const answerViewport = clampedViewport(state.answerScroll, reviewContent.length);
  state.questionScroll = questionViewport.scroll;
  state.answerScroll = answerViewport.scroll;

  renderPaneHeaders(doc, panes, state, questionViewport, answerViewport, "review");
  renderQuestionRows(doc, questionContent, panes.leftX, panes.leftWidth, questionViewport, state.activePane === "question");
  renderPaneRows(doc, reviewContent, panes.rightX, panes.rightWidth, answerViewport, state.activePane === "answers");
}

function renderHistory(doc: Frame, state: AppState): void {
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

function renderSummary(doc: Frame, state: AppState): void {
  const { width } = terminalSize();
  let y = 3;
  text(doc, 0, y++, "stats summary", { color: "cyan", bold: true });
  text(doc, 0, y++, "practice progress from recorded attempts", { color: "gray" }, width);
  y++;
  for (const row of buildSummaryRows(state.attempts)) {
    renderSummaryRow(doc, row, y++, width);
  }
}

function renderDetail(doc: Frame, state: AppState): void {
  const panes = paneLayout();
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

  const questionContent = questionRows(detail, panes.leftWidth);
  const detailContent = detailPaneRows(state.detailQuestion, attempt, panes.rightWidth);
  const questionViewport = clampedViewport(state.questionScroll, questionContent.length);
  const answerViewport = clampedViewport(state.answerScroll, detailContent.length);
  state.questionScroll = questionViewport.scroll;
  state.answerScroll = answerViewport.scroll;

  renderPaneHeaders(doc, panes, state, questionViewport, answerViewport, "answers");
  renderQuestionRows(doc, questionContent, panes.leftX, panes.leftWidth, questionViewport, state.activePane === "question");
  renderPaneRows(doc, detailContent, panes.rightX, panes.rightWidth, answerViewport, state.activePane === "answers");
}

function renderError(doc: Frame, state: AppState): void {
  text(doc, 0, 3, "Something went wrong.", { bold: true, color: "red" });
  printWrappedAt(doc, state.error ?? "Unknown error.", 0, 5, terminalSize().width - 1, terminalSize().height - 4);
}

function renderUnsupportedQuestion(doc: Frame, state: AppState, panes: PaneLayout): void {
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

function renderPaneHeaders(
  doc: Frame,
  panes: PaneLayout,
  state: AppState,
  questionViewport: PaneViewport,
  answerViewport: PaneViewport,
  rightLabel: string,
): void {
  renderPaneHeader(doc, panes.leftX, panes.leftWidth, "question", state.activePane === "question", questionViewport);
  renderPaneHeader(doc, panes.rightX, panes.rightWidth, rightLabel, state.activePane === "answers", answerViewport);
}

function renderPaneHeader(doc: Frame, x: number, width: number, label: string, active: boolean, viewport: PaneViewport): void {
  const attr = active ? { color: "cyan", underline: true } : { color: "gray" };
  text(doc, x, PANE_HEADER_Y, label, attr, width);

  if (maxScroll(viewport) === 0) {
    return;
  }

  const end = Math.min(viewport.contentRows, viewport.scroll + viewport.height);
  const position = `${viewport.scroll + 1}-${end}/${viewport.contentRows}`;
  text(doc, Math.max(x, x + width - position.length), PANE_HEADER_Y, position, active ? { color: "cyan" } : { color: "gray" }, width);
}

function renderQuestionRows(
  doc: Frame,
  rows: ReturnType<typeof questionRows>,
  x: number,
  width: number,
  viewport: PaneViewport,
  active: boolean,
): void {
  for (const [offset, row] of rows.slice(viewport.scroll, viewport.scroll + viewport.height).entries()) {
    renderStyledLine(doc, x, PANE_BODY_Y + offset, width, row.segments, row.bold);
  }

  renderScrollGutter(doc, x, width, viewport, active);
}

function renderPaneRows(doc: Frame, rows: PaneTextRow[], x: number, width: number, viewport: PaneViewport, active: boolean): void {
  for (const [offset, row] of rows.slice(viewport.scroll, viewport.scroll + viewport.height).entries()) {
    text(doc, x, PANE_BODY_Y + offset, row.text, paneRowAttr(row), width);
  }

  renderScrollGutter(doc, x, width, viewport, active);
}

function renderScrollGutter(doc: Frame, x: number, width: number, viewport: PaneViewport, active: boolean): void {
  const scrollX = Math.min(terminalSize().width - 1, x + width);
  const attr = active ? { color: "cyan" } : { color: "gray" };
  if (viewport.scroll > 0) {
    text(doc, scrollX, PANE_BODY_Y, "^", attr, 1);
  }
  if (viewport.scroll < maxScroll(viewport)) {
    text(doc, scrollX, PANE_BODY_Y + viewport.height - 1, "v", attr, 1);
  }
}

function clampedViewport(scroll: number, contentRows: number): PaneViewport {
  const viewport = { scroll, height: paneViewportHeight(), contentRows };
  return { ...viewport, scroll: clampScroll(viewport) };
}

function paneRowAttr(row: PaneTextRow): TextAttr {
  const attr: TextAttr = row.bold ? { bold: true } : {};

  if (row.kind === "muted") {
    return { ...attr, color: "gray" };
  }
  if (row.kind === "heading" || row.kind === "info") {
    return { ...attr, color: "cyan", ...(row.kind === "heading" ? { bold: true } : {}) };
  }
  if (row.kind === "success") {
    return { ...attr, color: "green" };
  }
  if (row.kind === "danger") {
    return { ...attr, color: "red" };
  }
  if (row.kind === "warning" || row.kind === "selected") {
    return { ...attr, color: "yellow", ...(row.kind === "selected" ? { bold: true } : {}) };
  }

  return attr;
}

function renderStyledLine(doc: Frame, x: number, y: number, width: number, segments: TextSegment[], forceBold = false): void {
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
  doc: Frame,
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

function renderHistoryRow(doc: Frame, attempt: Attempt, selected: boolean, y: number, width: number): void {
  const strong = selected ? { bold: true } : {};
  text(doc, 0, y, selected ? ">" : " ", selected ? { color: "yellow", bold: true } : { color: "gray" }, 1);
  text(doc, 2, y, attempt.question_id, { color: selected ? "yellow" : "cyan", ...strong }, 10);
  text(doc, 13, y, attempt.outcome, { ...outcomeAttr(attempt.outcome), ...strong }, 9);
  text(doc, 24, y, attempt.skill ?? "-", { color: selected ? "yellow" : "green", ...strong }, 5);
  text(doc, 31, y, shortTimestamp(attempt.updated_at), { color: selected ? "yellow" : "gray", ...strong }, width - 31);
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

function renderQuestionMetadata(
  doc: Frame,
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

function shortTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
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
  return `[${progressBarText(readRatio(value), barWidth)}]`;
}

function readRatio(value: string): number {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.min(1, Math.max(0, ratio));
}

function text(doc: Frame, x: number, y: number, value: string, attr: TextAttr = {}, width = doc.width - x): void {
  if (y < 0 || y >= doc.height || width <= 0) {
    return;
  }

  doc.writeText(x, y, value, attr, width);
}

function practiceControls(state: AppState): string {
  if (state.question && questionNeedsExternalDisplay(state.question.detail)) {
    return "space pause/resume | t timer | o open externally | n/x/enter skip | f focus | h history | s summary | q quit";
  }

  return "space pause/resume | t timer | tab pane | up/down/j/k move/scroll | pg/[ ] page | g/G edge | enter submit | q quit";
}
