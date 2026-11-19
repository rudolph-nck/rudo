import type { ReactNode } from 'react';
import { Pick } from './ui';

const SCALE = [1, 2, 3, 4, 5] as const;

/**
 * 1–5 picker that explains itself: optional short captions on the buttons (e.g. "~1 week"), the meaning of every
 * value on hover, and the meaning of the selected value written out underneath.
 */
export function ScalePick({ label, value, onChange, levels, short, disabled, extra }: { label: string; value?: number; onChange: (v: number) => void; levels?: string[]; short?: string[]; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="scale">
      <div className="row wrap" style={{ gap: 10 }}>
        <Pick
          label={`${label}, 1 to 5`}
          value={value as 1 | 2 | 3 | 4 | 5 | undefined}
          options={SCALE}
          onChange={onChange}
          disabled={disabled}
          describe={(v) => levels?.[v - 1]}
          render={(v) =>
            short ? (
              <span className="lvl">
                <b>{v}</b>
                <small>{short[v - 1]}</small>
              </span>
            ) : (
              String(v)
            )
          }
        />
        {extra}
      </div>
      {levels && (
        <div className={`scale-meaning ${value ? '' : 'muted'}`} aria-live="polite">
          {value ? <><strong>{value}:</strong> {levels[value - 1]}</> : 'Pick a value. Hover a number to see what it means.'}
        </div>
      )}
    </div>
  );
}

/** Ticket grading anchors (Triage). Effort is in hours because tickets should fit in a day. */
export const IMPACT_LEVELS = [
  'One person, minor inconvenience.',
  'One person blocked, or a few people inconvenienced.',
  'A team or a branch affected.',
  'Several teams or branches, or a key system degraded.',
  'Members affected, or a critical system down.',
];
export const URGENCY_LEVELS = [
  'Whenever. No date.',
  'Within the next couple of weeks.',
  'This week.',
  'Today or tomorrow.',
  'Now: outage, or a deadline today.',
];
export const EFFORT_LEVELS = [
  'Under 1 hour.',
  '1–4 hours.',
  'About a day (4–8 hours).',
  '2–3 days. Split it into tasks that fit in a day.',
  'A week or more. That’s a project: grade it into Projects.',
];
export const EFFORT_SHORT = ['<1 hr', '1–4 hrs', '~1 day', '2–3 days', '1 wk+'];
