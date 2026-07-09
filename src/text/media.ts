export function prepareMediaHtml(html: string): string {
  return html
    .replace(/<\s*svg\b([^>]*)>[\s\S]*?<\s*\/\s*svg\s*>/gi, (_match, attrs: string) => mediaLabel("Graph", attrs))
    .replace(/<\s*img\b([^>]*)>/gi, (_match, attrs: string) => mediaLabel("Image", attrs));
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
