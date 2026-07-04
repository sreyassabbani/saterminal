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
  saveQuestionBank,
  selectPracticeQuestion,
  syncQuestionBank,
  type QuestionBank,
  type SyncProgress,
} from "../src/question-bank.ts";
import type { PracticeQuestion, QuestionDetail, QuestionMeta } from "../src/types.ts";

describe("question bank", () => {
  test("saves and loads a plain local bank", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-bank-"));
    const path = join(dir, "question-bank.json");

    try {
      const bank = questionBank([practiceQuestion("a", "external-a", "M", "WIC")]);
      await saveQuestionBank(bank, path);

      expect(await loadQuestionBank(path)).toEqual(bank);
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
  });

  test("syncs metadata and detail payloads into the local bank", async () => {
    const dir = await mkdtemp(join(tmpdir(), "saterminal-bank-"));
    const path = join(dir, "question-bank.json.gz");
    const originalFetch = globalThis.fetch;
    const progress: SyncProgress[] = [];
    const requested: string[] = [];

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);

      if (url.includes("/get-questions?")) {
        return Promise.resolve(jsonResponse({
          success: true,
          data: [
            meta("a", "external-a", "M", "WIC"),
            meta("b", "external-b", "H", "CID"),
            meta("a", "external-a", "M", "WIC"),
          ],
        }));
      }

      if (url.endsWith("/external-a")) {
        return Promise.resolve(jsonResponse({ success: true, data: detail("external-a") }));
      }

      if (url.endsWith("/external-b")) {
        return Promise.resolve(jsonResponse({ success: true, data: detail("external-b") }));
      }

      return Promise.resolve(new Response("not found", { status: 404, statusText: "Not Found" }));
    }) as typeof fetch;

    try {
      const result = await syncQuestionBank({
        concurrency: 1,
        now: new Date("2026-01-02T00:00:00.000Z"),
        onProgress(value) {
          progress.push(value);
        },
      }, path);

      expect(result).toMatchObject({
        path,
        source: "https://practicesat.vercel.app/api",
        synced_at: "2026-01-02T00:00:00.000Z",
        questions: 2,
      });
      expect((await loadQuestionBank(path))?.questions.map((question) => question.meta.questionId)).toEqual(["a", "b"]);
      expect(requested[0]).toContain("difficulties=E%2CM%2CH");
      expect(requested.filter((url) => url.includes("/api/question/")).length).toBe(2);
      expect(progress.map((value) => value.phase)).toContain("writing");
      expect((await readFile(path, "utf8")).startsWith("{")).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      await rm(dir, { recursive: true, force: true });
    }
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

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
