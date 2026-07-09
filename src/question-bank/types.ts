import type { PracticeQuestion } from "../types.ts";
import type { questionBankVersion } from "./constants.ts";

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

export type QuestionBankIndex = {
  byId: Map<string, PracticeQuestion>;
  bySkill: Map<string, PracticeQuestion[]>;
  byDifficulty: Map<string, PracticeQuestion[]>;
};
