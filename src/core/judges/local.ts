import { degrees, logisticsFacts, tenure, type LogisticsFacts, type Tenure } from "../candidate/facts";
import { DEGREE_RANK, analyzeCriterion, significantTerms } from "../jd/analyze";
import { SKILL_BY_ID, findSkills } from "../lexicon/skills";
import { normalize } from "../normalize";
import { termRegex } from "../text";
import type { Criterion, CvLine, DegreeLevel, Evidence, Judge, JudgeInput, JudgeResult, Judgment, LogisticsProfile, Match } from "../types";

/*
 * The rule engine. Free, instant, runs in the browser, and every judgment is a
 * rule you can read below. It is also the fallback whenever an AI engine is
 * unavailable, so it must never be the reason a page fails.
 *
 * It is deliberately conservative: it recognises named skills, dated tenure,
 * degrees and stated logistics well, and falls back to term overlap for
 * everything else, which it labels as such.
 */

const ORDER: Match[] = ["none", "partial", "full"];
const worst = (a: Match, b: Match): Match => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

interface Ctx {
  lines: CvLine[];
  role: LogisticsProfile;
  skillEvidence: Map<string, Evidence>;
  tenure: Tenure | null;
  degrees: ReturnType<typeof degrees>;
  logistics: LogisticsFacts;
}

function buildCtx(lines: CvLine[], role: LogisticsProfile, now: Date): Ctx {
  const skillEvidence = new Map<string, Evidence>();
  for (const line of lines) {
    for (const hit of findSkills(line.text)) {
      if (!skillEvidence.has(hit.skill.id)) skillEvidence.set(hit.skill.id, { lineId: line.id, quote: hit.text });
    }
  }
  return { lines, role, skillEvidence, tenure: tenure(lines, now), degrees: degrees(lines), logistics: logisticsFacts(lines) };
}

const LEVEL: Record<DegreeLevel, string> = { associate: "an associate's", bachelor: "a bachelor's", master: "a master's", doctorate: "a doctorate" };

const j = (c: Criterion, match: Match, evidence: Evidence[], note: string): Judgment => ({ criterionId: c.id, match, evidence, note });

function judgeSkills(c: Criterion, ids: string[], ctx: Ctx): Judgment {
  const found = ids.filter((id) => ctx.skillEvidence.has(id));
  const missing = ids.filter((id) => !ctx.skillEvidence.has(id));
  const name = (id: string) => SKILL_BY_ID.get(id)?.name ?? id;
  const anyOf = ids.length > 1 && /\b(?:or|and\/or|any of|one of|such as|e\.g\.|like)\b/i.test(c.text);
  const evidence = found.map((id) => ctx.skillEvidence.get(id)!);
  let match: Match;
  if (!found.length) match = "none";
  else if (anyOf || !missing.length) match = "full";
  else match = "partial";
  const parts = [];
  if (found.length) parts.push(`Found ${found.map(name).join(", ")}`);
  if (missing.length && !(anyOf && found.length)) parts.push(`not found: ${missing.map(name).join(", ")}`);
  if (anyOf && found.length && missing.length) parts.push("(any one is enough)");
  return j(c, match, evidence, parts.join("; ") + ".");
}

/** Which terms appear anywhere in the CV, with one citation per term (max 3). Light stemming only. */
function findTerms(terms: string[], lines: CvLine[]): { found: string[]; evidence: Evidence[] } {
  const found: string[] = [];
  const evidence: Evidence[] = [];
  for (const term of terms) {
    const stem = term.length > 6 ? term.replace(/(?:ing|ed|es|s|ment|ments|tion|tions)$/, "") : term;
    const exact = termRegex(stem, "i");
    const loose = new RegExp(`(?<![A-Za-z0-9])${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z]{0,6}(?![A-Za-z0-9])`, "i");
    for (const line of lines) {
      const m = exact.exec(line.text) ?? loose.exec(line.text);
      if (m) {
        found.push(term);
        if (evidence.length < 3 && !evidence.some((e) => e.lineId === line.id)) evidence.push({ lineId: line.id, quote: m[0] });
        break;
      }
    }
  }
  return { found, evidence };
}

