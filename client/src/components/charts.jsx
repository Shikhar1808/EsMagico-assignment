// Small, dependency-free charts built to the dataviz mark specs:
// bars <= 24px with 4px rounded data-ends and a square baseline, solid hairline grid,
// selective direct labels, a hover/focus tooltip on every mark, and a table view twin.
import { useState } from 'react';

/**
 * Round an axis maximum up to 1 / 2 / 2.5 / 5 x 10^n and return evenly spaced ticks.
 * `integer` keeps every tick a whole number (for counts: there is no quarter of a student).
 */
export function niceTicks(max, { count = 4, integer = false } = {}) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const steps = (integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]).map((m) => m * pow);
  let step = steps.find((s) => s >= raw);
  if (integer) step = Math.max(1, step);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

/** A titled panel that can swap its chart for an accessible table. */
export function ChartPanel({ title, subtitle, table, children, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`panel flex flex-col ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
        <button type="button" className="btn btn-quiet text-sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      <div className="flex-1 p-5">
        {showTable ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>{table.columns.map((c, i) => <th key={c} className={i ? 'num' : ''}>{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j ? 'num' : ''}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : children}
      </div>
    </section>
  );
}

/**
 * Vertical columns, one series.
 * data: [{ key, label, title, value, tip, capLabel? }]; capLabel is shown on the column (use sparingly).
 */
export function ColumnChart({ data, max, integer = false, format = (v) => v, height = 180, ariaLabel }) {
  const [active, setActive] = useState(null);
  const ticks = niceTicks(max ?? Math.max(...data.map((d) => d.value), 0), { integer });
  const top = ticks[ticks.length - 1];

  return (
    <figure className="m-0 pt-3" aria-label={ariaLabel}>
      <div className="flex">
        {/* y axis */}
        <div className="relative mr-2 w-9 shrink-0 text-right text-xs tabular-nums text-ink-3" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>{format(t)}</span>
          ))}
        </div>
        {/* plot */}
        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-ink-3/50' : 'bg-rule'}`} style={{ bottom: `${(t / top) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex">
            {data.map((d) => (
              <button
                key={d.key}
                type="button"
                className="group relative flex h-full flex-1 cursor-default items-end justify-center focus-visible:outline-offset-0"
                onMouseEnter={() => setActive(d.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.key)}
                onBlur={() => setActive(null)}
                aria-label={`${d.title ?? d.label}: ${d.tip}`}
              >
                <span
                  className={`relative block w-[min(24px,60%)] rounded-t bg-brand transition-opacity ${active && active !== d.key ? 'opacity-40' : ''}`}
                  style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                >
                  {d.capLabel != null && (
                    <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-ink">{d.capLabel}</span>
                  )}
                  {active === d.key && <Tooltip title={d.title ?? d.label} body={d.tip} />}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* x axis */}
      <div className="ml-11 flex text-xs text-ink-3" aria-hidden>
        {data.map((d) => <span key={d.key} className="flex-1 pt-2 text-center">{d.label}</span>)}
      </div>
    </figure>
  );
}

/**
 * Horizontal bars, one series, value at the tip.
 * data: [{ key, label, value, valueLabel, note? }]; `reference` draws a hairline marker (e.g. the pass mark).
 */
export function BarList({ data, max, reference, referenceLabel, tone = () => 'bg-brand' }) {
  return (
    <ul className="m-0 list-none space-y-3.5 p-0">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[minmax(7rem,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(8rem,11rem)_1fr]">
          <span className="text-sm text-ink-2">
            {d.label}
            {d.note && <span className="block text-xs text-ink-3">{d.note}</span>}
          </span>
          <span className="flex items-center gap-2.5">
            <span className="relative h-2.5 flex-1 rounded-full bg-paper" title={d.title}>
              <span className={`absolute inset-y-0 left-0 rounded-full ${tone(d)}`} style={{ width: `${(d.value / max) * 100}%` }} />
              {reference != null && (
                <span className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${(reference / max) * 100}%` }} title={referenceLabel} aria-hidden />
              )}
            </span>
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{d.valueLabel}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ title, body }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-48 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-left text-xs text-white shadow-lg">
      <span className="block font-semibold">{title}</span>
      <span className="block text-white/80">{body}</span>
    </span>
  );
}
