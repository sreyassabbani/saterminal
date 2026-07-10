import { option } from "pastel";
import { z } from "zod";
import { loadAttempts } from "../../database/progress-repository.ts";
import { history } from "../../progress/history.ts";
import { Report } from "../components/report.tsx";
import { formatHistory } from "../reports/history.ts";
import { outputMode, reportColor, reportOptions } from "../report-options.ts";

export const description = "Show answered questions";
export const options = reportOptions.extend({
  wrong: z.boolean().describe(option({ description: "Show currently missed questions" })),
  corrected: z.boolean().describe(option({ description: "Show corrected questions" })),
  limit: z.number().int().positive().optional().describe(option({ description: "Limit rows", valueDescription: "count" })),
  since: z.string().optional().describe(option({ description: "Show rows since an ISO date, 7d, or 2w", valueDescription: "when" })),
});
type Options = z.infer<typeof options>;

export default function HistoryCommand({ options }: { options: Options }) {
  const output = formatHistory(history(loadAttempts().values(), options), { mode: outputMode(options), color: reportColor(options) });
  return <Report raw={options.json}>{output}</Report>;
}
