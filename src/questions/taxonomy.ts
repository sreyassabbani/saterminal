import type { Difficulty, DomainCode, SkillCode } from "@/questions/question.ts";

export const difficulties = ["E", "M", "H"] as const satisfies readonly Difficulty[];
export const domains = ["INI", "CAS", "EOI", "SEC"] as const satisfies readonly DomainCode[];
export const skills = ["CID", "INF", "COE", "WIC", "TSP", "CTC", "SYN", "TRA", "BOU", "FSS"] as const satisfies readonly SkillCode[];

export const skillsByDomain: Record<DomainCode, readonly SkillCode[]> = {
  INI: ["CID", "INF", "COE"],
  CAS: ["WIC", "TSP", "CTC"],
  EOI: ["SYN", "TRA"],
  SEC: ["BOU", "FSS"],
};

export const difficultyLabels: Record<Difficulty, string> = {
  E: "Easy",
  M: "Medium",
  H: "Hard",
};

export const domainLabels: Record<DomainCode, string> = {
  INI: "Information and Ideas",
  CAS: "Craft and Structure",
  EOI: "Expression of Ideas",
  SEC: "Standard English Conventions",
};

export const skillLabels: Record<SkillCode, string> = {
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

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && difficulties.includes(value as Difficulty);
}

export function isDomainCode(value: unknown): value is DomainCode {
  return typeof value === "string" && domains.includes(value as DomainCode);
}

export function isSkillCode(value: unknown): value is SkillCode {
  return typeof value === "string" && skills.includes(value as SkillCode);
}

export function domainForSkill(skill: SkillCode): DomainCode {
  const domain = domains.find((candidate) => skillsByDomain[candidate].includes(skill));
  if (!domain) throw new Error(`Unknown SAT skill: ${skill}`);
  return domain;
}