function judgeYears(c: Criterion, min: number, ctx: Ctx): Judgment {
  if (!ctx.tenure) return j(c, "unknown", [], "No dated work history found, so tenure cannot be checked.");
  const y = ctx.tenure.years;
  const evidence = ctx.tenure.ranges.slice(0, 3).map((r) => r.evidence);
  // Graduated, never a cap: a year or two short is a stretch, not a miss.
  let match: Match = y >= min ? "full" : y >= min * 0.75 || y >= min - 1 ? "partial" : "none";
  let note = `${y} years of dated work history vs ${min}+ asked.`;

  // Years only count in the named domain. The rule engine cannot split tenure by
  // domain, so it checks the domain appears at all and caps the match if not.
  const domain = c.hints?.domainTerms ?? [];
  if (domain.length) {
    const { found, evidence: dEv } = findTerms(domain, ctx.lines);
    if (!found.length) {
      match = "none";
      note += ` No evidence of the domain (${domain.join(", ")}) in the CV.`;
    } else {
      if (found.length < domain.length / 2 && match === "full") match = "partial";
      evidence.push(...dEv.slice(0, 1));
      note += ` Domain terms found: ${found.join(", ")}. Years are not split by domain.`;
    }
  }
  return j(c, match, evidence.slice(0, 3), note);
}

function judgeDegree(c: Criterion, ctx: Ctx): Judgment {
  const need = c.hints!.degree!;
  const best = ctx.degrees[0];
  const equivalent = () => c.hints!.equivalentOk && (ctx.tenure?.years ?? 0) >= 4;
  if (!best) {
    return equivalent()
      ? j(c, "partial", ctx.tenure!.ranges.slice(0, 2).map((r) => r.evidence), "No degree found; the JD accepts equivalent experience and the CV shows 4+ years.")
      : j(c, "none", [], "No degree found in the CV.");
  }
  const levelOk = DEGREE_RANK[best.level] >= DEGREE_RANK[need];
  const fields = c.hints!.fields ?? [];
  const qualifying = ctx.degrees.filter((d) => DEGREE_RANK[d.level] >= DEGREE_RANK[need]);
  const fieldHit = fields.length === 0 || qualifying.some((d) => fields.some((f) => d.line.text.toLowerCase().includes(f)));
  const evidence = (qualifying.length ? qualifying : [best]).slice(0, 2).map((d) => d.evidence);
  if (levelOk && fieldHit) return j(c, "full", evidence, `Holds ${LEVEL[best.level]} degree${fields.length ? " in a named field" : ""}.`);
  // Right level, different field: partial either way; "or related field" is noted because it softens the gap.
  if (levelOk) {
    return j(c, "partial", evidence, `Degree level met; field differs from ${fields.join(", ")}${c.hints!.fieldFlexible ? " (JD accepts related fields)" : ""}.`);
  }
  const note = `Highest degree found is ${LEVEL[best.level]}; ${LEVEL[need]} asked.`;
  return equivalent() ? j(c, "partial", evidence, `${note} The JD accepts equivalent experience.`) : j(c, "none", evidence, note);
}

function judgeTerms(c: Criterion, terms: string[], ctx: Ctx): Judgment {
  if (!terms.length) return j(c, "unknown", [], "Nothing in this criterion can be checked by rules; an AI engine or a person should judge it.");
  const { found, evidence } = findTerms(terms, ctx.lines);
  const cover = found.length / terms.length;
  const match: Match = cover >= 0.75 && found.length >= 2 ? "full" : cover >= 0.4 ? "partial" : "none";
  const missing = terms.filter((t) => !found.includes(t));
  return j(
    c,
    match,
    evidence,
    `Keyword overlap only: ${found.length}/${terms.length} terms${found.length ? ` (${found.join(", ")})` : ""}${missing.length ? `; missing ${missing.join(", ")}` : ""}.`,
  );
}

