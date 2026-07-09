import type { KeyData } from "../types.ts";

export function isPauseKey(name: string, data?: KeyData): boolean {
  if (name === " " || name.toUpperCase() === "SPACE") {
    return true;
  }

  if (data?.isCharacter && data.codepoint === 32) {
    return true;
  }

  if (data?.code === " ") {
    return true;
  }

  if (Buffer.isBuffer(data?.code) && data.code.toString("utf8") === " ") {
    return true;
  }

  return false;
}
