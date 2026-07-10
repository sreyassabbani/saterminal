import { loadFocus } from "../../database/focus-repository.ts";
import { Report } from "../components/report.tsx";
import { formatFocus } from "../reports/focus.ts";
import { outputMode, reportColor, reportOptions, type ReportOptions } from "../report-options.ts";

export const description = "Show the current question focus";
export const options = reportOptions;

export default function FocusCommand({ options }: { options: ReportOptions }) {
  const output = formatFocus(loadFocus(), { mode: outputMode(options), color: reportColor(options) });
  return <Report raw={options.json}>{output}</Report>;
}
