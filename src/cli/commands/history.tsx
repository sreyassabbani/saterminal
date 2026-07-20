import { z } from "zod";
import { loadAttempts } from "@/database/progress-repository.ts";
import { history } from "@/progress/history.ts";
import { Report } from "@/cli/components/report.tsx";
import { formatHistory } from "@/cli/reports/history.ts";
import { outputMode, reportColor, reportOptions } from "@/cli/report-options.ts";

export const description = "Show answered questions";
export const options = reportOptions.extend({
  wrong: z.boolean(),
  corrected: z.boolean(),
  limit: z.number().int().positive().optional(),
  since: z.string().optional(),
});
type Options = z.infer<typeof options>;

export default function HistoryCommand({ options }: { options: Options }) {
  const output = formatHistory(history(loadAttempts().values(), options), { mode: outputMode(options), color: reportColor(options) });
  return <Report raw={options.json}>{output}</Report>;
}
