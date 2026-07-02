import { spawn } from "node:child_process";
import { hasHtmlTable, htmlToText, parseHtmlSegments, wrapSegments } from "../text.ts";
import type { PracticeQuestion, QuestionDetail } from "../types.ts";
import { lineAt, printWrappedAt, renderStyledLine, term } from "./terminal.ts";
import type { DisplayRow, PaneLayout } from "./types.ts";

export function answerKeys(question?: PracticeQuestion): string[] {
  return Object.keys(question?.detail.answerOptions ?? {}).sort();
}

export function questionNeedsExternalDisplay(detail: QuestionDetail): boolean {
  return hasHtmlTable(
    detail.stimulus,
    detail.stem,
    detail.rationale,
    ...Object.values(detail.answerOptions),
  );
}

export function questionPageSize(): number {
  return Math.max(1, term.height - 6);
}

export function questionRows(detail: QuestionDetail, width: number): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const stimulus = wrapSegments(parseHtmlSegments(detail.stimulus), width).map((segments) => ({ segments }));
  const stem = wrapSegments(parseHtmlSegments(detail.stem), width).map((segments) => ({ segments, bold: true }));

  rows.push(...stimulus);
  if (stimulus.length > 0 && stem.length > 0) {
    rows.push({ segments: [{ text: "", style: {} }] });
  }
  rows.push(...stem);
  return rows;
}

export function renderQuestionPane(detail: QuestionDetail, x: number, width: number, scroll: number): void {
  const rows = questionRows(detail, width);
  const maxRows = questionPageSize();
  const maxScroll = Math.max(0, rows.length - maxRows);
  const start = Math.min(scroll, maxScroll);

  for (const [offset, row] of rows.slice(start, start + maxRows).entries()) {
    const y = 4 + offset;
    renderStyledLine(x, y, width, row.segments, row.bold);
  }

  if (start > 0) {
    lineAt(x + width - 4, 4, 4, "^");
  }
  if (start < maxScroll) {
    lineAt(x + width - 4, term.height - 3, 4, "v");
  }
}

export function renderUnsupportedQuestion(question: PracticeQuestion, panes: PaneLayout): void {
  const { meta, detail } = question;
  const appUrl = practiceQuestionUrl(question);
  const apiUrl = practiceQuestionApiUrl(question);
  let y = 4;

  lineAt(panes.leftX, y++, panes.leftWidth, "This question contains a table.");
  y++;
  y = printWrappedAt(
    "The terminal renderer cannot display this table accurately enough to answer the question here.",
    panes.leftX,
    y,
    panes.leftWidth,
    term.height - 3,
  );
  y++;
  y = printWrappedAt("Open it in PracticeSAT, search this question ID, then skip it in this app.", panes.leftX, y, panes.leftWidth, term.height - 3);
  y++;
  y = printWrappedAt(`Question ID: ${meta.questionId}`, panes.leftX, y, panes.leftWidth, term.height - 3);
  y++;
  y = printWrappedAt(appUrl, panes.leftX, y, panes.leftWidth, term.height - 3);
  y++;
  y = printWrappedAt(`API fallback: ${apiUrl}`, panes.leftX, y, panes.leftWidth, term.height - 3);

  let rightY = 4;
  lineAt(panes.rightX, rightY++, panes.rightWidth, `${meta.primary_class_cd} | ${meta.skill_cd}`);
  lineAt(panes.rightX, rightY++, panes.rightWidth, `difficulty ${meta.difficulty} | ${meta.questionId}`);
  rightY++;
  lineAt(panes.rightX, rightY++, panes.rightWidth, "o open externally");
  lineAt(panes.rightX, rightY++, panes.rightWidth, "n/x/enter skip");
  rightY++;
  printWrappedAt(htmlToText(detail.stem), panes.rightX, rightY, panes.rightWidth, term.height - 3, true);
}

export function practiceQuestionUrl(question: PracticeQuestion): string {
  return `https://practicesat.vercel.app/question?questionId=${encodeURIComponent(question.meta.questionId)}`;
}

export function practiceQuestionApiUrl(question: PracticeQuestion): string {
  return `https://practicesat.vercel.app/api/question/${encodeURIComponent(question.meta.external_id)}`;
}

export function openExternalQuestion(question: PracticeQuestion): void {
  const child = spawn("open", [practiceQuestionUrl(question)], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
