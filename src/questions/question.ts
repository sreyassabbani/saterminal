export type Difficulty = "E" | "M" | "H";
export type DomainCode = "INI" | "CAS" | "EOI" | "SEC";
export type SkillCode = "CID" | "INF" | "COE" | "WIC" | "TSP" | "CTC" | "SYN" | "TRA" | "BOU" | "FSS";

export type QuestionChoice = {
  key: string;
  content: string;
};

export type Question = {
  id: string;
  sourceId: string;
  difficulty: Difficulty;
  domain: DomainCode;
  skill: SkillCode;
  passage?: string;
  prompt: string;
  choices: QuestionChoice[];
  correctAnswers: string[];
  explanation?: string;
};

export function checkAnswer(question: Question, answer: string): boolean {
  return question.correctAnswers.includes(answer);
}
