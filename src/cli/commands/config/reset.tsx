import { CommandAction } from "@/cli/components/command-action.tsx";
import { displayPath, preferencesPath } from "@/local-data/paths.ts";
import { defaultPreferences, savePreferences } from "@/preferences/index.ts";

export const description = "Restore default preferences";

export default function ResetConfigCommand() {
  return <CommandAction dependencies={[]} run={() => {
    savePreferences(defaultPreferences);
    return `Reset ${displayPath(preferencesPath)} to the defaults.`;
  }} />;
}
