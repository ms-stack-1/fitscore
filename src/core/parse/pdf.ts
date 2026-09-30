/*
 * PDF to text with pdf.js, loaded only when a PDF is actually opened so the
 * rest of the app never pays for it. Text items are regrouped into lines by
 * their vertical position, since pdf.js returns them in drawing order.
 */

interface TextItemLike {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

export function itemsToText(items: TextItemLike[]): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const x = it.transform[4] ?? 0;
    const y = it.transform[5] ?? 0;
    let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
    if (!row) rows.push((row = { y, parts: [] }));
    row.parts.push({ x, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 20); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items: TextItemLike[] = [];
      for (const x of content.items) if ("str" in x) items.push({ str: x.str, transform: x.transform, hasEOL: x.hasEOL });
      pages.push(itemsToText(items));
    }
    return pages.join("\n\n");
  } finally {
    await task.destroy();
  }
}
