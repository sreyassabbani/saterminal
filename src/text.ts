const entityMap: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "(c)",
  hellip: "...",
  laquo: "\"",
  ldquo: "\"",
  lsquo: "'",
  mdash: "-",
  ndash: "-",
  nbsp: " ",
  quot: "\"",
  raquo: "\"",
  rdquo: "\"",
  reg: "(r)",
  rsquo: "'",
};

export function htmlToText(html = ""): string {
  return normalizeDisplayText(
    decodeEntities(
      html
        .replace(/<\s*svg\b([^>]*)>[\s\S]*?<\s*\/\s*svg\s*>/gi, (_match, attrs: string) => mediaLabel("Graph", attrs))
        .replace(/<\s*img\b([^>]*)>/gi, (_match, attrs: string) => mediaLabel("Image", attrs))
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
        .replace(/<\s*li\s*>/gi, "- ")
        .replace(/<[^>]*>/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    ),
  );
}

export function hasHtmlTable(...values: Array<string | undefined>): boolean {
  return values.some((value) => /<\s*table\b/i.test(value ?? ""));
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
  return value.replace(/_{3,}\s*blank\b/gi, "_______");
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const raw = isHex ? entity.slice(2) : entity.slice(1);
      const code = Number.parseInt(raw, isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return entityMap[entity.toLowerCase()] ?? match;
  });
}

export function wrapText(value: string, width: number): string[] {
  const usableWidth = Math.max(1, width);
  const lines: string[] = [];

  for (const paragraph of value.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!current) {
        current = word;
      } else if (current.length + word.length + 1 <= usableWidth) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}
