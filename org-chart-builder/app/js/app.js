/* app.js — the shell: routes, top bar, View/Edit mode, global search, the chart screen (page list + chart +
   person panel), settings and the first-run screen. */
OC.app = (() => {
  const { h, $, $$, esc, toast, modal, confirmBox, promptBox, menu, debounce, norm, plural, ago, isTyping, slug } = OC.u;
  const M = () => OC.model, S = () => OC.store;
  const P = () => S().doc;

  let editing = false;
  try { editing = sessionStorage.getItem("ocb.edit") === "1"; } catch { /* ignore */ }
  let route = { view: "chart", page: null, person: null };
  let chartCtl = null, selectedId = null, sidebarArrange = false;
  const collapsedGroups = new Set();

  /* ---------------------------------------------------------------- routing */
  function parse() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    if (parts[0] === "people") return { view: "people" };
    if (parts[0] === "publish") return { view: "publish" };
    return { view: "chart", page: parts[1] || null, person: parts[2] || null };
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  const pageHash = (pid, person) => `#/chart/${encodeURIComponent(pid)}${person ? "/" + encodeURIComponent(person) : ""}`;

  /* ---------------------------------------------------------------- top bar */
  function renderTop() {
    $$(".nav-link").forEach((a) => a.classList.toggle("on", a.dataset.view === route.view));
    document.body.dataset.view = route.view;
    document.body.classList.toggle("editing", editing);
    const mt = $("#modeToggle");
    mt.innerHTML = "";
    mt.append(
      h("button.mode-btn" + (editing ? "" : ".on"), { type: "button", onclick: () => setEditing(false), title: "Look around without changing anything" }, "View"),
      h("button.mode-btn" + (editing ? ".on" : ""), { type: "button", onclick: () => setEditing(true), title: "Edit people, layouts and pages (E)" }, "Edit"));
    $("#brandOrg").textContent = P() ? P().organization : "";
    renderSync(); renderUser(); renderPresence();
  }
  async function setEditing(on) {
    if (on && !S().user()) { const n = await askName(); if (!n) return; }
    editing = on;
    try { sessionStorage.setItem("ocb.edit", on ? "1" : "0"); } catch { /* ignore */ }
    S().setPresence(route.view, editing);
    render();
  }
  function renderSync() {
    const el = $("#syncSlot"); if (!el) return;
    const st = S().status;
    const dirty = S().dirty();
    const pub = P() && P().published;
    el.innerHTML = "";
    const saveChip = st === "saving" ? h("span.sync-chip.saving", "Saving…")
      : st === "offline" ? h("span.sync-chip.off", { title: S().error }, `Offline · ${S().pending} unsaved`)
      : st === "error" ? h("span.sync-chip.off", { title: S().error }, "Save error")
      : h("span.sync-chip.ok", { title: S().mode === "server" ? `Saved on the team server (${S().server.host})` : "Saved in this browser only" }, S().mode === "server" ? "✓ Saved" : "✓ Saved locally");
    const pubChip = !P() ? null : h("a.sync-chip." + (dirty ? "draft" : "pub"), { href: "#/publish", title: pub ? `Version ${pub.version} published ${ago(pub.at)}${pub.by ? " by " + pub.by : ""}` : "Never published" },
      dirty ? (pub ? "Draft · unpublished changes" : "Draft · never published") : `Published v${pub.version}`);
    el.append(saveChip, pubChip);
  }
  function renderUser() { const b = $("#userChip"); if (b) b.textContent = S().user() ? S().user() : "Set your name"; }
  function renderPresence() {
    const el = $("#presence"); if (!el) return;
    el.innerHTML = "";
    const others = S().presence || [];
    others.slice(0, 4).forEach((x) => el.append(h("span.avatar" + (x.editing ? ".ed" : ""), { title: `${x.name}${x.editing ? " — editing" : " — viewing"}` }, OC.u.initials(x.name))));
    if (others.length > 4) el.append(h("span.avatar.more", `+${others.length - 4}`));
  }
  async function askName() {
    const n = await promptBox("Your name", { label: "Shown in the change history and to teammates who have the chart open.", value: S().user(), ok: "Continue", required: true });
    if (n) { S().setUser(n); renderUser(); }
    return n;
  }

  /* ---------------------------------------------------------------- global search */
  function searchItems(q) {
    const p = P(); const n = norm(q); if (!n) return [];
    const words = n.split(" ");
    const ix = M().index(p);
    const people = [];
    for (const x of ix.active) {
      const hay = norm(`${x.name} ${x.title} ${x.department} ${x.employeeNumber} ${x.email}`);
      if (!words.every((w) => hay.includes(w))) continue;
      const nameHit = norm(x.name).startsWith(n) ? 0 : norm(x.name).includes(n) ? 1 : 2;
      people.push({ kind: "person", x, rank: nameHit });
    }
    people.sort((a, b) => a.rank - b.rank || a.x.name.localeCompare(b.x.name));
    const pages = M().pages(p).filter((pg) => words.every((w) => norm(`${pg.title} ${pg.label} ${pg.subtitle}`).includes(w))).map((pg) => ({ kind: "page", pg }));
    return [...people.slice(0, 40), ...pages.slice(0, 12)];
  }
  function bindSearch() {
    const input = $("#search"), box = $("#searchResults");
    let items = [], active = 0;
    const close = () => { box.classList.add("hidden"); };
    const open = () => {
      items = searchItems(input.value);
      active = 0;
      box.innerHTML = "";
      if (!input.value.trim()) return close();
      if (!items.length) { box.append(h("div.sr-empty", "No matches")); box.classList.remove("hidden"); return; }
      let lastKind = null;
      items.forEach((it, i) => {
        if (it.kind !== lastKind) { box.append(h("div.sr-head", it.kind === "person" ? "People" : "Pages")); lastKind = it.kind; }
        const row = it.kind === "person"
          ? h("button.sr-item", { type: "button", dataset: { i } }, h("span.sr-av", OC.u.initials(it.x.name)), h("span.sr-main", h("b", it.x.name), h("span.sr-sub", [it.x.title, it.x.department].filter(Boolean).join(" · "))))
          : h("button.sr-item", { type: "button", dataset: { i } }, h("span.sr-av.pg", it.pg.kind === "divider" ? "§" : "▦"), h("span.sr-main", h("b", it.pg.title), h("span.sr-sub", it.pg.label)));
        row.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
        box.append(row);
      });
      hl(); box.classList.remove("hidden");
    };
    const hl = () => $$(".sr-item", box).forEach((b) => b.classList.toggle("on", Number(b.dataset.i) === active));
    const pick = (i) => {
      const it = items[i]; if (!it) return;
      input.value = ""; close(); input.blur();
      if (it.kind === "page") return go(pageHash(it.pg.id));
      showPerson(it.x.id);
    };
    input.addEventListener("input", debounce(open, 90));
    input.addEventListener("focus", () => input.value && open());
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); hl(); $(".sr-item.on", box)?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); hl(); $(".sr-item.on", box)?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); pick(active); }
      else if (e.key === "Escape") { input.value = ""; close(); input.blur(); }
    });
  }
  /* Go to the page that best shows this person and highlight them. */
  function showPerson(id, pageId = null) {
    const p = P();
    const here = pageId && M().pagesWith(p, id).find((x) => x.id === pageId);
    const pg = here || M().homePage(p, id) || (pageId && M().pageById(p, pageId));
    if (!pg) { toast("This person isn't on any chart page — opening their record", "info"); go("#/people"); setTimeout(() => OC.directory && OC.directory.focus(id), 50); return; }
    if (pg.hidden) toast(`“${pg.title}” is hidden from the published chart`, "info");
    selectedId = id;
    go(pageHash(pg.id, id));
  }

  /* ---------------------------------------------------------------- chart screen */
  function currentPages() { return M().pages(P(), { includeHidden: true }); }
  function visibleForNav() { return currentPages().filter((pg) => editing || !pg.hidden); }

  function renderChart(view) {
    const p = P();
    const list = visibleForNav();
    let pg = route.page && M().pageById(p, route.page);
    if (!pg) pg = list[0];
    if (!pg) {
      view.append(h("div.empty-big", h("h2", "No chart pages yet"), h("p.muted", "Add people (with managers) on the People screen, then choose the CEO and executives in Settings."),
        h("div.row", h("a.btn.btn-primary", { href: "#/people" }, "Open People"), h("button.btn", { onclick: openSettings }, "Settings"))));
      return;
    }
    if (route.person && route.person !== selectedId) selectedId = route.person;
    const layout = h("div.chart-screen" + (selectedId ? ".with-panel" : ""));
    const side = h("aside.sidebar");
    const main = h("section.chart-main");
    const panelHost = h("aside.panel-host");
    layout.append(side, main, panelHost);
    view.append(layout);
    renderSidebar(side, pg);
    renderPage(main, pg);
    if (selectedId && M().person(p, selectedId)) OC.panel.open(panelHost, selectedId, pg, panelApi(pg));
    else { selectedId = null; layout.classList.remove("with-panel"); }
  }

  function renderSidebar(side, current) {
    side.innerHTML = "";
    const p = P();
    const pages = currentPages().filter((pg) => editing || !pg.hidden);
    const head = h("div.side-head",
      h("div.side-title", "Pages", h("span.side-count", String(pages.filter((x) => x.kind === "chart").length))),
      editing ? h("button.mini-btn" + (sidebarArrange ? ".on" : ""), { type: "button", title: "Drag pages into a new order, hide pages", onclick: () => { sidebarArrange = !sidebarArrange; renderSidebar(side, current); } }, sidebarArrange ? "Done" : "Arrange") : null);
    const listEl = h("div.side-list" + (sidebarArrange ? ".arranging" : ""));
    let group = null, groupEl = null;
    pages.forEach((pg) => {
      if (!sidebarArrange && pg.kind === "divider") {
        group = pg.id;
        const collapsed = collapsedGroups.has(group);
        const g = group;
        groupEl = h("div.side-group" + (collapsed ? ".collapsed" : ""));
        listEl.append(h("button.side-divider" + (pg.id === current.id ? ".on" : "") + (pg.hidden ? ".is-hidden" : ""), { type: "button", onclick: (e) => {
          if (e.target.closest(".caret")) { collapsedGroups.has(g) ? collapsedGroups.delete(g) : collapsedGroups.add(g); renderSidebar(side, current); return; }
          go(pageHash(pg.id));
        } }, h("span.caret", collapsed ? "▸" : "▾"), h("span", pg.title)), groupEl);
        return;
      }
      const item = h("a.side-item" + (pg.id === current.id ? ".on" : "") + (pg.hidden ? ".is-hidden" : "") + (pg.kind === "divider" ? ".div" : ""), {
        href: pageHash(pg.id), dataset: { id: pg.id }, draggable: sidebarArrange ? "true" : null, title: pg.hidden ? "Hidden — not in the published chart" : pg.subtitle || "",
      },
      sidebarArrange ? h("span.grip", "⋮⋮") : null,
      h("span.side-ic", pg.kind === "divider" ? "§" : pg.branch ? "⌂" : pg.group === "Custom" ? "✦" : pg.id === "overview" ? "★" : "▦"),
      h("span.side-name", pg.title),
      pg.hidden ? h("span.side-hidden", "hidden") : null,
      sidebarArrange ? h("button.icon-btn.xs", { type: "button", title: pg.hidden ? "Show this page" : "Hide this page", onclick: (e) => { e.preventDefault(); e.stopPropagation(); OC.actions.togglePageHidden(pg); } }, pg.hidden ? "◌" : "◉") : null);
      (sidebarArrange || !groupEl ? listEl : groupEl).append(item);
    });
    if (sidebarArrange) {
      OC.u.sortable(listEl, { item: ".side-item", onDrop: (ids) => OC.actions.setPageOrder(ids) });
    }
    const foot = h("div.side-foot",
      editing ? h("button.add-btn", { type: "button", onclick: () => OC.actions.newCustomPage() }, h("span.plus", "+"), " New page") : null,
      h("div.side-stats", (() => { const st = M().stats(p); return `${plural(st.people, "person", "people")} · ${plural(st.units, "department")}${st.vacant ? ` · ${st.vacant} vacant` : ""}`; })()));
    side.append(head, listEl, foot);
    requestAnimationFrame(() => { const on = $(".side-item.on, .side-divider.on", listEl); if (on) on.scrollIntoView({ block: "nearest" }); });
  }

  function renderPage(main, pg) {
    main.innerHTML = "";
    const p = P();
    const list = visibleForNav();
    const i = list.findIndex((x) => x.id === pg.id);
    const prev = list[i - 1], next = list[i + 1];
    const header = h("div.page-head.blue-line",
      h("div.ph-text",
        h("div.ph-label", pg.label, pg.hidden ? h("span.chip.c-amber", "Hidden page") : null),
        h("h1.ph-title", pg.title),
        pg.subtitle ? h("div.ph-sub", pg.subtitle) : null),
      h("div.ph-actions",
        editing ? h("button.btn.btn-sm", { type: "button", onclick: () => OC.actions.editPageText(pg) }, "✎ Edit text") : null,
        h("button.icon-btn", { type: "button", title: "More", onclick: (e) => menu(e.currentTarget, pageMenu(pg), { align: "right" }) }, "⋯")));
    main.append(header);
    if (pg.kind === "divider") {
      main.append(h("div.divider-stage", { html: OC.chart.dividerMarkup(pg) }));
    } else {
      const stage = h("div.chart-stage");
      main.append(stage);
      if (chartCtl) chartCtl.destroy();
      chartCtl = OC.chart.mount(stage, pg, {
        editable: editing, selectedId,
        onSelect: (id, o = {}) => select(id, pg, o),
        onMenu: (id, at) => menu(at, OC.actions.cardMenu(id, pg, editing)),
        onToggle: (id, which) => OC.actions.toggleBranch(pg, id, which),
        onDrop: (from, to) => OC.actions.dropOn(pg, from, to),
      });
      const zl = h("button.zoom-label", { type: "button", title: "Actual size", onclick: () => chartCtl.setZoom(1) }, "100%");
      stage.append(h("div.zoom-bar",
        h("button.icon-btn.sm", { type: "button", title: "Zoom out (−)", onclick: () => chartCtl.zoomBy(1 / 1.2) }, "−"), zl,
        h("button.icon-btn.sm", { type: "button", title: "Zoom in (+)", onclick: () => chartCtl.zoomBy(1.2) }, "+"),
        h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Fit the chart (F)", onclick: () => chartCtl.fit("page") }, "Fit"),
        h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Fit to width (W)", onclick: () => chartCtl.fit("width") }, "Width")));
      chartCtl.bindZoomLabel(zl);
      stage.append(h("div.hint", editing ? "Drag a card onto someone to change who they report to · right-click for more · drag empty space to move around" : "Click a person for details · drag to move around · Ctrl + scroll to zoom"));
      if (route.person && route.person === selectedId) setTimeout(() => chartCtl && chartCtl.highlight(selectedId), 60);
    }
    main.append(h("div.page-nav",
      prev ? h("a.pn-btn", { href: pageHash(prev.id), title: "Previous page (←)" }, "‹ ", h("span", prev.title)) : h("span"),
      h("span.pn-pos", `${i + 1} of ${list.length}`),
      next ? h("a.pn-btn.next", { href: pageHash(next.id), title: "Next page (→)" }, h("span", next.title), " ›") : h("span")));
  }

  function pageMenu(pg) {
    const items = [
      { label: "Print / save as PDF…", icon: "⎙", onClick: () => OC.exporter.printDialog(pg.id) },
      { label: "Download the chart as HTML", icon: "◫", onClick: () => OC.exporter.downloadHtml() },
    ];
    if (editing) {
      items.push({ sep: true },
        { label: "Edit title & description", icon: "✎", onClick: () => OC.actions.editPageText(pg) },
        { label: pg.hidden ? "Show this page" : "Hide this page", icon: pg.hidden ? "◉" : "◌", onClick: () => OC.actions.togglePageHidden(pg) },
        pg.kind === "chart" ? { label: "Reset layout changes on this page", icon: "↺", onClick: () => OC.actions.resetPage(pg) } : null,
        pg.custom ? { label: pg.kind === "chart" ? "Page settings…" : "Edit section…", icon: "⚙", onClick: () => OC.actions.editCustomPage(pg.custom) } : null,
        pg.custom ? { label: "Delete this page", icon: "🗑", danger: true, onClick: () => OC.actions.deleteCustomPage(pg.custom) } : null,
        { sep: true },
        { label: "Insert a new page after this one", icon: "+", onClick: () => OC.actions.newCustomPage(pg.id) });
    }
    return items;
  }

  function select(id, pg, { open = false } = {}) {
    if (id && id.startsWith("x:")) { if (editing) OC.actions.editExtraCard(pg, id.slice(2)); return; }
    selectedId = id;
    history.replaceState(null, "", pageHash(pg.id, id || ""));
    route.person = id;
    const layout = $(".chart-screen"), host = $(".panel-host");
    if (!layout) return;
    chartCtl && chartCtl.select(id);
    if (!id) { layout.classList.remove("with-panel"); host.innerHTML = ""; return; }
    layout.classList.add("with-panel");
    OC.panel.open(host, id, pg, panelApi(pg));
    void open;
  }
  function panelApi(pg) {
    return {
      editing: () => editing,
      close: () => select(null, pg),
      showPerson: (id) => { const here = M().pagesWith(P(), id).find((x) => x.id === pg.id); if (here) { select(id, pg); chartCtl && chartCtl.highlight(id); } else showPerson(id); },
      goPage: (pid, person) => { selectedId = person || null; go(pageHash(pid, person)); },
    };
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    const view = $("#view");
    if (!P()) return renderWelcome(view);
    route = parse();
    if (chartCtl && route.view !== "chart") { chartCtl.destroy(); chartCtl = null; }
    renderTop();
    S().setPresence(route.view, editing);
    view.innerHTML = "";
    if (route.view === "people") OC.directory.render(view, { editing });
    else if (route.view === "publish") OC.publish.render(view, { editing });
    else renderChart(view);
  }
  /* Re-render after a change while keeping the chart's zoom/pan and the open panel. */
  const rerender = debounce(() => {
    if (!P()) return render();
    renderTop();
    if (route.view === "chart") {
      const main = $(".chart-main"), side = $(".sidebar");
      const pg = route.page ? M().pageById(P(), route.page) : visibleForNav()[0];
      if (!pg || !main || !chartCtl || pg.kind !== "chart" || $(".chart-stage") == null) return render();
      // same page: refresh in place
      renderSidebar(side, pg);
      const head = $(".page-head", main);
      if (head) { $(".ph-title", head).textContent = pg.title; const sub = $(".ph-sub", head); if (sub) sub.textContent = pg.subtitle; }
      chartCtl.refresh({ keepView: true });
      if (selectedId && M().person(P(), selectedId)) { chartCtl.select(selectedId); OC.panel.refresh(); }
      else if (selectedId) select(null, pg);
    } else if (route.view === "people") OC.directory.refresh();
    else if (route.view === "publish") render();
  }, 30);

  /* ---------------------------------------------------------------- settings */
  function openSettings() {
    const p = P();
    const st = Object.assign({}, p.settings);
    let org, title, ceoPick, execIds = p.executiveIds.slice();
    const execList = h("div.exec-list");
    const drawExecs = () => {
      execList.innerHTML = "";
      execIds.forEach((id, i) => {
        const x = M().person(p, id);
        execList.append(h("div.exec-row", { dataset: { id }, draggable: "true" }, h("span.grip", "⋮⋮"), h("span.exec-name", x ? x.name : "(missing)"), h("span.muted.small", x ? x.title : ""),
          h("span.spacer"), h("button.icon-btn.xs", { type: "button", title: "Remove", onclick: () => { execIds.splice(i, 1); drawExecs(); } }, "✕")));
      });
      if (!execIds.length) execList.append(h("div.muted.small", "No executives yet."));
    };
    drawExecs();
    OC.u.sortable(execList, { item: ".exec-row", onDrop: (ids) => { execIds = ids; } });
    const addExec = OC.ui.personPicker({ placeholder: "Add an executive…", onPick: (x) => { if (!execIds.includes(x.id)) execIds.push(x.id); addExec.clear(); drawExecs(); } });
    ceoPick = OC.ui.personPicker({ value: p.ceoId, placeholder: "Choose the top leader…" });
    const seg = (key, opts) => h("div.seg", opts.map(([v, l]) => h("button.seg-btn" + (st[key] === v ? ".on" : ""), { type: "button", onclick: (e) => { st[key] = v; $$(".seg-btn", e.currentTarget.parentNode).forEach((b) => b.classList.toggle("on", b === e.currentTarget)); } }, l)));
    const ck = (key, label) => h("label.ck", h("input", { type: "checkbox", checked: !!st[key], onchange: (e) => (st[key] = e.target.checked) }), label);
    const body = h("div.settings",
      h("div.frow",
        h("div.field", h("label.lbl", "Organization"), org = h("input.inp", { value: p.organization })),
        h("div.field.grow", h("label.lbl", "Chart title"), title = h("input.inp", { value: p.title }))),
      h("div.field", h("label.lbl", "Top leader (CEO)"), ceoPick.el, h("div.help", "Shown at the top of the Executive Overview.")),
      h("div.field", h("label.lbl", "Executive team"), h("div.help", "One Executive Overview card each, a direct-report page each, and their departments grouped into an executive area. Drag to reorder."), execList, addExec.el),
      h("h3", "Cards"),
      h("div.frow", h("div.field", h("label.lbl", "Style"), seg("theme", [["brand", "Brand"], ["classic", "Classic teal"]])),
        h("div.field", h("label.lbl", "Size"), seg("cardDensity", [["comfortable", "Comfortable"], ["compact", "Compact"]]))),
      h("div.checks", ck("showDept", "Show department on cards"), ck("showCounts", "Show organization size on manager cards")),
      h("h3", "Departments & branches"),
      h("div.help", "Whether each unit is a branch or a department, and which executive area it belongs to (Auto = where most of its people report)."),
      OC.actions.unitTable());
    return modal({
      title: "Settings", size: "lg", body,
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Save settings", kind: "primary", onClick: () => {
        const ops = [];
        if (org.value.trim() !== p.organization) ops.push({ op: "set", path: ["organization"], value: org.value.trim() || p.organization });
        if (title.value.trim() !== p.title) ops.push({ op: "set", path: ["title"], value: title.value.trim() || p.title });
        if ((ceoPick.value || "") !== p.ceoId) ops.push({ op: "set", path: ["ceoId"], value: ceoPick.value || "" });
        if (JSON.stringify(execIds) !== JSON.stringify(p.executiveIds)) ops.push({ op: "set", path: ["executiveIds"], value: execIds });
        if (JSON.stringify(st) !== JSON.stringify(p.settings)) ops.push({ op: "set", path: ["settings"], value: st });
        ops.push(...OC.actions.unitTableOps());
        if (ops.length) S().change(ops, "Settings");
      } }],
    });
  }

  /* ---------------------------------------------------------------- first run */
  function renderWelcome(view) {
    document.body.dataset.view = "welcome";
    view.innerHTML = "";
    const card = (icon, title, text, btn, fn, primary) => h("div.welcome-card", h("div.wc-ic", icon), h("h3", title), h("p.muted", text), h(`button.btn${primary ? ".btn-cta" : ""}`, { type: "button", onclick: fn }, btn));
    view.append(h("div.welcome",
      h("div.welcome-hero.notch", h("div.wh-plus", "+"), h("h1", "Org Chart Builder"), h("p", "Build, review and publish the organizational chart together.")),
      h("div.welcome-grid",
        card("⇪", "Bring in your existing chart", "Open the project from the old Org Chart Builder: the saved .json project, or the OrgChartBuilder.html file itself. Layouts, page order and custom pages come across.", "Open old project…", () => OC.actions.importProjectFile(true), true),
        card("▦", "Start from a spreadsheet", "Excel (.xlsx) or CSV with a row per person: name, title, department, manager…", "Import spreadsheet…", async () => { await S().replace(M().emptyProject(), "New chart"); boot2(); OC.directory.importSheet(); }),
        card("+", "Start an empty chart", "Add people one at a time.", "Start empty", async () => { const org = await promptBox("Organization name", { value: "", required: true, ok: "Create" }); if (!org) return; await S().replace(M().emptyProject(org), "New chart"); boot2(); go("#/people"); })),
      h("div.welcome-foot.muted.small", S().mode === "server" ? `Team server · data folder ${S().server.dataDir}` : "Local mode: the chart is saved in this browser only. Start the team server (Start_OrgChartBuilder.bat) to share it.")));
  }
  function boot2() { renderTop(); render(); }

  /* ---------------------------------------------------------------- keyboard */
  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      if (OC.u.topModalOpen() || isTyping(e)) return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z" && !e.shiftKey) { if (editing) { e.preventDefault(); S().undo(); } return; }
      if ((e.ctrlKey || e.metaKey) && (k.toLowerCase() === "y" || (k.toLowerCase() === "z" && e.shiftKey))) { if (editing) { e.preventDefault(); S().redo(); } return; }
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "k") { e.preventDefault(); $("#search").focus(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "/") { e.preventDefault(); $("#search").focus(); return; }
      if (k === "e" || k === "E") { setEditing(!editing); return; }
      if (route.view !== "chart") return;
      if (k === "ArrowRight" || k === "PageDown") { const n = $(".pn-btn.next"); if (n) { e.preventDefault(); n.click(); } }
      else if (k === "ArrowLeft" || k === "PageUp") { const pv = $(".pn-btn:not(.next)"); if (pv) { e.preventDefault(); pv.click(); } }
      else if (chartCtl && (k === "+" || k === "=")) chartCtl.zoomBy(1.2);
      else if (chartCtl && (k === "-" || k === "_")) chartCtl.zoomBy(1 / 1.2);
      else if (chartCtl && (k === "f" || k === "F")) chartCtl.fit("page");
      else if (chartCtl && (k === "w" || k === "W")) chartCtl.fit("width");
      else if (chartCtl && k === "0") chartCtl.setZoom(1);
      else if (k === "Escape" && selectedId) { const pg = M().pageById(P(), route.page) || visibleForNav()[0]; select(null, pg); }
      else if ((k === "Delete" || k === "Backspace") && editing && selectedId) OC.actions.removePerson(selectedId);
    });
  }

  function help() {
    const row = (k, t) => h("div.kb-row", h("span.kb-keys", k.split(" ").map((x) => h("kbd", x))), h("span", t));
    modal({ title: "Quick guide", size: "md", body: h("div.guide",
      h("a.btn.btn-cta.guide-link", { href: "docs/guide/index.html", target: "_blank", rel: "noopener" }, "Open the step-by-step guide (with pictures)"),
      h("p", h("b", "View"), " is for looking around. Switch to ", h("b", "Edit"), " (top right, or press E) to change people, layouts and pages. Every change saves on its own — there is no Save button — and can be undone."),
      h("h3", "On the chart"),
      h("ul",
        h("li", "Click a person to see their details. In Edit mode the panel lets you change anything about them."),
        h("li", "Drag a card onto another person to change who they report to."),
        h("li", "Right-click a card for more: add a report, add a vacancy, change how their team is laid out, hide them on this page, build a new page from them."),
        h("li", "The ", h("b", "+N"), " button under a card shows people that are folded away on this page; ", h("b", "−"), " folds a team away.")),
      h("h3", "Pages"),
      h("p", "Pages are built for you from the reporting lines: the Executive Overview, each executive's direct reports, then every department and branch grouped by executive area. In Edit mode use ", h("b", "Arrange"), " in the page list to reorder or hide pages, and ", h("b", "+ New page"), " for a custom page or a section divider."),
      h("h3", "Publishing"),
      h("p", "The chart you edit is the draft. ", h("b", "Publish"), " makes it official and saves a numbered version. To share the chart, download it from the Publish screen as a ", h("b", "PDF"), " or an ", h("b", "HTML file"), " and attach it to an email or save it to a shared folder. Earlier versions and automatic snapshots can be restored from the Publish screen."),
      h("h3", "Keys"),
      h("div.kb", row("/", "Search"), row("E", "View / Edit"), row("← →", "Previous / next page"), row("+ − 0", "Zoom in / out / 100%"), row("F W", "Fit chart / fit width"), row("Space", "Hold and drag to move around"), row("Ctrl Z", "Undo"), row("Ctrl Y", "Redo"), row("Esc", "Close the panel")),
      h("p.muted.small", `Version ${window.OC_BUILD} · ${S().mode === "server" ? "Team server " + S().server.host + " · data in " + S().server.dataDir : "Local mode (this browser only)"}`)) });
  }

  /* ---------------------------------------------------------------- boot */
  async function boot() {
    applyTheme(lsTheme());
    $("#btnTheme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    $("#btnHelp").onclick = help;
    $("#btnSettings").onclick = () => { if (!P()) return; if (!editing) return toast("Switch to Edit to change settings", "info"); openSettings(); };
    $("#userChip").onclick = askName;
    bindSearch(); bindKeys();
    try { await S().init(); }
    catch (e) { $("#view").innerHTML = ""; $("#view").append(h("div.empty-big", h("h2", "Couldn't load the chart"), h("p.muted", e.message), h("button.btn", { onclick: () => location.reload() }, "Try again"))); return; }
    S().on("change", () => rerender());
    S().on("remote", () => rerender());
    S().on("status", () => renderSync());
    S().on("presence", () => renderPresence());
    S().on("user", () => renderUser());
    window.addEventListener("hashchange", render);
    render();
    checkBuild();
  }
  function lsTheme() { try { return localStorage.getItem("ocb.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch { return "light"; } }
  function applyTheme(t) { document.documentElement.dataset.theme = t; $("#btnTheme").textContent = t === "dark" ? "☀" : "☾"; try { localStorage.setItem("ocb.theme", t); } catch { /* ignore */ } }
  function checkBuild() {
    // a browser that kept an old copy of the app offers a one-click reload
    if (S().mode === "server" && S().server.version !== window.OC_BUILD) {
      toast(`A newer version (${S().server.version}) is on the server.`, "info", 15000, { label: "Reload", onClick: () => location.reload() });
    }
  }

  return { boot, render, rerender, go, showPerson, setEditing, openSettings, get editing() { return editing; }, get chart() { return chartCtl; }, pageHash, get route() { return route; }, slug };
})();
