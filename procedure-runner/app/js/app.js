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
    const view = { "": "library", edit: "builder", run: "runner", report: "report", history: "history", runs: "runs", lessons: "lessons", comms: "comms", live: "live", print: "print", compare: "compare" }[name || ""] || "library";
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

  /* ---------------- procedure doc helpers ---------------- */
  async function saveNewProcedure(data, { open = true } = {}) {
    const doc = PR.model.newDoc(PR.model.normalize(data), me);
    const saved = await S().saveProcedure(doc, null);
    if (open) go(`#/edit/${encodeURIComponent(saved.id)}`);
    return saved;
  }
  async function exportProcedure(id) {
    const doc = await S().getProcedure(id);
    download(`${PR.u.slug(doc.draft.title)}.procedure.json`, JSON.stringify({ kind: "procedure-runner/procedure", version: 3, procedure: doc.draft }, null, 2));
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
    menu(anchor, [
      { icon: "＋", label: "Blank procedure", onClick: async () => { const t = await promptBox("New procedure", { label: "Name", placeholder: "e.g. Symitar Release 2027.00", ok: "Create", required: true }); if (t) saveNewProcedure(PR.model.newProcedure({ title: t })); } },
      { sep: true }, { header: "Start from a template" },
      ...PR.templates.list().map((t) => ({ icon: t.icon, label: t.title, hint: t.hint, onClick: () => saveNewProcedure(t.build()) })),
      { sep: true }, { header: "Import" },
      { icon: "▦", label: "From Excel / CSV…", hint: ".xlsx .xlsm .csv", onClick: () => PR.importer.open() },
      { icon: "W", label: "From Word…", hint: ".docx", onClick: () => PR.word.open() },
      { icon: "⎘", label: "Paste rows from Excel…", onClick: () => PR.importer.openPaste() },
      { icon: "{}", label: "Procedure or run JSON…", onClick: importJSON },
    ]);
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
      const shown = procs.filter((p) => (state.filter === "archived" ? p.status === "archived" : state.filter === "drafts" ? p.status === "draft" : state.filter === "published" ? p.status === "published" : p.status !== "archived"))
        .filter((p) => !q || [p.title, p.description, (p.tags || []).join(" ")].join(" ").toLowerCase().includes(q))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      wrap.innerHTML = "";
      wrap.appendChild(h("div.lib-head",
        h("div", h("h1", "Procedures"), h("div.muted", "Build runbooks like pages, then run them step by step with timing, issues and a full audit trail.")),
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
            h("button.btn", { onclick: (e) => newProcedureMenu(e.currentTarget) }, "More options…"))));
        return;
      }
      wrap.appendChild(h("div.proc-grid", shown.map((p) => procCard(p, lastRun[p.id]))));
    }

    function procCard(p, lr) {
      const open = () => go(`#/edit/${encodeURIComponent(p.id)}`);
      return h("div.proc-card",
        h("div.pc-top", statusChip(p.status), p.publishedVersion ? h("span.chip.c-gray", `v${p.publishedVersion}`) : null, p.status === "published" && p.hasUnpublished ? h("span.chip.c-amber-o", "unpublished edits") : null,
          p.directional ? h("span.chip.c-blue-o", "⇄ Failover") : null, h("div.spacer"),
          h("button.icon-btn", { type: "button", title: "More", onclick: (e) => { e.stopPropagation(); cardMenu(e.currentTarget, p); } }, "⋯")),
        h("div.pc-title", { onclick: open }, p.title),
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
        p.status === "archived"
          ? { icon: "↺", label: "Restore", onClick: async () => { const d = await S().getProcedure(p.id); d.status = d.publishedVersion ? "published" : "draft"; await S().saveProcedure(d, d.rev); render(); } }
          : { icon: "🗄", label: "Archive", onClick: async () => { const d = await S().getProcedure(p.id); d.status = "archived"; await S().saveProcedure(d, d.rev); toast("Archived", "ok"); render(); } },
        { icon: "🗑", label: "Delete permanently", danger: true, onClick: async () => { if (await confirmBox("Delete procedure?", `"${p.title}" and its versions will be removed. Past run records are kept.`, { ok: "Delete", kind: "danger" })) { await S().deleteProcedure(p.id); render(); } } },
      ], { align: "right" });
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

  /* ---------------- boot ---------------- */
  async function boot() {
    applyTheme(LS.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    await PR.store.init();
    checkVersion();
    $("#btnTheme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    $("#userChip").onclick = () => askName(true);
    $("#btnHelp").onclick = () => PR.app.help();
    renderUser();
    PR.comms.load().then(PR.comms.applyBranding).catch(() => {});
    window.addEventListener("hashchange", route);
    window.addEventListener("beforeunload", (e) => { if (PR.app.dirty && PR.app.dirty()) { e.preventDefault(); e.returnValue = ""; } });
    await route();
    if (!me) await askName();
    refreshPeople();
    checkApprovals(); setInterval(checkApprovals, 8000);
  }

  /* If the server runs a newer (or older) build than this page, the browser is showing a stale copy. */
  function checkVersion() {
    const info = S().info;
    const brand = $(".brand"); if (brand) brand.title = `Procedure Runner ${window.PR_BUILD || ""}${info ? " · server " + info.version : " · local mode"}`;
    if (!info || !info.version || info.version === window.PR_BUILD) return;
    document.body.prepend(h("div.update-bar", `This page is an old copy (page ${window.PR_BUILD || "?"}, server ${info.version}).`,
      h("button.btn.btn-sm", { type: "button", onclick: () => { location.href = location.pathname + "?v=" + Date.now() + location.hash; } }, "Reload now")));
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
<h3>Run</h3>
<ul><li>Setup records date, change ID, participants, failover direction and who verified the environment mapping.</li>
<li><kbd>Enter</kbd> starts / completes the focused step; the next step is focused automatically with a preview. <kbd>↑</kbd><kbd>↓</kbd> move focus.</li>
<li>Several steps can run at once — each has its own timer in <b>Active now</b>. Use <b>Lanes</b> to track each datacenter separately.</li>
<li><b>📣 Updates</b> (right panel) shows which communications are due — compose a branded email and copy it into Outlook, open it as an Outlook draft, or copy it for Teams. Templates and audiences live on the <b>Comms</b> page.</li>
<li><b>📺 Follow</b> opens a read-only live view to share with the team, leadership or a war-room screen.</li>
<li><kbd>I</kbd> logs an issue (paste screenshots with Ctrl+V). <kbd>N</kbd> adds an improvement note without leaving the step. <kbd>G</kbd> jumps to a step number.</li>
<li>Forgot to press Start? Complete it anyway — the finish time is recorded and the timing is flagged <i>unreliable</i>. You can enter the real start later (<i>manual</i>).</li></ul>` }),
      actions: [{ label: "Got it", kind: "primary" }],
    });
  }

  return {
    boot, go, route, thumb, lightbox, statusChip, askName, rememberPeople, refreshPeople, saveNewProcedure, exportProcedure, importJSON, help, LS,
    get me() { return me || "Operator"; }, dirty: null,
  };
})();

document.addEventListener("DOMContentLoaded", () => PR.app.boot());
