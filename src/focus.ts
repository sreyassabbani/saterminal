import type { Difficulty, Domain, Focus, Skill } from "./types.ts";

export const difficultyOptions = ["E", "M", "H"] as const satisfies readonly Difficulty[];
export const domainOptions = ["INI", "CAS", "EOI", "SEC"] as const satisfies readonly Domain[];
export const skillOptions = ["CID", "INF", "COE", "WIC", "TSP", "CTC", "SYN", "TRA", "BOU", "FSS"] as const satisfies readonly Skill[];

export const skillsByDomain: Record<Domain, readonly Skill[]> = {
  INI: ["CID", "INF", "COE"],
  CAS: ["WIC", "TSP", "CTC"],
  EOI: ["SYN", "TRA"],
  SEC: ["BOU", "FSS"],
};

export const defaultFocus: Focus = {
  difficulties: ["M", "H"],
  domains: [...domainOptions],
  skills: [...skillOptions],
};

export type FocusGroup = "difficulties" | "domains" | "skills";

export type FocusRow =
  | { kind: "header"; label: string }
  | {
    kind: "option";
    group: FocusGroup;
    value: Difficulty | Domain | Skill;
    label: string;
    checked: boolean;
    partial?: boolean;
    depth: number;
  };

export function normalizeFocus(value: unknown): Focus {
  const raw = value && typeof value === "object" ? value as Partial<Record<keyof Focus, unknown>> : {};
  const skills = normalizeSkills(raw.skills, raw.domains);
  return {
    difficulties: normalizeSelection(raw.difficulties, difficultyOptions, defaultFocus.difficulties),
    domains: domainsForSkills(skills),
    skills,
  };
}

export function domainsForSkills(skills: readonly Skill[]): Domain[] {
  return domainOptions.filter((domain) => skillsForDomain(domain).some((skill) => skills.includes(skill)));
}

export function skillsForDomain(domain: Domain): readonly Skill[] {
  return skillsByDomain[domain];
}

export function focusSummary(focus: Focus): string {
  const difficulty = focus.difficulties.join(",");
  const skillCount = focus.skills.length;
  const domainCount = focus.domains.length;
  return `${skillCount} skills · ${difficulty} · ${domainCount} domains`;
}

export function focusRows(focus: Focus): FocusRow[] {
  return [
    { kind: "header", label: "Difficulty" },
    ...difficultyOptions.map((value) => optionRow("difficulties", value, difficultyLabels[value], focus.difficulties.includes(value), 0)),
    { kind: "header", label: "Reading and Writing" },
    ...domainOptions.flatMap((domain) => domainRows(domain, focus)),
  ];
}

export function toggleFocusRow(focus: Focus, row: FocusRow | undefined): Focus {
  if (!row || row.kind !== "option") {
    return focus;
  }

  if (row.group === "domains") {
    return toggleDomainFocus(focus, row.value as Domain);
  }

  if (row.group === "difficulties") {
    return toggleDifficultyFocus(focus, row.value as Difficulty);
  }

  return toggleSkillFocus(focus, row.value as Skill);
}

export function nextFocusableIndex(rows: FocusRow[], current: number): number {
  for (let index = Math.min(current + 1, rows.length - 1); index < rows.length; index++) {
    if (rows[index]?.kind === "option") {
      return index;
    }
  }
  return current;
}

export function previousFocusableIndex(rows: FocusRow[], current: number): number {
  for (let index = Math.max(current - 1, 0); index >= 0; index--) {
    if (rows[index]?.kind === "option") {
      return index;
    }
  }
  return current;
}

function domainRows(domain: Domain, focus: Focus): FocusRow[] {
  const skills = skillsForDomain(domain);
  const selected = skills.filter((skill) => focus.skills.includes(skill));
  return [
    optionRow("domains", domain, domainLabels[domain], selected.length > 0, 0, selected.length > 0 && selected.length < skills.length),
    ...skills.map((skill) => optionRow("skills", skill, skillLabels[skill], focus.skills.includes(skill), 1)),
  ];
}

function optionRow(
  group: FocusGroup,
  value: Difficulty | Domain | Skill,
  label: string,
  checked: boolean,
  depth: number,
  partial = false,
): FocusRow {
  return { kind: "option", group, value, label: `${value}  ${label}`, checked, partial, depth };
}

function toggleDifficultyFocus(focus: Focus, difficulty: Difficulty): Focus {
  const selected = focus.difficulties.includes(difficulty);
  if (selected && focus.difficulties.length === 1) {
    return focus;
  }

  return {
    ...focus,
    difficulties: selected
      ? focus.difficulties.filter((value) => value !== difficulty)
      : unique([...focus.difficulties, difficulty]),
  };
}

function toggleSkillFocus(focus: Focus, skill: Skill): Focus {
  const selected = focus.skills.includes(skill);
  if (selected && focus.skills.length === 1) {
    return focus;
  }

  const skills = selected ? focus.skills.filter((value) => value !== skill) : unique([...focus.skills, skill]);
  return {
    ...focus,
    domains: domainsForSkills(skills),
    skills,
  };
}

function toggleDomainFocus(focus: Focus, domain: Domain): Focus {
  const domainSkills = skillsForDomain(domain);
  const allSelected = domainSkills.every((skill) => focus.skills.includes(skill));

  if (allSelected) {
    const remaining = focus.skills.filter((skill) => !domainSkills.includes(skill));
    if (remaining.length === 0) {
      return focus;
    }

    return {
      ...focus,
      domains: domainsForSkills(remaining),
      skills: remaining,
    };
  }

  const skills = unique([...focus.skills, ...domainSkills]);
  return {
    ...focus,
    domains: domainsForSkills(skills),
    skills,
  };
}

function normalizeSelection<T extends string>(value: unknown, options: readonly T[], fallback: readonly T[]): T[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const selected = options.filter((option) => value.includes(option));
  return selected.length > 0 ? selected : [...fallback];
}

function normalizeSkills(value: unknown, domains: unknown): Skill[] {
  if (Array.isArray(value)) {
    const selected = skillOptions.filter((option) => value.includes(option));
    if (selected.length > 0) {
      return selected;
    }
  }

  if (Array.isArray(domains)) {
    const selectedDomains = domainOptions.filter((option) => domains.includes(option));
    const selectedSkills = selectedDomains.flatMap((domain) => [...skillsForDomain(domain)]);
    if (selectedSkills.length > 0) {
      return selectedSkills;
    }
  }

  return [...defaultFocus.skills];
}

function unique<T>(values: T[]): T[] {
  return values.filter((value, index, list) => list.indexOf(value) === index);
}

export const difficultyLabels: Record<Difficulty, string> = {
  E: "Easy",
  M: "Medium",
  H: "Hard",
};

export const domainLabels: Record<Domain, string> = {
  INI: "Information and Ideas",
  CAS: "Craft and Structure",
  EOI: "Expression of Ideas",
  SEC: "Standard English Conventions",
};

export const skillLabels: Record<Skill, string> = {
  CID: "Central Ideas and Details",
  INF: "Inferences",
  COE: "Command of Evidence",
  WIC: "Words in Context",
  TSP: "Text Structure and Purpose",
  CTC: "Cross-Text Connections",
  SYN: "Transitions",
  TRA: "Rhetorical Synthesis",
  BOU: "Boundaries",
  FSS: "Form, Structure, and Sense",
};
