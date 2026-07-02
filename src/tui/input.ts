import { fetchPracticeQuestion, findQuestionByShortId } from "../api.ts";
import { recordAttempt, saveAttempts, saveFocus, saveSummary } from "../state.ts";
import { focusGrid, moveFocusGridPosition, normalizeFocusGridPosition, toggleFocusGridRow } from "./focus-grid.ts";
import {
  answerKeys,
  openExternalQuestion,
  questionNeedsExternalDisplay,
  questionPageSize,
} from "./question.ts";
import { historyRows } from "./history.ts";
import { elapsedQuestionSeconds, pauseTimer, resumeTimer, toggleTimer } from "./timer.ts";
import type { AppState, KeyData } from "./types.ts";

export function isPauseKey(name: string, data?: KeyData): boolean {
  if (name === " " || name.toUpperCase() === "SPACE") {
    return true;
  }

  if (data?.isCharacter && data.codepoint === 32) {
    return true;
  }

  if (data?.code === " ") {
    return true;
  }

  if (Buffer.isBuffer(data?.code) && data.code.toString("utf8") === " ") {
    return true;
  }

  return false;
}

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
    state.questionScroll = 0;
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

  if (state.view === "practice" || state.view === "review" || state.view === "detail") {
    if (name === "PAGE_DOWN" || name === "]") {
      state.questionScroll += questionPageSize();
      return;
    }
    if (name === "PAGE_UP" || name === "[") {
      state.questionScroll = Math.max(0, state.questionScroll - questionPageSize());
      return;
    }
    if (name === "HOME") {
      state.questionScroll = 0;
      return;
    }
  }

  if (state.view === "practice") {
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
    if (name === "UP" || name === "k") {
      state.selected = Math.max(0, state.selected - 1);
    } else if (name === "DOWN" || name === "j") {
      state.selected = Math.min(choices.length - 1, state.selected + 1);
    } else if (directChoice >= 0) {
      state.selected = directChoice;
    } else if (name === "ENTER") {
      const answer = choices[state.selected];
      const correct = state.question?.detail.correct_answer.includes(answer) ?? false;
      const elapsedSeconds = elapsedQuestionSeconds(state);
      state.lastAnswer = answer;
      state.lastCorrect = correct;
      pauseTimer(state);
      if (state.question) {
        recordAttempt(state.attempts, state.question.meta.questionId, correct, elapsedSeconds);
        await saveAttempts(state.attempts);
        await saveSummary(state.attempts);
      }
      state.view = "review";
    }
    return;
  }

  if (state.view === "review" && (name === "ENTER" || name === "n")) {
    await loadNextQuestion(state);
    return;
  }

  if (state.view === "history") {
    const attempts = historyRows(state);
    if (name === "UP" || name === "k") {
      state.historyIndex = Math.max(0, state.historyIndex - 1);
    } else if (name === "DOWN" || name === "j") {
      state.historyIndex = Math.min(attempts.length - 1, state.historyIndex + 1);
    } else if (name === "ENTER" && attempts[state.historyIndex]) {
      state.view = "loading";
      state.questionScroll = 0;
      state.detailQuestion = await findQuestionByShortId(attempts[state.historyIndex].question_id);
      state.view = "detail";
    }
    return;
  }

  if (state.view === "detail" && name === "ESCAPE") {
    state.view = "history";
  }
}

async function handleFocusKey(state: AppState, name: string, data?: KeyData): Promise<void> {
  const columns = focusGrid(state.focus);
  const position = normalizeFocusGridPosition(columns, { column: state.focusColumn, row: state.focusRow });
  state.focusColumn = position.column;
  state.focusRow = position.row;

  if (name === "UP" || name === "k") {
    const next = moveFocusGridPosition(columns, position, "up");
    state.focusColumn = next.column;
    state.focusRow = next.row;
    return;
  }

  if (name === "DOWN" || name === "j") {
    const next = moveFocusGridPosition(columns, position, "down");
    state.focusColumn = next.column;
    state.focusRow = next.row;
    return;
  }

  if (name === "LEFT" || name === "h") {
    const next = moveFocusGridPosition(columns, position, "left");
    state.focusColumn = next.column;
    state.focusRow = next.row;
    return;
  }

  if (name === "RIGHT" || name === "l") {
    const next = moveFocusGridPosition(columns, position, "right");
    state.focusColumn = next.column;
    state.focusRow = next.row;
    return;
  }

  if (name === "TAB") {
    const next = moveFocusGridPosition(columns, position, "next");
    state.focusColumn = next.column;
    state.focusRow = next.row;
    return;
  }

  if (name === "SHIFT_TAB") {
    const next = moveFocusGridPosition(columns, position, "previous");
    state.focusColumn = next.column;
    state.focusRow = next.row;
    return;
  }

  if (isPauseKey(name, data)) {
    const focus = toggleFocusGridRow(state.focus, position);
    if (focus !== state.focus) {
      state.focus = focus;
      state.nextQuestion = undefined;
      state.question = undefined;
      await saveFocus(state.focus);
    }
    return;
  }

  if (name === "ENTER") {
    state.nextQuestion = undefined;
    state.question = undefined;
    await loadNextQuestion(state);
  }
}

export async function loadNextQuestion(state: AppState): Promise<void> {
  state.view = "loading";
  state.question = await takeNextQuestion(state);
  state.selected = 0;
  state.questionScroll = 0;
  state.elapsedMs = 0;
  state.timerStartedAt = Date.now();
  state.timerPaused = false;
  state.lastAnswer = undefined;
  state.lastCorrect = undefined;
  state.view = "practice";
  cacheNextQuestion(state);
}

async function takeNextQuestion(state: AppState) {
  const cached = state.nextQuestion;
  state.nextQuestion = undefined;

  if (cached) {
    const question = await cached;
    if (question) {
      return question;
    }
  }

  return fetchPracticeQuestion(questionExclusions(state), state.focus);
}

function cacheNextQuestion(state: AppState): void {
  state.nextQuestion = fetchPracticeQuestion(questionExclusions(state), state.focus).catch(() => undefined);
}

function questionExclusions(state: AppState): string[] {
  return [
    ...state.attempts.keys(),
    ...state.skippedIds,
    ...(state.question ? [state.question.meta.questionId] : []),
  ];
}

function skipQuestion(state: AppState): void {
  if (state.question) {
    state.skippedIds.add(state.question.meta.questionId);
  }
}
