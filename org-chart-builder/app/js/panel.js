/* panel.js — the person panel beside the chart. View mode: who they are, where they sit, their team.
   Edit mode: every field edits in place (saved on change), plus team layout and page-only options. */
OC.panel = (() => {
  const { h, $$, plural } = OC.u;
  const M = () => OC.model, A = () => OC.actions;
  const P = () => OC.store.doc;
  let state = null; // { host, id, pg, api }

  function open(host, id, pg, api) { state = { host, id, pg, api }; draw(); }
  function refresh() { if (state && state.host.isConnected) { const pg = M().pageById(P(), state.pg.id) || state.pg; state.pg = pg; draw(); } }

  function draw() {
    const { host, id, pg, api } = state;
    const p = P(), x = M().person(p, id);
    // keep focus/selection if the user is typing in the panel while a sync re-render happens
    const focused = document.activeElement && host.contains(document.activeElement) ? document.activeElement.dataset.field : null;
    host.innerHTML = "";
    if (!x) return;
    const editing = api.editing();
    const reports = M().childrenOf(p, id);
    const org = M().headcount(p, id);
    const mgr = x.managerId && M().person(p, x.managerId);
    const chain = M().chain(p, id).reverse();
    const vac = x.type === "vacant";

    const head = h("div.pn-head",
      h("div.pn-av" + (vac ? ".vac" : ""), vac ? "◌" : OC.u.initials(x.name)),
      h("div.pn-id", h("div.pn-name", vac ? `Vacant${x.title ? " — " + x.title : ""}` : x.name), h("div.pn-title", vac ? (x.notes || "Open position") : x.title || "—")),
      h("button.icon-btn.pn-x", { type: "button", title: "Close (Esc)", onclick: api.close }, "✕"));
    const chips = h("div.pn-chips",
      x.department ? h("span.chip", M().isBranch(p, x.department) ? "⌂ " : "▦ ", x.department) : null,
      x.type !== "employee" ? h("span.chip.c-blue", M().TYPES[x.type]) : null,
      x.status === "leave" ? h("span.chip.c-amber", "On leave") : null,
      x.status === "inactive" ? h("span.chip.c-red", "Inactive") : null,
      p.ceoId === id ? h("span.chip.c-vivid", "CEO") : p.executiveIds.includes(id) ? h("span.chip.c-vivid", "Executive") : null);

    const crumbs = chain.length ? h("div.pn-chain", chain.map((m, i) => [i ? h("span.sep", "›") : null, h("button.link-btn", { type: "button", onclick: () => api.showPerson(m.id), title: m.title }, m.name)])) : null;

    let fields;
    if (editing) {
      const fld = (label, key, attrs = {}) => {
        const inp = h(attrs.multiline ? "textarea.inp" : "input.inp", { value: x[key] || "", dataset: { field: key }, rows: attrs.multiline ? 3 : null, placeholder: attrs.placeholder || "" }, attrs.multiline ? x[key] || "" : null);
        const commit = () => { if ((x[key] || "") !== inp.value.trim()) { if (!A().setField(id, key, inp.value.trim())) inp.value = x[key] || ""; } };
        inp.addEventListener("change", commit);
        if (!attrs.multiline) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } if (e.key === "Escape") { inp.value = x[key] || ""; inp.blur(); e.stopPropagation(); } });
        return h("div.field", h("label.lbl", label), inp);
      };
      const mgrPick = OC.ui.personPicker({ value: x.managerId, allowNone: true, exclude: (c) => c.id === id || M().descendants(p, id).has(c.id), onPick: (c) => A().setManager(id, c ? c.id : "") });
      const unit = OC.ui.unitInput(x.department, { dataset: { field: "department" } });
      unit.input.addEventListener("change", () => A().setField(id, "department", unit.input.value.trim()));
      const sel = (label, key, opts) => h("div.field", h("label.lbl", label), h("select.inp", { dataset: { field: key }, onchange: (e) => A().setField(id, key, e.target.value) }, Object.entries(opts).map(([k, l]) => h("option", { value: k, selected: x[key] === k }, l))));
      fields = h("div.pn-fields",
        fld(vac ? "Name (blank while vacant)" : "Name", "name"), fld("Job title", "title"),
        h("div.field", h("label.lbl", "Reports to"), mgrPick.el),
        h("div.field", h("label.lbl", "Department / branch"), unit.el),
        h("div.frow", sel("Type", "type", M().TYPES), sel("Status", "status", { active: "Active", leave: "On leave", inactive: "Inactive" })),
        h("div.frow", fld("Employee #", "employeeNumber"), fld("Phone", "phone")),
        fld("Email", "email"), fld("Location", "location"), fld("Notes", "notes", { multiline: true }));
    } else {
      const row = (k, v) => (v ? h("div.dl-row", h("dt", k), h("dd", v)) : null);
      fields = h("dl.pn-dl",
        row("Reports to", mgr ? h("button.link-btn", { type: "button", onclick: () => api.showPerson(mgr.id) }, mgr.name) : "—"),
        row("Department", x.department), row("Employee #", x.employeeNumber),
        row("Email", x.email ? h("a", { href: `mailto:${x.email}` }, x.email) : ""), row("Phone", x.phone), row("Location", x.location), row("Notes", x.notes));
    }

    const team = reports.length ? h("div.pn-sec",
      h("div.pn-sec-head", h("span", "Direct reports"), h("span.muted", `${reports.length}${org > reports.length ? ` · ${org} in organization` : ""}`)),
      h("div.pn-team", reports.map((r) => h("button.pn-person", { type: "button", onclick: () => api.showPerson(r.id) },
        h("span.av" + (r.type === "vacant" ? ".vac" : ""), r.type === "vacant" ? "◌" : OC.u.initials(r.name)),
        h("span.pp-main", h("b", r.type === "vacant" ? "Vacant" : r.name), h("span", r.title)),
        M().childrenOf(p, r.id).length ? h("span.pn-n", String(M().headcount(p, r.id))) : null)))) : null;

    let pageOpts = null;
    if (editing && pg.kind === "chart") {
      const st = p.pageState[pg.id] || {};
      const hasTeam = reports.length || Object.values(st.extra || {}).some((c) => c.parentId === id);
      const cur = M().layoutFor(p, pg.id, id);
      const everywhere = h("input", { type: "checkbox" });
      const style = (st.styles && st.styles[id]) || "auto";
      pageOpts = h("div.pn-sec",
        h("div.pn-sec-head", h("span", "On this page"), h("span.muted.small", pg.title)),
        hasTeam ? h("div.field", h("label.lbl", "Team layout"),
          h("div.seg.seg-wide.seg-sm", M().LAYOUTS.map((l) => h("button.seg-btn" + (cur === l.id ? ".on" : ""), { type: "button", title: l.hint, onclick: () => A().setLayout(pg, id, l.id, everywhere.checked) }, l.label))),
          h("div.row-between", h("label.ck.sm", everywhere, "Same on every page"), h("button.link-btn.small", { type: "button", onclick: () => A().reorderReports(pg, id) }, "Order team…"))) : null,
        h("div.field", h("label.lbl", "Card style"),
          h("div.seg.seg-wide.seg-sm", [["auto", "Automatic"], ["standard", "Standard"], ["passive", "Outlined"]].map(([v, l]) => h("button.seg-btn" + (style === v ? ".on" : ""), { type: "button", onclick: () => A().setStyle(pg, id, v) }, l)))),
        h("div.pn-links",
          h("button.link-btn.small", { type: "button", onclick: () => A().hideOnPage(pg, id) }, "Hide on this page"),
          h("button.link-btn.small", { type: "button", onclick: () => A().addExtraCard(pg, id) }, "+ Placeholder card under them"),
          h("button.link-btn.small", { type: "button", onclick: () => A().placeExistingHere(pg, id) }, "+ Show someone under them here")));
    }

    const pages = M().pagesWith(p, id);
    const where = pages.length ? h("div.pn-sec", h("div.pn-sec-head", h("span", "Appears on"), h("span.muted", plural(pages.length, "page"))),
      h("div.pn-pages", pages.map((q) => h("button.pn-page" + (q.id === pg.id ? ".on" : ""), { type: "button", onclick: () => api.goPage(q.id, id) }, q.title, q.hidden ? h("span.muted.small", " (hidden)") : null)))) : null;

    const actions = editing ? h("div.pn-actions",
      h("button.btn.btn-sm", { type: "button", onclick: () => A().addPerson({ managerId: id }) }, h("span.plus", "+"), " Direct report"),
      h("button.btn.btn-sm", { type: "button", onclick: () => A().addPerson({ managerId: id, type: "vacant", name: "" }) }, "◌ Vacancy"),
      h("button.btn.btn-sm", { type: "button", onclick: () => A().replacePerson(id) }, vac ? "✓ Fill vacancy" : "⇄ Replace"),
      h("button.btn.btn-sm.btn-danger-o", { type: "button", onclick: () => A().removePerson(id) }, "Remove")) : null;

    host.append(h("div.panel", head, chips, crumbs, actions, h("div.pn-body", fields, team, pageOpts, where)));
    if (focused) { const el = host.querySelector(`[data-field="${focused}"]`); if (el) el.focus(); }
    void $$;
  }

  return { open, refresh };
})();
