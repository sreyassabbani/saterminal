import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pLimit from "p-limit";
import { difficultyOptions, domainsForSkills, skillOptions } from "../src/focus.ts";
import type { Focus, PracticeQuestion, QuestionDetail, QuestionMeta } from "../src/types.ts";
import { apiBaseUrl } from "../src/urls.ts";

const outputPath = "data/question-bank.json.zst";
const concurrency = 8;

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
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "unknown content type";

  if (!response.ok) {
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
