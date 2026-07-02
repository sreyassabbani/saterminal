import { wrapText } from "../text.ts";
import type { TextSegment } from "../text.ts";
import { term, gutter, terminalSize } from "./kit.ts";

export { term, gutter, terminalSize, contentBounds } from "./kit.ts";

export function line(y: number, value: string): void {
  term.moveTo(1, y)(value.slice(0, term.width - 1));
}

export function lineAt(x: number, y: number, width: number, value: string): void {
  term.moveTo(x, y)(value.slice(0, width));
}

export function lineAtColor(
  x: number,
  y: number,
  width: number,
  value: string,
  color: "cyan" | "green" | "red" | "yellow",
  bold = false,
): void {
  const output = value.slice(0, width);
  if (bold) {
    term.moveTo(x, y).bold[color](output);
  } else {
    term.moveTo(x, y)[color](output);
  }
}

export function paneLayout(): {
  leftX: number;
  leftWidth: number;
  rightX: number;
  rightWidth: number;
} {
  const { width } = terminalSize();
  const usable = Math.max(40, width - gutter);
  const leftWidth = Math.max(20, Math.floor(usable / 2));
  const rightX = leftWidth + gutter + 1;
  const rightWidth = Math.max(20, width - rightX);

  return {
    leftX: 1,
    leftWidth,
    rightX,
    rightWidth,
  };
}

export function printWrapped(value: string | undefined, y: number, maxY: number, bold = false): number {
  return printWrappedAt(value, 1, y, terminalSize().width - 4, maxY, bold);
}

export function printWrappedAt(
  value: string | undefined,
  x: number,
  y: number,
  width: number,
  maxY: number,
  bold = false,
): number {
  for (const row of wrapText(value ?? "", width)) {
    if (y > maxY) {
      lineAt(x, y, width, "...");
      return y + 1;
    }
    if (bold) {
      term.moveTo(x, y++).bold(row.slice(0, width));
    } else {
      lineAt(x, y++, width, row);
    }
  }

  return y;
}

export function renderStyledLine(
  x: number,
  y: number,
  width: number,
  segments: TextSegment[],
  forceBold = false,
): void {
  let col = 0;

  for (const segment of segments) {
    if (col >= width) {
      break;
    }

    const text = segment.text.slice(0, width - col);
    if (!text) {
      continue;
    }

    const bold = forceBold || segment.style.bold;
    const underline = segment.style.underline;
    let output = term.moveTo(x + col, y);
    if (bold && underline) {
      output = output.bold.underline;
    } else if (bold) {
      output = output.bold;
    } else if (underline) {
      output = output.underline;
    }
    output(text);
    col += text.length;
  }
}
