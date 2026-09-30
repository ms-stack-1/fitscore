import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { rankRows } from "../../app/ranking";
import { scoringKey } from "../../app/roles";
import { DECISION_NOTICE } from "../../core/audit";
import { bandLabel } from "../../core/score";
import { logEvent, saveCandidates, saveResults } from "../../store/db";
import { EngineBadge, ResultView } from "../components/ResultView";
import { useRoleData } from "../useRoleData";

export function CandidatePage() {
  const { roleId, candidateId } = useParams();
  const navigate = useNavigate();
  const { data, state, reload } = useRoleData(roleId);
  const [confirming, setConfirming] = useState(false);

  if (state === "missing") return <div className="page"><h1>Role not found</h1><Link to="/roles">Back to roles</Link></div>;
  if (!data) return <div className="page" aria-busy="true" />;
  const candidate = data.candidates.find((c) => c.id === candidateId);
  const result = data.results.find((r) => r.candidateId === candidateId);
  if (!candidate || !result) {
    return (
      <div className="page">
        <h1>Applicant not found</h1>
        <Link to={`/roles/${data.role.id}`}>Back to the ranking</Link>
      </div>
    );
  }

  const role = data.role;
  const ranked = rankRows(
    data.candidates.map((c) => ({ candidate: c, result: data.results.find((r) => r.candidateId === c.id), stale: false })),
    "overall",
    "desc",
  );
  const pos = ranked.findIndex((r) => r.candidate.id === candidate.id);
  const prev = ranked[pos - 1]?.candidate;
  const next = ranked[pos + 1]?.candidate;
  const stale = result.roleKey !== scoringKey(role);
  const name = candidate.revealed && candidate.detectedName ? candidate.detectedName : candidate.label;

  async function reveal() {
    const list = data!.candidates.map((c) => (c.id === candidate!.id ? { ...c, revealed: true } : c));
    await saveCandidates(role.id, list);
    await logEvent(role.id, { kind: "reveal", candidateId: candidate!.id, detail: `${candidate!.label} revealed` });
    setConfirming(false);
    await reload();
  }

  async function removeCandidate() {
    if (!confirm(`Remove ${name} from this role? Their CV and score are deleted from this browser.`)) return;
    await saveCandidates(role.id, data!.candidates.filter((c) => c.id !== candidate!.id));
    await saveResults(role.id, data!.results.filter((r) => r.candidateId !== candidate!.id));
    navigate(`/roles/${role.id}`);
  }

  return (
    <div className="page">
      <div className="results">
        <header className="res-head">
          <p className="eyebrow">
            <Link to="/roles">Roles</Link> / <Link to={`/roles/${role.id}`}>{role.title || "Role"}</Link> / Rank {pos + 1} of {ranked.length}
          </p>
          <h1>
            {name} <span className="res-vs">for</span> {role.title}
          </h1>
          <p className="res-summary">
            {result.scorecard.overall} out of 100, {bandLabel(result.scorecard.band).toLowerCase()}.
            {candidate.fileName ? ` From ${candidate.fileName}.` : ""}
          </p>
          <div className="res-meta">
            <EngineBadge result={result.result} />
            {candidate.blind && !candidate.revealed && !confirming && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)}>
                Reveal identity
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              Print or save PDF
            </button>
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => void removeCandidate()}>
              Remove
            </button>
          </div>
          {confirming && (
            <div className="reveal-confirm panel" role="alertdialog" aria-labelledby="rv-t" aria-describedby="rv-d">
              <p id="rv-t">
                <strong>Reveal {candidate.label}?</strong>
              </p>
              <p id="rv-d">
                Their name will show in the ranking and the audit trail will record that you revealed it and when. Blind review works best when
                identities are revealed only after a shortlist is set.
              </p>
              <div className="qm-actions">
                <button type="button" className="btn btn-sm" onClick={() => void reveal()} autoFocus>
                  Reveal and log it
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                  Keep blind
                </button>
              </div>
            </div>
          )}
          {stale && (
            <p className="stale-note" role="status">
              This score was computed before the criteria last changed. <Link to={`/roles/${role.id}`}>Rescore from the ranking.</Link>
            </p>
          )}
          <p className="notice">{DECISION_NOTICE}</p>
        </header>

        <ResultView candidate={candidate.revealed ? { ...candidate, text: candidate.text } : candidate} result={result.result} scorecard={result.scorecard} />

        <nav className="pager" aria-label="Other applicants">
          {prev ? <Link to={`/roles/${role.id}/c/${prev.id}`}>{"←"} Rank {pos}</Link> : <span />}
          <Link to={`/roles/${role.id}`}>Back to the ranking</Link>
          {next ? <Link to={`/roles/${role.id}/c/${next.id}`}>Rank {pos + 2} {"→"}</Link> : <span />}
        </nav>
      </div>
    </div>
  );
}
