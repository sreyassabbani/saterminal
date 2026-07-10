import { option } from "pastel";
import { z } from "zod";

export const reportOptions = z.object({
  plain: z.boolean().describe(option({ description: "Use a compact plain-text layout" })),
  json: z.boolean().describe(option({ description: "Output machine-readable JSON" })),
  color: z.boolean().default(true).describe(option({ description: "Disable ANSI color" })),
});

export type ReportOptions = z.infer<typeof reportOptions>;

export function outputMode(options: ReportOptions): "pretty" | "plain" | "json" {
  if (options.plain && options.json) throw new Error("Choose either --plain or --json, not both.");
  return options.json ? "json" : options.plain ? "plain" : "pretty";
}

export function reportColor(options: ReportOptions): boolean {
  return options.color && process.env.NO_COLOR === undefined && process.stdout.isTTY;
}
