import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";

const globalShortcuts = "f focus · h history · s stats · p practice · q quit";

type ScreenProps = {
  title: string;
  detail?: ReactNode;
  children: ReactNode;
  footer?: string;
  globalNavigation?: boolean;
};

export function HorizontalRule({ width }: { width: number }) {
  return <Text color="gray">{"─".repeat(Math.max(1, width - 1))}</Text>;
}

export function Screen({ title, detail, children, footer, globalNavigation = true }: ScreenProps) {
  const { stdout } = useStdout();
  const shortcuts = [footer, globalNavigation ? globalShortcuts : undefined].filter(Boolean).join(" · ");
  const renderedDetail = typeof detail === "string"
    ? <Text color="gray">{detail}</Text>
    : detail ?? <Text color="gray">offline</Text>;
  return (
    <Box flexDirection="column" height="100%">
      <Box justifyContent="space-between">
        <Text bold color="cyan">saterminal :: {title}</Text>
        {renderedDetail}
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingTop={1}>{children}</Box>
      <HorizontalRule width={stdout.columns ?? 80} />
      <Text color="gray">{shortcuts}</Text>
    </Box>
  );
}
