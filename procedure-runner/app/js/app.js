/* app.js — shell: routing, identity, theme, library (home), shared widgets. */
PR.views = PR.views || {};

PR.app = (() => {
  const { h, $, $$, esc, toast, modal, confirmBox, promptBox, menu, fmtDate, fmtDur, fmtMin, ago, now, uid, clone, download, pickFile } = PR.u;
  const S = () => PR.store.b;

  /* ---------------- identity & prefs ---------------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("pr_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("pr_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  let me = LS.get("me", "");
  async function askName(force) {
    if (me && !force) return me;
    const v = await promptBox(force ? "Change your name" : "Welcome! Who's operating?", {
      label: "Your name is stamped on every step you start or complete, so the run record shows who did what.",
      value: me, placeholder: "e.g. Jane Smith", ok: "Continue", required: true,
    });
    if (v && v.trim()) { me = v.trim(); LS.set("me", me); renderUser(); }
    return me || "Operator";
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    LS.set("theme", t);
    const b = $("#btnTheme"); if (b) b.textContent = t === "dark" ? "☀" : "☾";
  }

  /* ---------------- routing ---------------- */
  let current = null;
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  async function route() {
    PR.u.closeMenus();
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").map(decodeURIComponent);
    const [name, ...args] = parts;
    const view = { "": "library", edit: "builder", run: "runner", report: "report", history: "history", runs: "runs", lessons: "lessons", comms: "comms", live: "live", print: "print", compare: "compare", teams: "teams" }[name || ""] || "library";
    if (current && current.unmount) { try { const ok = await current.unmount(); if (ok === false) return; } catch (e) { console.error(e); } }
    const host = $("#view");
    host.innerHTML = ""; host.className = `view view-${view}`;
    document.body.dataset.view = view;
    $$(".nav-link").forEach((a) => a.classList.toggle("on", a.dataset.view === view));
    current = PR.views[view];
    try { await current.mount(host, ...args); }
    catch (e) { console.error(e); host.appendChild(h("div.empty", h("div.empty-title", "Something went wrong"), h("div.muted", String(e.message || e)), h("button.btn", { onclick: () => go("#/") }, "Back to library"))); }
  }

  /* ---------------- shared widgets ---------------- */
  function thumb(it) {
    const isImg = (it.type || "").startsWith("image") || /^data:image/.test(it.ref || "");
    const node = h("a.thumb", { href: "#", title: `${it.name || ""} — ${it.by || ""} ${PR.u.fmtTime(it.at)}`, onclick: async (e) => { e.preventDefault(); const u = await PR.store.resolveURL(it.ref); isImg ? lightbox(u) : window.open(u, "_blank"); } },
      isImg ? h("img", { alt: it.name || "" }) : h("span.thumb-file", "📄 ", it.name || "file"));
    if (isImg) PR.store.resolveURL(it.ref).then((u) => { node.querySelector("img").src = u; });
    return node;
  }
  function lightbox(src) {
    const back = h("div.lightbox", { onclick: () => back.remove() }, h("img", { src }));
    document.body.appendChild(back);
  }
  function statusChip(s) {
    const map = { draft: ["Draft", "c-amber"], published: ["Published", "c-green"], archived: ["Archived", "c-gray"], setup: ["Setting up", "c-blue"], active: ["In progress", "c-blue"], paused: ["Halted", "c-amber"], completed: ["Completed", "c-green"], aborted: ["Aborted", "c-red"] };
    const [l, c] = map[s] || [s, "c-gray"];
    return h(`span.chip.${c}`, l);
  }
  function syncChip() {
    const local = PR.store.kind === "local";
    return h(`span.sync-chip.${local ? "local" : "shared"}`, {
      title: local ? "Data is saved in this browser only. Start the app with Start_ProcedureRunner.bat to share procedures and runs with the team." : `Shared team data: ${(S().info && S().info.dataDir) || "server"}`,
      onclick: () => local && modal({ title: "Local mode", size: "md", body: h("div.prose", { html: `<p>You opened the app without the team server, so everything is saved <b>in this browser only</b>.</p><p>To share procedures and run a failover with several operators at once, double-click <code>Start_ProcedureRunner.bat</code> (or run <code>py server.py</code>) and open the address it prints. Teammates open the same address.</p><p>You can move work between modes with <b>Export / Import JSON</b>.</p>` }), actions: [{ label: "OK", kind: "primary" }] }),
    }, local ? "● Local only" : "● Shared");
  }
  function renderUser() {
    const u = $("#userChip"); if (u) u.textContent = me ? `👤 ${me}` : "👤 Set name";
    const s = $("#syncSlot"); if (s) { s.innerHTML = ""; s.appendChild(syncChip()); }
  }
  async function refreshPeople() {
    try {
      const set = await S().getSettings();
      const dl = $("#peopleList");
      dl.innerHTML = "";
      [...new Set([me, ...(set.people || [])].filter(Boolean))].forEach((p) => dl.appendChild(h("option", { value: p })));
    } catch { /* ignore */ }
  }
  async function rememberPeople(names) {
    try {
      const set = await S().getSettings();
      const people = [...new Set([...(set.people || []), ...names.filter(Boolean)])].slice(-200);
      await S().saveSettings({ ...set, people });
      refreshPeople();
    } catch { /* ignore */ }
  }

  /* ---------------- departments & workspace ----------------
     Departments live in the shared team settings. The workspace (top bar) is the department you're working in:
     the library shows its procedures (plus joint ones it takes part in) and new procedures belong to it. */
  let depts = PR.model.departments({});
  async function loadDepts() {
    try { depts = PR.model.departments(await S().getSettings()); } catch { /* keep defaults */ }
    renderWorkspace();
    return depts;
  }
  async function saveDepts(list) {
    const set = await S().getSettings(); // re-read so we never overwrite someone else's settings change
    const next = { ...set, departments: list };
    await S().saveSettings(next);
    depts = PR.model.departments(next);
    renderWorkspace();
    return depts;
  }
  const dept = (id) => PR.model.deptById(depts, id);
  function workspace() { const id = LS.get("dept", ""); return dept(id) ? id : ""; }
  function setWorkspace(id) {
    LS.set("dept", id || ""); renderWorkspace();
    if (current === PR.views.library || current === PR.views.teams) current.render();
  }
  function renderWorkspace() {
    const slot = $("#wsSlot"); if (!slot) return;
    const d = dept(workspace());
    slot.innerHTML = "";
    slot.append(h("button.ws-btn", { type: "button", title: "Which department you're working in — the library shows its procedures", style: d ? { "--c": d.color } : {}, onclick: (e) => menu(e.currentTarget, [
      { header: "Work in" },
      { icon: "🏢", label: "All departments", hint: workspace() ? "" : "✓", onClick: () => setWorkspace("") },
      ...groupsOf(depts).flatMap(([g, list]) => [g ? { header: g } : null, ...list.map((x) => ({ icon: x.icon, label: x.full || x.name, hint: (workspace() === x.id ? "✓ " : "") + (PR.model.inDept(x, me) ? "you're in it" : ""), onClick: () => setWorkspace(x.id) }))].filter(Boolean)),
      { sep: true },
      { icon: "⚙", label: "Manage departments…", onClick: () => go("#/teams") },
    ]) }, d ? [h("i"), `${d.icon} ${d.name}`] : "🏢 All departments", " ▾"));
    const org = $("#brandOrg"); if (org && d) org.dataset.dept = d.full || d.name;
  }
  function groupsOf(list) {
    const m = new Map();
    list.forEach((d) => { const g = d.group || ""; if (!m.has(g)) m.set(g, []); m.get(g).push(d); });
    return [...m.entries()];
  }
  function deptChip(d, cls = "") { return d ? h(`span.dept-chip${cls ? "." + cls : ""}`, { style: { "--c": d.color }, title: `${d.full || d.name}${cls === "owner" ? " — owns this procedure" : cls === "joint" ? " — takes part" : ""}` }, d.icon, " ", d.name) : null; }
  /* Owner first (filled), then the other departments with a lane (outlined) */
  function deptChips(owner, ids) {
    const others = (ids || []).filter((x) => x !== owner).map(dept).filter(Boolean);
    return [owner ? deptChip(dept(owner), "owner") : null, ...others.map((d) => deptChip(d, "joint"))];
  }
  /* Soft edit rights: if the owning department (or a department with a lane) lists its people, only they edit without a prompt. */
  function editRights(doc) {
    const owner = PR.model.ownerOf(doc);
    const ids = [...new Set([owner, ...((doc.draft && doc.draft.tracks) || []).map((t) => t.dept)].filter(Boolean))];
    const ds = ids.map(dept).filter(Boolean);
    const listed = ds.filter((d) => d.leads.length || d.members.length);
    if (!listed.length) return { ok: true, owner: dept(owner) };
    return { ok: listed.some((d) => PR.model.inDept(d, me)), owner: dept(owner), who: listed };
  }
  /* First visit: which team are you on? Adds you to it and makes it your workspace. */
  async function pickMyTeam({ force } = {}) {
    if (!force && (LS.get("deptAsked", false) || PR.model.myDepts(depts, me).length)) { if (!force && !LS.get("dept", "") && PR.model.myDepts(depts, me)[0]) setWorkspace(PR.model.myDepts(depts, me)[0].id); return; }
    LS.set("deptAsked", true);
    const v = await modal({
      title: "Which team are you on?", size: "md", subtitle: "Procedure Runner is shared across departments. Your team's procedures show first; you can switch any time from the top bar.",
      body: (close) => h("div", groupsOf(depts).map(([g, list]) => [g ? h("div.team-group-t", g) : null,
        h("div.team-pick", list.map((d) => h("button", { type: "button", style: { "--c": d.color }, onclick: () => close(d.id) }, h("b", `${d.icon} ${d.name}`), h("span.muted.small", d.about || d.full))))])),
      actions: [{ label: "Skip for now", value: "" }, { spacer: true }, { label: "Manage departments…", value: "#manage" }],
    });
    if (v === "#manage") return go("#/teams");
    if (!v) return;
    const list = depts.map((d) => (d.id === v ? { ...d, members: [...d.members, me] } : d));
    try { await saveDepts(list); } catch { /* offline */ }
    setWorkspace(v);
    toast(`You're in ${dept(v).name} — its procedures show first`, "ok");
  }

  /* ---------------- procedure doc helpers ---------------- */
  async function saveNewProcedure(data, { open = true } = {}) {
    if (!data.owner) data.owner = workspace() || ((PR.model.myDepts(depts, me)[0] || {}).id) || "";
    const doc = PR.model.newDoc(PR.model.normalize(data), me);
    const saved = await S().saveProcedure(doc, null);
    if (open) go(`#/edit/${encodeURIComponent(saved.id)}`);
    return saved;
  }
  async function exportProcedure(id) {
    const doc = await S().getProcedure(id);
    download(`${PR.u.slug(doc.draft.title)}.procedure.json`, JSON.stringify({ kind: "procedure-runner/procedure", version: 3, procedure: { ...doc.draft, owner: PR.model.ownerOf(doc) } }, null, 2));
  }
  async function importJSON() {
    const f = await pickFile(".json,application/json");
    if (!f) return;
    let j;
    try { j = JSON.parse(await f.text()); } catch { return toast("That file isn't valid JSON", "err"); }
    if (j.kind === "procedure-runner/run") {
      const r = j.run;
      for (const [ref, dataURL] of Object.entries(j.attachments || {})) {
        const newRef = await S().putAttachment(r.id, PR.u.dataURLToBlob(dataURL), "evidence");
        for (const iss of Object.values(r.issues || {})) (iss.evidence || []).forEach((e) => { if (e.ref === ref) e.ref = newRef; });
      }
      if (await S().getRun(r.id)) r.id = uid("run");
      await S().createRun(r);
      toast("Run imported", "ok");
      return go(`#/report/${r.id}`);
    }
    let data = j.kind === "procedure-runner/procedure" ? j.procedure : (j.draft && j.draft.sections ? j.draft : j);
    const looksNew = data.sections && data.sections.some((s) => (s.steps || []).some((st) => Array.isArray(st.blocks)));
    data = looksNew ? PR.model.normalize(clone(data)) : PR.model.fromLegacy(data);
    data.id = uid("proc");
    await saveNewProcedure(data);
    toast(`Imported "${data.title}"`, "ok");
  }

  async function newProcedureMenu(anchor) {
    let teamTpl = [];
    try { teamTpl = (await S().listProcedures()).filter((p) => p.template && p.status !== "archived"); } catch { /* ignore */ }
    const ws = workspace();
    teamTpl.sort((a, b) => (b.template === ws) - (a.template === ws) || a.title.localeCompare(b.title));
    menu(anchor, [
      { icon: "＋", label: "Blank procedure", hint: dept(ws) ? `owned by ${dept(ws).name}` : "", onClick: async () => { const t = await promptBox("New procedure", { label: "Name", placeholder: "e.g. Symitar Release 2027.00", ok: "Create", required: true }); if (t) saveNewProcedure(PR.model.newProcedure({ title: t })); } },
      { icon: "🔁", label: "Recurring checklist / run sheet…", hint: "daily, weekly, month-end…", onClick: () => runSheetWizard() },
      { icon: "⇶", label: "Joint procedure (several teams)…", hint: "a lane per department + workflow", onClick: () => jointWizard() },
      teamTpl.length ? { sep: true } : null, teamTpl.length ? { header: "Team templates" } : null,
      ...teamTpl.map((p) => ({ icon: (dept(p.template) || {}).icon || "★", label: p.title, hint: (dept(p.template) || {}).name || "", onClick: () => fromTeamTemplate(p.id) })),
      { sep: true }, { header: "Start from a template" },
      ...PR.templates.list().map((t) => ({ icon: t.icon, label: t.title, hint: t.hint, onClick: () => saveNewProcedure(t.build()) })),
      { sep: true }, { header: "Import" },
      { icon: "▦", label: "From Excel / CSV…", hint: ".xlsx .xlsm .csv", onClick: () => PR.importer.open() },
      { icon: "W", label: "From Word…", hint: ".docx", onClick: () => PR.word.open() },
      { icon: "⎘", label: "Paste rows from Excel…", onClick: () => PR.importer.openPaste() },
      { icon: "{}", label: "Procedure or run JSON…", onClick: importJSON },
    ].filter(Boolean));
  }
  async function fromTeamTemplate(id) {
    const d = await S().getProcedure(id); if (!d) return;
    const t = await promptBox("New procedure from template", { label: "Name", value: d.draft.title.replace(/\s*\(template\)\s*$/i, ""), ok: "Create", required: true });
    if (!t) return;
    const c = clone(d.draft); c.id = uid("proc"); c.title = t; c.owner = workspace() || PR.model.ownerOf(d);
    saveNewProcedure(c);
  }
  /* A recurring checklist (run sheet): pick the sheets (daily, month-end…) with their schedules and the yes / no questions asked at start.
     It skips run setup; today's sheet is pre-selected. Steps are added in the builder or imported from Excel (one worksheet per sheet). */
  async function runSheetWizard() {
    const M = PR.model;
    const st = { title: "", sheets: [M.newSheet(M.SHEET_PRESETS[0])], questions: [], open: null, finish: true };
    const body = h("div.rsw");
    const draw = () => {
      body.innerHTML = "";
      const used = new Set(st.sheets.map((v) => v.name));
      body.append(
        h("div.field", h("label.lbl", "Name"), h("input.inp", { value: st.title, placeholder: "e.g. Network daily checks", oninput: (e) => (st.title = e.target.value) })),
        h("div.ins-sec", "1 · Which sheets? (“Which run sheet?” is the first question when someone starts it)"),
        h("div.rsw-sheets", st.sheets.map((v, i) => h("div.rsw-sheet",
          h("div.rsw-top", h("input.inp.w-num", { value: v.icon, title: "Icon", oninput: (e) => (v.icon = e.target.value) }), h("input.inp", { value: v.name, placeholder: "Sheet name", oninput: (e) => (v.name = e.target.value) }),
            h("span.muted.small.rsw-when", M.scheduleLabel(v)),
            h("button.btn.btn-sm.btn-ghost", { type: "button", onclick: () => { st.open = st.open === v.id ? null : v.id; draw(); } }, st.open === v.id ? "Done" : "Schedule…"),
            st.sheets.length > 1 ? h("button.icon-btn.danger", { type: "button", title: "Remove", onclick: () => { st.sheets.splice(i, 1); draw(); } }, "🗑") : null),
          st.open === v.id ? PR.ui.scheduleEditor(v, () => { const w = body.querySelectorAll(".rsw-when")[i]; if (w) w.textContent = M.scheduleLabel(v); }) : null))),
        h("div.lane-dept", M.SHEET_PRESETS.filter((p) => !used.has(p.name)).map((p) => h("button.btn.btn-sm", { type: "button", title: p.desc, onclick: () => { st.sheets.push(M.newSheet(p)); draw(); } }, `＋ ${p.icon} ${p.name}`)),
          h("button.btn.btn-sm.btn-ghost", { type: "button", onclick: () => { const v = M.newSheet(null, { name: "" }); st.sheets.push(v); st.open = v.id; draw(); } }, "＋ Custom")),
        h("div.ins-sec", "2 · Yes / no questions at start (optional)"),
        h("div.help", "Steps can be set to appear only when the answer is Yes — e.g. “Rate change today?”, “Patch night?”, “Firmware window tonight?”."),
        st.questions.map((q, i) => h("div.rsw-top.rsw-q", h("input.inp", { value: q.label, placeholder: "e.g. Patch night?", oninput: (e) => (q.label = e.target.value) }),
          h("button.icon-btn.danger", { type: "button", onclick: () => { st.questions.splice(i, 1); draw(); } }, "🗑"))),
        h("button.btn.btn-sm", { type: "button", onclick: () => { st.questions.push({ id: uid("flag"), label: "", help: "", default: false }); draw(); setTimeout(() => { const l = body.querySelectorAll(".rsw-q input"); l.length && l[l.length - 1].focus(); }, 0); } }, "＋ Add a question"),
        h("div.ins-sec", "3 · Finish"),
        h("label.ck", h("input", { type: "checkbox", checked: st.finish, onchange: (e) => (st.finish = e.target.checked) }), " One-click finish (no close-out wizard)"),
        h("div.help", "Next you add the steps — in the builder, or with “＋ Add a sheet from Excel” (one worksheet or file per sheet; steps that appear on several sheets are kept once and tagged)."));
    };
    draw();
    const ok = await modal({ title: "New recurring checklist", subtitle: "Daily run sheets, weekly checks, month-end and quarter-end tasks — one procedure, the right sheet picked for today.", size: "lg", body,
      actions: [{ label: "Cancel", value: false }, { spacer: true }, { label: "Create", kind: "primary", value: true }] });
    if (!ok) return;
    const sheets = st.sheets.filter((v) => v.name.trim());
    if (!sheets.length) return toast("Add at least one sheet", "warn");
    const p = M.newProcedure({ title: st.title.trim() || `${(dept(workspace()) || {}).name || "Team"} run sheet`, description: `${sheets.map((v) => v.name).join(" · ")} — pick the sheet when you start; today's is pre-selected.`, tags: ["Run sheet"],
      setup: { requireChangeId: false, requireVerification: false, chairs: ["Operator"], readiness: [], milestones: [] } });
    p.runOptions = { quickStart: true, quickFinish: st.finish, holidays: [], variants: sheets, flags: st.questions.filter((q) => q.label.trim()) };
    let n = 0;
    p.sections = sheets.map((v) => M.newSection({ title: v.name, variants: [v.id], steps: [M.newStep({ num: String(++n), title: `First ${v.name.toLowerCase()} check`, estMin: 1 })] }));
    LS.set("bldView", "page");
    await saveNewProcedure(p);
    toast("Add your steps — tag a section or step with the sheets it belongs to, or import each sheet from Excel", "ok", 6000);
  }

  /* A joint procedure: one lane per department, shared kickoff and close-out, opened in the workflow designer. */
  async function jointWizard() {
    const pick = new Set(workspace() ? [workspace()] : []);
    let title = "", owner = workspace();
    const grid = h("div");
    const drawGrid = () => {
      grid.innerHTML = "";
      grid.append(groupsOf(depts).map(([g, list]) => [g ? h("div.team-group-t", g) : null, h("div.team-pick", list.map((d) => h(`button${pick.has(d.id) ? ".on" : ""}`, { type: "button", style: { "--c": d.color },
        onclick: () => { pick.has(d.id) ? pick.delete(d.id) : pick.add(d.id); if (!pick.has(owner)) owner = [...pick][0] || ""; drawGrid(); } },
        h("b", `${pick.has(d.id) ? "☑" : "☐"} ${d.icon} ${d.name}`), h("span.muted.small", d.about || d.full))))]),
        h("div.field", h("label.lbl", "Owning department (edits & publishes it)"), h("select.inp", { onchange: (e) => (owner = e.target.value) }, [...pick].map((id) => h("option", { value: id, selected: owner === id }, dept(id).name)))));
    };
    drawGrid();
    const ok = await modal({
      title: "New joint procedure", size: "lg", subtitle: "Each team gets its own lane. Steps run in parallel across lanes; draw hand-offs where one team has to wait for another.",
      body: h("div", h("div.field", h("label.lbl", "Name"), h("input.inp", { placeholder: "e.g. Joint failover — Core · Network · Dev", oninput: (e) => (title = e.target.value) })), h("div.field", h("label.lbl", "Teams taking part"), grid)),
      actions: [{ label: "Cancel", value: false }, { spacer: true }, { label: "Create & open the workflow", kind: "primary", value: true }],
    });
    if (!ok) return;
    if (pick.size < 1) return toast("Pick at least one team", "warn");
    const ds = [...pick].map(dept);
    const M = PR.model;
    const p = M.newProcedure({ title: title.trim() || `Joint procedure — ${ds.map((d) => d.name).join(" · ")}` });
    p.owner = owner || ds[0].id;
    p.tracks = ds.map((d) => ({ id: "lane_" + d.id, name: d.name, desc: d.full, dept: d.id, color: d.color }));
    p.sections = [
      M.newSection({ title: "Kickoff", steps: [M.newStep({ num: "1", title: "Open the bridge — every team confirms they're ready", category: "Communication" })] }),
      ...ds.map((d, i) => M.newSection({ title: `${d.name}`, track: "lane_" + d.id, steps: [M.newStep({ num: `${i + 2}.1`, title: `First ${d.name} task`, owner: d.name })] })),
      M.newSection({ title: "Close-out", steps: [M.newStep({ num: String(ds.length + 2), title: "Every team confirms they're done — close the bridge", category: "Milestone" })] }),
    ];
    LS.set("bldView", "flow");
    await saveNewProcedure(p);
  }

  /* ---------------- LIBRARY ---------------- */
  PR.views.library = (() => {
    let state = { q: "", filter: LS.get("libFilter", "active") };
    let host;
    async function mount(el) {
      host = el;
      el.appendChild(h("div.lib-wrap#libWrap", h("div.loading", "Loading…")));
      await render();
    }
    async function render() {
      const wrap = $("#libWrap"); if (!wrap) return;
      let procs = [], runs = [];
      try { [procs, runs] = await Promise.all([S().listProcedures(), S().listRuns()]); }
      catch (e) { wrap.innerHTML = ""; wrap.appendChild(h("div.empty", h("div.empty-title", "Can't reach storage"), h("div.muted", e.message))); return; }
      const lastRun = {};
      runs.filter((r) => !r.practice).forEach((r) => { if (!lastRun[r.procId] || (r.startedAt || r.createdAt) > (lastRun[r.procId].startedAt || lastRun[r.procId].createdAt)) lastRun[r.procId] = r; });
      const live = runs.filter((r) => ["setup", "active", "paused"].includes(r.status)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const q = state.q.toLowerCase();
      const ws = workspace();
      const unowned = procs.filter((p) => !p.owner && p.status !== "archived");
      const inWs = (p) => !ws || !p.owner || p.depts.includes(ws);
      const shown = procs.filter(inWs).filter((p) => (state.filter === "archived" ? p.status === "archived" : state.filter === "drafts" ? p.status === "draft" : state.filter === "published" ? p.status === "published" : p.status !== "archived"))
        .filter((p) => !q || [p.title, p.description, (p.tags || []).join(" ")].join(" ").toLowerCase().includes(q))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      wrap.innerHTML = "";
      wrap.appendChild(h("div.lib-head",
        h("div", h("h1", dept(ws) ? `${dept(ws).icon} ${dept(ws).full || dept(ws).name} procedures` : "Procedures"),
          h("div.muted", dept(ws) ? ["Owned by ", dept(ws).name, " and joint procedures it takes part in. ", h("button.link-btn", { type: "button", onclick: () => setWorkspace("") }, "Show every department")] : "Build runbooks like pages, then run them step by step with timing, issues and a full audit trail.")),
        h("div.lib-head-actions",
          h("div.search", h("span", "⌕"), h("input#libSearch.inp", { placeholder: "Search procedures…", value: state.q, oninput: PR.u.debounce((e) => { state.q = e.target.value; render().then(() => { const s = $("#libSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }); }, 200) })),
          h("button.btn.btn-primary", { type: "button", onclick: (e) => newProcedureMenu(e.currentTarget) }, "＋ New procedure ▾"))));

      if (live.length) {
        wrap.appendChild(h("div.lib-sec-title", "Runs in progress"));
        wrap.appendChild(h("div.live-grid", live.map((r) => {
          const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
          return h("div.live-card", { onclick: () => go(`#/run/${r.id}`) },
            h("div.live-top", statusChip(r.status), r.practice ? h("span.chip.c-gray", "Practice") : null, h("span.muted.small", ago(r.updatedAt))),
            h("div.live-title", r.name || r.procTitle), h("div.muted.small", r.procTitle),
            h("div.bar", h("div.bar-fill", { style: { width: pct + "%" } })),
            h("div.live-meta", h("span", `${r.done}/${r.total} steps`), r.openIssues ? h("span.c-red-t", `⚠ ${r.openIssues} open issue${r.openIssues > 1 ? "s" : ""}`) : null, r.startedAt ? h("span", "⏱ ", h("span", { dataset: { since: String(r.startedAt) } }, fmtDur(Math.max(0, now() - r.startedAt)))) : null),
            h("div.live-actions", h("button.btn.btn-primary.btn-sm", { type: "button" }, r.status === "setup" ? "Continue setup" : "Resume ▶"),
              h("button.btn.btn-sm", { type: "button", title: "Read-only view for teammates, leadership or a war-room screen", onclick: (e) => { e.stopPropagation(); go(`#/live/${r.id}`); } }, "📺 Follow along")));
        })));
      }

      if (ws && unowned.length) wrap.appendChild(h("div.lib-dept-note", `${unowned.length} procedure${unowned.length > 1 ? "s don't" : " doesn't"} belong to a department yet, so ${unowned.length > 1 ? "they show" : "it shows"} for every team.`, h("div.spacer"),
        h("button.btn.btn-sm", { type: "button", onclick: async () => {
          if (!(await confirmBox(`Give them to ${dept(ws).name}?`, unowned.map((p) => p.title).join(" · "), { ok: `Assign ${unowned.length} to ${dept(ws).name}` }))) return;
          for (const p of unowned) await setOwner(p.id, ws);
          toast(`Assigned to ${dept(ws).name}`, "ok"); render();
        } }, `Assign all to ${dept(ws).name}`)));
      wrap.appendChild(h("div.lib-toolbar",
        h("div.seg", [["active", "All"], ["published", "Published"], ["drafts", "Drafts"], ["archived", "Archived"]].map(([k, l]) =>
          h(`button.seg-btn${state.filter === k ? ".on" : ""}`, { type: "button", onclick: () => { state.filter = k; LS.set("libFilter", k); render(); } }, l))),
        h("div.spacer"),
        h("a.link-btn", { href: "#/runs" }, "All runs →"), h("a.link-btn", { href: "#/lessons" }, "Lessons learned →")));

      if (!shown.length) {
        wrap.appendChild(h("div.empty",
          h("div.empty-title", procs.length ? "No procedures match" : "No procedures yet"),
          h("div.muted", procs.length ? "Try a different search or filter." : "Start from the Symitar failover template, import your Excel playbook or Word document, or build one from scratch."),
          procs.length ? null : h("div.empty-actions",
            h("button.btn.btn-primary", { onclick: () => saveNewProcedure(PR.templates.get("failover").build()) }, "🔁 Use failover template"),
            h("button.btn", { onclick: () => PR.importer.open() }, "▦ Import Excel playbook"),
            h("button.btn", { onclick: () => PR.word.open() }, "W Import Word document"),
            h("button.btn", { onclick: (e) => newProcedureMenu(e.currentTarget) }, "More options…"))), aboutLine());
        return;
      }
      wrap.appendChild(h("div.proc-grid", shown.map((p) => procCard(p, lastRun[p.id]))));
      wrap.appendChild(aboutLine());
    }
    // Which copy is this? Shown so an old background server or the wrong data folder is easy to spot.
    function aboutLine() {
      const info = S().info;
      return h("div.about-line", `Procedure Runner ${window.PR_BUILD || ""}`,
        info ? [` · server ${info.version}${info.version !== window.PR_BUILD ? " ⚠ different version" : ""}`, info.appDir ? ` · app: ${info.appDir}` : "", ` · data: ${info.dataDir}`]
          : " · local mode — data is kept in this browser only. Start ProcedureRunner.bat to share with the team.");
    }

    function procCard(p, lr) {
      const open = () => go(`#/edit/${encodeURIComponent(p.id)}`);
      return h("div.proc-card",
        h("div.pc-top", statusChip(p.status), p.publishedVersion ? h("span.chip.c-gray", `v${p.publishedVersion}`) : null, p.status === "published" && p.hasUnpublished ? h("span.chip.c-amber-o", "unpublished edits") : null,
          p.directional ? h("span.chip.c-blue-o", "⇄ Failover") : null, p.template ? h("span.chip.c-gray", { title: "Shown under New procedure → Team templates" }, "★ Template") : null, p.quick ? h("span.chip.c-blue-o", { title: "Starts without run setup — just pick the run sheet" }, "⚡ Quick start") : null, h("div.spacer"),
          h("button.icon-btn", { type: "button", title: "More", onclick: (e) => { e.stopPropagation(); cardMenu(e.currentTarget, p); } }, "⋯")),
        h("div.pc-title", { onclick: open }, p.title),
        p.depts.length ? h("div.pc-depts", deptChips(p.owner, p.depts), p.lanes && p.depts.length > 1 ? h("span.muted.small", " joint") : null) : null,
        h("div.pc-desc", p.description || h("span.muted", "No description")),
        (p.tags || []).length ? h("div.pc-tags", p.tags.map((t) => h("span.tag", t))) : null,
        h("div.pc-meta", h("span", `${p.steps} steps`), p.estMin ? h("span", `~${fmtMin(p.estMin)}`) : null, h("span", `edited ${ago(p.updatedAt)}`)),
        lr ? h("div.pc-last", "Last run: ", h("b", fmtDate(lr.startedAt || lr.createdAt)), " · ", statusChip(lr.status), lr.outcome ? ` ${lr.outcome}` : "") : h("div.pc-last.muted", "Never run"),
        h("div.pc-actions",
          h("button.btn.btn-primary", { type: "button", disabled: p.status === "archived", onclick: () => PR.runner.startNew(p.id) }, "▶ Run"),
          h("button.btn", { type: "button", onclick: open }, "✎ Edit"),
          h("button.btn.btn-ghost", { type: "button", onclick: () => go(`#/history/${encodeURIComponent(p.id)}`) }, "📈 History")));
    }
    function cardMenu(anchor, p) {
      menu(anchor, [
        { icon: "🧪", label: "Practice run (draft)", onClick: () => PR.runner.startNew(p.id, { practice: true }) },
        { icon: "📈", label: "History & insights", onClick: () => go(`#/history/${encodeURIComponent(p.id)}`) },
        { icon: "⧉", label: "Duplicate", onClick: async () => { const d = await S().getProcedure(p.id); const c = clone(d.draft); c.id = uid("proc"); c.title += " (copy)"; await saveNewProcedure(c, { open: false }); toast("Duplicated", "ok"); render(); } },
        { icon: "📄", label: "Export PDF (for SharePoint)", onClick: () => go(`#/print/${encodeURIComponent(p.id)}`) },
        { icon: "W", label: "Export Word (.docx)", onClick: () => PR.word.exportProcedure(p.id) },
        { icon: "⇩", label: "Export JSON", onClick: () => exportProcedure(p.id) },
        { sep: true },
        { icon: "🏢", label: "Department…", hint: p.owner ? (dept(p.owner) || {}).name || "" : "none", onClick: async () => { const v = await pickDept(`Which department owns "${p.title}"?`, p.owner); if (v != null) { await setOwner(p.id, v); render(); } } },
        p.template ? { icon: "☆", label: "Remove from team templates", onClick: async () => { await setTemplate(p.id, ""); render(); } }
          : { icon: "★", label: "Save as a team template", hint: "New procedure → Team templates", onClick: async () => { const v = await pickDept("Template for which department?", p.owner || workspace()); if (v) { await setTemplate(p.id, v); toast("Saved as a team template", "ok"); render(); } } },
        { sep: true },
        p.status === "archived"
          ? { icon: "↺", label: "Restore", onClick: async () => { const d = await S().getProcedure(p.id); d.status = d.publishedVersion ? "published" : "draft"; await S().saveProcedure(d, d.rev); render(); } }
          : { icon: "🗄", label: "Archive", onClick: async () => { const d = await S().getProcedure(p.id); d.status = "archived"; await S().saveProcedure(d, d.rev); toast("Archived", "ok"); render(); } },
        { icon: "🗑", label: "Delete permanently", danger: true, onClick: async () => { if (await confirmBox("Delete procedure?", `"${p.title}" and its versions will be removed. Past run records are kept.`, { ok: "Delete", kind: "danger" })) { await S().deleteProcedure(p.id); render(); } } },
      ], { align: "right" });
    }
    return { mount, render };
  })();
  async function setOwner(id, owner) { const d = await S().getProcedure(id); if (!d) return; d.owner = owner || ""; await S().saveProcedure(d, d.rev); }
  async function setTemplate(id, deptId) { const d = await S().getProcedure(id); if (!d) return; d.teamTemplate = deptId || ""; await S().saveProcedure(d, d.rev); }
  async function pickDept(title, value) {
    return await modal({
      title, size: "md",
      body: (close) => h("div", h("div.team-pick", depts.map((d) => h(`button${value === d.id ? ".on" : ""}`, { type: "button", style: { "--c": d.color }, onclick: () => close(d.id) }, h("b", `${d.icon} ${d.name}`), h("span.muted.small", d.group ? `${d.group} · ${d.full}` : d.full))))),
      actions: [{ label: "Cancel", value: null }, { spacer: true }, { label: "No department", value: "" }],
    });
  }

  /* ---------------- TEAMS (departments) ---------------- */
  PR.views.teams = (() => {
    let host;
    async function mount(el) { host = el; await loadDepts(); await render(); }
    async function render() {
      if (!host) return;
      let procs = [];
      try { procs = (await S().listProcedures()).filter((p) => p.status !== "archived"); } catch { /* ignore */ }
      const ws = workspace();
      host.innerHTML = "";
      host.append(h("div.teams-wrap",
        h("div.lib-head", h("div", h("h1", "Teams & departments"), h("div.muted", "Each department owns its procedures, lists its people (who can edit without a prompt and who approves), and can join cross-team procedures as a lane.")),
          h("div.lib-head-actions", h("button.btn", { type: "button", onclick: () => jointWizard() }, "⇶ New joint procedure"), h("button.btn.btn-primary", { type: "button", onclick: () => editDept(null) }, "＋ Add department"))),
        groupsOf(depts).map(([g, list]) => h("div.team-group", h("div.team-group-t", g || "Other departments"),
          h("div.team-grid", list.map((d) => {
            const owned = procs.filter((p) => p.owner === d.id).length, joint = procs.filter((p) => p.owner !== d.id && p.depts.includes(d.id)).length;
            const mine = PR.model.inDept(d, me);
            return h(`div.team-card${ws === d.id ? ".on" : ""}`, { style: { "--c": d.color } },
              h("div.tc-top", h("div.tc-ic", d.icon), h("div", h("div.tc-name", d.name), h("div.tc-full", d.full !== d.name ? d.full : d.group))),
              d.about ? h("div.small", d.about) : null,
              h("div.tc-stats", h("span", h("b", owned), " owned"), h("span", h("b", joint), " joint"), h("span", h("b", d.leads.length + d.members.length), " people")),
              d.leads.length ? h("div.tc-people", "Leads: ", h("b", d.leads.join(", "))) : null,
              d.members.length ? h("div.tc-people.muted", d.members.slice(0, 8).join(", ") + (d.members.length > 8 ? ` +${d.members.length - 8}` : "")) : h("div.tc-people.muted", "No members listed — anyone can edit its procedures."),
              h("div.tc-actions",
                h("button.btn.btn-sm.btn-primary", { type: "button", onclick: () => { setWorkspace(d.id); go("#/"); } }, "Open procedures"),
                h("button.btn.btn-sm", { type: "button", onclick: () => editDept(d) }, "✎ Edit"),
                mine ? h("span.chip.c-green", "✓ You're in it") : h("button.btn.btn-sm.btn-ghost", { type: "button", onclick: async () => { await saveDepts(depts.map((x) => (x.id === d.id ? { ...x, members: [...x.members, me] } : x))); toast(`Joined ${d.name}`, "ok"); render(); } }, "＋ Join")));
          }))))),
        h("div.help", "Departments are shared with everyone using this Procedure Runner. Edit rights are a guard-rail, not security: someone outside the department can still choose “Edit anyway”, and that is recorded in the procedure's history."));
    }
    async function editDept(d) {
      const isNew = !d;
      const x = d ? clone(d) : { id: uid("dept"), name: "", full: "", group: (dept(workspace()) || {}).group || "", color: PR.model.DEPT_COLORS[depts.length % PR.model.DEPT_COLORS.length], icon: "🏢", about: "", leads: [], members: [] };
      const groups = [...new Set(depts.map((y) => y.group).filter(Boolean))];
      const lines = (v) => v.split("\n").map((t) => t.trim()).filter(Boolean);
      const v = await modal({
        title: isNew ? "Add department" : `Edit ${d.name}`, size: "md",
        body: h("div",
          h("div.frow", h("div.field", h("label.lbl", "Short name"), h("input.inp", { value: x.name, placeholder: "e.g. Network", oninput: (e) => (x.name = e.target.value) })),
            h("div.field", h("label.lbl", "Icon"), h("input.inp.w-num", { value: x.icon, maxlength: 4, oninput: (e) => (x.icon = e.target.value) })),
            h("div.field", h("label.lbl", "Colour"), h("input.color", { type: "color", value: x.color, oninput: (e) => (x.color = e.target.value) }))),
          h("div.frow", h("div.field", h("label.lbl", "Full name"), h("input.inp", { value: x.full, placeholder: "e.g. Network Engineering", oninput: (e) => (x.full = e.target.value) })),
            h("div.field", h("label.lbl", "Group / umbrella"), h("input.inp", { value: x.group, placeholder: "e.g. IT", list: "deptGroups", oninput: (e) => (x.group = e.target.value) }), h("datalist#deptGroups", groups.map((g) => h("option", { value: g }))))),
          h("div.field", h("label.lbl", "What it looks after"), h("input.inp", { value: x.about, oninput: (e) => (x.about = e.target.value) })),
          h("div.frow", h("div.field", h("label.lbl", "Leads (one per line)"), h("textarea.inp", { rows: 4, oninput: (e) => (x.leads = lines(e.target.value)) }, x.leads.join("\n")), h("div.help", "Leads can approve the department's procedures when a run asks for its leads.")),
            h("div.field", h("label.lbl", "Members (one per line)"), h("textarea.inp", { rows: 4, oninput: (e) => (x.members = lines(e.target.value)) }, x.members.join("\n")), h("div.help", "Names as people enter them in Procedure Runner.")))),
        actions: [isNew ? null : { label: "Delete", kind: "danger", value: "delete" }, { spacer: true }, { label: "Cancel", value: false }, { label: isNew ? "Add" : "Save", kind: "primary", value: "save" }].filter(Boolean),
      });
      if (v === "delete") {
        if (!(await confirmBox(`Delete ${d.name}?`, "Its procedures are kept and become unassigned. Lanes keep their name.", { ok: "Delete", kind: "danger" }))) return;
        await saveDepts(depts.filter((y) => y.id !== d.id)); if (workspace() === d.id) setWorkspace("");
      } else if (v === "save") {
        if (!x.name.trim()) return toast("Give the department a name", "warn");
        x.name = x.name.trim(); x.full = x.full.trim() || x.name;
        await saveDepts(isNew ? [...depts, x] : depts.map((y) => (y.id === x.id ? x : y)));
        toast(isNew ? `Added ${x.name}` : "Saved", "ok");
      }
      render();
    }
    return { mount, render };
  })();

  /* ---------------- timers (one interval for the whole app) ---------------- */
  setInterval(() => {
    const t = now();
    $$("[data-since]").forEach((el) => { el.textContent = fmtDur(Math.max(0, t - Number(el.dataset.since))); }); // never negative if PC clocks disagree
    $$("[data-countdown]").forEach((el) => {
      const left = Number(el.dataset.countdown) - t;
      el.textContent = fmtDur(Math.max(0, left));
      if (left <= 0 && !el.dataset.fired) { el.dataset.fired = "1"; const tb = el.closest(".blk-timer"); if (tb) { tb.classList.add("fired"); beep(); notify("Countdown finished"); document.dispatchEvent(new CustomEvent("pr:countdown-done", { detail: { el } })); } }
    });
    $$(".blk-timer[data-tm-end]").forEach((el) => { const bar = el.querySelector(".tm-bar i"); if (bar) bar.style.width = `${Math.min(100, Math.max(0, 100 - ((Number(el.dataset.tmEnd) - t) / (Number(el.dataset.tmTotal) || 1)) * 100))}%`; });
  }, 1000);
  function beep() { try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); a.close(); }, 350); } catch { /* no audio */ } }
  function notify(msg, onclick) { try { if ("Notification" in window && Notification.permission === "granted") { const n = new Notification("Procedure Runner", { body: msg, icon: "app/icons/icon-192.png", requireInteraction: !!onclick }); if (onclick) n.onclick = () => { window.focus(); onclick(); n.close(); }; } } catch { /* ignore */ } }

  /* ---------------- approvals waiting for me (checked wherever the app is open) ---------------- */
  const seenAsks = new Set();
  async function checkApprovals() {
    if (!me) return;
    let runs = [];
    try { runs = await S().listRuns(); } catch { return; }
    const low = (x) => String(x || "").trim().toLowerCase();
    const mine = [];
    runs.filter((r) => ["active", "paused"].includes(r.status)).forEach((r) => (r.approvals || []).forEach((a) => {
      if ((a.to || []).some((n) => low(n) === low(me)) && (low(a.requestedBy) !== low(me) || r.practice)) mine.push({ ...a, run: r });
    }));
    const slot = $("#approvalSlot");
    if (slot) {
      slot.innerHTML = "";
      if (mine.length) slot.append(h("button.ap-badge", { type: "button", title: "Approvals waiting for you", onclick: (e) => {
        if ("Notification" in window && Notification.permission === "default") try { Notification.requestPermission(); } catch { /* ignore */ }
        menu(e.currentTarget, [{ header: "Waiting for your approval" }, ...mine.map((a) => ({ icon: "✍", label: a.title, hint: `${a.run.procTitle} · ${a.requestedBy}`, onClick: () => go(`#/run/${encodeURIComponent(a.run.id)}`) }))], { align: "right" });
      } }, "✍ ", h("b", String(mine.length)), mine.length === 1 ? " approval" : " approvals"));
    }
    const fresh = mine.filter((a) => !seenAsks.has(a.id + ":" + (a.pingAt || a.requestedAt)));
    mine.forEach((a) => seenAsks.add(a.id + ":" + (a.pingAt || a.requestedAt)));
    if (!fresh.length) return;
    beep();
    fresh.forEach((a) => notify(`Approval needed: ${a.title}\n${a.run.procTitle} — asked by ${a.requestedBy}`, () => go(`#/run/${encodeURIComponent(a.run.id)}`)));
    const onRun = location.hash.startsWith(`#/run/${encodeURIComponent(fresh[0].run.id)}`);
    if (!onRun) toast(`✍ Approval needed: ${fresh[0].title}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ""} — click ✍ in the top bar`, "warn", 7000);
  }

  /* Local mode: add the procedures shipped in seed/seed.js once (the team server does this itself from seed/). */
  async function seedLocal() {
    if (PR.store.kind !== "local") return;
    const seeds = (window.PR_SEED || []).map((x) => (x && x.procedure) || x).filter((x) => x && x.id && Array.isArray(x.sections));
    if (!seeds.length) return;
    const done = LS.get("seeded", {});
    const existing = await S().listProcedures();
    const low = (t) => String(t || "").trim().toLowerCase();
    for (const p of seeds) {
      if (done[p.id]) continue;
      done[p.id] = now();
      if (existing.some((e) => e.id === p.id || (low(e.title) === low(p.title) && e.status !== "archived"))) continue;
      const data = PR.model.normalize(clone(p));
      await S().putVersion(data.id, 1, data);
      await S().saveProcedure({ ...PR.model.newDoc(data, "Procedure Runner"), status: "published", publishedVersion: 1, publishedAt: now(), dirtySincePublish: false,
        versions: [{ version: 1, at: now(), by: "Procedure Runner", note: "Included with the app", steps: PR.model.allSteps(data).length }] }, null);
    }
    LS.set("seeded", done);
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    applyTheme(LS.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    await PR.store.init();
    checkVersion();
    $("#btnTheme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    $("#userChip").onclick = () => askName(true);
    $("#btnHelp").onclick = () => PR.app.help();
    renderUser();
    await loadDepts();
    PR.comms.load().then(PR.comms.applyBranding).catch(() => {});
    window.addEventListener("hashchange", route);
    window.addEventListener("beforeunload", (e) => { if (PR.app.dirty && PR.app.dirty()) { e.preventDefault(); e.returnValue = ""; } });
    await seedLocal().catch((e) => console.warn("seed", e));
    await route();
    if (!me) await askName();
    await pickMyTeam();
    refreshPeople();
    checkApprovals(); setInterval(checkApprovals, 8000);
  }

  /* If the server runs a newer (or older) build than this page, the browser is showing a stale copy. */
  function checkVersion() {
    const info = S().info;
    const brand = $(".brand"); if (brand) brand.title = `Procedure Runner ${window.PR_BUILD || ""}${info ? " · server " + info.version : " · local mode"}`;
    const vb = $("#verBadge"); if (vb) vb.textContent = `v${window.PR_BUILD || "?"}`;
    if (!info) return;
    const warn = (v) => {
      if (!v || v === window.PR_BUILD || $(".update-bar")) return;
      document.body.prepend(h("div.update-bar", `Procedure Runner was updated to ${v} — this window still shows ${window.PR_BUILD || "an older version"}.`,
        h("button.btn.btn-sm", { type: "button", onclick: () => { location.href = location.pathname + "?v=" + Date.now() + location.hash; } }, "Reload now")));
    };
    warn(info.version);
    // Windows left open while the server is upgraded find out within a minute
    setInterval(async () => { try { const j = await (await fetch("api/ping", { cache: "no-store" })).json(); if (j && j.server === "procedure-runner") warn(j.version); } catch { /* offline */ } }, 45000);
  }
  function help() {
    modal({
      title: `Quick guide · version ${window.PR_BUILD || ""}`, size: "lg",
      body: h("div.prose", { html: `
<h3>Build</h3>
<ul><li>Drag <b>steps</b> and <b>components</b> from the left panel onto the canvas, or click them to add after the selection.</li>
<li>Click anything to edit it in the inspector on the right. Drag the ⠿ handle to reorder steps, sections and components.</li>
<li><b>Settings → Environments</b> defines your two datacenters (physical site, fixed HMC partition label, colour). Steps target a <i>logical role</i> (Current Primary / Current Secondary) and the runner shows the real datacenter once the direction is chosen.</li>
<li>Use <code>{{primary.name}}</code>, <code>{{secondary.partition}}</code>, <code>{{var.nextAccountNumber}}</code> in any text. Capture values with a <b>Record a value</b> component.</li>
<li>Shortcuts: <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> undo/redo, <kbd>Ctrl+D</kbd> duplicate, <kbd>Del</kbd> delete, <kbd>Ctrl+S</kbd> save.</li></ul>
<h3>Teams & joint procedures</h3>
<ul><li>The 🏢 button (top bar) picks your department; the library shows its procedures and joint ones it takes part in. Manage departments and people on <b>Teams</b>.</li>
<li><b>New procedure ▾ → Joint procedure</b> gives each team a lane. The builder's <b>⇶ Workflow</b> view shows the lanes: drag a step's ● onto another step to make it wait, drag a step into another lane to hand it over.</li>
<li><b>New procedure ▾ → Recurring checklist</b> builds a run sheet: daily, weekly, month-end, quarter-end… with today's sheet picked automatically.</li></ul>
<h3>Run</h3>
<ul><li>Setup records date, change ID, participants, failover direction and who verified the environment mapping.</li>
<li><kbd>Enter</kbd> starts / completes the focused step; the next step is focused automatically with a preview. <kbd>↑</kbd><kbd>↓</kbd> move focus.</li>
<li>Several steps can run at once — each has its own timer in <b>Active now</b>. Use <b>Lanes</b> to track each datacenter separately.</li>
<li><b>📣 Updates</b> (right panel) shows which communications are due — compose a branded email and copy it into Outlook, open it as an Outlook draft, or copy it for Teams. Templates and audiences live on the <b>Comms</b> page.</li>
<li><b>📺 Follow</b> opens a read-only live view to share with the team, leadership or a war-room screen.</li>
<li><b>⇶ Workflow</b> (<kbd>W</kbd>) shows every lane side by side and who is waiting on whom.</li>
<li><kbd>I</kbd> logs an issue (paste screenshots with Ctrl+V). <kbd>N</kbd> adds an improvement note without leaving the step. <kbd>G</kbd> jumps to a step number.</li>
<li>Forgot to press Start? Complete it anyway — the finish time is recorded and the timing is flagged <i>unreliable</i>. You can enter the real start later (<i>manual</i>).</li></ul>` }),
      actions: [{ label: "Got it", kind: "primary" }],
    });
  }

  return {
    boot, go, route, thumb, depts: () => depts, dept, workspace, setWorkspace, loadDepts, saveDepts, deptChip, deptChips, editRights, pickDept, jointWizard, runSheetWizard, pickMyTeam, groupsOf, lightbox, statusChip, askName, rememberPeople, refreshPeople, saveNewProcedure, exportProcedure, importJSON, help, LS,
    get me() { return me || "Operator"; }, dirty: null,
  };
})();

document.addEventListener("DOMContentLoaded", () => PR.app.boot());
