import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";

const globalShortcuts = "f focus · h history · s stats · p practice · q quit";

export function Screen({ title, detail, children, footer, globalNavigation = true }: { title: string; detail?: string; children: ReactNode; footer?: string; globalNavigation?: boolean }) {
  const { stdout } = useStdout();
  const shortcuts = [footer, globalNavigation ? globalShortcuts : undefined].filter(Boolean).join(" · ");
  return (
    <Box flexDirection="column" height="100%">
      <Box justifyContent="space-between">
        <Text bold color="cyan">sat / {title}</Text>
        <Text color="gray">{detail ?? "offline"}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingTop={1}>{children}</Box>
      <Text color="gray">{"─".repeat(Math.max(1, (stdout.columns ?? 80) - 1))}</Text>
      <Text color="gray">{shortcuts}</Text>
    </Box>
  );
}
