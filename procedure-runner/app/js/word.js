/* word.js — Word (.docx) import and export, in the browser with no libraries.
   Import: headings → sections, top-level numbered/bulleted items → steps, deeper items → sub-bullets,
   NOTE!/IMPORTANT!/TIP! paragraphs → callouts, monospace text → console blocks, tables, screenshots.
   Export: a controlled-document layout (grey header band with title, version, revision date and who last modified it;
   numbered steps; Page X of Y footer). The procedure JSON rides along inside the file, so re-importing an unedited
   export restores it exactly. */
PR.word = (() => {
  const { h, toast, modal, uid, pickFile, download, fmtDate, fmtDateTime, fmtMin, now } = PR.u;
  const M = () => PR.model;
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const PAYLOAD_NS = "urn:procedure-runner:word:v1";

  /* ======================= READ ======================= */
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const kids = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
  const kid = (el, name) => (el ? [...el.children].find((c) => c.localName === name) || null : null);
  const wa = (el, name) => (el ? el.getAttributeNS(W, name) || el.getAttribute("w:" + name) || "" : "");
  const on = (el) => !!el && !/^(0|false|off|none)$/i.test(wa(el, "val"));
  const MONO = /consolas|courier|lucida console|cascadia|menlo|monaco|source code|fira code|monospace|andale mono/i;
  const WINGDINGS = { "à": "→", "ß": "←", "è": "➔", "ð": "⇒", "Ø": "➢", "ü": "✓", "þ": "☑", "ý": "☒", "o": "☐", "q": "☐", "l": "●", "§": "▪", "n": "■", "Ÿ": "•", "J": "☺", "ê": "⇨", "F": "👉" };
  const CALLOUT = /^\s*(important|note|notes|known issue|tip|warning|caution|attention|reminder|success)\s*[!:]+\s*[-–—]?\s*/i;
  const TONE = { important: "warn", note: "info", notes: "info", "known issue": "warn", tip: "tip", warning: "danger", caution: "danger", attention: "warn", reminder: "info", success: "success" };
  const CMD = /^\s*(curl|wget|ssh|scp|sftp|sudo|openssl|keytool|certutil|powershell|pwsh|Invoke-\w+|Get-\w+|Set-\w+|New-\w+|Remove-\w+|Restart-\w+|kubectl|docker|git|iisreset|netsh|nslookup|ipconfig|\$\s|>\s|C:\\>)/;

  function relMap(text, base) {
    const out = {};
    if (!text) return out;
    for (const r of xml(text).getElementsByTagName("Relationship")) {
      let t = r.getAttribute("Target") || "";
      if (r.getAttribute("TargetMode") !== "External") {
        t = t.replace(/^\//, "");
        if (!/^word\//.test(t) && !/^customXml\//.test(t)) { const parts = (base + t).split("/"); const st = []; parts.forEach((x) => (x === ".." ? st.pop() : x && x !== "." && st.push(x))); t = st.join("/"); }
      }
      out[r.getAttribute("Id")] = { target: t, type: (r.getAttribute("Type") || "").split("/").pop(), external: r.getAttribute("TargetMode") === "External" };
    }
    return out;
  }
  function styleMap(text) {
    const map = {};
    if (!text) return map;
    for (const s of xml(text).getElementsByTagNameNS(W, "style")) {
      const id = wa(s, "styleId"); const pPr = kid(s, "pPr"); const rPr = kid(s, "rPr"); const fonts = kid(rPr, "rFonts");
      const numPr = kid(pPr, "numPr"); const ol = kid(pPr, "outlineLvl");
      map[id] = { id, name: wa(kid(s, "name"), "val") || id, basedOn: wa(kid(s, "basedOn"), "val"), num: numPr ? Number(wa(kid(numPr, "ilvl"), "val") || 0) : null,
        numId: numPr ? wa(kid(numPr, "numId"), "val") : "", outline: ol ? Number(wa(ol, "val")) : null, font: fonts ? wa(fonts, "ascii") || wa(fonts, "hAnsi") : "", bold: rPr ? on(kid(rPr, "b")) : false };
    }
    const resolve = (id, k, depth = 0) => { const s = map[id]; if (!s || depth > 10) return null; return s[k] != null && s[k] !== "" && s[k] !== false ? s[k] : resolve(s.basedOn, k, depth + 1); };
    Object.values(map).forEach((s) => { s.rNum = resolve(s.id, "num"); s.rNumId = resolve(s.id, "numId"); s.rOutline = resolve(s.id, "outline"); s.rFont = resolve(s.id, "font") || ""; });
    return map;
  }
  /* Plain text of a part, skipping the mc:Fallback copy of text boxes. Returns one string per paragraph / table cell. */
  function partLines(root) {
    const lines = [];
    const walk = (el) => {
      for (const c of el.children) {
        if (c.localName === "Fallback") continue;
        if (c.localName === "tc") { const t = textOf(c).replace(/\s+/g, " ").trim(); if (t) lines.push(t); continue; }
        if (c.localName === "p") { if (c.getElementsByTagNameNS(W, "txbxContent").length) walk(c); else { const t = textOf(c).replace(/\s+/g, " ").trim(); if (t) lines.push(t); } continue; }
        walk(c);
      }
    };
    walk(root);
    return lines;
  }
  function textOf(el) {
    let s = "";
    const walk = (n) => { for (const c of n.children) { if (c.localName === "Fallback" || c.localName === "instrText" || c.localName === "del") continue; if (c.localName === "t") s += c.textContent; else if (c.localName === "tab") s += " "; else if (c.localName === "br") s += "\n"; else if (c.localName === "p" && s) { s += "\n"; walk(c); } else walk(c); } };
    walk(el);
    return s;
  }
  function hash(str) { let x = 0x811c9dc5; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(16); }
  /* Fingerprint of the document's visible text, used to tell whether an exported file was edited in Word. */
  const textFingerprint = (docXmlText) => { const d = xml(docXmlText); return hash([...d.getElementsByTagNameNS(W, "t")].map((t) => t.textContent).join("").replace(/\s+/g, "")); };

  async function readDocx(buf, fileName = "") {
    const z = await PR.importer.unzip(buf);
    const docText = await z.text("word/document.xml");
    if (!docText) throw new Error("That isn't a Word document (.docx). In Word, use File › Save As › Word Document first.");
    const doc = xml(docText);
    const rels = relMap(await z.text("word/_rels/document.xml.rels"), "word/");
    const styles = styleMap(await z.text("word/styles.xml"));
    const out = { nodes: [], title: "", description: "", headerMeta: [], images: {}, skipped: 0, payload: null, own: Object.values(styles).some((s) => s.id === "ProcStep") };

    // Header: document control fields (Index, Rev. Date…) and a title candidate
    let headerTitle = "";
    for (const r of Object.values(rels)) {
      if (r.type !== "header") continue;
      const t = await z.text(r.target); if (!t) continue;
      for (const line of partLines(xml(t).documentElement)) {
        if (/^(index|rev\.?\s*date|rvw\.?\s*date|review(ed)?\s*date|revision|effective|doc(ument)?\s*(no|#|id|number)|owner|version)\b/i.test(line)) { if (!out.headerMeta.includes(line)) out.headerMeta.push(line); }
        else if (!headerTitle && line.length > 3 && line.length < 140 && !/^page\b/i.test(line)) headerTitle = line;
      }
    }
    // Embedded Procedure Runner payload (from our own export)
    for (const r of Object.values(rels)) {
      if (r.type !== "customXml") continue;
      const t = await z.text(r.target); if (!t || !t.includes(PAYLOAD_NS)) continue;
      try { const el = xml(t).getElementsByTagNameNS(PAYLOAD_NS, "procedure")[0]; const data = JSON.parse(el.textContent); data.edited = data.textHash !== textFingerprint(docText); out.payload = data; } catch (e) { console.warn("payload", e); }
    }
    const core = await z.text("docProps/core.xml");
    const coreTitle = core ? ((xml(core).getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0] || {}).textContent || "").trim() : "";

    const body = doc.getElementsByTagNameNS(W, "body")[0];
    const walkBody = (parent) => {
      for (const el of parent.children) {
        const n = el.localName;
        if (n === "p") { const node = para(el); if (node) out.nodes.push(node); }
        else if (n === "tbl") out.nodes.push(table(el));
        else if (n === "sdt") {
          const gal = el.getElementsByTagNameNS(W, "docPartGallery")[0];
          if (gal && /table of contents/i.test(wa(gal, "val"))) continue;
          walkBody(kid(el, "sdtContent") || el);
        } else if (n === "customXml" || n === "ins" || n === "smartTag") walkBody(el);
      }
    };

    function runsOf(p) {
      const segs = []; const images = [];
      let fld = null; // complex field state: { instr, url, result }
      const walk = (el, link) => {
        for (const c of el.children) {
          const n = c.localName;
          if (n === "del" || n === "moveFrom" || n === "pPr" || n === "rPr" || n === "Fallback" || n === "bookmarkStart" || n === "bookmarkEnd" || n === "proofErr") continue;
          if (n === "hyperlink") { const rid = c.getAttributeNS(RNS, "id") || c.getAttribute("r:id"); walk(c, rid && rels[rid] ? rels[rid].target : null); continue; }
          if (n === "fldSimple") { const m = (wa(c, "instr") || "").match(/HYPERLINK\s+"([^"]+)"/); walk(c, m ? m[1] : link); continue; }
          if (n !== "r") { walk(c, link); continue; }
          const rPr = kid(c, "rPr"); const fonts = kid(rPr, "rFonts");
          const font = (fonts && (wa(fonts, "ascii") || wa(fonts, "hAnsi") || wa(fonts, "cs"))) || "";
          const rStyle = styles[wa(kid(rPr, "rStyle"), "val")];
          const fmt = { b: on(kid(rPr, "b")), i: on(kid(rPr, "i")), hl: !!kid(rPr, "highlight") && wa(kid(rPr, "highlight"), "val") !== "none",
            mono: MONO.test(font) || (rStyle && (MONO.test(rStyle.rFont) || /code|verbatim/i.test(rStyle.name))), sym: /wingdings|symbol|webdings/i.test(font),
            sz: Number(wa(kid(rPr, "sz"), "val") || 0), u: !!kid(rPr, "u") && wa(kid(rPr, "u"), "val") !== "none" };
          for (const r of c.children) {
            const rn = r.localName;
            if (rn === "fldChar") { const t = wa(r, "fldCharType"); if (t === "begin") fld = { instr: "", url: null, result: false }; else if (t === "separate" && fld) { fld.result = true; const m = fld.instr.match(/HYPERLINK\s+"([^"]+)"/); fld.url = m ? m[1] : null; } else if (t === "end") fld = null; continue; }
            if (rn === "instrText") { if (fld) fld.instr += r.textContent; continue; }
            if (fld && !fld.result) continue;
            const href = (fld && fld.url) || link;
            let text = null;
            if (rn === "t") text = fmt.sym ? [...r.textContent].map((ch) => WINGDINGS[ch] || ch).join("") : r.textContent;
            else if (rn === "tab" || rn === "ptab") text = "\t";
            else if ((rn === "br" && wa(r, "type") !== "page") || rn === "cr") text = "\n";
            else if (rn === "noBreakHyphen") text = "-";
            else if (rn === "sym") { const code = parseInt(wa(r, "char"), 16) & 0xff; text = WINGDINGS[String.fromCharCode(code)] || ""; }
            else if (rn === "drawing" || rn === "pict" || rn === "AlternateContent" || rn === "object") {
              for (const b of r.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "blip")) { const id = b.getAttributeNS(RNS, "embed"); if (id && rels[id]) images.push(rels[id].target); }
              for (const v of r.getElementsByTagName("v:imagedata")) { const id = v.getAttributeNS(RNS, "id") || v.getAttribute("r:id"); if (id && rels[id] && !images.includes(rels[id].target)) images.push(rels[id].target); }
            }
            if (text) segs.push({ text: text.replace(/[\u00ad\u200b\u2060\ufeff]/g, "").replace(/\u00a0/g, " "), ...fmt, link: href && /^(https?:|mailto:|file:|\\\\)/i.test(href) ? href : null });
          }
        }
      };
      walk(p, null);
      return { segs, images };
    }

    function para(p) {
      const pPr = kid(p, "pPr");
      const style = styles[wa(kid(pPr, "pStyle"), "val")] || { id: "", name: "Normal", rFont: "" };
      if (/^toc\s*\d|^toc heading/i.test(style.name)) return null;
      const { segs, images } = runsOf(p);
      const plain = segs.map((s) => s.text).join("").replace(/\t+/g, " ").replace(/[ ]{2,}/g, " ").trim();
      if (!plain && !images.length) return { t: "gap" };
      let level = 0;
      const hm = style.name.match(/^heading\s*(\d)$/i) || style.id.match(/^Heading(\d)$/);
      if (hm) level = Number(hm[1]);
      else if (style.id === "ProcFront") level = -1;
      else { const ol = kid(pPr, "outlineLvl"); const v = ol ? Number(wa(ol, "val")) : style.rOutline; if (v != null && v < 6 && !/normal/i.test(style.name)) level = v + 1; }
      const numPr = kid(pPr, "numPr");
      let list = null;
      if (numPr) { const id = wa(kid(numPr, "numId"), "val"); if (id && id !== "0") list = { numId: id, ilvl: Number(wa(kid(numPr, "ilvl"), "val") || 0) }; }
      else if (style.rNum != null && style.rNumId && style.rNumId !== "0") list = { numId: style.rNumId, ilvl: style.rNum };
      const textChars = segs.filter((s) => s.text.trim());
      const nonSpace = (arr) => arr.reduce((a, s) => a + s.text.replace(/\s/g, "").length, 0);
      const total = nonSpace(textChars) || 1;
      const pMono = MONO.test(style.rFont) || /code|preformat|plain text|verbatim|console/i.test(style.name);
      const monoFrac = pMono ? 1 : nonSpace(textChars.filter((s) => s.mono)) / total;
      const allBold = textChars.length > 0 && (style.bold || textChars.every((s) => s.b || s.hl));
      const big = Math.max(0, ...textChars.map((s) => s.sz)) >= 28 || (textChars.length > 0 && textChars.every((s) => s.u));
      return { t: style.id === "Title" || /^title$/i.test(style.name) ? "title" : level ? "h" : "p", level, style: style.id, styleName: style.name, segs, plain, raw: segs.map((s) => s.text).join(""), images, list, mono: monoFrac >= 0.8, allBold, big };
    }

    function table(tbl) {
      const caption = wa(kid(kid(tbl, "tblPr"), "tblCaption"), "val");
      const images = []; const rows = [];
      for (const tr of kids(tbl, "tr")) {
        const cells = [];
        for (const tc of kids(tr, "tc")) {
          const parts = [];
          for (const p of tc.getElementsByTagNameNS(W, "p")) { const { segs, images: im } = runsOf(p); images.push(...im); const t = segs.map((s) => s.text).join("").replace(/\s+/g, " ").trim(); if (t) parts.push(t); }
          cells.push(parts.join(" / ").replace(/\|/g, "/"));
        }
        if (cells.some(Boolean)) rows.push(cells);
      }
      return { t: "table", caption, rows, images, mono: rows.length === 1 && rows[0].length === 1 && CMD.test(rows[0][0]) };
    }

    walkBody(body);

    // Title: Title style > a big/underlined/bold first line > header > document properties > file name
    const ti = out.nodes.findIndex((n) => n.t === "title");
    if (ti >= 0) { out.title = out.nodes[ti].plain; out.nodes.splice(ti, 1); }
    else {
      const first = out.nodes.findIndex((n) => n.t !== "gap");
      const f = out.nodes[first];
      if (f && f.t === "p" && !f.list && f.plain.length <= 120 && (f.big || f.allBold) && !CALLOUT.test(f.plain)) { out.title = f.plain; out.nodes.splice(first, 1); }
      else out.title = headerTitle || coreTitle || fileName.replace(/\.docx$/i, "").replace(/[_]+/g, " ");
    }
    const sub = out.nodes.findIndex((n) => n.t === "p" && /^subtitle$/i.test(n.styleName));
    if (sub >= 0) { out.description = out.nodes[sub].plain; out.nodes.splice(sub, 1); }
    if (out.headerMeta.length && !out.own) out.description = [out.description, out.headerMeta.join(" · ")].filter(Boolean).join("\n");

    // Images: load once, compress like pasted screenshots
    const paths = [...new Set(out.nodes.flatMap((n) => n.images || []))];
    for (const pth of paths) {
      const ext = (pth.split(".").pop() || "").toLowerCase();
      const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp" }[ext];
      if (!mime) { out.skipped++; continue; }
      try { const bytes = await z.bytes(pth); if (bytes) out.images[pth] = await PR.u.compressImage(new Blob([bytes], { type: mime })); } catch (e) { out.skipped++; }
    }
    return out;
  }

  /* segments → inline markdown the app understands (**bold**, *italic*, `code`, [label](url)) */
  function segsToMd(segs, { noBold = false } = {}) {
    const merged = [];
    for (const s of segs) {
      const k = `${!noBold && (s.b || s.hl)}|${s.i}|${s.mono}|${s.link || ""}`;
      const last = merged[merged.length - 1];
      if (last && last.k === k) last.text += s.text; else merged.push({ ...s, k, b: !noBold && (s.b || s.hl) });
    }
    return merged.map((s) => {
      let t = s.text.replace(/\t+/g, " ");
      if (!t.trim()) return t;
      const lead = t.match(/^\s*/)[0], trail = t.match(/\s*$/)[0]; let core = t.trim();
      if (s.link && /^https?:/i.test(s.link)) return `${lead}[${core.replace(/[[\]]/g, "")}](${s.link.replace(/\s/g, "%20")})${trail}`;
      if (s.mono && !core.includes("`") && !core.includes("\n")) core = "`" + core + "`";
      else { if (s.i) core = `*${core}*`; if (s.b) core = `**${core}**`; }
      return lead + core + trail;
    }).join("").replace(/[ ]{2,}/g, " ");
  }
  const cleanTitle = (s) => String(s || "").replace(/\s*[:;]\s*-?\s*$/, "").replace(/\s+-\s*$/, "").replace(/^\s*\d+[a-z]?[.)]\s+/, "").replace(/\s*☐\s*$/, "").replace(/\s+/g, " ").trim();

  /* ======================= MAP → PROCEDURE ======================= */
  function build(parsed, o) {
    const p = M().newProcedure({ title: o.title || parsed.title || "Imported procedure", description: parsed.description || "" });
    p.sections = [];
    const nodes = parsed.nodes;
    const own = parsed.own;
    let sec = null, step = null, textBlk = null, code = null, callout = null, lastImg = null, skipFront = false;
    const target = () => (step ? step.blocks : sec._intro);
    const addSec = (title) => { sec = M().newSection({ title: cleanTitle(title) || "Steps" }); sec._intro = []; p.sections.push(sec); step = null; flush(); return sec; };
    const ensureSec = () => sec || addSec("Steps");
    const flush = () => { textBlk = null; code = null; callout = null; };
    const push = (b) => { ensureSec(); flush(); target().push(b); return b; };
    const addText = (line) => { ensureSec(); code = null; callout = null; if (!textBlk) { textBlk = M().newBlock("text", { text: line }); target().push(textBlk); } else textBlk.text += "\n" + line; };
    const addCode = (line) => { ensureSec(); textBlk = null; callout = null; if (!code) { code = M().newBlock("console", { label: "", prompt: "", code: line, note: "" }); target().push(code); } else code.code += "\n" + line; };
    const startStep = (title, extra = {}) => {
      ensureSec(); flush();
      step = M().newStep({ title: cleanTitle(title) || "Step", ...extra });
      sec.steps.push(step); return step;
    };
    const addImages = (n) => (n.images || []).forEach((pth) => {
      if (parsed.images[pth]) lastImg = push(M().newBlock("image", { src: parsed.images[pth], caption: "" }));
      else push(M().newBlock("callout", { tone: "info", title: "Image not imported", text: `The Word document has an image here in a format browsers can't show (${(pth.split(".").pop() || "").toUpperCase()}). Paste a screenshot into this step to replace it.` }));
    });
    const shorten = (plain) => {
      if (!o.shorten || plain.length <= 90) return null;
      // first sentence end that isn't an abbreviation (i.e. / e.g. / ex. / etc.) or inside brackets
      let depth = 0;
      for (let k = 0; k < Math.min(plain.length, 95); k++) {
        const ch = plain[k];
        if (ch === "(" || ch === "[") depth++; else if ((ch === ")" || ch === "]") && depth) depth--;
        if (depth || !/[.:;!?]/.test(ch) || k < 12 || !/\s/.test(plain[k + 1] || "")) continue;
        if (/\b(i\.e|e\.g|ex|etc|vs|approx|incl|no|min|max|dept|w\/o|w)\.?$/i.test(plain.slice(Math.max(0, k - 6), k + 1).replace(/\.$/, ""))) continue;
        return plain.slice(0, k).trim();
      }
      const cut = plain.slice(0, 80); return cut.slice(0, Math.max(40, cut.lastIndexOf(" "))) + "…";
    };
    const isCode = (n) => n.mono || CMD.test(n.plain) || (own && /^Proc(Code|Console)$/.test(n.style));
    const isPseudo = (n) => n.t === "p" && !n.list && n.allBold && !n.mono && n.plain.length <= 60 && !/[.!?,]$/.test(n.plain) && !(CALLOUT.test(n.plain) && n.plain.replace(CALLOUT, "").trim()) && !n.images.length;
    const nextReal = (i) => { for (let j = i + 1; j < nodes.length; j++) if (nodes[j].t !== "gap") return nodes[j]; return null; };
    const calloutFrom = (n) => {
      const md = segsToMd(n.segs, { noBold: n.allBold }).trim();
      const m = n.plain.match(CALLOUT); const key = m[1].toLowerCase();
      const txt = md.replace(/^\**\s*/, "").replace(CALLOUT, "").replace(/^\**\s*/, "").trim();
      return M().newBlock("callout", { tone: TONE[key] || "info", title: key.replace(/\b\w/g, (c) => c.toUpperCase()), text: txt });
    };
    // Minimum list level per heading-delimited group → that level becomes steps
    const minLvl = []; let grp = 0; const lv = {};
    nodes.forEach((n, i) => { if (n.t === "h" || n.t === "title") grp++; minLvl[i] = grp; if (n.t === "p" && n.list && !isCode(n) && !CALLOUT.test(n.plain)) lv[grp] = Math.min(lv[grp] ?? 9, n.list.ilvl); });
    const levels = [...new Set(nodes.filter((n) => n.t === "h" && n.level > 0).map((n) => n.level))].sort();
    const stepHeading = o.mode === "heading" ? levels[levels.length - 1] : null;

    nodes.forEach((n, i) => {
      if (n.t === "gap") return;
      if (n.t === "h") {
        if (own && n.level === -1) { skipFront = true; return; }
        skipFront = false;
        if (o.mode === "heading" && n.level === stepHeading) { if (!sec) addSec(levels.length > 1 ? "Steps" : "Steps"); startStep(n.plain); return; }
        addSec(own ? n.plain.replace(/^\d+\.\s+/, "").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s*\(after cutover\)\s*$/, "") : n.plain);
        return;
      }
      if (skipFront) return;
      if (n.t === "table") {
        if (n.caption === "ProcMeta") return;
        n.images.forEach((pth) => parsed.images[pth] && push(M().newBlock("image", { src: parsed.images[pth], caption: "" })));
        if (n.mono) { flush(); addCode(n.rows[0][0]); return; }
        if (n.rows.length) push(M().newBlock("table", { header: n.rows.length > 1, rows: n.rows.map((r) => r.join(" | ")).join("\n") }));
        return;
      }
      if (n.t !== "p") return;
      // Our own export: explicit step / meta / caption styles
      if (own && n.style === "ProcStep") {
        const num = (n.plain.match(/^\s*(\d+[a-z]?)[.)]/) || [])[1];
        startStep(n.plain.replace(/\s*☐\s*$/, ""), num ? { num } : {}); return;
      }
      if (own && n.style === "ProcMeta" && step) {
        n.plain.split(" · ").forEach((part) => {
          const [k, ...rest] = part.split(":"); const v = rest.join(":").trim();
          if (/^owner$/i.test(k)) step.owner = v; else if (/^category$/i.test(k)) step.category = v; else if (/^escalation$/i.test(k)) step.contact = v; else if (/^when$/i.test(k)) step.window = v;
          else if (/^target$/i.test(k)) { step.target = "custom"; step.targetLabel = v.replace(/\s*\((role|fixed)\)$/, ""); }
          else if (/^est\. (\d+) min/i.test(part)) step.estMin = Number(part.match(/(\d+)/)[1]);
          else if (/critical/i.test(part)) step.critical = true; else if (/^hold point/i.test(part)) step.hold = true; else if (/parallel/i.test(part)) step.parallel = true;
        });
        return;
      }
      if (/^caption$/i.test(n.styleName) && lastImg && !lastImg.caption) { lastImg.caption = n.plain; return; }
      if (own && n.style === "ProcCallout" && callout) { callout.text += "\n" + segsToMd(n.segs).trim(); return; }

      if (CALLOUT.test(n.plain) && !isCode(n) && (n.plain.replace(CALLOUT, "").trim() || n.images.length)) {
        const b = push(calloutFrom(n));
        if (own && /:$/.test(b.text) && !b.text.includes("\n") && nextReal(i) && nextReal(i).style === "ProcCallout") { b.title = b.text.replace(/:$/, ""); b.text = ""; }
        callout = b; addImages(n); return;
      }
      if (isCode(n) && !n.images.length) {
        const raw = n.raw.replace(/\u00a0/g, " ").replace(/\s+$/, "");
        if (own && n.style === "ProcConsole" && /^▣ /.test(raw) && !code) { flush(); code = push(M().newBlock("console", { label: raw.slice(2).trim(), prompt: "", code: "", note: "" })); code.code = null; return; }
        if (code && code.code === null) { code.code = raw; return; }
        addCode(raw); return;
      }
      if (n.list && (o.mode === "heading" || (own && step))) {
        segsToMd(n.segs).trim().split("\n").forEach((ln, k) => ln.trim() && addText(k ? ln.trim() : `${"-".repeat(Math.min(4, n.list.ilvl + 1))} ${ln.trim()}`));
        addImages(n); return;
      }
      if (n.list) {
        const base = lv[minLvl[i]] ?? 0;
        const depth = o.mode === "all" ? 0 : n.list.ilvl - base;
        if (depth <= 0) {
          const plain = n.plain.replace(/\s+/g, " ");
          const short = shorten(plain);
          const md = segsToMd(n.segs, { noBold: n.allBold }).trim();
          startStep(short || plain);
          if (short || /\]\(/.test(md)) addText(md);
          addImages(n); return;
        }
        segsToMd(n.segs, { noBold: n.allBold && n.plain.length < 50 }).trim().split("\n").forEach((ln, k) => ln.trim() && addText(k ? ln.trim() : `${"-".repeat(Math.min(4, depth))} ${ln.trim()}`));
        addImages(n); return;
      }
      if (!own && isPseudo(n)) {
        const nx = nextReal(i);
        const opensList = nx && ((nx.t === "p" && nx.list && !isCode(nx) && !CALLOUT.test(nx.plain)) || isPseudo(nx) || nx.t === "h");
        if (o.mode === "heading") { startStep(n.plain); return; }
        if (opensList) { addSec(n.plain); return; }
        startStep(n.plain); return;
      }
      if (n.plain) segsToMd(n.segs, { noBold: n.allBold && n.plain.length > 80 }).trim().split("\n").forEach((ln) => ln.trim() && addText(ln.trim()));
      addImages(n);
    });

    // Section intros: plain text → description; anything richer becomes an "Overview" step at the top
    p.sections.forEach((s) => {
      const intro = s._intro || []; delete s._intro;
      s.steps.forEach((x) => x.blocks.forEach((b) => { if (b.type === "console" && b.code == null) b.code = ""; }));
      if (!intro.length) return;
      if (s.steps.length && intro.every((b) => b.type === "text")) { s.description = intro.map((b) => b.text.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")).join("\n"); return; }
      if (!s.steps.length && s.title === "Steps") s.title = "Overview";
      s.steps.unshift(M().newStep({ title: s.steps.length ? "Overview" : s.title, category: "Review", required: false, blocks: intro }));
    });
    p.sections = p.sections.filter((s) => s.steps.length);
    if (!p.sections.length) p.sections.push(M().newSection({ title: "Steps", steps: [M().newStep({ title: "First step" })] }));
    M().renumber(p);
    return M().normalize(p);
  }

  /* ======================= IMPORT UI ======================= */
  async function open() {
    const f = await pickFile(".docx,.docm,.dotx");
    if (!f) return;
    let parsed;
    try { parsed = await readDocx(await f.arrayBuffer(), f.name); }
    catch (e) { console.error(e); return toast(/\.doc$/i.test(f.name) ? "Old .doc files aren't supported — open it in Word and Save As .docx" : e.message || "Couldn't read that file", "err", 6000); }
    mapping(parsed);
  }

  function mapping(parsed) {
    const st = { title: parsed.title, mode: "list", shorten: true, restore: parsed.payload && !parsed.payload.edited ? "exact" : "rebuild" };
    let result = null;
    const body = h("div.imp");
    const draw = () => {
      result = st.restore === "exact" && parsed.payload ? M().normalize(JSON.parse(JSON.stringify(parsed.payload.procedure))) : build(parsed, st);
      if (st.restore !== "exact") result.title = st.title;
      const steps = M().allSteps(result);
      const imgs = steps.reduce((a, { step }) => a + step.blocks.filter((b) => b.type === "image").length, 0);
      const pl = parsed.payload;
      body.innerHTML = "";
      body.append(
        pl ? h("div.word-payload",
          h("div", h("b", "This file was exported from Procedure Runner"), ` — ${pl.procedure.title} · ${pl.version || ""} · exported ${fmtDateTime(pl.exportedAt)}${pl.exportedBy ? " by " + pl.exportedBy : ""}`),
          h("div.small.muted", pl.edited ? "The text was changed in Word since then, so rebuilding from the document keeps those edits." : "It hasn't been edited since, so it can be restored exactly — environments, chairs, decisions, timers and all."),
          h("div.seg", [["exact", "Restore exactly as exported"], ["rebuild", "Rebuild from the Word text"]].map(([v, l]) =>
            h(`button.seg-btn${st.restore === v ? ".on" : ""}`, { type: "button", onclick: () => { st.restore = v; draw(); } }, l)))) : null,
        st.restore === "exact" && pl ? null : [
          h("div.frow",
            h("div.field.grow", h("label.lbl", "Procedure name"), h("input.inp", { value: st.title, oninput: (e) => (st.title = e.target.value), onchange: draw })),
            h("div.field", h("label.lbl", "Steps come from"), h("select.inp", { onchange: (e) => { st.mode = e.target.value; draw(); } },
              [["list", "Top-level numbered / bulleted items (sub-items become bullets)"], ["all", "Every numbered / bulleted item"], ["heading", "Each heading (one step per heading)"]].map(([v, l]) => h("option", { value: v, selected: st.mode === v }, l))))),
          h("label.ck", h("input", { type: "checkbox", checked: st.shorten, onchange: (e) => { st.shorten = e.target.checked; draw(); } }), " Long items: use the first sentence as the step title and keep the full text as details"),
          h("div.help", "Headings become sections. NOTE! / IMPORTANT! / TIP! / KNOWN ISSUE paragraphs become callouts, Consolas or command text becomes a console block, and tables and screenshots come along. Nothing is lost — anything that isn't a step is kept as text on the nearest step.")],
        h("div.ins-sec", `Preview — ${result.sections.length} sections · ${steps.length} steps${imgs ? ` · ${imgs} screenshots` : ""}`),
        parsed.skipped ? h("div.help", `⚠ ${parsed.skipped} image(s) in a format browsers can't show (EMF/WMF/TIFF) were skipped — paste them in as screenshots if you need them.`) : null,
        h("div.imp-prev.word-outline", result.sections.map((s) => h("div.wo-sec", h("div.wo-sec-h", s.title, h("span.muted", ` · ${s.steps.length}`)),
          s.description ? h("div.small.muted.wo-desc", s.description.slice(0, 160)) : null,
          s.steps.slice(0, 60).map((x) => h("div.wo-step", h("span.wo-n", x.num), h("span", x.title),
            x.blocks.length ? h("span.wo-blocks", x.blocks.map((b) => (PR.blocks.def(b.type) || {}).icon || "•").join(" ")) : null)),
          s.steps.length > 60 ? h("div.small.muted", `… ${s.steps.length - 60} more`) : null))));
    };
    draw();
    modal({
      title: "Import from Word", size: "xl", body, subtitle: "Map an existing Word procedure into steps you can run. You can tidy everything up in the builder afterwards.",
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Create procedure", kind: "primary", onClick: async () => {
        const p = st.restore === "exact" && parsed.payload ? M().normalize({ ...JSON.parse(JSON.stringify(parsed.payload.procedure)), id: uid("proc") }) : result;
        await PR.app.saveNewProcedure(p);
        toast(`Imported ${M().allSteps(p).length} steps — review them in the builder`, "ok", 4000);
      } }],
    });
  }

  /* ======================= WRITE ======================= */
  const BRAND = { gray: "53575A", blue: "00B2E3", navy: "00538B", lunar: "CFD2D3", muted: "6B7075", font: "Calibri", mono: "Consolas" };
  const PAGE_W = 10080, IND = 567; // text width (dxa) with 0.75" margins; step/body indent
  const esc = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function writer(firstPic = 1) {
    const rels = []; const media = []; let nextId = 1; let pic = firstPic;
    const rel = (type, target, external) => { const id = `rId${100 + nextId++}`; rels.push({ id, type, target, external }); return id; };
    const linkRel = {};
    const link = (url) => linkRel[url] || (linkRel[url] = rel("hyperlink", url, true));
    return { rels, media, rel, link, picId: () => pic++ };
  }
  function rPr(f = {}) {
    let x = "";
    if (f.style) x += `<w:rStyle w:val="${f.style}"/>`;
    if (f.mono) x += `<w:rFonts w:ascii="${BRAND.mono}" w:hAnsi="${BRAND.mono}" w:cs="${BRAND.mono}"/>`;
    if (f.b) x += "<w:b/>"; if (f.i) x += "<w:i/>"; if (f.caps) x += "<w:caps/>";
    if (f.color) x += `<w:color w:val="${f.color}"/>`;
    if (f.sz) x += `<w:sz w:val="${f.sz}"/><w:szCs w:val="${f.sz}"/>`;
    if (f.u) x += '<w:u w:val="single"/>';
    if (f.shd) x += `<w:shd w:val="clear" w:color="auto" w:fill="${f.shd}"/>`;
    return x ? `<w:rPr>${x}</w:rPr>` : "";
  }
  function run(text, f = {}) {
    const parts = String(text ?? "").split(/(\n|\t)/);
    return `<w:r>${rPr(f)}${parts.map((t) => (t === "\n" ? "<w:br/>" : t === "\t" ? "<w:tab/>" : t ? `<w:t xml:space="preserve">${esc(t)}</w:t>` : "")).join("")}</w:r>`;
  }
  /* inline markdown → runs (bold, italic, `code`, links, bare URLs, {{variables}}) */
  function inlineRuns(wr, s, base = {}) {
    const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((?:https?:|mailto:)[^)\s]+\))|((?:https?:\/\/)[^\s<)]+)|(\{\{\s*[\w.]+\s*\}\})/g;
    let out = "", last = 0, m;
    const str = String(s ?? "");
    while ((m = re.exec(str))) {
      if (m.index > last) out += run(str.slice(last, m.index), base);
      const t = m[0];
      if (m[1]) out += run(t.slice(1, -1), { ...base, mono: true, shd: "EEF0F1" });
      else if (m[2]) out += run(t.slice(2, -2), { ...base, b: true });
      else if (m[3]) out += run(t.slice(1, -1), { ...base, i: true });
      else if (m[4]) { const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/); out += `<w:hyperlink r:id="${wr.link(mm[2])}">${run(mm[1], { ...base, style: "Hyperlink" })}</w:hyperlink>`; }
      else if (m[5]) out += `<w:hyperlink r:id="${wr.link(t)}">${run(t, { ...base, style: "Hyperlink" })}</w:hyperlink>`;
      else if (m[6]) out += run(t, { ...base, color: BRAND.navy, b: true });
      last = m.index + t.length;
    }
    if (last < str.length) out += run(str.slice(last), base);
    return out;
  }
  function para(inner, o = {}) {
    let pp = "";
    if (o.style) pp += `<w:pStyle w:val="${o.style}"/>`;
    if (o.keepNext) pp += "<w:keepNext/>";
    if (o.num) pp += `<w:numPr><w:ilvl w:val="${o.num.ilvl}"/><w:numId w:val="${o.num.id}"/></w:numPr>`;
    if (o.border) pp += `<w:pBdr>${o.border}</w:pBdr>`;
    if (o.shd) pp += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
    if (o.tabs) pp += `<w:tabs>${o.tabs}</w:tabs>`;
    if (o.spacing) pp += `<w:spacing ${o.spacing}/>`;
    if (o.ind != null) pp += `<w:ind w:left="${o.ind}"${o.hanging ? ` w:hanging="${o.hanging}"` : ""}/>`;
    if (o.jc) pp += `<w:jc w:val="${o.jc}"/>`;
    return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ""}${inner || ""}</w:p>`;
  }
  /* markdown text block → paragraphs; - / -- bullets use the bullet list, ``` fences become console text */
  function mdParas(wr, src, ind = IND) {
    const out = []; let fence = null;
    for (const raw of String(src || "").replace(/\r/g, "").split("\n")) {
      if (/^\s*```/.test(raw)) { if (fence) { fence.forEach((l, i) => out.push(consoleLine(l, i === 0, i === fence.length - 1, ind))); fence = null; } else fence = []; continue; }
      if (fence) { fence.push(raw); continue; }
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) continue;
      const b = line.match(/^\s*(-{1,4}|\*|•)\s+(.*)$/);
      if (b) { const lvl = b[1][0] === "-" ? b[1].length : 1; out.push(para(inlineRuns(wr, b[2]), { style: "ProcBody", num: { id: 1, ilvl: lvl - 1 }, ind: ind + 360 * lvl, hanging: 360 })); continue; }
      const hd = line.match(/^#{1,3}\s+(.*)$/);
      out.push(para(inlineRuns(wr, hd ? hd[1] : line, hd ? { b: true } : {}), { style: "ProcBody", ind }));
    }
    if (fence) fence.forEach((l, i) => out.push(consoleLine(l, i === 0, i === fence.length - 1, ind)));
    return out.join("");
  }
  function consoleLine(text, first, last, ind = IND, dark = true) {
    return para(run(text || " ", { mono: true, sz: 18, color: dark ? "E6EDF3" : "1F2328" }), { style: dark ? "ProcConsole" : "ProcCode", ind, spacing: `w:before="${first ? 60 : 0}" w:after="${last ? 100 : 0}" w:line="240" w:lineRule="auto"` });
  }
  const box = (color, sz = 4) => ["top", "left", "bottom", "right"].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:space="4" w:color="${color}"/>`).join("");
  function tableXml(wr, rows, { header = true, widths, ind = IND, headFill = BRAND.gray } = {}) {
    const cols = Math.max(1, ...rows.map((r) => r.length));
    const total = PAGE_W - ind;
    const ws = widths || Array.from({ length: cols }, () => Math.floor(total / cols));
    const cell = (txt, w, head) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? `<w:shd w:val="clear" w:color="auto" w:fill="${headFill}"/>` : ""}</w:tcPr>${para(head ? run(txt, { b: true, color: "FFFFFF", sz: 18 }) : inlineRuns(wr, txt, { sz: 18 }), { spacing: 'w:before="40" w:after="40"' })}</w:tc>`;
    return `<w:tbl><w:tblPr><w:tblStyle w:val="ProcTable"/><w:tblW w:w="${total}" w:type="dxa"/><w:tblInd w:w="${ind}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.map((r, i) => `<w:tr>${i === 0 && header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${Array.from({ length: cols }, (_, c) => cell(String(r[c] ?? ""), ws[c], i === 0 && header)).join("")}</w:tr>`).join("")}</w:tbl>${para("", { spacing: 'w:after="0"' })}`;
  }
  async function imageXml(wr, src, caption, maxW = 6.0, maxH = 7.0) {
    let blob;
    try {
      if (/^data:/.test(src)) blob = PR.u.dataURLToBlob(src);
      else { const u = await PR.store.resolveURL(src).catch(() => src); blob = await (await fetch(u)).blob(); }
    } catch (e) { blob = null; }
    if (!blob || !/^image\/(png|jpe?g|gif)$/.test(blob.type)) {
      try { if (blob && /^image\//.test(blob.type)) blob = PR.u.dataURLToBlob(await PR.u.compressImage(blob)); else blob = null; } catch (e) { blob = null; }
    }
    if (!blob) return para(run(`[Image${caption ? ": " + caption : ""}]`, { i: true, color: BRAND.muted }), { style: "ProcBody" });
    let w = 800, hgt = 600;
    try { const bmp = await createImageBitmap(blob); w = bmp.width; hgt = bmp.height; bmp.close && bmp.close(); } catch (e) {}
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/gif" ? "gif" : "jpeg";
    const n = wr.media.length + 1; const name = `media/image${n}.${ext}`;
    wr.media.push({ name: "word/" + name, data: new Uint8Array(await blob.arrayBuffer()) });
    const rid = wr.rel("image", name);
    const EMU = 914400; let cx = (w / 96) * EMU, cy = (hgt / 96) * EMU;
    const k = Math.min(1, (maxW * EMU) / cx, (maxH * EMU) / cy); cx = Math.round(cx * k); cy = Math.round(cy * k);
    const id = wr.picId();
    const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}" descr="${esc(caption || "")}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="image${n}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    return { xml: drawing, rid };
  }
  const CALLOUT_LABEL = { info: ["NOTE!", "E6F7FC", BRAND.blue], tip: ["TIP!", "EEF7EA", "6ABF4B"], warn: ["IMPORTANT!", "FFF6E0", "F2A900"], danger: ["WARNING!", "FDECEC", "D9363E"], success: ["SUCCESS:", "EEF7EA", "6ABF4B"] };

  async function blockXml(wr, b) {
    const L = (label, rest = "", base = {}) => para(run(label + " ", { b: true, color: BRAND.gray }) + inlineRuns(wr, rest, base), { style: "ProcBody" });
    switch (b.type) {
      case "text": return mdParas(wr, b.text);
      case "command": {
        const lines = String(b.code || "").split("\n");
        return (b.label ? para(run(b.label, { b: true, sz: 17, color: BRAND.muted }), { style: "ProcBody", keepNext: true }) : "") +
          lines.map((l, i) => consoleLine(l, i === 0, i === lines.length - 1, IND, b.display === "console")).join("") + (b.note ? para(inlineRuns(wr, b.note, { i: true }), { style: "ProcBody" }) : "");
      }
      case "console": {
        const lines = String(b.code || "").split("\n");
        return para(run("▣ " + (b.label || "Console"), { mono: true, sz: 16, color: "9AA4AE" }), { style: "ProcConsole", ind: IND, keepNext: true, spacing: 'w:before="60" w:after="0"' }) +
          lines.map((l, i) => consoleLine(l, false, i === lines.length - 1)).join("") + (b.note ? para(inlineRuns(wr, b.note, { i: true }), { style: "ProcBody" }) : "");
      }
      case "path": { const parts = String(b.trail || "").split("\n").map((s) => s.trim()).filter(Boolean); return para((b.label ? run(b.label + " ", { color: BRAND.muted }) : "") + parts.map((x, i) => (i ? run(" → ", { color: BRAND.muted }) : "") + run(x, { b: true })).join(""), { style: "ProcBody" }); }
      case "callout": {
        let [lbl, fill, edge] = CALLOUT_LABEL[b.tone] || CALLOUT_LABEL.info;
        // A title that is itself a label (Note, Known issue…) becomes the label, like "KNOWN ISSUE: …" in the old documents
        if (b.title && new RegExp(`^(${Object.keys(TONE).join("|")})$`, "i").test(b.title.trim())) { lbl = b.title.trim().replace(/^notes$/i, "Note").toUpperCase() + (/issue/i.test(b.title) ? ":" : "!"); b = { ...b, title: "" }; }
        const lines = String(b.text || "").split("\n").filter((l) => l.trim());
        const o = { style: "ProcCallout", shd: fill, border: `<w:left w:val="single" w:sz="24" w:space="6" w:color="${edge}"/>` };
        const first = b.title ? [run(lbl + " ", { b: true }) + run(b.title + (lines.length ? ":" : ""), { b: true })] : [run(lbl + " ", { b: true }) + inlineRuns(wr, (lines.shift() || "").replace(/^\s*-+\s+/, "• "))];
        return [...first, ...lines.map((l) => inlineRuns(wr, l.replace(/^\s*(-+)\s+/, (m, d) => "    ".repeat(d.length - 1) + "• ")))].map((r) => para(r, o)).join("");
      }
      case "link": return para(run("🔗 ") + `<w:hyperlink r:id="${wr.link(b.url || "#")}">${run(b.label || b.url, { style: "Hyperlink" })}</w:hyperlink>` + (b.note ? run(" — " + b.note, { color: BRAND.muted }) : ""), { style: "ProcBody" });
      case "image": {
        if (!b.src) return "";
        const im = await imageXml(wr, b.src, b.caption);
        if (typeof im === "string") return im;
        return para(im.xml, { style: "ProcBody", keepNext: !!b.caption }) + (b.caption ? para(run(b.caption), { style: "Caption", ind: IND }) : "");
      }
      case "table": { const rows = String(b.rows || "").split("\n").filter((l) => l.trim()).map((l) => l.split("|").map((c) => c.trim())); return rows.length ? tableXml(wr, rows, { header: b.header !== false }) : ""; }
      case "divider": return para("", { style: "ProcBody", border: `<w:bottom w:val="single" w:sz="6" w:space="1" w:color="${BRAND.lunar}"/>` });
      case "checklist": return (b.title ? para(run(b.title, { b: true }), { style: "ProcBody", keepNext: true }) : "") + (b.items || []).map((it) => para(run("☐  ") + inlineRuns(wr, it.text), { style: "ProcBody", ind: IND + 280, hanging: 280 })).join("");
      case "input": return L("✎ Record:", `**${b.label || "Value"}**${b.variable ? ` ({{var.${b.variable}}})` : ""}  ______________________${b.help ? "  — " + b.help : ""}`);
      case "evidence": return L("📎 Evidence:", `${b.label || "Attach evidence"}${b.required ? " (required)" : ""}`);
      case "confirm": return L("⌨ Type to confirm:", `${b.label || ""} — \`${b.phrase || ""}\``);
      case "contact": return L("☎ Contact:", `**${b.who || ""}**${b.detail ? ` (${b.method || ""}: ${b.detail})` : ""}${b.request ? " — " + b.request : ""}${b.requireConfirmation ? "   ☐ Confirmed" : ""}`);
      case "validation": return L("✔ Validate:", `**${b.test || ""}**`) + para(run("Expected: ", { color: BRAND.muted }) + inlineRuns(wr, b.expected || "") + run("     Actual: ____________     ☐ Pass   ☐ Fail", { color: BRAND.muted }), { style: "ProcBody" });
      case "decision": return L("⚖ Go / No-Go:", `**${b.question || ""}**`) + mdParas(wr, b.criteria) + para(run(`Decision maker: ${b.decisionMaker || "—"} · If NO-GO: ${b.noGo === "halt" ? "halt the run" : b.noGo || "halt"}      ☐ GO    ☐ NO-GO`, { color: BRAND.muted }), { style: "ProcBody" });
      case "approval": return L("✍ Approval:", `${b.label || ""} — ${b.approverRole || "Approver"}: ____________________   Date: __________`);
      case "timer": return L("⏱ Wait:", `${b.label || ""} — ${b.minutes || 0} min${b.autoStart !== false ? " (starts with the step)" : ""}${b.required ? " — must run to the end; finishing early needs a reason" : ""}`);
      default: { const d = PR.blocks.def(b.type); return d ? L(`${d.icon || "•"} ${d.label}:`, "") : ""; }
    }
  }

  async function buildDocx(src) {
    const { p, verLabel, modBy, modAt, doc } = src;
    const cfg = await PR.comms.load().catch(() => ({}));
    const wr = writer();
    const env = p.environments; const tracks = M().tracks(p); const steps = M().allSteps(p);
    const H = (t) => para(run(t), { style: "ProcFront" });
    const parts = [];
    parts.push(para(run(p.title), { style: "Title" }));
    if (p.description) parts.push(para(inlineRuns(wr, p.description), { style: "Subtitle" }));
    const est = M().estimateMinutes(p);
    parts.push(tableXml(wr, [
      ["Version", verLabel, "Status", doc.status || "draft"],
      ["Last modified by", modBy || "—", "Last modified", fmtDateTime(modAt)],
      ["Exported", `${fmtDateTime(now())} by ${PR.app.me || ""}`, "Steps", `${steps.length}${est ? " · est. " + fmtMin(est) : ""}`],
      ...((p.tags || []).length ? [["Tags", p.tags.join(", "), "", ""]] : []),
    ], { header: false, ind: 0, widths: [1800, 3240, 1800, 3240] }).replace("</w:tblPr>", '<w:tblCaption w:val="ProcMeta"/></w:tblPr>'));
    parts.push(H("Contents"));
    let n0 = 0;
    p.sections.forEach((s, i) => { const a = n0 + 1; n0 += s.steps.length; parts.push(para(run(`${i + 1}.  ${s.title}`) + run(`\t${s.steps.length ? (a === n0 ? `step ${a}` : `steps ${a}–${n0}`) : "—"}`, { color: BRAND.muted }), { style: "ProcBody", ind: 0, tabs: `<w:tab w:val="right" w:leader="dot" w:pos="${PAGE_W}"/>` })); });
    if (env.enabled) {
      parts.push(H("Environments"));
      parts.push(tableXml(wr, [["Datacenter", "Code", "HMC partition (fixed)", "HMC URL"], ...M().sites(p).map((s) => [s.name, s.code, s.partition || "—", s.hmc || ""])], { ind: 0 }));
      if (env.directional) parts.push(para(run("Role mapping by direction", { b: true }), { style: "ProcBody", ind: 0, keepNext: true }),
        tableXml(wr, [["Direction", ...M().sites(p).map((s) => s.name)], ...M().sites(p).map((ps) => [`${ps.name} → ${(M().otherSite(p, ps.id) || {}).name}`, ...M().sites(p).map((s) => { const r = env.roles[s.id === ps.id ? "primary" : "secondary"]; return `${r.pre} → ${r.post}`; })])], { ind: 0 }));
    }
    if (tracks.length) { parts.push(H("Chairs")); parts.push(tableXml(wr, [["Chair", "Responsible for", "Steps"], ...tracks.map((t) => [t.name, t.desc || "", String(steps.filter(({ step, section }) => M().trackOf(step, section) === t.id).length)])], { ind: 0, widths: [2600, 6080, 1400] })); }
    if (p.setup.readiness.length || p.setup.milestones.length) {
      parts.push(H("Run setup"));
      if (p.setup.readiness.length) parts.push(para(run("Readiness checklist", { b: true }), { style: "ProcBody", ind: 0, keepNext: true }), ...p.setup.readiness.map((r) => para(run("☐  " + r.label), { style: "ProcBody", ind: 280 })));
      if (p.setup.milestones.length) parts.push(para(run("Completion milestones", { b: true }), { style: "ProcBody", ind: 0, keepNext: true }), ...p.setup.milestones.map((r) => para(run("☐  " + r.label), { style: "ProcBody", ind: 280 })));
    }
    if (M().hasImpact(p)) {
      parts.push(H(M().impactName(p)));
      steps.filter(({ step }) => step.impact && step.impact.mark).forEach(({ step }) => parts.push(para(run(step.impact.mark === "down" ? "🔴 Members impacted " : "🟢 Service restored ") + run(step.impact.on === "start" ? "when step " : "after step ") + run(`${step.num} ${step.title}`, { b: true }) + run(step.impact.on === "start" ? " starts" : " completes"), { style: "ProcBody", ind: 0 })));
    }
    const role = (step, section) => {
      const t = step.target || "none";
      if (t === "none") return "";
      if (t === "primary" || t === "secondary") { const r = env.roles[t]; return `${M().phaseOf(step, section) === "post" ? r.post : r.pre} (role)`; }
      if (t === "both") return "Both sites";
      if (t === "custom") return step.targetLabel || "Other";
      if (t.startsWith("site:")) { const s = M().siteById(p, t.slice(5)); return s ? `${s.name} (fixed)` : ""; }
      return "";
    };
    for (const [si, section] of p.sections.entries()) {
      const tk = M().trackById(p, section.track);
      parts.push(para(run(`${si + 1}. ${section.title}`) + (tk ? run(`  [${tk.name}]`, { color: BRAND.muted, sz: 20 }) : "") + (section.phase === "post" && env.directional ? run("  (after cutover)", { color: "B07800", sz: 20 }) : ""), { style: "Heading2" }));
      if (section.description) parts.push(mdParas(wr, section.description, 0));
      for (const step of section.steps) {
        const t = M().trackById(p, M().trackOf(step, section));
        const meta = [role(step, section) && `Target: ${role(step, section)}`, t && `Chair: ${t.name}`, step.owner && `Owner: ${step.owner}`, step.contact && `Escalation: ${step.contact}`, step.window && `When: ${step.window}`, step.estMin && `Est. ${step.estMin} min`,
          step.parallel && "Runs in parallel with previous", step.hold && "Hold point", step.critical && "★ Critical", step.category && `Category: ${step.category}`,
          step.condition && `Only when ${(M().siteById(p, step.condition.slice(4)) || {}).name} is primary`,
          step.waitFor && `Waits for step ${(M().findStep(p, step.waitFor) || { step: {} }).step.num}`,
          step.impact && step.impact.mark && (step.impact.mark === "down" ? "🔴 Starts member impact" : "🟢 Ends member impact")].filter(Boolean);
        parts.push(para(run(`${step.num || "•"}.\t`, { color: BRAND.navy }) + inlineRuns(wr, step.title) + run("\t☐", { b: false, color: BRAND.muted }), { style: "ProcStep", keepNext: !!(meta.length || step.blocks.length) }));
        if (meta.length) parts.push(para(run(meta.join(" · ")), { style: "ProcMeta", keepNext: !!step.blocks.length }));
        for (const b of step.blocks || []) parts.push(await blockXml(wr, b));
      }
    }

    // Header (grey band like the department's controlled documents) and footer
    const hw = writer(9000); // header has its own relationships (logo); picture ids must not clash with the body's
    let logo = "";
    if (cfg.logo) { const im = await imageXml(hw, cfg.logo, "Logo", 1.6, 0.42).catch(() => null); if (im && typeof im !== "string") logo = para(im.xml, { spacing: 'w:after="40"' }); }
    hw.media.forEach((m) => (m.name = m.name.replace("word/media/", "word/media/h")));
    hw.rels.forEach((r) => (r.target = r.target.replace("media/", "media/h")));
    const hc = (txt, sub, fill, w, merge) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${merge ? `<w:vMerge${merge === "restart" ? ' w:val="restart"' : ""}/>` : ""}<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${txt}${sub || ""}</w:tc>`;
    const small = (label, value, fill) => para(run(label, { color: "FFFFFF", sz: 14 }) + (value ? run("\n" + value, { color: "FFFFFF", sz: 18, b: true }) : ""), { jc: "right", spacing: 'w:before="20" w:after="20"' });
    const left = logo + para(run((cfg.teamName || cfg.orgName || "IT Department").toUpperCase(), { color: "FFFFFF", sz: 16, b: true }), { spacing: 'w:after="20"' }) +
      para(run(p.title.toUpperCase(), { color: "FFFFFF", sz: 26, b: true }), { spacing: 'w:after="0"' });
    const headerXml = `${XML_HEAD}<w:hdr ${NS}><w:tbl><w:tblPr><w:tblW w:w="${PAGE_W}" w:type="dxa"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="8" w:space="0" w:color="FFFFFF"/>`).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${PAGE_W - 2300}"/><w:gridCol w:w="2300"/></w:tblGrid>` +
      `<w:tr>${hc(left, "", BRAND.gray, PAGE_W - 2300, "restart")}${hc(small("Version", verLabel.replace(/\s*\(.*\)/, "")), "", BRAND.navy, 2300)}</w:tr>` +
      `<w:tr>${hc(para(""), "", BRAND.gray, PAGE_W - 2300, "continue")}${hc(small("Rev. Date", fmtDate(modAt)), "", BRAND.gray, 2300)}</w:tr>` +
      `<w:tr>${hc(para(""), "", BRAND.gray, PAGE_W - 2300, "continue")}${hc(small("Last modified by", modBy || "—"), "", BRAND.gray, 2300)}</w:tr></w:tbl>${para("", { spacing: 'w:after="0"' })}</w:hdr>`;
    const fld = (code) => `<w:r>${rPr({ b: true, color: BRAND.navy, sz: 16 })}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rPr({ b: true, color: BRAND.navy, sz: 16 })}<w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r>${rPr({ b: true, color: BRAND.navy, sz: 16 })}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${rPr({ b: true, color: BRAND.navy, sz: 16 })}<w:t>1</w:t></w:r><w:r>${rPr({ b: true, color: BRAND.navy, sz: 16 })}<w:fldChar w:fldCharType="end"/></w:r>`;
    const footerXml = `${XML_HEAD}<w:ftr ${NS}>${para(run(`${p.title} · ${verLabel.replace(/\s*\(.*\)/, "")} · last modified by ${modBy || "unknown"} ${fmtDate(modAt)}`, { color: BRAND.muted, sz: 16 }) + run("\t") + run("Page ", { color: BRAND.muted, sz: 16 }) + fld("PAGE") + run(" of ", { color: BRAND.muted, sz: 16 }) + fld("NUMPAGES"),
      { border: `<w:top w:val="single" w:sz="12" w:space="6" w:color="${BRAND.blue}"/>`, tabs: `<w:tab w:val="right" w:pos="${PAGE_W}"/>`, spacing: 'w:after="0"' })}</w:ftr>`;

    const hdrId = wr.rel("header", "header1.xml"), ftrId = wr.rel("footer", "footer1.xml");
    const bodyXml = parts.join("");
    const documentXml = `${XML_HEAD}<w:document ${NS}><w:body>${bodyXml}<w:sectPr><w:headerReference w:type="default" r:id="${hdrId}"/><w:footerReference w:type="default" r:id="${ftrId}"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="2160" w:right="1080" w:bottom="1080" w:left="1080" w:header="360" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    const payload = { kind: "procedure-runner/word", version: verLabel, exportedAt: now(), exportedBy: PR.app.me || "", textHash: textFingerprint(documentXml), procedure: p };
    const payloadText = JSON.stringify(payload);
    const withPayload = payloadText.length < 12e6;
    if (withPayload) wr.rel("customXml", "../customXml/item1.xml");

    const enc = new TextEncoder();
    const files = [
      ["[Content_Types].xml", contentTypes(withPayload)],
      ["_rels/.rels", `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
      ["docProps/core.xml", `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(p.title)}</dc:title><dc:subject>${esc(verLabel)}</dc:subject><dc:creator>${esc(modBy || "")}</dc:creator><cp:lastModifiedBy>${esc(modBy || "")}</cp:lastModifiedBy><cp:keywords>${esc((p.tags || []).join(", "))}</cp:keywords><dc:description>${esc(p.description || "")}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(doc.createdAt || modAt || now()).toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date(modAt || now()).toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:modified></cp:coreProperties>`],
      ["docProps/app.xml", `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Procedure Runner</Application><Company>${esc(cfg.orgName || "")}</Company></Properties>`],
      ["word/document.xml", documentXml],
      ["word/styles.xml", stylesXml()],
      ["word/numbering.xml", numberingXml()],
      ["word/settings.xml", `${XML_HEAD}<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`],
      ["word/header1.xml", headerXml],
      ["word/footer1.xml", footerXml],
      ["word/_rels/document.xml.rels", relsXml([{ id: "rId1", type: "styles", target: "styles.xml" }, { id: "rId2", type: "numbering", target: "numbering.xml" }, { id: "rId3", type: "settings", target: "settings.xml" }, ...wr.rels])],
      ["word/_rels/header1.xml.rels", relsXml(hw.rels)],
    ];
    if (withPayload) files.push(
      ["customXml/item1.xml", `${XML_HEAD}<procedure xmlns="${PAYLOAD_NS}">${esc(payloadText)}</procedure>`],
      ["customXml/itemProps1.xml", `${XML_HEAD}<ds:datastoreItem ds:itemID="{${guid()}}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="${PAYLOAD_NS}"/></ds:schemaRefs></ds:datastoreItem>`],
      ["customXml/_rels/item1.xml.rels", `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/></Relationships>`]);
    const entries = files.map(([name, s]) => ({ name, data: enc.encode(s) }));
    [...wr.media, ...hw.media].forEach((m) => entries.push({ ...m, stored: true }));
    return zip(entries);
  }

  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const NS = `xmlns:w="${W}" xmlns:r="${RNS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
  const guid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16).toUpperCase(); });
  const REL_TYPES = { styles: "officeDocument/2006/relationships/styles", numbering: "officeDocument/2006/relationships/numbering", settings: "officeDocument/2006/relationships/settings", header: "officeDocument/2006/relationships/header", footer: "officeDocument/2006/relationships/footer", image: "officeDocument/2006/relationships/image", hyperlink: "officeDocument/2006/relationships/hyperlink", customXml: "officeDocument/2006/relationships/customXml" };
  const relsXml = (list) => `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((r) => `<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/${REL_TYPES[r.type]}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ""}/>`).join("")}</Relationships>`;
  const contentTypes = (payload) => `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>` +
    [["/word/document.xml", "wordprocessingml.document.main"], ["/word/styles.xml", "wordprocessingml.styles"], ["/word/numbering.xml", "wordprocessingml.numbering"], ["/word/settings.xml", "wordprocessingml.settings"], ["/word/header1.xml", "wordprocessingml.header"], ["/word/footer1.xml", "wordprocessingml.footer"], ["/docProps/app.xml", "extended-properties"], ...(payload ? [["/customXml/itemProps1.xml", "customXmlProperties"]] : [])]
      .map(([pn, t]) => `<Override PartName="${pn}" ContentType="application/vnd.openxmlformats-officedocument.${t}+xml"/>`).join("") +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

  function stylesXml() {
    const F = BRAND.font;
    const st = (type, id, name, pPr, rPr, extra = "") => `<w:style w:type="${type}" w:styleId="${id}"${id === "Normal" ? ' w:default="1"' : ""}><w:name w:val="${name}"/>${extra}${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}</w:style>`;
    const based = (b, next) => `<w:basedOn w:val="${b}"/>${next ? `<w:next w:val="${next}"/>` : ""}<w:qFormat/>`;
    return `${XML_HEAD}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:eastAsia="${F}" w:cs="${F}"/><w:color w:val="2B2E30"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      st("paragraph", "Normal", "Normal", "", "", "<w:qFormat/>") +
      st("paragraph", "Title", "Title", `<w:pBdr><w:bottom w:val="single" w:sz="18" w:space="4" w:color="${BRAND.blue}"/></w:pBdr><w:spacing w:before="0" w:after="160"/>`, `<w:b/><w:color w:val="${BRAND.gray}"/><w:sz w:val="44"/><w:szCs w:val="44"/>`, based("Normal", "Normal")) +
      st("paragraph", "Subtitle", "Subtitle", '<w:spacing w:after="160"/>', `<w:i/><w:color w:val="${BRAND.muted}"/><w:sz w:val="22"/>`, based("Normal", "Normal")) +
      st("paragraph", "Heading1", "heading 1", '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/>', `<w:b/><w:color w:val="${BRAND.gray}"/><w:sz w:val="32"/>`, based("Normal", "Normal")) +
      st("paragraph", "Heading2", "heading 2", `<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="${BRAND.lunar}"/></w:pBdr><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="1"/>`, `<w:b/><w:color w:val="${BRAND.navy}"/><w:sz w:val="28"/>`, based("Normal", "Normal")) +
      st("paragraph", "ProcFront", "Procedure Front Heading", '<w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/>', `<w:b/><w:caps/><w:color w:val="${BRAND.gray}"/><w:sz w:val="22"/>`, based("Normal", "Normal")) +
      st("paragraph", "ProcStep", "Procedure Step", `<w:keepNext/><w:tabs><w:tab w:val="left" w:pos="${IND}"/><w:tab w:val="right" w:pos="${PAGE_W}"/></w:tabs><w:spacing w:before="200" w:after="40"/><w:ind w:left="${IND}" w:hanging="${IND}"/>`, '<w:b/><w:sz w:val="22"/>', based("Normal", "ProcBody")) +
      st("paragraph", "ProcMeta", "Procedure Step Details", `<w:spacing w:after="60"/><w:ind w:left="${IND}"/>`, `<w:color w:val="${BRAND.muted}"/><w:sz w:val="17"/>`, based("Normal")) +
      st("paragraph", "ProcBody", "Procedure Body", `<w:ind w:left="${IND}"/>`, "", based("Normal")) +
      st("paragraph", "ProcCode", "Procedure Code", `<w:pBdr>${box("D0D4D7")}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F5"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="${IND}" w:right="120"/>`, `<w:rFonts w:ascii="${BRAND.mono}" w:hAnsi="${BRAND.mono}" w:cs="${BRAND.mono}"/><w:sz w:val="18"/>`, based("Normal")) +
      st("paragraph", "ProcConsole", "Procedure Console", `<w:pBdr>${box("1F2328")}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="1F2328"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="${IND}" w:right="120"/>`, `<w:rFonts w:ascii="${BRAND.mono}" w:hAnsi="${BRAND.mono}" w:cs="${BRAND.mono}"/><w:color w:val="E6EDF3"/><w:sz w:val="18"/>`, based("Normal")) +
      st("paragraph", "ProcCallout", "Procedure Callout", `<w:spacing w:after="0"/><w:ind w:left="${IND + 120}" w:right="120"/>`, "", based("Normal")) +
      st("paragraph", "Caption", "caption", `<w:spacing w:after="160"/>`, `<w:i/><w:color w:val="${BRAND.muted}"/><w:sz w:val="17"/>`, based("Normal")) +
      st("character", "Hyperlink", "Hyperlink", "", `<w:color w:val="${BRAND.navy}"/><w:u w:val="single"/>`) +
      `<w:style w:type="table" w:styleId="ProcTable"><w:name w:val="Procedure Table"/><w:tblPr><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${BRAND.lunar}"/>`).join("")}</w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
      `</w:styles>`;
  }
  function numberingXml() {
    const sym = ["•", "◦", "▪", "•"];
    return `${XML_HEAD}<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${sym.map((c, i) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${c}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${IND + 360 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  }

  /* ---------- minimal ZIP writer (deflate when the browser can, store otherwise) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function deflate(u8) {
    if (!("CompressionStream" in window)) return null;
    try { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()); } catch (e) { return null; }
  }
  async function zip(entries) {
    const enc = new TextEncoder(); const chunks = []; const central = []; let offset = 0;
    const d = new Date(); const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const e of entries) {
      const name = enc.encode(e.name); const crc = crc32(e.data);
      const packed = !e.stored && e.data.length > 512 ? await deflate(e.data) : null;
      const body = packed && packed.length < e.data.length ? packed : e.data; const method = body === e.data ? 0 : 8;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, e.data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(lh.buffer, name, body);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, e.data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + body.length;
    }
    const cdSize = central.reduce((a, c) => a + (c.byteLength ?? c.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end.buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  async function exportProcedure(procId, which) {
    toast("Building Word document…", "info", 2500);
    try {
      const src = await PR.loadProcedureVersion(procId, which);
      if (!src) return toast("Procedure not found", "err");
      const blob = await buildDocx(src);
      download(src.fileTitle + ".docx", blob);
      toast(`Saved “${src.fileTitle}.docx”`, "ok", 4000);
    } catch (e) { console.error(e); toast("Couldn't build the Word file: " + (e.message || e), "err", 6000); }
  }

  return { open, readDocx, build, buildDocx, exportProcedure, segsToMd, zip };
})();
