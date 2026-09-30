import { describe, expect, it } from "vitest";
import { redact } from "../src/core/redact";
import { toLines } from "../src/core/text";

const CV = `JORDAN AVERY BLAKE
Austin, TX 78701 | (512) 555-0142 | jordan.blake@example.com | linkedin.com/in/jordanblake | @jblake_growth
Date of Birth: 14/03/1991
Nationality: Canadian
Marital Status: Married

Summary
Mr. Blake is a growth marketer. He has led paid search for 7 years and his work lifted ROAS 2.1x. She said Jordan was great.

Experience
Growth Lead, Northwind Co | Jan 2019 - Present
- Managed $1.2M in Google Ads spend across 40 campaigns
- Office at 221 Baker Street, Suite 4

Education
B.S. Marketing, University of Texas, 2008 - 2012
MBA, Rice University, 2016
`;

describe("redact", () => {
  const out = redact(CV, { keepLocation: false });

  it("detects and removes the name everywhere", () => {
    expect(out.detectedName).toBe("Jordan Avery Blake");
    expect(out.text).not.toMatch(/Jordan|Blake|Avery/i);
    expect(out.text.startsWith("[Candidate]")).toBe(true);
  });

  it("removes contact details and handles", () => {
    expect(out.text).not.toContain("example.com");
    expect(out.text).not.toContain("555-0142");
    expect(out.text).not.toContain("linkedin.com");
    expect(out.text).not.toContain("@jblake_growth");
  });

  it("removes birth date and personal-status lines", () => {
    expect(out.text).not.toContain("1991");
    expect(out.text).not.toMatch(/Canadian|Married/);
  });

  it("removes addresses and, when asked, location", () => {
    expect(out.text).not.toContain("Baker Street");
    expect(out.text).not.toContain("Austin, TX");
    expect(out.text).not.toContain("78701");
  });

  it("neutralises pronouns and honorifics", () => {
    expect(out.text).toContain("They has led paid search");
    expect(out.text).toContain("their work lifted ROAS");
    expect(out.text).not.toMatch(/\b(he|she|his|Mr\.)\b/i);
  });

  it("removes graduation years but keeps work-history dates", () => {
    expect(out.text).toContain("Jan 2019 - Present");
    expect(out.text).not.toMatch(/2008|2012|2016/);
    expect(out.text).toContain("B.S. Marketing");
  });

  it("keeps money, percentages and numbers that are not phones", () => {
    expect(out.text).toContain("$1.2M in Google Ads spend across 40 campaigns");
    expect(out.text).toContain("2.1x");
  });

  it("keeps city and state when logistics needs them", () => {
    const kept = redact(CV, { keepLocation: true });
    expect(kept.text).toContain("Austin, TX");
    expect(kept.text).not.toContain("555-0142");
  });

  it("reports what it removed", () => {
    const kinds = Object.fromEntries(out.redactions.map((r) => [r.kind, r.count]));
    expect(kinds.email).toBe(1);
    expect(kinds.phone).toBe(1);
    expect(kinds.grad_year).toBe(3);
    expect(kinds.name).toBeGreaterThanOrEqual(2);
  });

  it("leaves a CV without a name-like first line intact at the top", () => {
    const r = redact("Senior Data Analyst\nSQL, Python, Tableau", { keepLocation: false });
    expect(r.detectedName).toBeUndefined();
    expect(r.text.startsWith("Senior Data Analyst")).toBe(true);
  });
});

describe("toLines", () => {
  const lines = toLines(CV);

  it("numbers non-empty lines and strips bullets", () => {
    expect(lines[0]).toMatchObject({ id: "L1", text: "JORDAN AVERY BLAKE", section: "header" });
    const spend = lines.find((l) => l.text.startsWith("Managed $1.2M"));
    expect(spend).toBeDefined();
    expect(spend!.section).toBe("experience");
  });

  it("tracks sections", () => {
    expect(lines.find((l) => l.text.startsWith("MBA"))!.section).toBe("education");
    expect(lines.find((l) => l.text.startsWith("Mr. Blake"))!.section).toBe("summary");
  });

  it("splits very long paragraphs at sentence boundaries", () => {
    const para = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} talks about campaign work in some detail.`).join(" ");
    const out = toLines(para);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((l) => l.text.length <= 320)).toBe(true);
    expect(out.map((l) => l.text).join(" ")).toBe(para);
  });
});
