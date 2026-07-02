declare module "terminal-kit" {
  type KeyData = {
    code?: string | Buffer | number;
    codepoint?: number;
    isCharacter?: boolean;
  };

  export type Terminal = {
    width: number;
    height: number;
    clear(): Terminal;
    moveTo(x: number, y: number): Terminal;
    bold: Terminal & Record<string, Terminal>;
    gray: Terminal;
    cyan: Terminal;
    green: Terminal;
    red: Terminal;
    yellow: Terminal;
    underline: Terminal;
    inverse: Terminal;
    defaultColor: Terminal;
    fullscreen(enabled: boolean): void;
    hideCursor(enabled?: boolean): void;
    grabInput(enabled?: boolean): void;
    processExit(code: number): void;
    on(event: "key", listener: (name: string, matches?: string[], data?: KeyData) => void): void;
    on(event: "resize", listener: (width: number, height: number) => void): void;
    off(event: "resize", listener: (width: number, height: number) => void): void;
    (value: string): void;
  };

  export type DocumentOptions = {
    inlineTerm?: Terminal;
    eventSource?: Terminal;
    outputDst?: Terminal;
    outputX?: number;
    outputY?: number;
    outputWidth?: number;
    outputHeight?: number;
    backgroundAttr?: Record<string, unknown>;
    noInput?: boolean;
  };

  export type MenuItem = {
    content: string;
    value: string;
    disabled?: boolean;
  };

  export type ColumnMenuMultiOptions = {
    parent?: unknown;
    id?: string;
    x?: number;
    y?: number;
    width?: number;
    items?: MenuItem[];
    value?: Record<string, boolean>;
    multiLineItems?: boolean;
    master?: MenuItem;
  };

  export type WindowOptions = {
    parent?: unknown;
    title?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };

  export type TextOptions = {
    parent?: unknown;
    content?: string | string[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    attr?: Record<string, unknown>;
    contentHasMarkup?: boolean | "ansi" | "legacyAnsi";
    noDraw?: boolean;
  };

  export class Document {
    constructor(options: DocumentOptions);
    clear(): void;
    draw(): void;
    destroy(): void;
    focusNext(): void;
    giveFocusTo(element: unknown, type?: string): void;
    on(event: "key", listener: (key: string) => void): void;
  }

  export class ColumnMenuMulti {
    constructor(options: ColumnMenuMultiOptions);
    value: Record<string, boolean>;
    setValue(value: Record<string, boolean>, noDraw?: boolean): void;
    on(event: "itemToggle", listener: (key: string, enabled: boolean) => void): void;
    on(event: "submit", listener: (...args: unknown[]) => void): void;
  }

  export class Window {
    constructor(options: WindowOptions);
  }

  export class Text {
    constructor(options: TextOptions);
  }

  const terminalKit: {
    terminal: Terminal;
    Document: typeof Document;
    ColumnMenuMulti: typeof ColumnMenuMulti;
    Window: typeof Window;
    Text: typeof Text;
  };

  export default terminalKit;
}
