/* sheet.js — spreadsheets without libraries: read .xlsx/.xlsm/.csv, write real .xlsx (and .pptx, which is the same
   zip container). The old builder exported "Excel" as XML renamed to .xls, which Excel opens with a warning. */
OC.sheet = (() => {
  /* ---------------- zip reader ---------------- */
  async function unzip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("This isn't a valid .xlsx file.");
    const count = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true);
    const files = {}, dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nameLen = dv.getUint16(off + 28, true), extra = dv.getUint16(off + 30, true), comment = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      files[dec.decode(u8.subarray(off + 46, off + 46 + nameLen))] = { method, csize, lho };
      off += 46 + nameLen + extra + comment;
    }
    return {
      async text(name) {
        const f = files[name]; if (!f) return null;
        const ln = dv.getUint16(f.lho + 26, true), le = dv.getUint16(f.lho + 28, true);
        const data = u8.subarray(f.lho + 30 + ln + le, f.lho + 30 + ln + le + f.csize);
        if (f.method === 0) return dec.decode(data);
        if (!("DecompressionStream" in window)) throw new Error("This browser can't read .xlsx — save the sheet as CSV instead.");
        return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      },
    };
  }
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const all = (sel, root) => Array.from(root.querySelectorAll(sel));
  const colIdx = (ref) => { const m = ref.match(/^([A-Z]+)/); let n = 0; for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

  /* -> [{ name, rows: [[string]] }] */
  async function readXlsx(buf) {
    const z = await unzip(buf);
    const wb = xml(await z.text("xl/workbook.xml"));
    const rels = xml(await z.text("xl/_rels/workbook.xml.rels"));
    const relMap = {};
    all("Relationship", rels).forEach((r) => (relMap[r.getAttribute("Id")] = r.getAttribute("Target")));
    const ssText = await z.text("xl/sharedStrings.xml");
    const shared = ssText ? all("si", xml(ssText)).map((si) => all("t", si).map((t) => t.textContent).join("")) : [];
    const sheets = [];
    for (const s of all("sheet", wb)) {
      const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      let target = (relMap[rid] || "").replace(/^\//, ""); if (!target.startsWith("xl/")) target = "xl/" + target;
      const sx = await z.text(target); if (!sx) continue;
      const rows = [];
      all("sheetData row", xml(sx)).forEach((row) => {
        const r = Number(row.getAttribute("r")) - 1;
        const out = (rows[r] = rows[r] || []);
        all("c", row).forEach((c) => {
          const t = c.getAttribute("t"), v = c.querySelector("v"), is = c.querySelector("is");
          let val = v ? v.textContent : is ? all("t", is).map((x) => x.textContent).join("") : "";
          if (t === "s") val = shared[Number(val)] ?? "";
          else if (t === "b") val = val === "1" ? "TRUE" : "FALSE";
          else if (t === "e") val = "";
          out[colIdx(c.getAttribute("r"))] = String(val ?? "").trim();
        });
      });
      sheets.push({ name: s.getAttribute("name"), rows: Array.from(rows, (r) => Array.from(r || [], (c) => c || "")) });
    }
    return sheets;
  }
  function readDelimited(text) {
    text = text.replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delim = firstLine.includes("\t") ? "\t" : (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"' && cell === "") q = true;
      else if (ch === delim) { row.push(cell.trim()); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return [{ name: "Sheet1", rows: rows.filter((r) => r.some((c) => c)) }];
  }
  /* The old builder's "Excel" export (SpreadsheetML 2003 XML). */
  function readSpreadsheetML(text) {
    const d = xml(text);
    return all("Worksheet", d).map((ws) => ({ name: ws.getAttribute("ss:Name") || "Sheet", rows: all("Row", ws).map((r) => all("Cell", r).map((c) => (c.textContent || "").trim())) }));
  }
  async function readAny(file) {
    const n = file.name.toLowerCase();
    if (/\.(xlsx|xlsm)$/.test(n)) return readXlsx(await OC.u.readFile(file, "buffer"));
    const text = await OC.u.readFile(file);
    if (/^\s*<\?xml|<Workbook/i.test(text.slice(0, 400))) return readSpreadsheetML(text);
    return readDelimited(text);
  }

  /* ---------------- zip writer (stored, no compression) ---------------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  /* files: [{ name, data: string|Uint8Array }] -> Blob */
  function zip(files, type = "application/zip") {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type });
  }

  const xe = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const colName = (i) => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  /* writeXlsx([{ name, rows: [[cell]], widths: [n] }]) -> Blob. First row is styled as a header and frozen. */
  function writeXlsx(sheets) {
    const files = [];
    files.push({ name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` });
    files.push({ name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
    files.push({ name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` });
    files.push({ name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
    // style 1 = bold white on Anchor Gray header
    files.push({ name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF53575A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` });
    sheets.forEach((s, si) => {
      const cols = s.widths ? `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
      const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
        const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : "";
        if (typeof c === "number" && isFinite(c)) return `<c r="${ref}"${st}><v>${c}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xe(c)}</t></is></c>`;
      }).join("")}</row>`).join("");
      const last = colName(Math.max(0, (s.rows[0] || []).length - 1)) + Math.max(1, s.rows.length);
      files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>` });
    });
    return zip(files, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  return { readAny, readXlsx, readDelimited, writeXlsx, zip, xe };
})();
