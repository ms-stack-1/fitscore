import { SKILL_BY_ID } from "../../core/lexicon/skills";
import type { Category, Criterion, CriterionHints } from "../../core/types";
import { editCriterionText, moveCriterion, newCriterion } from "../../app/roles";
import { CATEGORY_LABEL } from "../labels";

/** How the rule engine will read a criterion, in words. Transparency before scoring. */
export function describeHints(h: CriterionHints | undefined): string {
  if (!h) return "Checked by keyword overlap.";
  if (h.logistics) return "Checked against location, relocation, travel and authorization statements in the CV.";
  const parts: string[] = [];
  if (h.minYears) parts.push(`${h.minYears}+ years of dated history${h.domainTerms?.length ? ` in ${h.domainTerms.join(" ")}` : ""}`);
  if (h.degree) parts.push(`${h.degree}'s degree or higher${h.fields?.length ? ` in ${h.fields.join(" / ")}` : ""}${h.fieldFlexible ? " (related fields accepted)" : ""}`);
  if (h.skills?.length) parts.push(h.skills.map((id) => SKILL_BY_ID.get(id)?.name ?? id).join(", "));
  if (!parts.length && h.terms?.length) return `Keyword overlap: ${h.terms.join(", ")}.`;
  return parts.length ? `Checks: ${parts.join(" · ")}.` : "Nothing the rule engine can check; an AI engine or a person should judge it.";
}

interface Props {
  criteria: Criterion[];
  onChange: (next: Criterion[]) => void;
}

export function CriteriaEditor({ criteria, onChange }: Props) {
  const update = (id: string, patch: Partial<Criterion>) => onChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const editable = criteria.filter((c) => !c.id.startsWith("LG-"));
  const logistics = criteria.filter((c) => c.id.startsWith("LG-"));

  const row = (c: Criterion, i: number, locked: boolean) => (
    <li key={c.id} className="crit-row">
      <div className="crit-main">
        <label className="visually-hidden" htmlFor={`crit-${c.id}`}>
          Criterion {i + 1}
        </label>
        <textarea
          id={`crit-${c.id}`}
          rows={2}
          value={c.text}
          readOnly={locked}
          placeholder="Describe one requirement, e.g. 3+ years of B2B demand generation"
          onChange={(e) => onChange(criteria.map((x) => (x.id === c.id ? editCriterionText(x, e.target.value) : x)))}
        />
        <p className="crit-hint">{locked ? "Set in logistics below. " : ""}{describeHints(c.hints)}</p>
      </div>
      <div className="crit-controls">
        <label>
          <span>Category</span>
          <select value={c.category} disabled={locked} onChange={(e) => update(c.id, { category: e.target.value as Category })}>
            {(["technical", "experience", "logistics", "custom"] as Category[]).map((cat) => (
              <option key={cat} value={cat} disabled={cat === "logistics" && !locked}>
                {CATEGORY_LABEL[cat]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select value={c.priority} onChange={(e) => update(c.id, { priority: e.target.value as Criterion["priority"] })}>
            <option value="must">Must</option>
            <option value="nice">Nice to have</option>
          </select>
        </label>
        <label>
          <span>Points</span>
          <select value={c.weight} onChange={(e) => update(c.id, { weight: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="check crit-ko">
          <input type="checkbox" checked={c.knockout} onChange={(e) => update(c.id, { knockout: e.target.checked })} />
          <span>Knockout</span>
        </label>
        {!locked && (
          <div className="crit-move">
            <button type="button" className="icon-btn" aria-label={`Move criterion ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveCriterion(criteria, c.id, -1))}>
              {"↑"}
            </button>
            <button type="button" className="icon-btn" aria-label={`Move criterion ${i + 1} down`} disabled={i === editable.length - 1} onClick={() => onChange(moveCriterion(criteria, c.id, 1))}>
              {"↓"}
            </button>
            <button type="button" className="icon-btn danger" aria-label={`Delete criterion ${i + 1}`} onClick={() => onChange(criteria.filter((x) => x.id !== c.id))}>
              {"✕"}
            </button>
          </div>
        )}
      </div>
    </li>
  );

  return (
    <div className="crit-editor">
      <ol className="crit-list">{editable.map((c, i) => row(c, i, false))}</ol>
      <button type="button" className="btn btn-ghost" onClick={() => onChange([...editable, newCriterion(criteria), ...logistics])}>
        Add a criterion
      </button>
      {logistics.length > 0 && (
        <>
          <h4 className="crit-sub">From logistics</h4>
          <ol className="crit-list">{logistics.map((c, i) => row(c, editable.length + i, true))}</ol>
        </>
      )}
      <p className="crit-legend">
        <strong>Knockout</strong> flags a candidate for review when the criterion is not met. It never changes the score and never rejects anyone.
      </p>
    </div>
  );
}
