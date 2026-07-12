import { mkdir, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { questionBankCachePath } from "@/local-data/paths.ts";
import type { Focus } from "@/questions/focus.ts";
import type { Question } from "@/questions/question.ts";

export const questionBankVersion = 2;
export const bundledQuestionBankPath = fileURLToPath(import.meta.resolve("@data/question-bank.json.zst"));

export type QuestionBank = {
  version: typeof questionBankVersion;
  source: string;
  updatedAt: string;
  questions: Question[];
};

export type QuestionBankStatus = {
  path: string;
  exists: boolean;
  bytes?: number;
  source?: string;
  updatedAt?: string;
  questions?: number;
};

let defaultBank: Promise<QuestionBank> | undefined;
const indexes = new WeakMap<QuestionBank, Map<string, Question>>();

export async function loadQuestionBank(path = questionBankCachePath): Promise<QuestionBank> {
  if (path !== questionBankCachePath) return requireBank(await readQuestionBank(path));
  defaultBank ??= materializeQuestionBank();
  return defaultBank;
}

export async function materializeQuestionBank(
  cachePath = questionBankCachePath,
  bundledPath = bundledQuestionBankPath,
): Promise<QuestionBank> {
  const cached = await readQuestionBank(cachePath, true);
  if (cached) return cached;
  const bundled = requireBank(await readQuestionBank(bundledPath));
  await saveQuestionBank(bundled, cachePath);
  return bundled;
}

export async function readQuestionBank(path: string, replaceable = false): Promise<QuestionBank | undefined> {
  try {
    const value = path.endsWith(".zst")
      ? JSON.parse(new TextDecoder().decode(Bun.zstdDecompressSync(new Uint8Array(await Bun.file(path).arrayBuffer()))))
      : await Bun.file(path).json();
    return parseQuestionBank(value);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (replaceable && error instanceof UnsupportedBankVersionError) return undefined;
    throw error;
  }
}

export async function saveQuestionBank(bank: QuestionBank, path = questionBankCachePath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await Bun.write(temporaryPath, `${JSON.stringify(bank)}\n`);
  await rename(temporaryPath, path);
}

export async function questionBankStatus(path = questionBankCachePath): Promise<QuestionBankStatus> {
  try {
    const bank = path === questionBankCachePath ? await loadQuestionBank() : await loadQuestionBank(path);
    return {
      path,
      exists: true,
      bytes: (await stat(path)).size,
      source: bank.source,
      updatedAt: bank.updatedAt,
      questions: bank.questions.length,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path, exists: false };
    throw error;
  }
}

export async function findQuestion(id: string): Promise<Question | undefined> {
  const bank = await loadQuestionBank();
  let index = indexes.get(bank);
  if (!index) {
    index = new Map(bank.questions.map((question) => [question.id, question]));
    indexes.set(bank, index);
  }
  return index.get(id);
}

export async function nextQuestion(
  excludedIds: Iterable<string>,
  focus: Focus,
  random = Math.random,
): Promise<Question | undefined> {
  const excluded = new Set(excludedIds);
  const bank = await loadQuestionBank();
  const candidates = bank.questions.filter((question) =>
    !excluded.has(question.id) &&
    focus.difficulties.includes(question.difficulty) &&
    focus.skills.includes(question.skill)
  );
  if (candidates.length === 0) return undefined;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

export function resetQuestionBankMemoryCache(): void {
  defaultBank = undefined;
}

function parseQuestionBank(value: unknown): QuestionBank {
  if (!value || typeof value !== "object") throw new Error("Question bank is not an object.");
  const bank = value as Partial<QuestionBank>;
  if (bank.version !== questionBankVersion) throw new UnsupportedBankVersionError(bank.version);
  if (typeof bank.source !== "string" || !bank.source) throw new Error("Question bank is missing its source.");
  if (typeof bank.updatedAt !== "string") throw new Error("Question bank has an invalid update timestamp.");
  if (!Array.isArray(bank.questions)) throw new Error("Question bank is missing questions.");
  return bank as QuestionBank;
}

function requireBank(bank: QuestionBank | undefined): QuestionBank {
  if (!bank) throw new Error("Question bank is missing from the package.");
  return bank;
}

class UnsupportedBankVersionError extends Error {
  constructor(version: unknown) {
    super(`Question bank version ${String(version)} is not supported.`);
  }
}
