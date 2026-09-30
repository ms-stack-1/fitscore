import { extractRole } from "../core/jd/extract";
import { LocalJudge } from "../core/judges/local";
import { normalize } from "../core/normalize";
import { redact, type Redaction } from "../core/redact";
import { score } from "../core/score";
import { toLines } from "../core/text";
import { DEFAULT_WEIGHTS, type Candidate, type Judge, type JudgeResult, type Role, type ScoreCard } from "../core/types";

/*
 * JD + CV in, scored result out. The UI never calls engines directly: this is
 * the one path, so blind mode, the evidence gate and scoring can't be skipped.
 */

export interface MatchInput {
  jdText: string;
  cvText: string;
  blind: boolean;
  keepLocation: boolean;
  label?: string;
}

export interface MatchOutput {
  role: Role;
  candidate: Candidate;
  result: JudgeResult;
  scorecard: ScoreCard;
  redactions: Redaction[];
}

export const newId = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;

export function roleFromJd(jdText: string, now = Date.now()): Role {
  const x = extractRole(jdText);
  return {
    id: newId(),
    title: x.title,
    company: x.company,
    jdText,
    criteria: x.criteria,
    weights: { ...DEFAULT_WEIGHTS },
    logistics: x.logistics,
    createdAt: now,
    updatedAt: now,
  };
}

export function candidateFromText(cvText: string, opts: { blind: boolean; keepLocation: boolean; label?: string; fileName?: string }): { candidate: Candidate; redactions: Redaction[] } {
  const r = redact(cvText, { keepLocation: opts.keepLocation });
  const text = opts.blind ? r.text : cvText;
  const candidate: Candidate = {
    id: newId(),
    label: opts.label ?? "Candidate A",
    fileName: opts.fileName,
    rawText: cvText,
    text,
    lines: toLines(text),
    blind: opts.blind,
    detectedName: r.detectedName,
    revealed: !opts.blind,
    addedAt: Date.now(),
  };
  return { candidate, redactions: opts.blind ? r.redactions : [] };
}

export async function judgeAndScore(role: Role, candidate: Candidate, judge: Judge = new LocalJudge(), signal?: AbortSignal) {
  const result = await judge.judge({ role, lines: candidate.lines }, signal);
  // Belt and braces: engines normalise, but the pipeline never trusts that they did.
  const judgments = normalize(result.judgments, role.criteria, candidate.lines);
  const checked = { ...result, judgments };
  return { result: checked, scorecard: score(role.criteria, judgments, role.weights) };
}

export async function quickMatch(input: MatchInput, judge?: Judge): Promise<MatchOutput> {
  const role = roleFromJd(input.jdText);
  const { candidate, redactions } = candidateFromText(input.cvText, input);
  const { result, scorecard } = await judgeAndScore(role, candidate, judge);
  return { role, candidate, result, scorecard, redactions };
}
