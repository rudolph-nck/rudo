// Appearance: light/dark mode and colour themes, saved to the person (follows them to any PC).
import { useEffect, useState } from 'react';
import { useHub } from '../store/hub';
import { findPerson } from '../model/logic';
import { PALETTES, resolveTheme, swatch, themeCss, type Appearance, type Mode, type Tint } from '../model/appearance';
import { Icon, Modal, toast } from './ui';

// ---- applying to the page
export const getMode = (): Mode => {
  try { return (localStorage.getItem('cwh.theme') as Mode) || 'auto'; } catch { return 'auto'; }
};
export function applyMode(t: Mode) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('cwh.theme', t); } catch { /* ignore */ }
}
export function applyPalette(a?: Appearance) {
  let el = document.getElementById('cwh-palette') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'cwh-palette';
    document.head.appendChild(el);
  }
  el.textContent = themeCss(a);
  document.documentElement.dataset.palette = a?.palette ?? 'indigo';
}
/** Paint the last person's theme straight away, before their profile has loaded. */
export function bootAppearance() {
  applyMode(getMode());
  try {
    const c = localStorage.getItem('cwh.appearance');
    if (c) applyPalette(JSON.parse(c));
  } catch { /* ignore */ }
}

/** Keeps the page in the signed-in person's colours (or, while previewing, the person being viewed). */
export function useAppearanceSync() {
  const { state, me, viewAs } = useHub();
  const ap = findPerson(state.config, me)?.appearance;
  const key = JSON.stringify(ap ?? {});
  useEffect(() => {
    applyPalette(ap);
    if (viewAs) return;
    if (ap?.mode) applyMode(ap.mode);
    try { localStorage.setItem('cwh.appearance', JSON.stringify(ap ?? {})); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viewAs]);
}

/** Save a change to my appearance (only locally while previewing someone else). */
export function useSaveAppearance() {
  const { state, me, viewAs, commit, readOnly } = useHub();
  const current = findPerson(state.config, me)?.appearance ?? {};
  return async (patch: Appearance) => {
    const next = { ...current, ...patch };
    if (patch.mode) applyMode(patch.mode);
    if (viewAs || readOnly) { applyPalette(next); return true; }
    return commit([{ type: 'profile.set', data: { appearance: next } }]);
  };
}

const MODES: [Mode, string, string][] = [['auto', 'auto', 'System'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']];

export function ModeToggle() {
  const [t, setT] = useState<Mode>(getMode);
  const save = useSaveAppearance();
  return (
    <div className="seg theme-seg" role="radiogroup" aria-label="Color theme">
      {MODES.map(([v, icon, label]) => (
        <button key={v} role="radio" aria-checked={t === v} onClick={() => { setT(v); void save({ mode: v }); }} title={label} aria-label={label}>
          <Icon name={icon} size={16} />
        </button>
      ))}
    </div>
  );
}

function Preview({ a, dark }: { a: Appearance; dark?: boolean }) {
  const s = swatch(a, dark);
  return (
    <span className="ap-prev" style={{ background: s.bg, borderColor: s.border }} aria-hidden>
      <span className="ap-side" style={{ background: s.surface, borderColor: s.border }}>
        <i style={{ background: s.soft }} /><i /><i />
      </span>
      <span className="ap-body">
        <span className="ap-card" style={{ background: s.surface, borderColor: s.border }}>
          <b style={{ background: s.accent }} />
          <i style={{ background: s.s2 }} />
        </span>
        <span className="ap-btn" style={{ background: s.accent }} />
      </span>
    </span>
  );
}

/** Small swatches for the profile menu: one click applies and saves. */
export function QuickThemes() {
  const { state, me } = useHub();
  const save = useSaveAppearance();
  const cur = findPerson(state.config, me)?.appearance?.palette ?? 'indigo';
  return (
    <div className="ap-quick" role="radiogroup" aria-label="Colour theme">
      {PALETTES.map((p) => (
        <button key={p.id} role="radio" aria-checked={cur === p.id} title={p.name} aria-label={p.name} onClick={() => void save({ palette: p.id })}>
          <span style={{ background: swatch({ palette: p.id }).accent }} />
        </button>
      ))}
    </div>
  );
}

export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, viewAs } = useHub();
  const saved = findPerson(state.config, me)?.appearance ?? {};
  const save = useSaveAppearance();
  const [draft, setDraft] = useState<Appearance>(saved);
  const [mode, setMode] = useState<Mode>(getMode);
  useEffect(() => {
    if (open) { setDraft(findPerson(state.config, me)?.appearance ?? {}); setMode(getMode()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Live preview while the dialog is open.
  useEffect(() => { if (open) applyPalette(draft); }, [open, draft]);
  const cancel = () => { applyPalette(saved); applyMode(saved.mode ?? mode); onClose(); };
  const custom = draft.palette === 'custom';
  const t = resolveTheme(draft);
  const group = (g: 'Colourful' | 'Neutral') => (
    <div className="ap-group">
      <div className="section-title">{g}</div>
      <div className="ap-grid" role="radiogroup" aria-label={`${g} themes`}>
        {PALETTES.filter((p) => p.group === g).map((p) => (
          <button key={p.id} role="radio" aria-checked={(draft.palette ?? 'indigo') === p.id} className="ap-opt" onClick={() => setDraft({ palette: p.id })}>
            <Preview a={{ palette: p.id }} />
            <span className="ap-name">{p.name}{p.id === 'indigo' && <span className="muted small"> · default</span>}</span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Modal
      open={open}
      onClose={cancel}
      title="Appearance"
      footer={
        <>
          <button className="btn ghost" onClick={() => setDraft({})} style={{ marginRight: 'auto' }}>Reset to default</button>
          <button className="btn" onClick={cancel}>Cancel</button>
          <button className="btn primary" onClick={async () => { if (await save({ ...draft, mode })) { toast(viewAs ? 'Theme applied for this preview only.' : 'Theme saved. It follows you to any PC.'); onClose(); } }}>Save</button>
        </>
      }
    >
      <div className="ap">
        <div className="ap-mode">
          <span className="field-label">Mode</span>
          <div className="seg" role="radiogroup" aria-label="Mode">
            {MODES.map(([v, icon, label]) => (
              <button key={v} role="radio" aria-checked={mode === v} onClick={() => { setMode(v); applyMode(v); }}><Icon name={icon} size={16} />{label}</button>
            ))}
          </div>
        </div>
        {group('Colourful')}
        {group('Neutral')}
        <div className="ap-group">
          <div className="section-title">Custom</div>
          <div className={`ap-custom ${custom ? 'on' : ''}`}>
            <button role="radio" aria-checked={custom} className="ap-opt" onClick={() => setDraft({ palette: 'custom', accent: draft.accent ?? t.accent, tint: draft.tint ?? t.tint, muted: draft.muted ?? t.muted })}>
              <Preview a={custom ? draft : { palette: 'custom', accent: t.accent, tint: t.tint }} />
              <span className="ap-name">Custom</span>
            </button>
            <div className="ap-custom-fields">
              <label className="field">
                <span>Accent colour</span>
                <span className="row" style={{ gap: 8 }}>
                  <input type="color" className="ap-color" value={custom ? draft.accent : t.accent} onChange={(e) => setDraft({ ...draft, palette: 'custom', accent: e.target.value, tint: draft.tint ?? t.tint })} aria-label="Accent colour" />
                  <code className="small">{(custom ? draft.accent : t.accent)?.toUpperCase()}</code>
                </span>
              </label>
              <div className="field">
                <span>Background</span>
                <div className="seg" role="radiogroup" aria-label="Background">
                  {(['cool', 'neutral', 'warm'] as Tint[]).map((x) => (
                    <button key={x} role="radio" aria-checked={(custom ? draft.tint : t.tint) === x} onClick={() => setDraft({ ...draft, palette: 'custom', accent: draft.accent ?? t.accent, tint: x })}>{x[0].toUpperCase() + x.slice(1)}</button>
                  ))}
                </div>
              </div>
              <label className="row small" style={{ gap: 8 }}>
                <input type="checkbox" checked={custom ? !!draft.muted : t.muted} onChange={(e) => setDraft({ ...draft, palette: 'custom', accent: draft.accent ?? t.accent, tint: draft.tint ?? t.tint, muted: e.target.checked })} />
                Quieter bucket colours
              </label>
            </div>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Priority and warning colours stay the same in every theme, so a P1 or a late update always stands out. {viewAs ? 'You are previewing someone else: this changes your screen only.' : 'Saved to your profile, so it follows you to any PC.'}</p>
      </div>
    </Modal>
  );
}
