import terminalKit from "terminal-kit";

export const tk = terminalKit;
export const term = terminalKit.terminal;
export const gutter = 2;

export type TkDocument = InstanceType<typeof terminalKit.Document>;
export type TkColumnMenuMulti = InstanceType<typeof terminalKit.ColumnMenuMulti>;
export type TkWindow = InstanceType<typeof terminalKit.Window>;

export function terminalSize(): { width: number; height: number } {
  const width = Number.isFinite(term.width) ? term.width : 80;
  const height = Number.isFinite(term.height) ? term.height : 24;
  return { width, height };
}

export function contentBounds(): { x: number; y: number; width: number; height: number } {
  const { width, height } = terminalSize();
  return {
    x: 1,
    y: 4,
    width: Math.max(40, width),
    height: Math.max(10, height - 5),
  };
}

export function menuItem(content: string, value: string): { content: string; value: string } {
  return { content, value };
}
