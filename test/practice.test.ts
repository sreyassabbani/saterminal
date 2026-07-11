import { describe, expect, test } from "bun:test";
import { emptyQueueMessage, questionsToReview, takeNextQuestion, unansweredQuestions } from "../src/practice/question-queue.ts";
import type { Attempt } from "../src/progress/attempt.ts";
import { defaultFocus } from "../src/questions/focus.ts";
import { loadQuestionBank } from "../src/questions/local-bank.ts";

describe("study queues", () => {
  test("review consumes prioritized question ids independently of the normal focus", async () => {
    const question = (await loadQuestionBank()).questions[0];
    const attempt: Attempt = {
      questionId: question.id,
      outcome: "incorrect",
      answeredAt: "2026-01-01T00:00:00.000Z",
      durationSeconds: 30,
    };

    const result = await takeNextQuestion(questionsToReview([attempt]), new Map([[question.id, attempt]]), defaultFocus);

    expect(result.question?.id).toBe(question.id);
    expect(result.queue).toEqual({ kind: "review", pendingIds: [] });
    expect(emptyQueueMessage(result.queue)).toBe("Review queue complete.");
    expect(emptyQueueMessage(unansweredQuestions())).toBe("No unanswered questions match this focus.");
  });
});
