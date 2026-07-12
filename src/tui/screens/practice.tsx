import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { openQuestionPage } from "@/questions/practice-sat.ts";
import type { Question } from "@/questions/question.ts";
import { hasHtmlTable } from "@/text/html.ts";
import { formatDuration } from "@/text/duration.ts";
import {
  AnswerChoices,
  answerChoiceLayout,
  QuestionContent,
  revealRange,
} from "@/tui/components/question-content.tsx";
import { Screen } from "@/tui/components/chrome.tsx";
import { useTerminalSize } from "@/tui/hooks/use-terminal-size.ts";

type PracticePane = "question" | "answers";

type PracticeScreenProps = {
  question: Question;
  onAnswer: (answer: string, duration: number) => void;
  onSkip: () => void;
};

type QuestionPaneProps = {
  active: boolean;
  question: Question;
  width: number;
  height: number;
  scroll: number;
};

type AnswerPaneProps = QuestionPaneProps & {
  selected: number;
};

export function PracticeScreen({ question, onAnswer, onSkip }: PracticeScreenProps) {
  const { width, height } = useTerminalSize();
  const sideBySide = width >= 80;
  const paneWidth = sideBySide ? Math.floor((width - 3) / 2) : width;
  const viewportHeight = Math.max(5, height - 8);
  const pageSize = Math.max(4, viewportHeight - 2);
  const [activePane, setActivePane] = useState<PracticePane>("question");
  const [selected, setSelected] = useState(0);
  const [questionScroll, setQuestionScroll] = useState(0);
  const [answerScroll, setAnswerScroll] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const unsupported = hasHtmlTable(
    question.passage,
    question.prompt,
    question.explanation,
    ...question.choices.map((choice) => choice.content),
  );

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    const range = answerChoiceLayout(question, selected, paneWidth).ranges[selected];
    setAnswerScroll((current) => revealRange(current, viewportHeight, range));
  }, [paneWidth, question, selected, viewportHeight]);

  const scrollActivePane = (distance: number) => {
    const update = (current: number) => Math.max(0, current + distance);
    if (activePane === "question") setQuestionScroll(update);
    else setAnswerScroll(update);
  };

  useInput((input, key) => {
    if (input === " ") setPaused((value) => !value);
    else if (input === "t") setTimerVisible((value) => !value);
    else if (unsupported && input === "o") openQuestionPage(question);
    else if (unsupported && (input === "n" || input === "x" || key.return)) onSkip();
    else if (unsupported) return;
    else if (key.tab || key.leftArrow || key.rightArrow) {
      setActivePane((current) => current === "question" ? "answers" : "question");
    } else if (key.upArrow || input === "k") {
      setSelected((value) => Math.max(0, value - 1));
      setActivePane("answers");
    } else if (key.downArrow || input === "j") {
      setSelected((value) => Math.min(question.choices.length - 1, value + 1));
      setActivePane("answers");
    } else if (key.pageUp || input === "[") scrollActivePane(-pageSize);
    else if (key.pageDown || input === "]") scrollActivePane(pageSize);
    else if (key.return && question.choices[selected]) onAnswer(question.choices[selected].key, elapsed);
    else {
      const direct = question.choices.findIndex((choice) => choice.key.toLowerCase() === input.toLowerCase());
      if (direct >= 0) {
        setSelected(direct);
        setActivePane("answers");
      }
    }
  });

  const timer = timerVisible ? (
    <Text bold color={paused ? "yellow" : "cyan"}>
      {formatDuration(elapsed)}{paused ? "  PAUSED" : ""}
    </Text>
  ) : <Text color="gray">timer hidden</Text>;

  const footer = unsupported
    ? "o open · n/x/enter skip · space pause · t timer"
    : "j/k or A-D choose · enter submit · tab/←/→ pane · [/] scroll · space pause · t timer";

  return (
    <Screen title="practice" detail={timer} footer={footer}>
      {unsupported ? (
        <Box flexDirection="column" paddingTop={1}>
          <Text bold color="yellow">This question contains a table that needs a browser.</Text>
          <Text>Press o to open it, then answer there or skip it here.</Text>
        </Box>
      ) : (
        <Box flexDirection={sideBySide ? "row" : "column"} gap={3}>
          {(sideBySide || activePane === "question") && (
            <QuestionPane
              active={activePane === "question"}
              question={question}
              width={paneWidth}
              height={viewportHeight}
              scroll={questionScroll}
            />
          )}
          {(sideBySide || activePane === "answers") && (
            <AnswerPane
              active={activePane === "answers"}
              question={question}
              selected={selected}
              width={paneWidth}
              height={viewportHeight}
              scroll={answerScroll}
            />
          )}
        </Box>
      )}
    </Screen>
  );
}

function QuestionPane({ active, question, width, height, scroll }: QuestionPaneProps) {
  return (
    <Box width={width} flexDirection="column">
      <Text bold color={active ? "yellow" : "cyan"}>{active ? "› " : "  "}Question</Text>
      <QuestionContent question={question} width={width} height={height} scroll={scroll} />
    </Box>
  );
}

function AnswerPane({ active, question, selected, width, height, scroll }: AnswerPaneProps) {
  return (
    <Box width={width} flexDirection="column">
      <Text bold color={active ? "yellow" : "cyan"}>{active ? "› " : "  "}Answers</Text>
      <AnswerChoices question={question} selected={selected} width={width} height={height} scroll={scroll} />
    </Box>
  );
}
