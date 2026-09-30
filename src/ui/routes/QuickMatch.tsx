import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DECISION_NOTICE } from "../../core/audit";
import { bandLabel } from "../../core/score";
import { isDemoId, loadDemo, loadSampleJd, type DemoProfile } from "../../app/demo";
import { quickMatch, type MatchOutput } from "../../app/pipeline";
import { EngineBadge, ResultView } from "../components/ResultView";
import { SourceInput } from "../components/SourceInput";

const MIN_JD = 200;
const MIN_CV = 200;

type Phase = { kind: "input" } | { kind: "running"; step: string } | { kind: "done"; out: MatchOutput } | { kind: "error"; message: string };

function DemoCta({ demo, subject }: { demo: DemoProfile; subject: string }) {
  return (
    <aside className="demo-cta panel" aria-label={`Contact ${demo.name}`}>
      <div>
        <p className="eyebrow">This is a real candidate</p>
        <p>{demo.name} built FitScore. If this role fits, the evidence above is the conversation starter.</p>
      </div>
      <div className="demo-cta-actions">
        <a className="btn" href={`mailto:${demo.links.email}?subject=${encodeURIComponent(subject)}`}>
          Email {demo.name.split(" ")[0]}
        </a>
        <a className="btn btn-ghost" href={demo.links.resume} target="_blank" rel="noopener">
          Download CV
        </a>
        <a className="btn btn-ghost" href={demo.links.portfolio} target="_blank" rel="noopener">
          Portfolio
        </a>
      </div>
    </aside>
  );
}

export function QuickMatch() {
  const [params] = useSearchParams();
  const demoId = params.get("demo");
  const [demo, setDemo] = useState<DemoProfile | null>(null);
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState("");
  const [blind, setBlind] = useState(true);
  const [hideLocation, setHideLocation] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDemoId(demoId)) return;
    loadDemo(demoId)
      .then((d) => {
        setDemo(d);
        setCv(d.cv);
        // The demo candidate has consented to being named.
        setBlind(false);
      })
      .catch(() => setPhase({ kind: "error", message: "The demo profile could not be loaded. Paste a CV instead." }));
  }, [demoId]);

  const ready = jd.trim().length >= MIN_JD && cv.trim().length >= MIN_CV;

  async function run() {
    setPhase({ kind: "running", step: "Reading the job description" });
    try {
      // Yield so the status paints before the (fast) synchronous work.
      await new Promise((r) => setTimeout(r, 0));
      const out = await quickMatch({ jdText: jd, cvText: cv, blind, keepLocation: !hideLocation, label: demo ? demo.name : "Candidate A" });
      setPhase({ kind: "done", out });
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        resultsRef.current?.focus({ preventScroll: true });
      });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Scoring failed." });
    }
  }

  if (phase.kind === "done") {
    const { role, candidate, result, scorecard, redactions } = phase.out;
    const removed = redactions.reduce((n, r) => n + r.count, 0);
    return (
      <div className="page">
        <div className="results" ref={resultsRef} tabIndex={-1} aria-labelledby="res-title">
          <header className="res-head">
            <p className="eyebrow">Quick match</p>
            <h1 id="res-title">
              {candidate.label} <span className="res-vs">for</span> {role.title}
              {role.company ? <span className="res-co"> at {role.company}</span> : null}
            </h1>
            <p className="res-summary" role="status">
              {Math.round(scorecard.overall)} out of 100, {bandLabel(scorecard.band).toLowerCase()}, across {role.criteria.length} criteria.
            </p>
            <div className="res-meta">
              <EngineBadge result={result} />
              {candidate.blind && (
                <span className="engine-badge">
                  Blind mode: {removed} identifying detail{removed === 1 ? "" : "s"} removed
                </span>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhase({ kind: "input" })}>
                Edit inputs
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                Print or save PDF
              </button>
            </div>
            <p className="notice">{DECISION_NOTICE}</p>
          </header>

          <ResultView
            candidate={candidate}
            result={result}
            scorecard={scorecard}
            between={demo ? <DemoCta demo={demo} subject={`${role.title}: FitScore ${scorecard.overall}/100`} /> : null}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Quick match</p>
        <h1>{demo ? `Check ${demo.name} against your role` : "One job description, one CV"}</h1>
        <p className="lede">
          {demo
            ? `${demo.name}'s CV is loaded. Paste your job description and see where each point comes from, with the CV line that earned it.`
            : "Paste or upload both. Scoring runs in your browser; nothing is sent anywhere."}
        </p>
      </header>

      <form
        className="qm-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void run();
        }}
      >
        <div className="qm-grid">
          <SourceInput
            label="Job description"
            hint="The full posting works best, including requirements and location."
            value={jd}
            onChange={setJd}
            placeholder="Paste the job description here"
            minChars={MIN_JD}
          />
          {demo ? (
            <div className="source demo-source">
              <div className="source-head">
                <span className="label-like">Candidate</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDemo(null); setCv(""); setBlind(true); }}>
                  Use a different CV
                </button>
              </div>
              <p className="demo-name">{demo.name}</p>
              <p className="demo-headline">{demo.headline}</p>
              <p className="source-hint">{demo.source}</p>
              <details>
                <summary>View the CV text</summary>
                <pre className="demo-cv">{demo.cv}</pre>
              </details>
            </div>
          ) : (
            <SourceInput label="CV" hint="One candidate." value={cv} onChange={setCv} placeholder="Paste the CV here" minChars={MIN_CV} />
          )}
        </div>

        <fieldset className="qm-options" disabled={!!demo}>
          <legend className="visually-hidden">Privacy options</legend>
          <label className="check">
            <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
            <span>
              <strong>Blind mode</strong> removes the name, contact details, birth date, graduation years, pronouns and personal-status lines before
              scoring.
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={hideLocation} onChange={(e) => setHideLocation(e.target.checked)} disabled={!blind} />
            <span>Also hide city and state (logistics will show as not assessed).</span>
          </label>
        </fieldset>

        <div className="qm-actions">
          <button type="submit" className="btn btn-lg" disabled={!ready || phase.kind === "running"}>
            {phase.kind === "running" ? "Scoring…" : "Score the fit"}
          </button>
          {!jd && (
            <button type="button" className="btn btn-ghost" onClick={() => void loadSampleJd().then(setJd)}>
              Use a sample job description
            </button>
          )}
          <span className="sr-status" role="status">
            {phase.kind === "running" ? phase.step : ""}
          </span>
        </div>
        {phase.kind === "error" && (
          <p className="error" role="alert">
            {phase.message}
          </p>
        )}
      </form>
    </div>
  );
}
