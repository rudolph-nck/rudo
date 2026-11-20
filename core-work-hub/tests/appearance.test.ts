// Colour themes: validation of what's saved, readable contrast in every theme, and saving per person.
import { describe, expect, it } from 'vitest';
import { cleanAppearance, contrast, PALETTES, resolveTheme, themeCss } from '../src/model/appearance';
import { defaultConfig } from '../src/model/config';
import { replay } from '../src/model/replay';

const varOf = (css: string, block: number, name: string) => {
  const part = css.split('\n')[block];
  return new RegExp(`${name}: (#[0-9a-f]{6});`).exec(part)?.[1];
};

describe('appearance', () => {
  it('keeps only valid settings from a change file', () => {
    expect(cleanAppearance({ palette: 'slate', mode: 'dark', accent: 'red', tint: 'pink', muted: 'yes', x: 1 })).toEqual({ palette: 'slate', mode: 'dark' });
    expect(cleanAppearance({ palette: 'custom', accent: '#ABCDEF', tint: 'warm', muted: true })).toEqual({ palette: 'custom', accent: '#abcdef', tint: 'warm', muted: true });
    expect(cleanAppearance('nope')).toBeUndefined();
    expect(cleanAppearance({ palette: '<script>' })).toBeUndefined();
  });

  it('the default theme changes nothing', () => {
    expect(themeCss(undefined)).toBe('');
    expect(themeCss({ palette: 'indigo', mode: 'dark' })).toBe('');
  });

  it('every theme keeps text and buttons readable in light and dark', () => {
    const themes = [...PALETTES.map((p) => ({ palette: p.id })), { palette: 'custom', accent: '#ffff00', tint: 'warm' as const }, { palette: 'custom', accent: '#101010', tint: 'neutral' as const }];
    for (const a of themes) {
      const css = themeCss(a);
      if (!css) continue;
      // block 0 = light, block 1 = dark (media query)
      const lightText = varOf(css, 0, '--accent-text')!;
      expect(contrast(lightText, varOf(css, 0, '--surface')!), `${a.palette} light text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(varOf(css, 0, '--on-accent')!, varOf(css, 0, '--accent')!), `${a.palette} light button`).toBeGreaterThanOrEqual(3);
      const darkText = varOf(css, 1, '--accent-text')!;
      expect(contrast(darkText, varOf(css, 1, '--surface')!), `${a.palette} dark text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(varOf(css, 1, '--on-accent')!, varOf(css, 1, '--accent')!), `${a.palette} dark button`).toBeGreaterThanOrEqual(3);
    }
  });

  it('neutral themes quiet the bucket colours', () => {
    expect(resolveTheme({ palette: 'graphite' }).muted).toBe(true);
    expect(themeCss({ palette: 'graphite' })).toContain('--b-project');
    expect(themeCss({ palette: 'ocean' })).not.toContain('--b-project');
  });

  it('is saved per person: only the file owner can set their own theme', () => {
    const cfg = defaultConfig();
    let k = 0;
    const ev = (file: string, appearance: unknown) => ({ file, event: { id: file + ++k, ts: new Date(Date.UTC(2026, 10, 20, 9, k)).toISOString(), user: file, type: 'profile.set', data: { appearance } } });
    const s = replay(cfg, undefined, [ev('wes', { palette: 'sand', mode: 'dark' }), ev('trey', { palette: 'plum' })] as never);
    expect(s.config.people.find((p) => p.username === 'wes')!.appearance).toEqual({ palette: 'sand', mode: 'dark' });
    expect(s.config.people.find((p) => p.username === 'trey')!.appearance).toEqual({ palette: 'plum' });
    expect(s.config.people.find((p) => p.username === 'nick')!.appearance).toBeUndefined();
    const reset = replay(cfg, undefined, [ev('wes', { palette: 'sand' }), ev('wes', null)] as never);
    expect(reset.config.people.find((p) => p.username === 'wes')!.appearance).toBeUndefined();
  });
});
