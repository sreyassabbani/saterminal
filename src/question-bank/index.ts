import { loadQuestionBank } from "./cache.ts";
import { questionBankPath } from "./constants.ts";
import { findQuestionInBank, selectPracticeQuestion } from "./selection.ts";
import type { Focus, PracticeQuestion } from "../types.ts";
import type { QuestionBank } from "./types.ts";

export * from "./cache.ts";
export * from "./constants.ts";
export * from "./selection.ts";
export * from "./status.ts";
export type * from "./types.ts";

export async function getPracticeQuestion(attemptedIds: Iterable<string>, focus: Focus): Promise<PracticeQuestion> {
  const question = selectPracticeQuestion(await requireQuestionBank(), attemptedIds, focus);
  if (!question) {
    throw new Error("No unanswered questions matched the current filters.");
  }

  return question;
}

export async function getQuestionByShortId(questionId: string): Promise<PracticeQuestion | undefined> {
  return findQuestionInBank(await requireQuestionBank(), questionId);
}

async function requireQuestionBank(path = questionBankPath): Promise<QuestionBank> {
  const bank = await loadQuestionBank(path);
  if (!bank) {
    throw new Error("Question bank is missing from the package.");
  }

  return bank;
}
