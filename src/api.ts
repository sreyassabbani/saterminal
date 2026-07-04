import { defaultFocus, domainsForSkills } from "./focus.ts";
import type { Focus, PracticeQuestion, QuestionDetail, QuestionMeta } from "./types.ts";

const baseUrl = "https://mysatprep.fun/api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
};

export async function fetchQuestionBank(excludeIds: Iterable<string> = [], focus: Focus = defaultFocus): Promise<QuestionMeta[]> {
  const params = focusParams(focus);
  const excluded = [...excludeIds].filter(Boolean);
  if (excluded.length > 0) {
    params.set("excludeIds", excluded.join(","));
  }

  const response = await fetchJson<ApiEnvelope<QuestionMeta[]>>(`${baseUrl}/get-questions?${params}`);
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.error || response.message || "Question bank fetch failed.");
  }

  return response.data.filter((item) => item.questionId && item.external_id);
}

export async function fetchQuestion(id: string): Promise<QuestionDetail> {
  const response = await fetchJson<ApiEnvelope<QuestionDetail>>(`${baseUrl}/question/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || response.message || `Question ${id} fetch failed.`);
  }

  return response.data;
}

export async function fetchPracticeQuestion(attemptedIds: Iterable<string>, focus: Focus = defaultFocus): Promise<PracticeQuestion> {
  const bank = await fetchQuestionBank(attemptedIds, focus);
  if (bank.length === 0) {
    throw new Error("No unanswered questions matched the current filters.");
  }

  const meta = bank[Math.floor(Math.random() * bank.length)];
  const detail = await fetchQuestion(meta.external_id);
  return { meta, detail };
}

export async function findQuestionByShortId(questionId: string): Promise<PracticeQuestion | undefined> {
  const bank = await fetchQuestionBank();
  const meta = bank.find((item) => item.questionId === questionId);
  if (!meta) {
    return undefined;
  }

  return { meta, detail: await fetchQuestion(meta.external_id) };
}

function focusParams(focus: Focus): URLSearchParams {
  return new URLSearchParams({
    assessment: "SAT",
    domains: domainsForSkills(focus.skills).join(","),
    difficulties: focus.difficulties.join(","),
    skills: focus.skills.join(","),
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
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

function responseError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown; details?: unknown };
    const message = parsed.error || parsed.message || parsed.details;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Fall back to the raw body below.
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
