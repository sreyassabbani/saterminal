import { mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import pLimit from "p-limit";
import { difficultyOptions, domainsForSkills, skillOptions } from "./focus.ts";
import { fetchPracticeSatDetail, fetchPracticeSatMetas } from "./practice-sat.ts";
import { stateDir } from "./state.ts";
import type { Difficulty, Focus, PracticeQuestion, QuestionMeta, Skill } from "./types.ts";
import { apiBaseUrl } from "./urls.ts";

export const questionBankVersion = 1;
export const questionBankPath = join(stateDir, "cache", "question-bank.json.gz");

export type QuestionBank = {
  version: typeof questionBankVersion;
  source: string;
  synced_at: string;
  questions: PracticeQuestion[];
};

export type QuestionBankStatus = {
  path: string;
  exists: boolean;
  size_bytes?: number;
  source?: string;
  synced_at?: string;
  questions?: number;
};

export type SyncProgress = {
  phase: "metadata" | "details" | "writing";
  completed: number;
  total: number;
  question_id?: string;
};

export type SyncOptions = {
  concurrency?: number;
  now?: Date;
  onProgress?: (progress: SyncProgress) => void;
};

export type SyncResult = {
  path: string;
  source: string;
  synced_at: string;
  questions: number;
  size_bytes: number;
};

let memoryBank: Promise<QuestionBank | undefined> | undefined;

export async function syncQuestionBank(options: SyncOptions = {}, path = questionBankPath): Promise<SyncResult> {
  const focus = allQuestionFocus();
  options.onProgress?.({ phase: "metadata", completed: 0, total: 0 });
  const metas = uniqueQuestionMetas(await fetchPracticeSatMetas([], focus));
  options.onProgress?.({ phase: "metadata", completed: metas.length, total: metas.length });

  let completed = 0;
  const limit = pLimit(Math.max(1, options.concurrency ?? 8));
  const questions = await Promise.all(metas.map((meta) => limit(async () => {
    const detail = await fetchPracticeSatDetail(meta.external_id);
    completed += 1;
    options.onProgress?.({
      phase: "details",
      completed,
      total: metas.length,
      question_id: meta.questionId,
    });
    return { meta, detail };
  })));

  const bank: QuestionBank = {
    version: questionBankVersion,
    source: apiBaseUrl,
    synced_at: (options.now ?? new Date()).toISOString(),
    questions,
  };

  options.onProgress?.({ phase: "writing", completed: questions.length, total: questions.length });
  await saveQuestionBank(bank, path);
  const size_bytes = (await stat(path)).size;

  if (path === questionBankPath) {
    memoryBank = Promise.resolve(bank);
  }

  return {
    path,
    source: bank.source,
    synced_at: bank.synced_at,
    questions: bank.questions.length,
    size_bytes,
  };
}

export async function getPracticeQuestion(attemptedIds: Iterable<string>, focus: Focus): Promise<PracticeQuestion> {
  const question = selectPracticeQuestion(await requireQuestionBank(), attemptedIds, focus);
  if (!question) {
    throw new Error("No unanswered questions matched the current filters.");
  }

  return question;
}

export async function getQuestionByShortId(questionId: string): Promise<PracticeQuestion | undefined> {
  return findQuestionInBank(await requireQuestionBank(), questionId);
}

export function selectPracticeQuestion(
  bank: QuestionBank,
  attemptedIds: Iterable<string>,
  focus: Focus,
  random = Math.random,
): PracticeQuestion | undefined {
  const attempted = new Set(attemptedIds);
  const candidates = bank.questions.filter((question) =>
    !attempted.has(question.meta.questionId) && questionMatchesFocus(question.meta, focus)
  );

  if (candidates.length === 0) {
    return undefined;
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}

export function findQuestionInBank(bank: QuestionBank, questionId: string): PracticeQuestion | undefined {
  return bank.questions.find((question) => question.meta.questionId === questionId);
}

export async function loadQuestionBank(path = questionBankPath): Promise<QuestionBank | undefined> {
  if (path === questionBankPath) {
    memoryBank ??= readQuestionBank(path);
    return memoryBank;
  }

  return readQuestionBank(path);
}

export async function questionBankStatus(path = questionBankPath): Promise<QuestionBankStatus> {
  try {
    const [bank, file] = await Promise.all([loadQuestionBank(path), stat(path)]);
    if (!bank) {
      return { path, exists: false };
    }

    return {
      path,
      exists: true,
      size_bytes: file.size,
      source: bank.source,
      synced_at: bank.synced_at,
      questions: bank.questions.length,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path, exists: false };
    }

    throw error;
  }
}

export async function saveQuestionBank(bank: QuestionBank, path = questionBankPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const payload = Buffer.from(`${JSON.stringify(bank)}\n`, "utf8");
  const compressed = Bun.gzipSync(payload);
  const tempPath = `${path}.${process.pid}.tmp`;
  await Bun.write(tempPath, compressed);
  await rename(tempPath, path);
}

export function resetQuestionBankMemoryCache(): void {
  memoryBank = undefined;
}

async function requireQuestionBank(path = questionBankPath): Promise<QuestionBank> {
  const bank = await loadQuestionBank(path);
  if (!bank) {
    throw new Error("Question bank cache is missing. Run `sat sync` to download questions.");
  }

  return bank;
}

function allQuestionFocus(): Focus {
  return {
    difficulties: [...difficultyOptions],
    domains: domainsForSkills(skillOptions),
    skills: [...skillOptions],
  };
}

async function readQuestionBank(path: string): Promise<QuestionBank | undefined> {
  try {
    const compressed = await Bun.file(path).arrayBuffer();
    const payload = Bun.gunzipSync(new Uint8Array(compressed));
    return parseQuestionBank(JSON.parse(new TextDecoder().decode(payload)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function parseQuestionBank(value: unknown): QuestionBank {
  if (!value || typeof value !== "object") {
    throw new Error("Question bank cache is not an object.");
  }

  const bank = value as Partial<QuestionBank>;
  if (bank.version !== questionBankVersion) {
    throw new Error(`Question bank cache version ${String(bank.version)} is not supported.`);
  }

  if (typeof bank.source !== "string" || !bank.source) {
    throw new Error("Question bank cache is missing its source.");
  }

  if (typeof bank.synced_at !== "string" || Number.isNaN(new Date(bank.synced_at).getTime())) {
    throw new Error("Question bank cache has an invalid sync timestamp.");
  }

  if (!Array.isArray(bank.questions)) {
    throw new Error("Question bank cache is missing questions.");
  }

  const questions = bank.questions.filter(isPracticeQuestion);
  if (questions.length !== bank.questions.length) {
    throw new Error("Question bank cache contains invalid question entries.");
  }

  return {
    version: questionBankVersion,
    source: bank.source,
    synced_at: bank.synced_at,
    questions,
  };
}

function isPracticeQuestion(value: unknown): value is PracticeQuestion {
  if (!value || typeof value !== "object") {
    return false;
  }

  const question = value as Partial<PracticeQuestion>;
  return isQuestionMeta(question.meta) && isQuestionDetail(question.detail);
}

function isQuestionMeta(value: unknown): value is QuestionMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const meta = value as Partial<QuestionMeta>;
  return Boolean(meta.questionId && meta.external_id && meta.difficulty && meta.primary_class_cd && meta.skill_cd);
}

function isQuestionDetail(value: unknown): value is PracticeQuestion["detail"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const detail = value as Partial<PracticeQuestion["detail"]>;
  return Boolean(detail.type && typeof detail.stem === "string" && detail.answerOptions && Array.isArray(detail.correct_answer));
}

function questionMatchesFocus(meta: QuestionMeta, focus: Focus): boolean {
  return focus.difficulties.includes(meta.difficulty as Difficulty) && focus.skills.includes(meta.skill_cd as Skill);
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
