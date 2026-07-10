import { Text, useApp } from "ink";
import { useEffect } from "react";

export function Report({ children, raw = false }: { children: string; raw?: boolean }) {
  if (raw) return <RawOutput value={children} />;
  return <Text>{children}</Text>;
}

function RawOutput({ value }: { value: string }) {
  const { exit } = useApp();
  useEffect(() => {
    process.stdout.write(`${value}\n`);
    exit();
  }, [exit, value]);
  return null;
}
