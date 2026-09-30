import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { auditToCsv, buildAudit, csvCell, DECISION_NOTICE } from "../src/core/audit";
import { extractRole } from "../src/core/jd/extract";
import { LocalJudge } from "../src/core/judges/local";
import { docxToText } from "../src/core/parse/docx";
import { finalizeText, kindOf, parseFile } from "../src/core/parse/index";
import { itemsToText } from "../src/core/parse/pdf";
import { score } from "../src/core/score";
import { toLines } from "../src/core/text";
import { DEFAULT_WEIGHTS, type Candidate, type CandidateResult, type Role } from "../src/core/types";

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("docx", () => {
  it("extracts paragraphs, list bullets, tabs and entities", () => {
    const xml = `<?xml version="1.0"?><w:document><w:body>
      <w:p><w:r><w:t>Taylor Reyes</w:t></w:r></w:p>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">Ran Google Ads &amp; Meta </w:t></w:r><w:r><w:t>Ads</w:t></w:r></w:p>
      <w:p><w:r><w:t>Role</w:t><w:tab/><w:t>2019 &#8211; 2021</w:t></w:r></w:p>
    </w:body></w:document>`;
    const bytes = zipSync({ "word/document.xml": strToU8(xml), "[Content_Types].xml": strToU8("<Types/>") });
    expect(docxToText(bytes)).toBe("Taylor Reyes\n- Ran Google Ads & Meta Ads\nRole\t2019 – 2021");
  });

  it("rejects a zip that is not a Word document", () => {
    expect(() => docxToText(zipSync({ "a.txt": strToU8("x") }))).toThrow(/document\.xml/);
  });
});

describe("pdf text regrouping", () => {
  it("rebuilds lines by vertical position and orders words left to right", () => {
    const items = [
      { str: "Ads", transform: [1, 0, 0, 1, 120, 700] },
      { str: "Google", transform: [1, 0, 0, 1, 40, 700.8] },
      { str: "Name", transform: [1, 0, 0, 1, 40, 740] },
      { str: "", transform: [1, 0, 0, 1, 40, 720] },
    ];
    expect(itemsToText(items)).toBe("Name\nGoogle Ads");
  });
});

describe("parseFile", () => {
  it("routes by extension and type", () => {
    expect(kindOf("cv.PDF", "")).toBe("pdf");
    expect(kindOf("cv.docx", "")).toBe("docx");
    expect(kindOf("notes", "text/plain")).toBe("text");
    expect(kindOf("cv.pages", "")).toBeNull();
  });

  it("reads text files and warns on thin content", async () => {
    const out = await parseFile(new File(["Short CV"], "cv.txt", { type: "text/plain" }));
    expect(out.text).toBe("Short CV");
    expect(out.warnings[0]).toMatch(/Very little text/);
  });

  it("refuses legacy .doc and oversize files with a clear message", async () => {
    await expect(parseFile(new File(["x"], "old.doc"))).rejects.toThrow(/\.docx or PDF/);
    await expect(parseFile(new File([new Uint8Array(6 * 1024 * 1024)], "big.pdf"))).rejects.toThrow(/5 MB/);
  });

  it("caps very long text", () => {
    const w: string[] = [];
    expect(finalizeText("a".repeat(30_000), w)).toHaveLength(25_000);
    expect(w[0]).toMatch(/cut/);
  });
});

describe("audit", () => {
  async function bundle() {
    const jd = fx("jd-growth.txt");
    const r = extractRole(jd);
    const role: Role = { id: "r1", title: r.title, company: r.company, jdText: jd, criteria: r.criteria, weights: DEFAULT_WEIGHTS, logistics: r.logistics, createdAt: 0, updatedAt: 0 };
    const make = async (id: string, label: string, file: string, revealed: boolean) => {
      const text = fx(file);
      const lines = toLines(text);
      const candidate: Candidate = { id, label, rawText: text, text, lines, blind: true, detectedName: `Name ${id}`, revealed, addedAt: 0 };
      const res = await new LocalJudge(() => new Date(2026, 8, 29)).judge({ role, lines });
      const result: CandidateResult = { candidateId: id, roleId: role.id, result: res, scorecard: score(role.criteria, res.judgments, role.weights), scoredAt: 1_700_000_000_000 };
      return { candidate, result };
    };
    const entries = [await make("c2", "Candidate B", "cv-poor.txt", false), await make("c1", "Candidate A", "cv-strong.txt", true)];
    return buildAudit(role, entries, [{ ts: 1_700_000_000_000, kind: "reveal", candidateId: "c1" }], 1_700_000_000_000);
  }

  it("ranks candidates, carries the notice, and names only revealed candidates", async () => {
    const b = await bundle();
    expect(b.notice).toBe(DECISION_NOTICE);
    expect(b.candidates.map((c) => c.label)).toEqual(["Candidate A", "Candidate B"]);
    expect(b.candidates[0]!.revealedName).toBe("Name c1");
    expect(b.candidates[1]!.revealedName).toBeUndefined();
    expect(b.events).toEqual([{ at: "2023-11-14T22:13:20.000Z", kind: "reveal", candidateId: "c1", detail: undefined }]);
  });

  it("records every criterion for every candidate with points and evidence", async () => {
    const b = await bundle();
    for (const c of b.candidates) expect(c.judgments).toHaveLength(b.role.criteria.length);
    const full = b.candidates[0]!.judgments.find((j) => j.match === "full")!;
    expect(full.earned).toBe(full.possible);
    expect(full.evidence.length).toBeGreaterThan(0);
  });

  it("exports CSV with one row per candidate x criterion", async () => {
    const b = await bundle();
    const rows = auditToCsv(b).trim().split("\r\n");
    expect(rows[0]).toMatch(/^rank,candidate,revealed_name,overall/);
    expect(rows).toHaveLength(1 + 2 * b.role.criteria.length);
  });

  it("escapes CSV and neutralises formula injection", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(undefined)).toBe("");
  });
});
