import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { degrees, logisticsFacts, tenure } from "../src/core/candidate/facts";
import { extractRole } from "../src/core/jd/extract";
import { LocalJudge } from "../src/core/judges/local";
import { score } from "../src/core/score";
import { toLines } from "../src/core/text";
import { DEFAULT_WEIGHTS, type Role } from "../src/core/types";

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const NOW = new Date(2026, 8, 29);

function roleFrom(jd: string): Role {
  const r = extractRole(jd);
  return { id: "r1", title: r.title, jdText: jd, criteria: r.criteria, weights: DEFAULT_WEIGHTS, logistics: r.logistics, createdAt: 0, updatedAt: 0 };
}

async function run(cvFile: string) {
  const role = roleFrom(fx("jd-growth.txt"));
  const lines = toLines(fx(cvFile));
  const result = await new LocalJudge(() => NOW).judge({ role, lines });
  return { role, lines, result, card: score(role.criteria, result.judgments, role.weights) };
}

describe("candidate facts", () => {
  it("merges dated ranges into tenure without double counting overlaps", () => {
    const lines = toLines("Experience\nA | Jan 2020 - Dec 2021\nB | Jun 2021 - Present\nEducation\nBS, 2014 - 2018");
    const t = tenure(lines, NOW)!;
    // Jan 2020 .. Sep 2026 inclusive = 81 months
    expect(t.years).toBe(6.8);
    expect(t.ranges).toHaveLength(2);
  });

  it("reads degree level from the education section", () => {
    const d = degrees(toLines(fx("cv-strong.txt")));
    expect(d[0]!.level).toBe("bachelor");
  });

  it("reads stated logistics", () => {
    const f = logisticsFacts(toLines(fx("cv-strong.txt")));
    expect(f.location?.text).toBe("Austin, TX");
    expect(f.authorized?.quote).toBe("Authorized to work in the US");
  });
});

describe("LocalJudge", () => {
  it("scores a strong candidate highly with cited evidence", async () => {
    const { card, result, lines } = await run("cv-strong.txt");
    expect(card.overall).toBeGreaterThanOrEqual(80);
    expect(card.band).toBe("strong");
    const ids = new Set(lines.map((l) => l.id));
    for (const j of result.judgments) {
      if (j.match === "full" || j.match === "partial") {
        expect(j.evidence.length).toBeGreaterThan(0);
        for (const e of j.evidence) expect(ids.has(e.lineId)).toBe(true);
      }
    }
  });

  it("scores a partial candidate in the middle", async () => {
    const { card } = await run("cv-partial.txt");
    expect(card.overall).toBeGreaterThanOrEqual(25);
    expect(card.overall).toBeLessThan(65);
  });

  it("scores an unrelated candidate low", async () => {
    const { card } = await run("cv-poor.txt");
    expect(card.overall).toBeLessThan(30);
    expect(card.band).toBe("low");
  });

  it("is not moved by instructions embedded in a CV", async () => {
    const poor = await run("cv-poor.txt");
    const inj = await run("cv-injection.txt");
    expect(inj.card.overall).toBeLessThanOrEqual(poor.card.overall + 3);
    expect(inj.card.band).toBe("low");
  });

  it("judges logistics from stated facts and leaves the unstated unknown", async () => {
    const strong = await run("cv-strong.txt");
    const loc = strong.result.judgments.find((j) => j.criterionId === "LG-location")!;
    const auth = strong.result.judgments.find((j) => j.criterionId === "LG-auth")!;
    expect(loc.match).toBe("full");
    expect(auth.match).toBe("full");

    const partial = await run("cv-partial.txt");
    expect(partial.result.judgments.find((j) => j.criterionId === "LG-location")!.match).toBe("partial");
    expect(partial.result.judgments.find((j) => j.criterionId === "LG-auth")!.match).toBe("unknown");
  });

  it("treats 'X or Y' skill lists as any-of", async () => {
    const { result, role } = await run("cv-strong.txt");
    const c = role.criteria.find((x) => x.text.startsWith("Experience with Looker Studio or Tableau"))!;
    expect(result.judgments.find((j) => j.criterionId === c.id)!.match).toBe("full");
  });

  it("labels itself honestly", async () => {
    const { result } = await run("cv-strong.txt");
    expect(result.engine).toEqual({ kind: "local", label: "Rule-based match" });
  });
});
