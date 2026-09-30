import { useId, useRef, useState } from "react";
import { ACCEPT, parseFile } from "../../core/parse/index";

/*
 * Paste or upload. An upload is parsed in the browser and poured into the
 * textarea, so the person always sees (and can fix) exactly what gets scored.
 */

interface Props {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minChars: number;
}

export function SourceInput({ label, hint, value, onChange, placeholder, minChars }: Props) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [drag, setDrag] = useState(false);

  async function load(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await parseFile(file);
      onChange(out.text);
      setMsg(out.warnings.length ? { kind: "warn", text: out.warnings.join(" ") } : { kind: "ok", text: `Read ${out.name}. Check the text below before scoring.` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Could not read that file." });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const count = value.trim().length;
  return (
    <div
      className={`source ${drag ? "drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void load(e.dataTransfer.files[0]);
      }}
    >
      <div className="source-head">
        <label htmlFor={id}>{label}</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy} aria-describedby={`${id}-hint`}>
          {busy ? "Reading…" : "Upload file"}
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => void load(e.target.files?.[0])} />
      </div>
      <p id={`${id}-hint`} className="source-hint">
        {hint} PDF, DOCX, TXT or MD, or drop a file here.
      </p>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} rows={14} />
      <div className="source-foot">
        <span className={count && count < minChars ? "warn-text" : ""}>
          {count.toLocaleString()} characters{count && count < minChars ? ` (at least ${minChars} needed)` : ""}
        </span>
        {msg && (
          <span role={msg.kind === "err" ? "alert" : "status"} className={`source-msg ${msg.kind}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
