import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getJudge } from "../../app/engines";
import { addApplicant, rankRows, readApplicantFile, rescore, topGap, type QueueItem, type Row, type SortKey } from "../../app/ranking";
import { scoringKey } from "../../app/roles";
import { newId } from "../../app/pipeline";
import { DECISION_NOTICE, auditToCsv, buildAudit } from "../../core/audit";
import { ACCEPT } from "../../core/parse/index";
import { bandLabel } from "../../core/score";
import type { Band, Candidate, CandidateResult } from "../../core/types";
import { deleteRole, download, fileSlug, logEvent, saveCandidates, saveResults } from "../../store/db";
import { useRoleData } from "../useRoleData";

const COLS: { key: SortKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "technical", label: "Technical" },
  { key: "experience", label: "Experience" },
  { key: "logistics", label: "Logistics" },
];

export function Applicants() {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const { data, state, reload } = useRoleData(roleId);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "overall", dir: "desc" });
  const [band, setBand] = useState<Band | "all">("all");
  const [review, setReview] = useState<"all" | "flagged" | "clear">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const key = data ? scoringKey(data.role) : "";
  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const byC = new Map(data.results.map((r) => [r.candidateId, r]));
    return data.candidates.map((c) => {
      const result = byC.get(c.id);
      return { candidate: c, result, stale: !!result && result.roleKey !== key };
    });
  }, [data, key]);

  if (state === "missing") {
    return (
      <div className="page">
        <h1>Role not found</h1>
        <p>
          <Link to="/roles">Back to roles</Link>
        </p>
      </div>
    );
  }
  if (!data) return <div className="page" aria-busy="true" />;
  const { role } = data;

  const ranked = rankRows(rows, sort.key, sort.dir).filter((r) => {
    if (band !== "all" && r.result?.scorecard.band !== band) return false;
    const flagged = !!r.result?.scorecard.flags.length;
    if (review === "flagged" && !flagged) return false;
    if (review === "clear" && flagged) return false;
    return true;
  });
  const stale = rows.filter((r) => r.stale).length;

  /** Process sources one at a time so the ranking fills in live and a bad file never blocks the rest. */
  async function ingest(sources: { name: string; load: () => Promise<{ text: string; warnings: string[] }> }[]) {
    if (!sources.length) return;
    setBusy(true);
    const items: QueueItem[] = sources.map((s) => ({ id: newId(), name: s.name, state: "queued" }));
    setQueue((q) => [...items, ...q]);
    const judge = getJudge();
    let candidates: Candidate[] = [...data!.candidates];
    let results: CandidateResult[] = [...data!.results];
    const set = (id: string, patch: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    for (let i = 0; i < sources.length; i++) {
      const item = items[i]!;
      try {
        set(item.id, { state: "reading" });
        const { text, warnings } = await sources[i]!.load();
        if (text.trim().length < 80) throw new Error("Too little text to score. Is it a scanned PDF?");
        set(item.id, { state: "scoring" });
        const { candidate, result } = await addApplicant(role, candidates, { text, fileName: item.name }, judge);
        candidates = [...candidates, candidate];
        results = [...results, result];
        await saveCandidates(role.id, candidates);
        await saveResults(role.id, results);
        await logEvent(role.id, { kind: "scored", candidateId: candidate.id, detail: `${candidate.label} · ${result.result.engine.label}` });
        set(item.id, { state: "done", message: `${candidate.label} · ${result.scorecard.overall}${warnings.length ? ` · ${warnings[0]}` : ""}` });
      } catch (e) {
        set(item.id, { state: "error", message: e instanceof Error ? e.message : "Failed." });
      }
    }
    await reload();
    setBusy(false);
  }

  async function rescoreAll() {
    setBusy(true);
    const judge = getJudge();
    const results: CandidateResult[] = [];
    for (const c of data!.candidates) results.push(await rescore(role, c, judge));
    await saveResults(role.id, results);
    await logEvent(role.id, { kind: "criteria_changed", detail: `Rescored ${results.length} applicants after criteria changed` });
    await reload();
    setBusy(false);
  }

  async function exportAudit(kind: "json" | "csv") {
    const byC = new Map(data!.results.map((r) => [r.candidateId, r]));
    const entries = data!.candidates.filter((c) => byC.has(c.id)).map((candidate) => ({ candidate, result: byC.get(candidate.id)! }));
    await logEvent(role.id, { kind: "exported", detail: kind.toUpperCase() });
    const bundle = buildAudit(role, entries, [...data!.events, { ts: Date.now(), kind: "exported", detail: kind.toUpperCase() }]);
    const base = `fitscore-audit-${fileSlug(role.title)}-${new Date().toISOString().slice(0, 10)}`;
    if (kind === "json") download(`${base}.json`, JSON.stringify(bundle, null, 2), "application/json");
    else download(`${base}.csv`, auditToCsv(bundle), "text/csv");
  }

  async function remove() {
    if (!confirm(`Delete "${role.title}" and all ${data!.candidates.length} applicants? This cannot be undone.`)) return;
    await deleteRole(role.id);
    navigate("/roles");
  }

  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  const sortBy = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "desc" ? "asc" : "desc" } : { key: k, dir: k === "label" ? "asc" : "desc" }));
  const ariaSort = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none");

  return (
    <div className="page">
      <header className="page-head row-head">
        <div>
          <p className="eyebrow">
            <Link to="/roles">Roles</Link> / Applicants
          </p>
          <h1>
            {role.title || "Untitled role"}
            {role.company && <span className="res-co"> at {role.company}</span>}
          </h1>
          <p className="lede">
            {role.criteria.length} criteria · blind mode {role.blind ?? true ? "on" : "off"} · {data.candidates.length} applicant{data.candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-ghost" to={`/roles/${role.id}/edit`}>
            Edit criteria
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => void exportAudit("csv")} disabled={!data.results.length}>
            Audit CSV
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void exportAudit("json")} disabled={!data.results.length}>
            Audit JSON
          </button>
          <button type="button" className="btn btn-ghost danger" onClick={() => void remove()}>
            Delete role
          </button>
        </div>
      </header>
      <p className="notice">{DECISION_NOTICE}</p>

      <section className="panel add-panel" aria-labelledby="add-title">
        <h2 id="add-title">Add applicants</h2>
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = [...e.dataTransfer.files];
            void ingest(files.map((f) => ({ name: f.name, load: () => readApplicantFile(f) })));
          }}
        >
          <p>
            Drop CVs here, or{" "}
            <button type="button" className="linklike" onClick={() => fileRef.current?.click()} disabled={busy}>
              choose files
            </button>
            . PDF, DOCX, TXT or MD. Each is {role.blind ?? true ? "blinded, " : ""}scored in your browser and added to the ranking.
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void ingest(files.map((f) => ({ name: f.name, load: () => readApplicantFile(f) })));
            }}
          />
        </div>
        <details className="paste-cv">
          <summary>Or paste one CV</summary>
          <textarea rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Paste a CV" />
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || paste.trim().length < 80}
            onClick={() => {
              const text = paste;
              setPaste("");
              void ingest([{ name: "Pasted CV", load: async () => ({ text, warnings: [] }) }]);
            }}
          >
            Add and score
          </button>
        </details>
        {queue.length > 0 && (
          <ul className="queue" aria-live="polite" aria-label="Processing">
            {queue.slice(0, 12).map((q) => (
              <li key={q.id} className={`q-${q.state}`}>
                <span className="q-state">{q.state === "done" ? "✓" : q.state === "error" ? "✕" : "…"}</span>
                <span className="q-name">{q.name}</span>
                <span className="q-msg">{q.message ?? q.state}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stale > 0 && (
        <div className="stale panel" role="status">
          <p>
            Criteria changed after {stale} applicant{stale === 1 ? " was" : "s were"} scored. Their scores reflect the old criteria.
          </p>
          <button type="button" className="btn btn-sm" onClick={() => void rescoreAll()} disabled={busy}>
            Rescore all
          </button>
        </div>
      )}

      <section className="ranking" aria-labelledby="rank-title">
        <div className="rank-head">
          <h2 id="rank-title">Ranking</h2>
          <div className="filters">
            <label>
              <span>Band</span>
              <select value={band} onChange={(e) => setBand(e.target.value as Band | "all")}>
                <option value="all">All</option>
                <option value="strong">Strong</option>
                <option value="good">Good</option>
                <option value="partial">Partial</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              <span>Review flags</span>
              <select value={review} onChange={(e) => setReview(e.target.value as typeof review)}>
                <option value="all">All</option>
                <option value="flagged">Needs review</option>
                <option value="clear">No flags</option>
              </select>
            </label>
            <Link
              className={`btn btn-sm ${picked.length < 2 ? "is-disabled" : ""}`}
              aria-disabled={picked.length < 2}
              to={picked.length >= 2 ? `/roles/${role.id}/compare?ids=${picked.join(",")}` : "#"}
              onClick={(e) => picked.length < 2 && e.preventDefault()}
            >
              Compare {picked.length ? `(${picked.length})` : ""}
            </Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="bd-empty">No applicants yet. Add CVs above and they will appear here, ranked as they are scored.</p>
        ) : (
          <div className="table-wrap">
            <table className="rank-table">
              <caption className="visually-hidden">Applicants ranked by {sort.key}, {sort.dir === "desc" ? "highest first" : "lowest first"}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Select to compare</span>
                  </th>
                  <th scope="col">#</th>
                  <th scope="col" aria-sort={ariaSort("label")}>
                    <button type="button" onClick={() => sortBy("label")}>
                      Candidate
                    </button>
                  </th>
                  {COLS.map((c) => (
                    <th key={c.key} scope="col" aria-sort={ariaSort(c.key)} className="num">
                      <button type="button" onClick={() => sortBy(c.key)}>
                        {c.label}
                        <span aria-hidden="true">{sort.key === c.key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}</span>
                      </button>
                    </th>
                  ))}
                  <th scope="col">Main gap</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => {
                  const card = r.result?.scorecard;
                  const name = r.candidate.revealed && r.candidate.detectedName ? r.candidate.detectedName : r.candidate.label;
                  return (
                    <tr key={r.candidate.id} className={r.stale ? "is-stale" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Compare ${name}`}
                          checked={picked.includes(r.candidate.id)}
                          disabled={!picked.includes(r.candidate.id) && picked.length >= 3}
                          onChange={() => togglePick(r.candidate.id)}
                        />
                      </td>
                      <td className="num">{i + 1}</td>
                      <td>
                        <Link to={`/roles/${role.id}/c/${r.candidate.id}`}>{name}</Link>
                        {card?.flags.length ? <span className="flag-badge">Needs review</span> : null}
                        {r.stale ? <span className="stale-badge">Stale</span> : null}
                      </td>
                      <td className="num">
                        {card ? (
                          <span className="meter-cell">
                            <span className="meter" aria-hidden="true">
                              <span style={{ width: `${card.overall}%` }} />
                            </span>
                            <b>{card.overall}</b>
                            <span className="band-word">{bandLabel(card.band).replace(" fit", "")}</span>
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      {(["technical", "experience", "logistics"] as const).map((k) => (
                        <td key={k} className="num">
                          {card && card.categories[k].score !== null ? Math.round(card.categories[k].score) : <span className="muted">n/a</span>}
                        </td>
                      ))}
                      <td className="gap-cell">{topGap(r.result) ?? <span className="muted">None</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && ranked.length === 0 && <p className="bd-empty">No applicants match these filters.</p>}
      </section>
    </div>
  );
}
