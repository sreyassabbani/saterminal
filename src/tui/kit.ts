import terminalKit from "terminal-kit";

export const term = terminalKit.terminal;

export function terminalSize(): { width: number; height: number } {
  const width = Number.isFinite(term.width) ? term.width : 80;
  const height = Number.isFinite(term.height) ? term.height : 24;
  return { width, height };
}
