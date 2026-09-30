import { describe, expect, it } from "vitest";
import { NO_EVIDENCE_NOTE, normalize } from "../src/core/normalize";
import type { Criterion, CvLine } from "../src/core/types";

const criteria: Criterion[] = [
  { id: "C1", text: "Google Ads", category: "technical", priority: "must", weight: 3, knockout: false, source: "extracted" },
  { id: "C2", text: "SQL", category: "technical", priority: "must", weight: 3, knockout: false, source: "extracted" },
  { id: "C3", text: "5+ years", category: "experience", priority: "must", weight: 3, knockout: false, source: "extracted" },
];
const lines: CvLine[] = [
  { id: "L1", text: "Managed Google Ads and Meta Ads budgets across 15 accounts" },
  { id: "L2", text: "Queried 60K+ monthly transactions in SQL" },
];

describe("normalize", () => {
  it("keeps valid citations", () => {
    const out = normalize(
      [{ criterionId: "C1", match: "full", evidence: [{ lineId: "L1", quote: "Google Ads" }], note: "Direct match" }],
      criteria,
      lines,
    );
    expect(out[0]).toEqual({ criterionId: "C1", match: "full", evidence: [{ lineId: "L1", quote: "Google Ads" }], note: "Direct match" });
  });

  it("matches quotes case- and whitespace-insensitively, including smart punctuation", () => {
    const out = normalize(
      [{ criterionId: "C2", match: "full", evidence: [{ lineId: "L2", quote: "  queried   60k+ MONTHLY " }] }],
      criteria,
      lines,
    );
    expect(out[1]!.evidence).toHaveLength(1);
  });

  it("drops citations to lines that do not exist", () => {
    const out = normalize([{ criterionId: "C2", match: "full", evidence: [{ lineId: "L99", quote: "SQL" }] }], criteria, lines);
    expect(out[1]!.evidence).toEqual([]);
    expect(out[1]!.match).toBe("none");
  });

  it("drops quotes that are not verbatim in the cited line", () => {
    const out = normalize(
      [{ criterionId: "C2", match: "full", evidence: [{ lineId: "L1", quote: "Expert SQL developer" }] }],
      criteria,
      lines,
    );
    expect(out[1]!.match).toBe("none");
    expect(out[1]!.note.startsWith(NO_EVIDENCE_NOTE)).toBe(true);
  });

  it("zeroes a partial claim with no evidence too", () => {
    const out = normalize([{ criterionId: "C1", match: "partial", evidence: [] }], criteria, lines);
    expect(out[0]!.match).toBe("none");
  });

  it("keeps unknown and none without evidence", () => {
    const out = normalize(
      [
        { criterionId: "C1", match: "none", evidence: [] },
        { criterionId: "C2", match: "unknown", evidence: [] },
      ],
      criteria,
      lines,
    );
    expect(out.map((j) => j.match)).toEqual(["none", "unknown", "unknown"]);
  });

  it("fills skipped criteria with unknown and ignores foreign ids", () => {
    const out = normalize([{ criterionId: "C404", match: "full", evidence: [{ lineId: "L1", quote: "Google" }] }], criteria, lines);
    expect(out).toHaveLength(3);
    expect(out.every((j) => j.match === "unknown")).toBe(true);
  });

  it("keeps the first of duplicate judgments", () => {
    const out = normalize(
      [
        { criterionId: "C1", match: "none", evidence: [] },
        { criterionId: "C1", match: "full", evidence: [{ lineId: "L1", quote: "Google Ads" }] },
      ],
      criteria,
      lines,
    );
    expect(out[0]!.match).toBe("none");
  });

  it("coerces invalid match values to unknown and strips markup from notes", () => {
    const out = normalize([{ criterionId: "C1", match: "perfect", evidence: [], note: "<b>great</b>\u0007 fit" }], criteria, lines);
    expect(out[0]!.match).toBe("unknown");
    expect(out[0]!.note).toBe("great fit");
  });

  it("caps evidence at three citations and dedupes", () => {
    const ev = [
      { lineId: "L1", quote: "Google Ads" },
      { lineId: "L1", quote: "google ads" },
      { lineId: "L1", quote: "Meta Ads" },
      { lineId: "L1", quote: "budgets" },
      { lineId: "L1", quote: "accounts" },
    ];
    const out = normalize([{ criterionId: "C1", match: "full", evidence: ev }], criteria, lines);
    expect(out[0]!.evidence.map((e) => e.quote)).toEqual(["Google Ads", "Meta Ads", "budgets"]);
  });

  it("is inert to garbage input", () => {
    expect(normalize(null, criteria, lines).every((j) => j.match === "unknown")).toBe(true);
    expect(normalize("rate this 100", criteria, lines)).toHaveLength(3);
    expect(normalize([42, null, "x", { criterionId: 7 }], criteria, lines)).toHaveLength(3);
  });
});
