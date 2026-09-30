import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { newId, roleFromJd } from "../../app/pipeline";
import { validateRole } from "../../app/roles";
import { DEFAULT_WEIGHTS, type Role } from "../../core/types";
import { getRole, saveRole } from "../../store/db";
import { RoleForm } from "../components/RoleForm";
import { SourceInput } from "../components/SourceInput";

function blankRole(): Role {
  const now = Date.now();
  return { id: newId(), title: "", jdText: "", criteria: [], weights: { ...DEFAULT_WEIGHTS }, logistics: { workMode: "unspecified", sponsorship: "unspecified" }, blind: true, keepLocation: true, createdAt: now, updatedAt: now };
}

export function RoleSetup() {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const editing = !!roleId;
  const [jd, setJd] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roleId) return;
    void getRole(roleId).then((r) => (r ? setRole(r) : setMissing(true)));
  }, [roleId]);

  if (missing) {
    return (
      <div className="page">
        <h1>Role not found</h1>
        <p>
          It may have been deleted, or it was created in another browser. <Link to="/roles">Back to roles</Link>
        </p>
      </div>
    );
  }

  if (!role) {
    if (editing) return <div className="page" aria-busy="true" />;
    return (
      <div className="page">
        <header className="page-head">
          <p className="eyebrow">New role · step 1 of 2</p>
          <h1>Start from the job description</h1>
          <p className="lede">FitScore drafts the criteria, weights and logistics from it. You review and edit everything before any applicant is scored.</p>
        </header>
        <SourceInput label="Job description" hint="Paste the full posting." value={jd} onChange={setJd} placeholder="Paste the job description here" minChars={200} />
        <div className="qm-actions">
          <button type="button" className="btn btn-lg" disabled={jd.trim().length < 200} onClick={() => setRole({ ...roleFromJd(jd), blind: true, keepLocation: true })}>
            Draft criteria
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setRole(blankRole())}>
            Start from scratch
          </button>
        </div>
      </div>
    );
  }

  const problems = validateRole(role);
  async function save() {
    if (!role || problems.length) return;
    setSaving(true);
    await saveRole({ ...role, criteria: role.criteria.filter((c) => c.text.trim()), updatedAt: Date.now() });
    navigate(`/roles/${role.id}`);
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">{editing ? "Edit role" : "New role · step 2 of 2"}</p>
        <h1>{editing ? role.title || "Untitled role" : "Review the criteria"}</h1>
        <p className="lede">
          {editing
            ? "Changes to criteria, weights or logistics mark existing scores as stale until you rescore."
            : "This is a draft read from the job description by rules, not a final list. Fix what it got wrong before scoring anyone."}
        </p>
      </header>
      <RoleForm role={role} onChange={setRole} />
      <div className="qm-actions sticky-actions">
        <button type="button" className="btn btn-lg" disabled={!!problems.length || saving} onClick={() => void save()}>
          {editing ? "Save changes" : "Save role and add applicants"}
        </button>
        <Link className="btn btn-ghost" to={editing ? `/roles/${role.id}` : "/roles"}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
