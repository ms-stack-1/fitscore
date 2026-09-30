import type { Category, LogisticsProfile, Role, WorkMode } from "../../core/types";
import { validateRole, withLogistics } from "../../app/roles";
import { CATEGORY_LABEL } from "../labels";
import { CriteriaEditor } from "./CriteriaEditor";

/*
 * The role setup form: the recruiter's criteria, weights and logistics.
 * Everything a score depends on is edited here and nowhere else.
 */

export function RoleForm({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  const L = role.logistics;
  const setL = (patch: Partial<LogisticsProfile>) => onChange(withLogistics(role, { ...L, ...patch }));
  const setW = (cat: Category, v: number) => onChange({ ...role, weights: { ...role.weights, [cat]: v } });
  const totalW = (Object.values(role.weights) as number[]).reduce((a, b) => a + b, 0) || 1;
  const counts = (cat: Category) => role.criteria.filter((c) => c.category === cat).length;
  const problems = validateRole(role);

  return (
    <div className="role-form">
      <section className="panel form-sec" aria-labelledby="rf-basics">
        <h2 id="rf-basics">1. The role</h2>
        <div className="field-row">
          <label className="field">
            <span>Title</span>
            <input value={role.title} onChange={(e) => onChange({ ...role, title: e.target.value })} />
          </label>
          <label className="field">
            <span>Company (optional)</span>
            <input value={role.company ?? ""} onChange={(e) => onChange({ ...role, company: e.target.value || undefined })} />
          </label>
        </div>
      </section>

      <section className="panel form-sec" aria-labelledby="rf-criteria">
        <h2 id="rf-criteria">2. Criteria</h2>
        <p className="form-help">
          Drafted from the job description. Edit freely: reword, re-weight, recategorise, delete, or add your own. Must-haves default to 3 points,
          responsibilities to 2, nice-to-haves to 1.
        </p>
        <CriteriaEditor criteria={role.criteria} onChange={(criteria) => onChange({ ...role, criteria })} />
      </section>

      <section className="panel form-sec" aria-labelledby="rf-logistics">
        <h2 id="rf-logistics">3. Logistics</h2>
        <p className="form-help">These become logistics criteria. A candidate is only judged on what their CV states; silence is &ldquo;not assessed&rdquo;, not a miss.</p>
        <div className="field-grid">
          <label className="field">
            <span>Work mode</span>
            <select value={L.workMode} onChange={(e) => setL({ workMode: e.target.value as WorkMode })}>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
              <option value="unspecified">Not specified</option>
            </select>
          </label>
          <label className="field">
            <span>Location (City, ST)</span>
            <input value={L.location ?? ""} placeholder="Austin, TX" onChange={(e) => setL({ location: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Country (for remote roles)</span>
            <input value={L.country ?? ""} placeholder="US" onChange={(e) => setL({ country: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Travel (%)</span>
            <input type="number" min={0} max={100} value={L.travelPercent ?? ""} onChange={(e) => setL({ travelPercent: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
          <label className="field">
            <span>Visa sponsorship</span>
            <select value={L.sponsorship} onChange={(e) => setL({ sponsorship: e.target.value as LogisticsProfile["sponsorship"] })}>
              <option value="unspecified">Not specified</option>
              <option value="available">Available</option>
              <option value="not_available">Not available</option>
            </select>
          </label>
          <label className="field">
            <span>Relocation support</span>
            <select
              value={L.relocationSupport === undefined ? "" : L.relocationSupport ? "yes" : "no"}
              onChange={(e) => setL({ relocationSupport: e.target.value === "" ? undefined : e.target.value === "yes" })}
            >
              <option value="">Not specified</option>
              <option value="yes">Offered</option>
              <option value="no">Not offered</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel form-sec" aria-labelledby="rf-weights">
        <h2 id="rf-weights">4. Category weights</h2>
        <p className="form-help">Relative weights for the overall score. A category with nothing assessable for a candidate hands its weight to the others.</p>
        <div className="weights">
          {(["technical", "experience", "logistics", "custom"] as Category[]).map((cat) => (
            <label key={cat} className="weight">
              <span className="weight-name">
                {CATEGORY_LABEL[cat]} <span className="muted">({counts(cat)} criteria)</span>
              </span>
              <input type="range" min={0} max={100} step={5} value={role.weights[cat]} onChange={(e) => setW(cat, Number(e.target.value))} />
              <output>{Math.round((role.weights[cat] / totalW) * 100)}%</output>
            </label>
          ))}
        </div>
      </section>

      <section className="panel form-sec" aria-labelledby="rf-privacy">
        <h2 id="rf-privacy">5. Privacy</h2>
        <label className="check">
          <input type="checkbox" checked={role.blind ?? true} onChange={(e) => onChange({ ...role, blind: e.target.checked })} />
          <span>
            <strong>Blind mode</strong> for applicants: remove names, contact details, birth dates, graduation years, pronouns and personal-status
            lines before scoring. Names can be revealed per candidate later; each reveal is logged.
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={role.keepLocation ?? true} disabled={!(role.blind ?? true)} onChange={(e) => onChange({ ...role, keepLocation: e.target.checked })} />
          <span>Keep city and state so logistics can be scored.</span>
        </label>
      </section>

      {problems.length > 0 && (
        <ul className="problems" role="status">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
