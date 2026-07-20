import { defaultTheme, ThemeProvider } from "@inkjs/ui";
import type { ComponentType } from "react";

type AppProps = {
  Component: ComponentType<any>;
  commandProps: {
    options: unknown;
    args: unknown[];
  };
};

export default function CommandApp({ Component, commandProps }: AppProps) {
  return (
    <ThemeProvider theme={defaultTheme}>
      <Component {...commandProps} />
    </ThemeProvider>
  );
}
