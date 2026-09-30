import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DemoProfile } from "../src/app/demo";
import { quickMatch } from "../src/app/pipeline";
import { tenure } from "../src/core/candidate/facts";
import { toLines } from "../src/core/text";

const demo = JSON.parse(readFileSync(new URL("../public/demo/muhammad.json", import.meta.url), "utf8")) as DemoProfile;
const jd = readFileSync(new URL("../public/demo/sample-jd.txt", import.meta.url), "utf8");

describe("demo candidate (Muhammad Shuja)", () => {
  // Guardrails from the master CV's hard honesty limits and the portfolio's confirmed metrics.
  it.each([
    ["$850K", /\$\s?850/],
    ["$940K", /\$\s?940/],
    ["unsupported years claim", /\b6\+\s*years/i],
    ["self-built tool names", /LeadLens|Creative Circuit|Winback Engine|Tagworks|Sentry anomaly/i],
    ["banned Wellborn framing", /convenience store|gas station|\bfuel\b|taqueria|Chevron|\bShell\b/i],
    ["titles above the ceiling", /\b(?:Head of|Director|VP|Vice President)\b/],
    ["unconfirmed certifications", /Meta Blueprint|Google Ads (?:Search|Display) cert|Ad Manager Fundamentals/i],
  ])("does not contain %s", (_, re) => expect(demo.cv).not.toMatch(re));

  it("carries the confirmed headline metrics", () => {
    for (const m of ["$272K", "189%", "300%", "134%", "11% to 43%", "15-20"]) expect(demo.cv).toContain(m);
  });

  it("keeps 18.6x ROAS client-scoped to Food Crowd", () => {
    const lines = demo.cv.split("\n").filter((l) => l.includes("18.6"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^- Food Crowd/);
  });

  it("does not state work authorization", () => {
    expect(demo.cv).not.toMatch(/authori[sz]ed|citizen|green card|sponsor/i);
  });

  it("dated history sums to what the dates say", () => {
    const t = tenure(toLines(demo.cv), new Date(2026, 8, 29))!;
    expect(t.years).toBeGreaterThan(4.5);
    expect(t.years).toBeLessThan(5.5);
  });

  it("scores end to end through the pipeline, unblinded, with visa not assessed", async () => {
    const out = await quickMatch({ jdText: jd, cvText: demo.cv, blind: false, keepLocation: true, label: demo.name });
    expect(out.candidate.text).toBe(demo.cv);
    expect(out.scorecard.overall).toBeGreaterThan(55);
    const auth = out.result.judgments.find((j) => j.criterionId === "LG-auth");
    expect(auth?.match).toBe("unknown");
  });
});
