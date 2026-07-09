import type { Attempt, Outcome, PracticeQuestion, QuestionMeta } from "../types.ts";

export type AnswerCheck = {
  answer: string;
  correct: boolean;
};

export function checkAnswer(question: PracticeQuestion, answer: string): AnswerCheck {
  return {
    answer,
    correct: question.detail.correct_answer.includes(answer),
  };
}

export function recordAttempt(attempts: Map<string, Attempt>, questionId: string, wasCorrect: boolean, elapsedSeconds = 0, now = new Date(), meta?: QuestionMeta): Attempt {
  const existing = attempts.get(questionId);
  const attempt = { question_id: questionId, outcome: nextOutcome(existing?.outcome, wasCorrect), updated_at: now.toISOString(), elapsed_seconds: elapsedSeconds, ...metadataFromQuestionMeta(meta) };
  attempts.set(questionId, attempt);
  return attempt;
}

export function nextOutcome(previous: Outcome | undefined, wasCorrect: boolean): Outcome {
  if (previous === "correct" || previous === "corrected") return previous;
  if (previous === "incorrect" && wasCorrect) return "corrected";
  return wasCorrect ? "correct" : "incorrect";
}

function metadataFromQuestionMeta(meta: QuestionMeta | undefined): Partial<Attempt> {
  return meta ? optionalMetadata({ difficulty: meta.difficulty, domain: meta.primary_class_cd, domain_desc: meta.primary_class_cd_desc, skill: meta.skill_cd, skill_desc: meta.skill_desc }) : {};
}

function optionalMetadata(metadata: Pick<Attempt, "difficulty" | "domain" | "domain_desc" | "skill" | "skill_desc">): Partial<Attempt> {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value)) as Partial<Attempt>;
}
