import type { PracticeQuestion, QuestionDetail, QuestionMeta } from "./types.ts";

const baseUrl = "https://practicesat.vercel.app/api";
const defaultParams = new URLSearchParams({
  assessment: "SAT",
  domains: "INI,CAS,EOI,SEC",
  difficulties: "H,M",
  skills: "CID,INF,COE,WIC,TSP,CTC,SYN,TRA,BOU,FSS",
});

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export async function fetchQuestionBank(excludeIds: Iterable<string> = []): Promise<QuestionMeta[]> {
  const params = new URLSearchParams(defaultParams);
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

export async function fetchPracticeQuestion(attemptedIds: Iterable<string>): Promise<PracticeQuestion> {
  const bank = await fetchQuestionBank(attemptedIds);
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
