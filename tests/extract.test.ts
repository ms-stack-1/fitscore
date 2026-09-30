import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeCriterion, parseDegree, parseYears } from "../src/core/jd/analyze";
import { extractLogistics, extractRole, logisticsCriteria } from "../src/core/jd/extract";

const JD = readFileSync(new URL("./fixtures/jd-growth.txt", import.meta.url), "utf8");

describe("extractRole", () => {
  const role = extractRole(JD);
  const texts = role.criteria.map((c) => c.text);

  it("finds the title and company", () => {
    expect(role.title).toBe("Senior Growth Marketing Manager");
    expect(role.company).toBe("Northwind Outdoor");
  });

  it("turns requirement bullets into must criteria and nice-to-haves into nice", () => {
    const years = role.criteria.find((c) => c.text.startsWith("5+ years"))!;
    expect(years).toMatchObject({ priority: "must", weight: 3, category: "experience" });
    expect(years.hints?.minYears).toBe(5);
    const shopify = role.criteria.find((c) => c.text.startsWith("Shopify"))!;
    expect(shopify).toMatchObject({ priority: "nice", weight: 1, category: "technical" });
  });

  it("weights responsibilities below requirements", () => {
    const resp = role.criteria.find((c) => c.text.startsWith("Own paid search"))!;
    expect(resp).toMatchObject({ priority: "must", weight: 2, category: "technical" });
    expect(resp.hints?.skills).toEqual(expect.arrayContaining(["google-ads", "meta-ads", "tiktok-ads", "paid-search", "paid-social"]));
  });

  it("skips benefits and about sections", () => {
    expect(texts.join(" ")).not.toMatch(/PTO|dental|gear allowance/);
  });

  it("reads the degree requirement with flexible field", () => {
    const deg = role.criteria.find((c) => /Bachelor/.test(c.text))!;
    expect(deg.hints).toMatchObject({ degree: "bachelor", fieldFlexible: true });
    expect(deg.hints?.fields).toEqual(expect.arrayContaining(["marketing", "business"]));
  });

  it("builds the logistics profile and logistics criteria, not free-text criteria", () => {
    expect(role.logistics).toMatchObject({ workMode: "hybrid", location: "Austin, TX", country: "US", travelPercent: 10, sponsorship: "not_available" });
    expect(role.criteria.filter((c) => c.category !== "logistics").some((c) => /sponsor|Travel:/i.test(c.text))).toBe(false);
    const lg = role.criteria.filter((c) => c.category === "logistics").map((c) => c.id);
    expect(lg).toEqual(["LG-location", "LG-auth"]);
  });

  it("gives every criterion a unique id", () => {
    expect(new Set(role.criteria.map((c) => c.id)).size).toBe(role.criteria.length);
  });

  it("copes with a JD that has no headings", () => {
    const r = extractRole(
      "We need a data analyst. You will have 3 years of experience with SQL and Tableau. Knowledge of Python is a plus. We love dogs.",
    );
    expect(r.criteria.map((c) => c.text)).toEqual(["You will have 3 years of experience with SQL and Tableau", "Knowledge of Python is a plus"]);
    expect(r.criteria[1]!.priority).toBe("nice");
  });
});

describe("analyzers", () => {
  it.each([
    ["5+ years of experience", 5],
    ["3-5 years", 3],
    ["five years in B2B", 5],
    ["at least 2 yrs", 2],
    ["in 2024 we grew", undefined],
  ])("parseYears(%s) = %s", (t, n) => expect(parseYears(t)).toBe(n));

  it.each([
    ["Bachelor's degree", "bachelor"],
    ["BS in Computer Science", "bachelor"],
    ["MBA preferred", "master"],
    ["PhD in Statistics", "doctorate"],
    ["a strong background", undefined],
  ])("parseDegree(%s) = %s", (t, d) => expect(parseDegree(t)).toBe(d));

  it("falls back to significant terms for plain requirements", () => {
    const a = analyzeCriterion("Comfortable presenting to executive stakeholders and translating data into narrative");
    expect(a.category).toBe("experience");
    expect(a.hints.terms).toEqual(["presenting", "executive", "translating", "data", "narrative"]);
  });
});

describe("extractLogistics", () => {
  it.each([
    ["This is a fully remote role (US only).", { workMode: "remote", country: "US" }],
    ["Remote - UK", { workMode: "remote", country: "UK" }],
    ["On-site in Chicago, IL five days a week.", { workMode: "onsite", location: "Chicago, IL", country: "US" }],
    ["Relocation assistance provided.", { relocationSupport: true }],
    ["Visa sponsorship is available.", { sponsorship: "available" }],
    ["Candidates must be authorized to work in the US without sponsorship.", { sponsorship: "not_available" }],
  ])("%s", (text, expected) => expect(extractLogistics(text)).toMatchObject(expected));

  it("creates a country criterion for country-scoped remote roles", () => {
    const c = logisticsCriteria({ workMode: "remote", country: "US", sponsorship: "unspecified" });
    expect(c.map((x) => x.id)).toEqual(["LG-country"]);
  });
});
