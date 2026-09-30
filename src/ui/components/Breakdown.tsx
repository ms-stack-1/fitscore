import { splitItems } from "../../core/score";
import type { Category, CvLine, ScoreCard, ScoredItem } from "../../core/types";
import { CATEGORY_HINT, CATEGORY_LABEL, MATCH_LABEL, fmtPts } from "../labels";

interface Props {
  card: ScoreCard;
  lines: CvLine[];
  onCite: (lineId: string) => void;
}

function Item({ item, mode, lines, onCite }: { item: ScoredItem; mode: "gain" | "loss" | "none"; lines: Map<string, CvLine>; onCite: (id: string) => void }) {
  const { criterion: c, judgment: j } = item;
  const m = MATCH_LABEL[j.match];
  const pts =
    mode === "gain" ? `+${fmtPts(item.earned)}` : mode === "loss" ? `−${fmtPts(item.possible - item.earned)}` : "0";
  return (
    <li className={`bd-item m-${j.match}`}>
      <div className="bd-head">
        <span className="bd-status">
          <span aria-hidden="true">{m.glyph}</span> {m.word}
        </span>
        <span className="bd-crit">{c.text}</span>
        <span className="bd-pts" aria-label={`${pts} of ${fmtPts(item.criterion.weight)} points`}>
          {pts}
          <span className="bd-of"> / {fmtPts(c.weight)}</span>
        </span>
      </div>
      <div className="bd-tags">
        <span className={`chip chip-${c.priority}`}>{c.priority === "must" ? "Must" : "Nice to have"}</span>
        {c.knockout && <span className="chip chip-ko">Knockout</span>}
      </div>
      {j.note && <p className="bd-note">{j.note}</p>}
      {j.evidence.length > 0 && (
        <ul className="bd-evidence" aria-label="Evidence from the CV">
          {j.evidence.map((e) => (
            <li key={e.lineId + e.quote}>
              <button type="button" className="cite" onClick={() => onCite(e.lineId)} title={lines.get(e.lineId)?.text}>
                {e.lineId}
              </button>
              <q>{e.quote}</q>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Breakdown({ card, lines, onCite }: Props) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const cats = (["technical", "experience", "logistics", "custom"] as Category[]).filter((c) => card.categories[c].items.length);
  return (
    <section className="breakdown" aria-labelledby="bd-title">
      <h2 id="bd-title">Where the points came from</h2>
      {cats.map((cat) => {
        const cs = card.categories[cat];
        const { gained, lost, unassessed } = splitItems(cs);
        return (
          <section key={cat} id={`cat-${cat}`} className="bd-cat panel" aria-labelledby={`cat-${cat}-h`}>
            <header className="bd-cat-head">
              <h3 id={`cat-${cat}-h`}>{CATEGORY_LABEL[cat]}</h3>
              <p className="bd-cat-score">{cs.score === null ? "Not assessed" : `${Math.round(cs.score)} / 100`}</p>
              <p className="bd-cat-hint">{CATEGORY_HINT[cat]}</p>
            </header>
            <div className="bd-cols">
              <div>
                <h4 className="bd-h-gain">Where points added up</h4>
                {gained.length ? (
                  <ul className="bd-list">
                    {gained.map((i) => (
                      <Item key={i.criterion.id} item={i} mode="gain" lines={byId} onCite={onCite} />
                    ))}
                  </ul>
                ) : (
                  <p className="bd-empty">No points earned here.</p>
                )}
              </div>
              <div>
                <h4 className="bd-h-loss">Where they didn&rsquo;t</h4>
                {lost.length ? (
                  <ul className="bd-list">
                    {lost.map((i) => (
                      <Item key={i.criterion.id} item={i} mode="loss" lines={byId} onCite={onCite} />
                    ))}
                  </ul>
                ) : (
                  <p className="bd-empty">Nothing lost here.</p>
                )}
              </div>
            </div>
            {unassessed.length > 0 && (
              <details className="bd-unassessed">
                <summary>
                  Not assessed ({unassessed.length}): excluded from the score
                </summary>
                <ul className="bd-list">
                  {unassessed.map((i) => (
                    <Item key={i.criterion.id} item={i} mode="none" lines={byId} onCite={onCite} />
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
    </section>
  );
}
