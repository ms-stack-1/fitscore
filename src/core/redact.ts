import { headingSection, normalizeText } from "./text";

/*
 * Blind mode. Removes what identifies a person or proxies for a protected
 * attribute, before any engine sees the CV.
 *
 * Removed:  name, email, phone, links and handles, street address, date of
 *           birth and age, graduation years, nationality / gender / marital
 *           status / religion lines, honorifics, gendered pronouns.
 * Optional: city / state / postcode (kept when logistics scoring needs them).
 *
 * This is a best-effort text filter, not a guarantee. It is documented as such
 * on the Method page, and the recruiter always sees the redacted text before
 * scoring.
 */

export interface RedactOptions {
  keepLocation: boolean;
}

export interface Redaction {
  kind: RedactionKind;
  count: number;
}

export type RedactionKind =
  | "name"
  | "email"
  | "phone"
  | "link"
  | "address"
  | "location"
  | "birth"
  | "grad_year"
  | "personal"
  | "pronoun";

export interface RedactResult {
  text: string;
  detectedName?: string;
  redactions: Redaction[];
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL = /\b(?:https?:\/\/|www\.)[^\s)>\]]+|\b(?:linkedin\.com|github\.com|behance\.net|dribbble\.com|twitter\.com|x\.com|instagram\.com|medium\.com)\/[^\s)>\]]*/gi;
const HANDLE = /(?<![A-Za-z0-9.])@[A-Za-z0-9_]{3,30}\b/g;
const PHONE = /(?<![\w$])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]?\d{3,5}(?![\w%])/g;
const STREET =
  /\b\d{1,6}\s+(?:[A-Z][A-Za-z]+\s){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Terrace|Circle)\b\.?(?:,?\s*(?:Apt|Suite|Unit|#)\s*[\w-]+)?/g;
const US_STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
export const CITY_STATE = new RegExp(`\\b[A-Z][a-zA-Z.]+(?:[ -][A-Z][a-zA-Z.]+){0,2},\\s*(?:${US_STATES})\\b(?:\\s+\\d{5}(?:-\\d{4})?)?`, "g");
const POSTCODE_UK = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g;
const BIRTH = /\b(?:date of birth|d\.?o\.?b\.?|born(?: on| in)?)\s*[:-]?\s*[^\n,;|]{0,30}\d{2,4}|\bage\s*[:-]?\s*\d{2}\b|\b\d{2}\s*(?:years old|yrs old|y\/o)\b/gi;
const PERSONAL_LINE = /^\s*(?:nationality|citizenship|gender|sex|marital status|religion|ethnicity|race|place of birth|passport(?: no\.?| number)?|driving licen[cs]e|dependents|health)\s*[:-].*$/gim;
const HONORIFIC = /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+(?=[A-Z])/g;
const YEAR = /\b(?:19[5-9]\d|20[0-4]\d)\b/g;

const PRONOUNS: [RegExp, string][] = [
  [/\b(?:he or she|she or he|he\/she|she\/he|s\/he)\b/gi, "they"],
  [/\b(?:himself|herself)\b/gi, "themself"],
  [/\bhers\b/gi, "theirs"],
  [/\b(?:he|she)\b/gi, "they"],
  [/\bhis\b/gi, "their"],
  [/\bhim\b/gi, "them"],
  // "her" is ambiguous (object or possessive); "their" reads acceptably in either role for a CV.
  [/\bher\b/gi, "their"],
];

const NOT_A_NAME =
  /\b(resume|curriculum|vitae|cv|summary|profile|experience|education|skills|manager|engineer|developer|analyst|marketing|specialist|director|consultant|designer|contact|phone|email)\b/i;

function looksLikeName(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 48 || /\d|@|\|/.test(t)) return false;
  if (NOT_A_NAME.test(t) || headingSection(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[A-Z][A-Za-z'À-ſ.-]*$/.test(w) || /^[A-Z][A-Z'À-ſ.-]+$/.test(w) || /^(?:bin|ibn|al|el|de|da|van|von|der|la|le)$/i.test(w));
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
}

export function redact(raw: string, opts: RedactOptions): RedactResult {
  const counts = new Map<RedactionKind, number>();
  const bump = (k: RedactionKind, n = 1) => counts.set(k, (counts.get(k) ?? 0) + n);
  const sub = (text: string, re: RegExp, kind: RedactionKind, token: string) =>
    text.replace(re, () => {
      bump(kind);
      return token;
    });

  let text = normalizeText(raw);

  // Contact details first: a name pass would otherwise break emails and links
  // apart before their patterns could see them whole.
  text = sub(text, EMAIL, "email", "[email]");
  text = sub(text, URL, "link", "[link]");
  text = sub(text, HANDLE, "link", "[link]");
  text = text.replace(PHONE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    if (digits < 10 || digits > 15) return m;
    bump("phone");
    return "[phone]";
  });

  // Name: the first non-empty line, when it reads as a name. Every later
  // occurrence of the full name or its distinctive parts goes too.
  let detectedName: string | undefined;
  const lines = text.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx >= 0) {
    const first = lines[firstIdx]!.split(/\s[|•·-]\s/)[0]!.trim();
    if (looksLikeName(first)) {
      detectedName = titleCase(first);
      lines[firstIdx] = lines[firstIdx]!.replace(first, "[Candidate]");
      bump("name");
      text = lines.join("\n");
      const parts = first.split(/\s+/).filter((p) => p.length >= 3 && !/^(?:bin|ibn|al|el|de|da|van|von|der)$/i.test(p));
      for (const re of [new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi"), ...parts.map((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"))]) {
        text = sub(text, re, "name", "[Candidate]");
      }
    }
  }

  text = sub(text, PERSONAL_LINE, "personal", "[personal detail removed]");
  text = sub(text, BIRTH, "birth", "[birth date removed]");
  text = sub(text, STREET, "address", "[address]");
  if (!opts.keepLocation) {
    text = sub(text, CITY_STATE, "location", "[location]");
    text = sub(text, POSTCODE_UK, "location", "[location]");
  }
  text = sub(text, HONORIFIC, "pronoun", "");
  for (const [re, rep] of PRONOUNS) {
    text = text.replace(re, (m) => {
      bump("pronoun");
      return m[0] === m[0]!.toUpperCase() ? rep[0]!.toUpperCase() + rep.slice(1) : rep;
    });
  }

  // Graduation years proxy for age. Only inside the education section, so
  // work-history dates (needed for tenure) survive.
  let inEducation = false;
  text = text
    .split("\n")
    .map((line) => {
      const h = headingSection(line.trim());
      if (h) inEducation = h === "education";
      if (!inEducation || h) return line;
      return line.replace(YEAR, () => {
        bump("grad_year");
        return "[year]";
      });
    })
    .join("\n");

  const redactions = [...counts.entries()].map(([kind, count]) => ({ kind, count }));
  return { text, detectedName, redactions };
}
