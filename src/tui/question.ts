import { spawn } from "node:child_process";
import { hasHtmlTable, parseHtmlSegments, wrapSegments } from "../text.ts";
import type { PracticeQuestion, QuestionDetail } from "../types.ts";
import { apiBaseUrl, siteUrl } from "../urls.ts";
import type { DisplayRow } from "./types.ts";

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

export function practiceQuestionUrl(question: PracticeQuestion): string {
  return `${siteUrl}/question/${encodeURIComponent(question.meta.questionId)}`;
}

export function practiceQuestionApiUrl(question: PracticeQuestion): string {
  return `${apiBaseUrl}/question/${encodeURIComponent(question.meta.external_id)}`;
}

export function openExternalQuestion(question: PracticeQuestion): void {
  const child = spawn("open", [practiceQuestionUrl(question)], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
