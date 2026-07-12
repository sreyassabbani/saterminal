import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pLimit from "p-limit";
import type { QuestionBank } from "@/questions/local-bank.ts";
import { questionBankVersion } from "@/questions/local-bank.ts";
import type { Question, QuestionChoice } from "@/questions/question.ts";
import { isDifficulty, isDomainCode, isSkillCode } from "@/questions/taxonomy.ts";
import { difficulties, domains, skills } from "@/questions/taxonomy.ts";

const apiBaseUrl = "https://practicesat.vercel.app/api";
const outputPath = "data/question-bank.json.zst";
const concurrency = 8;
const maxFetchAttempts = 4;

type ApiEnvelope<T> = { success: boolean; data: T; error?: string; message?: string };
type SourceMeta = {
  questionId: string;
  external_id: string;
  difficulty: string;
  primary_class_cd: string;
  skill_cd: string;
};
type SourceDetail = {
  stimulus?: string;
  stem: string;
  answerOptions: Record<string, string>;
  correct_answer: string[];
  rationale?: string;
};

const previousBank = await readExistingBank(outputPath);
const metas = uniqueMetas(await fetchMetas());
console.error(`metadata ${metas.length} questions`);

let completed = 0;
const limit = pLimit(concurrency);
const questions = await Promise.all(metas.map((meta) => limit(async () => {
  const question = normalizeQuestion(meta, await fetchDetail(meta.external_id));
  completed += 1;
  if (completed % 25 === 0 || completed === metas.length) console.error(`details ${completed}/${metas.length}`);
  return question;
})));

const bank: QuestionBank = {
  version: questionBankVersion,
  source: apiBaseUrl,
  updatedAt: new Date().toISOString(),
  questions,
};

const validation = validateBank(bank);
if (validation.duplicateIds.length || validation.invalidAnswers.length) {
  throw new Error(`Question bank validation failed: ${JSON.stringify(validation)}`);
}

const payload = Buffer.from(`${JSON.stringify(bank)}\n`, "utf8");
await mkdir(dirname(outputPath), { recursive: true });
await Bun.write(outputPath, Bun.zstdCompressSync(payload));

console.log(JSON.stringify({
  path: outputPath,
  source: bank.source,
  updatedAt: bank.updatedAt,
  questions: bank.questions.length,
  rawBytes: payload.byteLength,
  zstdBytes: (await Bun.file(outputPath).arrayBuffer()).byteLength,
  validation,
  diff: diffBanks(previousBank, bank),
}, null, 2));

async function fetchMetas(): Promise<SourceMeta[]> {
  const params = new URLSearchParams({
    assessment: "SAT",
    domains: domains.join(","),
    difficulties: difficulties.join(","),
    skills: skills.join(","),
  });
  const response = await fetchJson<ApiEnvelope<SourceMeta[]>>(`${apiBaseUrl}/get-questions?${params}`);
  if (!response.success || !Array.isArray(response.data)) throw new Error(response.error || response.message || "Question bank fetch failed.");
  return response.data.filter((meta) => meta.questionId && meta.external_id);
}

async function fetchDetail(id: string): Promise<SourceDetail> {
  const response = await fetchJson<ApiEnvelope<SourceDetail>>(`${apiBaseUrl}/question/${id}`);
  if (!response.success || !response.data) throw new Error(response.error || response.message || `Question ${id} fetch failed.`);
  return response.data;
}

function normalizeQuestion(meta: SourceMeta, detail: SourceDetail): Question {
  if (!isDifficulty(meta.difficulty) || !isDomainCode(meta.primary_class_cd) || !isSkillCode(meta.skill_cd)) {
    throw new Error(`Question ${meta.questionId} has unsupported SAT taxonomy values.`);
  }
  const choices: QuestionChoice[] = Object.entries(detail.answerOptions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, content]) => ({ key, content }));
  return {
    id: meta.questionId,
    sourceId: meta.external_id,
    difficulty: meta.difficulty,
    domain: meta.primary_class_cd,
    skill: meta.skill_cd,
    ...(detail.stimulus ? { passage: detail.stimulus } : {}),
    prompt: detail.stem,
    choices,
    correctAnswers: detail.correct_answer,
    ...(detail.rationale ? { explanation: detail.rationale } : {}),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxFetchAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      const body = await response.text();
      if (!response.ok) {
        if (attempt < maxFetchAttempts && [429, 500, 502, 503, 504].includes(response.status)) {
          await Bun.sleep(Math.min(5000, 250 * 2 ** (attempt - 1)));
          continue;
        }
        throw new Error(`${response.status} ${response.statusText}: ${snippet(body)}`);
      }
      if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
        throw new Error(`Expected JSON from ${url}: ${snippet(body)}`);
      }
      return JSON.parse(body) as T;
    } catch (error) {
      lastError = error;
      if (attempt < maxFetchAttempts) await Bun.sleep(Math.min(5000, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function uniqueMetas(metas: SourceMeta[]): SourceMeta[] {
  const seen = new Set<string>();
  return metas.filter((meta) => !seen.has(meta.questionId) && Boolean(seen.add(meta.questionId)));
}

function validateBank(bank: QuestionBank) {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const invalidAnswers: string[] = [];
  const missingExplanations: string[] = [];
  const tableQuestions: string[] = [];
  for (const question of bank.questions) {
    if (seen.has(question.id)) duplicateIds.push(question.id);
    seen.add(question.id);
    if (!question.correctAnswers.length || question.correctAnswers.some((answer) => !question.choices.some((choice) => choice.key === answer))) invalidAnswers.push(question.id);
    if (!question.explanation) missingExplanations.push(question.id);
    if ([question.passage, question.prompt, question.explanation, ...question.choices.map((choice) => choice.content)].some((value) => /<table\b/i.test(value ?? ""))) tableQuestions.push(question.id);
  }
  return { questions: bank.questions.length, duplicateIds, invalidAnswers, missingExplanations, tableQuestions };
}

async function readExistingBank(path: string): Promise<QuestionBank | undefined> {
  if (!await Bun.file(path).exists()) return undefined;
  const value = JSON.parse(new TextDecoder().decode(Bun.zstdDecompressSync(new Uint8Array(await Bun.file(path).arrayBuffer())))) as Record<string, unknown>;
  return value.version === questionBankVersion ? value as QuestionBank : undefined;
}

function diffBanks(previous: QuestionBank | undefined, next: QuestionBank) {
  if (!previous) return { previous: false, added: next.questions.length, removed: 0, changed: 0 };
  const before = new Map(previous.questions.map((question) => [question.id, JSON.stringify(question)]));
  const after = new Map(next.questions.map((question) => [question.id, JSON.stringify(question)]));
  return {
    previous: true,
    added: [...after.keys()].filter((id) => !before.has(id)).length,
    removed: [...before.keys()].filter((id) => !after.has(id)).length,
    changed: [...after].filter(([id, value]) => before.has(id) && before.get(id) !== value).length,
  };
}

function snippet(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized || "empty response";
}
