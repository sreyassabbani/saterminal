const partialBlocks = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const;

export type ProgressBar = {
  filled: string;
  partial: string;
  empty: string;
  fullCells: number;
  emptyCells: number;
};

export function progressBar(ratio: number, width: number): ProgressBar {
  const normalized = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const cells = Math.max(0, Math.floor(width));
  const exact = normalized * cells;
  const full = Math.floor(exact);
  const partial = Math.round((exact - full) * 8);

  if (cells === 0) {
    return { filled: "", partial: "", empty: "", fullCells: 0, emptyCells: 0 };
  }

  if (partial === 8 && full < cells) {
    const fullCells = full + 1;
    const emptyCells = cells - fullCells;
    return {
      filled: "█".repeat(fullCells),
      partial: "",
      empty: " ".repeat(emptyCells),
      fullCells,
      emptyCells,
    };
  }

  const partialBlock = full < cells ? partialBlocks[partial] : "";
  const emptyCells = cells - full - (partialBlock ? 1 : 0);
  return {
    filled: "█".repeat(full),
    partial: partialBlock,
    empty: " ".repeat(emptyCells),
    fullCells: full,
    emptyCells,
  };
}

export function progressBarText(ratio: number, width: number): string {
  const bar = progressBar(ratio, width);
  return `${bar.filled}${bar.partial}${bar.empty}`;
}
