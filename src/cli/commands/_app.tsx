import { defaultTheme, ThemeProvider } from "@inkjs/ui";
import type { AppProps } from "pastel";

export default function CommandApp({ Component, commandProps }: AppProps) {
  return (
    <ThemeProvider theme={defaultTheme}>
      <Component {...commandProps} />
    </ThemeProvider>
  );
}
