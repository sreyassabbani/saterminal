import { Box, Text } from "ink";
import { htmlToText, parseHtmlSegments } from "@/text/html.ts";
import type { TextSegment } from "@/text/rich-text.ts";
import { wrapSegments, wrapText } from "@/text/wrap.ts";
import type { Question } from "@/questions/question.ts";

export type ChoiceLine = {
  text: string;
  choiceIndex?: number;
};

export type ChoiceRange = {
  start: number;
  end: number;
};

type ViewportProps = {
  question: Question;
  width: number;
  height: number;
  scroll?: number;
};

type AnswerChoicesProps = ViewportProps & {
  selected: number;
};

export function QuestionContent({ question, width, height, scroll = 0 }: ViewportProps) {
  const lines = questionContentLayout(question, width);
  const maximum = Math.max(0, lines.length - height);
  const start = Math.max(0, Math.min(scroll, maximum));
  return (
    <Box flexDirection="column">
      {lines.slice(start, start + height).map((line, lineIndex) => (
        <Text key={`${start}-${lineIndex}`}>
          {line.length === 0 ? " " : line.map((segment, segmentIndex) => (
            <Text
              key={segmentIndex}
              bold={segment.style.bold}
              italic={segment.style.italic}
              underline={segment.style.underline}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}

export function questionContentLayout(question: Question, width: number): TextSegment[][] {
  const passage = parseHtmlSegments(question.passage ?? "");
  const prompt = parseHtmlSegments(question.prompt);
  return [
    ...(passage.length ? wrapSegments(passage, width) : []),
    ...(passage.length ? [[]] : []),
    ...wrapSegments(prompt, width),
  ];
}

export function AnswerChoices({ question, selected, width, height, scroll = 0 }: AnswerChoicesProps) {
  const { lines } = answerChoiceLayout(question, selected, width);
  const start = clampedScroll(scroll, lines.length, height);
  const visible = lines.slice(start, start + height);
  return (
    <Box flexDirection="column">
      {visible.map((entry, index) => (
        <Text key={`${start}-${index}`} color={entry.choiceIndex === selected ? "yellow" : undefined} bold={entry.choiceIndex === selected}>
          {entry.text}
        </Text>
      ))}
    </Box>
  );
}

export function answerChoiceLayout(question: Question, selected: number | undefined, width: number): { lines: ChoiceLine[]; ranges: ChoiceRange[] } {
  const markerWidth = Math.max(...question.choices.map((choice) => Bun.stringWidth(`  ${choice.key}.`)));
  const choices = question.choices.map((choice, index) => ({
    index,
    lines: hangingChoiceLines(choice.key, choice.content, index === selected, markerWidth, width),
  }));
  const ranges: ChoiceRange[] = [];
  let cursor = 0;
  const lines = choices.flatMap((choice) => {
    ranges.push({ start: cursor, end: cursor + choice.lines.length });
    const rendered = [
      ...choice.lines.map((text) => ({ text, choiceIndex: choice.index })),
      ...(choice.index === choices.length - 1 ? [] : [{ text: " " }]),
    ];
    cursor += rendered.length;
    return rendered;
  });
  return { lines, ranges };
}

export function clampedScroll(scroll: number, lineCount: number, height: number): number {
  return Math.max(0, Math.min(scroll, Math.max(0, lineCount - height)));
}

export function revealRange(scroll: number, height: number, range: ChoiceRange | undefined): number {
  if (!range) return scroll;
  if (range.start < scroll) return range.start;
  if (range.end > scroll + height) return Math.max(0, range.end - height);
  return scroll;
}

function hangingChoiceLines(key: string, content: string, selected: boolean, markerWidth: number, width: number): string[] {
  const marker = `${selected ? ">" : " "} ${key}.`.padEnd(markerWidth);
  const indent = " ".repeat(markerWidth + 1);
  return wrapText(htmlToText(content).replace(/\n+/g, " "), Math.max(10, width - indent.length))
    .map((line, index) => index === 0 ? `${marker} ${line}` : `${indent}${line}`);
}
