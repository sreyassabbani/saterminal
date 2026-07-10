import { loadAttemptEvents, loadAttempts } from "../../database/progress-repository.ts";
import { activity } from "../../progress/activity.ts";
import { progressStatistics } from "../../progress/statistics.ts";
import { Report } from "../components/report.tsx";
import { formatStats } from "../format-reports.ts";
import { outputMode, reportColor, reportOptions, type ReportOptions } from "../report-options.ts";

export const description = "Show progress, streak, and recent activity";
export const options = reportOptions;

export default function StatsCommand({ options }: { options: ReportOptions }) {
  const attempts = loadAttempts();
  const output = formatStats(progressStatistics(attempts.values()), activity(loadAttemptEvents()), { mode: outputMode(options), color: reportColor(options) });
  return <Report raw={options.json}>{output}</Report>;
}
