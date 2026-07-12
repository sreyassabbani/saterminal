import type { Difficulty, DomainCode, SkillCode } from "@/questions/question.ts";
import { difficulties, domains, skills, skillsByDomain } from "@/questions/taxonomy.ts";

export type Focus = {
  difficulties: Difficulty[];
  skills: SkillCode[];
};

export const defaultFocus: Focus = {
  difficulties: ["M", "H"],
  skills: [...skills],
};

export function normalizeFocus(value: unknown): Focus {
  const raw = value && typeof value === "object"
    ? value as { difficulties?: unknown; skills?: unknown; domains?: unknown }
    : {};

  return {
    difficulties: selection(raw.difficulties, difficulties, defaultFocus.difficulties),
    skills: normalizedSkills(raw.skills, raw.domains),
  };
}

export function selectedDomains(focus: Focus): DomainCode[] {
  return domains.filter((domain) => skillsByDomain[domain].some((skill) => focus.skills.includes(skill)));
}

export function toggleDifficulty(focus: Focus, difficulty: Difficulty): Focus {
  const selected = focus.difficulties.includes(difficulty);
  if (selected && focus.difficulties.length === 1) return focus;
  return {
    ...focus,
    difficulties: selected
      ? focus.difficulties.filter((value) => value !== difficulty)
      : ordered([...focus.difficulties, difficulty], difficulties),
  };
}

export function toggleSkill(focus: Focus, skill: SkillCode): Focus {
  const selected = focus.skills.includes(skill);
  if (selected && focus.skills.length === 1) return focus;
  return {
    ...focus,
    skills: selected
      ? focus.skills.filter((value) => value !== skill)
      : ordered([...focus.skills, skill], skills),
  };
}

export function toggleDomain(focus: Focus, domain: DomainCode): Focus {
  const children = skillsByDomain[domain];
  const allSelected = children.every((skill) => focus.skills.includes(skill));
  if (allSelected) {
    const remaining = focus.skills.filter((skill) => !children.includes(skill));
    return remaining.length === 0 ? focus : { ...focus, skills: remaining };
  }
  return { ...focus, skills: ordered([...new Set([...focus.skills, ...children])], skills) };
}

function normalizedSkills(value: unknown, legacyDomains: unknown): SkillCode[] {
  const direct = selection(value, skills, []);
  if (direct.length > 0) return direct;
  const selected = selection(legacyDomains, domains, []);
  if (selected.length > 0) return selected.flatMap((domain) => [...skillsByDomain[domain]]);
  return [...defaultFocus.skills];
}

function selection<T extends string>(value: unknown, options: readonly T[], fallback: readonly T[]): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const selected = options.filter((option) => value.includes(option));
  return selected.length > 0 ? selected : [...fallback];
}

function ordered<T extends string>(values: readonly T[], order: readonly T[]): T[] {
  return order.filter((value) => values.includes(value));
}
