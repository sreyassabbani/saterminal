import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Attempt } from "../../progress/attempt.ts";
import { history } from "../../progress/history.ts";
import { Screen } from "../components/chrome.tsx";
import { useTerminalSize } from "../hooks/use-terminal-size.ts";

export function HistoryScreen({ attempts, notice, onOpen }: { attempts: Iterable<Attempt>; notice?: string; onOpen: (attempt: Attempt) => void }) {
  const rows = history(attempts);
  const { height } = useTerminalSize();
  const [selected, setSelected] = useState(0);
  useInput((input, key) => {
    if (key.upArrow || input === "k") setSelected((value) => Math.max(0, value - 1));
    else if (key.downArrow || input === "j") setSelected((value) => Math.min(rows.length - 1, value + 1));
    else if (key.return && rows[selected]) onOpen(rows[selected]);
  });
  const visible = Math.max(5, height - 7);
  const start = Math.max(0, Math.min(selected - visible + 1, rows.length - visible));
  return (
    <Screen title="history" detail={`${rows.length} answered`} footer="j/k move · enter details · p practice · f focus · s stats · q quit">
      {notice ? <Text color="yellow">{notice}</Text> : null}
      {rows.length ? <Text color="gray">  question   result     skill  answered</Text> : <Text color="gray">No attempts yet.</Text>}
      <Box flexDirection="column">
        {rows.slice(start, start + visible).map((attempt, offset) => {
          const active = start + offset === selected;
          return <Text key={attempt.questionId} color={active ? "yellow" : attempt.outcome === "incorrect" ? "red" : attempt.outcome === "corrected" ? "yellow" : "green"} bold={active}>{active ? ">" : " "} {attempt.questionId.padEnd(10)} {attempt.outcome.padEnd(10)} {(attempt.skill ?? "-").padEnd(5)} {shortDate(attempt.answeredAt)}</Text>;
        })}
      </Box>
    </Screen>
  );
}

function shortDate(value: string): string { const date = new Date(value); return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }
