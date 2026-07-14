import type { Attempt } from "@/progress/attempt.ts";
import { weaknesses } from "@/progress/weaknesses.ts";
import type { Focus } from "@/questions/focus.ts";

export function weakPracticeFocus(attempts: Iterable<Attempt>, base: Focus, skillLimit = 3): Focus | undefined {
  const skills = weaknesses(attempts)
    .filter((row) => row.missed > 0)
    .slice(0, skillLimit)
    .map((row) => row.skill);
  return skills.length ? { difficulties: [...base.difficulties], skills } : undefined;
}
