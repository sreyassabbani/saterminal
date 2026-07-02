import { terminalSize } from "./kit.ts";
import type { PaneLayout } from "./types.ts";

export const PANE_HEADER_Y = 2;
export const PANE_BODY_Y = 4;

export function paneLayout(): PaneLayout {
  const { width } = terminalSize();
  const gutter = 2;
  const usable = Math.max(40, width - gutter);
  const leftWidth = Math.max(20, Math.floor(usable / 2));
  const rightX = leftWidth + gutter;
  const rightWidth = Math.max(20, width - rightX);

  return {
    leftX: 0,
    leftWidth,
    rightX,
    rightWidth,
  };
}

export function paneViewportHeight(): number {
  return Math.max(1, terminalSize().height - 6);
}
