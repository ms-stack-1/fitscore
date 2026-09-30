import { analyzeCriterion } from "../core/jd/analyze";
import { logisticsCriteria } from "../core/jd/extract";
import type { Criterion, LogisticsProfile, Role } from "../core/types";

/* Pure role-editing helpers. The setup wizard and the tests both use these. */

/** A, B, … Z, AA, AB, … */
export function labelFor(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Candidate ${s}`;
}

export function nextCriterionId(criteria: Criterion[]): string {
  const used = new Set(criteria.map((c) => c.id));
  let n = criteria.length + 1;
  while (used.has(`R${n}`)) n++;
  return `R${n}`;
}

export function newCriterion(criteria: Criterion[], text = ""): Criterion {
  const { category, hints } = analyzeCriterion(text);
  return { id: nextCriterionId(criteria), text, category: text ? category : "custom", priority: "must", weight: 3, knockout: false, source: "recruiter", hints };
}

/** Text changed: re-read the hints, but keep the recruiter's category, weight and flags. */
export function editCriterionText(c: Criterion, text: string): Criterion {
  if (c.hints?.logistics) return { ...c, text };
  return { ...c, text, hints: analyzeCriterion(text).hints };
}

/**
 * Logistics criteria are derived from the profile. Regenerate them when the
 * profile changes, but keep a recruiter's weight and knockout on any that survive.
 */
export function withLogistics(role: Role, logistics: LogisticsProfile): Role {
  const prev = new Map(role.criteria.filter((c) => c.id.startsWith("LG-")).map((c) => [c.id, c]));
  const next = logisticsCriteria(logistics).map((c) => {
    const old = prev.get(c.id);
    return old ? { ...c, weight: old.weight, knockout: old.knockout, priority: old.priority } : c;
  });
  return { ...role, logistics, criteria: [...role.criteria.filter((c) => !c.id.startsWith("LG-")), ...next] };
}

export function moveCriterion(criteria: Criterion[], id: string, delta: -1 | 1): Criterion[] {
  const i = criteria.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= criteria.length) return criteria;
  const out = [...criteria];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export function validateRole(role: Role): string[] {
  const problems: string[] = [];
  if (!role.title.trim()) problems.push("Give the role a title.");
  const live = role.criteria.filter((c) => c.text.trim());
  if (live.length === 0) problems.push("Add at least one criterion.");
  if (role.criteria.some((c) => !c.text.trim())) problems.push("Remove or fill in empty criteria.");
  const cats = new Set(live.map((c) => c.category));
  if (![...cats].some((c) => role.weights[c] > 0)) problems.push("At least one category with criteria needs a weight above zero.");
  if (live.some((c) => c.category === "custom") && role.weights.custom === 0) problems.push("Custom criteria have a weight of 0, so they will not count. Raise the custom weight or recategorise them.");
  return problems;
}

/** A fingerprint of everything that affects scores, to know when results are stale. */
export function scoringKey(role: Role): string {
  return JSON.stringify([role.criteria.map((c) => [c.id, c.text, c.category, c.weight, c.knockout]), role.weights, role.logistics]);
}
