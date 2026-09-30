import { bandLabel } from "./score";
import type { Candidate, CandidateResult, Category, Role } from "./types";

/*
 * The paper trail. Everything needed to explain a shortlist after the fact:
 * the criteria and weights as they stood, which engine judged each candidate,
 * every judgment with its evidence, and every time a blind candidate was
 * revealed. Built for "why was this person ranked here?" to have an answer.
 */

export type AuditEventKind = "reveal" | "scored" | "criteria_changed" | "exported";

export interface AuditEvent {
  ts: number;
  kind: AuditEventKind;
  candidateId?: string;
  detail?: string;
}

export interface AuditJudgment {
  criterionId: string;
  criterion: string;
  category: Category;
  priority: string;
  weight: number;
  knockout: boolean;
  match: string;
  earned: number;
  possible: number;
  note: string;
  evidence: { lineId: string; quote: string }[];
}

export interface AuditCandidate {
  candidateId: string;
  label: string;
  revealedName?: string;
  blind: boolean;
  engine: string;
  model?: string;
  fallbackReason?: string;
  scoredAt: string;
  overall: number;
  band: string;
  categories: Record<Category, number | null>;
  appliedWeights: Record<Category, number>;
  flags: string[];
  judgments: AuditJudgment[];
}

export interface AuditBundle {
  app: "FitScore";
  schemaVersion: 1;
  generatedAt: string;
  notice: string;
  role: Pick<Role, "id" | "title" | "company" | "criteria" | "weights" | "logistics">;
  candidates: AuditCandidate[];
  events: { at: string; kind: AuditEventKind; candidateId?: string; detail?: string }[];
}

export const DECISION_NOTICE =
  "FitScore ranks evidence against recruiter-defined criteria. A person makes every hiring decision; no candidate is rejected automatically.";

const iso = (ts: number) => new Date(ts).toISOString();

export function buildAudit(
  role: Role,
  entries: { candidate: Candidate; result: CandidateResult }[],
  events: AuditEvent[],
  now = Date.now(),
): AuditBundle {
  const candidates = [...entries]
    .sort((a, b) => b.result.scorecard.overall - a.result.scorecard.overall)
    .map(({ candidate, result }): AuditCandidate => {
      const card = result.scorecard;
      const byId = new Map(result.result.judgments.map((j) => [j.criterionId, j]));
      return {
        candidateId: candidate.id,
        label: candidate.label,
        revealedName: candidate.revealed ? candidate.detectedName : undefined,
        blind: candidate.blind,
        engine: result.result.engine.label,
        model: result.result.engine.model,
        fallbackReason: result.result.engine.fallbackReason,
        scoredAt: iso(result.scoredAt),
        overall: card.overall,
        band: bandLabel(card.band),
        categories: {
          technical: card.categories.technical.score,
          experience: card.categories.experience.score,
          logistics: card.categories.logistics.score,
          custom: card.categories.custom.score,
        },
        appliedWeights: card.appliedWeights,
        flags: card.flags.map((f) => f.message),
        judgments: role.criteria.map((c) => {
          const item = card.categories[c.category].items.find((i) => i.criterion.id === c.id);
          const jd = byId.get(c.id);
          return {
            criterionId: c.id,
            criterion: c.text,
            category: c.category,
            priority: c.priority,
            weight: c.weight,
            knockout: c.knockout,
            match: jd?.match ?? "unknown",
            earned: item?.earned ?? 0,
            possible: item?.possible ?? 0,
            note: jd?.note ?? "",
            evidence: jd?.evidence ?? [],
          };
        }),
      };
    });

  return {
    app: "FitScore",
    schemaVersion: 1,
    generatedAt: iso(now),
    notice: DECISION_NOTICE,
    role: { id: role.id, title: role.title, company: role.company, criteria: role.criteria, weights: role.weights, logistics: role.logistics },
    candidates,
    events: events.map((e) => ({ at: iso(e.ts), kind: e.kind, candidateId: e.candidateId, detail: e.detail })),
  };
}

export function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  // Neutralise spreadsheet formula injection from CV or JD text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const CSV_HEADER = [
  "rank", "candidate", "revealed_name", "overall", "band", "engine", "criterion_id", "criterion", "category",
  "priority", "weight", "knockout", "match", "earned", "possible", "evidence", "note",
];

export function auditToCsv(bundle: AuditBundle): string {
  const rows = [CSV_HEADER.join(",")];
  bundle.candidates.forEach((c, i) => {
    for (const j of c.judgments) {
      rows.push(
        [
          i + 1, c.label, c.revealedName ?? "", c.overall, c.band, c.engine, j.criterionId, j.criterion, j.category,
          j.priority, j.weight, j.knockout ? "yes" : "no", j.match, j.earned, j.possible,
          j.evidence.map((e) => `${e.lineId}: ${e.quote}`).join(" | "), j.note,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  });
  return rows.join("\r\n") + "\r\n";
}
