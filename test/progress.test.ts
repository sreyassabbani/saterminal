import { describe, expect, test } from "bun:test";
import { activity } from "../src/progress/activity.ts";
import { createAnswerRecord, nextOutcome, type Attempt } from "../src/progress/attempt.ts";
import { history } from "../src/progress/history.ts";
import { reviewQueue } from "../src/progress/review-queue.ts";
import { progressStatistics } from "../src/progress/statistics.ts";
import { weaknesses } from "../src/progress/weaknesses.ts";
import type { Question } from "../src/questions/question.ts";

const question: Question = {
  id: "q1", sourceId: "upstream-q1", difficulty: "M", domain: "CAS", skill: "WIC",
  prompt: "Choose.", choices: [{ key: "A", content: "No" }, { key: "B", content: "Yes" }], correctAnswers: ["B"],
};

describe("progress", () => {
  test("records correction as the durable outcome while preserving the answer event", () => {
    const previous: Attempt = { questionId: "q1", outcome: "incorrect", answeredAt: "2026-01-01T00:00:00.000Z", durationSeconds: 30 };
    const record = createAnswerRecord(previous, question, "B", 12, new Date("2026-01-02T00:00:00.000Z"));

    expect(record).toMatchObject({ correct: true, attempt: { outcome: "corrected" }, event: { correct: true, skill: "WIC" } });
    expect(nextOutcome("corrected", false)).toBe("corrected");
  });

  test("builds reports from attempts without owning persistence or UI", () => {
    const attempts: Attempt[] = [
      { questionId: "old", outcome: "incorrect", answeredAt: "2026-01-01T12:00:00.000Z", durationSeconds: 40, difficulty: "M", domain: "CAS", skill: "WIC" },
      { questionId: "fixed", outcome: "corrected", answeredAt: "2026-01-09T12:00:00.000Z", durationSeconds: 20, difficulty: "M", domain: "CAS", skill: "WIC" },
      { questionId: "good", outcome: "correct", answeredAt: "2026-01-10T12:00:00.000Z", durationSeconds: 10, difficulty: "E", domain: "SEC", skill: "BOU" },
    ];

    expect(progressStatistics(attempts)).toMatchObject({ answered: 3, mastered: 2, incorrect: 1, accuracy: 2 / 3 });
    expect(history(attempts, { since: "7d" }, new Date("2026-01-10T12:00:00.000Z")).map((row) => row.questionId)).toEqual(["good", "fixed"]);
    expect(reviewQueue(attempts, [], { minimumDays: 0, minimumAnswersAfter: 0 })).toEqual(["old", "fixed"]);
    expect(weaknesses(attempts)[0]).toMatchObject({ skill: "WIC", missed: 1, total: 2 });
  });

  test("only reviews questions after both spacing thresholds", () => {
    const attempts: Attempt[] = [
      { questionId: "ready", outcome: "incorrect", answeredAt: "2026-01-01T00:00:00.000Z", durationSeconds: 10 },
      { questionId: "not-enough-later-answers", outcome: "incorrect", answeredAt: "2026-01-05T00:00:00.000Z", durationSeconds: 10 },
      { questionId: "too-recent", outcome: "incorrect", answeredAt: "2026-01-10T00:00:00.000Z", durationSeconds: 10 },
    ];
    const events = Array.from({ length: 100 }, (_, index) => ({
      questionId: `later-${index}`,
      correct: true,
      answeredAt: "2026-01-03T00:00:00.000Z",
      durationSeconds: 10,
      difficulty: "M" as const,
      domain: "CAS" as const,
      skill: "WIC" as const,
    }));

    expect(reviewQueue(
      attempts,
      events,
      { minimumDays: 7, minimumAnswersAfter: 100 },
      new Date("2026-01-12T00:00:00.000Z"),
    )).toEqual(["ready"]);
  });

  test("counts consecutive local calendar days", () => {
    const events = ["2026-01-08T12:00:00", "2026-01-09T12:00:00"].map((answeredAt, index) => ({
      questionId: `q${index}`, correct: true, answeredAt, durationSeconds: 10,
      difficulty: "M" as const, domain: "CAS" as const, skill: "WIC" as const,
    }));

    expect(activity(events, new Date("2026-01-10T12:00:00"), 7)).toMatchObject({ streak: 2, activeDays: 2, todayCount: 0 });
  });
});
