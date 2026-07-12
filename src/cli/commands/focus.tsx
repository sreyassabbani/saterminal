import { loadFocus } from "@/database/focus-repository.ts";
import { Report } from "@/cli/components/report.tsx";
import { formatFocus } from "@/cli/reports/focus.ts";
import { outputMode, reportColor, reportOptions, type ReportOptions } from "@/cli/report-options.ts";

export const description = "Show the current question focus";
export const options = reportOptions;

export default function FocusCommand({ options }: { options: ReportOptions }) {
  const output = formatFocus(loadFocus(), { mode: outputMode(options), color: reportColor(options) });
  return <Report raw={options.json}>{output}</Report>;
}
