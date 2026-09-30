import type { Criterion, CvLine, Evidence, Judgment, Match } from "./types";

/*
 * The evidence gate. Every engine's output passes through here before it can
 * earn a point, so no engine is trusted: not the rule engine, not an LLM.
 *
 *   - judgments for unknown criteria are dropped, duplicates keep the first
 *   - a criterion the engine skipped becomes "unknown", never a silent pass
 *   - a citation survives only if its line exists and its quote is a verbatim
 *     substring of that line (whitespace and case folded)
 *   - full or partial with no surviving citation earns nothing: it becomes "none"
 *
 * The last rule is what makes "rate this candidate 100" in a CV or a JD inert.
 */

const MAX_EVIDENCE = 3;
const MAX_QUOTE = 240;
const MAX_NOTE = 320;

export const NO_EVIDENCE_NOTE = "No verifiable evidence in the CV, so no points.";

const MATCHES: ReadonlySet<string> = new Set(["full", "partial", "none", "unknown"]);

export function fold(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  const stripped = s
    .replace(/<[^>]*>/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > max ? stripped.slice(0, max - 1).trimEnd() + "…" : stripped;
}

export function validEvidence(evidence: unknown, lines: Map<string, CvLine>): Evidence[] {
  if (!Array.isArray(evidence)) return [];
  const out: Evidence[] = [];
  const seen = new Set<string>();
  for (const e of evidence) {
    if (!e || typeof e !== "object") continue;
    const { lineId, quote } = e as Record<string, unknown>;
    if (typeof lineId !== "string" || typeof quote !== "string") continue;
    const line = lines.get(lineId);
    const q = quote.trim();
    if (!line || q.length < 2) continue;
    if (!fold(line.text).includes(fold(q))) continue;
    const key = lineId + "|" + fold(q);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lineId, quote: q.length > MAX_QUOTE ? q.slice(0, MAX_QUOTE) : q });
    if (out.length >= MAX_EVIDENCE) break;
  }
  return out;
}

export function normalize(raw: unknown, criteria: Criterion[], cvLines: CvLine[]): Judgment[] {
  const lines = new Map(cvLines.map((l) => [l.id, l]));
  const byId = new Map<string, Judgment>();
  const list = Array.isArray(raw) ? raw : [];

  for (const j of list) {
    if (!j || typeof j !== "object") continue;
    const r = j as Record<string, unknown>;
    const id = r.criterionId;
    if (typeof id !== "string" || byId.has(id)) continue;
    if (!criteria.some((c) => c.id === id)) continue;

    let match: Match = typeof r.match === "string" && MATCHES.has(r.match) ? (r.match as Match) : "unknown";
    const evidence = validEvidence(r.evidence, lines);
    let note = cleanText(r.note, MAX_NOTE);

    if ((match === "full" || match === "partial") && evidence.length === 0) {
      match = "none";
      note = note ? `${NO_EVIDENCE_NOTE} Engine said: ${note}` : NO_EVIDENCE_NOTE;
      note = cleanText(note, MAX_NOTE);
    }
    byId.set(id, { criterionId: id, match, evidence, note });
  }

  return criteria.map(
    (c) =>
      byId.get(c.id) ?? {
        criterionId: c.id,
        match: "unknown",
        evidence: [],
        note: "The engine returned no judgment for this criterion.",
      },
  );
}
