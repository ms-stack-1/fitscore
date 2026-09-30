import { parseFile } from "../core/parse/index";
import type { Candidate, CandidateResult, Judge, Role } from "../core/types";
import { candidateFromText, judgeAndScore } from "./pipeline";
import { labelFor, scoringKey } from "./roles";

/*
 * Bulk applicant processing: parse, redact, line-number, judge, score.
 * Each file is independent, so one bad file never stops the batch.
 */

export interface QueueItem {
  id: string;
  name: string;
  state: "queued" | "reading" | "scoring" | "done" | "error";
  message?: string;
}

export async function addApplicant(
  role: Role,
  existing: Candidate[],
  input: { text: string; fileName?: string },
  judge: Judge,
  signal?: AbortSignal,
): Promise<{ candidate: Candidate; result: CandidateResult }> {
  const { candidate } = candidateFromText(input.text, {
    blind: role.blind ?? true,
    keepLocation: role.keepLocation ?? true,
    label: labelFor(existing.length),
    fileName: input.fileName,
  });
  const scored = await judgeAndScore(role, candidate, judge, signal);
  return {
    candidate,
    result: { candidateId: candidate.id, roleId: role.id, result: scored.result, scorecard: scored.scorecard, scoredAt: Date.now(), roleKey: scoringKey(role) },
  };
}

export async function readApplicantFile(file: File): Promise<{ text: string; warnings: string[] }> {
  const out = await parseFile(file);
  return { text: out.text, warnings: out.warnings };
}

export async function rescore(role: Role, candidate: Candidate, judge: Judge, signal?: AbortSignal): Promise<CandidateResult> {
  const scored = await judgeAndScore(role, candidate, judge, signal);
  return { candidateId: candidate.id, roleId: role.id, result: scored.result, scorecard: scored.scorecard, scoredAt: Date.now(), roleKey: scoringKey(role) };
}

export type SortKey = "overall" | "technical" | "experience" | "logistics" | "label";

export interface Row {
  candidate: Candidate;
  result?: CandidateResult;
  stale: boolean;
}

export function rankRows(rows: Row[], key: SortKey, dir: "asc" | "desc"): Row[] {
  const val = (r: Row): number | string => {
    if (key === "label") return r.candidate.revealed && r.candidate.detectedName ? r.candidate.detectedName : r.candidate.label;
    if (!r.result) return -1;
    if (key === "overall") return r.result.scorecard.overall;
    return r.result.scorecard.categories[key].score ?? -1;
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : va - (vb as number);
    // Ties fall back to the overall score, then to upload order: stable and explainable.
    return sign * cmp || (b.result?.scorecard.overall ?? -1) - (a.result?.scorecard.overall ?? -1) || a.candidate.addedAt - b.candidate.addedAt;
  });
}

/** The single costliest lost criterion: "what is the main gap?" in one line. */
export function topGap(result: CandidateResult | undefined): string | undefined {
  if (!result) return undefined;
  let best: { lost: number; text: string } | undefined;
  for (const cs of Object.values(result.scorecard.categories)) {
    for (const i of cs.items) {
      const lost = i.possible - i.earned;
      if (lost > 0 && (!best || lost > best.lost)) best = { lost, text: i.criterion.text };
    }
  }
  return best?.text;
}
