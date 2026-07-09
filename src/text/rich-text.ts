export type TextStyle = {
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
};

export type TextSegment = {
  text: string;
  style: TextStyle;
};

export function appendSegment(segments: TextSegment[], text: string, style: TextStyle): void {
  const last = segments[segments.length - 1];
  if (last && stylesEqual(last.style, style)) {
    last.text += text;
    return;
  }

  segments.push({ text, style: { ...style } });
}

export function finalizeSegments(segments: TextSegment[]): TextSegment[] {
  const merged: TextSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && stylesEqual(last.style, segment.style)) {
      last.text += segment.text;
    } else {
      merged.push({ text: segment.text, style: { ...segment.style } });
    }
  }
  return merged;
}

export function stylesEqual(left: TextStyle, right: TextStyle): boolean {
  return !!left.bold === !!right.bold && !!left.underline === !!right.underline && !!left.italic === !!right.italic;
}
