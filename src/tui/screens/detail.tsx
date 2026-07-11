import { Text, useInput } from "ink";
import { htmlToText } from "../../text/html.ts";
import type { Question } from "../../questions/question.ts";
import type { Attempt } from "../../progress/attempt.ts";
import { Screen } from "../components/chrome.tsx";

export function DetailScreen({ question, attempt, onBack }: { question: Question; attempt: Attempt; onBack: () => void }) {
  useInput((_input, key) => { if (key.escape) onBack(); });
  return (
    <Screen title="question details" detail={attempt.outcome} footer="esc back">
      <Text bold color={attempt.outcome === "incorrect" ? "red" : attempt.outcome === "corrected" ? "yellow" : "green"}>{attempt.outcome.toUpperCase()}</Text>
      <Text color="gray">{question.domain} · {question.skill} · difficulty {question.difficulty} · {question.id}</Text>
      <Text> </Text>
      <Text bold>Correct answer: <Text color="green">{question.correctAnswers.join(", ")}</Text></Text>
      <Text> </Text>
      <Text bold color="cyan">Explanation</Text>
      <Text>{htmlToText(question.explanation ?? "No explanation is available.")}</Text>
    </Screen>
  );
}
