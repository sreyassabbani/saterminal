import * as sat from "../sat/index.ts";
import { answerKeys, openExternalQuestion, questionNeedsExternalDisplay } from "./question.ts";
import { historyRows } from "./history.ts";
import { elapsedQuestionSeconds, pauseTimer, resumeTimer, toggleTimer } from "./timer.ts";
import type { AppState, KeyData } from "./types.ts";
import { handleFocusKey } from "./input/focus.ts";
import { isPauseKey } from "./input/keys.ts";
import { ensureSelectedAnswerVisible, handlePaneKey, isScrollablePaneView, resetPaneScroll } from "./input/pane.ts";
import { loadNextQuestion, skipQuestion } from "./input/question-flow.ts";

export { isPauseKey } from "./input/keys.ts";
export { loadNextQuestion } from "./input/question-flow.ts";

export async function handleKey(state: AppState, name: string, data?: KeyData): Promise<void> {
  if (state.view === "loading") {
    return;
  }

  if (state.view === "focus") {
    await handleFocusKey(state, name, data);
    return;
  }

  if (name === "f") {
    pauseTimer(state);
    state.view = "focus";
    return;
  }

  if (name === "h") {
    pauseTimer(state);
    state.view = "history";
    state.historyIndex = 0;
    return;
  }

  if (name === "s") {
    pauseTimer(state);
    state.view = "summary";
    return;
  }

  if (name === "t") {
    state.timerHidden = !state.timerHidden;
    return;
  }

  if (name === "p") {
    state.view = state.question ? "practice" : "loading";
    resetPaneScroll(state);
    resumeTimer(state);
    if (!state.question) {
      await loadNextQuestion(state);
    }
    return;
  }

  if (state.view === "error") {
    if (name === "r") {
      state.view = "loading";
      await loadNextQuestion(state);
    }
    return;
  }

  if (isScrollablePaneView(state) && handlePaneKey(state, name)) {
    return;
  }

  if (state.view === "practice") {
    await handlePracticeKey(state, name, data);
    return;
  }

  if (state.view === "review" && (name === "ENTER" || name === "n")) {
    await loadNextQuestion(state);
    return;
  }

  if (state.view === "history") {
    await handleHistoryKey(state, name);
    return;
  }

  if (state.view === "detail" && name === "ESCAPE") {
    state.view = "history";
  }
}

async function handlePracticeKey(state: AppState, name: string, data?: KeyData): Promise<void> {
  if (isPauseKey(name, data)) {
    toggleTimer(state);
    return;
  }

  if (state.question && questionNeedsExternalDisplay(state.question.detail)) {
    if (name === "n" || name === "x" || name === "ENTER") {
      skipQuestion(state);
      await loadNextQuestion(state);
    } else if (name === "o") {
      openExternalQuestion(state.question);
    }
    return;
  }

  const choices = answerKeys(state.question);
  const directChoice = choices.findIndex((choice) => choice.toLowerCase() === name.toLowerCase());
  if (directChoice >= 0) {
    state.selected = directChoice;
    ensureSelectedAnswerVisible(state);
    return;
  }

  if (name !== "ENTER") {
    return;
  }

  const answer = choices[state.selected];
  const elapsedSeconds = elapsedQuestionSeconds(state);
  pauseTimer(state);
  if (state.question) {
    const result = await sat.answerQuestion({
      attempts: state.attempts,
      question: state.question,
      answer,
      elapsedSeconds,
      answeredAt: new Date(),
    });
    state.lastAnswer = result.answer;
    state.lastCorrect = result.correct;
  }
  state.view = "review";
  state.activePane = "answers";
  state.answerScroll = 0;
}

async function handleHistoryKey(state: AppState, name: string): Promise<void> {
  const attempts = historyRows(state);
  if (name === "UP" || name === "k") {
    state.historyIndex = Math.max(0, state.historyIndex - 1);
  } else if (name === "DOWN" || name === "j") {
    state.historyIndex = Math.min(attempts.length - 1, state.historyIndex + 1);
  } else if (name === "ENTER" && attempts[state.historyIndex]) {
    state.view = "loading";
    resetPaneScroll(state);
    state.detailQuestion = await sat.findQuestion(attempts[state.historyIndex].question_id);
    state.view = "detail";
  }
}
