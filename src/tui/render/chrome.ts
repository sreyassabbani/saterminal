import { questionNeedsExternalDisplay } from "../question.ts";
import { elapsedQuestionSeconds, formatElapsed, timerStatus } from "../timer.ts";
import { terminalSize } from "../kit.ts";
import { Frame } from "../frame.ts";
import type { AppState } from "../types.ts";
import { text } from "./shared.ts";

export function renderPaused(doc: Frame): void {
  const { width, height } = terminalSize();
  const label = "PAUSED";
  text(doc, Math.max(0, Math.floor((width - label.length) / 2)), Math.max(0, Math.floor(height / 2)), label, { bold: true });
}

export function header(doc: Frame, state: AppState): void {
  const { width } = terminalSize();
  const answered = state.attempts.size;
  const mode = state.reviewMode ? "review queue" : "reading/writing";
  const timer = state.timerHidden ? "" : `  time ${formatElapsed(elapsedQuestionSeconds(state))}${timerStatus(state)}`;
  text(doc, 0, 0, "sat", { bold: true });
  text(doc, 7, 0, `${mode}  answered ${answered}${timer}`, { color: "gray" }, width - 7);
  text(doc, 0, 1, "-".repeat(width), { color: "gray" }, width);
}

export function footer(doc: Frame, state: AppState): void {
  const { width, height } = terminalSize();
  const controls = state.view === "setup"
    ? "y allow | n decline | q quit"
    : state.view === "practice"
    ? practiceControls(state)
    : state.view === "focus"
      ? "up/down or j/k row | tab/shift-tab group | space toggle | enter start | q quit"
    : state.view === "review"
      ? "tab pane | up/down/j/k scroll | pg/[ ] page | g/G edge | enter next | f focus | h history | q quit"
      : state.view === "history"
        ? "up/down or j/k move | enter open | f focus | p practice | s summary | q quit"
        : state.view === "detail"
          ? "tab pane | up/down/j/k scroll | pg/[ ] page | g/G edge | esc history | p practice | q quit"
          : state.view === "error"
            ? "r retry | q quit"
            : "p practice | h history | q quit";

  text(doc, 0, Math.max(0, height - 2), "-".repeat(width), { color: "gray" }, width);
  text(doc, 0, Math.max(0, height - 1), controls, { color: "gray" }, width);
}

function practiceControls(state: AppState): string {
  if (state.question && questionNeedsExternalDisplay(state.question.detail)) {
    return "space pause/resume | t timer | o open externally | n/x/enter skip | f focus | h history | s summary | q quit";
  }

  return "space pause/resume | t timer | tab pane | up/down/j/k move/scroll | pg/[ ] page | g/G edge | enter submit | q quit";
}
