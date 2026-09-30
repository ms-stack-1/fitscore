import { describe, expect, it } from "vitest";
import { bandOf, score, splitItems } from "../src/core/score";
import { DEFAULT_WEIGHTS, type Criterion, type Judgment } from "../src/core/types";

function crit(id: string, category: Criterion["category"], weight: number, knockout = false): Criterion {
  return { id, text: `criterion ${id}`, category, priority: weight >= 3 ? "must" : "nice", weight, knockout, source: "recruiter" };
}
function j(criterionId: string, match: Judgment["match"]): Judgment {
  return { criterionId, match, evidence: [], note: "" };
}

describe("score", () => {
  it("weights matches: full 1, partial 0.5, none 0", () => {
    const criteria = [crit("a", "technical", 3), crit("b", "technical", 3), crit("c", "technical", 2)];
    const card = score(criteria, [j("a", "full"), j("b", "partial"), j("c", "none")], DEFAULT_WEIGHTS);
    const t = card.categories.technical;
    expect(t.earned).toBe(4.5);
    expect(t.possible).toBe(8);
    expect(t.score).toBe(56.3);
    expect(t.counts).toEqual({ full: 1, partial: 1, none: 1, unknown: 0 });
  });

  it("excludes unknown from the denominator", () => {
    const criteria = [crit("a", "logistics", 3), crit("b", "logistics", 3)];
    const card = score(criteria, [j("a", "full"), j("b", "unknown")], DEFAULT_WEIGHTS);
    expect(card.categories.logistics.score).toBe(100);
    expect(card.categories.logistics.possible).toBe(3);
  });

  it("re-normalises category weights over assessable categories", () => {
    // technical 100, experience 50, logistics has nothing assessable
    const criteria = [crit("a", "technical", 2), crit("b", "experience", 2), crit("c", "logistics", 2)];
    const card = score(criteria, [j("a", "full"), j("b", "partial"), j("c", "unknown")], DEFAULT_WEIGHTS);
    expect(card.categories.logistics.score).toBeNull();
    expect(card.appliedWeights).toEqual({ technical: 50, experience: 50, logistics: 0, custom: 0 });
    expect(card.overall).toBe(75);
  });

  it("computes the weighted overall", () => {
    const criteria = [crit("a", "technical", 1), crit("b", "experience", 1), crit("c", "logistics", 1)];
    const card = score(criteria, [j("a", "full"), j("b", "none"), j("c", "full")], DEFAULT_WEIGHTS);
    // 0.4*100 + 0.4*0 + 0.2*100
    expect(card.overall).toBe(60);
    expect(card.band).toBe("partial");
  });

  it("ignores a category with zero weight even when it has criteria", () => {
    const criteria = [crit("a", "technical", 1), crit("x", "custom", 5)];
    const card = score(criteria, [j("a", "full"), j("x", "none")], DEFAULT_WEIGHTS);
    expect(card.categories.custom.score).toBe(0);
    expect(card.overall).toBe(100);
  });

  it("returns 0 when nothing at all is assessable", () => {
    const card = score([crit("a", "technical", 3)], [j("a", "unknown")], DEFAULT_WEIGHTS);
    expect(card.overall).toBe(0);
  });

  it("treats a missing judgment as unknown", () => {
    const card = score([crit("a", "technical", 3), crit("b", "technical", 3)], [j("a", "full")], DEFAULT_WEIGHTS);
    expect(card.categories.technical.score).toBe(100);
    expect(card.categories.technical.counts.unknown).toBe(1);
  });

  it("flags knockouts for review without changing the number", () => {
    const criteria = [crit("a", "technical", 3, true), crit("b", "technical", 3, true), crit("c", "technical", 3)];
    const withKo = score(criteria, [j("a", "none"), j("b", "unknown"), j("c", "full")], DEFAULT_WEIGHTS);
    const noKo = score(
      criteria.map((c) => ({ ...c, knockout: false })),
      [j("a", "none"), j("b", "unknown"), j("c", "full")],
      DEFAULT_WEIGHTS,
    );
    expect(withKo.overall).toBe(noKo.overall);
    expect(withKo.flags.map((f) => f.kind)).toEqual(["knockout_unmet", "knockout_unverified"]);
    expect(noKo.flags).toEqual([]);
  });
});

describe("bands", () => {
  it.each([
    [100, "strong"],
    [80, "strong"],
    [79, "good"],
    [65, "good"],
    [64, "partial"],
    [45, "partial"],
    [44, "low"],
    [0, "low"],
  ] as const)("%i -> %s", (n, band) => expect(bandOf(n)).toBe(band));
});

describe("splitItems", () => {
  it("separates where points added up from where they did not", () => {
    const criteria = [crit("a", "technical", 3), crit("b", "technical", 2), crit("c", "technical", 5), crit("d", "technical", 1)];
    const card = score(criteria, [j("a", "full"), j("b", "partial"), j("c", "none"), j("d", "unknown")], DEFAULT_WEIGHTS);
    const { gained, lost, unassessed } = splitItems(card.categories.technical);
    expect(gained.map((i) => i.criterion.id)).toEqual(["a", "b"]);
    expect(lost.map((i) => i.criterion.id)).toEqual(["c", "b"]);
    expect(unassessed.map((i) => i.criterion.id)).toEqual(["d"]);
  });
});
