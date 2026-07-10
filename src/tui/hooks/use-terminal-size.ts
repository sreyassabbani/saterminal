import { useStdout } from "ink";
import { useEffect, useState } from "react";

export type TerminalSize = { width: number; height: number };

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const read = () => ({ width: stdout.columns ?? 80, height: stdout.rows ?? 24 });
  const [size, setSize] = useState<TerminalSize>(read);
  useEffect(() => {
    const resize = () => setSize(read());
    stdout.on("resize", resize);
    return () => { stdout.off("resize", resize); };
  }, [stdout]);
  return size;
}
