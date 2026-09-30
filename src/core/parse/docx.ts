import { unzipSync } from "fflate";

/*
 * DOCX to text without a Word library: a .docx is a zip, and the body text
 * lives in word/document.xml as <w:t> runs inside <w:p> paragraphs.
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function documentXmlToText(xml: string): string {
  const body = xml.replace(/<w:(?:instrText|delText)[^>]*>[\s\S]*?<\/w:(?:instrText|delText)>/g, "");
  const paragraphs: string[] = [];
  for (const p of body.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let text = "";
    for (const tok of p.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br[^>]*\/>|<w:cr\/>/g) ?? []) {
      if (tok.startsWith("<w:tab")) text += "\t";
      else if (tok.startsWith("<w:br") || tok.startsWith("<w:cr")) text += "\n";
      else text += decode(tok.replace(/^<w:t[^>]*>|<\/w:t>$/g, ""));
    }
    // List items are paragraphs with numbering properties; mark them as bullets.
    const isList = /<w:numPr>/.test(p);
    paragraphs.push(isList && text.trim() ? `- ${text.trim()}` : text);
  }
  return paragraphs.join("\n");
}

export function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This .docx has no word/document.xml; it may be corrupt or not a Word document.");
  return documentXmlToText(new TextDecoder("utf-8").decode(doc));
}
