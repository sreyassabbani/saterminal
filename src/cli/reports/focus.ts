import { difficultyLabels, domainLabels, focusSummary, skillLabels } from "../../focus.ts";
import type { Focus } from "../../types.ts";
import { ansi, heading, muted, option, section, styleFor } from "../format/style.ts";
import type { FormatOptions, OutputFormat } from "../types.ts";

export function formatFocus(focus: Focus, format: OutputFormat, options: FormatOptions = {}): string {
  const style = styleFor(options);

  if (format === "json") {
    return JSON.stringify(focus);
  }

  if (format === "pretty") {
    return [
      heading("focus", style),
      muted(focusSummary(focus), style),
      "",
      section("difficulty", style),
      ...focus.difficulties.map((value) => option(value, difficultyLabels[value], ansi.yellow, style)),
      "",
      section("domains", style),
      ...focus.domains.map((value) => option(value, domainLabels[value], ansi.cyan, style)),
      "",
      section("skills", style),
      ...focus.skills.map((value) => option(value, skillLabels[value], ansi.green, style)),
    ].join("\n");
  }

  return [
    `difficulties: ${focus.difficulties.join(",")}`,
    `domains: ${focus.domains.join(",")}`,
    `skills: ${focus.skills.join(",")}`,
  ].join("\n");
}
