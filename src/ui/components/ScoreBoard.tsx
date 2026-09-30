import { bandLabel } from "../../core/score";
import type { Category, ScoreCard } from "../../core/types";
import { CATEGORY_LABEL, MATCH_LABEL, fmtPts } from "../labels";
import { Gauge } from "./Gauge";

const SHOWN: Category[] = ["technical", "experience", "logistics"];

export function ScoreBoard({ card }: { card: ScoreCard }) {
  const cats = card.categories.custom.items.length ? [...SHOWN, "custom" as const] : SHOWN;
  return (
    <section className="scoreboard" aria-labelledby="sb-title">
      <h2 id="sb-title" className="visually-hidden">
        Scores
      </h2>
      <div className="sb-hero panel">
        <Gauge value={card.overall} label="Overall fit" size="lg" caption={bandLabel(card.band)} />
        <div className="sb-hero-meta">
          <p className="eyebrow">Overall fit</p>
          <p className="sb-weights">
            Weighted{" "}
            {cats
              .filter((c) => card.appliedWeights[c] > 0)
              .map((c) => `${CATEGORY_LABEL[c]} ${fmtPts(card.appliedWeights[c])}%`)
              .join(" · ")}
          </p>
          {card.flags.length > 0 && (
            <ul className="sb-flags" aria-label="Needs review">
              {card.flags.map((f) => (
                <li key={f.criterionId + f.kind}>
                  <span aria-hidden="true">{"⚠"}</span> {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="sb-cats">
        {cats.map((cat) => {
          const cs = card.categories[cat];
          const assessed = cs.score !== null;
          return (
            <a key={cat} href={`#cat-${cat}`} className="sb-cat panel">
              <Gauge value={cs.score} label={CATEGORY_LABEL[cat]} size="sm" caption={assessed ? undefined : "Not assessed"} />
              <div className="sb-cat-body">
                <h3>{CATEGORY_LABEL[cat]}</h3>
                <p className="sb-pts">{assessed ? `${fmtPts(cs.earned)} of ${fmtPts(cs.possible)} points` : "Nothing the CV confirms or rules out"}</p>
                <p className="sb-counts">
                  {(["full", "partial", "none", "unknown"] as const)
                    .filter((m) => cs.counts[m] > 0)
                    .map((m) => (
                      <span key={m} className={`m-${m}`}>
                        <span aria-hidden="true">{MATCH_LABEL[m].glyph}</span> {cs.counts[m]} {MATCH_LABEL[m].word.toLowerCase()}
                      </span>
                    ))}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
