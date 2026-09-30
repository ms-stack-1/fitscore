import {
  CATEGORIES,
  type Band,
  type Category,
  type CategoryScore,
  type CategoryWeights,
  type Criterion,
  type Flag,
  type Judgment,
  type Match,
  type ScoreCard,
  type ScoredItem,
} from "./types";

/*
 * The only place numbers are made.
 *
 *   earned    = weight x value(match)      full 1, partial 0.5, none 0
 *   possible  = weight                     unknown criteria contribute nothing
 *   category  = earned / possible x 100    null when nothing was assessable
 *   overall   = category scores weighted by the role's category weights,
 *               re-normalised over the categories that produced a score
 *
 * Inputs are normalised Judgments (see normalize.ts). A knockout never changes
 * the number; it raises a flag for a person to review.
 */

export const MATCH_VALUE: Record<Exclude<Match, "unknown">, number> = { full: 1, partial: 0.5, none: 0 };

export const BANDS: { band: Band; min: number; label: string }[] = [
  { band: "strong", min: 80, label: "Strong fit" },
  { band: "good", min: 65, label: "Good fit" },
  { band: "partial", min: 45, label: "Partial fit" },
  { band: "low", min: 0, label: "Low fit" },
];

export function bandOf(score: number): Band {
  return (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]!).band;
}

export function bandLabel(band: Band): string {
  return BANDS.find((b) => b.band === band)!.label;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreItem(criterion: Criterion, judgment: Judgment): ScoredItem {
  const weight = Math.max(0, criterion.weight);
  if (judgment.match === "unknown") return { criterion, judgment, earned: 0, possible: 0 };
  return { criterion, judgment, earned: weight * MATCH_VALUE[judgment.match], possible: weight };
}

function emptyCounts(): Record<Match, number> {
  return { full: 0, partial: 0, none: 0, unknown: 0 };
}

export function score(criteria: Criterion[], judgments: Judgment[], weights: CategoryWeights): ScoreCard {
  const byId = new Map(judgments.map((j) => [j.criterionId, j]));
  const categories = {} as Record<Category, CategoryScore>;
  for (const cat of CATEGORIES) {
    categories[cat] = { category: cat, score: null, earned: 0, possible: 0, counts: emptyCounts(), items: [] };
  }

  const flags: Flag[] = [];
  for (const c of criteria) {
    const j: Judgment = byId.get(c.id) ?? { criterionId: c.id, match: "unknown", evidence: [], note: "" };
    const item = scoreItem(c, j);
    const cs = categories[c.category];
    cs.items.push(item);
    cs.earned += item.earned;
    cs.possible += item.possible;
    cs.counts[j.match]++;

    if (c.knockout && j.match === "none") {
      flags.push({ kind: "knockout_unmet", criterionId: c.id, message: `Knockout not met: ${c.text}` });
    } else if (c.knockout && j.match === "unknown") {
      flags.push({ kind: "knockout_unverified", criterionId: c.id, message: `Knockout not verifiable from the CV: ${c.text}` });
    }
  }

  for (const cat of CATEGORIES) {
    const cs = categories[cat];
    cs.score = cs.possible > 0 ? round1((cs.earned / cs.possible) * 100) : null;
  }

  const live = CATEGORIES.filter((cat) => categories[cat].score !== null && weights[cat] > 0);
  const total = live.reduce((s, cat) => s + weights[cat], 0);
  const appliedWeights = { technical: 0, experience: 0, logistics: 0, custom: 0 } as CategoryWeights;
  let overall = 0;
  for (const cat of live) {
    const w = weights[cat] / total;
    appliedWeights[cat] = round1(w * 100);
    overall += w * (categories[cat].score as number);
  }
  overall = Math.round(overall);

  return { overall, band: bandOf(overall), categories, appliedWeights, flags };
}

/** Items that earned something, best first; and items that lost points, costliest first. */
export function splitItems(cs: CategoryScore): { gained: ScoredItem[]; lost: ScoredItem[]; unassessed: ScoredItem[] } {
  const gained = cs.items.filter((i) => i.earned > 0).sort((a, b) => b.earned - a.earned);
  const lost = cs.items
    .filter((i) => i.possible > 0 && i.earned < i.possible)
    .sort((a, b) => b.possible - b.earned - (a.possible - a.earned));
  const unassessed = cs.items.filter((i) => i.possible === 0);
  return { gained, lost, unassessed };
}
