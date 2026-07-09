import { wrapText } from "../../text.ts";
import type { Attempt, Outcome, QuestionMeta } from "../../types.ts";
import { Frame, type TextAttr } from "../frame.ts";

export function text(doc: Frame, x: number, y: number, value: string, attr: TextAttr = {}, width = doc.width - x): void {
  if (y < 0 || y >= doc.height || width <= 0) {
    return;
  }

  doc.writeText(x, y, value, attr, width);
}

export function printWrappedAt(
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

export function renderQuestionMetadata(
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

export function shortTimestamp(value: string): string {
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

export function outcomeAttr(outcome: Outcome): TextAttr {
  if (outcome === "correct") {
    return { color: "green" };
  }
  if (outcome === "incorrect") {
    return { color: "red" };
  }
  return { color: "yellow" };
}

export function difficultyAttr(difficulty: string): TextAttr {
  if (difficulty === "E") {
    return { color: "green" };
  }
  if (difficulty === "H") {
    return { color: "red" };
  }
  return { color: "yellow" };
}

function formatDomain(meta: QuestionMeta): string {
  return meta.primary_class_cd_desc ? `${meta.primary_class_cd}  ${meta.primary_class_cd_desc}` : meta.primary_class_cd;
}

function formatSkill(meta: QuestionMeta): string {
  return meta.skill_desc ? `${meta.skill_cd}  ${meta.skill_desc}` : meta.skill_cd;
}
