import { describe, expect, test } from "bun:test";
import { emptyQueueMessage, questionsToReview, takeNextQuestion, unansweredQuestions } from "@/practice/question-queue.ts";
import { weakPracticeFocus } from "@/practice/weak-focus.ts";
import type { Attempt } from "@/progress/attempt.ts";
import { defaultFocus } from "@/questions/focus.ts";
import { loadQuestionBank } from "@/questions/local-bank.ts";

describe("study queues", () => {
  test("review consumes prioritized question ids independently of the normal focus", async () => {
    const question = (await loadQuestionBank()).questions[0];
    const attempt: Attempt = {
      questionId: question.id,
      outcome: "incorrect",
      answeredAt: "2026-01-01T00:00:00.000Z",
      durationSeconds: 30,
    };

    const result = await takeNextQuestion(
      questionsToReview([attempt], [], { minimumDays: 0, minimumAnswersAfter: 0 }),
      new Map([[question.id, attempt]]),
      defaultFocus,
    );

    expect(result.question?.id).toBe(question.id);
    expect(result.queue).toEqual({ kind: "review", pendingIds: [] });
    expect(emptyQueueMessage(result.queue)).toBe("Review queue complete.");
    expect(emptyQueueMessage(unansweredQuestions())).toBe("No unanswered questions match this focus.");
  });

  test("weak practice keeps the selected difficulties and targets missed skills", () => {
    const attempts: Attempt[] = [
      { questionId: "wic-1", outcome: "incorrect", answeredAt: "2026-01-01T00:00:00.000Z", durationSeconds: 30, difficulty: "M", domain: "CAS", skill: "WIC" },
      { questionId: "wic-2", outcome: "incorrect", answeredAt: "2026-01-02T00:00:00.000Z", durationSeconds: 25, difficulty: "H", domain: "CAS", skill: "WIC" },
      { questionId: "bou-1", outcome: "incorrect", answeredAt: "2026-01-03T00:00:00.000Z", durationSeconds: 20, difficulty: "M", domain: "SEC", skill: "BOU" },
      { questionId: "inf-1", outcome: "correct", answeredAt: "2026-01-04T00:00:00.000Z", durationSeconds: 15, difficulty: "M", domain: "INI", skill: "INF" },
    ];

    expect(weakPracticeFocus(attempts, { difficulties: ["H"], skills: ["INF"] })).toEqual({
      difficulties: ["H"],
      skills: ["WIC", "BOU"],
    });
    expect(weakPracticeFocus(attempts.filter((attempt) => attempt.outcome === "correct"), defaultFocus)).toBeUndefined();
  });
});
