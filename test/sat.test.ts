import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { answerQuestion } from "../src/sat/index.ts";
import { loadAttemptEvents, loadAttempts } from "../src/state.ts";
import type { PracticeQuestion } from "../src/types.ts";

describe("sat facade", () => {
  test("answers a question and persists attempt plus event", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-sat-"));
    const db = join(dir, "sat.db");

    try {
      const attempts = new Map();
      const result = await answerQuestion({
        attempts,
        question: sampleQuestion,
        answer: "A",
        elapsedSeconds: 17,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
        path: db,
      });

      expect(result.correct).toBe(true);
      expect(result.attempt).toMatchObject({
        question_id: "abc12345",
        outcome: "correct",
        elapsed_seconds: 17,
        skill: "WIC",
      });
      expect(await loadAttempts(db)).toEqual(attempts);
      expect(await loadAttemptEvents(db)).toEqual([{
        question_id: "abc12345",
        correct: true,
        answered_at: "2026-01-01T00:00:00.000Z",
        elapsed_seconds: 17,
        difficulty: "M",
        domain: "CAS",
        domain_desc: "Craft and Structure",
        skill: "WIC",
        skill_desc: "Words in Context",
      }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("corrects a previously missed question", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-sat-"));
    const db = join(dir, "sat.db");

    try {
      const attempts = new Map();
      await answerQuestion({
        attempts,
        question: sampleQuestion,
        answer: "B",
        elapsedSeconds: 11,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
        path: db,
      });
      const result = await answerQuestion({
        attempts,
        question: sampleQuestion,
        answer: "A",
        elapsedSeconds: 13,
        answeredAt: new Date("2026-01-02T00:00:00.000Z"),
        path: db,
      });

      expect(result.correct).toBe(true);
      expect(result.attempt.outcome).toBe("corrected");
      expect((await loadAttemptEvents(db)).map((event) => event.correct)).toEqual([false, true]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

const sampleQuestion: PracticeQuestion = {
  meta: {
    questionId: "abc12345",
    uId: "abc12345",
    external_id: "external-1",
    difficulty: "M",
    primary_class_cd: "CAS",
    primary_class_cd_desc: "Craft and Structure",
    skill_cd: "WIC",
    skill_desc: "Words in Context",
  },
  detail: {
    externalid: "external-1",
    type: "mcq",
    stem: "<p>Question?</p>",
    answerOptions: { A: "<p>Yes</p>", B: "<p>No</p>" },
    correct_answer: ["A"],
  },
};
