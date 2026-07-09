import { htmlToText, wrapText } from "../text.ts";
import type { TextSegment } from "../text.ts";
import { Frame, FrameRenderer, TerminalFrameOutput, type TextAttr } from "./frame.ts";
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
import { footer as footerView, header as headerView, renderPaused as renderPausedView } from "./render/chrome.ts";
import { renderFocus as renderFocusView } from "./render/focus.ts";
import { renderHistory as renderHistoryView } from "./render/history.ts";
import { renderSummary as renderSummaryView } from "./render/summary.ts";
import { renderError as renderErrorView, renderLoading as renderLoadingView, renderSetup as renderSetupView } from "./render/setup.ts";

export function createFrameRenderer(): FrameRenderer {
  return new FrameRenderer(new TerminalFrameOutput(term));
}

export function render(renderer: FrameRenderer, state: AppState): void {
  const { width, height } = terminalSize();
  const frame = new Frame(width, height);

  if (state.view === "practice" && state.timerPaused) {
    renderPausedView(frame);
    footerView(frame, state);
    renderer.draw(frame);
    return;
  }

  headerView(frame, state);

  if (state.view === "loading") {
    renderLoadingView(frame);
  } else if (state.view === "setup") {
    renderSetupView(frame);
  } else if (state.view === "focus") {
    renderFocusView(frame, state);
  } else if (state.view === "practice") {
    renderPractice(frame, state);
  } else if (state.view === "review") {
    renderReview(frame, state);
  } else if (state.view === "history") {
    renderHistoryView(frame, state);
  } else if (state.view === "summary") {
    renderSummaryView(frame, state);
  } else if (state.view === "detail") {
    renderDetail(frame, state);
  } else if (state.view === "error") {
    renderErrorView(frame, state);
  }

  footerView(frame, state);
  renderer.draw(frame);
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

function text(doc: Frame, x: number, y: number, value: string, attr: TextAttr = {}, width = doc.width - x): void {
  if (y < 0 || y >= doc.height || width <= 0) {
    return;
  }

  doc.writeText(x, y, value, attr, width);
}