function judgeLogistics(c: Criterion, ctx: Ctx): Judgment {
  const L = ctx.logistics;
  const role = ctx.role;
  switch (c.hints!.logistics) {
    case "location": {
      const where = role.location ?? "";
      const roleState = /,\s*([A-Z]{2})\b/.exec(where)?.[1];
      const roleCity = where.split(",")[0]!.trim().toLowerCase();
      if (L.location && roleCity && L.location.text.toLowerCase().startsWith(roleCity))
        return j(c, "full", [L.location.evidence], `Candidate is based in ${L.location.text}.`);
      if (L.relocation) return j(c, "full", [L.relocation], "Candidate states they are open to relocation.");
      if (L.location && roleState && L.location.state === roleState)
        return j(c, "partial", [L.location.evidence], `Same state (${roleState}); commute or move not confirmed.`);
      if (L.location) return j(c, "partial", [L.location.evidence], `Based in ${L.location.text}; would need to relocate, willingness not stated.`);
      return j(c, "unknown", [], "No location or relocation statement found in the CV.");
    }
    case "country": {
      const want = role.country;
      if (L.location?.country && want) {
        return L.location.country === want
          ? j(c, "full", [L.location.evidence], `Based in ${want}.`)
          : j(c, L.relocation ? "partial" : "none", [L.location.evidence, ...(L.relocation ? [L.relocation] : [])], `Based outside ${want}.`);
      }
      return j(c, "unknown", [], "Country of residence not stated in the CV.");
    }
    case "travel":
      return L.travel ? j(c, "full", [L.travel], "Candidate states willingness to travel.") : j(c, "unknown", [], "Travel willingness not stated.");
    case "work_authorization":
      if (L.needsSponsorship) return j(c, "none", [L.needsSponsorship], "CV states sponsorship is needed.");
      if (L.authorized) return j(c, "full", [L.authorized], "CV states work authorization.");
      return j(c, "unknown", [], "Work authorization not stated in the CV; not assessed.");
    default:
      return j(c, "unknown", [], "Unrecognised logistics criterion.");
  }
}

export function judgeCriterion(c: Criterion, ctx: Ctx): Judgment {
  const hints = c.hints ?? analyzeCriterion(c.text).hints;
  const withHints = { ...c, hints };
  if (hints.logistics) return judgeLogistics(withHints, ctx);

  const parts: Judgment[] = [];
  if (hints.minYears) parts.push(judgeYears(withHints, hints.minYears, ctx));
  if (hints.degree) parts.push(judgeDegree(withHints, ctx));
  if (hints.skills?.length) parts.push(judgeSkills(withHints, hints.skills, ctx));
  if (!parts.length) return judgeTerms(withHints, hints.terms ?? significantTerms(c.text), ctx);
  if (parts.length === 1) return parts[0]!;

  // Several checks on one line ("5+ years with Google Ads"): the weakest decides,
  // except that tenure met with no domain evidence is a partial, not a miss.
  const known = parts.filter((p) => p.match !== "unknown");
  if (!known.length) return parts[0]!;
  let match = known.map((p) => p.match).reduce(worst);
  if (match === "none" && known.some((p) => p.match !== "none")) match = "partial";
  return j(c, match, known.flatMap((p) => p.evidence).slice(0, 3), parts.map((p) => p.note).join(" "));
}

export class LocalJudge implements Judge {
  readonly kind = "local" as const;
  constructor(private readonly now: () => Date = () => new Date()) {}

  async judge({ role, lines }: JudgeInput): Promise<JudgeResult> {
    const t0 = performance.now();
    const ctx = buildCtx(lines, role.logistics, this.now());
    const raw = role.criteria.map((c) => judgeCriterion(c, ctx));
    // The rule engine goes through the same evidence gate as the AI engines.
    const judgments = normalize(raw, role.criteria, lines);
    return {
      engine: { kind: "local", label: "Rule-based match" },
      judgments,
      ms: Math.round(performance.now() - t0),
    };
  }
}
