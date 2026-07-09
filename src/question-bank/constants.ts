import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDir } from "../state.ts";

export const questionBankVersion = 1;
export const questionBankPath = join(cacheDir, "question-bank.json");
export const bundledQuestionBankPath = fileURLToPath(new URL("../../data/question-bank.json.zst", import.meta.url));
