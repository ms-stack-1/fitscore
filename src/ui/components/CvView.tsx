import type { CvLine, Judgment } from "../../core/types";

/*
 * The CV exactly as the engine saw it: numbered lines, redactions visible,
 * cited lines marked. Every evidence link in the breakdown lands here.
 */

export function CvView({ lines, judgments, active }: { lines: CvLine[]; judgments: Judgment[]; active: string | null }) {
  const cited = new Set(judgments.flatMap((j) => j.evidence.map((e) => e.lineId)));
  return (
    <ol className="cv-view" aria-label="CV lines as scored">
      {lines.map((l) => (
        <li key={l.id} id={`line-${l.id}`} className={`${cited.has(l.id) ? "cited" : ""} ${active === l.id ? "active" : ""}`} tabIndex={-1}>
          <span className="cv-id" aria-hidden="true">
            {l.id}
          </span>
          <span className="cv-text">
            {l.text.split(/(\[[a-z ]+(?: removed)?\]|\[Candidate\])/i).map((part, i) =>
              /^\[.+\]$/.test(part) ? (
                <mark key={i} className="redacted">
                  {part}
                </mark>
              ) : (
                part
              ),
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
