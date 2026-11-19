// Guided tour: spotlights the real element for each step, with a caption card (Back / Next / Done). Moves between
// pages as needed. Started from the Training page ("Show me"), or automatically for the lesson videos.
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useNav } from '../nav';
import type { Lesson } from './lessons';

let active: { lesson: Lesson; onDone?: () => void } | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const startTour = (lesson: Lesson, onDone?: () => void) => {
  active = { lesson, onDone };
  emit();
};
const stopTour = () => {
  active = null;
  emit();
};
const useActive = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => active);

/** CSS selector, or "text:<visible text>" matched against buttons, links, tabs, headings and labels. */
export function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  if (target.startsWith('text:')) {
    const want = target.slice(5).trim().toLowerCase();
    const els = [...document.querySelectorAll<HTMLElement>('main button, main a, main h1, main h2, main [role=radio], main label, .sidebar button, .sidebar a')];
    const vis = (e: HTMLElement) => e.getClientRects().length > 0;
    return els.find((e) => vis(e) && e.innerText.trim().toLowerCase() === want) ?? els.find((e) => vis(e) && e.innerText.trim().toLowerCase().startsWith(want)) ?? null;
  }
  const all = [...document.querySelectorAll<HTMLElement>(target)];
  return all.find((e) => e.getClientRects().length > 0) ?? null;
}

// Lets the video recorder start a lesson's tour (scripts/record-training.cjs).
(window as unknown as { cwhStartTour?: (id: string) => void }).cwhStartTour = (id: string) => {
  void import('./lessons').then(({ LESSONS }) => {
    const l = LESSONS.find((x) => x.id === id);
    if (l) startTour(l);
  });
};

export function TourHost() {
  const a = useActive();
  const { go, view } = useNav();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [, bump] = useState(0);
  const steps = a?.lesson.tour ?? [];
  const step = steps[i];

  useEffect(() => setI(0), [a]);

  // Go to the step's page, then wait for its target to appear and bring it into view.
  useEffect(() => {
    if (!step) return;
    if (step.view && step.view !== view) go(step.view);
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const look = () => {
      const el = findTarget(step.target);
      if (el) {
        // Scroll only when it's off screen, and only as far as needed (the page itself never shifts).
        const r = el.getBoundingClientRect();
        const off = r.top < 60 || r.bottom > window.innerHeight - 40;
        if (off) el.scrollIntoView({ block: 'center', inline: 'nearest' });
        setTimeout(() => setRect(el.getBoundingClientRect()), off ? 260 : 30);
      } else if (tries++ < 25) t = setTimeout(look, 100);
      else setRect(null);
    };
    setRect(null);
    t = setTimeout(look, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, a]);

  useLayoutEffect(() => {
    if (!step) return;
    const re = () => {
      const el = findTarget(step.target);
      setRect(el ? el.getBoundingClientRect() : null);
      bump((x) => x + 1);
    };
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    return () => {
      window.removeEventListener('resize', re);
      window.removeEventListener('scroll', re, true);
    };
  }, [step]);

  useEffect(() => {
    if (!a) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopTour();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  if (!a || !step) return null;
  const last = i === steps.length - 1;
  function next() {
    if (!a) return;
    if (i < steps.length - 1) setI(i + 1);
    else {
      a.onDone?.();
      stopTour();
    }
  }

  const pad = 8;
  const W = 340;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: React.CSSProperties = { left: (vw - W) / 2, top: vh / 2 - 90, width: W };
  if (rect) {
    const below = rect.bottom + pad + 12;
    const above = rect.top - pad - 12;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - W / 2), vw - W - 12);
    cardStyle = below + 190 < vh ? { left, top: below, width: W } : above > 190 ? { left, top: above, width: W, transform: 'translateY(-100%)' } : { left: Math.min(rect.right + 16, vw - W - 12), top: Math.max(12, rect.top), width: W };
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={cardStyle}>
        <div className="small muted">{a.lesson.title} · step {i + 1} of {steps.length}</div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={stopTour}>Close</button>
          <span className="grow" />
          {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn sm primary" onClick={next} autoFocus>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
