import { useRef, useState, type ReactNode } from 'react';

/*
 * Small SVG chart kit for the Overview. Mark specs: bars <= 24px thick with a 4px rounded data end and a square
 * baseline; 2px surface gaps between stacked segments; 1px solid recessive gridlines; text in text tokens, never
 * series colors; every chart has a hover tooltip, a legend for 2+ series, and a table view.
 */

export interface Series {
  key: string;
  label: string;
  /** CSS color (use tokens: var(--b-project) ...). */
  color: string;
}

export const BUCKET_SERIES: Series[] = [
  { key: 'Project', label: 'Projects', color: 'var(--b-project)' },
  { key: 'Maintenance', label: 'Maintenance', color: 'var(--b-maintenance)' },
  { key: 'Support', label: 'Support', color: 'var(--b-support)' },
  { key: 'Not graded', label: 'Not graded', color: 'var(--chart-gray)' },
];

// ---------------------------------------------------------------- tooltip

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const show = (e: React.MouseEvent | React.FocusEvent, content: ReactNode) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const t = e.currentTarget.getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX - r.left : t.left + t.width / 2 - r.left;
    const y = 'clientY' in e ? e.clientY - r.top : t.top - r.top;
    setTip({ x, y, content });
  };
  const el = tip ? (
    <div className="viz-tip" role="tooltip" style={{ left: Math.min(tip.x + 12, (box.current?.clientWidth ?? 400) - 200), top: tip.y + 14 }}>
      {tip.content}
    </div>
  ) : null;
  return { box, show, hide: () => setTip(null), el };
}

