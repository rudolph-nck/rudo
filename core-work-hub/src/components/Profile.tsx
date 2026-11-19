// "My avatar": each person picks a colour, an emoji or a photo. Saved as a profile.set event in their own
// change file, so the whole team sees it on the next sync. Nobody can change someone else's.
import { useState } from 'react';
import { useHub } from '../store/hub';
import { AVATAR_COLORS, MAX_PHOTO_CHARS, validEmoji } from '../model/avatar';
import { findPerson, initials } from '../model/logic';
import type { AvatarStyle, HubConfig } from '../model/types';
import { Avatar, Icon, Modal, avatarColor } from './ui';

const EMOJI = ['😀', '😎', '🤓', '🙂', '🦊', '🐻', '🐼', '🐯', '🦉', '🐙', '🚀', '⚡', '🔥', '🌟', '🎯', '🛠️', '💻', '🎧', '☕', '🌵', '🏀', '⚽', '🎸', '🍕'];

/** Square-crop and shrink an image to 128 px, as a small JPEG data URL. */
export async function toAvatarPhoto(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 128);
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 128, 128);
  bmp.close();
  for (const q of [0.85, 0.7, 0.5]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= MAX_PHOTO_CHARS) return url;
  }
  throw new Error('That picture is too large.');
}

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, commit, store, readOnly } = useHub();
  const cfg = state.config;
  const p = findPerson(cfg, me);
  const cur = p?.avatar ?? {};
  const [draft, setDraft] = useState<AvatarStyle>(cur);
  const [custom, setCustom] = useState('');
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setDraft(p?.avatar ?? {}); setCustom(''); setMsg(undefined); }
  }
  if (!p) return null;

  // Preview with the draft applied to a copy of the config.
  const preview: HubConfig = { ...cfg, people: cfg.people.map((x) => (x.username === me ? { ...x, avatar: draft } : x)) };
  const color = draft.color ?? avatarColor(me, { ...cfg, people: cfg.people.map((x) => (x.username === me ? { ...x, avatar: undefined } : x)) });
  const mode = draft.photo ? 'photo' : draft.emoji ? 'emoji' : 'initials';

  const usePhoto = async (get: () => Promise<Blob | undefined>, none: string) => {
    setBusy(true); setMsg(undefined);
    try {
      const b = await get();
      if (!b) return setMsg(none);
      setDraft((d) => ({ ...d, photo: undefined }));
      const photo = await toAvatarPhoto(b);
      setDraft((d) => ({ ...d, photo }));
    } catch (e) {
      setMsg((e as Error).message || 'Could not read that picture.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const data: { color?: string | null; emoji?: string | null; photo?: string | null } = {};
    if ((draft.color ?? null) !== (cur.color ?? null)) data.color = draft.color ?? null;
    if ((draft.emoji ?? null) !== (cur.emoji ?? null)) data.emoji = draft.emoji ?? null;
    if ((draft.photo ?? null) !== (cur.photo ?? null)) data.photo = draft.photo ?? null;
    if (Object.keys(data).length && !(await commit([{ type: 'profile.set', data }]))) return;
    onClose();
  };

  const tryCustom = (v: string) => {
    setCustom(v);
    const t = v.trim();
    if (validEmoji(t)) setDraft((d) => ({ ...d, emoji: t, photo: undefined }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My avatar"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => void save()} disabled={readOnly || busy}>Save</button>
        </>
      }
    >
      <div className="stack">
        <div className="profile-preview">
          <Avatar user={me} config={preview} size="xl" />
          <div className="row" style={{ gap: 6 }}>
            <Avatar user={me} config={preview} size="lg" />
            <Avatar user={me} config={preview} />
          </div>
          <div className="grow small muted">Everyone on the team sees this on cards, the board and the team pages.</div>
        </div>

        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Show</legend>
          <div className="seg" role="radiogroup" aria-label="Show">
            {(['initials', 'emoji', 'photo'] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => {
                  if (m === 'initials') setDraft((d) => ({ ...d, emoji: undefined, photo: undefined }));
                  if (m === 'emoji') setDraft((d) => ({ ...d, photo: undefined, emoji: d.emoji ?? cur.emoji ?? EMOJI[0] }));
                  if (m === 'photo' && !draft.photo && cur.photo) setDraft((d) => ({ ...d, photo: cur.photo }));
                  if (m === 'photo' && !draft.photo && !cur.photo) document.getElementById('avatar-file')?.click();
                }}
              >
                {m === 'initials' ? `Initials (${initials(p, me)})` : m === 'emoji' ? 'Emoji' : 'Photo'}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="stack">
          <span className="label" id="avatar-color-label">Colour {draft.photo ? <span className="muted small">(behind initials or emoji; not shown with a photo)</span> : null}</span>
          <div className="swatches" role="radiogroup" aria-labelledby="avatar-color-label">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.color}
                className="swatch"
                role="radio"
                aria-checked={color.toLowerCase() === c.color.toLowerCase()}
                aria-label={c.name}
                title={c.name}
                style={{ background: c.color }}
                onClick={() => setDraft((d) => ({ ...d, color: c.color }))}
              >
                {color.toLowerCase() === c.color.toLowerCase() && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
          {draft.color && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft((d) => ({ ...d, color: undefined }))}>Use my default colour</button>}
        </div>

        {mode === 'emoji' && (
          <div className="stack">
            <span className="label">Emoji</span>
            <div className="emoji-grid">
              {EMOJI.map((e) => (
                <button key={e} aria-pressed={draft.emoji === e} aria-label={`Emoji ${e}`} onClick={() => setDraft((d) => ({ ...d, emoji: e, photo: undefined }))}>{e}</button>
              ))}
            </div>
            <label className="small stack" style={{ gap: 4 }}>
              Or type / paste any emoji (Windows key + . opens the emoji panel)
              <input className="input" style={{ maxWidth: 120 }} value={custom} onChange={(e) => tryCustom(e.target.value)} aria-label="Custom emoji" />
            </label>
          </div>
        )}

        <div className="stack">
          <span className="label">Photo</span>
          <div className="row wrap" style={{ gap: 8 }}>
            {store.windowsPicture && (
              <button className="btn sm" disabled={busy} onClick={() => void usePhoto(() => store.windowsPicture!(), 'Windows doesn’t have an account picture for you on this PC. Upload one instead.')}>
                Use my Windows picture
              </button>
            )}
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              Upload a photo…
              <input
                id="avatar-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void usePhoto(async () => f, 'No file chosen.');
                }}
              />
            </label>
            {draft.photo && <button className="btn sm ghost" onClick={() => setDraft((d) => ({ ...d, photo: undefined }))}>Remove photo</button>}
          </div>
          <span className="small muted">Cropped to a square and shrunk to 128 px. It is stored in the shared hub folder, so pick something you’re happy for the team to see.</span>
          {msg && <span className="small danger-text" role="alert">{msg}</span>}
        </div>
      </div>
    </Modal>
  );
}
