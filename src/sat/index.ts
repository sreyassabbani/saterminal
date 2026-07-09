import { checkAnswer, recordAttempt } from "../core/answer.ts";
import { getPracticeQuestion, getQuestionByShortId } from "../question-bank.ts";
import { appendAttemptEvent, saveAttempts, saveFocus as savePersistedFocus } from "../state/store.ts";
import type { Attempt, AttemptEvent, Focus, PracticeQuestion } from "../types.ts";

export type AnswerQuestionInput = {
  attempts: Map<string, Attempt>;
  question: PracticeQuestion;
  answer: string;
  elapsedSeconds?: number;
  answeredAt?: Date;
  path?: string;
};

export type AnswerQuestionResult = {
  answer: string;
  correct: boolean;
  attempt: Attempt;
  event: AttemptEvent;
  attempts: Map<string, Attempt>;
  answeredAt: Date;
};

export type NextQuestionInput = {
  attemptedIds: Iterable<string>;
  focus: Focus;
};

export async function answerQuestion(input: AnswerQuestionInput): Promise<AnswerQuestionResult> {
  const answeredAt = input.answeredAt ?? new Date();
  const elapsedSeconds = input.elapsedSeconds ?? 0;
  const check = checkAnswer(input.question, input.answer);
  const attempt = recordAttempt(input.attempts, input.question.meta.questionId, check.correct, elapsedSeconds, answeredAt, input.question.meta);
  const event = await appendAttemptEvent(input.question.meta, check.correct, elapsedSeconds, answeredAt, input.path);
  await saveAttempts(input.attempts, input.path);

  return {
    answer: check.answer,
    correct: check.correct,
    attempt,
    event,
    attempts: input.attempts,
    answeredAt,
  };
}

export async function nextQuestion(input: NextQuestionInput): Promise<PracticeQuestion | undefined> {
  try {
    return await getPracticeQuestion(input.attemptedIds, input.focus);
  } catch (error) {
    if (error instanceof Error && error.message === "No unanswered questions matched the current filters.") {
      return undefined;
    }
    throw error;
  }
}

export async function findQuestion(id: string): Promise<PracticeQuestion | undefined> {
  return getQuestionByShortId(id);
}

export async function saveFocus(focus: Focus, path?: string): Promise<void> {
  await savePersistedFocus(focus, path);
}
