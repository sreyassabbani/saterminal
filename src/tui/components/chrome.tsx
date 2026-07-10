import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";

export function Screen({ title, detail, children, footer }: { title: string; detail?: string; children: ReactNode; footer: string }) {
  const { stdout } = useStdout();
  return (
    <Box flexDirection="column" height="100%">
      <Box justifyContent="space-between">
        <Text bold color="cyan">sat / {title}</Text>
        <Text color="gray">{detail ?? "offline"}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingTop={1}>{children}</Box>
      <Text color="gray">{"─".repeat(Math.max(1, (stdout.columns ?? 80) - 1))}</Text>
      <Text color="gray">{footer}</Text>
    </Box>
  );
}
