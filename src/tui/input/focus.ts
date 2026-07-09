import * as sat from "../../sat/index.ts";
import { focusGrid, moveFocusGridPosition, normalizeFocusGridPosition, toggleFocusGridRow } from "../focus-grid.ts";
import type { AppState, KeyData } from "../types.ts";
import { isPauseKey } from "./keys.ts";
import { loadNextQuestion } from "./question-flow.ts";

export async function handleFocusKey(state: AppState, name: string, data?: KeyData): Promise<void> {
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
      await sat.saveFocus(state.focus);
    }
    return;
  }

  if (name === "ENTER") {
    state.nextQuestion = undefined;
    state.question = undefined;
    await loadNextQuestion(state);
  }
}
