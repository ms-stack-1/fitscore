import type { CvLine, CvSection } from "./types";

/*
 * Turns free text into numbered lines. Line ids are the unit of evidence:
 * every point a candidate earns cites one of these.
 */

const MAX_LINE = 320;

const BULLET = /^\s*(?:[-*•▪●◦‣⁃·–—>]|\d{1,2}[.)])\s+/;

const SECTION_HEADINGS: [CvSection, RegExp][] = [
  ["summary", /^(professional\s+)?(summary|profile|about( me)?|objective|overview)$/],
  ["experience", /^((professional|work|relevant|employment)\s+)?(experience|history|employment)$|^career( history)?$/],
  ["education", /^(education|academic( background)?|qualifications|education (and|&) training)$/],
  ["skills", /^((core|key|technical)\s+)?(skills|competencies|expertise|tools|technologies|tech stack)( (and|&) tools)?$/],
  ["projects", /^(selected\s+)?(projects|portfolio)$/],
  ["certifications", /^(certifications?|licen[cs]es( (and|&) certifications)?|courses)$/],
];

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function headingSection(line: string): CvSection | null {
  const t = line.replace(/[:\-–—|]+$/g, "").trim().toLowerCase();
  if (!t || t.length > 40) return null;
  for (const [section, re] of SECTION_HEADINGS) if (re.test(t)) return section;
  return null;
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_LINE) return [text];
  const parts = text.split(/(?<=[.;!?])\s+(?=[A-Z0-9])/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if (cur && (cur + " " + p).length > MAX_LINE) {
      out.push(cur);
      cur = p;
    } else cur = cur ? cur + " " + p : p;
  }
  if (cur) out.push(cur);
  // A single sentence longer than MAX_LINE stays whole: splitting mid-sentence would break quotes.
  return out;
}

export function toLines(raw: string): CvLine[] {
  const lines: CvLine[] = [];
  let section: CvSection = "header";
  let n = 0;
  for (const rawLine of normalizeText(raw).split("\n")) {
    const text = rawLine.replace(BULLET, "").trim();
    if (!text) continue;
    const h = headingSection(text);
    if (h) section = h;
    for (const piece of splitLong(text)) {
      n++;
      lines.push({ id: `L${n}`, text: piece, section: h ?? section });
    }
    if (n >= 3 && section === "header" && !h) section = "other";
  }
  return lines;
}

/** Word-boundary-safe matcher for terms that may contain symbols (C++, C#, .NET, Node.js). */
export function termRegex(term: string, flags = "i"): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s\\-/]*");
  return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9+#])`, flags);
}
