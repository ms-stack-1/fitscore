import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { roleFromJd } from "../src/app/pipeline";
import { addApplicant, rankRows, rescore, topGap } from "../src/app/ranking";
import { LocalJudge } from "../src/core/judges/local";
import { editCriterionText, labelFor, moveCriterion, newCriterion, scoringKey, validateRole, withLogistics } from "../src/app/roles";

const JD = `Data Analyst
Location: Chicago, IL (On-site)
Requirements
- 3+ years of experience with SQL
- Tableau or Power BI dashboards
We cannot sponsor visas.`;

describe("role helpers", () => {
  it("labels candidates A..Z then AA", () => {
    expect(labelFor(0)).toBe("Candidate A");
    expect(labelFor(25)).toBe("Candidate Z");
    expect(labelFor(26)).toBe("Candidate AA");
    expect(labelFor(27)).toBe("Candidate AB");
  });

  it("adds recruiter criteria with fresh ids and hints", () => {
    const role = roleFromJd(JD);
    const c = newCriterion(role.criteria, "Experience with dbt");
    expect(role.criteria.some((x) => x.id === c.id)).toBe(false);
    expect(c).toMatchObject({ source: "recruiter", category: "technical", hints: { skills: ["dbt"] } });
    expect(newCriterion(role.criteria).category).toBe("custom");
  });

  it("re-reads hints on text edits but keeps the recruiter's category and weight", () => {
    const c = { ...newCriterion([], "Experience with dbt"), category: "experience" as const, weight: 5 };
    const edited = editCriterionText(c, "Experience with Snowflake");
    expect(edited).toMatchObject({ category: "experience", weight: 5, hints: { skills: ["snowflake"] } });
  });

  it("regenerates logistics criteria and keeps recruiter overrides", () => {
    let role = roleFromJd(JD);
    expect(role.criteria.filter((c) => c.id.startsWith("LG-")).map((c) => c.id)).toEqual(["LG-location", "LG-auth"]);
    role = { ...role, criteria: role.criteria.map((c) => (c.id === "LG-location" ? { ...c, weight: 5, knockout: true } : c)) };
    const moved = withLogistics(role, { ...role.logistics, location: "Austin, TX", sponsorship: "available" });
    const loc = moved.criteria.find((c) => c.id === "LG-location")!;
    expect(loc).toMatchObject({ text: "Able to work on-site in Austin, TX", weight: 5, knockout: true });
    expect(moved.criteria.some((c) => c.id === "LG-auth")).toBe(false);
    expect(moved.criteria.filter((c) => !c.id.startsWith("LG-"))).toEqual(role.criteria.filter((c) => !c.id.startsWith("LG-")));
  });

  it("moves criteria within bounds", () => {
    const role = roleFromJd(JD);
    const ids = role.criteria.map((c) => c.id);
    expect(moveCriterion(role.criteria, ids[1]!, -1).map((c) => c.id).slice(0, 2)).toEqual([ids[1], ids[0]]);
    expect(moveCriterion(role.criteria, ids[0]!, -1)).toBe(role.criteria);
  });

  it("validates a role before saving", () => {
    const role = roleFromJd(JD);
    expect(validateRole(role)).toEqual([]);
    expect(validateRole({ ...role, title: " " })).toContain("Give the role a title.");
    const withCustom = { ...role, criteria: [...role.criteria, { ...newCriterion(role.criteria, "Portfolio of work"), category: "custom" as const }] };
    expect(validateRole(withCustom).join(" ")).toMatch(/Custom criteria have a weight of 0/);
  });

  it("changes the scoring key only when scoring inputs change", () => {
    const role = roleFromJd(JD);
    expect(scoringKey({ ...role, title: "Renamed", updatedAt: 99 })).toBe(scoringKey(role));
    expect(scoringKey({ ...role, weights: { ...role.weights, technical: 10 } })).not.toBe(scoringKey(role));
  });
});

describe("ranking", () => {
  const jd = readFileSync(new URL("./fixtures/jd-growth.txt", import.meta.url), "utf8");
  const cv = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
  const judge = new LocalJudge(() => new Date(2026, 8, 29));

  async function build() {
    const role = roleFromJd(jd);
    const cands = [];
    const rows = [];
    for (const f of ["cv-poor.txt", "cv-strong.txt", "cv-partial.txt"]) {
      const { candidate, result } = await addApplicant(role, cands, { text: cv(f), fileName: f }, judge);
      cands.push(candidate);
      rows.push({ candidate, result, stale: false });
    }
    return { role, rows };
  }

  it("labels, blinds and scores each applicant", async () => {
    const { rows } = await build();
    expect(rows.map((r) => r.candidate.label)).toEqual(["Candidate A", "Candidate B", "Candidate C"]);
    expect(rows.every((r) => r.candidate.blind && !r.candidate.revealed)).toBe(true);
    expect(rows[1]!.candidate.text).not.toContain("Taylor");
    expect(rows[1]!.candidate.detectedName).toBe("Taylor Morgan Reyes");
    // Location survives blind mode by default so logistics can be judged.
    expect(rows[1]!.candidate.text).toContain("Austin, TX");
  });

  it("ranks by overall, descending, and by category", async () => {
    const { rows } = await build();
    expect(rankRows(rows, "overall", "desc").map((r) => r.candidate.fileName)).toEqual(["cv-strong.txt", "cv-partial.txt", "cv-poor.txt"]);
    expect(rankRows(rows, "overall", "asc")[0]!.candidate.fileName).toBe("cv-poor.txt");
    expect(rankRows(rows, "label", "asc").map((r) => r.candidate.label)).toEqual(["Candidate A", "Candidate B", "Candidate C"]);
  });

  it("names the costliest gap", async () => {
    const { rows } = await build();
    expect(topGap(rows[0]!.result)).toBeTruthy();
    expect(topGap(undefined)).toBeUndefined();
  });

  it("rescoring after a weight change stamps the new role key", async () => {
    const { role, rows } = await build();
    const heavier = { ...role, weights: { ...role.weights, logistics: 60 } };
    const r = await rescore(heavier, rows[2]!.candidate, judge);
    expect(r.roleKey).not.toBe(rows[2]!.result.roleKey);
    expect(r.scorecard.appliedWeights.logistics).toBeGreaterThan(rows[2]!.result.scorecard.appliedWeights.logistics);
  });
});
