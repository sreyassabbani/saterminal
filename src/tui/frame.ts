import type { Terminal } from "terminal-kit";

export type TextAttr = Record<string, unknown>;

type FrameCell = {
  char: string;
  attr: TextAttr;
};

export type FrameRun = {
  x: number;
  text: string;
  attr: TextAttr;
};

export type FrameOutput = {
  clear(): void;
  moveTo(x: number, y: number): void;
  eraseLineAfter(): void;
  reset(): void;
  write(value: string, attr?: TextAttr): void;
};

const emptyAttr: TextAttr = {};

export class Frame {
  readonly rows: FrameCell[][];

  constructor(readonly width: number, readonly height: number) {
    this.rows = Array.from({ length: height }, () => []);
  }

  writeText(x: number, y: number, value: string, attr: TextAttr = {}, width = this.width - x): void {
    if (y < 0 || y >= this.height || x >= this.width || width <= 0) {
      return;
    }

    const start = Math.max(0, x);
    const content = truncate(value, width);
    if (!content) {
      return;
    }

    const row = this.rows[y];
    const chars = [...content].slice(Math.max(0, -x), Math.max(0, -x) + this.width - start);
    for (const [offset, char] of chars.entries()) {
      row[start + offset] = { char, attr };
    }
  }

  rowRuns(y: number): FrameRun[] {
    const row = this.rows[y] ?? [];
    const runs: FrameRun[] = [];
    let x = 0;

    while (x < this.width) {
      while (x < this.width && cellAt(row, x).char === " ") {
        x++;
      }

      if (x >= this.width) {
        break;
      }

      const start = x;
      const attr = cellAt(row, x).attr;
      const key = attrKey(attr);
      const chars: string[] = [];

      while (x < this.width && attrKey(cellAt(row, x).attr) === key) {
        chars.push(cellAt(row, x).char);
        x++;
      }

      const text = chars.join("").trimEnd();
      if (text) {
        runs.push({ x: start, text, attr });
      }
    }

    return runs;
  }

  rowKey(y: number): string {
    return this.rowRuns(y)
      .map((run) => `${run.x}:${attrKey(run.attr)}:${run.text}`)
      .join("\u001f");
  }
}

export class FrameRenderer {
  private previous?: {
    width: number;
    height: number;
    rowKeys: string[];
  };
  private cleared = false;

  constructor(private readonly output: FrameOutput) {}

  clear(): void {
    this.previous = undefined;
    this.cleared = true;
    this.output.reset();
    this.output.clear();
  }

  draw(frame: Frame): void {
    const rowKeys = Array.from({ length: frame.height }, (_, y) => frame.rowKey(y));
    const force = !this.previous || this.previous.width !== frame.width || this.previous.height !== frame.height;
    if (force && !this.cleared) {
      this.output.reset();
      this.output.clear();
    }

    const previous = force ? undefined : this.previous;
    let changed = false;
    for (let y = 0; y < frame.height; y++) {
      if (previous && previous.rowKeys[y] === rowKeys[y]) {
        continue;
      }
      if (!previous && !rowKeys[y]) {
        continue;
      }

      this.output.moveTo(1, y + 1);
      if (previous) {
        this.output.reset();
        this.output.eraseLineAfter();
      }

      for (const run of frame.rowRuns(y)) {
        this.output.moveTo(run.x + 1, y + 1);
        this.output.write(run.text, run.attr);
      }
      changed = true;
    }

    if (changed) {
      this.output.reset();
    }
    this.previous = { width: frame.width, height: frame.height, rowKeys };
    this.cleared = false;
  }
}

type StyledTerminal = Terminal & Record<string, Terminal>;

export class TerminalFrameOutput implements FrameOutput {
  constructor(private readonly terminal: Terminal) {}

  clear(): void {
    this.terminal.clear();
  }

  moveTo(x: number, y: number): void {
    this.terminal.moveTo(x, y);
  }

  eraseLineAfter(): void {
    this.terminal.eraseLineAfter();
  }

  reset(): void {
    this.terminal.styleReset();
  }

  write(value: string, attr: TextAttr = {}): void {
    let output = this.terminal as StyledTerminal;

    if (attr.bold) {
      output = output.bold as StyledTerminal;
    }
    if (attr.underline) {
      output = output.underline as StyledTerminal;
    }
    if (attr.italic) {
      output = output.italic as StyledTerminal;
    }

    const color = typeof attr.color === "string" ? attr.color : undefined;
    if (color && typeof output[color] === "function") {
      output = output[color] as StyledTerminal;
    }

    output(value);
  }
}

export function truncate(value: string, width: number): string {
  const chars = [...value];
  if (chars.length <= width) {
    return value;
  }
  if (width <= 1) {
    return chars.slice(0, width).join("");
  }
  return `${chars.slice(0, width - 1).join("")}…`;
}

function cellAt(row: FrameCell[], x: number): FrameCell {
  return row[x] ?? { char: " ", attr: emptyAttr };
}

function attrKey(attr: TextAttr): string {
  return Object.keys(attr)
    .sort()
    .map((key) => `${key}:${String(attr[key])}`)
    .join(";");
}
