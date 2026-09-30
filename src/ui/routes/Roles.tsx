import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Role } from "../../core/types";
import { deleteRole, download, exportWorkspace, getCandidates, importWorkspace, listRoles } from "../../store/db";

export function Roles() {
  const [roles, setRoles] = useState<(Role & { applicants: number })[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const list = await listRoles();
    setRoles(await Promise.all(list.map(async (r) => ({ ...r, applicants: (await getCandidates(r.id)).length }))));
  }
  useEffect(() => {
    void load();
  }, []);

  async function exportAll() {
    const w = await exportWorkspace();
    download(`fitscore-workspace-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(w, null, 2), "application/json");
    setMsg("Workspace exported. The file contains full CV text: store it as carefully as the CVs themselves.");
  }

  async function importAll(file: File | undefined) {
    if (!file) return;
    try {
      const n = await importWorkspace(JSON.parse(await file.text()));
      setMsg(`Imported ${n} role${n === 1 ? "" : "s"}.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function wipe() {
    if (!roles?.length) return;
    if (!confirm(`Delete all ${roles.length} roles and every applicant stored in this browser? This cannot be undone.`)) return;
    for (const r of roles) await deleteRole(r.id);
    setMsg("All local data deleted.");
    await load();
  }

  return (
    <div className="page">
      <header className="page-head row-head">
        <div>
          <p className="eyebrow">Rank applicants</p>
          <h1>Roles</h1>
          <p className="lede">Set up a role once, then add applicants in bulk and rank them against it. Stored only in this browser.</p>
        </div>
        <Link className="btn btn-lg" to="/roles/new">
          New role
        </Link>
      </header>

      {roles === null ? (
        <p aria-busy="true">Loading…</p>
      ) : roles.length === 0 ? (
        <div className="empty panel">
          <h2>No roles yet</h2>
          <p>Paste a job description and FitScore drafts the criteria for you to review. Or try a single CV first with a quick match.</p>
          <div className="qm-actions">
            <Link className="btn" to="/roles/new">
              Set up a role
            </Link>
            <Link className="btn btn-ghost" to="/match">
              Quick match
            </Link>
          </div>
        </div>
      ) : (
        <ul className="role-list">
          {roles.map((r) => (
            <li key={r.id}>
              <Link className="role-card panel" to={`/roles/${r.id}`}>
                <span className="role-title">{r.title || "Untitled role"}</span>
                {r.company && <span className="muted"> · {r.company}</span>}
                <span className="role-meta">
                  {r.applicants} applicant{r.applicants === 1 ? "" : "s"} · {r.criteria.length} criteria · updated {new Date(r.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="data-tools" aria-labelledby="dt-title">
        <h2 id="dt-title">Your data</h2>
        <p className="form-help">Nothing leaves this browser unless you export it. Move a workspace between browsers with a file.</p>
        <div className="qm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void exportAll()} disabled={!roles?.length}>
            Export workspace
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Import workspace
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importAll(e.target.files?.[0])} />
          <button type="button" className="btn btn-ghost danger" onClick={() => void wipe()} disabled={!roles?.length}>
            Delete all local data
          </button>
        </div>
        {msg && (
          <p role="status" className="form-help">
            {msg}
          </p>
        )}
      </section>
    </div>
  );
}
