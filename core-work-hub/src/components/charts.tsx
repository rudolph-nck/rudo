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

export function GroupedColumns({ data, series, height = 220, label, onBar, selected }: { data: { label: string; tip: string; values: Record<string, number> }[]; series: Series[]; height?: number; label: string; onBar?: (index: number) => void; selected?: number }) {
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
                fill={selected === i ? 'var(--accent-soft)' : 'transparent'}
                tabIndex={0}
                style={onBar ? { cursor: 'pointer' } : undefined}
                onClick={onBar ? () => onBar(i) : undefined}
                onKeyDown={onBar ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBar(i); } } : undefined}
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

// ---------------------------------------------------------------- lines (time series, optional dashed forecast + band)

export interface LineSeries extends Series {
  values: (number | null)[];
  dashed?: boolean;
}

/** One y-axis. Actuals as solid 2px lines, a forecast dashed with an 80% band; crosshair tooltip per point. */
export function LineChart({ labels, tips, series, band, nowIndex, height = 240, width = 640, label, unit = '' }: { labels: string[]; tips: string[]; series: LineSeries[]; band?: { low: number; high: number }[] | (null | { low: number; high: number })[]; nowIndex?: number; height?: number; width?: number; label: string; unit?: string }) {
  const { box, show, hide, el } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const W = width, padL = 34, padR = 8, padB = 26, padT = 10;
  const n = labels.length;
  const all = [...series.flatMap((s) => s.values.filter((v): v is number => v !== null)), ...(band ?? []).flatMap((b) => (b ? [b.high] : []))];
  const max = niceMax(Math.max(1, ...all));
  const H = height - padB - padT;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + H - (v / max) * H;
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const bandPath = () => {
    if (!band) return '';
    const idx = band.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return '';
    const top = idx.map((i) => `${x(i)},${y(band[i]!.high)}`).join('L');
    const bot = [...idx].reverse().map((i) => `${x(i)},${y(band[i]!.low)}`).join('L');
    return `M${top}L${bot}Z`;
  };
  const every = Math.ceil(n / 8);
  const ticks = [0, max / 2, max];
  const tipFor = (i: number) => (
    <TipRows
      title={tips[i]}
      rows={[
        ...series.filter((s) => s.values[i] !== null && s.values[i] !== undefined).map((s) => ({ label: s.label, value: `${Math.round((s.values[i] as number) * 10) / 10}${unit}`, color: s.color })),
        ...(band?.[i] ? [{ label: 'Likely range (80%)', value: `${Math.round(band[i]!.low)}–${Math.round(band[i]!.high)}${unit}` }] : []),
      ]}
    />
  );
  const step = n > 1 ? (W - padL - padR) / (n - 1) : W;
  return (
    <div className="viz-wrap" ref={box} onMouseLeave={() => { hide(); setHover(null); }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="viz-grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="viz-axis">{Math.round(t)}</text>
          </g>
        ))}
        {nowIndex !== undefined && nowIndex >= 0 && nowIndex < n && (
          <g>
            <line x1={x(nowIndex)} x2={x(nowIndex)} y1={padT} y2={padT + H} className="viz-now" />
            <text x={x(nowIndex) + 4} y={padT + 10} className="viz-axis">Now</text>
          </g>
        )}
        {band && <path d={bandPath()} className="viz-band" />}
        {series.map((s) => (
          <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + H} className="viz-cross" />
            {series.map((s) => (s.values[hover] !== null && s.values[hover] !== undefined ? <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] as number)} r={4.5} fill={s.color} className="viz-dot" /> : null))}
          </g>
        )}
        {labels.map((l, i) => (
          <g key={i}>
            {i % every === 0 && <text x={x(i)} y={height - 8} textAnchor="middle" className="viz-axis">{l}</text>}
            <rect
              x={x(i) - step / 2}
              y={padT}
              width={step}
              height={H}
              fill="transparent"
              tabIndex={0}
              aria-label={`${tips[i]}: ${series.filter((s) => s.values[i] !== null).map((s) => `${s.label} ${Math.round((s.values[i] as number) * 10) / 10}`).join(', ')}`}
              onMouseMove={(e) => { setHover(i); show(e, tipFor(i)); }}
              onFocus={(e) => { setHover(i); show(e, tipFor(i)); }}
              onBlur={() => { hide(); setHover(null); }}
            />
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={padT + H} y2={padT + H} className="viz-baseline" />
      </svg>
      {el}
    </div>
  );
}

// ---------------------------------------------------------------- heatmap (rows x columns, one hue light -> dark)

export function Heatmap({ rows, cols, values, label, fmt = (v) => String(v), cellTip }: { rows: string[]; cols: string[]; values: number[][]; label: string; fmt?: (v: number) => string; cellTip?: (r: number, c: number) => string }) {
  const { box, show, hide, el } = useTip();
  const max = Math.max(1e-9, ...values.flat());
  const steps = 5;
  const level = (v: number) => (v <= 0 ? 0 : Math.min(steps, Math.ceil((v / max) * steps)));
  return (
    <div className="viz-wrap heat" ref={box} onMouseLeave={hide}>
      <div className="heat-grid" role="table" aria-label={label} style={{ gridTemplateColumns: `44px repeat(${cols.length}, minmax(14px, 1fr))` }}>
        <span role="columnheader" />
        {cols.map((c, j) => <span key={j} role="columnheader" className="heat-col">{j % 2 === 0 ? c : ''}</span>)}
        {rows.map((r, i) => (
          <div key={r} role="row" className="heat-row" style={{ display: 'contents' }}>
            <span role="rowheader" className="heat-rowh">{r}</span>
            {cols.map((c, j) => {
              const v = values[i][j];
              const tip = cellTip ? cellTip(i, j) : `${r} ${c}`;
              return (
                <span
                  key={j}
                  role="cell"
                  tabIndex={0}
                  className={`heat-cell l${level(v)}`}
                  aria-label={`${tip}: ${fmt(v)}`}
                  onMouseMove={(e) => show(e, <TipRows title={tip} rows={[{ label: 'Average', value: fmt(v) }]} />)}
                  onFocus={(e) => show(e, <TipRows title={tip} rows={[{ label: 'Average', value: fmt(v) }]} />)}
                  onBlur={hide}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heat-legend small muted" aria-hidden>
        Fewer <span className="heat-cell l1" /><span className="heat-cell l2" /><span className="heat-cell l3" /><span className="heat-cell l4" /><span className="heat-cell l5" /> More
      </div>
      {el}
    </div>
  );
}
