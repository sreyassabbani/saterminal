import type { Attempt, AttemptEvent } from "@/progress/attempt.ts";
import { reviewQueue, type ReviewRequirements } from "@/progress/review-queue.ts";
import type { Focus } from "@/questions/focus.ts";
import { findQuestion, nextQuestion } from "@/questions/local-bank.ts";
import type { Question } from "@/questions/question.ts";

export type QuestionQueue =
  | { kind: "unanswered"; skippedIds: ReadonlySet<string> }
  | { kind: "review"; pendingIds: readonly string[] };

export type QueueResult = {
  queue: QuestionQueue;
  question?: Question;
};

export function unansweredQuestions(): QuestionQueue {
  return { kind: "unanswered", skippedIds: new Set() };
}

export function questionsToReview(
  attempts: Iterable<Attempt>,
  events: Iterable<AttemptEvent>,
  requirements: ReviewRequirements,
  now = new Date(),
): QuestionQueue {
  return { kind: "review", pendingIds: reviewQueue(attempts, events, requirements, now) };
}

export function skipQuestion(queue: QuestionQueue, questionId: string): QuestionQueue {
  if (queue.kind === "review") return queue;
  return { ...queue, skippedIds: new Set([...queue.skippedIds, questionId]) };
}

export async function takeNextQuestion(
  queue: QuestionQueue,
  attempts: ReadonlyMap<string, Attempt>,
  focus: Focus,
): Promise<QueueResult> {
  if (queue.kind === "unanswered") {
    return {
      queue,
      question: await nextQuestion([...attempts.keys(), ...queue.skippedIds], focus),
    };
  }

  const pendingIds = [...queue.pendingIds];
  while (pendingIds.length) {
    const question = await findQuestion(pendingIds.shift()!);
    if (question) return { queue: { kind: "review", pendingIds }, question };
  }
  return { queue: { kind: "review", pendingIds } };
}

export function emptyQueueMessage(queue: QuestionQueue): string {
  return queue.kind === "review"
    ? "Review queue complete."
    : "No unanswered questions match this focus.";
}
