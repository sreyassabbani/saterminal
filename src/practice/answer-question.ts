import { recordAnswer } from "@/database/progress-repository.ts";
import type { Question } from "@/questions/question.ts";
import type { Attempt, AnswerRecord } from "@/progress/attempt.ts";
import { createAnswerRecord } from "@/progress/attempt.ts";

export type AnswerQuestionInput = {
  attempts: ReadonlyMap<string, Attempt>;
  question: Question;
  answer: string;
  durationSeconds?: number;
  answeredAt?: Date;
  databasePath?: string;
};

export async function answerQuestion(input: AnswerQuestionInput): Promise<AnswerRecord> {
  const record = createAnswerRecord(
    input.attempts.get(input.question.id),
    input.question,
    input.answer,
    input.durationSeconds,
    input.answeredAt,
  );
  await recordAnswer(record, input.databasePath);
  return record;
}
