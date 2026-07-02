import type { Attempt, Focus, PracticeQuestion } from "../types.ts";
import type { TextSegment } from "../text.ts";

export type View = "focus" | "loading" | "practice" | "review" | "history" | "summary" | "detail" | "error";

export type AppState = {
  attempts: Map<string, Attempt>;
  skippedIds: Set<string>;
  nextQuestion?: Promise<PracticeQuestion | undefined>;
  focus: Focus;
  focusIndex: number;
  focusColumn: number;
  focusRow: number;
  view: View;
  question?: PracticeQuestion;
  selected: number;
  questionScroll: number;
  elapsedMs: number;
  timerStartedAt?: number;
  timerPaused: boolean;
  timerHidden: boolean;
  lastAnswer?: string;
  lastCorrect?: boolean;
  detailQuestion?: PracticeQuestion;
  historyIndex: number;
  error?: string;
};

export type KeyData = {
  code?: string | Buffer | number;
  codepoint?: number;
  isCharacter?: boolean;
};

export type DisplayRow = {
  segments: TextSegment[];
  bold?: boolean;
};

export type PaneLayout = {
  leftX: number;
  leftWidth: number;
  rightX: number;
  rightWidth: number;
};
