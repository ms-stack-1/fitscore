import { BANDS } from "../../core/score";
import { DEFAULT_WEIGHTS } from "../../core/types";
import { CATEGORY_LABEL } from "../labels";

export function Method() {
  return (
    <div className="page prose-page">
      <header className="page-head">
        <p className="eyebrow">Method</p>
        <h1>How FitScore scores</h1>
        <p className="lede">Everything that produces a number is on this page. If a score surprises you, the breakdown shows which rule produced it.</p>
      </header>

      <section>
        <h2>1. The job description becomes criteria</h2>
        <p>
          Requirements become <strong>must</strong> criteria worth 3 points, responsibilities are worth 2, and preferred or nice-to-have items are worth
          1. Location, work mode, travel and sponsorship become logistics criteria. In role setup a recruiter can edit any criterion, change its
          weight from 1 to 5, and mark it as a knockout.
        </p>
      </section>

      <section>
        <h2>2. An engine judges each criterion</h2>
        <p>For every criterion the engine returns one of four judgments, and the CV lines that support it:</p>
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Judgment</th>
              <th scope="col">Share of the criterion&rsquo;s points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Met</td>
              <td>100%</td>
            </tr>
            <tr>
              <td>Partly met</td>
              <td>50%</td>
            </tr>
            <tr>
              <td>Not found</td>
              <td>0%</td>
            </tr>
            <tr>
              <td>Not assessed</td>
              <td>Excluded: the CV neither confirms nor rules it out</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>No evidence, no points.</strong> A citation counts only if the cited line exists and the quoted text appears in it word for word.
          &ldquo;Met&rdquo; or &ldquo;Partly met&rdquo; with no surviving citation becomes &ldquo;Not found&rdquo;. This rule applies to every
          engine, including the rule engine, and is what makes instructions hidden in a CV or job description inert.
        </p>
        <h3>Engines</h3>
        <ul>
          <li>
            <strong>Rule-based match</strong> (always available, free, in your browser). It recognises named tools from a lexicon of several hundred
            skills, computes tenure from dated roles (overlaps counted once) and checks it against the named domain, reads degree level and field, and
            reads stated location, relocation, travel and authorization. Anything else falls back to keyword overlap, and says so.
          </li>
          <li>
            <strong>AI engines</strong> (coming next): a small free daily allowance on an open model, and Claude with your own API key. They read the CV
            the way a person would, but their judgments pass through the same evidence check and the same formula.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Code turns judgments into scores</h2>
        <p>
          A category score is points earned divided by points possible, times 100. The overall score weights the categories. The defaults are{" "}
          {(["technical", "experience", "logistics"] as const).map((c, i) => (
            <span key={c}>
              {i > 0 ? (i === 2 ? " and " : ", ") : ""}
              {CATEGORY_LABEL[c]} {DEFAULT_WEIGHTS[c]}%
            </span>
          ))}
          . If nothing in a category can be assessed, its weight is shared among the others rather than counted as zero.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Overall score</th>
              <th scope="col">Band</th>
            </tr>
          </thead>
          <tbody>
            {BANDS.map((b, i) => (
              <tr key={b.band}>
                <td>{i === 0 ? `${b.min} and above` : `${b.min} to ${BANDS[i - 1]!.min - 1}`}</td>
                <td>{b.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>An unmet knockout raises a &ldquo;Needs review&rdquo; flag. It never changes the number and never rejects anyone.</p>
      </section>

      <section>
        <h2>4. Blind mode</h2>
        <p>
          On by default. Before any engine sees a CV, FitScore removes the name, email, phone, links and handles, street addresses, date of birth and
          age, graduation years, nationality, gender, marital status and religion lines, honorifics, and gendered pronouns. City and state are kept
          unless you hide them, because logistics scoring needs them. Work-history dates stay, because tenure needs them.
        </p>
        <p>
          This is a text filter, not a guarantee. It cannot see photos, and unusual layouts can slip through. That is why the redacted text is always
          shown before scoring.
        </p>
      </section>

      <section>
        <h2>5. Privacy</h2>
        <p>
          The rule engine runs entirely in your browser. Roles, CVs and results are stored only in this browser. An AI engine, when you choose one,
          receives the blind-mode text only.
        </p>
      </section>

      <section>
        <h2>6. Limits and regulation</h2>
        <p>
          Automated tools that score or rank applicants are regulated in several places. Examples include New York City&rsquo;s law on automated
          employment decision tools (Local Law 144), the EU AI Act (which treats recruitment AI as high-risk) and Colorado&rsquo;s AI Act. FitScore is
          built as decision support: it shows its evidence, never rejects anyone, and exports an audit trail. Whether and how you may use it in your
          jurisdiction is your responsibility. This page is information, not legal advice.
        </p>
      </section>
    </div>
  );
}
