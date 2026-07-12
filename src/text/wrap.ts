import { appendSegment, stylesEqual, type TextSegment, type TextStyle } from "@/text/rich-text.ts";

export function wrapSegments(segments: TextSegment[], width: number): TextSegment[][] {
  const usableWidth = Math.max(1, width);
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentWidth = 0;

  const flushLine = () => {
    lines.push(currentLine);
    currentLine = [];
    currentWidth = 0;
  };

  const appendToLine = (text: string, style: TextStyle) => {
    if (!text) {
      return;
    }

    const last = currentLine[currentLine.length - 1];
    if (last && stylesEqual(last.style, style)) {
      last.text += text;
    } else {
      currentLine.push({ text, style: { ...style } });
    }
    currentWidth += Bun.stringWidth(text);
  };

  for (const segment of segments) {
    const parts = segment.text.split("\n");
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      if (partIndex > 0) {
        flushLine();
      }

      const words = parts[partIndex].split(/\s+/).filter(Boolean);
      for (const word of words) {
        const spacer = currentWidth === 0 ? "" : " ";
        const needed = Bun.stringWidth(spacer + word);

        if (currentWidth > 0 && currentWidth + needed > usableWidth) {
          flushLine();
        }

        appendToLine(`${currentWidth === 0 ? "" : " "}${word}`, segment.style);
      }
    }
  }

  if (currentLine.length > 0 || lines.length === 0) {
    flushLine();
  }

  return lines;
}

export function wrapText(value: string, width: number): string[] {
  return Bun.wrapAnsi(value, Math.max(1, width), { hard: false }).split("\n").map((line) => line.trim());
}
