import { domainLabels, skillLabels } from "../questions/taxonomy.ts";
import type { DomainCode, SkillCode } from "../questions/question.ts";
import type { Attempt } from "./attempt.ts";

export type Weakness = {
  skill: SkillCode;
  label: string;
  domain: DomainCode;
  domainLabel: string;
  total: number;
  mastered: number;
  missed: number;
  accuracy: number;
  averageSeconds: number;
};

export function weaknesses(attempts: Iterable<Attempt>): Weakness[] {
  const groups = new Map<SkillCode, Omit<Weakness, "accuracy" | "averageSeconds"> & { totalSeconds: number }>();
  for (const attempt of attempts) {
    if (!attempt.skill || !attempt.domain) continue;
    const row = groups.get(attempt.skill) ?? {
      skill: attempt.skill,
      label: skillLabels[attempt.skill],
      domain: attempt.domain,
      domainLabel: domainLabels[attempt.domain],
      total: 0,
      mastered: 0,
      missed: 0,
      totalSeconds: 0,
    };
    row.total += 1;
    row.totalSeconds += attempt.durationSeconds;
    if (attempt.outcome === "incorrect") row.missed += 1;
    else row.mastered += 1;
    groups.set(attempt.skill, row);
  }
  return [...groups.values()].map(({ totalSeconds, ...row }) => ({
    ...row,
    accuracy: row.total === 0 ? 0 : row.mastered / row.total,
    averageSeconds: row.total === 0 ? 0 : totalSeconds / row.total,
  })).sort((a, b) =>
    b.missed - a.missed || a.accuracy - b.accuracy || b.total - a.total || a.skill.localeCompare(b.skill)
  );
}
