import { mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stateDir } from "./state.ts";
import type { Difficulty, Focus, PracticeQuestion, QuestionMeta, Skill } from "./types.ts";

export const questionBankVersion = 1;
export const questionBankPath = join(stateDir, "cache", "question-bank.json");
export const bundledQuestionBankPath = fileURLToPath(new URL("../data/question-bank.json.zst", import.meta.url));

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

let memoryBank: Promise<QuestionBank | undefined> | undefined;

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
    memoryBank ??= materializeQuestionBankCache();
    return memoryBank;
  }

  return readQuestionBank(path);
}

export async function materializeQuestionBankCache(
  cachePath = questionBankPath,
  bundledPath = bundledQuestionBankPath,
): Promise<QuestionBank | undefined> {
  const cached = await readQuestionBank(cachePath);
  if (cached) {
    return cached;
  }

  const bundled = await readQuestionBank(bundledPath);
  if (!bundled) {
    return undefined;
  }

  await saveQuestionBank(bundled, cachePath);
  return bundled;
}

export async function questionBankStatus(path = questionBankPath): Promise<QuestionBankStatus> {
  try {
    const bank = await loadQuestionBank(path);
    if (!bank) {
      return { path, exists: false };
    }
    const file = await stat(path);

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
  const tempPath = `${path}.${process.pid}.tmp`;
  await Bun.write(tempPath, `${JSON.stringify(bank)}\n`);
  await rename(tempPath, path);
}

export function resetQuestionBankMemoryCache(): void {
  memoryBank = undefined;
}

async function requireQuestionBank(path = questionBankPath): Promise<QuestionBank> {
  const bank = await loadQuestionBank(path);
  if (!bank) {
    throw new Error("Question bank is missing from the package.");
  }

  return bank;
}

async function readQuestionBank(path: string): Promise<QuestionBank | undefined> {
  try {
    if (path.endsWith(".zst")) {
      const compressed = await Bun.file(path).arrayBuffer();
      const payload = Bun.zstdDecompressSync(new Uint8Array(compressed));
      return parseQuestionBank(JSON.parse(new TextDecoder().decode(payload)));
    }

    return parseQuestionBank(await Bun.file(path).json());
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