export function TipRows({ title, rows }: { title: string; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <>
      <div className="viz-tip-title">{title}</div>
      {rows.map((r) => (
        <div className="viz-tip-row" key={r.label}>
          {r.color && <i style={{ background: r.color }} />}
          <span>{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- card with legend + table view

export function ChartCard({
  title,
  sub,
  legend,
  table,
  children,
  wide,
  action,
}: {
  title: string;
  sub?: ReactNode;
  legend?: Series[];
  table?: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
  wide?: boolean;
  action?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`panel viz-card ${wide ? 'wide' : ''}`} aria-label={title}>
      <div className="viz-head">
        <div className="grow">
          <h2>{title}</h2>
          {sub && <div className="small muted">{sub}</div>}
        </div>
        {action}
        {table && (
          <button className="btn sm ghost" aria-pressed={showTable} onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {legend && legend.length > 1 && !showTable && (
        <div className="legend viz-legend" aria-hidden>
          {legend.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="viz-body">
        {showTable && table ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>{table.head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((r, n) => (
                  <tr key={n}>{r.map((c, i) => <td key={i} className={i ? 'num' : ''}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- geometry helpers

/** Vertical bar with a rounded top (data end) and square baseline. */
function vbar(x: number, y: number, w: number, h: number, round: boolean) {
  if (h <= 0) return '';
  const r = round ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
/** Horizontal bar with a rounded right end. */
function hbar(x: number, y: number, w: number, h: number, round: boolean) {
  if (w <= 0) return '';
  const r = round ? Math.min(4, w, h / 2) : 0;
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

// ---------------------------------------------------------------- grouped columns (e.g. opened vs closed per week)

export function GroupedColumns({ data, series, height = 220, label }: { data: { label: string; tip: string; values: Record<string, number> }[]; series: Series[]; height?: number; label: string }) {
  const { box, show, hide, el } = useTip();
  const W = 640, padL = 32, padB = 26, padT = 8;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))));
  const band = (W - padL) / data.length;
  const bw = Math.min(14, (band - 10) / series.length - 2);
  const H = height - padB - padT;
  const y = (v: number) => padT + H - (v / max) * H;
  const ticks = [0, max / 2, max];
  const every = Math.ceil(data.length / 8);
  return (
    <div className="viz-wrap" ref={box} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="viz-grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = padL + i * band + (band - (bw * series.length + 2 * (series.length - 1))) / 2;
          return (
            <g key={d.label}>
              {series.map((s, k) => {
                const v = d.values[s.key] ?? 0;
                return <path key={s.key} d={vbar(gx + k * (bw + 2), y(v), bw, padT + H - y(v), true)} fill={s.color} />;
              })}
              {i % every === 0 && (
                <text x={padL + i * band + band / 2} y={height - 8} textAnchor="middle" className="viz-axis">{d.label}</text>
              )}
              <rect
                x={padL + i * band}
                y={padT}
                width={band}
                height={H}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.tip}: ${series.map((s) => `${s.label} ${d.values[s.key] ?? 0}`).join(', ')}`}
                onMouseMove={(e) => show(e, <TipRows title={d.tip} rows={series.map((s) => ({ label: s.label, value: d.values[s.key] ?? 0, color: s.color }))} />)}
                onFocus={(e) => show(e, <TipRows title={d.tip} rows={series.map((s) => ({ label: s.label, value: d.values[s.key] ?? 0, color: s.color }))} />)}
                onBlur={hide}
              />
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={padT + H} y2={padT + H} className="viz-baseline" />
      </svg>
      {el}
    </div>
  );
}

// ---------------------------------------------------------------- stacked horizontal bars (one row per category)

export function StackedRows({ rows, series, label, onRow }: { rows: { label: string; total: number; parts: { key: string; value: number }[] }[]; series: Series[]; label: string; onRow?: (label: string) => void }) {
  const { box, show, hide, el } = useTip();
  const W = 640, padL = 118, padR = 40, rowH = 30, bh = 16;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const scale = (W - padL - padR) / max;
  const color = (k: string) => series.find((s) => s.key === k)?.color ?? 'var(--chart-gray)';
  return (
    <div className="viz-wrap" ref={box} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${rows.length * rowH + 6}`} width="100%" role="img" aria-label={label}>
        {rows.map((r, i) => {
          const y = 4 + i * rowH;
          let x = padL;
          const segs = r.parts.filter((p) => p.value > 0);
          const tip = <TipRows title={`${r.label}: ${r.total}`} rows={r.parts.filter((p) => p.value).map((p) => ({ label: series.find((s) => s.key === p.key)?.label ?? p.key, value: p.value, color: color(p.key) }))} />;
          return (
            <g key={r.label}>
              <text x={padL - 10} y={y + bh / 2 + 4} textAnchor="end" className="viz-label">{r.label}</text>
              {segs.map((p, k) => {
                const w = Math.max(0, p.value * scale - (k < segs.length - 1 ? 2 : 0));
                const d = hbar(x, y, w, bh, k === segs.length - 1);
                x += p.value * scale;
                return <path key={p.key} d={d} fill={color(p.key)} />;
              })}
              <text x={padL + r.total * scale + 8} y={y + bh / 2 + 4} className="viz-value">{r.total}</text>
              <rect
                x={0}
                y={y - 6}
                width={W}
                height={rowH}
                fill="transparent"
                tabIndex={0}
                style={{ cursor: onRow ? 'pointer' : undefined }}
                aria-label={`${r.label}: ${r.total}`}
                onClick={() => onRow?.(r.label)}
                onMouseMove={(e) => show(e, tip)}
                onFocus={(e) => show(e, tip)}
                onBlur={hide}
              />
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

// ---------------------------------------------------------------- stacked columns (e.g. age bands)

export function StackedColumns({ cols, series, height = 220, label, danger }: { cols: { label: string; total: number; parts: { key: string; value: number }[] }[]; series: Series[]; height?: number; label: string; danger?: string }) {
  const { box, show, hide, el } = useTip();
  const W = 640, padL = 32, padB = 26, padT = 18;
  const max = niceMax(Math.max(1, ...cols.map((c) => c.total)));
  const band = (W - padL) / cols.length;
  const bw = 24;
  const H = height - padB - padT;
  const y = (v: number) => padT + H - (v / max) * H;
  const color = (k: string) => series.find((s) => s.key === k)?.color ?? 'var(--chart-gray)';
  return (
    <div className="viz-wrap" ref={box} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="viz-grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{Math.round(t)}</text>
          </g>
        ))}
        {cols.map((c, i) => {
          const x = padL + i * band + (band - bw) / 2;
          let acc = 0;
          const segs = c.parts.filter((p) => p.value > 0);
          const tip = <TipRows title={`${c.label}: ${c.total}`} rows={c.parts.filter((p) => p.value).map((p) => ({ label: series.find((s) => s.key === p.key)?.label ?? p.key, value: p.value, color: color(p.key) }))} />;
          return (
            <g key={c.label}>
              {segs.map((p, k) => {
                const top = y(acc + p.value);
                const bottom = y(acc);
                acc += p.value;
                const h = Math.max(0, bottom - top - (k > 0 ? 2 : 0));
                return <path key={p.key} d={vbar(x, top, bw, h, k === segs.length - 1)} fill={color(p.key)} />;
              })}
              <text x={x + bw / 2} y={y(c.total) - 6} textAnchor="middle" className={`viz-value ${danger === c.label && c.total ? 'danger-text' : ''}`}>{c.total}</text>
              <text x={padL + i * band + band / 2} y={height - 8} textAnchor="middle" className="viz-axis">{c.label}</text>
              <rect x={padL + i * band} y={padT} width={band} height={H} fill="transparent" tabIndex={0} aria-label={`${c.label}: ${c.total}`} onMouseMove={(e) => show(e, tip)} onFocus={(e) => show(e, tip)} onBlur={hide} />
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={padT + H} y2={padT + H} className="viz-baseline" />
      </svg>
      {el}
    </div>
  );
}

// ---------------------------------------------------------------- single-series horizontal bars (ranked list)

export function RankedBars({ rows, label, color = 'var(--accent)', unit = '' }: { rows: { label: string; value: number }[]; label: string; color?: string; unit?: string }) {
  const { box, show, hide, el } = useTip();
  const W = 640, padL = 190, padR = 40, rowH = 28, bh = 14;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const scale = (W - padL - padR) / max;
  if (!rows.length) return <p className="muted small" style={{ margin: 0 }}>Nothing to show.</p>;
  return (
    <div className="viz-wrap" ref={box} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${rows.length * rowH + 4}`} width="100%" role="img" aria-label={label}>
        {rows.map((r, i) => {
          const y = 4 + i * rowH;
          const text = r.label.length > 28 ? r.label.slice(0, 27) + '…' : r.label;
          const tip = <TipRows title={r.label} rows={[{ label: 'Items', value: `${r.value}${unit}` }]} />;
          return (
            <g key={r.label}>
              <text x={padL - 10} y={y + bh / 2 + 4} textAnchor="end" className="viz-label">{text}</text>
              <path d={hbar(padL, y, r.value * scale, bh, true)} fill={color} />
              <text x={padL + r.value * scale + 8} y={y + bh / 2 + 4} className="viz-value">{r.value}</text>
              <rect x={0} y={y - 6} width={W} height={rowH} fill="transparent" tabIndex={0} aria-label={`${r.label}: ${r.value}`} onMouseMove={(e) => show(e, tip)} onFocus={(e) => show(e, tip)} onBlur={hide} />
            </g>
          );
        })}
      </svg>
      {el}
    </div>
  );
}

// ---------------------------------------------------------------- meter (Doing vs WIP limit)

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const state = value > max ? 'over' : value === max ? 'full' : '';
  return (
    <span className={`meter ${state}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </span>
  );
}
