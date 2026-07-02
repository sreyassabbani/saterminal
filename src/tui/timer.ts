import type { AppState } from "./types.ts";

export function toggleTimer(state: AppState): void {
  if (state.timerPaused) {
    resumeTimer(state);
  } else {
    pauseTimer(state);
  }
}

export function pauseTimer(state: AppState): void {
  if (state.timerPaused || state.timerStartedAt === undefined) {
    return;
  }

  state.elapsedMs += Date.now() - state.timerStartedAt;
  state.timerStartedAt = undefined;
  state.timerPaused = true;
}

export function resumeTimer(state: AppState): void {
  if (!state.timerPaused || state.view !== "practice") {
    return;
  }

  state.timerStartedAt = Date.now();
  state.timerPaused = false;
}

export function elapsedQuestionSeconds(state: AppState): number {
  const activeMs = state.timerPaused || state.timerStartedAt === undefined ? 0 : Date.now() - state.timerStartedAt;
  return Math.max(0, Math.round((state.elapsedMs + activeMs) / 1000));
}

export function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function timerStatus(state: AppState): string {
  return state.view === "practice" && state.timerPaused ? " paused" : "";
}
