import { normalizeText } from "../text";
import { docxToText } from "./docx";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARS = 25_000;
export const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export type FileKind = "pdf" | "docx" | "text";

export interface ParsedFile {
  name: string;
  kind: FileKind;
  text: string;
  warnings: string[];
}

export function kindOf(name: string, type: string): FileKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (ext === "docx" || type.includes("wordprocessingml")) return "docx";
  if (ext === "txt" || ext === "md" || type.startsWith("text/")) return "text";
  return null;
}

export function finalizeText(raw: string, warnings: string[]): string {
  let text = normalizeText(raw);
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    warnings.push(`Text was cut to the first ${MAX_TEXT_CHARS.toLocaleString()} characters.`);
  }
  if (text.length < 80) warnings.push("Very little text was found. If this is a scanned PDF, paste the text instead.");
  return text;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  if (/\.doc$/i.test(file.name)) throw new Error(`${file.name}: old .doc format. Save it as .docx or PDF.`);
  const kind = kindOf(file.name, file.type);
  if (!kind) throw new Error(`${file.name}: unsupported file type. Use PDF, DOCX, TXT or MD.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: larger than 5 MB.`);
  const warnings: string[] = [];
  let raw: string;
  if (kind === "text") raw = await file.text();
  else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    raw = kind === "docx" ? docxToText(bytes) : await (await import("./pdf")).pdfToText(bytes);
  }
  return { name: file.name, kind, text: finalizeText(raw, warnings), warnings };
}
