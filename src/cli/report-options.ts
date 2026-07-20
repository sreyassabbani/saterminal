import { z } from "zod";

export const reportOptions = z.object({
  plain: z.boolean(),
  json: z.boolean(),
  color: z.boolean().default(true),
});

export type ReportOptions = z.infer<typeof reportOptions>;

export function outputMode(options: ReportOptions): "pretty" | "plain" | "json" {
  if (options.plain && options.json) throw new Error("Choose either --plain or --json, not both.");
  return options.json ? "json" : options.plain ? "plain" : "pretty";
}

export function reportColor(options: ReportOptions): boolean {
  return options.color && process.env.NO_COLOR === undefined && process.stdout.isTTY;
}
