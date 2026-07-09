import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pLimit from "p-limit";
import { difficultyOptions, domainsForSkills, skillOptions } from "../src/focus.ts";
import { hasHtmlTable } from "../src/text.ts";
import type { Focus, PracticeQuestion, QuestionDetail, QuestionMeta } from "../src/types.ts";
import { apiBaseUrl } from "../src/urls.ts";

const outputPath = "data/question-bank.json.zst";
const concurrency = 8;
const maxFetchAttempts = 4;

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
};

type QuestionBank = {
  version: 1;
  source: string;
  synced_at: string;
  questions: PracticeQuestion[];
};

const previousBank = await readExistingBank(outputPath);
const metas = uniqueQuestionMetas(await fetchPracticeSatMetas(allQuestionFocus()));
console.error(`metadata ${metas.length} questions`);

let completed = 0;
const limit = pLimit(concurrency);
const questions = await Promise.all(metas.map((meta) => limit(async () => {
  const detail = await fetchPracticeSatDetail(meta.external_id);
  completed += 1;
  if (completed % 25 === 0 || completed === metas.length) {
    console.error(`details ${completed}/${metas.length}`);
  }
  return { meta, detail };
})));

const bank: QuestionBank = {
  version: 1,
  source: apiBaseUrl,
  synced_at: new Date().toISOString(),
  questions,
};

const validation = validateBank(bank);
if (validation.duplicate_question_ids.length > 0 || validation.invalid_detail_questions.length > 0 || validation.invalid_answer_questions.length > 0) {
  throw new Error(`Question bank validation failed: ${JSON.stringify(validation)}`);
}

const payload = Buffer.from(`${JSON.stringify(bank)}\n`, "utf8");
await mkdir(dirname(outputPath), { recursive: true });
await Bun.write(outputPath, Bun.zstdCompressSync(payload));

console.log(JSON.stringify({
  path: outputPath,
  source: bank.source,
  synced_at: bank.synced_at,
  questions: bank.questions.length,
  raw_bytes: payload.byteLength,
  zstd_bytes: (await Bun.file(outputPath).arrayBuffer()).byteLength,
  validation,
  diff: diffBanks(previousBank, bank),
}, null, 2));

async function fetchPracticeSatMetas(focus: Focus): Promise<QuestionMeta[]> {
  const params = new URLSearchParams({
    assessment: "SAT",
    domains: domainsForSkills(focus.skills).join(","),
    difficulties: focus.difficulties.join(","),
    skills: focus.skills.join(","),
  });

  const response = await fetchJson<ApiEnvelope<QuestionMeta[]>>(`${apiBaseUrl}/get-questions?${params}`);
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.error || response.message || "Question bank fetch failed.");
  }

  return response.data.filter((item) => item.questionId && item.external_id);
}

async function fetchPracticeSatDetail(id: string): Promise<QuestionDetail> {
  const response = await fetchJson<ApiEnvelope<QuestionDetail>>(`${apiBaseUrl}/question/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || response.message || `Question ${id} fetch failed.`);
  }

  return response.data;
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxFetchAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });
      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "unknown content type";

      if (!response.ok) {
        if (attempt < maxFetchAttempts && isRetryableStatus(response.status)) {
          await sleep(retryDelayMs(attempt, response.headers.get("retry-after")));
          continue;
        }
        throw new Error(`${response.status} ${response.statusText}: ${responseError(body)}`);
      }

      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(`Expected JSON from ${url}, got ${contentType}: ${snippet(body)}`);
      }

      try {
        return JSON.parse(body) as T;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON from ${url}: ${message}. Response: ${snippet(body)}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt >= maxFetchAttempts) {
        break;
      }
      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function allQuestionFocus(): Focus {
  return {
    difficulties: [...difficultyOptions],
    domains: domainsForSkills(skillOptions),
    skills: [...skillOptions],
  };
}

function uniqueQuestionMetas(metas: QuestionMeta[]): QuestionMeta[] {
  const seen = new Set<string>();
  const unique: QuestionMeta[] = [];

  for (const meta of metas) {
    if (seen.has(meta.questionId)) {
      continue;
    }
    seen.add(meta.questionId);
    unique.push(meta);
  }

  return unique;
}

async function readExistingBank(path: string): Promise<QuestionBank | undefined> {
  const file = Bun.file(path);
  if (!await file.exists()) {
    return undefined;
  }

  const compressed = await file.arrayBuffer();
  const payload = Bun.zstdDecompressSync(new Uint8Array(compressed));
  return JSON.parse(new TextDecoder().decode(payload)) as QuestionBank;
}

function validateBank(bank: QuestionBank) {
  const seen = new Set<string>();
  const duplicateQuestionIds: string[] = [];
  const invalidDetailQuestions: string[] = [];
  const invalidAnswerQuestions: string[] = [];
  const missingRationaleQuestions: string[] = [];
  const tableQuestions: string[] = [];

  for (const question of bank.questions) {
    if (seen.has(question.meta.questionId)) {
      duplicateQuestionIds.push(question.meta.questionId);
    }
    seen.add(question.meta.questionId);

    if (!question.detail || typeof question.detail.stem !== "string" || !question.detail.answerOptions || !Array.isArray(question.detail.correct_answer)) {
      invalidDetailQuestions.push(question.meta.questionId);
      continue;
    }

    if (question.detail.correct_answer.length === 0 || question.detail.correct_answer.some((answer) => !question.detail.answerOptions[answer])) {
      invalidAnswerQuestions.push(question.meta.questionId);
    }

    if (!question.detail.rationale) {
      missingRationaleQuestions.push(question.meta.questionId);
    }

    if (hasHtmlTable(question.detail.stimulus, question.detail.stem, question.detail.rationale, ...Object.values(question.detail.answerOptions))) {
      tableQuestions.push(question.meta.questionId);
    }
  }

  return {
    questions: bank.questions.length,
    duplicate_question_ids: duplicateQuestionIds,
    invalid_detail_questions: invalidDetailQuestions,
    invalid_answer_questions: invalidAnswerQuestions,
    missing_rationale_questions: missingRationaleQuestions,
    table_questions: tableQuestions,
  };
}

function diffBanks(previous: QuestionBank | undefined, next: QuestionBank) {
  if (!previous) {
    return {
      previous: false,
      added: next.questions.length,
      removed: 0,
      changed: 0,
    };
  }

  const before = new Map(previous.questions.map((question) => [question.meta.questionId, stableQuestionPayload(question)]));
  const after = new Map(next.questions.map((question) => [question.meta.questionId, stableQuestionPayload(question)]));
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const [id, payload] of after) {
    if (!before.has(id)) {
      added += 1;
    } else if (before.get(id) !== payload) {
      changed += 1;
    }
  }

  for (const id of before.keys()) {
    if (!after.has(id)) {
      removed += 1;
    }
  }

  return {
    previous: true,
    added,
    removed,
    changed,
  };
}

function stableQuestionPayload(question: PracticeQuestion): string {
  return JSON.stringify({
    meta: question.meta,
    detail: question.detail,
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
    const date = new Date(retryAfter);
    if (!Number.isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }
  }

  return Math.min(5000, 250 * 2 ** (attempt - 1));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function responseError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown; details?: unknown };
    const message = parsed.error || parsed.message || parsed.details;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Fall through to raw snippet.
  }

  return snippet(body);
}

function snippet(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "empty response";
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}
