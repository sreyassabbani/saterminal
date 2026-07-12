import { Box, Text, useInput } from "ink";
import { htmlToText } from "@/text/html.ts";
import type { Question } from "@/questions/question.ts";
import type { AnswerRecord } from "@/progress/attempt.ts";
import { Screen } from "@/tui/components/chrome.tsx";

export function ResultScreen({ question, result, onNext }: { question: Question; result: AnswerRecord; onNext: () => void }) {
  useInput((input, key) => { if (input === "n" || key.return) onNext(); });
  return (
    <Screen title="answer" detail={result.correct ? "correct" : "incorrect"} footer="enter/n next">
      <Text bold color={result.correct ? "green" : "red"}>{result.correct ? "CORRECT" : "INCORRECT"}</Text>
      <Text>Your answer: <Text bold>{result.answer}</Text> · Correct: <Text bold color="green">{question.correctAnswers.join(", ")}</Text></Text>
      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Explanation</Text>
        <Text>{htmlToText(question.explanation ?? "No explanation is available.")}</Text>
      </Box>
    </Screen>
  );
}
