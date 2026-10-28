/* importer.js — turn an Excel playbook into a procedure.
   Reads .xlsx/.xlsm in the browser (zip + XML, no libraries), CSV, or rows pasted from Excel.
   A mapping screen lets you pick which column is the step number, title, commands, notes, location…
   Location cells that are formulas (e.g. =E2 vs =IF(E2=…)) are recognised as Current Primary / Current Secondary,
   which is how direction-aware playbooks flip sites. */
PR.importer = (() => {
  const { h, $, $$, toast, modal, uid, pickFile } = PR.u;
  const M = () => PR.model;

  /* ---------------- minimal ZIP reader ---------------- */
  async function unzip(buf) {
    const dv = new DataView(buf); const u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Not a valid Office file (.xlsx / .docx)");
    const count = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nameLen = dv.getUint16(off + 28, true), extra = dv.getUint16(off + 30, true), comment = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
      files[name] = { method, csize, lho };
      off += 46 + nameLen + extra + comment;
    }
    return {
      names: Object.keys(files),
      async text(name) {
        const f = files[name]; if (!f) return null;
        const ln = dv.getUint16(f.lho + 26, true), le = dv.getUint16(f.lho + 28, true);
        const data = u8.subarray(f.lho + 30 + ln + le, f.lho + 30 + ln + le + f.csize);
        if (f.method === 0) return dec.decode(data);
        if (!("DecompressionStream" in window)) throw new Error("This browser can't read .xlsx — save the sheet as CSV, or paste the rows instead.");
        const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(ds).text();
      },
      async bytes(name) {
        const f = files[name]; if (!f) return null;
        const ln = dv.getUint16(f.lho + 26, true), le = dv.getUint16(f.lho + 28, true);
        const data = u8.subarray(f.lho + 30 + ln + le, f.lho + 30 + ln + le + f.csize);
        if (f.method === 0) return data.slice();
        if (!("DecompressionStream" in window)) throw new Error("This browser can't unpack this file");
        const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(ds).arrayBuffer());
      },
    };
  }
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const colIdx = (ref) => { const m = ref.match(/^([A-Z]+)/); let n = 0; for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

  async function readXlsx(buf) {
    const z = await unzip(buf);
    const wb = xml(await z.text("xl/workbook.xml"));
    const rels = xml(await z.text("xl/_rels/workbook.xml.rels"));
    const relMap = {};
    $$("Relationship", rels).forEach((r) => (relMap[r.getAttribute("Id")] = r.getAttribute("Target")));
    const ssText = await z.text("xl/sharedStrings.xml");
    const shared = ssText ? $$("si", xml(ssText)).map((si) => $$("t", si).map((t) => t.textContent).join("")) : [];
    const sheets = [];
    for (const s of $$("sheet", wb)) {
      const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      let target = relMap[rid] || ""; target = target.replace(/^\//, ""); if (!target.startsWith("xl/")) target = "xl/" + target;
      const sx = await z.text(target); if (!sx) continue;
      const doc = xml(sx);
      const grid = [];
      $$("sheetData row", doc).forEach((row) => {
        const r = Number(row.getAttribute("r")) - 1;
        grid[r] = grid[r] || [];
        $$("c", row).forEach((c) => {
          const ci = colIdx(c.getAttribute("r")); const t = c.getAttribute("t");
          const v = c.querySelector("v"); const f = c.querySelector("f"); const is = c.querySelector("is");
          let val = v ? v.textContent : is ? $$("t", is).map((x) => x.textContent).join("") : "";
          if (t === "s") val = shared[Number(val)] ?? "";
          else if (t === "b") val = val === "1" ? "TRUE" : "FALSE";
          else if (t === "e") val = "";
          grid[r][ci] = { v: String(val ?? ""), f: f ? f.textContent : (f === null ? "" : "") , shared: f && f.getAttribute("t") === "shared" ? f.getAttribute("si") : null };
        });
      });
      // shared formulas: copy the master formula text to followers (we only need its shape)
      const masters = {};
      grid.forEach((row) => (row || []).forEach((c) => { if (c && c.shared != null && c.f) masters[c.shared] = c.f; }));
      grid.forEach((row) => (row || []).forEach((c) => { if (c && c.shared != null && !c.f) c.f = masters[c.shared] || "shared"; }));
      sheets.push({ name: s.getAttribute("name"), grid: Array.from(grid, (r) => Array.from(r || [], (c) => c || { v: "", f: "" })) });
    }
    return sheets;
  }
  function parseDelimited(text) {
    const delim = text.includes("\t") ? "\t" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"' && cell === "") q = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return [{ name: "Pasted", grid: rows.map((r) => r.map((v) => ({ v, f: "" }))) }];
  }

  /* ---------------- mapping ---------------- */
  const FIELDS = [
    ["num", "Step number", /^(activity\s*no|step\s*#?|no\.?|#|step\s*no|seq)/i],
    ["title", "Step title", /(activity\s*desc|description|title|task|step\s*name|activity$)/i],
    ["commands", "Commands / instructions", /(command|instruction|how|procedure|details)/i],
    ["notes", "Notes", /^notes?$/i],
    ["category", "Category", /(category|type|phase)/i],
    ["location", "Location / environment", /(location|site|environment|server|host|target)/i],
    ["owner", "Owner team", /^owner/i],
    ["contact", "Escalation contact", /(escalation|contact)/i],
    ["window", "Timing window", /(start\s*time|when|timing|window)/i],
  ];
  function detectHeader(grid) {
    let best = 0, bestScore = -1;
    for (let r = 0; r < Math.min(grid.length, 15); r++) {
      const cells = (grid[r] || []).map((c) => c.v.trim());
      const score = FIELDS.reduce((a, [, , re]) => a + (cells.some((c) => re.test(c)) ? 1 : 0), 0);
      if (score > bestScore) { best = r; bestScore = score; }
    }
    return best;
  }
  function autoMap(header) {
    const map = {}; const used = new Set();
    FIELDS.forEach(([k, , re]) => { const i = header.findIndex((c, j) => !used.has(j) && re.test(c.trim())); if (i >= 0) { map[k] = i; used.add(i); } });
    return map;
  }
  /* Location key: value + formula shape so "=E2" and "=IF(E2=…)" are distinguishable even when the cached value matches. */
  function locKey(cell) {
    if (!cell) return "";
    const f = cell.f || "";
    const shape = !f ? "" : /^\s*IF\s*\(/i.test(f) || /\bIF\(/i.test(f) ? "formula:other" : "formula:base";
    return `${cell.v.trim()}${shape ? "|" + shape : ""}`;
  }
  function locDefault(key, sitesGuess) {
    const [v, shape] = key.split("|");
    if (shape === "formula:base") return "primary";
    if (shape === "formula:other") return "secondary";
    if (!v) return "none";
    if (/^(both|all)$/i.test(v)) return "both";
    const s = sitesGuess.find((x) => x.label === v);
    return s ? `site:${s.id}` : "custom";
  }

  /* Commands column → blocks. Lines starting with "-" become nested bullets; a lone first line is a menu path root. */
  function commandBlocks(text, category) {
    const out = [];
    const t = String(text || "").replace(/\r/g, "").trim();
    if (!t) return out;
    const lines = t.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
    const email = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    const phone = t.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
    if (/communic/i.test(category || "") && (email || phone) && lines.length <= 3) {
      out.push(M().newBlock("contact", { who: t.replace(/email:?/i, "").replace(email ? email[0] : "", "").replace(phone ? phone[0] : "", "").replace(/[()]/g, "").trim() || "Contact", method: email ? "email" : "phone", detail: email ? email[0] : phone[0], request: "", requireConfirmation: false }));
      return out;
    }
    const allPath = lines.length <= 4 && lines.every((l, i) => (i === 0 ? !/^\s*-/.test(l) : /^\s*-\s+\S/.test(l) && !/^\s*--/.test(l) && l.length < 60));
    if (allPath && lines.length > 1) { out.push(M().newBlock("path", { trail: lines.map((l) => l.replace(/^\s*-\s*/, "").trim()).join("\n") })); return out; }
    if (lines.length === 1 && /^[A-Z0-9_.]{4,}$/.test(lines[0].trim())) { out.push(M().newBlock("command", { code: lines[0].trim(), label: "" })); return out; }
    const md = lines.map((l, i) => {
      const m = l.match(/^\s*(-+)\s*(.*)$/);
      if (m) return `${"-".repeat(Math.min(4, m[1].length))} ${m[2]}`;
      return i === 0 && lines.length > 1 ? `**${l.trim()}**` : l.trim();
    }).join("\n");
    out.push(M().newBlock("text", { text: md }));
    return out;
  }
  function validationFrom(title, text) {
    const m = String(text || "").match(/(should\s+(?:be|get|show|have|respond)[^\n]*|results?\s+should[^\n]*)/i);
    return m ? M().newBlock("validation", { test: title, expected: m[0].replace(/^-+\s*/, "").trim(), required: true }) : null;
  }

  /* Build procedure from mapped rows */
  function build({ title, grid, headerRow, map, locMap, sections: secMode, sites, directional, phaseFromRow }) {
    const p = M().newProcedure({ title });
    p.sections = [];
    if (sites.length) {
      p.environments.enabled = true; p.environments.directional = directional;
      p.environments.sites = sites.map((s, i) => ({ id: s.id, name: s.name, code: s.code || s.name.slice(0, 3).toUpperCase(), label: s.label, partition: s.partition || "", hmc: "", color: ["#2563eb", "#ea580c"][i % 2] }));
      p.environments.defaultPrimarySiteId = sites[0].id;
    }
    let cur = null, lastCat = null, phase = "pre";
    const get = (row, k) => (map[k] != null && row[map[k]] ? row[map[k]].v : "").trim();
    // In a numbered sheet, a row with only a title and no number is a section heading
    const body = grid.slice(headerRow + 1).filter((row) => row && get(row, "title"));
    const numbered = map.num != null && body.filter((row) => get(row, "num")).length > body.length / 2;
    for (let r = headerRow + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      const filled = row.filter((c) => c && c.v.trim());
      if (!filled.length) continue;
      const titleV = get(row, "title"), num = get(row, "num");
      // Marker rows (a single filled cell, no title) start a new section
      if (filled.length === 1 && (!titleV || (numbered && !num))) {
        cur = M().newSection({ title: filled[0].v.trim(), phase });
        if (phaseFromRow && /fail\s*over|cutover|begin/i.test(cur.title)) cur.phase = "pre";
        p.sections.push(cur); lastCat = null; continue;
      }
      if (!titleV) continue;
      const cat = get(row, "category");
      if (!cur || (secMode === "category" && cat !== lastCat)) { cur = M().newSection({ title: secMode === "category" ? cat || "Steps" : secMode === "markers" ? "Preparation" : "Steps", phase }); p.sections.push(cur); }
      lastCat = cat;
      const locCell = map.location != null ? row[map.location] : null;
      const target = locMap[locKey(locCell)] || "none";
      const commands = map.commands != null && row[map.commands] ? row[map.commands].v : "";
      const blocks = [];
      if (/decision/i.test(cat) || /^decision/i.test(titleV)) blocks.push(M().newBlock("decision", { question: titleV, criteria: commands, decisionMaker: get(row, "contact") || "Failover lead", noGo: "halt" }));
      else blocks.push(...commandBlocks(commands, cat));
      if (/valid/i.test(cat)) { const v = validationFrom(titleV, commands); if (v) blocks.push(v); }
      if (/record|_{4,}/i.test(titleV + commands)) blocks.push(M().newBlock("input", { label: titleV.replace(/^record\s*/i, ""), variable: "", required: true }));
      const notes = get(row, "notes");
      const extra = map.notes != null ? row.slice(map.notes + 1).map((c) => c && c.v.trim()).filter(Boolean) : [];
      if (notes || extra.length) blocks.push(M().newBlock("callout", { tone: "tip", title: "Notes", text: [notes, ...extra].filter(Boolean).join("\n") }));
      const step = M().newStep({
        num: num || String(M().allSteps(p).length + 1), title: titleV, category: cat, target: target === "custom" ? "custom" : target, targetLabel: target === "custom" ? (locCell ? locCell.v.trim() : "") : "",
        owner: get(row, "owner"), contact: get(row, "contact"), window: get(row, "window"), blocks, critical: /decision/i.test(cat),
      });
      if (/^(failover complete|complete)/i.test(titleV)) step.category = step.category || "Milestone";
      cur.steps.push(step);
    }
    if (!p.sections.length) p.sections.push(M().newSection({ title: "Steps" }));
    // Steps after the failover command are "after cutover" for role labels
    if (directional) {
      let after = false;
      p.sections.forEach((s) => s.steps.forEach((st) => { if (after) st.phase = "post"; if (/issue\s+failover|execute\s+failover/i.test(st.title)) after = true; }));
    }
    return M().normalize(p);
  }

  /* ---------------- UI ---------------- */
  async function open(opts = {}) {
    const f = await pickFile(".xlsx,.xlsm,.csv,.tsv,.txt");
    if (!f) return;
    let sheets;
    try {
      sheets = /\.(csv|tsv|txt)$/i.test(f.name) ? parseDelimited(await f.text()) : await readXlsx(await f.arrayBuffer());
    } catch (e) { console.error(e); return toast(e.message || "Couldn't read that file", "err", 5000); }
    if (!sheets.length) return toast("No sheets found", "err");
    mapping(sheets, f.name.replace(/\.[^.]+$/, ""), opts);
  }
  async function openPaste() {
    let ta;
    const v = await modal({ title: "Paste rows from Excel", size: "lg", subtitle: "Select the rows in Excel (include the header row), copy, and paste here.",
      body: ta = h("textarea.inp.mono", { rows: 14, placeholder: "Category\tLocation\tActivity No.\tActivity Description\t…", autofocus: true }),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Next", kind: "primary", value: "ok" }] });
    if (v !== "ok" || !ta.value.trim()) return;
    mapping(parseDelimited(ta.value), "Pasted procedure");
  }

  function mapping(sheets, name, opts = {}) {
    let sheetI = Math.max(0, sheets.findIndex((s) => s.grid.length > 3));
    let eachSheet = !!opts.addSheetTo ? false : sheets.filter((x) => x.grid.length > 3).length > 1 && sheets.some((x) => /daily|month|week|sunday|holiday|run\s*sheet|\bme\b/i.test(x.name));
    let st = null;
    const init = () => {
      const grid = sheets[sheetI].grid;
      const headerRow = detectHeader(grid);
      const header = (grid[headerRow] || []).map((c) => c.v);
      const map = autoMap(header);
      // site guess from location values
      const vals = new Map();
      if (map.location != null) for (let r = headerRow + 1; r < grid.length; r++) { const c = (grid[r] || [])[map.location]; const k = locKey(c); if (c && c.v.trim()) vals.set(k, (vals.get(k) || 0) + 1); }
      const plain = [...new Set([...vals.keys()].map((k) => k.split("|")[0]).filter((v) => v && !/^(both|all)$/i.test(v)))];
      const bracket = plain.filter((v) => /\(.+\)/.test(v) || /main|dr\b|primary|secondary/i.test(v)).slice(0, 2);
      const sites = bracket.map((v, i) => { const nm = (v.match(/\(([^)]+)\)/) || [, v])[1].trim(); return { id: uid("site"), label: v, name: nm, code: nm.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(), partition: i === 0 ? "Symitar" : "Symbu" }; });
      const hasFormula = [...vals.keys()].some((k) => k.includes("|formula"));
      // "Current Base of Operation" style header cell → order sites so the base is first
      const baseCell = grid.slice(0, headerRow).flat().find((c) => c && sites.some((s) => s.label === c.v.trim()));
      if (baseCell) sites.sort((a, b) => (a.label === baseCell.v.trim() ? -1 : b.label === baseCell.v.trim() ? 1 : 0));
      const locMap = {};
      vals.forEach((n, k) => (locMap[k] = locDefault(k, sites)));
      if (!hasFormula && sites.length === 2) vals.forEach((n, k) => { const v = k.split("|")[0]; if (v === sites[0].label) locMap[k] = "primary"; if (v === sites[1].label) locMap[k] = "secondary"; });
      const markers = grid.slice(headerRow + 1).filter((r) => r && r.filter((c) => c && c.v.trim()).length === 1).length;
      st = { title: name, grid, headerRow, header, map, vals, locMap, sites, directional: sites.length === 2, sections: markers ? "markers" : "category" };
    };
    init();
    const body = h("div.imp");
    const draw = () => {
      body.innerHTML = "";
      const g = st.grid;
      const colOpts = (k) => h("select.inp.sm", { onchange: (e) => { st.map[k] = e.target.value === "" ? undefined : Number(e.target.value); if (k === "location") { init2(); } draw(); } },
        h("option", { value: "" }, "— none —"), st.header.map((hd, i) => h("option", { value: i, selected: st.map[k] === i }, `${String.fromCharCode(65 + i)}: ${hd || "(blank)"}`)));
      const init2 = () => { const keep = { ...st.map }; const t = st.title; init(); st.map = keep; st.title = t; };
      const steps = g.slice(st.headerRow + 1).filter((r) => r && st.map.title != null && r[st.map.title] && r[st.map.title].v.trim()).length;
      body.append(
        h("div.frow",
          h("div.field.grow", h("label.lbl", "Procedure name"), h("input.inp", { value: st.title, oninput: (e) => (st.title = e.target.value) })),
          sheets.length > 1 ? h("div.field", h("label.lbl", "Sheet"), h("select.inp", { onchange: (e) => { sheetI = Number(e.target.value); init(); draw(); } }, sheets.map((s, i) => h("option", { value: i, selected: i === sheetI }, s.name)))) : null,
          h("div.field", h("label.lbl", "Header row"), h("input.inp.w-num", { type: "number", min: 1, value: st.headerRow + 1, onchange: (e) => { st.headerRow = Math.max(0, Number(e.target.value) - 1); st.header = (g[st.headerRow] || []).map((c) => c.v); st.map = autoMap(st.header); draw(); } }))),
        sheets.filter((x) => x.grid.length > 3).length > 1 ? h("label.ck.big", h("input", { type: "checkbox", checked: eachSheet, onchange: (e) => { eachSheet = e.target.checked; draw(); } }), " ",
          h("b", opts.addSheetTo ? "Add every worksheet as a run sheet" : "Every worksheet is a run sheet"), h("span.muted.small", ` — ${sheets.filter((x) => x.grid.length > 3).map((x) => x.name).join(" · ")}. One quick-start checklist: you pick the sheet when you start, and steps that appear on several sheets are kept once.`)) : null,
        opts.addSheetTo ? h("div.help", "The steps are added as one more run sheet. Steps with the same title as a step that's already there are matched, not duplicated.") : null,
        h("div.ins-sec", "Columns"),
        h("div.map-grid", FIELDS.map(([k, label]) => h("div.field", h("label.lbl", label), colOpts(k)))),
        h("div.frow",
          h("div.field", h("label.lbl", "Sections"), h("select.inp", { onchange: (e) => (st.sections = e.target.value) },
            h("option", { value: "markers", selected: st.sections === "markers" }, "Rows with a single cell start a new section"),
            h("option", { value: "category", selected: st.sections === "category" }, "New section when Category changes"),
            h("option", { value: "single", selected: st.sections === "single" }, "One section (split later)")))),
        st.vals.size ? [h("div.ins-sec", "Locations → environment"),
          h("label.ck", h("input", { type: "checkbox", checked: st.directional, onchange: (e) => { st.directional = e.target.checked; draw(); } }), " Directional failover (two datacenters swap roles)"),
          h("div.help", "Formula cells are detected: a cell pointing at the “current base” is the Current Primary, an IF() that picks the other site is the Current Secondary."),
          st.sites.map((s, i) => h("div.frow", h("div.field", h("label.lbl", `Datacenter ${i + 1}${i === 0 ? " (base / default primary)" : ""}`), h("input.inp", { value: s.name, oninput: (e) => (s.name = e.target.value) })),
            h("div.field", h("label.lbl", "Code"), h("input.inp.w-num", { value: s.code, placeholder: "MAIN", oninput: (e) => (s.code = e.target.value) })),
            h("div.field", h("label.lbl", "HMC partition (fixed)"), h("input.inp", { value: s.partition, oninput: (e) => (s.partition = e.target.value) })))),
          h("table.mini", h("thead", h("tr", h("th", "Value in sheet"), h("th", "Rows"), h("th", "Maps to"))), h("tbody", [...st.vals.entries()].map(([k, n]) => {
            const [v, shape] = k.split("|");
            const opts = [["none", "Not environment-specific"], ...(st.directional ? [["primary", "Current Primary (role)"], ["secondary", "Current Secondary (role)"]] : []), ["both", "Both sites"], ...st.sites.map((s) => [`site:${s.id}`, `📍 ${s.name} (fixed)`]), ["custom", `Custom label “${v}”`]];
            return h("tr", h("td", v || "(blank)", shape ? h("span.chip.c-gray", shape === "formula:base" ? "formula → base" : "formula → other") : null), h("td", String(n)),
              h("td", h("select.inp.sm", { onchange: (e) => (st.locMap[k] = e.target.value) }, opts.map(([ov, ol]) => h("option", { value: ov, selected: st.locMap[k] === ov }, ol)))));
          })))] : null,
        h("div.ins-sec", `Preview — ${steps} steps`),
        h("div.imp-prev", h("table.mini", h("tbody", g.slice(st.headerRow, st.headerRow + 8).map((r, i) => h(`tr${i === 0 ? ".hdr" : ""}`, (r || []).slice(0, 12).map((c) => h("td", (c.v || "").slice(0, 40)))))))));
    };
    draw();
    modal({
      title: "Import playbook", size: "xl", body,
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: opts.addSheetTo ? "Add as run sheet" : "Create procedure", kind: "primary", onClick: async () => {
        if (st.map.title == null) { toast("Choose the column that holds the step title", "warn"); return false; }
        const builtOf = (i) => { if (i !== sheetI) { const keep = { st, sheetI }; sheetI = i; init(); const b = build({ ...st, sites: [], directional: false, phaseFromRow: true }); st = keep.st; sheetI = keep.sheetI; return b; } return build({ ...st, sites: st.sites.filter((s) => s.name), phaseFromRow: true }); };
        const order = eachSheet ? sheets.map((x, i) => i).filter((i) => sheets[i].grid.length > 3) : [sheetI];
        if (opts.addSheetTo) { order.forEach((i) => opts.addSheetTo(builtOf(i), sheets[i].name || name)); return; }
        let p = builtOf(order[0]);
        if (eachSheet) {
          p.title = st.title;
          order.slice(1).forEach((i) => mergeSheet(p, builtOf(i), sheets[i].name, { firstName: sheets[order[0]].name }));
          if (order.length === 1) mergeSheet(p, { sections: [] }, null, { firstName: sheets[order[0]].name });
          p = M().normalize(p);
        }
        await PR.app.saveNewProcedure(p);
        toast(eachSheet ? `Imported ${order.length} run sheets, ${M().allSteps(p).length} steps — check each sheet's schedule in Settings → Quick start` : `Imported ${M().allSteps(p).length} steps — review them in the builder`, "ok", 6000);
      } }],
    });
  }

  /* Merge an imported procedure into target as one more run sheet. Steps with the same title (and preferably the same section)
     are matched and tagged with the new sheet; the rest are inserted next to the steps they followed in the sheet.
     Returns { sheet, matched, added }. name = null only converts target into a single-sheet run sheet. */
  const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function mergeSheet(target, built, name, { firstName } = {}) {
    const ro = target.runOptions = M().runOptions(target);
    if (!ro.quickStart) { ro.quickStart = true; ro.quickFinish = true; }
    // everything explicit at step level, so "on these sheets" is exact after the merge
    if (!ro.variants.length) {
      const nm = firstName || target.title.replace(/run\s*sheet/i, "").trim() || "Sheet 1";
      ro.variants.push(M().newSheet(M().presetFor(nm), { name: nm }));
    }
    const ids = ro.variants.map((v) => v.id);
    target.sections.forEach((sec) => {
      const sv = (sec.variants || []).length ? sec.variants : ids;
      sec.steps.forEach((st) => { const own = (st.variants || []).length ? st.variants : ids; st.variants = own.filter((x) => sv.includes(x)); });
      sec.variants = [];
    });
    if (!name) return { sheet: ro.variants[0], matched: 0, added: 0 };
    const preset = M().presetFor(name);
    const sheet = M().newSheet(preset, { name: String(name).trim(), desc: preset.desc });
    ro.variants.push(sheet);
    let matched = 0, added = 0, lastSec = null;
    (built.sections || []).forEach((bs) => {
      let tsec = target.sections.find((x) => norm(x.title) === norm(bs.title)) || null;
      let pos = tsec ? -1 : null;
      bs.steps.forEach((bst) => {
        const inSec = tsec && tsec.steps.find((x) => norm(x.title) === norm(bst.title) && !x.variants.includes(sheet.id));
        const any = inSec ? null : M().allSteps(target).find(({ step }) => norm(step.title) === norm(bst.title) && !step.variants.includes(sheet.id));
        const hit = inSec ? { step: inSec, section: tsec } : any;
        if (hit) { hit.step.variants.push(sheet.id); matched++; if (hit.section === tsec) pos = tsec.steps.indexOf(hit.step); lastSec = hit.section; return; }
        if (!tsec) {
          tsec = M().newSection({ title: bs.title, steps: [] });
          const at = lastSec ? target.sections.indexOf(lastSec) + 1 : target.sections.length;
          target.sections.splice(at, 0, tsec); pos = -1;
        }
        const ns = { ...bst, variants: [sheet.id] };
        if (pos == null) pos = tsec.steps.length - 1;
        tsec.steps.splice(pos + 1, 0, ns); pos += 1; added++; lastSec = tsec;
      });
    });
    return { sheet, matched, added };
  }

  return { open, openPaste, mergeSheet, unzip, readXlsx, parseDelimited, build, commandBlocks, locKey };
})();
