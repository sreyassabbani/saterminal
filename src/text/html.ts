import he from "he";
import { HTMLElement, NodeType, parse, type Node } from "node-html-parser";
import { prepareMediaHtml } from "./media.ts";
import { appendSegment, finalizeSegments, type TextSegment, type TextStyle } from "./rich-text.ts";

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
  const root = parse(prepareMediaHtml(html), { lowerCaseTagName: true });
  const segments: TextSegment[] = [];
  walkNodes(root, {}, segments);

  return finalizeSegments(segments).map((segment, index, all) => ({
    text: normalizeDisplayText(normalizeSegmentWhitespace(trimSegmentEdges(segment.text, index, all.length))),
    style: segment.style,
  }));
}

export function hasHtmlTable(...values: Array<string | undefined>): boolean {
  return values.some((value) => parse(value ?? "").querySelector("table") !== null);
}

export function decodeEntities(value: string): string {
  return he.decode(value);
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
