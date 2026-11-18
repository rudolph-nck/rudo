import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Bucket, Priority, WorkItem } from '../model/types';
import { findPerson, initials } from '../model/logic';
import type { HubConfig } from '../model/types';

// ---------------------------------------------------------------- icons (inline, no network)
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const paths: Record<string, ReactNode> = {
  board: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></>,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5 5h14l2 8v6H3v-6z" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.5 0 4 1.5 4.8 4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  log: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  auto: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  user0: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /><path d="M3 3l18 18" /></>,
  check: <path d="M4 12l5 5L20 6" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 21V9M7 14l5-5 5 5" /><path d="M4 3h16" /></>,
  folder: <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  triage: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
};
export function Icon({ name, size = 18, label }: { name: keyof typeof paths | string; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...P} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {paths[name]}
    </svg>
  );
}

// ---------------------------------------------------------------- avatars & chips
const AVATAR_COLORS = ['#3346D3', '#0B7363', '#A33A00', '#7135B8', '#A1206A', '#28652A', '#155E99', '#5A5F6E'];
export function avatarColor(username: string, config: HubConfig) {
  const i = config.people.findIndex((p) => p.username === username);
  return AVATAR_COLORS[(i < 0 ? username.length : i) % AVATAR_COLORS.length];
}
export function Avatar({ user, config, size }: { user?: string; config: HubConfig; size?: 'lg' }) {
  if (!user)
    return (
      <span className={`avatar none ${size ?? ''}`} role="img" aria-label="No owner" title="No owner">
        ?
      </span>
    );
  const p = findPerson(config, user);
  return (
    <span className={`avatar ${size ?? ''}`} role="img" aria-label={p?.name ?? user} title={p?.name ?? user} style={{ background: avatarColor(user, config) }}>
      {initials(p, user)}
    </span>
  );
}
export const PriorityChip = ({ p }: { p?: Priority }) => (p ? <span className={`chip ${p.toLowerCase()}`}>{p}</span> : null);
export const BucketDot = ({ b }: { b?: Bucket }) => (
  <span className={`dot ${b ?? 'none'}`} title={b ?? 'Not graded'} aria-label={b ? `${b} bucket` : 'Not graded'} role="img" />
);
export function SourceBadge({ item }: { item: WorkItem }) {
  const label = item.source === 'Hub' ? 'Hub' : `${item.source === 'SD' ? 'SD' : 'Wrike'}${item.source_id ? ' #' + item.source_id : ''}`;
  if (item.source_url)
    return (
      <a
        className="chip src link"
        href={item.source_url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        title={`Open in ${item.source === 'SD' ? 'Service Desk' : item.source} (new tab)`}
        aria-label={`${label}, open in ${item.source === 'SD' ? 'Service Desk' : item.source}`}
      >
        {label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    );
  return <span className="chip src">{label}</span>;
}

// ---------------------------------------------------------------- modal on native <dialog> (focus trap + Esc for free)
export function Modal({ open, onClose, title, children, footer, drawer, labelledBy }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; drawer?: boolean; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idRef = useRef(labelledBy ?? 'dlg-' + Math.random().toString(36).slice(2));
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${drawer ? 'drawer' : ''}`}
      aria-labelledby={idRef.current}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <>
          <div className="modal-head">
            <h2 id={idRef.current} className="grow">
              {title}
            </h2>
            <button className="btn icon ghost" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

/** Radio-style button group (role=radiogroup) used for grading. */
export function Pick<T extends string | number>({ label, value, options, onChange, render, disabled }: { label: string; value?: T; options: readonly T[]; onChange: (v: T) => void; render?: (v: T) => ReactNode; disabled?: boolean }) {
  return (
    <div className="pick" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={value === o} disabled={disabled} onClick={() => onChange(o)}>
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- toast
let pushToast: ((s: string) => void) | undefined;
export const toast = (s: string) => pushToast?.(s);
export function Toaster() {
  const [msg, setMsg] = useState<string>();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (s) => {
      setMsg(s);
      clearTimeout(t);
      t = setTimeout(() => setMsg(undefined), 3500);
    };
    return () => {
      pushToast = undefined;
    };
  }, []);
  return (
    <div role="status" aria-live="polite">
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}

export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
