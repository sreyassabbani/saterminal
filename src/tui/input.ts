import { fetchPracticeQuestion, findQuestionByShortId } from "../api.ts";
import { appendAttemptEvent, recordAttempt, saveAttempts, saveFocus, saveSummary } from "../state.ts";
import { focusGrid, moveFocusGridPosition, normalizeFocusGridPosition, toggleFocusGridRow } from "./focus-grid.ts";
import {
  answerKeys,
  openExternalQuestion,
  questionNeedsExternalDisplay,
  questionRows,
} from "./question.ts";
import { historyRows } from "./history.ts";
import { elapsedQuestionSeconds, formatElapsed, pauseTimer, resumeTimer, toggleTimer } from "./timer.ts";
import { paneLayout, paneViewportHeight } from "./layout.ts";
import { detailPaneRows, practiceAnswerPaneRows, reviewPaneRows } from "./pane-content.ts";
import { alternatePane, ensureRangeVisible, scrollBy, scrollPage, scrollToEdge, type PaneViewport } from "./viewport.ts";
import type { AppState, KeyData } from "./types.ts";
import type { PracticeQuestion } from "../types.ts";

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
    } else if (name === "ENTER") {
      const answer = choices[state.selected];
      const correct = state.question?.detail.correct_answer.includes(answer) ?? false;
      const elapsedSeconds = elapsedQuestionSeconds(state);
      state.lastAnswer = answer;
      state.lastCorrect = correct;
      pauseTimer(state);
      if (state.question) {
        const answeredAt = new Date();
        recordAttempt(state.attempts, state.question.meta.questionId, correct, elapsedSeconds, answeredAt, state.question.meta);
        await appendAttemptEvent(state.question.meta, correct, elapsedSeconds, answeredAt);
        await saveAttempts(state.attempts);
        await saveSummary(state.attempts);
      }
      state.view = "review";
      state.activePane = "answers";
      state.answerScroll = 0;
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
      resetPaneScroll(state);
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

  return fetchPracticeQuestion(questionExclusions(state), state.focus);
}

async function takeReviewQuestion(state: AppState): Promise<PracticeQuestion | undefined> {
  while (state.reviewQuestionIds && state.reviewQuestionIds.length > 0) {
    const id = state.reviewQuestionIds.shift();
    if (!id) {
      continue;
    }

    const question = await findQuestionByShortId(id);
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

function handlePaneKey(state: AppState, name: string): boolean {
  if (name === "TAB" || name === "SHIFT_TAB") {
    state.activePane = alternatePane(state.activePane);
    return true;
  }

  if (state.view === "practice" && state.activePane === "answers" && (name === "UP" || name === "k" || name === "DOWN" || name === "j")) {
    moveSelectedAnswer(state, name === "UP" || name === "k" ? -1 : 1);
    return true;
  }

  if (name === "UP" || name === "k") {
    scrollActivePaneBy(state, -1);
    return true;
  }

  if (name === "DOWN" || name === "j") {
    scrollActivePaneBy(state, 1);
    return true;
  }

  if (name === "PAGE_UP" || name === "[") {
    scrollActivePanePage(state, -1);
    return true;
  }

  if (name === "PAGE_DOWN" || name === "]") {
    scrollActivePanePage(state, 1);
    return true;
  }

  if (name === "HOME" || name === "g") {
    scrollActivePaneToEdge(state, "top");
    return true;
  }

  if (name === "END" || name === "G") {
    scrollActivePaneToEdge(state, "bottom");
    return true;
  }

  return false;
}

function moveSelectedAnswer(state: AppState, delta: number): void {
  const choices = answerKeys(state.question);
  if (choices.length === 0) {
    return;
  }

  state.selected = Math.max(0, Math.min(choices.length - 1, state.selected + delta));
  ensureSelectedAnswerVisible(state);
}

function scrollActivePaneBy(state: AppState, delta: number): void {
  setActivePaneScroll(state, scrollBy(activePaneViewport(state), delta));
}

function scrollActivePanePage(state: AppState, direction: 1 | -1): void {
  setActivePaneScroll(state, scrollPage(activePaneViewport(state), direction));
}

function scrollActivePaneToEdge(state: AppState, edge: "top" | "bottom"): void {
  setActivePaneScroll(state, scrollToEdge(activePaneViewport(state), edge));
}

function activePaneViewport(state: AppState): PaneViewport {
  const panes = paneLayout();
  const height = paneViewportHeight();

  if (state.activePane === "question") {
    const question = currentPaneQuestion(state);
    return {
      scroll: state.questionScroll,
      height,
      contentRows: question ? questionRows(question.detail, panes.leftWidth).length : 0,
    };
  }

  return {
    scroll: state.answerScroll,
    height,
    contentRows: rightPaneRows(state, panes.rightWidth).length,
  };
}

function setActivePaneScroll(state: AppState, scroll: number): void {
  if (state.activePane === "question") {
    state.questionScroll = scroll;
  } else {
    state.answerScroll = scroll;
  }
}

function ensureSelectedAnswerVisible(state: AppState): void {
  if (!state.question) {
    return;
  }

  const panes = paneLayout();
  const content = practiceAnswerPaneRows(state.question, state.selected, panes.rightWidth);
  const choice = content.choices[state.selected];
  if (!choice) {
    return;
  }

  state.answerScroll = ensureRangeVisible(
    {
      scroll: state.answerScroll,
      height: paneViewportHeight(),
      contentRows: content.rows.length,
    },
    choice.start,
    choice.end,
  );
}

function resetPaneScroll(state: AppState): void {
  state.questionScroll = 0;
  state.answerScroll = 0;
  state.activePane = "answers";
}

function currentPaneQuestion(state: AppState): PracticeQuestion | undefined {
  return state.view === "detail" ? state.detailQuestion : state.question;
}

function isScrollablePaneView(state: AppState): boolean {
  if (state.view !== "practice" && state.view !== "review" && state.view !== "detail") {
    return false;
  }

  const question = currentPaneQuestion(state);
  return Boolean(question && !questionNeedsExternalDisplay(question.detail));
}

function rightPaneRows(state: AppState, width: number) {
  if (state.view === "practice" && state.question) {
    return practiceAnswerPaneRows(state.question, state.selected, width).rows;
  }

  if (state.view === "review" && state.question) {
    return reviewPaneRows(state.question, {
      lastAnswer: state.lastAnswer,
      lastCorrect: state.lastCorrect,
      elapsed: formatElapsed(elapsedQuestionSeconds(state)),
    }, width);
  }

  if (state.view === "detail" && state.detailQuestion) {
    return detailPaneRows(state.detailQuestion, state.attempts.get(state.detailQuestion.meta.questionId), width);
  }

  return [];
}
