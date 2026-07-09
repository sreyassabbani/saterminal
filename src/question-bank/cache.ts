import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { bundledQuestionBankPath, questionBankPath, questionBankVersion } from "./constants.ts";
import type { QuestionBank } from "./types.ts";

let memoryBank: Promise<QuestionBank | undefined> | undefined;

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

export async function saveQuestionBank(bank: QuestionBank, path = questionBankPath): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  await Bun.write(tempPath, `${JSON.stringify(bank)}\n`);
  await rename(tempPath, path);
}

export function resetQuestionBankMemoryCache(): void {
  memoryBank = undefined;
}

export async function readQuestionBank(path: string): Promise<QuestionBank | undefined> {
  try {
    if (path.endsWith(".zst")) {
      const compressed = await Bun.file(path).arrayBuffer();
      const payload = Bun.zstdDecompressSync(new Uint8Array(compressed));
      return parseTrustedQuestionBank(JSON.parse(new TextDecoder().decode(payload)));
    }

    return parseTrustedQuestionBank(await Bun.file(path).json());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function parseTrustedQuestionBank(value: unknown): QuestionBank {
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

  if (typeof bank.synced_at !== "string") {
    throw new Error("Question bank cache has an invalid sync timestamp.");
  }

  if (!Array.isArray(bank.questions)) {
    throw new Error("Question bank cache is missing questions.");
  }

  return {
    version: questionBankVersion,
    source: bank.source,
    synced_at: bank.synced_at,
    questions: bank.questions,
  };
}
