import { describe, expect, test } from "bun:test";
import { practiceQuestionApiUrl, practiceQuestionUrl } from "../src/tui/question.ts";
import type { PracticeQuestion } from "../src/types.ts";

describe("tui question urls", () => {
  test("uses the current Practice SAT host", () => {
    const question: PracticeQuestion = {
      meta: {
        questionId: "abc 123",
        uId: "abc 123",
        external_id: "external/1",
        difficulty: "M",
        primary_class_cd: "INI",
        skill_cd: "CID",
      },
      detail: {
        externalid: "external/1",
        type: "mcq",
        stem: "",
        answerOptions: {},
        correct_answer: [],
      },
    };

    expect(practiceQuestionUrl(question)).toBe("https://practicesat.vercel.app/question/abc%20123");
    expect(practiceQuestionApiUrl(question)).toBe("https://practicesat.vercel.app/api/question/external%2F1");
  });
});
