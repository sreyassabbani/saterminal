import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { hasHtmlTable } from "../../text/html.ts";
import { openQuestionPage } from "../../questions/practice-sat.ts";
import type { Question } from "../../questions/question.ts";
import { domainLabels, skillLabels } from "../../questions/taxonomy.ts";
import { AnswerChoices, QuestionContent } from "../components/question-content.tsx";
import { Screen } from "../components/chrome.tsx";
import { useTerminalSize } from "../hooks/use-terminal-size.ts";

export function PracticeScreen({ question, onAnswer, onSkip }: { question: Question; onAnswer: (answer: string, duration: number) => void; onSkip: () => void }) {
  const { width, height } = useTerminalSize();
  const [selected, setSelected] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const unsupported = hasHtmlTable(question.passage, question.prompt, question.explanation, ...question.choices.map((choice) => choice.content));
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [paused]);
  useInput((input, key) => {
    if (input === " ") setPaused((value) => !value);
    else if (input === "t") setTimerVisible((value) => !value);
    else if (unsupported && input === "o") openQuestionPage(question);
    else if (unsupported && (input === "n" || input === "x" || key.return)) onSkip();
    else if (key.upArrow || input === "k") setSelected((value) => Math.max(0, value - 1));
    else if (key.downArrow || input === "j") setSelected((value) => Math.min(question.choices.length - 1, value + 1));
    else if (key.pageUp || input === "[") setScroll((value) => Math.max(0, value - 8));
    else if (key.pageDown || input === "]") setScroll((value) => value + 8);
    else if (key.return && question.choices[selected]) onAnswer(question.choices[selected].key, elapsed);
    else {
      const direct = question.choices.findIndex((choice) => choice.key.toLowerCase() === input.toLowerCase());
      if (direct >= 0) setSelected(direct);
    }
  });
  const paneWidth = width >= 80 ? Math.floor((width - 3) / 2) : width - 2;
  return (
    <Screen title="practice" detail={timerVisible ? `${formatTime(elapsed)}${paused ? " paused" : ""}` : "timer hidden"} footer={unsupported ? "o open · n/x/enter skip" : "j/k or answer key select · enter submit · [/] scroll · space pause · t timer"}>
      <Text color="gray">{question.domain} {domainLabels[question.domain]} · {question.skill} {skillLabels[question.skill]} · {question.difficulty}</Text>
      {unsupported ? (
        <Box flexDirection="column" paddingTop={1}>
          <Text bold color="yellow">This question contains a table that needs a browser.</Text>
          <Text>Press o to open it, then answer there or skip it here.</Text>
        </Box>
      ) : (
        <Box flexDirection={width >= 80 ? "row" : "column"} gap={3} paddingTop={1}>
          <Box width={paneWidth} height={Math.max(8, height - 7)} flexDirection="column"><Text bold color="cyan">Question</Text><QuestionContent question={question} width={paneWidth} height={Math.max(6, height - 9)} scroll={scroll} /></Box>
          <Box width={paneWidth} flexDirection="column"><Text bold color="cyan">Answers</Text><AnswerChoices question={question} selected={selected} width={paneWidth} height={Math.max(5, height - 9)} /></Box>
        </Box>
      )}
    </Screen>
  );
}

function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
