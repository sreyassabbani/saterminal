import he from "he";
import { HTMLElement, NodeType, parse, type Node } from "node-html-parser";
import wrap from "word-wrap";

export type TextStyle = {
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
};

export type TextSegment = {
  text: string;
  style: TextStyle;
};

export function htmlToText(html = ""): string {
  const text = parseHtmlSegments(html)
    .map((segment) => segment.text)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalizeDisplayText(text);
}

export function parseHtmlSegments(html = ""): TextSegment[] {
  const root = parse(prepareHtml(html), { lowerCaseTagName: true });
  const segments: TextSegment[] = [];
  walkNodes(root, {}, segments);

  return finalizeSegments(segments).map((segment, index, all) => ({
    text: normalizeDisplayText(normalizeSegmentWhitespace(trimSegmentEdges(segment.text, index, all.length))),
    style: segment.style,
  }));
}

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
    currentWidth += text.length;
  };

  for (const segment of segments) {
    const parts = segment.text.split("\n");
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      if (partIndex > 0) {
        flushLine();
      }

      const words = parts[partIndex].split(/\s+/).filter(Boolean);
      for (const word of words) {
        const needed = (currentWidth === 0 ? 0 : 1) + word.length;

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

export function hasHtmlTable(...values: Array<string | undefined>): boolean {
  return values.some((value) => parse(value ?? "").querySelector("table") !== null);
}

export function decodeEntities(value: string): string {
  return he.decode(value);
}

export function wrapText(value: string, width: number): string[] {
  return wrap(value, {
    width: Math.max(1, width),
    trim: true,
    indent: "",
    newline: "\n",
  }).split("\n");
}

function walkNodes(node: Node, style: TextStyle, segments: TextSegment[]): void {
  if (node.nodeType === NodeType.TEXT_NODE) {
    pushText(segments, node.text, style);
    return;
  }

  if (!(node instanceof HTMLElement)) {
    return;
  }

  if (!node.tagName) {
    for (const child of node.childNodes) {
      walkNodes(child, style, segments);
    }
    return;
  }

  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    pushText(segments, "\n", style);
    return;
  }

  const nextStyle = styleForElement(node, style);
  for (const child of node.childNodes) {
    walkNodes(child, nextStyle, segments);
  }

  if (isBlockTag(tag)) {
    pushText(segments, "\n", nextStyle);
  }
}

function styleForElement(node: HTMLElement, style: TextStyle): TextStyle {
  const tag = node.tagName.toLowerCase();
  const next = { ...style };

  if (tag === "u" || hasUnderlineStyle(node.getAttribute("style") ?? "")) {
    next.underline = true;
  }
  if (tag === "strong" || tag === "b") {
    next.bold = true;
  }
  if (tag === "em" || tag === "i") {
    next.italic = true;
  }

  return next;
}

function isBlockTag(tag: string): boolean {
  return tag === "p" || tag === "div" || tag === "li" || /^h[1-6]$/.test(tag);
}

function hasUnderlineStyle(style: string): boolean {
  return /text-decoration\s*:\s*[^;"]*underline/i.test(style);
}

function prepareHtml(html: string): string {
  return html
    .replace(/<\s*svg\b([^>]*)>[\s\S]*?<\s*\/\s*svg\s*>/gi, (_match, attrs: string) => mediaLabel("Graph", attrs))
    .replace(/<\s*img\b([^>]*)>/gi, (_match, attrs: string) => mediaLabel("Image", attrs));
}

function pushText(segments: TextSegment[], text: string, style: TextStyle): void {
  if (!text) {
    return;
  }

  if (text === "\n") {
    appendSegment(segments, "\n", style);
    return;
  }

  const normalized = decodeEntities(text).replace(/[ \t\r\f\v]+/g, " ");
  if (!normalized.trim()) {
    return;
  }

  appendSegment(segments, normalized, style);
}

function appendSegment(segments: TextSegment[], text: string, style: TextStyle): void {
  const last = segments[segments.length - 1];
  if (last && stylesEqual(last.style, style)) {
    last.text += text;
    return;
  }

  segments.push({ text, style: { ...style } });
}

function stylesEqual(left: TextStyle, right: TextStyle): boolean {
  return !!left.bold === !!right.bold && !!left.underline === !!right.underline && !!left.italic === !!right.italic;
}

function finalizeSegments(segments: TextSegment[]): TextSegment[] {
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

function mediaLabel(kind: string, attrs: string): string {
  const label = readAttribute(attrs, "aria-label") ?? readAttribute(attrs, "alt");
  return label ? `\n[${kind}: ${label}]\n` : `\n[${kind}]\n`;
}

function readAttribute(attrs: string, name: string): string | undefined {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = attrs.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function normalizeDisplayText(value: string): string {
  return value
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/_{3,}\s*blank\b/gi, "_______");
}

function normalizeSegmentWhitespace(value: string): string {
  return value
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "\n")
    .replace(/\n+$/, (match) => (match.length > 1 ? "\n\n" : match));
}

function trimSegmentEdges(value: string, index: number, total: number): string {
  let text = value;
  if (index === 0) {
    text = text.replace(/^\n+/, "");
    text = text.replace(/^[ \t]+/, "");
  }
  if (index === total - 1) {
    text = text.replace(/\n+$/, "");
    text = text.replace(/[ \t]+$/, "");
  }
  return text;
}
