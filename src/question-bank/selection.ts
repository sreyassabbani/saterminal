import type { Difficulty, Focus, PracticeQuestion, QuestionMeta, Skill } from "../types.ts";
import type { QuestionBank, QuestionBankIndex } from "./types.ts";

const indexes = new WeakMap<QuestionBank, QuestionBankIndex>();

export function selectPracticeQuestion(
  bank: QuestionBank,
  attemptedIds: Iterable<string>,
  focus: Focus,
  random = Math.random,
): PracticeQuestion | undefined {
  const attempted = new Set(attemptedIds);
  const candidates = bank.questions.filter((question) =>
    !attempted.has(question.meta.questionId) && questionMatchesFocus(question.meta, focus)
  );

  if (candidates.length === 0) {
    return undefined;
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}

export function findQuestionInBank(bank: QuestionBank, questionId: string): PracticeQuestion | undefined {
  return questionBankIndex(bank).byId.get(questionId);
}

export function questionBankIndex(bank: QuestionBank): QuestionBankIndex {
  const existing = indexes.get(bank);
  if (existing) {
    return existing;
  }

  const index: QuestionBankIndex = {
    byId: new Map(),
    bySkill: new Map(),
    byDifficulty: new Map(),
  };

  for (const question of bank.questions) {
    index.byId.set(question.meta.questionId, question);
    appendIndex(index.bySkill, question.meta.skill_cd, question);
    appendIndex(index.byDifficulty, question.meta.difficulty, question);
  }

  indexes.set(bank, index);
  return index;
}

function appendIndex(index: Map<string, PracticeQuestion[]>, key: string, question: PracticeQuestion): void {
  const values = index.get(key) ?? [];
  values.push(question);
  index.set(key, values);
}

function questionMatchesFocus(meta: QuestionMeta, focus: Focus): boolean {
  return focus.difficulties.includes(meta.difficulty as Difficulty) && focus.skills.includes(meta.skill_cd as Skill);
}
