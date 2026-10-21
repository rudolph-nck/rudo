/* directory.js — the People screen: the master list every chart page is built from.
   Filter/sort, edit in place (Edit mode), health checks (loops, missing managers, duplicates), spreadsheet import with a
   column-mapping step and an "update & add" or "replace everyone" mode, and .xlsx/.csv export. */
OC.directory = (() => {
  const { h, $, $$, esc, toast, modal, confirmBox, plural, norm, debounce, menu, fmtDate, now, slug } = OC.u;
  const M = () => OC.model, A = () => OC.actions, S = () => OC.store;
  const P = () => S().doc;

  const f = { q: "", unit: "", type: "", status: "current", mgr: "", ids: null, idsLabel: "" };
  let sort = { key: "name", dir: 1 };
  let root = null, editing = false, showHealth = false, limit = 300;

  const COLS = [
    { key: "name", label: "Name", w: 200 },
    { key: "title", label: "Title", w: 200 },
    { key: "managerId", label: "Reports to", w: 180 },
    { key: "department", label: "Department / branch", w: 180 },
    { key: "type", label: "Type", w: 110 },
    { key: "status", label: "Status", w: 100 },
    { key: "employeeNumber", label: "Emp #", w: 90 },
    { key: "email", label: "Email" }, // takes the remaining width
    { key: "_team", label: "Team", w: 70 },
  ];

  function render(view, opts) {
    editing = opts.editing;
    root = h("div.people");
    view.append(root);
    draw();
  }
  function refresh() { if (root && root.isConnected) draw(true); }

  function rowsFiltered() {
    const p = P();
    const ix = M().index(p);
    let list = Object.values(p.people);
    if (f.status === "current") list = list.filter((x) => x.status !== "inactive");
    else if (f.status) list = list.filter((x) => x.status === f.status);
    if (f.unit) list = list.filter((x) => x.department === f.unit);
    if (f.type) list = list.filter((x) => x.type === f.type);
    if (f.mgr) { const d = M().descendants(p, f.mgr); list = list.filter((x) => d.has(x.id)); }
    if (f.ids) list = list.filter((x) => f.ids.has(x.id));
    const words = norm(f.q).split(" ").filter(Boolean);
    if (words.length) list = list.filter((x) => { const m = ix.byId.get(x.managerId); const hay = norm(`${x.name} ${x.title} ${x.department} ${x.email} ${x.employeeNumber} ${m ? m.name : ""}`); return words.every((w) => hay.includes(w)); });
    const val = (x) => sort.key === "managerId" ? (ix.byId.get(x.managerId) || {}).name || "" : sort.key === "_team" ? M().headcount(p, x.id) : String(x[sort.key] || "");
    list.sort((a, b) => { const va = val(a), vb = val(b); return (typeof va === "number" ? va - vb : va.localeCompare(vb)) * sort.dir || a.name.localeCompare(b.name); });
    return list;
  }

  function draw(keepFocus = false) {
    const p = P();
    const focusSel = keepFocus && document.activeElement && root.contains(document.activeElement) && document.activeElement.id;
    const scrollTop = $(".tbl-wrap", root)?.scrollTop || 0;
    root.innerHTML = "";
    const issues = M().health(p);
    const errs = issues.filter((i) => i.level === "error").length, warns = issues.filter((i) => i.level === "warn").length;
    const st = M().stats(p);
    const units = M().unitNames(p);
    const list = rowsFiltered();

    const top = h("div.people-head.blue-line",
      h("div", h("h1", "People"), h("div.muted", `${plural(st.people, "person", "people")} · ${plural(st.units, "department")} · ${st.managers} managers${st.vacant ? ` · ${st.vacant} vacant` : ""}${st.leave ? ` · ${st.leave} on leave` : ""}`)),
      h("div.spacer"),
      h("button.btn" + (errs ? ".btn-danger-o" : warns ? ".btn-warn-o" : ""), { type: "button", onclick: () => { showHealth = !showHealth; draw(); } }, errs || warns ? `⚠ ${plural(errs + warns, "thing")} to check` : "✓ No problems found"),
      h("button.btn", { type: "button", onclick: (e) => menu(e.currentTarget, [
        { label: "Excel workbook (.xlsx)", icon: "▦", onClick: () => exportXlsx() },
        { label: "CSV", icon: "≡", onClick: () => exportCsv() },
      ], { align: "right" }) }, "Export ▾"),
      editing ? h("button.btn", { type: "button", onclick: () => importSheet() }, "Import spreadsheet…") : null,
      editing ? h("button.btn.btn-cta", { type: "button", onclick: () => A().addPerson() }, h("span", "+"), " Add person") : null);
    root.append(top);

    if (showHealth) {
      root.append(h("div.health",
        issues.length ? issues.slice(0, 80).map((i) => h(`div.hl-row.hl-${i.level}`, h("span.hl-ic", i.level === "error" ? "✕" : i.level === "warn" ? "!" : "i"), h("span", i.msg),
          i.ids.length ? h("button.link-btn.small", { type: "button", onclick: () => { f.ids = new Set(i.ids); f.idsLabel = i.msg; f.status = ""; showHealth = false; draw(); } }, i.ids.length > 1 ? `Show ${i.ids.length}` : "Show") : null))
          : h("div.muted", "Every person has a valid manager, there are no reporting loops and no duplicates."),
        issues.length > 80 ? h("div.muted.small", `…and ${issues.length - 80} more`) : null));
    }

    const q = h("input.inp#ppl-q", { type: "search", placeholder: "Search name, title, department, email, employee #…", value: f.q, oninput: debounce((e) => { f.q = e.target.value; draw(true); }, 120) });
    const sel = (id, v, opts, on) => h(`select.inp#${id}`, { onchange: (e) => { on(e.target.value); draw(); } }, opts.map(([k, l]) => h("option", { value: k, selected: k === v }, l)));
    const mgrPick = OC.ui.personPicker({ value: f.mgr, allowNone: true, noneLabel: "Anyone", placeholder: "Anyone's organization", onPick: (x) => { f.mgr = x ? x.id : ""; draw(); } });
    root.append(h("div.people-filters",
      q,
      sel("ppl-unit", f.unit, [["", "All departments"], ...units.map((u) => [u, u])], (v) => (f.unit = v)),
      sel("ppl-type", f.type, [["", "All types"], ...Object.entries(M().TYPES)], (v) => (f.type = v)),
      sel("ppl-status", f.status, [["current", "Current (active + on leave)"], ["active", "Active"], ["leave", "On leave"], ["inactive", "Removed / inactive"], ["", "Everyone"]], (v) => (f.status = v)),
      h("div.mgr-filter", mgrPick.el),
      f.ids ? h("span.chip.c-amber.filter-chip", { title: f.idsLabel }, `Showing ${f.ids.size} from a check`, h("button.chip-x", { type: "button", onclick: () => { f.ids = null; f.status = "current"; draw(); } }, "✕")) : null,
      h("span.muted.small.count", `${list.length} shown`)));

    const ix = M().index(p);
    const thead = h("thead", h("tr", COLS.map((c) => h("th", { style: { width: c.w ? c.w + "px" : null }, class: sort.key === c.key ? "sorted" : "", onclick: () => { sort = { key: c.key, dir: sort.key === c.key ? -sort.dir : 1 }; draw(); } }, c.label, sort.key === c.key ? (sort.dir > 0 ? " ▲" : " ▼") : "")), h("th", { style: { width: "44px" } })));
    const tbody = h("tbody");
    const shown = list.slice(0, limit);
    for (const x of shown) {
      const m = ix.byId.get(x.managerId);
      const team = M().headcount(p, x.id);
      const tr = h("tr" + (x.status === "inactive" ? ".inactive" : ""), { dataset: { id: x.id } },
        h("td.c-name", { dataset: { k: "name" } }, x.type === "vacant" ? h("span.vac-name", x.name ? `Vacant · ${x.name}` : "Vacant") : x.name),
        h("td", { dataset: { k: "title" } }, x.title),
        h("td", { dataset: { k: "managerId" } }, m ? m.name : x.id === p.ceoId ? h("span.muted", "— top —") : x.managerId ? h("span.c-red", "missing") : h("span.muted", "—")),
        h("td", { dataset: { k: "department" } }, x.department),
        h("td", { dataset: { k: "type" } }, x.type === "employee" ? h("span.muted", "Employee") : M().TYPES[x.type]),
        h("td", { dataset: { k: "status" } }, x.status === "active" ? h("span.muted", "Active") : M().STATUS[x.status] || x.status),
        h("td", { dataset: { k: "employeeNumber" } }, x.employeeNumber),
        h("td.c-email", { dataset: { k: "email" } }, x.email),
        h("td.num", team ? String(team) : ""),
        h("td.c-act", h("button.icon-btn.sm", { type: "button", title: "More", onclick: (e) => { e.stopPropagation(); menu(e.currentTarget, rowMenu(x), { align: "right" }); } }, "⋯")));
      tbody.append(tr);
    }
    const table = h("table.tbl.people-tbl" + (editing ? ".editable" : ""), thead, tbody);
    table.addEventListener("click", (e) => {
      const td = e.target.closest("td[data-k]"); const tr = e.target.closest("tr[data-id]");
      if (!td || !tr) return;
      if (editing) editCell(td, tr.dataset.id, td.dataset.k);
      else OC.app.showPerson(tr.dataset.id);
    });
    const wrap = h("div.tbl-wrap", table, list.length > limit ? h("div.more-row", h("button.btn", { type: "button", onclick: () => { limit += 500; draw(); } }, `Show ${Math.min(500, list.length - limit)} more`)) : null,
      !list.length ? h("div.empty", "Nobody matches these filters.") : null);
    root.append(wrap);
    wrap.scrollTop = scrollTop;
    root.append(h("div.people-foot.muted.small", editing ? "Click any cell to change it. Changes save on their own and can be undone with Ctrl+Z." : "Click a person to see them on the chart. Switch to Edit (top right) to change the list."));
    if (focusSel) { const el = document.getElementById(focusSel); if (el) { el.focus(); if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); } }
    if (f.focusId) { const tr = $(`tr[data-id="${CSS.escape(f.focusId)}"]`, root); if (tr) { tr.classList.add("flash"); tr.scrollIntoView({ block: "center" }); } f.focusId = null; }
  }

  function rowMenu(x) {
    const items = [
      { label: "Show on the chart", icon: "▦", onClick: () => OC.app.showPerson(x.id) },
      { label: "Filter to their organization", icon: "⤵", onClick: () => { f.mgr = x.id; draw(); } },
    ];
    if (editing) {
      items.push({ sep: true }, { label: "Edit all fields…", icon: "✎", onClick: () => A().editPerson(x.id) });
      if (x.status === "inactive") items.push({ label: "Restore (make active)", icon: "↺", onClick: () => A().setField(x.id, "status", "active") });
      else items.push(
        { label: "Add a direct report…", icon: "+", onClick: () => A().addPerson({ managerId: x.id }) },
        { label: x.type === "vacant" ? "Fill this vacancy…" : "Replace with someone new…", icon: "⇄", onClick: () => A().replacePerson(x.id) },
        { sep: true }, { label: "Remove…", icon: "🗑", danger: true, onClick: () => A().removePerson(x.id) });
    }
    return items;
  }

  /* In-place cell editor. */
  function editCell(td, id, key) {
    if (td.querySelector("input,select,.pp")) return;
    const x = M().person(P(), id); if (!x) return;
    const restore = () => draw();
    td.classList.add("editing-cell");
    if (key === "managerId") {
      const pick = OC.ui.personPicker({ value: x.managerId, allowNone: true, exclude: (c) => c.id === id || M().descendants(P(), id).has(c.id), onPick: (c) => { A().setManager(id, c ? c.id : ""); } });
      td.innerHTML = ""; td.append(pick.el); pick.focus();
      pick.el.querySelector("input").addEventListener("blur", () => setTimeout(() => { if (!td.contains(document.activeElement)) restore(); }, 200));
      return;
    }
    let inp;
    if (key === "type" || key === "status") {
      const opts = key === "type" ? M().TYPES : { active: "Active", leave: "On leave", inactive: "Inactive" };
      inp = h("select.inp.sm", Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: x[key] === k }, l)));
      inp.addEventListener("change", () => { A().setField(id, key, inp.value); });
      inp.addEventListener("blur", restore);
    } else {
      inp = h("input.inp.sm", { value: x[key] || "", list: key === "department" ? "dir-units" : null });
      const commit = () => { const v = inp.value.trim(); if (v !== (x[key] || "")) A().setField(id, key, v); else restore(); };
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); inp.blur(); }
        if (e.key === "Escape") { e.stopPropagation(); inp.value = x[key] || ""; inp.blur(); }
        if (e.key === "Tab") { e.preventDefault(); const next = e.shiftKey ? td.previousElementSibling : td.nextElementSibling; commit(); setTimeout(() => { const tr = $(`tr[data-id="${CSS.escape(id)}"]`, root); const k = next && next.dataset.k; const ntd = k && tr && $(`td[data-k="${k}"]`, tr); if (ntd) editCell(ntd, id, k); }, 60); }
      });
      inp.addEventListener("blur", commit);
    }
    td.innerHTML = "";
    td.append(inp);
    if (key === "department") td.append(h("datalist#dir-units", M().unitNames(P()).map((u) => h("option", { value: u }))));
    inp.focus(); if (inp.select) inp.select();
  }

  function focus(id) { f.focusId = id; f.q = ""; f.ids = null; f.status = ""; draw(); }

  /* ---------------------------------------------------------------- export */
  function exportRows() {
    const p = P(), ix = M().index(p);
    const head = ["Name", "Title", "Department", "Unit type", "Reports to", "Manager employee #", "Employee #", "Email", "Phone", "Location", "Type", "Status", "Executive area", "Organization size", "Notes"];
    const people = Object.values(p.people).filter((x) => x.status !== "inactive").sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
    const rows = people.map((x) => {
      const m = ix.byId.get(x.managerId), o = M().execOwner(p, x.id);
      return [x.type === "vacant" ? x.name || "Vacant" : x.name, x.title, x.department, M().isBranch(p, x.department) ? "Branch" : x.department ? "Department" : "", m ? m.name : "", m ? m.employeeNumber || "" : "", x.employeeNumber, x.email, x.phone || "", x.location || "",
        M().TYPES[x.type] || x.type, M().STATUS[x.status] || x.status, o ? ix.byId.get(o).name : "", M().headcount(p, x.id), x.notes || ""];
    });
    return [head, ...rows];
  }
  const fileBase = () => `${slug(P().organization)}-people-${fmtDate(now())}`;
  function exportXlsx() {
    const rows = exportRows();
    const p = P();
    const units = M().unitGroups(p).map((g) => [g.name, g.branch ? "Branch" : "Department", g.owner ? M().person(p, g.owner).name : "", g.members.length]);
    OC.u.download(`${fileBase()}.xlsx`, OC.sheet.writeXlsx([
      { name: "People", rows, widths: [26, 30, 24, 11, 24, 12, 11, 30, 15, 16, 14, 12, 22, 10, 30] },
      { name: "Departments", rows: [["Department / branch", "Type", "Executive area", "People"], ...units], widths: [30, 12, 26, 10] },
    ]));
  }
  function exportCsv() { OC.u.download(`${fileBase()}.csv`, "﻿" + OC.u.csv(exportRows()), "text/csv;charset=utf-8"); }

  /* ---------------------------------------------------------------- import */
  const FIELDS = [
    { key: "name", label: "Full name", syn: ["name", "full name", "employee name", "employee", "associate", "associate name", "worker"] },
    { key: "first", label: "First name", syn: ["first name", "first", "given name", "preferred name"] },
    { key: "last", label: "Last name", syn: ["last name", "last", "surname", "family name"] },
    { key: "title", label: "Job title", syn: ["title", "job title", "position title", "job", "position", "business title", "job name"] },
    { key: "department", label: "Department", syn: ["department", "dept", "department name", "unit", "team", "cost center", "cost centre", "division"] },
    { key: "branch", label: "Branch", syn: ["branch", "branch name", "is branch", "branch?"] },
    { key: "manager", label: "Manager name", syn: ["manager", "manager name", "reports to", "supervisor", "supervisor name", "direct manager", "reports to name"] },
    { key: "managerNumber", label: "Manager employee #", syn: ["manager id", "manager employee #", "manager employee number", "supervisor id", "manager number", "reports to id", "manager emp #"] },
    { key: "employeeNumber", label: "Employee #", syn: ["employee #", "employee number", "employee id", "emp id", "emp #", "id", "associate id", "worker id", "employee no"] },
    { key: "email", label: "Email", syn: ["email", "e-mail", "work email", "email address"] },
    { key: "phone", label: "Phone", syn: ["phone", "work phone", "phone number", "extension", "ext"] },
    { key: "location", label: "Location", syn: ["location", "office", "site", "work location"] },
    { key: "type", label: "Type", syn: ["type", "position type", "employee type", "worker type"] },
    { key: "status", label: "Status", syn: ["status", "employment status", "employee status"] },
    { key: "notes", label: "Notes", syn: ["notes", "note", "comments"] },
  ];
  const yes = (v) => /^(y|yes|true|1|x|branch)$/i.test(String(v).trim());
  const no = (v) => /^(n|no|false|0|)$/i.test(String(v).trim());
  const flipName = (s) => { const m = String(s || "").match(/^\s*([^,]+),\s*(.+)$/); return m ? `${m[2]} ${m[1]}` : String(s || ""); };
  const typeOf = (v) => /vac|open|tbh|tbd/i.test(v) ? "vacant" : /contract|temp|consult/i.test(v) ? "contractor" : "employee";
  const statusOf = (v) => /inactive|term|left|removed/i.test(v) ? "inactive" : /leave|loa/i.test(v) ? "leave" : "active";

  async function importSheet() {
    if (!OC.app.editing) await OC.app.setEditing(true);
    const file = await OC.u.pickFile(".xlsx,.xlsm,.csv,.txt,.xls,.xml");
    if (!file) return;
    let sheets;
    try { sheets = await OC.sheet.readAny(file); } catch (e) { return toast(e.message, "err", 6000); }
    sheets = sheets.filter((s) => s.rows.length > 1);
    if (!sheets.length) return toast("That file has no rows to import", "err");
    let sheet = sheets[0], headerRow = 0, map = {}, mode = Object.keys(P().people).length ? "merge" : "replace";
    const guess = () => {
      // header row = first row (of the first 10) with the most recognised column names
      let best = -1;
      sheet.rows.slice(0, 10).forEach((r, i) => { const n = r.filter((c) => FIELDS.some((fd) => fd.syn.includes(norm(c)))).length; if (n > best) { best = n; headerRow = i; } });
      const heads = sheet.rows[headerRow].map((c) => norm(c));
      map = {};
      FIELDS.forEach((fd) => { const i = heads.findIndex((hd) => fd.syn.includes(hd)); if (i >= 0) map[fd.key] = i; });
      if (map.name != null && (map.first != null || map.last != null)) { delete map.first; delete map.last; }
    };
    guess();
    const body = h("div.import");
    const drawMap = () => {
      body.innerHTML = "";
      const heads = sheet.rows[headerRow];
      const colOpts = [["", "— not in this file —"], ...heads.map((c, i) => [String(i), c || `Column ${i + 1}`])];
      body.append(
        sheets.length > 1 ? h("div.field", h("label.lbl", "Sheet"), h("select.inp", { onchange: (e) => { sheet = sheets[Number(e.target.value)]; guess(); drawMap(); } }, sheets.map((s, i) => h("option", { value: i, selected: s === sheet }, `${s.name} (${s.rows.length - 1} rows)`)))) : null,
        h("p.muted.small", `Match the columns in “${file.name}”. Recognised columns are already picked.`),
        h("div.map-grid", FIELDS.map((fd) => h("div.map-row" + (map[fd.key] != null ? ".on" : ""), h("label", fd.label),
          h("select.inp.sm", { onchange: (e) => { if (e.target.value === "") delete map[fd.key]; else map[fd.key] = Number(e.target.value); drawMap(); } }, colOpts.map(([v, l]) => h("option", { value: v, selected: String(map[fd.key] ?? "") === v }, l)))))),
        h("div.lbl", "First rows"),
        h("div.preview", h("table.tbl.tbl-sm", h("tbody", sheet.rows.slice(headerRow + 1, headerRow + 5).map((r) => h("tr", FIELDS.filter((fd) => map[fd.key] != null).map((fd) => h("td", r[map[fd.key]] || ""))))))),
        Object.keys(P().people).length ? h("div.choices",
          h("label.choice", h("input", { type: "radio", name: "im", checked: mode === "merge", onchange: () => (mode = "merge") }), h("div", h("b", "Update and add"), h("div.muted.small", "Match people by employee #, then email, then name. Matched people are updated, new people are added, nobody is removed."))),
          h("label.choice", h("input", { type: "radio", name: "im", checked: mode === "replace", onchange: () => (mode = "replace") }), h("div", h("b", "Replace everyone"), h("div.muted.small", "The file becomes the full list. People not in the file are marked inactive. Page arrangements are kept for people who match.")))) : null);
    };
    drawMap();
    const v = await modal({ title: "Import spreadsheet", size: "lg", body, actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Review import", kind: "primary", value: "ok", onClick: () => {
      if (map.name == null && map.first == null && map.last == null) { toast("Pick the column that holds people's names", "err"); return false; }
    } }] });
    if (v !== "ok") return;
    const plan = buildImport(sheet.rows.slice(headerRow + 1), map, mode);
    const ok = await modal({ title: "Ready to import", size: "md", body: h("div",
      h("ul.import-sum",
        h("li", h("b", plan.added), " new ", plan.added === 1 ? "person" : "people"),
        h("li", h("b", plan.updated), " updated"),
        plan.unchanged ? h("li", h("b", plan.unchanged), " unchanged") : null,
        mode === "replace" && plan.removed ? h("li", h("b", plan.removed), " not in the file → marked inactive") : null,
        plan.skipped ? h("li.muted", `${plan.skipped} empty rows skipped`) : null),
      plan.unresolved.length ? h("div.callout.warn", h("b", `${plural(plan.unresolved.length, "manager")} couldn't be matched`), h("div.small", plan.unresolved.slice(0, 12).join(", ") + (plan.unresolved.length > 12 ? "…" : "")), h("div.small.muted", "Those people are imported without a manager; fix them on the People screen afterwards.")) : null,
      h("p.muted.small", "A snapshot of the current chart is saved first, and the import can be undone.")),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Import", kind: "cta", value: "ok" }] });
    if (ok !== "ok") return;
    await S().checkpoint(`Before importing ${file.name}`);
    S().change(plan.ops, `Import ${file.name}`);
    toast(`Imported ${file.name}: ${plan.added} added, ${plan.updated} updated`, "ok", 6000, { label: "Undo", onClick: () => S().undo() });
    if (!P().ceoId) setTimeout(() => { toast("Next: choose the CEO and executive team in Settings", "info", 6000); OC.app.openSettings(); }, 400);
  }

  function buildImport(rows, map, mode) {
    const p = P();
    const get = (r, k) => (map[k] != null ? String(r[map[k]] ?? "").trim() : "");
    const byNum = new Map(), byEmail = new Map(), byName = new Map();
    Object.values(p.people).forEach((x) => { if (x.employeeNumber) byNum.set(norm(x.employeeNumber), x.id); if (x.email) byEmail.set(norm(x.email), x.id); byName.set(norm(x.name), x.id); });
    const incoming = [];
    let skipped = 0;
    for (const r of rows) {
      let name = get(r, "name");
      if (!name) name = [get(r, "first"), get(r, "last")].filter(Boolean).join(" ");
      else if (/,/.test(name) && map.first == null) name = flipName(name);
      const type = map.type != null ? typeOf(get(r, "type")) : /^(vacant|open|tbd|tbh)\b/i.test(name) ? "vacant" : "employee";
      if (!name && type !== "vacant" && !get(r, "title")) { skipped++; continue; }
      let dept = get(r, "department"), branchFlag = false;
      const br = get(r, "branch");
      if (br) { if (yes(br)) branchFlag = true; else if (!no(br)) { dept = dept || br; if (dept === br) branchFlag = true; } }
      incoming.push({ name: type === "vacant" && /^(vacant|open|tbd|tbh)\b/i.test(name) ? "" : name, title: get(r, "title"), department: dept, branchFlag,
        manager: get(r, "manager"), managerNumber: get(r, "managerNumber"), employeeNumber: get(r, "employeeNumber"), email: get(r, "email"), phone: get(r, "phone"), location: get(r, "location"),
        type, status: map.status != null ? statusOf(get(r, "status")) : "active", notes: get(r, "notes") });
    }
    // match to existing ids
    const used = new Set();
    const newIds = new Set(Object.keys(p.people));
    incoming.forEach((x) => {
      let id = (x.employeeNumber && byNum.get(norm(x.employeeNumber))) || (x.email && byEmail.get(norm(x.email))) || (x.name && byName.get(norm(x.name)));
      if (id && used.has(id)) id = null;
      if (!id) { let base = slug(x.name || `vacant-${x.title}`), n = 2; id = base; while (newIds.has(id)) id = `${base}-${n++}`; x.isNew = true; }
      used.add(id); newIds.add(id); x.id = id;
    });
    // resolve managers: by employee # first, then by name (incoming first, then existing)
    const inNum = new Map(incoming.filter((x) => x.employeeNumber).map((x) => [norm(x.employeeNumber), x.id]));
    const inName = new Map(incoming.filter((x) => x.name).map((x) => [norm(x.name), x.id]));
    const unresolved = new Set();
    incoming.forEach((x) => {
      let m = "";
      if (x.managerNumber) m = inNum.get(norm(x.managerNumber)) || byNum.get(norm(x.managerNumber)) || "";
      if (!m && x.manager) { const n1 = norm(x.manager), n2 = norm(flipName(x.manager)); m = inName.get(n1) || inName.get(n2) || byName.get(n1) || byName.get(n2) || ""; }
      if (!m && (x.manager || x.managerNumber)) unresolved.add(x.manager || x.managerNumber);
      x.managerId = m === x.id ? "" : m;
    });
    const ops = [], fieldsOf = (x) => ({ name: x.name, title: x.title, department: x.department, managerId: x.managerId, employeeNumber: x.employeeNumber, email: x.email, phone: x.phone, location: x.location, type: x.type, status: x.status, notes: x.notes });
    let added = 0, updated = 0, unchanged = 0, removed = 0;
    const units = {};
    incoming.forEach((x) => { if (x.department && !p.units[x.department] && !units[x.department]) units[x.department] = { type: x.branchFlag || /branch/i.test(x.department) ? "branch" : "department" }; else if (x.department && x.branchFlag && p.units[x.department] && p.units[x.department].type !== "branch") units[x.department] = { ...p.units[x.department], type: "branch" }; });
    if (Object.keys(units).length) ops.push({ op: "merge", path: ["units"], value: units });
    incoming.forEach((x) => {
      const cur = p.people[x.id];
      if (!cur) { ops.push({ op: "set", path: ["people", x.id], value: { id: x.id, ...fieldsOf(x) } }); added++; return; }
      const next = fieldsOf(x);
      const diff = {};
      for (const [k, v] of Object.entries(next)) {
        if (map[k] == null && !["name", "managerId", "type", "status"].includes(k)) continue; // a column that isn't in the file keeps its value
        if (k === "managerId" && map.manager == null && map.managerNumber == null) continue;
        if (k === "type" && map.type == null && cur.type !== "vacant") continue;
        if (k === "status" && map.status == null && (mode === "merge" || cur.status !== "inactive")) continue;
        if ((cur[k] || "") !== (v || "")) diff[k] = v;
      }
      if (Object.keys(diff).length) { ops.push({ op: "merge", path: ["people", x.id], value: diff }); updated++; } else unchanged++;
    });
    if (mode === "replace") {
      Object.values(p.people).forEach((x) => { if (!used.has(x.id) && x.status !== "inactive") { ops.push({ op: "merge", path: ["people", x.id], value: { status: "inactive", leftAt: now() } }); removed++; } });
    }
    return { ops, added, updated, unchanged, removed, skipped, unresolved: [...unresolved] };
  }

  return { render, refresh, focus, importSheet, exportXlsx, exportCsv, esc, confirmBox };
})();
