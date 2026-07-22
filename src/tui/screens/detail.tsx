import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Attempt, Outcome } from "@/progress/attempt.ts";
import type { Question } from "@/questions/question.ts";
import { formatDuration } from "@/text/duration.ts";
import { htmlToText } from "@/text/html.ts";
import { wrapText } from "@/text/wrap.ts";
import { PaneTitle, Screen } from "@/tui/components/chrome.tsx";
import {
  answerChoiceLayout,
  clampedScroll,
  QuestionContent,
  type ChoiceLine,
} from "@/tui/components/question-content.tsx";
import { useTerminalSize } from "@/tui/hooks/use-terminal-size.ts";

type DetailPane = "question" | "answers";

type DetailLine = ChoiceLine & {
  kind?: "metadata" | "answer" | "heading" | "explanation";
};

const outcomeColors: Record<Outcome, "red" | "yellow" | "green"> = {
  correct: "green",
  corrected: "yellow",
  incorrect: "red",
};

export function DetailScreen({ question, attempt, onBack }: { question: Question; attempt: Attempt; onBack: () => void }) {
  const { width, height } = useTerminalSize();
  const sideBySide = width >= 80;
  const paneWidth = sideBySide ? Math.floor((width - 3) / 2) : width;
  const viewportHeight = Math.max(5, height - 8);
  const pageSize = Math.max(4, viewportHeight - 2);
  const [activePane, setActivePane] = useState<DetailPane>("question");
  const [questionScroll, setQuestionScroll] = useState(0);
  const [answerScroll, setAnswerScroll] = useState(0);

  const scrollActivePane = (distance: number) => {
    const update = (current: number) => Math.max(0, current + distance);
    if (activePane === "question") setQuestionScroll(update);
    else setAnswerScroll(update);
  };

  useInput((input, key) => {
    if (key.escape) onBack();
    else if (key.tab || key.leftArrow || key.rightArrow) {
      setActivePane((current) => current === "question" ? "answers" : "question");
    } else if (key.upArrow || input === "k") scrollActivePane(-1);
    else if (key.downArrow || input === "j") scrollActivePane(1);
    else if (key.pageUp || input === "[") scrollActivePane(-pageSize);
    else if (key.pageDown || input === "]") scrollActivePane(pageSize);
  });

  const outcome = attempt.outcome.toUpperCase();

  return (
    <Screen
      title="question details"
      detail={<Text bold color={outcomeColors[attempt.outcome]}>{outcome}</Text>}
      footer="tab/←/→ pane · j/k line · [/] page · esc back"
    >
      <Box flexDirection={sideBySide ? "row" : "column"} gap={3}>
        {(sideBySide || activePane === "question") && (
          <Box width={paneWidth} flexDirection="column">
            <PaneTitle active={activePane === "question"}>Question</PaneTitle>
            <QuestionContent
              question={question}
              width={paneWidth}
              height={viewportHeight}
              scroll={questionScroll}
            />
          </Box>
        )}
        {(sideBySide || activePane === "answers") && (
          <Box width={paneWidth} flexDirection="column">
            <PaneTitle active={activePane === "answers"}>Answers</PaneTitle>
            <AnswerDetails
              question={question}
              attempt={attempt}
              width={paneWidth}
              height={viewportHeight}
              scroll={answerScroll}
            />
          </Box>
        )}
      </Box>
    </Screen>
  );
}

function AnswerDetails({ question, attempt, width, height, scroll }: {
  question: Question;
  attempt: Attempt;
  width: number;
  height: number;
  scroll: number;
}) {
  const choices = answerChoiceLayout(question, undefined, width).lines;
  const explanation = htmlToText(question.explanation ?? "No explanation is available.");
  const lines: DetailLine[] = [
    { text: `${question.domain} · ${question.skill} · difficulty ${question.difficulty} · ${question.id}`, kind: "metadata" },
    { text: `Answered in ${formatDuration(attempt.durationSeconds)}`, kind: "metadata" },
    { text: " " },
    { text: `Correct answer: ${question.correctAnswers.join(", ")}`, kind: "answer" },
    { text: " " },
    ...choices,
    { text: " " },
    { text: "Explanation", kind: "heading" },
    ...wrapText(explanation, width).map((text) => ({ text, kind: "explanation" as const })),
  ];
  const start = clampedScroll(scroll, lines.length, height);

  return (
    <Box flexDirection="column">
      {lines.slice(start, start + height).map((line, index) => {
        const choice = line.choiceIndex === undefined ? undefined : question.choices[line.choiceIndex];
        const correct = choice ? question.correctAnswers.includes(choice.key) : false;
        const color = line.kind === "metadata" ? "gray" : line.kind === "heading" ? "cyan" : line.kind === "answer" || correct ? "green" : undefined;
        return (
          <Text key={`${start}-${index}`} color={color} bold={line.kind === "heading" || line.kind === "answer" || correct}>
            {line.text}
          </Text>
        );
      })}
    </Box>
  );
}
