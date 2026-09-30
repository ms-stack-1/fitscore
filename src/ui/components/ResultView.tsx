import { useState, type ReactNode } from "react";
import type { Candidate, JudgeResult, ScoreCard } from "../../core/types";
import { Breakdown } from "./Breakdown";
import { CvView } from "./CvView";
import { ScoreBoard } from "./ScoreBoard";

/** Scoreboard, breakdown and the CV as scored, with citations wired to CV lines. */
export function ResultView({ candidate, result, scorecard, between }: { candidate: Candidate; result: JudgeResult; scorecard: ScoreCard; between?: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);

  function cite(lineId: string) {
    setActive(lineId);
    const panel = document.getElementById("cv-panel") as HTMLDetailsElement | null;
    if (panel) panel.open = true;
    requestAnimationFrame(() => {
      const el = document.getElementById(`line-${lineId}`);
      el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  return (
    <>
      <ScoreBoard card={scorecard} />
      {between}
      <Breakdown card={scorecard} lines={candidate.lines} onCite={cite} />
      <details id="cv-panel" className="panel cv-panel">
        <summary>
          The CV as scored ({candidate.lines.length} lines{candidate.blind && !candidate.revealed ? ", blind" : ""})
        </summary>
        <p className="cv-panel-hint">Every citation above points to one of these numbered lines. Highlighted lines earned points.</p>
        <CvView lines={candidate.lines} judgments={result.judgments} active={active} />
      </details>
      {result.engine.kind === "local" && (
        <p className="footnote">
          The rule engine recognises named tools, dated tenure, degrees and stated logistics, and falls back to keyword overlap for everything else.
          It is conservative by design. <a href="/method">How scoring works</a>.
        </p>
      )}
    </>
  );
}

export function EngineBadge({ result }: { result: JudgeResult }) {
  return (
    <span className="engine-badge" title="The engine judges; FitScore's own code turns judgments into points.">
      Engine: {result.engine.label}
      {result.engine.model ? ` (${result.engine.model})` : ""}
      {result.ms !== undefined ? ` · ${result.ms < 1000 ? `${result.ms} ms` : `${(result.ms / 1000).toFixed(1)} s`}` : ""}
      {result.engine.fallbackReason ? ` · fallback: ${result.engine.fallbackReason}` : ""}
    </span>
  );
}
