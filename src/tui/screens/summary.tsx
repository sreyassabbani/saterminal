import { Box, Text } from "ink";
import type { Attempt } from "../../progress/attempt.ts";
import { progressStatistics } from "../../progress/statistics.ts";
import { Screen } from "../components/chrome.tsx";

export function SummaryScreen({ attempts }: { attempts: Iterable<Attempt> }) {
  const stats = progressStatistics(attempts);
  const rows = [["answered", stats.answered], ["correct", stats.correct], ["incorrect", stats.incorrect], ["corrected", stats.corrected], ["accuracy", `${Math.round(stats.accuracy * 100)}%`], ["average", `${stats.averageSeconds.toFixed(1)}s`]] as const;
  return (
    <Screen title="stats" detail={`${stats.mastered}/${stats.answered} mastered`}>
      <Box flexDirection="column">
        {rows.map(([label, value]) => <Text key={label}><Text color="gray">{label.padEnd(12)}</Text> <Text bold color={label === "incorrect" ? "red" : label === "corrected" ? "yellow" : "cyan"}>{value}</Text></Text>)}
      </Box>
    </Screen>
  );
}
