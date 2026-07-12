import { Box, Text } from "ink";
import { htmlToText } from "@/text/html.ts";
import { wrapText } from "@/text/wrap.ts";
import type { Question } from "@/questions/question.ts";

export function QuestionContent({ question, width, height, scroll = 0 }: { question: Question; width: number; height: number; scroll?: number }) {
  const passage = htmlToText(question.passage ?? "");
  const prompt = htmlToText(question.prompt);
  const lines = [
    ...(passage ? wrapText(passage, width) : []),
    ...(passage ? [""] : []),
    ...wrapText(prompt, width),
  ];
  const maximum = Math.max(0, lines.length - height);
  const start = Math.max(0, Math.min(scroll, maximum));
  return <Text>{lines.slice(start, start + height).join("\n")}</Text>;
}

export function AnswerChoices({ question, selected, width, height }: { question: Question; selected: number; width: number; height: number }) {
  const markerWidth = Math.max(...question.choices.map((choice) => Bun.stringWidth(`  ${choice.key}.`)));
  const choices = question.choices.map((choice, index) => ({
    index,
    lines: hangingChoiceLines(choice.key, choice.content, index === selected, markerWidth, width),
  }));
  const selectedStart = choices.slice(0, selected).reduce((total, choice) => total + choice.lines.length + 1, 0);
  const selectedEnd = selectedStart + (choices[selected]?.lines.length ?? 1);
  const allLines = choices.flatMap((choice) => [...choice.lines.map((line) => ({ line, selected: choice.index === selected })), { line: " ", selected: false }]);
  const start = Math.max(0, Math.min(selectedStart, selectedEnd - height, allLines.length - height));
  const visible = allLines.slice(start, start + height);
  return (
    <Box flexDirection="column">
      {visible.map((entry, index) => (
        <Text key={`${start}-${index}`} color={entry.selected ? "yellow" : undefined} bold={entry.selected}>{entry.line}</Text>
      ))}
    </Box>
  );
}

function hangingChoiceLines(key: string, content: string, selected: boolean, markerWidth: number, width: number): string[] {
  const marker = `${selected ? ">" : " "} ${key}.`.padEnd(markerWidth);
  const indent = " ".repeat(markerWidth + 1);
  return wrapText(htmlToText(content).replace(/\n+/g, " "), Math.max(10, width - indent.length))
    .map((line, index) => index === 0 ? `${marker} ${line}` : `${indent}${line}`);
}
