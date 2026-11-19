/*
 * Minimal .xlsx reader for exports (Wrike, Service Desk): first worksheet, cell text and cell hyperlinks.
 * No library: an .xlsx is a zip of XML files. Uses the browser's DecompressionStream('deflate-raw').
 */

export interface Sheet {
  /** Rows of cell text, header first. */
  rows: string[][];
  /** Hyperlink per cell, keyed "row,col" (0-based, matching `rows`). */
  links: Map<string, string>;
}

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  offset: number;
}

function entries(buf: ArrayBuffer): Map<string, ZipEntry> {
  const v = new DataView(buf);
  // End of central directory: scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not an .xlsx file (zip directory not found).');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, ZipEntry>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    // Data starts after the local header (its name/extra lengths can differ from the central copy).
    const lName = v.getUint16(local + 26, true);
    const lExtra = v.getUint16(local + 28, true);
    out.set(name, { name, method, compSize, offset: local + 30 + lName + lExtra });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: ArrayBuffer, e?: ZipEntry): Promise<string | undefined> {
  if (!e) return undefined;
  const data = new Uint8Array(buf, e.offset, e.compSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`Unsupported compression in ${e.name}`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}

const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');

/** Text of every <t> inside a fragment (handles rich text runs). */
const textOf = (frag: string) => [...frag.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');

/** "B12" -> [row 11, col 1] */
function ref(r: string): [number, number] {
  const m = r.match(/^([A-Z]+)(\d+)$/)!;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return [+m[2] - 1, col - 1];
}

/** Excel serial date (days since 1899-12-30) -> MM/DD/YYYY, for date-formatted number cells. */
const serialDate = (n: number) => {
  const d = new Date(Math.round((n - 25569) * 864e5));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

export async function readXlsx(buf: ArrayBuffer): Promise<Sheet> {
  const z = entries(buf);
  const wb = (await readEntry(buf, z.get('xl/workbook.xml'))) ?? '';
  const wbRels = (await readEntry(buf, z.get('xl/_rels/workbook.xml.rels'))) ?? '';
  // First sheet's file
  const firstRid = wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = firstRid ? wbRels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstRid}"[^>]*Target="([^"]+)"`))?.[1] ?? wbRels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstRid}"`))?.[1] : undefined;
  const sheetPath = target ? 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '') : 'xl/worksheets/sheet1.xml';
  const sheet = await readEntry(buf, z.get(sheetPath));
  if (!sheet) throw new Error('No worksheet found in the file.');
  const sst = await readEntry(buf, z.get('xl/sharedStrings.xml'));
  const strings = sst ? [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];
  // Date-formatted styles (to turn serial numbers into dates)
  const styles = (await readEntry(buf, z.get('xl/styles.xml'))) ?? '';
  const xfs = [...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '').matchAll(/<xf\b[^>]*numFmtId="(\d+)"/g)].map((m) => +m[1]);
  const customDate = new Set([...styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)].filter((m) => /[dmy]/i.test(m[2]) && !/\[h\]/i.test(m[2])).map((m) => +m[1]));
  const isDateFmt = (id: number) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || customDate.has(id);

  const rows: string[][] = [];
  for (const c of sheet.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = c[1];
    const body = c[2] ?? '';
    const r = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!r) continue;
    const [ri, ci] = ref(r);
    const t = attrs.match(/\bt="([^"]+)"/)?.[1];
    const s = +(attrs.match(/\bs="(\d+)"/)?.[1] ?? 0);
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let val = '';
    if (t === 's' && raw !== undefined) val = strings[+raw] ?? '';
    else if (t === 'inlineStr') val = textOf(body);
    else if (t === 'str' || t === 'e') val = unescape(raw ?? '');
    else if (t === 'b') val = raw === '1' ? 'TRUE' : 'FALSE';
    else if (raw !== undefined) val = isDateFmt(xfs[s] ?? 0) ? serialDate(+raw) : raw;
    (rows[ri] ??= [])[ci] = val;
  }
  for (let i = 0; i < rows.length; i++) rows[i] = Array.from(rows[i] ?? [], (v) => v ?? '');

  const links = new Map<string, string>();
  const relPath = sheetPath.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels');
  const rels = (await readEntry(buf, z.get(relPath))) ?? '';
  const relTarget = new Map([...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [m[1].match(/\bId="([^"]+)"/)?.[1] ?? '', unescape(m[1].match(/\bTarget="([^"]+)"/)?.[1] ?? '')]));
  for (const h of sheet.matchAll(/<hyperlink\b([^>]*)\/?>/g)) {
    const r = h[1].match(/\bref="([A-Z]+\d+)/)?.[1];
    const id = h[1].match(/\br:id="([^"]+)"/)?.[1];
    if (!r || !id || !relTarget.get(id)) continue;
    const [ri, ci] = ref(r);
    links.set(`${ri},${ci}`, relTarget.get(id)!);
  }
  return { rows, links };
}
