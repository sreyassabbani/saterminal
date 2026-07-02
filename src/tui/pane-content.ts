import { htmlToText, wrapText } from "../text.ts";
import type { Attempt, Outcome, PracticeQuestion, QuestionMeta } from "../types.ts";
import { answerKeys } from "./question.ts";

export type PaneRowKind = "normal" | "muted" | "heading" | "info" | "success" | "danger" | "warning" | "selected";

export type PaneTextRow = {
  text: string;
  kind?: PaneRowKind;
  bold?: boolean;
};

export type ChoiceRange = {
  key: string;
  start: number;
  end: number;
};

export type PracticeAnswerPane = {
  rows: PaneTextRow[];
  choices: ChoiceRange[];
};

export type ReviewPaneOptions = {
  lastAnswer?: string;
  lastCorrect?: boolean;
  elapsed: string;
};

export function practiceAnswerPaneRows(question: PracticeQuestion, selected: number, width: number): PracticeAnswerPane {
  const rows: PaneTextRow[] = [];
  const choices: ChoiceRange[] = [];
  const keys = answerKeys(question);

  for (const [index, key] of keys.entries()) {
    const selectedChoice = index === selected;
    const marker = selectedChoice ? ">" : " ";
    const start = rows.length;
    appendWrapped(rows, `${marker} ${key}. ${htmlToText(question.detail.answerOptions[key])}`, width, {
      kind: selectedChoice ? "selected" : "normal",
      bold: selectedChoice,
    });
    choices.push({ key, start, end: rows.length - 1 });

    if (index < keys.length - 1) {
      rows.push({ text: "" });
    }
  }

  return { rows, choices };
}

export function reviewPaneRows(question: PracticeQuestion, options: ReviewPaneOptions, width: number): PaneTextRow[] {
  const rows: PaneTextRow[] = [];
  const correct = options.lastCorrect ? "correct" : "incorrect";
  const resultKind = options.lastCorrect ? "success" : "danger";

  rows.push({ text: correct.toUpperCase(), kind: resultKind, bold: true });
  rows.push({ text: `your answer: ${options.lastAnswer ?? "-"}`, kind: resultKind });
  rows.push({ text: `correct: ${question.detail.correct_answer.join(", ")}`, kind: "success" });
  rows.push({ text: `time: ${options.elapsed}`, kind: "info" });
  appendGap(rows);
  appendMetadataRows(rows, question.meta);
  appendGap(rows);
  rows.push({ text: "rationale", kind: "heading", bold: true });
  appendWrapped(rows, htmlToText(question.detail.rationale), width);

  return rows;
}

export function detailPaneRows(question: PracticeQuestion, attempt: Attempt | undefined, width: number): PaneTextRow[] {
  const rows: PaneTextRow[] = [];
  appendMetadataRows(rows, question.meta, attempt);
  appendGap(rows);
  rows.push({ text: `correct: ${question.detail.correct_answer.join(", ")}`, kind: "success", bold: true });
  rows.push({ text: "answer key", kind: "heading", bold: true });

  for (const key of answerKeys(question)) {
    const correct = question.detail.correct_answer.includes(key);
    const label = correct ? "*" : " ";
    appendWrapped(rows, `${label} ${key}. ${htmlToText(question.detail.answerOptions[key])}`, width, {
      kind: correct ? "success" : "muted",
      bold: correct,
    });
    rows.push({ text: "" });
  }

  if (question.detail.rationale) {
    appendGap(rows);
    rows.push({ text: "rationale", kind: "heading", bold: true });
    appendWrapped(rows, htmlToText(question.detail.rationale), width);
  }

  return trimTrailingBlankRows(rows);
}

export function formatDomain(meta: QuestionMeta): string {
  return meta.primary_class_cd_desc ? `${meta.primary_class_cd}  ${meta.primary_class_cd_desc}` : meta.primary_class_cd;
}

export function formatSkill(meta: QuestionMeta): string {
  return meta.skill_desc ? `${meta.skill_cd}  ${meta.skill_desc}` : meta.skill_cd;
}

export function outcomeKind(outcome: Outcome): PaneRowKind {
  if (outcome === "correct") {
    return "success";
  }
  if (outcome === "incorrect") {
    return "danger";
  }
  return "warning";
}

export function difficultyKind(difficulty: string): PaneRowKind {
  if (difficulty === "E") {
    return "success";
  }
  if (difficulty === "H") {
    return "danger";
  }
  return "warning";
}

function appendMetadataRows(rows: PaneTextRow[], meta: QuestionMeta, attempt?: Attempt): void {
  if (attempt) {
    rows.push({ text: attempt.outcome.toUpperCase(), kind: outcomeKind(attempt.outcome), bold: true });
  }

  rows.push({ text: formatDomain(meta), kind: "info" });
  rows.push({ text: formatSkill(meta), kind: "info" });
  rows.push({ text: `difficulty ${meta.difficulty} | ${meta.questionId}`, kind: difficultyKind(meta.difficulty) });
}

function appendWrapped(rows: PaneTextRow[], value: string | undefined, width: number, row: Omit<PaneTextRow, "text"> = {}): void {
  for (const text of wrapText(value ?? "", width)) {
    rows.push({ ...row, text });
  }
}

function appendGap(rows: PaneTextRow[]): void {
  rows.push({ text: "" });
}

function trimTrailingBlankRows(rows: PaneTextRow[]): PaneTextRow[] {
  while (rows.at(-1)?.text === "") {
    rows.pop();
  }
  return rows;
}
