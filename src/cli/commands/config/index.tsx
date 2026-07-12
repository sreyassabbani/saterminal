import { CommandAction } from "@/cli/components/command-action.tsx";
import { displayPath, preferencesPath } from "@/local-data/paths.ts";
import { loadPreferences } from "@/preferences/index.ts";

export const description = "Show local preferences";

export default function ConfigCommand() {
  return <CommandAction dependencies={[]} run={async () => {
    const preferences = await loadPreferences();
    return [
      "preferences",
      displayPath(preferencesPath),
      "",
      `review minimum days           ${preferences.review.minimumDays}`,
      `review minimum answers after  ${preferences.review.minimumAnswersAfter}`,
      `result detail                 ${preferences.display.resultDetail}`,
      "",
      "Update with: sat config set --minimum-days 7 --minimum-answers-after 100 --result-detail detailed",
    ].join("\n");
  }} />;
}
