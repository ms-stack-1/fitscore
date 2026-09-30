import { findSkills } from "../lexicon/skills";
import type { Category, CriterionHints, DegreeLevel } from "../types";

/*
 * Reads one requirement sentence and recovers what can be checked mechanically:
 * named skills, a years bar, a degree, or failing those, its significant terms.
 * Used for extracted criteria and for any criterion a recruiter types in.
 */

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15,
};

const YEARS = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen)\s*\+?\s*(?:(?:-|–|to)\s*(?:\d{1,2})\s*\+?\s*)?(?:years?|yrs?)\b/i;

export const DEGREE_PATTERNS: [DegreeLevel, RegExp][] = [
  ["doctorate", /\b(?:ph\.?\s?d|doctorate|doctoral)\b/i],
  ["master", /\b(?:master'?s?|mba|m\.?\s?s\.?c?|m\.?\s?a\.?|m\.?\s?eng|msc|graduate degree)(?![a-z])/i],
  ["bachelor", /\b(?:bachelor'?s?|b\.?\s?s\.?c?|b\.?\s?a\.?|b\.?\s?eng|bsc|undergraduate degree|(?:4|four)[- ]year degree|college degree|university degree)(?![a-z])/i],
  ["associate", /\bassociate'?s?\s+degree\b/i],
];

export const DEGREE_RANK: Record<DegreeLevel, number> = { associate: 1, bachelor: 2, master: 3, doctorate: 4 };

const FIELD_FLEX = /\b(?:or (?:a |another )?(?:related|similar|relevant)|related (?:field|discipline|area)|or similar)\b/i;
const EQUIVALENT_OK = /\b(?:or equivalent|equivalent (?:practical |work |professional |relevant )?experience|in lieu of (?:a )?degree)\b/i;
/** Skill groups that are behaviours, not tools: they never make a criterion "technical". */
const SOFT_GROUPS = new Set(["Languages", "People"]);

const STOP = new Set(
  (
    "a an and or the of to in on for with by from as at into via per is are be been being this that these those it its our your their you we they " +
    "will would should must can could may might able ability abilities strong excellent good great solid proven demonstrated deep " +
    "experience experienced knowledge understanding familiarity familiar proficiency proficient skills skill skilled expertise expert " +
    "work working works worked role team teams including include includes such other others etc using use used new high highly " +
    "year years plus preferred required requirement requirements nice have has having ideal ideally bonus desired desirable " +
    "ensure ensuring help helping support supporting drive driving manage managing develop developing build building create creating " +
    "own owning lead leading across within well both also all any each more most very key various multiple related relevant based " +
    "environment fast paced fastpaced dynamic self starter detail oriented attention detailoriented passion passionate comfortable " +
    "communication written verbal interpersonal collaborate collaboration collaborative stakeholders partner partners partnering business company"
  ).split(/\s+/),
);

export function parseYears(text: string): number | undefined {
  const m = YEARS.exec(text);
  if (!m) return undefined;
  const raw = m[1]!.toLowerCase();
  const n = NUM_WORDS[raw] ?? Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 30 ? n : undefined;
}

export function parseDegree(text: string): DegreeLevel | undefined {
  for (const [level, re] of DEGREE_PATTERNS) if (re.test(text)) return level;
  return undefined;
}

function parseFields(text: string): string[] {
  const m = /\b(?:degree|bachelor'?s?|master'?s?|b\.?s\.?|m\.?s\.?|ba|ma|mba)\b[^.;:]*?\bin\s+([^.;:()]+)/i.exec(text);
  if (!m) return [];
  return m[1]!
    .split(/,|\bor\b|\band\b|\//i)
    .map((s) => s.replace(/\b(?:a|an|the|related|similar|relevant|equivalent|field|fields|discipline|area|quantitative)\b/gi, "").trim().toLowerCase())
    .filter((s) => s.length >= 3 && s.length <= 40);
}

export function significantTerms(text: string, max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#.&/-]+/)) {
    const w = raw.replace(/^[.\-/&]+|[.\-/&]+$/g, "");
    if (w.length < 4 || STOP.has(w) || /^\d+%?$/.test(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

export interface CriterionAnalysis {
  category: Category;
  hints: CriterionHints;
}

export function analyzeCriterion(text: string): CriterionAnalysis {
  const hints: CriterionHints = {};
  const hits = findSkills(text);
  const skills = hits.map((h) => h.skill);
  const hardSkills = skills.filter((s) => !SOFT_GROUPS.has(s.group));
  // Soft skills alone ("presenting to executives") are judged by term overlap on the whole sentence.
  if (hardSkills.length || skills.some((s) => s.group === "Languages")) hints.skills = skills.map((s) => s.id);
  const years = parseYears(text);
  if (years) {
    hints.minYears = years;
    // The domain the years must be in: what is left once the years phrase and named skills are removed.
    let rest = text.replace(/\b\d{1,2}\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs?)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen)\s+(?:years?|yrs?)\b/gi, " ");
    for (const h of hits) rest = rest.replace(h.text, " ");
    const domain = significantTerms(rest, 4);
    if (domain.length) hints.domainTerms = domain;
  }
  const degree = parseDegree(text);
  if (degree && /\bdegree\b|bachelor|master|mba|ph\.?d|doctorate|b\.?s\b|m\.?s\b|bsc|msc/i.test(text)) {
    hints.degree = degree;
    const fields = parseFields(text);
    if (fields.length) hints.fields = fields;
    if (FIELD_FLEX.test(text)) hints.fieldFlexible = true;
    if (EQUIVALENT_OK.test(text)) hints.equivalentOk = true;
  }
  if (!hints.skills && !hints.minYears && !hints.degree) {
    const terms = significantTerms(text);
    if (terms.length) hints.terms = terms;
  }

  // Years and degrees are qualifications; named tools are technical; everything
  // else (responsibilities, domain background, soft skills) is judged as experience.
  const category: Category = hints.minYears || hints.degree ? "experience" : hardSkills.length ? "technical" : "experience";
  return { category, hints };
}
