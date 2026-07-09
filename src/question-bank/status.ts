import { stat } from "node:fs/promises";
import { questionBankPath } from "./constants.ts";
import { loadQuestionBank } from "./cache.ts";
import type { QuestionBankStatus } from "./types.ts";

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
