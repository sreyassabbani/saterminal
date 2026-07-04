import { defaultFocus } from "../focus.ts";
import { questionBankStatus } from "../question-bank.ts";
import { ensureStateFiles, loadAttempts, loadFocus, stateDirExists } from "../state.ts";
import { handleKey, loadNextQuestion } from "./input.ts";
import { createFrameRenderer, render } from "./render.ts";
import { term } from "./kit.ts";
import type { AppState, KeyData } from "./types.ts";
import type { Attempt } from "../types.ts";

export type TuiOptions = {
  mode?: "practice" | "review";
};

async function loadPersistedState(state: AppState, options: TuiOptions = {}): Promise<void> {
  await ensureStateFiles();
  state.attempts = await loadAttempts();
  state.focus = await loadFocus();
  state.focusIndex = 1;
  state.focusColumn = 0;
  state.focusRow = 1;
  state.notice = undefined;

  const bank = await questionBankStatus();
  if (bank.exists && bank.questions) {
    state.notice = `${bank.questions} questions loaded.`;
  }

  if (options.mode === "review") {
    state.reviewMode = true;
    state.reviewQuestionIds = reviewQuestionIds(state.attempts);
    if (state.reviewQuestionIds.length === 0) {
      state.notice = "No review queue yet. Miss or correct a question first.";
      state.view = "history";
      return;
    }

    await loadNextQuestion(state);
    return;
  }

  state.view = "focus";
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const state: AppState = {
    attempts: new Map(),
    skippedIds: new Set(),
    reviewMode: options.mode === "review",
    focus: defaultFocus,
    focusIndex: 1,
    focusColumn: 0,
    focusRow: 1,
    view: "loading",
    selected: 0,
    questionScroll: 0,
    answerScroll: 0,
    activePane: "answers",
    elapsedMs: 0,
    timerPaused: false,
    timerHidden: false,
    historyIndex: 0,
  };

  term.fullscreen(true);
  term.hideCursor();
  term.grabInput(true);
  const renderer = createFrameRenderer();
  renderer.clear();
  const tick = setInterval(() => {
    if (state.view === "practice" && !state.timerPaused) {
      render(renderer, state);
    }
  }, 1000);

  const cleanup = () => {
    clearInterval(tick);
    term.grabInput(false);
    term.hideCursor(false);
    term.fullscreen(false);
    term.processExit(0);
  };

  process.on("SIGINT", cleanup);
  term.on("resize", () => {
    renderer.clear();
    render(renderer, state);
  });

  try {
    if (await stateDirExists()) {
      await loadPersistedState(state, options);
    } else {
      state.view = "setup";
    }
  } catch (error) {
    state.view = "error";
    state.error = error instanceof Error ? error.message : String(error);
  }

  render(renderer, state);

  term.on("key", async (name: string, _matches?: string[], data?: KeyData) => {
    try {
      if (name === "CTRL_C" || name === "q") {
        cleanup();
        return;
      }

      if (state.view === "setup") {
        if (name === "y" || name === "ENTER") {
          await loadPersistedState(state, options);
        } else if (name === "n") {
          cleanup();
          return;
        }

        render(renderer, state);
        return;
      }

      await handleKey(state, name, data);
      render(renderer, state);
    } catch (error) {
      state.view = "error";
      state.error = error instanceof Error ? error.message : String(error);
      render(renderer, state);
    }
  });
}

function reviewQuestionIds(attempts: Map<string, Attempt>): string[] {
  return [...attempts.values()]
    .filter((attempt) => attempt.outcome === "incorrect" || attempt.outcome === "corrected")
    .sort((a, b) => reviewPriority(a) - reviewPriority(b) || a.updated_at.localeCompare(b.updated_at))
    .map((attempt) => attempt.question_id);
}

function reviewPriority(attempt: Attempt): number {
  return attempt.outcome === "incorrect" ? 0 : 1;
}
