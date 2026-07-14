import { Box, Text } from "ink";
import { activity } from "@/progress/activity.ts";
import type { Attempt, AttemptEvent } from "@/progress/attempt.ts";
import { progressStatistics } from "@/progress/statistics.ts";
import { Screen } from "@/tui/components/chrome.tsx";

export function SummaryScreen({ attempts, events }: { attempts: Iterable<Attempt>; events: readonly AttemptEvent[] }) {
  const stats = progressStatistics(attempts);
  const currentActivity = activity(events);
  const rows = [["questions", stats.answered], ["tracked submissions", currentActivity.totalAnswers], ["correct", stats.correct], ["incorrect", stats.incorrect], ["corrected", stats.corrected], ["accuracy", `${Math.round(stats.accuracy * 100)}%`], ["average", `${stats.averageSeconds.toFixed(1)}s`], ["streak", `${currentActivity.streak} days`], ["today", currentActivity.todayCount], ["active days", currentActivity.activeDays]] as const;
  return (
    <Screen title="stats" detail={`${stats.mastered}/${stats.answered} mastered`}>
      <Box flexDirection="column">
        {rows.map(([label, value]) => <Text key={label}><Text color="gray">{label.padEnd(20)}</Text> <Text bold color={label === "incorrect" ? "red" : label === "corrected" ? "yellow" : "cyan"}>{value}</Text></Text>)}
      </Box>
    </Screen>
  );
}
