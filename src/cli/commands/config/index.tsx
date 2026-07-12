import { Text } from "ink";
import { displayPath, preferencesPath } from "@/local-data/paths.ts";
import { loadPreferences } from "@/preferences/index.ts";

export const description = "Show local preferences";

export default function ConfigCommand() {
  const preferences = loadPreferences();
  return (
    <Text>{[
      "preferences",
      displayPath(preferencesPath),
      "",
      `review minimum days           ${preferences.review.minimumDays}`,
      `review minimum answers after  ${preferences.review.minimumAnswersAfter}`,
      `result taxonomy               ${preferences.display.showTaxonomy ? "shown" : "hidden"}`,
      "",
      "Update with: sat config set --minimum-days 7 --minimum-answers-after 100 --taxonomy show",
    ].join("\n")}</Text>
  );
}
