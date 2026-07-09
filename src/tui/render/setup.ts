import { displayStateDir, stateDir } from "../../state.ts";
import { terminalSize } from "../kit.ts";
import { Frame } from "../frame.ts";
import type { AppState } from "../types.ts";
import { printWrappedAt, text } from "./shared.ts";

export function renderLoading(doc: Frame): void {
  text(doc, 0, 3, "Loading...");
}

export function renderSetup(doc: Frame): void {
  const { width } = terminalSize();
  const location = displayStateDir(stateDir);

  text(doc, 0, 3, "storage location", { bold: true });
  text(doc, 0, 5, "Sat saves progress, focus settings, summary stats, and the local question cache.", { color: "gray" }, width);
  text(doc, 0, 7, "Allow creating this directory?", { bold: true }, width);
  text(doc, 0, 9, location, { color: "cyan" }, width);
}

export function renderError(doc: Frame, state: AppState): void {
  text(doc, 0, 3, "Something went wrong.", { bold: true, color: "red" });
  printWrappedAt(doc, state.error ?? "Unknown error.", 0, 5, terminalSize().width - 1, terminalSize().height - 4);
}
