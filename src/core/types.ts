/*
 * The shared vocabulary of FitScore.
 *
 * The one rule the types encode: engines produce Judgments, never numbers.
 * A Judgment says how well one criterion is met and cites the CV lines that
 * prove it. score() is the only thing that turns Judgments into points.
 */

export type Category = "technical" | "experience" | "logistics" | "custom";
export const CATEGORIES: readonly Category[] = ["technical", "experience", "logistics", "custom"];

export type Priority = "must" | "nice";

/** unknown = the CV neither confirms nor contradicts it; excluded from the denominator. */
export type Match = "full" | "partial" | "none" | "unknown";

export type DegreeLevel = "associate" | "bachelor" | "master" | "doctorate";

export type LogisticsKind = "location" | "country" | "travel" | "work_authorization";

/** Machine-readable hints the local engine uses. AI engines read the text instead. */
export interface CriterionHints {
  /** Lexicon skill ids named by the criterion. */
  skills?: string[];
  minYears?: number;
  degree?: DegreeLevel;
  /** Degree fields, lowercased ("marketing", "computer science"). */
  fields?: string[];
  /** True when the JD accepts "or a related field". Softens a field mismatch, not a level gap. */
  fieldFlexible?: boolean;
  /** True when the JD accepts "or equivalent experience" in place of the degree. */
  equivalentOk?: boolean;
  /** For a years bar: the domain the years must be in ("performance marketing"). */
  domainTerms?: string[];
  logistics?: LogisticsKind;
  /** Fallback significant terms when nothing structured was recognised. */
  terms?: string[];
}

export interface Criterion {
  id: string;
  text: string;
  category: Category;
  priority: Priority;
  /** 1-5. Points possible for this criterion. */
  weight: number;
  /** A knockout that is unmet raises a "Needs review" flag. It never rejects. */
  knockout: boolean;
  source: "extracted" | "recruiter";
  hints?: CriterionHints;
}

export type WorkMode = "remote" | "hybrid" | "onsite" | "unspecified";

export interface LogisticsProfile {
  workMode: WorkMode;
  /** "Austin, TX" style. Empty when fully remote or not stated. */
  location?: string;
  /** Country the role is tied to, e.g. "US" for "Remote (US only)". */
  country?: string;
  relocationSupport?: boolean;
  travelPercent?: number;
  sponsorship: "available" | "not_available" | "unspecified";
}

export type CategoryWeights = Record<Category, number>;

export const DEFAULT_WEIGHTS: CategoryWeights = {
  technical: 40,
  experience: 40,
  logistics: 20,
  custom: 0,
};

export interface Role {
  id: string;
  title: string;
  company?: string;
  jdText: string;
  criteria: Criterion[];
  weights: CategoryWeights;
  logistics: LogisticsProfile;
  /** Blind mode for applicants added to this role. Default on. */
  blind?: boolean;
  /** Keep city/state through blind mode so logistics can be scored. Default on. */
  keepLocation?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CvLine {
  id: string;
  text: string;
  section?: CvSection;
}

export type CvSection =
  | "header"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "other";

export interface Evidence {
  lineId: string;
  /** Must be a verbatim substring of the cited line, or normalize() drops it. */
  quote: string;
}

export interface Judgment {
  criterionId: string;
  match: Match;
  evidence: Evidence[];
  note: string;
}

export type EngineKind = "local" | "workers-ai" | "claude";

export interface EngineInfo {
  kind: EngineKind;
  label: string;
  model?: string;
  /** Set when this engine ran because a better one was unavailable. */
  fallbackReason?: string;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
}

export interface JudgeResult {
  engine: EngineInfo;
  judgments: Judgment[];
  summary?: string;
  usage?: Usage;
  ms?: number;
}

export interface JudgeInput {
  role: Role;
  lines: CvLine[];
}

export interface Judge {
  readonly kind: EngineKind;
  judge(input: JudgeInput, signal?: AbortSignal): Promise<JudgeResult>;
}

export interface ScoredItem {
  criterion: Criterion;
  judgment: Judgment;
  earned: number;
  possible: number;
}

export interface CategoryScore {
  category: Category;
  /** null = nothing in this category could be assessed. */
  score: number | null;
  earned: number;
  possible: number;
  counts: Record<Match, number>;
  items: ScoredItem[];
}

export type Band = "strong" | "good" | "partial" | "low";

export interface Flag {
  kind: "knockout_unmet" | "knockout_unverified";
  criterionId: string;
  message: string;
}

export interface ScoreCard {
  overall: number;
  band: Band;
  categories: Record<Category, CategoryScore>;
  /** The category weights actually applied after re-normalising empty categories. */
  appliedWeights: CategoryWeights;
  flags: Flag[];
}

export interface Candidate {
  id: string;
  /** "Candidate A" while blind. */
  label: string;
  fileName?: string;
  /** Pre-redaction text. Kept locally so Reveal can show it; never sent anywhere. */
  rawText: string;
  /** What engines see. Equals rawText when blind mode is off. */
  text: string;
  lines: CvLine[];
  blind: boolean;
  detectedName?: string;
  revealed: boolean;
  addedAt: number;
}

export interface CandidateResult {
  candidateId: string;
  roleId: string;
  result: JudgeResult;
  scorecard: ScoreCard;
  scoredAt: number;
  /** scoringKey(role) at scoring time; a mismatch means criteria changed since. */
  roleKey?: string;
}
