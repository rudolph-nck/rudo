/* actions.js — everything that changes the chart, shared by the chart's right-click menu, the person panel and the
   People screen. Each action is one undoable change (OC.store.change). */
OC.actions = (() => {
  const { h, $, $$, toast, modal, confirmBox, promptBox, uid, slug, now, clone, plural } = OC.u;
  const M = () => OC.model, S = () => OC.store;
  const P = () => S().doc;
  const name = (id) => { const x = M().person(P(), id); return x ? x.name : "?"; };
  const needEdit = () => { if (!OC.app.editing) { toast("Switch to Edit (top right) to make changes", "info"); return false; } return true; };

  /* ---------------------------------------------------------------- people */
  /* The person form, used for add and full edit. Resolves with the fields or null. */
  function personForm({ title = "Add person", person = {}, ok = "Add" } = {}) {
    const f = {};
    const mgr = OC.ui.personPicker({ value: person.managerId || "", allowNone: true, placeholder: "Who do they report to?", exclude: person.id ? (x) => x.id === person.id || M().descendants(P(), person.id).has(x.id) : null });
    const unit = OC.ui.unitInput(person.department || "");
    const sel = (key, opts, v) => (f[key] = h("select.inp", Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: k === v }, l))));
    const body = h("div.person-form",
      h("div.frow",
        h("div.field.grow", h("label.lbl", "Name ", h("span.req", "*")), f.name = h("input.inp", { value: person.type === "vacant" && !person.name ? "" : person.name || "", placeholder: person.type === "vacant" ? "Leave blank for a vacancy" : "First Last", autofocus: true })),
        h("div.field.grow", h("label.lbl", "Job title"), f.title = h("input.inp", { value: person.title || "" }))),
      h("div.frow",
        h("div.field.grow", h("label.lbl", "Reports to"), mgr.el),
        h("div.field.grow", h("label.lbl", "Department / branch"), unit.el)),
      h("div.frow",
        h("div.field", h("label.lbl", "Type"), sel("type", M().TYPES, person.type || "employee")),
        h("div.field", h("label.lbl", "Status"), sel("status", { active: "Active", leave: "On leave" }, person.status === "leave" ? "leave" : "active"))),
      h("div.frow",
        h("div.field", h("label.lbl", "Employee #"), f.employeeNumber = h("input.inp", { value: person.employeeNumber || "" })),
        h("div.field.grow", h("label.lbl", "Email"), f.email = h("input.inp", { type: "email", value: person.email || "" })),
        h("div.field", h("label.lbl", "Phone"), f.phone = h("input.inp", { value: person.phone || "" }))),
      h("div.field", h("label.lbl", "Notes"), f.notes = h("textarea.inp", { rows: 2 }, person.notes || "")));
    return modal({
      title, size: "md", body,
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: ok, kind: "primary", value: "ok", onClick: () => {
        if (!f.name.value.trim() && f.type.value !== "vacant") { f.name.classList.add("err"); f.name.focus(); return false; }
      } }],
    }).then((v) => v !== "ok" ? null : {
      name: f.name.value.trim() || (f.type.value === "vacant" ? "" : "Unnamed"), title: f.title.value.trim(), managerId: mgr.value, department: unit.input.value.trim(),
      type: f.type.value, status: f.status.value, employeeNumber: f.employeeNumber.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), notes: f.notes.value.trim(),
    });
  }
  function unitOps(dept) { // a new department name gets a units entry
    if (!dept || P().units[dept]) return [];
    return [{ op: "merge", path: ["units"], value: { [dept]: { type: /branch/i.test(dept) ? "branch" : "department" } } }];
  }
  async function addPerson(defaults = {}) {
    if (!needEdit()) return;
    const mgr = defaults.managerId ? M().person(P(), defaults.managerId) : null;
    const v = await personForm({ title: defaults.type === "vacant" ? "Add a vacant position" : mgr ? `Add someone reporting to ${mgr.name}` : "Add person",
      person: { department: mgr ? mgr.department : "", ...defaults }, ok: "Add" });
    if (!v) return null;
    const id = M().newPersonId(P(), v.name || v.title || "vacancy");
    S().change([...unitOps(v.department), { op: "set", path: ["people", id], value: { id, ...v, location: "" } }], `Add ${v.name || "vacancy"}`);
    toast(`${v.name || "Vacant position"} added`, "ok", 3000, { label: "Undo", onClick: () => S().undo() });
    setTimeout(() => OC.app.showPerson(id, OC.app.route.view === "chart" ? OC.app.route.page : null), 60);
    return id;
  }
  async function editPerson(id) {
    if (!needEdit()) return;
    const x = M().person(P(), id); if (!x) return;
    const v = await personForm({ title: `Edit ${x.name}`, person: x, ok: "Save" });
    if (!v) return;
    if (v.managerId && M().wouldLoop(P(), id, v.managerId)) return toast(`${name(v.managerId)} reports up to ${x.name}, so that would create a loop.`, "err", 5000);
    S().change([...unitOps(v.department), { op: "merge", path: ["people", id], value: v }], `Edit ${v.name}`);
  }
  /* Single-field update from the panel or the People table. */
  function setField(id, field, value) {
    const x = M().person(P(), id); if (!x || x[field] === value) return true;
    if (field === "managerId" && value && M().wouldLoop(P(), id, value)) { toast(`${name(value)} reports up to ${x.name}, so that would create a loop.`, "err", 5000); return false; }
    if (field === "name" && !String(value).trim() && x.type !== "vacant") { toast("Name can't be empty", "err"); return false; }
    S().change([...(field === "department" ? unitOps(value) : []), { op: "merge", path: ["people", id], value: { [field]: value } }], `Change ${x.name}'s ${LABELS[field] || field}`);
    return true;
  }
  const LABELS = { name: "name", title: "title", managerId: "manager", department: "department", type: "type", status: "status", email: "email", employeeNumber: "employee #", phone: "phone", notes: "notes", location: "location" };

  function setManager(id, mgrId) {
    const x = M().person(P(), id); if (!x) return;
    if (mgrId === x.managerId) return;
    if (mgrId && M().wouldLoop(P(), id, mgrId)) return toast(`${name(mgrId)} reports up to ${x.name}, so that would create a loop.`, "err", 5000);
    S().change([{ op: "merge", path: ["people", id], value: { managerId: mgrId } }], `${x.name} → reports to ${mgrId ? name(mgrId) : "nobody"}`);
    toast(`${x.name} now reports to ${mgrId ? name(mgrId) : "nobody"}`, "ok", 4000, { label: "Undo", onClick: () => S().undo() });
  }

  /* Drag & drop on the chart: change the manager (or, for page-only cards, their place on this page). */
  function dropOn(pg, from, to) {
    if (!needEdit()) return;
    if (from.startsWith("x:")) {
      S().change([{ op: "merge", path: ["pageState", pg.id, "extra", from.slice(2)], value: { parentId: to } }], "Move page-only card");
      return;
    }
    const x = M().person(P(), from), m = M().person(P(), to);
    if (!x || !m || x.managerId === to) return;
    if (M().wouldLoop(P(), from, to)) return toast(`${m.name} reports up to ${x.name}, so that would create a loop.`, "err", 5000);
    const st = P().pageState[pg.id] || {};
    const ops = [{ op: "merge", path: ["people", from], value: { managerId: to } }];
    if (st.links && st.links[from]) ops.push({ op: "merge", path: ["pageState", pg.id, "links"], value: { [from]: null } });
    S().change(ops, `${x.name} → reports to ${m.name}`);
    const stillHere = M().pagesWith(P(), from).some((q) => q.id === pg.id);
    toast(`${x.name} now reports to ${m.name}${stillHere ? "" : " (they no longer show on this page)"}`, "ok", 5000, { label: "Undo", onClick: () => S().undo() });
  }

  /* Remove someone: either the position goes too (reports reassigned one by one) or it stays as a vacancy. */
  async function removePerson(id) {
    if (!needEdit()) return;
    const p = P(), x = M().person(p, id); if (!x) return;
    const reports = M().childrenOf(p, id);
    let mode = x.type === "vacant" ? "remove" : "vacate";
    const pickers = reports.map((r) => ({ r, pick: OC.ui.personPicker({ value: x.managerId, allowNone: true, exclude: (c) => c.id === id || c.id === r.id || M().descendants(p, r.id).has(c.id) }) }));
    const all = OC.ui.personPicker({ value: x.managerId, allowNone: true, placeholder: "Everyone to…", exclude: (c) => c.id === id || M().descendants(p, id).has(c.id),
      onPick: (c) => pickers.forEach((q) => q.pick.set(c ? c.id : "")) });
    const reassign = h("div.reassign", reports.length ? [
      h("div.lbl", `${plural(reports.length, "direct report")} — who should each report to now?`),
      h("div.frow.apply-all", h("span.muted.small", "Apply to all:"), all.el),
      h("div.rs-list", pickers.map(({ r, pick }) => h("div.rs-row", h("div.rs-who", h("b", r.name), h("span.muted.small", r.title)), h("span.arrow", "→"), pick.el))),
    ] : h("div.muted", `${x.name} has no direct reports.`));
    const radio = (v, title, text) => h("label.choice", h("input", { type: "radio", name: "rm", value: v, checked: mode === v, onchange: () => { mode = v; reassign.classList.toggle("hidden", v === "vacate"); } }), h("div", h("b", title), h("div.muted.small", text)));
    const body = h("div",
      x.type !== "vacant" ? radio("vacate", "They're leaving — keep the position as a vacancy", `A “Vacant” ${x.title || "position"} card takes their place; ${reports.length ? "their team stays under it" : "nothing else changes"}.`) : null,
      radio("remove", "Remove the position too", "Their reports move to the managers you choose below."),
      reassign);
    if (mode === "vacate") reassign.classList.add("hidden");
    const ok = await modal({ title: `Remove ${x.name || "this vacancy"}`, size: "md", body, actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Remove", kind: "danger", value: "ok" }] });
    if (ok !== "ok") return;
    const ops = [];
    if (mode === "vacate") {
      const vid = M().newPersonId(p, `vacant-${x.title || x.name}`);
      ops.push({ op: "set", path: ["people", vid], value: { id: vid, name: "", title: x.title, department: x.department, managerId: x.managerId, type: "vacant", status: "active", email: "", employeeNumber: "", phone: "", location: x.location || "", notes: `Previously ${x.name}` } });
      reports.forEach((r) => ops.push({ op: "merge", path: ["people", r.id], value: { managerId: vid } }));
      ops.push({ op: "merge", path: ["people", id], value: { status: "inactive", leftAt: now() } });
      if (p.ceoId === id) ops.push({ op: "set", path: ["ceoId"], value: vid });
      if (p.executiveIds.includes(id)) ops.push({ op: "set", path: ["executiveIds"], value: p.executiveIds.map((e) => (e === id ? vid : e)) });
    } else {
      pickers.forEach(({ r, pick }) => ops.push({ op: "merge", path: ["people", r.id], value: { managerId: pick.value } }));
      ops.push({ op: "merge", path: ["people", id], value: { status: "inactive", leftAt: now() } });
      if (p.executiveIds.includes(id)) ops.push({ op: "set", path: ["executiveIds"], value: p.executiveIds.filter((e) => e !== id) });
    }
    S().change(ops, `Remove ${x.name || "vacancy"}`);
    toast(mode === "vacate" ? `${x.name}'s position is now vacant` : `${x.name || "Vacancy"} removed`, "ok", 5000, { label: "Undo", onClick: () => S().undo() });
  }

  /* Someone new takes over a position (or fills a vacancy): new record, same title/manager/team. */
  async function replacePerson(id) {
    if (!needEdit()) return;
    const p = P(), x = M().person(p, id); if (!x) return;
    const v = await personForm({ title: x.type === "vacant" ? `Fill ${x.title || "vacancy"}` : `Replace ${x.name}`, person: { title: x.title, department: x.department, managerId: x.managerId, type: "employee" }, ok: x.type === "vacant" ? "Fill position" : "Replace" });
    if (!v) return;
    const nid = M().newPersonId(p, v.name);
    const ops = [...unitOps(v.department), { op: "set", path: ["people", nid], value: { id: nid, ...v, location: x.location || "" } }];
    M().childrenOf(p, id).forEach((r) => ops.push({ op: "merge", path: ["people", r.id], value: { managerId: nid } }));
    ops.push({ op: "merge", path: ["people", id], value: { status: "inactive", leftAt: now() } });
    if (p.ceoId === id) ops.push({ op: "set", path: ["ceoId"], value: nid });
    if (p.executiveIds.includes(id)) ops.push({ op: "set", path: ["executiveIds"], value: p.executiveIds.map((e) => (e === id ? nid : e)) });
    S().change(ops, x.type === "vacant" ? `Fill vacancy with ${v.name}` : `Replace ${x.name} with ${v.name}`);
    OC.app.showPerson(nid);
  }

  /* ---------------------------------------------------------------- page-level arrangement */
  const ps = (pg) => P().pageState[pg.id] || {};
  function setLayout(pg, mgrId, mode, everywhere = false) {
    const target = everywhere ? "*" : pg.id;
    const ops = [{ op: "merge", path: ["pageState", target, "layouts"], value: { [mgrId]: mode === "auto" && everywhere ? null : mode } }];
    if (everywhere && ps(pg).layouts && ps(pg).layouts[mgrId]) ops.push({ op: "merge", path: ["pageState", pg.id, "layouts"], value: { [mgrId]: null } });
    S().change(ops, `${name(mgrId)}'s team: ${M().LAYOUTS.find((l) => l.id === mode).label}`);
  }
  function setStyle(pg, id, style) { S().change([{ op: "merge", path: ["pageState", pg.id, "styles"], value: { [id]: style === "auto" ? null : style } }], "Card style"); }
  function hideOnPage(pg, id) {
    if (!needEdit()) return;
    if (id.startsWith("x:")) return removeExtraCard(pg, id.slice(2));
    S().change([{ op: "merge", path: ["pageState", pg.id, "hiddenCards"], value: { [id]: 1 } }], `Hide ${name(id)} on this page`);
    toast(`${name(id)} (and anyone under them) hidden on this page only`, "ok", 5000, { label: "Undo", onClick: () => S().undo() });
  }
  function unhideAll(pg) { S().change([{ op: "set", path: ["pageState", pg.id, "hiddenCards"], value: null }], "Show hidden cards"); }
  function toggleBranch(pg, id, which) {
    const st = ps(pg);
    if (which === "open") {
      if (st.collapsed && st.collapsed[id]) S().change([{ op: "merge", path: ["pageState", pg.id, "collapsed"], value: { [id]: null } }], "Show team", { undoable: OC.app.editing });
      else S().change([{ op: "merge", path: ["pageState", pg.id, "expanded"], value: { [id]: 1 } }], "Show next level", { undoable: OC.app.editing });
    } else {
      const ops = [{ op: "merge", path: ["pageState", pg.id, "collapsed"], value: { [id]: 1 } }];
      if (st.expanded && st.expanded[id]) ops.push({ op: "merge", path: ["pageState", pg.id, "expanded"], value: { [id]: null } });
      S().change(ops, "Fold team away", { undoable: OC.app.editing });
    }
    if (!OC.app.editing) toast("Shown for everyone — switch to Edit to arrange pages deliberately", "info", 2200);
  }
  async function reorderReports(pg, mgrId) {
    if (!needEdit()) return;
    const tree = M().pageTree(P(), pg);
    const find = (nodes) => { for (const n of nodes) { if (n.id === mgrId) return n; const f = find(n.kids); if (f) return f; } return null; };
    const node = find(tree.roots);
    const kids = node ? node.kids : M().childrenOf(P(), mgrId).map((x) => ({ id: x.id, p: x }));
    if (kids.length < 2) return toast("Nothing to reorder", "info");
    let order = kids.map((k) => k.id);
    const list = h("div.sort-list", kids.map((k) => h("div.sort-row", { dataset: { id: k.id }, draggable: "true" }, h("span.grip", "⋮⋮"), h("b", k.p.name || "Vacant"), h("span.muted.small", k.p.title))));
    OC.u.sortable(list, { item: ".sort-row", onDrop: (ids) => (order = ids) });
    let all;
    const v = await modal({ title: `Order ${name(mgrId)}'s team`, size: "sm",
      body: h("div", h("p.muted.small", "Drag into the order they should appear (left to right / top to bottom)."), list,
        h("label.ck.sm", all = h("input", { type: "checkbox" }), "Use this order on every page")),
      actions: [{ label: "A → Z", value: "az" }, { spacer: true }, { label: "Cancel", value: null }, { label: "Save order", kind: "primary", value: "ok" }] });
    if (!v) return;
    const target = all.checked ? "*" : pg.id;
    S().change([{ op: "merge", path: ["pageState", target, "order"], value: { [mgrId]: v === "az" ? null : order } }], `Order ${name(mgrId)}'s team`);
  }
  function resetPage(pg) {
    confirmBox("Reset this page?", "Layouts, ordering, card styles, folded/hidden cards and page-only cards on this page go back to automatic. People and reporting lines aren't touched.", { ok: "Reset page", kind: "danger" }).then((ok) => {
      if (!ok) return;
      const st = ps(pg);
      S().change(["layouts", "order", "styles", "hiddenCards", "collapsed", "expanded", "links", "extra"].filter((k) => st[k]).map((k) => ({ op: "set", path: ["pageState", pg.id, k], value: null })), "Reset page");
    });
  }

  /* page-only cards (placeholders that aren't people in the directory) */
  async function addExtraCard(pg, parentId) {
    if (!needEdit()) return;
    const f = {};
    const v = await modal({ title: "Add a card to this page only", size: "sm", body: h("div",
      h("p.muted.small", "For placeholders such as a vendor, a committee or a future team. It isn't added to the People list."),
      h("div.field", h("label.lbl", "Name"), f.name = h("input.inp", { autofocus: true })),
      h("div.field", h("label.lbl", "Title"), f.title = h("input.inp")),
      h("div.field", h("label.lbl", "Department"), f.dept = h("input.inp"))),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Add card", kind: "primary", value: "ok" }] });
    if (v !== "ok") return;
    const xid = uid("card");
    S().change([{ op: "merge", path: ["pageState", pg.id, "extra"], value: { [xid]: { name: f.name.value.trim() || "New card", title: f.title.value.trim(), department: f.dept.value.trim(), parentId, type: "employee" } } }], "Add page-only card");
  }
  async function editExtraCard(pg, xid) {
    const c = (ps(pg).extra || {})[xid]; if (!c) return;
    const f = {};
    const v = await modal({ title: "Page-only card", size: "sm", body: h("div",
      h("div.field", h("label.lbl", "Name"), f.name = h("input.inp", { value: c.name, autofocus: true })),
      h("div.field", h("label.lbl", "Title"), f.title = h("input.inp", { value: c.title })),
      h("div.field", h("label.lbl", "Department"), f.dept = h("input.inp", { value: c.department }))),
      actions: [{ label: "Delete card", kind: "danger-o", value: "del" }, { spacer: true }, { label: "Cancel", value: null }, { label: "Save", kind: "primary", value: "ok" }] });
    if (v === "del") return removeExtraCard(pg, xid);
    if (v !== "ok") return;
    S().change([{ op: "merge", path: ["pageState", pg.id, "extra", xid], value: { name: f.name.value.trim() || "Card", title: f.title.value.trim(), department: f.dept.value.trim() } }], "Edit page-only card");
  }
  function removeExtraCard(pg, xid) {
    const extra = ps(pg).extra || {};
    const ops = [{ op: "merge", path: ["pageState", pg.id, "extra"], value: { [xid]: null } }];
    for (const [k, c] of Object.entries(extra)) if (c.parentId === `x:${xid}`) ops.push({ op: "merge", path: ["pageState", pg.id, "extra"], value: { [k]: null } });
    S().change(ops, "Remove page-only card");
  }
  /* Show an existing person under someone on this page only (their real manager doesn't change). */
  async function placeExistingHere(pg, parentId) {
    if (!needEdit()) return;
    let picked = null;
    const pick = OC.ui.personPicker({ placeholder: "Find a person…", onPick: (x) => (picked = x), exclude: (x) => x.id === parentId || M().descendants(P(), x.id).has(parentId) });
    const v = await modal({ title: `Show someone under ${name(parentId)} on this page`, size: "sm", body: h("div", h("p.muted.small", "Their real manager in the directory stays the same; only this page shows them here."), pick.el),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Place here", kind: "primary", value: "ok" }] });
    if (v !== "ok" || !picked) return;
    const ops = [{ op: "merge", path: ["pageState", pg.id, "links"], value: { [picked.id]: parentId } }];
    if (ps(pg).hiddenCards && ps(pg).hiddenCards[picked.id]) ops.push({ op: "merge", path: ["pageState", pg.id, "hiddenCards"], value: { [picked.id]: null } });
    S().change(ops, `Show ${picked.name} under ${name(parentId)} on this page`);
  }

  /* ---------------------------------------------------------------- pages */
  function setPageOrder(ids) {
    const all = M().pages(P()).map((pg) => pg.id);
    const rest = all.filter((id) => !ids.includes(id));
    S().change([{ op: "set", path: ["pageOrder"], value: [...ids, ...rest] }], "Reorder pages");
  }
  function togglePageHidden(pg) {
    S().change([{ op: "merge", path: ["pageState", pg.id], value: { hidden: pg.hidden ? null : true } }], pg.hidden ? `Show “${pg.title}”` : `Hide “${pg.title}”`);
  }
  async function editPageText(pg) {
    if (!needEdit()) return;
    const f = {};
    const d = pg.defaults || pg;
    const v = await modal({ title: "Page title & description", size: "md", body: h("div",
      h("div.field", h("label.lbl", "Small label above the title"), f.label = h("input.inp", { value: pg.label, placeholder: d.label })),
      h("div.field", h("label.lbl", "Title"), f.title = h("input.inp", { value: pg.title, placeholder: d.title, autofocus: true })),
      h("div.field", h("label.lbl", "Description"), f.sub = h("textarea.inp", { rows: 2, placeholder: d.subtitle }, pg.subtitle || "")),
      pg.custom ? null : h("p.muted.small", "Pages built from the reporting lines keep updating; text you change here stays as you wrote it. Clear a box to go back to the automatic text.")),
      actions: [pg.custom ? null : { label: "Use automatic text", value: "reset" }, { spacer: true }, { label: "Cancel", value: null }, { label: "Save", kind: "primary", value: "ok" }].filter(Boolean) });
    if (!v) return;
    if (pg.custom) {
      if (v === "ok") S().change([{ op: "merge", path: ["customPages", pg.custom.id], value: { label: f.label.value.trim(), title: f.title.value.trim() || "Untitled page", subtitle: f.sub.value.trim() } }], "Edit page text");
      return;
    }
    const val = (inp, def) => { const t = inp.value.trim(); return v === "reset" || !t || t === def ? null : t; };
    S().change([{ op: "merge", path: ["pageState", pg.id], value: { label: val(f.label, d.label), title: val(f.title, d.title), subtitle: v === "reset" || f.sub.value.trim() === (d.subtitle || "") ? null : f.sub.value.trim() } }], "Edit page text");
  }
  async function customPageForm(c = {}) {
    let kind = c.kind || "chart";
    const f = {};
    const root = OC.ui.personPicker({ value: c.rootId || "", placeholder: "Who is at the top of this page?" });
    const chartFields = h("div",
      h("div.field", h("label.lbl", "Starts with"), root.el),
      h("div.frow",
        h("div.field", h("label.lbl", "Show"), f.depth = h("select.inp", [[1, "Their direct reports"], [2, "Two levels"], [3, "Three levels"], [0, "Their whole organization"]].map(([v, l]) => h("option", { value: v, selected: Number(c.depth == null ? 1 : c.depth) === v }, l)))),
        h("div.field", h("label.lbl", " "), h("label.ck", f.ctx = h("input", { type: "checkbox", checked: !!c.context }), "Show their management chain above"))));
    const seg = h("div.seg.seg-wide", [["chart", "Chart page"], ["divider", "Section divider"]].map(([v, l]) => h("button.seg-btn" + (kind === v ? ".on" : ""), { type: "button", onclick: (e) => { kind = v; $$(".seg-btn", seg).forEach((b) => b.classList.toggle("on", b === e.currentTarget)); chartFields.classList.toggle("hidden", v !== "chart"); } }, l)));
    if (kind !== "chart") chartFields.classList.add("hidden");
    const v = await modal({ title: c.id ? "Page settings" : "New page", size: "md", body: h("div",
      c.id ? null : seg,
      h("div.field", h("label.lbl", "Title"), f.title = h("input.inp", { value: c.title || "", autofocus: true, placeholder: "e.g. Digital Transformation Team" })),
      h("div.frow", h("div.field", h("label.lbl", "Small label"), f.label = h("input.inp", { value: c.label || "", placeholder: kind === "chart" ? "Department reporting page" : "Section" })),
        h("div.field.grow", h("label.lbl", "Description"), f.sub = h("input.inp", { value: c.subtitle || "" }))),
      chartFields),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: c.id ? "Save" : "Create page", kind: "primary", value: "ok", onClick: () => {
        if (!f.title.value.trim() && !(kind === "chart" && root.value)) { f.title.classList.add("err"); f.title.focus(); return false; }
      } }] });
    if (v !== "ok") return null;
    return { kind, title: f.title.value.trim() || name(root.value), label: f.label.value.trim(), subtitle: f.sub.value.trim(), rootId: kind === "chart" ? root.value : "", depth: Number(f.depth.value), context: f.ctx.checked };
  }
  async function newCustomPage(afterId = null, preset = {}) {
    if (!needEdit()) return;
    const v = preset.rootId && preset.quick ? { kind: "chart", title: preset.title, label: "", subtitle: "", rootId: preset.rootId, depth: preset.depth, context: true } : await customPageForm(preset);
    if (!v) return;
    const id = slug(v.title) + "-" + Math.random().toString(36).slice(2, 5);
    const order = M().pages(P()).map((pg) => pg.id);
    const at = afterId ? order.indexOf(afterId) + 1 : order.length;
    order.splice(at, 0, `custom:${id}`);
    S().change([{ op: "set", path: ["customPages", id], value: { id, ...v, createdAt: now() } }, { op: "set", path: ["pageOrder"], value: order }], `New page “${v.title}”`);
    OC.app.go(OC.app.pageHash(`custom:${id}`));
  }
  async function editCustomPage(c) {
    const v = await customPageForm(c); if (!v) return;
    S().change([{ op: "merge", path: ["customPages", c.id], value: v }], `Edit page “${v.title}”`);
  }
  async function deleteCustomPage(c) {
    if (!(await confirmBox(`Delete “${c.title}”?`, "The page and its arrangement are removed. People aren't affected.", { ok: "Delete page", kind: "danger" }))) return;
    S().change([{ op: "set", path: ["customPages", c.id], value: null }, { op: "set", path: ["pageState", `custom:${c.id}`], value: null }, { op: "set", path: ["pageOrder"], value: P().pageOrder.filter((x) => x !== `custom:${c.id}`) }], `Delete page “${c.title}”`);
    toast("Page deleted", "ok", 5000, { label: "Undo", onClick: () => S().undo() });
    OC.app.go("#/chart");
  }

  /* ---------------------------------------------------------------- menus */
  function cardMenu(id, pg, editing) {
    const p = P();
    if (id.startsWith("x:")) {
      return editing ? [
        { label: "Edit card", icon: "✎", onClick: () => editExtraCard(pg, id.slice(2)) },
        { label: "Add a page-only card under it", icon: "+", onClick: () => addExtraCard(pg, id) },
        { sep: true }, { label: "Delete card", icon: "🗑", danger: true, onClick: () => removeExtraCard(pg, id.slice(2)) }] : [{ header: "Page-only card" }];
    }
    const x = M().person(p, id); if (!x) return [];
    const st = ps(pg);
    const hasTeam = M().childrenOf(p, id).length > 0 || Object.values(st.extra || {}).some((c) => c.parentId === id) || Object.values(st.links || {}).includes(id);
    const home = M().homePage(p, id);
    const view = [
      { header: x.name || "Vacant position" },
      { label: "Details", icon: "ⓘ", onClick: () => OC.app.showPerson(id, pg.id) },
      home && home.id !== pg.id ? { label: `Go to ${home.title}`, icon: "→", onClick: () => OC.app.showPerson(id, home.id) } : null,
      x.managerId ? { label: `Go to their manager (${name(x.managerId)})`, icon: "↑", onClick: () => OC.app.showPerson(x.managerId) } : null,
    ];
    if (!editing) return [...view, { sep: true }, { label: "Copy name & title", icon: "⧉", onClick: () => OC.u.copyText(`${x.name}, ${x.title}`) }];
    const layoutItems = M().LAYOUTS.map((l) => ({ label: l.label, hint: l.hint, checked: M().layoutFor(p, pg.id, id) === l.id, onClick: () => setLayout(pg, id, l.id) }));
    const style = (st.styles && st.styles[id]) || "auto";
    return [
      ...view, { sep: true },
      { label: "Edit…", icon: "✎", onClick: () => editPerson(id) },
      { label: "Add a direct report…", icon: "+", onClick: () => addPerson({ managerId: id }) },
      { label: "Add a vacant position under them…", icon: "◌", onClick: () => addPerson({ managerId: id, type: "vacant", name: "" }) },
      x.type === "vacant" ? { label: "Fill this vacancy…", icon: "✓", onClick: () => replacePerson(id) } : { label: "Replace with someone new…", icon: "⇄", onClick: () => replacePerson(id) },
      { sep: true },
      hasTeam ? { label: "Team layout", icon: "▤", sub: [...layoutItems, { sep: true }, { label: "Order the team…", onClick: () => reorderReports(pg, id) }] } : null,
      { label: "Card style on this page", icon: "◐", sub: [["auto", "Automatic"], ["standard", "Standard"], ["passive", "Outlined (context)"]].map(([v, l]) => ({ label: l, checked: style === v, onClick: () => setStyle(pg, id, v) })) },
      { label: "On this page only", icon: "▦", sub: [
        { label: "Hide them (and their team)", onClick: () => hideOnPage(pg, id) },
        { label: "Show an existing person under them…", onClick: () => placeExistingHere(pg, id) },
        { label: "Add a placeholder card under them…", onClick: () => addExtraCard(pg, id) },
      ] },
      { label: "New page starting from them", icon: "✦", sub: [
        { label: "Direct reports", onClick: () => newCustomPage(pg.id, { rootId: id, quick: true, title: x.name, depth: 1 }) },
        { label: "Whole organization", onClick: () => newCustomPage(pg.id, { rootId: id, quick: true, title: `${x.name} — Organization`, depth: 0 }) },
      ] },
      { sep: true },
      { label: "Remove…", icon: "🗑", danger: true, onClick: () => removePerson(id) },
    ];
  }

  /* ---------------------------------------------------------------- units table (Settings) */
  let unitDraft = {};
  function unitTable() {
    const p = P();
    unitDraft = {};
    const execs = p.executiveIds.map((id) => M().person(p, id)).filter(Boolean);
    const groups = new Map(M().unitGroups(p).map((g) => [g.name, g]));
    const rows = M().unitNames(p).map((u) => {
      const cur = p.units[u] || { type: "department" };
      const g = groups.get(u);
      const auto = g && g.owner && !cur.ownerId ? `Auto (${name(g.owner)})` : "Auto";
      return h("tr", h("td", h("b", u), h("span.muted.small", ` · ${(M().index(p).byUnit.get(u) || []).length}`)),
        h("td", h("select.inp.sm", { onchange: (e) => ((unitDraft[u] = unitDraft[u] || {}).type = e.target.value) }, h("option", { value: "department", selected: cur.type !== "branch" }, "Department"), h("option", { value: "branch", selected: cur.type === "branch" }, "Branch"))),
        h("td", h("select.inp.sm", { onchange: (e) => ((unitDraft[u] = unitDraft[u] || {}).ownerId = e.target.value) }, h("option", { value: "" }, auto), execs.map((e) => h("option", { value: e.id, selected: cur.ownerId === e.id }, e.name)))));
    });
    return h("div.unit-table-wrap", h("table.tbl.unit-table", h("thead", h("tr", h("th", "Name"), h("th", "Type"), h("th", "Executive area"))), h("tbody", rows)));
  }
  function unitTableOps() {
    const ops = Object.entries(unitDraft).map(([u, d]) => ({ op: "merge", path: ["units", u], value: { type: d.type || (P().units[u] || {}).type || "department", ...(d.ownerId !== undefined ? { ownerId: d.ownerId || null } : {}) } }));
    unitDraft = {};
    return ops;
  }

  /* ---------------------------------------------------------------- project files */
  async function importProjectFile(firstRun = false) {
    const file = await OC.u.pickFile(".json,.html,.htm,.orgproj,application/json,text/html");
    if (!file) return;
    let doc;
    try { doc = M().importAny(await OC.u.readFile(file)); }
    catch (e) { return toast(e.message, "err", 6000); }
    const st = M().stats(doc);
    if (!firstRun && P()) {
      const ok = await confirmBox("Replace the chart with this file?", h("div", h("p", `“${file.name}” has ${plural(st.people, "person", "people")} in ${plural(st.units, "department")}.`),
        h("p.muted", "The current chart is saved as a snapshot first, so you can go back to it from Publish → History.")), { ok: "Replace chart", kind: "danger" });
      if (!ok) return;
    }
    if (!S().user()) await OC.u.promptBox("Your name", { label: "Shown in the change history.", required: true, ok: "Continue" }).then((n) => n && S().setUser(n));
    await S().replace(doc, `Imported ${file.name}`);
    toast(`Loaded ${plural(st.people, "person", "people")} from ${file.name}`, "ok", 4000);
    OC.app.go("#/chart");
    OC.app.render();
    const issues = M().health(S().doc).filter((i) => i.level === "error");
    if (issues.length) setTimeout(() => toast(`${plural(issues.length, "problem")} to review on the People screen`, "warn", 6000), 800);
  }
  function exportProjectFile() {
    const d = clone(P()); delete d._v;
    OC.u.download(`${slug(d.organization)}-org-chart-${OC.u.fmtDate(now())}.json`, JSON.stringify({ kind: "org-chart-builder/project", version: 2, exportedAt: now(), doc: d }, null, 1));
  }

  return {
    personForm, addPerson, editPerson, setField, setManager, dropOn, removePerson, replacePerson,
    setLayout, setStyle, hideOnPage, unhideAll, toggleBranch, reorderReports, resetPage, addExtraCard, editExtraCard, removeExtraCard, placeExistingHere,
    setPageOrder, togglePageHidden, editPageText, newCustomPage, editCustomPage, deleteCustomPage, cardMenu, unitTable, unitTableOps,
    importProjectFile, exportProjectFile, LABELS,
  };
})();
