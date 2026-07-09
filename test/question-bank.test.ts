import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findQuestionInBank,
  loadQuestionBank,
  materializeQuestionBankCache,
  questionBankStatus,
  questionBankVersion,
  questionBankIndex,
  saveQuestionBank,
  selectPracticeQuestion,
  type QuestionBank,
} from "../src/question-bank.ts";
import type { PracticeQuestion, QuestionDetail, QuestionMeta } from "../src/types.ts";

describe("question bank", () => {
  test("saves and loads a plain local bank", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-bank-"));
    const path = join(dir, "question-bank.json");

    try {
      const bank = questionBank([practiceQuestion("a", "external-a", "M", "WIC")]);
      await saveQuestionBank(bank, path);

      expect(await loadQuestionBank(path) as unknown).toEqual(bank);
      expect((await readFile(path, "utf8")).startsWith("{")).toBe(true);
      expect(await questionBankStatus(path)).toMatchObject({
        exists: true,
        path,
        source: "test",
        synced_at: "2026-01-01T00:00:00.000Z",
        questions: 1,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("loads the bundled zstd bank format", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-bank-"));
    const path = join(dir, "question-bank.json.zst");

    try {
      const bank = questionBank([practiceQuestion("a", "external-a", "M", "WIC")]);
      await Bun.write(path, Bun.zstdCompressSync(Buffer.from(`${JSON.stringify(bank)}\n`, "utf8")));

      expect((await loadQuestionBank(path)) as unknown).toEqual(bank);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("trusts processed question entries at runtime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-bank-"));
    const path = join(dir, "question-bank.json");

    try {
      const bank: QuestionBank = {
        version: questionBankVersion,
        source: "test",
        synced_at: "not validated at runtime",
        questions: [{ meta: { questionId: "shape-owned-by-update-bank" } }] as unknown as PracticeQuestion[],
      };
      await Bun.write(path, `${JSON.stringify(bank)}\n`);

      expect(await loadQuestionBank(path)).toEqual(bank);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("selects questions by focus and exclusions", () => {
    const bank = questionBank([
      practiceQuestion("wic", "external-wic", "M", "WIC"),
      practiceQuestion("cid", "external-cid", "H", "CID"),
    ]);

    expect(selectPracticeQuestion(bank, [], {
      difficulties: ["M"],
      domains: ["CAS"],
      skills: ["WIC"],
    }, () => 0)?.meta.questionId).toBe("wic");

    expect(selectPracticeQuestion(bank, ["wic"], {
      difficulties: ["M"],
      domains: ["CAS"],
      skills: ["WIC"],
    })).toBeUndefined();

    expect(findQuestionInBank(bank, "cid")?.meta.skill_cd).toBe("CID");
    expect(questionBankIndex(bank).byId.get("cid")?.meta.skill_cd).toBe("CID");
  });

  test("materializes a bundled zstd bank into a plain user cache", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-bank-"));
    const cachePath = join(dir, "cache", "question-bank.json");
    const bundledPath = join(dir, "question-bank.json.zst");

    try {
      const bank = questionBank([practiceQuestion("a", "external-a", "M", "WIC")]);
      await Bun.write(bundledPath, Bun.zstdCompressSync(Buffer.from(`${JSON.stringify(bank)}\n`, "utf8")));

      expect(await materializeQuestionBankCache(cachePath, bundledPath)).toEqual(bank);
      expect((await readFile(cachePath, "utf8")).startsWith("{")).toBe(true);
      expect(await materializeQuestionBankCache(cachePath, bundledPath)).toEqual(bank);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function questionBank(questions: PracticeQuestion[]): QuestionBank {
  return {
    version: questionBankVersion,
    source: "test",
    synced_at: "2026-01-01T00:00:00.000Z",
    questions,
  };
}

function practiceQuestion(questionId: string, externalId: string, difficulty: string, skill: string): PracticeQuestion {
  return {
    meta: meta(questionId, externalId, difficulty, skill),
    detail: detail(externalId),
  };
}

function meta(questionId: string, externalId: string, difficulty: string, skill: string): QuestionMeta {
  return {
    questionId,
    uId: questionId,
    external_id: externalId,
    difficulty,
    primary_class_cd: skill === "WIC" ? "CAS" : "INI",
    primary_class_cd_desc: skill === "WIC" ? "Craft and Structure" : "Information and Ideas",
    skill_cd: skill,
    skill_desc: skill === "WIC" ? "Words in Context" : "Central Ideas and Details",
  };
}

function detail(externalid: string): QuestionDetail {
  return {
    externalid,
    type: "mcq",
    stimulus: "<p>Text</p>",
    stem: "<p>Question?</p>",
    answerOptions: { A: "<p>Yes</p>", B: "<p>No</p>" },
    correct_answer: ["A"],
    rationale: "<p>Because.</p>",
  };
}
