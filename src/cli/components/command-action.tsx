import { useApp } from "ink";
import { useEffect } from "react";

export function CommandAction({ run, dependencies }: { run: () => string; dependencies: readonly unknown[] }) {
  const { exit } = useApp();
  useEffect(() => {
    try {
      process.stdout.write(`${run()}\n`);
    } catch (error) {
      process.stderr.write(`sat: ${message(error)}\n`);
      process.exitCode = 1;
    } finally {
      exit();
    }
  }, [exit, ...dependencies]);
  return null;
}

function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
