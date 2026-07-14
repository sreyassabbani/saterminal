import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { resultDetailLevels, type Preferences, type ResultDetail } from "@/preferences/index.ts";
import { Screen } from "@/tui/components/chrome.tsx";

type PreferenceRow = "resultDetail" | "minimumDays" | "minimumAnswersAfter";

const rows: PreferenceRow[] = ["resultDetail", "minimumDays", "minimumAnswersAfter"];

export function PreferencesScreen({ preferences, onSave, onBack }: { preferences: Preferences; onSave: (preferences: Preferences) => void; onBack: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(preferences));
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape) onBack();
    else if (key.upArrow || input === "k") setSelected((value) => Math.max(0, value - 1));
    else if (key.downArrow || input === "j") setSelected((value) => Math.min(rows.length - 1, value + 1));
    else if (key.leftArrow || input === "h") setDraft((current) => adjust(current, rows[selected], -1));
    else if (key.rightArrow || input === "l") setDraft((current) => adjust(current, rows[selected], 1));
    else if (key.return) onSave(draft);
  });

  return (
    <Screen title="preferences" detail="local" footer="j/k move · h/l or ←/→ adjust · enter save · esc cancel · m home · q quit" globalNavigation={false}>
      <Box flexDirection="column">
        <PreferenceChoice active={selected === 0} label="Result detail" value={draft.display.resultDetail} />
        <PreferenceChoice active={selected === 1} label="Review delay" value={`${draft.review.minimumDays} days`} />
        <PreferenceChoice active={selected === 2} label="Answer spacing" value={`${draft.review.minimumAnswersAfter} later answers`} />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">{description(rows[selected], draft.display.resultDetail)}</Text>
      </Box>
    </Screen>
  );
}

function PreferenceChoice({ active, label, value }: { active: boolean; label: string; value: string }) {
  return <Text bold={active} color={active ? "yellow" : undefined}>{active ? ">" : " "} {label.padEnd(20)} {value}</Text>;
}

function adjust(preferences: Preferences, row: PreferenceRow, direction: -1 | 1): Preferences {
  if (row === "resultDetail") {
    const current = resultDetailLevels.indexOf(preferences.display.resultDetail);
    const resultDetail = resultDetailLevels[(current + direction + resultDetailLevels.length) % resultDetailLevels.length];
    return { ...preferences, display: { resultDetail } };
  }
  if (row === "minimumDays") {
    return { ...preferences, review: { ...preferences.review, minimumDays: Math.max(0, preferences.review.minimumDays + direction) } };
  }
  return {
    ...preferences,
    review: { ...preferences.review, minimumAnswersAfter: Math.max(0, preferences.review.minimumAnswersAfter + direction * 10) },
  };
}

function description(row: PreferenceRow, detail: ResultDetail): string {
  if (row === "minimumDays") return "Minimum age of a missed question before review.";
  if (row === "minimumAnswersAfter") return "Answers completed after a miss before review.";
  if (detail === "brief") return "Results show time only.";
  if (detail === "standard") return "Results show time and difficulty.";
  return "Results show time, difficulty, and taxonomy.";
}
