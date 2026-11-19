// Welcome entrance: the logo's white cards morph through what the hub does (board, schedule, reports, team) and
// back into the logo, over the person's picture and "Welcome back, <name>". It stays until the first sync is done.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AvatarStyle } from '../model/types';

// ---------------------------------------------------------------- boot signal (set from anywhere)
type Boot = { name?: string; avatar?: AvatarStyle; initials?: string; color?: string; ready: boolean };
let boot: Boot = { ready: false };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const splash = {
  user(name: string, initials: string, color: string, avatar?: AvatarStyle) {
    if (boot.name === name && boot.avatar === avatar && boot.color === color) return;
    boot = { ...boot, name, initials, color, avatar: avatar ?? boot.avatar };
    try {
      localStorage.setItem('cwh.splashUser', JSON.stringify({ name, initials, color, avatar: avatar ?? boot.avatar }));
    } catch { /* ignore */ }
    emit();
  },
  ready() {
    if (boot.ready) return;
    boot = { ...boot, ready: true };
    emit();
  },
};
try {
  const saved = JSON.parse(localStorage.getItem('cwh.splashUser') ?? 'null');
  if (saved?.name) boot = { ...boot, ...saved };
} catch { /* ignore */ }
const useBoot = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => boot);

// ---------------------------------------------------------------- the morph
// Ten pieces in the logo's 100x100 space; each stage places them (w=0 hides one).
type R = [number, number, number, number, number]; // x, y, w, h, rx
const H: R = [50, 50, 0, 0, 0];
const card = (x: number, y: number): R => [x, y, 14, 14, 4];
const STAGES: { label: string; pieces: R[]; check: boolean }[] = [
  { label: '', check: true, pieces: [card(18, 22), card(18, 42), card(18, 62), card(38, 22), card(38, 42), H, H, H, H, H] },
  { label: 'Your board', check: false, pieces: [[14, 20, 20, 13, 3], [14, 37, 20, 13, 3], [14, 54, 20, 13, 3], [40, 20, 20, 13, 3], [40, 37, 20, 13, 3], [66, 20, 20, 13, 3], H, H, H, H] },
  { label: 'Rotation & time off', check: false, pieces: [[14, 16, 72, 12, 3], [14, 34, 20, 14, 3], [40, 34, 20, 14, 3], [66, 34, 20, 14, 3], [14, 52, 20, 14, 3], [40, 52, 20, 14, 3], [66, 52, 20, 14, 3], [14, 70, 20, 14, 3], [40, 70, 20, 14, 3], [66, 70, 20, 14, 3]] },
  { label: 'Reports', check: false, pieces: [[16, 58, 10, 22, 2], [30, 40, 10, 40, 2], [44, 50, 10, 30, 2], [58, 28, 10, 52, 2], [72, 44, 10, 36, 2], [14, 82, 72, 3, 1.5], H, H, H, H] },
  { label: 'Your team', check: false, pieces: [[17, 26, 18, 18, 9], [41, 20, 18, 18, 9], [65, 26, 18, 18, 9], [13, 48, 26, 18, 9], [37, 42, 26, 18, 9], [61, 48, 26, 18, 9], H, H, H, H] },
  { label: '', check: true, pieces: [card(18, 22), card(18, 42), card(18, 62), card(38, 22), card(38, 42), H, H, H, H, H] },
];

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Automated browsers (tests) skip it unless the address asks for it with ?splash. */
export const splashEnabled = () => !navigator.webdriver || new URLSearchParams(location.search).has('splash');

export function Splash() {
  const b = useBoot();
  const first = (() => { try { return !localStorage.getItem('cwh.seenSplash'); } catch { return false; } })();
  const [step, setStep] = useState(0);
  const [seqDone, setSeqDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const still = reduced();

  // Walk the stages; loop the middle ones while data is still loading.
  useEffect(() => {
    if (still) { setSeqDone(true); return; }
    const per = first ? 560 : 420;
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i >= STAGES.length - 1) {
        if (boot.ready) { setStep(STAGES.length - 1); setSeqDone(true); clearInterval(t); return; }
        i = 1; // still loading: go round again
      }
      setStep(i);
    }, per);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { setSeqDone(true); setStep(STAGES.length - 1); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && skip();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Leave once the sequence has landed back on the logo and the data is in.
  useEffect(() => {
    if (!(seqDone && b.ready) || leaving) return;
    const t = setTimeout(() => setLeaving(true), still ? 150 : 650);
    return () => clearTimeout(t);
  }, [seqDone, b.ready, leaving, still]);
  useEffect(() => {
    if (!leaving) return;
    try { localStorage.setItem('cwh.seenSplash', '1'); } catch { /* ignore */ }
    const t = setTimeout(() => setGone(true), 420);
    return () => clearTimeout(t);
  }, [leaving]);

  if (gone) return null;
  const s = STAGES[step];
  const firstName = b.name?.split(' ')[0];
  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} role="status" aria-live="polite" aria-label={firstName ? `Welcome ${first ? '' : 'back '}${firstName}. Getting things ready.` : 'Loading Core Work Hub'} onClick={skip}>
      <div className="splash-inner">
        <svg className="splash-logo" viewBox="0 0 100 100" aria-hidden>
          <rect width="100" height="100" rx="22" fill="var(--logo-tile)" />
          {s.pieces.map(([x, y, w, h, rx], i) => (
            <rect key={i} className="piece" style={{ x, y, width: w, height: h, rx, opacity: w ? 1 : 0 }} fill="var(--logo-card)" />
          ))}
          <g className={`check ${s.check ? 'on' : ''}`}>
            <circle cx="71" cy="29" r="11" fill="var(--logo-accent)" />
            <path d="M65.5 29.5l4 4 7-8" fill="none" stroke="var(--logo-tick)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
        <div className="splash-caption" key={step}>{s.label || 'Core Work Hub'}</div>
        <div className="splash-user">
          {b.name && (
            b.avatar?.photo ? (
              <img className="avatar lg photo" src={b.avatar.photo} alt="" />
            ) : (
              <span className={`avatar lg ${b.avatar?.emoji ? 'emoji' : ''}`} style={{ background: b.avatar?.color ?? b.color }} aria-hidden>{b.avatar?.emoji ?? b.initials}</span>
            )
          )}
          <div>
            <div className="splash-hello">{firstName ? (first ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`) : 'Welcome'}</div>
            <div className="splash-sub">{b.ready && seqDone ? 'All set.' : 'Getting things ready for you…'}</div>
          </div>
        </div>
        <div className={`splash-bar ${b.ready && seqDone ? 'done' : ''}`} aria-hidden><span /></div>
      </div>
    </div>
  );
}
