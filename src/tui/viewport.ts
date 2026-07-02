export type PaneId = "question" | "answers";

export type PaneViewport = {
  scroll: number;
  height: number;
  contentRows: number;
};

export function alternatePane(pane: PaneId): PaneId {
  return pane === "question" ? "answers" : "question";
}

export function maxScroll(viewport: PaneViewport): number {
  return Math.max(0, viewport.contentRows - viewport.height);
}

export function clampScroll(viewport: PaneViewport): number {
  return Math.max(0, Math.min(viewport.scroll, maxScroll(viewport)));
}

export function scrollBy(viewport: PaneViewport, delta: number): number {
  return clampScroll({ ...viewport, scroll: viewport.scroll + delta });
}

export function scrollPage(viewport: PaneViewport, direction: 1 | -1): number {
  return scrollBy(viewport, direction * Math.max(1, viewport.height - 1));
}

export function scrollToEdge(viewport: PaneViewport, edge: "top" | "bottom"): number {
  return edge === "top" ? 0 : maxScroll(viewport);
}

export function ensureRowVisible(viewport: PaneViewport, row: number): number {
  const scroll = clampScroll(viewport);
  if (row < scroll) {
    return clampScroll({ ...viewport, scroll: row });
  }

  const lastVisible = scroll + viewport.height - 1;
  if (row > lastVisible) {
    return clampScroll({ ...viewport, scroll: row - viewport.height + 1 });
  }

  return scroll;
}

export function ensureRangeVisible(viewport: PaneViewport, start: number, end: number): number {
  const scroll = clampScroll(viewport);
  const lastVisible = scroll + viewport.height - 1;

  if (start < scroll) {
    return clampScroll({ ...viewport, scroll: start });
  }

  if (end > lastVisible) {
    return clampScroll({ ...viewport, scroll: end - viewport.height + 1 });
  }

  return scroll;
}
