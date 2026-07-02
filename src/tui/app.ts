import { defaultFocus } from "../focus.ts";
import { ensureStateFiles, loadAttempts, loadFocus } from "../state.ts";
import { handleKey } from "./input.ts";
import { createDocument, render } from "./render.ts";
import { term } from "./terminal.ts";
import type { AppState, KeyData } from "./types.ts";

export async function runTui(): Promise<void> {
  const state: AppState = {
    attempts: new Map(),
    skippedIds: new Set(),
    focus: defaultFocus,
    focusIndex: 1,
    focusColumn: 0,
    focusRow: 1,
    view: "focus",
    selected: 0,
    questionScroll: 0,
    elapsedMs: 0,
    timerPaused: false,
    timerHidden: false,
    historyIndex: 0,
  };

  term.fullscreen(true);
  term.hideCursor();
  const doc = createDocument();
  const tick = setInterval(() => {
    if (state.view === "practice" && !state.timerPaused) {
      render(doc, state);
    }
  }, 1000);

  const cleanup = () => {
    clearInterval(tick);
    doc.destroy();
    term.grabInput(false);
    term.hideCursor(false);
    term.fullscreen(false);
    term.processExit(0);
  };

  process.on("SIGINT", cleanup);
  term.on("resize", () => render(doc, state));
  term.on("key", async (name: string, _matches?: string[], data?: KeyData) => {
    try {
      if (name === "CTRL_C" || name === "q") {
        cleanup();
        return;
      }

      await handleKey(state, name, data);
      render(doc, state);
    } catch (error) {
      state.view = "error";
      state.error = error instanceof Error ? error.message : String(error);
      render(doc, state);
    }
  });

  try {
    await ensureStateFiles();
    state.attempts = await loadAttempts();
    state.focus = await loadFocus();
    state.focusIndex = 1;
    state.focusColumn = 0;
    state.focusRow = 1;
    state.view = "focus";
  } catch (error) {
    state.view = "error";
    state.error = error instanceof Error ? error.message : String(error);
  }

  render(doc, state);
}
