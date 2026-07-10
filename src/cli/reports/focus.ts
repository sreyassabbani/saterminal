import type { Focus } from "../../questions/focus.ts";
import { selectedDomains } from "../../questions/focus.ts";
import { difficultyLabels, domainLabels, skillLabels } from "../../questions/taxonomy.ts";
import { ansi, paint, type FormatSettings } from "./terminal-format.ts";

export function formatFocus(focus: Focus, settings: FormatSettings): string {
  const domains = selectedDomains(focus);
  if (settings.mode === "json") return JSON.stringify({ ...focus, domains });
  if (settings.mode === "plain") return `difficulties: ${focus.difficulties.join(",")}\ndomains: ${domains.join(",")}\nskills: ${focus.skills.join(",")}`;
  return [
    paint("focus", settings, ansi.bold, ansi.cyan),
    paint(`${focus.skills.length} skills · ${focus.difficulties.join(",")} · ${domains.length} domains`, settings, ansi.gray),
    "", paint("difficulty", settings, ansi.bold),
    ...focus.difficulties.map((value) => `  ${paint(value.padEnd(3), settings, ansi.yellow, ansi.bold)} ${difficultyLabels[value]}`),
    "", paint("domains", settings, ansi.bold),
    ...domains.map((value) => `  ${paint(value.padEnd(3), settings, ansi.cyan, ansi.bold)} ${domainLabels[value]}`),
    "", paint("skills", settings, ansi.bold),
    ...focus.skills.map((value) => `  ${paint(value.padEnd(3), settings, ansi.green, ansi.bold)} ${skillLabels[value]}`),
  ].join("\n");
}
