import type { Difficulty, DomainCode, Question, SkillCode } from "../questions/question.ts";
import { checkAnswer } from "../questions/question.ts";

export type Outcome = "correct" | "incorrect" | "corrected";

export type Attempt = {
  questionId: string;
  outcome: Outcome;
  answeredAt: string;
  durationSeconds: number;
  difficulty?: Difficulty;
  domain?: DomainCode;
  skill?: SkillCode;
};

export type AttemptEvent = {
  questionId: string;
  correct: boolean;
  answeredAt: string;
  durationSeconds: number;
  difficulty: Difficulty;
  domain: DomainCode;
  skill: SkillCode;
};

export type AnswerRecord = {
  answer: string;
  correct: boolean;
  attempt: Attempt;
  event: AttemptEvent;
};

export function createAnswerRecord(
  previous: Attempt | undefined,
  question: Question,
  answer: string,
  durationSeconds = 0,
  answeredAt = new Date(),
): AnswerRecord {
  const correct = checkAnswer(question, answer);
  const timestamp = answeredAt.toISOString();
  return {
    answer,
    correct,
    attempt: {
      questionId: question.id,
      outcome: nextOutcome(previous?.outcome, correct),
      answeredAt: timestamp,
      durationSeconds,
      difficulty: question.difficulty,
      domain: question.domain,
      skill: question.skill,
    },
    event: {
      questionId: question.id,
      correct,
      answeredAt: timestamp,
      durationSeconds,
      difficulty: question.difficulty,
      domain: question.domain,
      skill: question.skill,
    },
  };
}

export function nextOutcome(previous: Outcome | undefined, correct: boolean): Outcome {
  if (previous === "correct" || previous === "corrected") return previous;
  if (previous === "incorrect" && correct) return "corrected";
  return correct ? "correct" : "incorrect";
}
