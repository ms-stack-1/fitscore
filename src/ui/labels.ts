import type { Category, Match } from "../core/types";

export const CATEGORY_LABEL: Record<Category, string> = {
  technical: "Technical skills",
  experience: "Experience & qualifications",
  logistics: "Logistical match",
  custom: "Custom criteria",
};

export const CATEGORY_HINT: Record<Category, string> = {
  technical: "Named tools, platforms and methods the role asks for.",
  experience: "Years, degrees, responsibilities and domain background.",
  logistics: "Location, work mode, travel and authorization: how easy it is to hire.",
  custom: "Criteria the recruiter added.",
};

/** Glyph + word for every match state: status colour is never the only signal. */
export const MATCH_LABEL: Record<Match, { glyph: string; word: string }> = {
  full: { glyph: "✓", word: "Met" },
  partial: { glyph: "◐", word: "Partly met" },
  none: { glyph: "✕", word: "Not found" },
  unknown: { glyph: "?", word: "Not assessed" },
};

export const fmtPts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
