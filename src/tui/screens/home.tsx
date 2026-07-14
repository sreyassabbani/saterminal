import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { Preferences } from "@/preferences/index.ts";
import type { Activity } from "@/progress/activity.ts";
import type { ProgressStatistics } from "@/progress/statistics.ts";
import type { Focus } from "@/questions/focus.ts";
import { Screen } from "@/tui/components/chrome.tsx";

export type HomeDestination = "focus" | "preferences" | "stats" | "history" | "review" | "practice" | "weak";

type HomeScreenProps = {
  stats: ProgressStatistics;
  activity: Activity;
  focus: Focus;
  preferences: Preferences;
  bankSize: number;
  reviewEligible: number;
  weakSkillCount: number;
  notice?: string;
  onOpen: (destination: HomeDestination) => void;
};

type HomeItem = {
  id: HomeDestination;
  label: string;
  detail: string;
};

type HomeSection = {
  label: string;
  items: HomeItem[];
};

export function HomeScreen({ stats, activity, focus, preferences, bankSize, reviewEligible, weakSkillCount, notice, onOpen }: HomeScreenProps) {
  const sections = homeSections(focus, preferences, stats, reviewEligible, weakSkillCount);
  const items = sections.flatMap((section) => section.items);
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === "k") setSelected((value) => (value - 1 + items.length) % items.length);
    else if (key.downArrow || input === "j") setSelected((value) => (value + 1) % items.length);
    else if (key.return) onOpen(items[selected].id);
  });

  let cursor = 0;
  return (
    <Screen title="home" detail={`${bankSize} available offline`} footer="j/k move · enter open · q quit" globalNavigation={false}>
      <Text>
        <Text bold color="cyan">{stats.answered}</Text><Text color="gray"> questions</Text>
        <Text color="gray">  ·  </Text><Text bold color={accuracyColor(stats.accuracy, stats.answered)}>{stats.answered ? `${Math.round(stats.accuracy * 100)}%` : "—"}</Text><Text color="gray"> accuracy</Text>
        <Text color="gray">  ·  </Text><Text bold color="green">{activity.streak}</Text><Text color="gray">-day streak</Text>
      </Text>
      <Text color="gray">{activity.todayCount} today  ·  {reviewEligible} eligible for review</Text>
      {notice ? <Box marginTop={1}><Text color="yellow">{notice}</Text></Box> : null}
      <Box flexDirection="column" marginTop={1}>
        {sections.map((section, sectionIndex) => (
          <Box key={section.label} flexDirection="column" marginTop={sectionIndex === 0 ? 0 : 1}>
            <Text bold color="cyan">{section.label}</Text>
            {section.items.map((item) => {
              const active = cursor++ === selected;
              return (
                <Text key={item.id} bold={active} color={active ? "yellow" : undefined}>
                  {active ? ">" : " "} {item.label.padEnd(24)} <Text color="gray">{item.detail}</Text>
                </Text>
              );
            })}
          </Box>
        ))}
      </Box>
    </Screen>
  );
}

function homeSections(
  focus: Focus,
  preferences: Preferences,
  stats: ProgressStatistics,
  reviewEligible: number,
  weakSkillCount: number,
): HomeSection[] {
  return [
    {
      label: "SETTINGS",
      items: [
        { id: "focus", label: "Focus", detail: `${focus.skills.length} skills · ${focus.difficulties.join(", ")}` },
        { id: "preferences", label: "General preferences", detail: `${preferences.display.resultDetail} results` },
      ],
    },
    {
      label: "RETROSPECTION",
      items: [
        { id: "stats", label: "Detailed stats", detail: `${stats.mastered}/${stats.answered} mastered` },
        { id: "history", label: "History", detail: `${stats.answered} questions` },
        { id: "review", label: "Review missed questions", detail: reviewEligible ? `${reviewEligible} eligible` : "none eligible" },
      ],
    },
    {
      label: "PRACTICE",
      items: [
        { id: "practice", label: "Selected focus", detail: `${focus.skills.length} skills` },
        { id: "weak", label: "Weak subjects", detail: weakSkillCount ? `${weakSkillCount} priority skills` : "no misses yet" },
      ],
    },
  ];
}

function accuracyColor(value: number, answered: number): "gray" | "red" | "yellow" | "green" {
  if (!answered) return "gray";
  if (value >= 0.8) return "green";
  if (value >= 0.6) return "yellow";
  return "red";
}
