const partialBlocks = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"] as const;

export type ProgressBar = {
  filled: string;
  empty: string;
};

export function progressBar(ratio: number, width: number): ProgressBar {
  const normalized = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const cells = Math.max(0, Math.floor(width));
  const exact = normalized * cells;
  const full = Math.floor(exact);
  const partial = Math.round((exact - full) * 8);

  if (cells === 0) {
    return { filled: "", empty: "" };
  }

  if (partial === 8 && full < cells) {
    return {
      filled: "█".repeat(full + 1),
      empty: "░".repeat(cells - full - 1),
    };
  }

  const partialBlock = full < cells ? partialBlocks[partial] : "";
  return {
    filled: `${"█".repeat(full)}${partialBlock}`,
    empty: "░".repeat(cells - full - (partialBlock ? 1 : 0)),
  };
}

export function progressBarText(ratio: number, width: number): string {
  const bar = progressBar(ratio, width);
  return `${bar.filled}${bar.empty}`;
}
