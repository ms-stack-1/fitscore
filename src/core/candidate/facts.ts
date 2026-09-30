import { DEGREE_RANK, parseDegree } from "../jd/analyze";
import { countryOf } from "../jd/extract";
import { CITY_STATE } from "../redact";
import type { CvLine, DegreeLevel, Evidence } from "../types";

/*
 * What can be read off a CV mechanically, each fact carrying the exact text it
 * came from so it can be cited.
 */

const MON = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const TOK = `(?:${MON}\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`;
const RANGE = new RegExp(`(${TOK})\\s*(?:-|\\u2013|\\u2014|to|until)\\s*(${TOK}|present|current|now|today|ongoing|date)`, "gi");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Month index since year 0. Year-only dates sit mid-year so ranges are neither inflated nor cut. */
function monthIndex(tok: string, now: Date): number | null {
  const t = tok.trim().toLowerCase();
  if (/^(?:present|current|now|today|ongoing|date)$/.test(t)) return now.getFullYear() * 12 + now.getMonth();
  const mY = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (mY) return Number(mY[2]) * 12 + Math.min(11, Math.max(0, Number(mY[1]) - 1));
  const monY = /^([a-z]+)\.?\s+(\d{4})$/.exec(t);
  if (monY) {
    const m = MONTHS.indexOf(monY[1]!.slice(0, 3));
    return m < 0 ? null : Number(monY[2]) * 12 + m;
  }
  const y = /^(\d{4})$/.exec(t);
  return y ? Number(y[1]) * 12 + 5 : null;
}

export interface DatedRange {
  start: number;
  end: number;
  evidence: Evidence;
}

export interface Tenure {
  years: number;
  ranges: DatedRange[];
}

export function tenure(lines: CvLine[], now = new Date()): Tenure | null {
  const ranges: DatedRange[] = [];
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  for (const line of lines) {
    if (line.section === "education") continue;
    for (const m of line.text.matchAll(RANGE)) {
      const start = monthIndex(m[1]!, now);
      const end = monthIndex(m[2]!, now);
      if (start === null || end === null || start > end || end > nowIdx + 1 || start < 1960 * 12) continue;
      ranges.push({ start, end, evidence: { lineId: line.id, quote: m[0] } });
    }
  }
  if (!ranges.length) return null;
  // Union of intervals so overlapping jobs are not double counted. Ranges are inclusive of both months.
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let months = 0;
  let curS = sorted[0]!.start;
  let curE = sorted[0]!.end;
  for (const r of sorted.slice(1)) {
    if (r.start <= curE + 1) curE = Math.max(curE, r.end);
    else {
      months += curE - curS + 1;
      curS = r.start;
      curE = r.end;
    }
  }
  months += curE - curS + 1;
  return { years: Math.round((months / 12) * 10) / 10, ranges };
}

export interface DegreeFact {
  level: DegreeLevel;
  line: CvLine;
  evidence: Evidence;
}

const DEGREE_CONTEXT = /\b(?:degree|university|college|institute|school|academy|polytechnic|b\.?\s?eng|bsc|msc|mba|ph\.?d)\b/i;

export function degrees(lines: CvLine[]): DegreeFact[] {
  const out: DegreeFact[] = [];
  for (const line of lines) {
    if (line.section !== "education" && !DEGREE_CONTEXT.test(line.text)) continue;
    const level = parseDegree(line.text);
    if (!level) continue;
    out.push({ level, line, evidence: { lineId: line.id, quote: line.text.length <= 120 ? line.text : line.text.slice(0, 120) } });
  }
  return out.sort((a, b) => DEGREE_RANK[b.level] - DEGREE_RANK[a.level]);
}

export interface LogisticsFacts {
  location?: { text: string; state?: string; country?: string; evidence: Evidence };
  relocation?: Evidence;
  remote?: Evidence;
  travel?: Evidence;
  authorized?: Evidence;
  needsSponsorship?: Evidence;
}

const RELOCATE = /\b(?:open|willing|happy|able|available)\s+to\s+relocat\w*|\bopen to relocation\b|\brelocation\s*[:-]\s*(?:yes|open|willing)\b/i;
const REMOTE_OK = /\b(?:open|available)\s+(?:to|for)\s+remote\b|\bremote[- ](?:ready|friendly)\b|\b(?:and|&)\s+remote\b/i;
const TRAVEL_OK = /\b(?:willing|open|able|happy|available)\s+to\s+travel\b/i;
const AUTHORIZED =
  /\b(?:authori[sz]ed to work(?: in the (?:us|u\.s\.|united states|uk))?|u\.?s\.? citizen|green card(?: holder)?|permanent resident|no sponsorship (?:required|needed)|does not require sponsorship|without (?:the need for )?sponsorship)\b/i;
const NEEDS_SPONSOR = /\b(?:requires?|need(?:s)?|will need|seeking)\s+(?:visa\s+|h-?1b\s+)?sponsorship\b/i;

export function logisticsFacts(lines: CvLine[]): LogisticsFacts {
  const facts: LogisticsFacts = {};
  const top = lines.slice(0, 12);
  const cite = (line: CvLine, m: RegExpExecArray): Evidence => ({ lineId: line.id, quote: m[0] });

  for (const line of top) {
    const cs = new RegExp(CITY_STATE.source).exec(line.text);
    if (cs) {
      const state = /,\s*([A-Z]{2})\b/.exec(cs[0])?.[1];
      facts.location = { text: cs[0], state, country: "US", evidence: cite(line, cs) };
      break;
    }
    const intl = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*(UK|United Kingdom|UAE|United Arab Emirates|Canada|India|Pakistan|Australia|Germany|France|Ireland|Netherlands|Spain|Singapore)\b/.exec(line.text);
    if (intl) {
      facts.location = { text: intl[0], country: countryOf(intl[2]!) ?? intl[2], evidence: cite(line, intl) };
      break;
    }
  }
  for (const line of lines) {
    let m: RegExpExecArray | null;
    if (!facts.relocation && (m = RELOCATE.exec(line.text))) facts.relocation = cite(line, m);
    if (!facts.remote && (m = REMOTE_OK.exec(line.text))) facts.remote = cite(line, m);
    if (!facts.travel && (m = TRAVEL_OK.exec(line.text))) facts.travel = cite(line, m);
    if (!facts.needsSponsorship && (m = NEEDS_SPONSOR.exec(line.text))) facts.needsSponsorship = cite(line, m);
    if (!facts.authorized && (m = AUTHORIZED.exec(line.text))) facts.authorized = cite(line, m);
  }
  return facts;
}
