import { loadAttempts } from "../../database/progress-repository.ts";
import { weaknesses } from "../../progress/weaknesses.ts";
import { Report } from "../components/report.tsx";
import { formatWeaknesses } from "../reports/weaknesses.ts";
import { outputMode, reportColor, reportOptions, type ReportOptions } from "../report-options.ts";

export const description = "Rank skills that need the most work";
export const options = reportOptions;

export default function WeakCommand({ options }: { options: ReportOptions }) {
  const output = formatWeaknesses(weaknesses(loadAttempts().values()), { mode: outputMode(options), color: reportColor(options) });
  return <Report raw={options.json}>{output}</Report>;
}
