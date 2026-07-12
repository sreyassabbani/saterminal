import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { AnswerRecord, Outcome } from "@/progress/attempt.ts";
import type { Difficulty, Question } from "@/questions/question.ts";
import { difficultyLabels, domainLabels, skillLabels } from "@/questions/taxonomy.ts";
import { formatDuration } from "@/text/duration.ts";
import { htmlToText } from "@/text/html.ts";
import { wrapText } from "@/text/wrap.ts";
import { PaneTitle, Screen } from "@/tui/components/chrome.tsx";
import { answerChoiceLayout, clampedScroll, QuestionContent, type ChoiceLine } from "@/tui/components/question-content.tsx";
import { useTerminalSize } from "@/tui/hooks/use-terminal-size.ts";

type ResultPane = "question" | "review";

type ResultScreenProps = {
  question: Question;
  result: AnswerRecord;
  onNext: () => void;
};

type ReviewLine = ChoiceLine & {
  kind?: "heading" | "explanation";
};

type ReviewContentProps = {
  question: Question;
  result: AnswerRecord;
  width: number;
  height: number;
  scroll: number;
};

const verdictColorMap: Record<Outcome, "red" | "yellow" | "green"> = {
  "correct": "green",
  "corrected": "yellow",
  "incorrect": "red",
};
const difficultyColorMap: Record<Difficulty, "red" | "yellow" | "green"> = {
  "E": "green",
  "M": "yellow",
  "H": "red",
};

export function ResultScreen({ question, result, onNext }: ResultScreenProps) {
  const { width, height } = useTerminalSize();
  const sideBySide = width >= 80;
  const paneWidth = sideBySide ? Math.floor((width - 3) / 2) : width;
  const viewportHeight = Math.max(5, height - 8);
  const summaryHeight = answerSummaryHeight(question, result, paneWidth);
  const reviewHeight = Math.max(5, viewportHeight - summaryHeight - 1);
  const pageSize = Math.max(4, viewportHeight - 2);
  const [activePane, setActivePane] = useState<ResultPane>("review");
  const [questionScroll, setQuestionScroll] = useState(0);
  const [reviewScroll, setReviewScroll] = useState(0);

  const scrollActivePane = (distance: number) => {
    const update = (current: number) => Math.max(0, current + distance);
    if (activePane === "question") setQuestionScroll(update);
    else setReviewScroll(update);
  };

  useInput((input, key) => {
    if (input === "n" || key.return) onNext();
    else if (key.tab || key.leftArrow || key.rightArrow) {
      setActivePane((current) => current === "question" ? "review" : "question");
    } else if (key.upArrow || input === "k") scrollActivePane(-1);
    else if (key.downArrow || input === "j") scrollActivePane(1);
    else if (key.pageUp || input === "[") scrollActivePane(-pageSize);
    else if (key.pageDown || input === "]") scrollActivePane(pageSize);
  });

  const verdict = result.attempt.outcome.toUpperCase();
  const verdictColor = verdictColorMap[result.attempt.outcome];

  return (
    <Screen
      title="answer"
      detail={<Text bold color={verdictColor}>{verdict}</Text>}
      footer="tab/←/→ pane · j/k line · [/] page · enter/n next"
    >
      <Box flexDirection={sideBySide ? "row" : "column"} gap={3}>
        {(sideBySide || activePane === "question") && (
          <Box width={paneWidth} flexDirection="column">
            <PaneTitle active={activePane === "question"}>Question</PaneTitle>
            <QuestionContent question={question} width={paneWidth} height={viewportHeight} scroll={questionScroll} />
          </Box>
        )}
        {(sideBySide || activePane === "review") && (
          <Box width={paneWidth} flexDirection="column">

            <PaneTitle active={activePane === "review"}>Answer & Explanation</PaneTitle>

            <Box marginTop={1}>
              <AnswerSummary question={question} result={result} />
            </Box>

            <Box marginTop={1}>
              <ReviewContent
                question={question}
                result={result}
                width={paneWidth}
                height={reviewHeight}
                scroll={reviewScroll}
              />
            </Box>

          </Box>
        )}
      </Box>
    </Screen>
  );
}

function AnswerSummary({ question, result }: { question: Question; result: AnswerRecord }) {
  return (
    <Box flexDirection="column" gap={1}>
      <Text>
        Selected: <Text bold color={result.correct ? "green" : "red"}>{result.answer}</Text>
      </Text>

      <Text>
        Correct: <Text bold color="green">{question.correctAnswers.join(", ")}</Text>
      </Text>

      <Text>
        Time: <Text bold color="cyan">{formatDuration(result.attempt.durationSeconds)}</Text>
      </Text>

      <Text>
        Difficulty: <Text bold color={difficultyColorMap[question.difficulty]}>{difficultyLabels[question.difficulty]}</Text>
      </Text>

      <Text>
        <Text color="magenta">{question.domain}  {domainLabels[question.domain]}</Text>
        <Text>  ·  </Text><Text color="blue">{question.skill}  {skillLabels[question.skill]}</Text>
        <Text>  </Text><Text color="gray">({question.id})</Text>
      </Text>
    </Box>
  );
}

function ReviewContent({ question, result, width, height, scroll }: ReviewContentProps) {
  const selected = question.choices.findIndex((choice) => choice.key === result.answer);
  const choiceLines = answerChoiceLayout(question, selected, width).lines;
  const explanation = htmlToText(question.explanation ?? "No explanation is available.");
  const lines: ReviewLine[] = [
    ...choiceLines,
    { text: " " },
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
        const chosen = choice?.key === result.answer;
        const color = line.kind === "heading" ? "cyan" : correct ? "green" : chosen ? "red" : undefined;
        return (
          <Text key={`${start}-${index}`} color={color} bold={line.kind === "heading" || correct || chosen}>
            {line.text}
          </Text>
        );
      })}
    </Box>
  );
}

function answerSummaryHeight(question: Question, result: AnswerRecord, width: number): number {
  const lines = [
    `Selected: ${result.answer}`,
    `Correct: ${question.correctAnswers.join(", ")}`,
    `Time: ${formatDuration(result.attempt.durationSeconds)}`,
    `Difficulty: ${difficultyLabels[question.difficulty]}`,
    `${question.domain}  ${domainLabels[question.domain]}  ·  ${question.skill}  ${skillLabels[question.skill]}  (${question.id})`,
  ];
  return lines.reduce((height, line) => height + Math.max(1, Math.ceil(Bun.stringWidth(line) / width)), 0) + 4;
}
