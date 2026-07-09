import type { PracticeQuestion } from "../../types.ts";
import { elapsedQuestionSeconds, formatElapsed } from "../timer.ts";
import { paneLayout, paneViewportHeight } from "../layout.ts";
import { detailPaneRows, practiceAnswerPaneRows, reviewPaneRows } from "../pane-content.ts";
import { answerKeys, questionNeedsExternalDisplay, questionRows } from "../question.ts";
import type { AppState } from "../types.ts";
import { alternatePane, ensureRangeVisible, scrollBy, scrollPage, scrollToEdge, type PaneViewport } from "../viewport.ts";

export function handlePaneKey(state: AppState, name: string): boolean {
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

export function ensureSelectedAnswerVisible(state: AppState): void {
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

export function resetPaneScroll(state: AppState): void {
  state.questionScroll = 0;
  state.answerScroll = 0;
  state.activePane = "answers";
}

export function isScrollablePaneView(state: AppState): boolean {
  if (state.view !== "practice" && state.view !== "review" && state.view !== "detail") {
    return false;
  }

  const question = currentPaneQuestion(state);
  return Boolean(question && !questionNeedsExternalDisplay(question.detail));
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

function currentPaneQuestion(state: AppState): PracticeQuestion | undefined {
  return state.view === "detail" ? state.detailQuestion : state.question;
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
