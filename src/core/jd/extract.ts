import { CITY_STATE } from "../redact";
import { normalizeText } from "../text";
import type { Criterion, LogisticsProfile, Priority, WorkMode } from "../types";
import { analyzeCriterion } from "./analyze";

/*
 * Rule-based JD reader. Produces a DRAFT for the recruiter to edit in role
 * setup, never a final list. Sections decide priority; logistics sentences
 * become the logistics profile instead of criteria.
 */

type Section = "must" | "nice" | "resp" | "skip" | "none";

const HEADINGS: [Exclude<Section, "none">, RegExp][] = [
  ["nice", /\b(?:preferred|nice[- ]to[- ]haves?|bonus|pluses|desired|desirable|additional (?:skills|qualifications)|ideally|extra credit|good to have)\b/i],
  [
    "must",
    /\b(?:requirements?|qualifications|what you(?:'ll)? (?:bring|need)|must[- ]haves?|you have|who you are|about you|skills(?: (?:and|&) experience)?|what we(?:'re| are) looking for|minimum|basic|required|essential|the ideal candidate|experience)\b/i,
  ],
  ["resp", /\b(?:responsibilities|what you(?:'ll)? do|the role|your role|your impact|day[- ]to[- ]day|duties|in this role|key tasks|you will|what you will be doing|the job|about the role|job description|role overview)\b/i],
  ["skip", /\b(?:benefits|perks|what we offer|compensation|salary|pay range|about (?:us|the company|the team)|who we are|equal opportunity|eeo|our values|why join|why work|how to apply|culture|diversity|accommodations?|privacy|disclaimer)\b/i],
];

const BULLET = /^\s*(?:[-*•▪●◦‣⁃·>]|\d{1,2}[.)])\s+/;
const NICE_CUE = /\b(?:preferred|a plus|is a plus|nice to have|bonus|ideally|desirable|an advantage|advantageous|not required|beneficial)\b/i;
const LOGISTICS_CUE =
  /\b(?:remote|hybrid|on-?site|in[- ]office|in person|relocat\w*|travel|visa|sponsor\w*|authori[sz]ed to work|work authori[sz]ation|located in|based in|reside|time ?zone|commut\w*)\b/i;
const REQUIREMENT_CUE =
  /\b(?:experience|proficien\w*|knowledge of|familiar\w*|degree|years?|expertise|skilled|ability to|track record|background in|understanding of|hands-on|certif\w*)\b/i;

const MAX_CRITERIA = 25;
const MAX_RESP = 8;

export interface ExtractedRole {
  title: string;
  company?: string;
  criteria: Criterion[];
  logistics: LogisticsProfile;
}

function headingOf(line: string): Exclude<Section, "none"> | null {
  const t = line.replace(BULLET, "").trim();
  const isHeadingShape = t.length <= 70 && (/:$/.test(t) || (!/[.!?]$/.test(t) && t.split(/\s+/).length <= 8));
  if (!isHeadingShape || BULLET.test(line)) return null;
  for (const [section, re] of HEADINGS) if (re.test(t)) return section;
  return null;
}

function sentences(line: string): string[] {
  return line.split(/(?<=[.;!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
}

function guessTitle(lines: string[]): { title: string; company?: string } {
  let title = "Untitled role";
  let company: string | undefined;
  for (const l of lines.slice(0, 6)) {
    const t = l.replace(BULLET, "").trim();
    const labelled = /^(?:job\s+)?title\s*[:-]\s*(.+)$/i.exec(t);
    const comp = /^company\s*[:-]\s*(.+)$/i.exec(t);
    if (comp) company = comp[1]!.trim();
    if (labelled) {
      title = labelled[1]!.trim();
      continue;
    }
    if (title === "Untitled role" && t.length > 3 && t.length <= 80 && !headingOf(t) && !/[.!?]$/.test(t) && !/^(?:about|location|salary)/i.test(t)) {
      const at = /^(.+?)\s+(?:at|@|–|—|-|\|)\s+([A-Z][\w&.,' -]{1,40})$/.exec(t);
      if (at) {
        title = at[1]!.trim();
        company ??= at[2]!.trim();
      } else title = t;
    }
  }
  return { title, company };
}

const COUNTRY_ALIASES: [string, RegExp][] = [
  ["US", /\b(?:US|U\.S\.A?\.?|USA|United States)\b/],
  ["UK", /\b(?:UK|U\.K\.|United Kingdom|Great Britain)\b/],
  ["Canada", /\bCanada\b/],
  ["EU", /\b(?:EU|European Union|Europe)\b/],
  ["UAE", /\b(?:UAE|United Arab Emirates|Dubai|Abu Dhabi)\b/],
  ["India", /\bIndia\b/],
  ["Australia", /\bAustralia\b/],
];

export function countryOf(text: string): string | undefined {
  for (const [name, re] of COUNTRY_ALIASES) if (re.test(text)) return name;
  return undefined;
}

export function extractLogistics(text: string): LogisticsProfile {
  const t = text;
  let workMode: WorkMode = "unspecified";
  const fullyRemote = /\b(?:fully|100%|completely)\s+remote\b|\bremote[- ]first\b|\bwork from anywhere\b/i.test(t);
  const hybrid = /\bhybrid\b/i.test(t);
  const onsite = /\b(?:on-?site|in[- ]office|in person|office[- ]based)\b/i.test(t) && !/\bno (?:on-?site|office)\b/i.test(t);
  const remote = /\bremote\b/i.test(t) && !/\b(?:not|no) remote\b|\bnon-remote\b/i.test(t);
  if (fullyRemote) workMode = "remote";
  else if (hybrid) workMode = "hybrid";
  else if (onsite) workMode = "onsite";
  else if (remote) workMode = "remote";

  const labelled = /\blocation\s*[:-]\s*([^\n|;]{2,60})/i.exec(t);
  const cityState = new RegExp(CITY_STATE.source).exec(t);
  let location: string | undefined = cityState?.[0].replace(/\s+\d{5}(?:-\d{4})?$/, "");
  if (!location && labelled && !/^remote\b/i.test(labelled[1]!.trim())) location = labelled[1]!.trim();

  let country: string | undefined;
  const remoteScope = /\bremote\s*[(-]?\s*([^)\n.;]{2,40})\)?/i.exec(t);
  if (remoteScope) country = countryOf(remoteScope[1]!);
  const reside = /\b(?:must|should)\s+(?:reside|be (?:located|based))\s+in\s+(?:the\s+)?([^\n.;,]{2,40})/i.exec(t);
  if (!country && reside) country = countryOf(reside[1]!);
  if (!country && cityState) country = "US";
  if (!country && location) country = countryOf(location);

  let relocationSupport: boolean | undefined;
  if (/\b(?:no|not)\s+(?:offer(?:ing)?\s+)?relocation\b|\brelocation (?:is )?not (?:provided|available|offered)\b/i.test(t)) relocationSupport = false;
  else if (/\brelocation (?:assistance|support|package|stipend|provided|available|offered)\b|\b(?:offer|provide)s? relocation\b/i.test(t)) relocationSupport = true;

  let travelPercent: number | undefined;
  const travel = /travel[^.\n%]{0,40}?(\d{1,2})\s*%|(\d{1,2})\s*%[^.\n]{0,25}travel/i.exec(t);
  if (travel) travelPercent = Number(travel[1] ?? travel[2]);

  let sponsorship: LogisticsProfile["sponsorship"] = "unspecified";
  if (
    /\b(?:unable|not able|cannot|can't|will not|won't|do not|does not|don't|not)\s+(?:to\s+)?(?:currently\s+)?(?:provide|offer|able to offer)?\s*(?:visa\s+|employment\s+|immigration\s+)?sponsor/i.test(t) ||
    /\bwithout (?:the need for |requiring )?(?:current or future )?(?:visa |employment )?sponsorship\b|\bno (?:visa )?sponsorship\b|\bsponsorship (?:is )?not (?:available|provided|offered)\b/i.test(t)
  )
    sponsorship = "not_available";
  else if (/\b(?:visa )?sponsorship (?:is )?(?:available|provided|offered)\b|\bwill sponsor\b|\bwe sponsor\b/i.test(t)) sponsorship = "available";

  return { workMode, location, country, relocationSupport, travelPercent, sponsorship };
}

/** Logistics constraints become criteria so they score like everything else. Ids are stable per kind. */
export function logisticsCriteria(p: LogisticsProfile): Criterion[] {
  const out: Criterion[] = [];
  const base = { category: "logistics" as const, source: "extracted" as const, knockout: false };
  if ((p.workMode === "onsite" || p.workMode === "hybrid") && p.location) {
    out.push({ ...base, id: "LG-location", text: `Able to work ${p.workMode === "onsite" ? "on-site" : "hybrid"} in ${p.location}`, priority: "must", weight: 3, hints: { logistics: "location" } });
  }
  if (p.workMode === "remote" && p.country) {
    out.push({ ...base, id: "LG-country", text: `Able to work remotely from ${p.country}`, priority: "must", weight: 3, hints: { logistics: "country" } });
  }
  if (p.travelPercent && p.travelPercent >= 15) {
    out.push({ ...base, id: "LG-travel", text: `Able to travel up to ${p.travelPercent}%`, priority: "nice", weight: 1, hints: { logistics: "travel" } });
  }
  if (p.sponsorship === "not_available") {
    out.push({ ...base, id: "LG-auth", text: "Authorized to work without visa sponsorship", priority: "must", weight: 3, hints: { logistics: "work_authorization" } });
  }
  return out;
}

export function extractRole(jdText: string): ExtractedRole {
  const text = normalizeText(jdText);
  const lines = text.split("\n");
  const { title, company } = guessTitle(lines.filter((l) => l.trim()));

  type Draft = { text: string; section: Section; order: number };
  const drafts: Draft[] = [];
  let section: Section = "none";
  let order = 0;
  let sawSections = false;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const h = headingOf(rawLine);
    if (h) {
      section = h;
      sawSections = true;
      continue;
    }
    if (section === "skip") continue;
    const clean = rawLine.replace(BULLET, "").trim();
    const isBullet = BULLET.test(rawLine);
    for (const s of isBullet ? [clean] : sentences(clean)) {
      const words = s.split(/\s+/).length;
      if (words < 3 || words > 60) continue;
      if (LOGISTICS_CUE.test(s) && !REQUIREMENT_CUE.test(s.replace(LOGISTICS_CUE, ""))) continue;
      // Bullets are the JD's own list of asks. Prose is mostly context ("We are hiring…",
      // "You will report to…"), so it only counts when it reads as a requirement.
      if (!isBullet && section !== "must" && section !== "nice" && !REQUIREMENT_CUE.test(s)) continue;
      drafts.push({ text: s.replace(/[;.]$/, ""), section, order: order++ });
    }
  }

  // Without recognisable sections, only sentences that read as requirements survive (filtered above).
  const rank = (d: Draft) => (d.section === "must" || (!sawSections && d.section === "none") ? 0 : d.section === "nice" ? 1 : 2);
  const seen = new Set<string>();
  let respCount = 0;
  const chosen = drafts
    .filter((d) => {
      const key = d.text.toLowerCase().replace(/\W+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
    .filter((d) => (d.section === "resp" ? ++respCount <= MAX_RESP : true));

  const logistics = extractLogistics(text);
  const lg = logisticsCriteria(logistics);

  const criteria: Criterion[] = [];
  for (const d of chosen) {
    if (criteria.length >= MAX_CRITERIA - lg.length) break;
    const { category, hints } = analyzeCriterion(d.text);
    const nice = d.section === "nice" || NICE_CUE.test(d.text);
    const priority: Priority = nice ? "nice" : "must";
    const weight = nice ? 1 : d.section === "resp" ? 2 : 3;
    criteria.push({ id: `C${criteria.length + 1}`, text: d.text, category, priority, weight, knockout: false, source: "extracted", hints });
  }
  // Restore reading order within priority for display: musts first, then nice-to-haves.
  criteria.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "must" ? -1 : 1));

  return { title, company, criteria: [...criteria, ...lg], logistics };
}
