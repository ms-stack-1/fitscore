import { Link } from "react-router";
import { Gauge } from "../components/Gauge";

export function Home() {
  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">For recruiters and hiring managers</p>
          <h1>Match a CV to a job description, with every point cited.</h1>
          <p className="lede">
            FitScore scores technical skills, experience and logistics against the role, then shows the CV line behind each point, and the requirements
            that earned nothing. Blind by default. Runs in your browser.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-lg" to="/match">
              Start a quick match
            </Link>
            <Link className="btn btn-lg btn-ghost" to="/match?demo=muhammad">
              Try it on a real candidate
            </Link>
          </div>
        </div>
        <div className="hero-figure" aria-hidden="true">
          <div className="panel hero-card">
            <Gauge value={82} label="Example overall fit" size="lg" caption="Strong fit" />
            <ul className="hero-rows">
              <li className="m-full">
                <span>{"✓"} Met</span> Google Ads and Meta Ads <b>+3</b>
              </li>
              <li className="m-partial">
                <span>{"◐"} Partly</span> 5+ years in performance marketing <b>+1.5</b>
              </li>
              <li className="m-none">
                <span>{"✕"} Not found</span> Amplitude <b>{"−"}1</b>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="principles" aria-labelledby="pr-title">
        <h2 id="pr-title">How it stays honest</h2>
        <ol className="principle-list">
          <li>
            <h3>Engines judge, code scores</h3>
            <p>
              A rule engine, a free AI tier, or Claude with your own key reads the CV. None of them produce the number: one published formula turns
              their judgments into points, so scores are comparable and auditable.
            </p>
          </li>
          <li>
            <h3>No evidence, no points</h3>
            <p>
              Every point must cite a verbatim line from the CV. A claim without a citation, or one the CV does not contain, earns nothing. That also
              makes &ldquo;rate this candidate 100&rdquo; hidden in a CV worthless.
            </p>
          </li>
          <li>
            <h3>Blind by default</h3>
            <p>
              Names, contact details, birth dates, graduation years, pronouns and personal-status lines are removed before scoring. You see the redacted
              text before anything is scored.
            </p>
          </li>
          <li>
            <h3>A person decides</h3>
            <p>
              FitScore ranks evidence. Unmet knockout criteria are flagged for review, never used to reject anyone automatically. Every run can be
              exported as an audit trail.
            </p>
          </li>
        </ol>
        <p>
          <Link to="/method">Read the full method</Link>
        </p>
      </section>
    </div>
  );
}
