import { Link, useParams, useSearchParams } from "react-router";
import { bandLabel } from "../../core/score";
import type { Category } from "../../core/types";
import { Gauge } from "../components/Gauge";
import { CATEGORY_LABEL, MATCH_LABEL, fmtPts } from "../labels";
import { useRoleData } from "../useRoleData";

/** Side by side: the same criteria, judged for two or three applicants. A table, so it reads without the colours. */
export function Compare() {
  const { roleId } = useParams();
  const [params] = useSearchParams();
  const { data } = useRoleData(roleId);
  if (!data) return <div className="page" aria-busy="true" />;

  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const cols = ids
    .map((id) => ({ c: data.candidates.find((x) => x.id === id), r: data.results.find((x) => x.candidateId === id) }))
    .filter((x): x is { c: NonNullable<typeof x.c>; r: NonNullable<typeof x.r> } => !!x.c && !!x.r);
  const name = (c: (typeof cols)[number]["c"]) => (c.revealed && c.detectedName ? c.detectedName : c.label);
  const cats: Category[] = ["technical", "experience", "logistics", "custom"];

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">
          <Link to={`/roles/${data.role.id}`}>{data.role.title}</Link> / Compare
        </p>
        <h1>Compare {cols.length} applicants</h1>
      </header>

      {cols.length < 2 ? (
        <p>
          Pick two or three applicants in the ranking to compare. <Link to={`/roles/${data.role.id}`}>Back to the ranking</Link>
        </p>
      ) : (
        <>
          <div className="cmp-gauges" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
            {cols.map(({ c, r }) => (
              <Link key={c.id} to={`/roles/${data.role.id}/c/${c.id}`} className="panel cmp-card">
                <Gauge value={r.scorecard.overall} size="sm" label={`${name(c)} overall`} caption={bandLabel(r.scorecard.band)} />
                <span className="cmp-name">{name(c)}</span>
              </Link>
            ))}
          </div>

          <div className="table-wrap">
            <table className="cmp-table">
              <caption className="visually-hidden">Criterion-by-criterion comparison</caption>
              <thead>
                <tr>
                  <th scope="col">Criterion</th>
                  {cols.map(({ c }) => (
                    <th key={c.id} scope="col">
                      {name(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              {cats
                .filter((cat) => data.role.criteria.some((x) => x.category === cat))
                .map((cat) => (
                  <tbody key={cat}>
                    <tr className="cmp-cat">
                      <th scope="rowgroup">{CATEGORY_LABEL[cat]}</th>
                      {cols.map(({ c, r }) => (
                        <td key={c.id}>
                          <b>{r.scorecard.categories[cat].score === null ? "n/a" : Math.round(r.scorecard.categories[cat].score!)}</b>
                        </td>
                      ))}
                    </tr>
                    {data.role.criteria
                      .filter((x) => x.category === cat)
                      .map((crit) => (
                        <tr key={crit.id}>
                          <th scope="row">
                            {crit.text} <span className="muted">({crit.weight} pts{crit.knockout ? ", knockout" : ""})</span>
                          </th>
                          {cols.map(({ c, r }) => {
                            const item = r.scorecard.categories[cat].items.find((i) => i.criterion.id === crit.id);
                            const m = item?.judgment.match ?? "unknown";
                            return (
                              <td key={c.id} className={`m-${m}`}>
                                <span className="bd-status">
                                  <span aria-hidden="true">{MATCH_LABEL[m].glyph}</span> {MATCH_LABEL[m].word}
                                </span>
                                {item && item.possible > 0 && <span className="cmp-pts"> {fmtPts(item.earned)}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                ))}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
