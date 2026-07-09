import * as sat from "../../sat/index.ts";
import type { PracticeQuestion } from "../../types.ts";
import type { AppState } from "../types.ts";
import { resetPaneScroll } from "./pane.ts";

export async function loadNextQuestion(state: AppState): Promise<void> {
  state.view = "loading";
  state.question = await takeNextQuestion(state);
  if (!state.question) {
    state.notice = "Review queue complete.";
    state.view = "history";
    return;
  }
  state.selected = 0;
  resetPaneScroll(state);
  state.elapsedMs = 0;
  state.timerStartedAt = Date.now();
  state.timerPaused = false;
  state.lastAnswer = undefined;
  state.lastCorrect = undefined;
  state.view = "practice";
  cacheNextQuestion(state);
}

export function skipQuestion(state: AppState): void {
  if (state.question) {
    state.skippedIds.add(state.question.meta.questionId);
  }
}

async function takeNextQuestion(state: AppState) {
  if (state.reviewMode) {
    return takeReviewQuestion(state);
  }

  const cached = state.nextQuestion;
  state.nextQuestion = undefined;

  if (cached) {
    const question = await cached;
    if (question) {
      return question;
    }
  }

  return sat.nextQuestion({ attemptedIds: questionExclusions(state), focus: state.focus });
}

async function takeReviewQuestion(state: AppState): Promise<PracticeQuestion | undefined> {
  while (state.reviewQuestionIds && state.reviewQuestionIds.length > 0) {
    const id = state.reviewQuestionIds.shift();
    if (!id) {
      continue;
    }

    const question = await sat.findQuestion(id);
    if (question) {
      return question;
    }
  }

  return undefined;
}

function cacheNextQuestion(state: AppState): void {
  if (state.reviewMode) {
    return;
  }

  state.nextQuestion = sat.nextQuestion({ attemptedIds: questionExclusions(state), focus: state.focus }).catch(() => undefined);
}

function questionExclusions(state: AppState): string[] {
  return [
    ...state.attempts.keys(),
    ...state.skippedIds,
    ...(state.question ? [state.question.meta.questionId] : []),
  ];
}
