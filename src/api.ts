import { defaultFocus } from "./state.ts";
import type { Focus, PracticeQuestion, QuestionDetail, QuestionMeta } from "./types.ts";

const baseUrl = "https://practicesat.vercel.app/api";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
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
    throw new Error(response.message || "Question bank fetch failed.");
  }

  return response.data.filter((item) => item.questionId && item.external_id);
}

export async function fetchQuestion(id: string): Promise<QuestionDetail> {
  const response = await fetchJson<ApiEnvelope<QuestionDetail>>(`${baseUrl}/question/${id}`);
  if (!response.success || !response.data) {
    throw new Error(response.message || `Question ${id} fetch failed.`);
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
    domains: focus.domains.join(","),
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

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
