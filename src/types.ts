export type Outcome = "correct" | "incorrect" | "corrected";

export type Attempt = {
  question_id: string;
  outcome: Outcome;
  updated_at: string;
  elapsed_seconds: number;
  difficulty?: string;
  domain?: string;
  domain_desc?: string;
  skill?: string;
  skill_desc?: string;
};

export type AttemptEvent = {
  question_id: string;
  correct: boolean;
  answered_at: string;
  elapsed_seconds: number;
  difficulty: string;
  domain: string;
  domain_desc?: string;
  skill: string;
  skill_desc?: string;
};

export type SummaryRow = {
  metric: string;
  value: string;
  updated_at: string;
};

export type Difficulty = "E" | "M" | "H";
export type Domain = "INI" | "CAS" | "EOI" | "SEC";
export type Skill = "CID" | "INF" | "COE" | "WIC" | "TSP" | "CTC" | "SYN" | "TRA" | "BOU" | "FSS";

export type Focus = {
  difficulties: Difficulty[];
  domains: Domain[];
  skills: Skill[];
};

export type QuestionMeta = {
  questionId: string;
  uId: string;
  external_id: string;
  difficulty: string;
  primary_class_cd: string;
  primary_class_cd_desc?: string;
  program?: string;
  skill_cd: string;
  skill_desc?: string;
  score_band_range_cd?: number;
};

export type QuestionDetail = {
  externalid: string;
  type: string;
  stimulus?: string;
  stem: string;
  answerOptions: Record<string, string>;
  correct_answer: string[];
  rationale?: string;
};

export type PracticeQuestion = {
  meta: QuestionMeta;
  detail: QuestionDetail;
};
