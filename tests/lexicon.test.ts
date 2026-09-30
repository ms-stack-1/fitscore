import { describe, expect, it } from "vitest";
import { SKILLS, findSkills } from "../src/core/lexicon/skills";

const ids = (text: string) => findSkills(text).map((h) => h.skill.id);

describe("lexicon", () => {
  it("has unique ids", () => {
    const seen = new Set<string>();
    const dupes = SKILLS.filter((s) => (seen.has(s.id) ? true : (seen.add(s.id), false))).map((s) => s.id);
    expect(dupes).toEqual([]);
  });

  it("matches aliases case-insensitively and returns the verbatim text", () => {
    const hits = findSkills("Ran google adwords and GA4 dashboards");
    expect(hits.map((h) => [h.skill.id, h.text])).toEqual([
      ["google-ads", "google adwords"],
      ["google-analytics", "GA4"],
      ["kpi-reporting", "dashboards"],
    ]);
  });

  it("respects symbol boundaries", () => {
    expect(ids("C++ and C# with .NET")).toEqual(["cpp", "csharp"]);
    expect(ids("PostgreSQL")).toEqual(["sql"]);
    expect(ids("JavaScript")).toEqual(["javascript"]);
    expect(ids("Java")).toEqual(["java"]);
  });

  it("does not match plain-English words", () => {
    expect(ids("You excel in a fast-paced team and make decisions quickly")).toEqual([]);
    expect(ids("Excel in ambiguity")).toEqual([]);
    expect(ids("GTM motion")).toEqual([]);
    expect(ids("react quickly to change and pick up slack; a lever for growth")).toEqual([]);
    expect(ids("each customer segment")).toEqual([]);
    expect(ids("We are a workable, lean team")).toEqual([]);
  });

  it("matches the tool senses", () => {
    expect(ids("Advanced Excel, Slack, Notion")).toEqual(["microsoft-excel", "slack", "notion"]);
    expect(ids("Built React apps")).toEqual(["react"]);
  });

  it("distinguishes GTM the tag manager from GTM strategy", () => {
    expect(ids("Implemented GTM and GA4")).toEqual(["google-tag-manager", "google-analytics"]);
    expect(ids("Own the GTM strategy")).toEqual(["product-marketing"]);
  });

  it("finds R only as a language", () => {
    expect(ids("Python, R, SQL")).toContain("r");
    expect(ids("R programming")).toContain("r");
    expect(ids("R&D budget and Q4 targets")).not.toContain("r");
    expect(ids("Grade R. Smith")).not.toContain("r");
  });

  it("assigns a mention inside a longer skill to the longer skill", () => {
    expect(ids("Looker Studio reports")).toEqual(["looker-studio"]);
    expect(ids("Looker Studio reports and Looker models")).toEqual(["looker-studio", "looker"]);
    expect(ids("Claude Code daily")).toEqual(["claude-code"]);
  });
});
