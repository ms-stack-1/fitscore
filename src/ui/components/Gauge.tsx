import { useEffect, useState } from "react";

/*
 * A 270° meter. The score is a magnitude, so the fill is always the accent
 * and the track is a lighter step of the same hue (never a status colour).
 * The number is HTML, not SVG text, so it uses the page font and scales.
 *
 * Geometry (viewBox 200): centre (100,100), r 84, from 135° to 45° clockwise.
 */

const ARC = "M 40.6 159.4 A 84 84 0 1 1 159.4 159.4";

interface Props {
  value: number | null;
  label: string;
  size: "lg" | "sm";
  /** Text under the number, e.g. the band ("Good fit") or "Not assessed". */
  caption?: string;
  valueText?: string;
}

export function Gauge({ value, label, size, caption, valueText }: Props) {
  // Start empty and fill on mount; the global reduced-motion rule removes the transition.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value ?? 0));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const assessed = value !== null;
  return (
    <div
      className={`gauge gauge-${size}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={assessed ? value : undefined}
      aria-valuetext={valueText ?? (assessed ? `${Math.round(value)} out of 100${caption ? `, ${caption}` : ""}` : "Not assessed")}
    >
      <svg viewBox="0 0 200 184" aria-hidden="true" focusable="false">
        <path d={ARC} className="gauge-track" pathLength={100} />
        {assessed && shown > 0 && <path d={ARC} className="gauge-fill" pathLength={100} strokeDasharray={`${shown} 100`} />}
      </svg>
      <div className="gauge-center" aria-hidden="true">
        <span className="gauge-value">{assessed ? Math.round(value) : "–"}</span>
        {caption && <span className="gauge-caption">{caption}</span>}
      </div>
    </div>
  );
}
