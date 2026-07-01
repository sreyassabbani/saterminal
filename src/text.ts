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
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
      .replace(/<\s*li\s*>/gi, "- ")
      .replace(/<[^>]*>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
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
