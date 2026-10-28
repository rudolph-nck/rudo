/* print.js — (1) procedure document for PDF export (#/print/<procId>/<version|draft>) and
   (2) run comparison report (#/compare/<baselineRunId>/<runId>). Both are printable (Save as PDF). */
(() => {
  const { h, $, toast, now, fmtDur, fmtTime, fmtDate, fmtDateTime, fmtMin } = PR.u;
  const S = () => PR.store.b;
  const M = () => PR.model;
  const DONE = ["done", "skipped", "na"];
  const tbl = (head, rows, cls = "") => h(`table.rp-table${cls}`, h("thead", h("tr", head.map((x) => h("th", x)))), h("tbody", rows));
  const sec = (n, title, ...kids) => h("section.rp-sec", h("h2", h("span.rp-n", n), title), kids);
  const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  let savedTitle = null;
  const setDocTitle = (t) => { if (savedTitle == null) savedTitle = document.title; document.title = t; };
  const restoreTitle = () => { if (savedTitle != null) { document.title = savedTitle; savedTitle = null; } };

  /* Resolve a procedure version ("draft" or a number; default = latest published) plus who/when last modified it
     and the export file name "<title> - vN - <date> - last modified by <name>". Shared by the PDF and Word exports. */
  PR.loadProcedureVersion = async (procId, which) => {
    const doc = await S().getProcedure(procId);
    if (!doc) return null;
    const versions = (doc.versions || []).slice().sort((a, b) => b.version - a.version);
    which = which || (doc.publishedVersion ? String(doc.publishedVersion) : "draft");
    let data, verLabel, modBy, modAt;
    if (which === "draft") { data = doc.draft; verLabel = doc.publishedVersion ? `Draft (after v${doc.publishedVersion})` : "Draft"; modBy = doc.updatedBy; modAt = doc.updatedAt; }
    else {
      data = await S().getVersion(procId, Number(which));
      const v = versions.find((x) => String(x.version) === which) || {};
      verLabel = `v${which}`; modBy = v.by || doc.updatedBy; modAt = v.at || doc.publishedAt;
      if (!data) { data = doc.draft; verLabel = "Draft"; which = "draft"; modBy = doc.updatedBy; modAt = doc.updatedAt; }
    }
    const p = M().normalize(JSON.parse(JSON.stringify(data)));
    const fileTitle = safeName(`${p.title} - ${verLabel.replace(/\s*\(.*\)/, "")} - ${fmtDate(now())} - last modified by ${modBy || "unknown"}`);
    return { doc, versions, which, p, verLabel, modBy, modAt, fileTitle };
  };

  /* ======================= PROCEDURE → PDF ======================= */
  PR.views.print = {
    async mount(el, procId, which) {
      const src = await PR.loadProcedureVersion(procId, which);
      if (!src) { el.append(h("div.empty", h("div.empty-title", "Procedure not found"))); return; }
      const { doc, versions, p, verLabel, modBy, modAt, fileTitle } = src;
      which = src.which;
      const cfg = await PR.comms.load().catch(() => ({}));
      setDocTitle(fileTitle); // Edge / Chrome use the page title as the default PDF file name

      const ctx = { var: {}, run: {}, site: {} }; // leave {{variables}} visible — they resolve when the procedure is run
      const env = p.environments;
      const tracks = M().tracks(p);
      const steps = M().allSteps(p);
      const toolbar = h("div.rp-bar.no-print",
        h("a.icon-btn", { href: `#/edit/${encodeURIComponent(procId)}`, title: "Back to builder" }, "←"),
        h("label.small.muted", "Version "),
        h("select.inp.sm.w-auto", { onchange: (e) => PR.app.go(`#/print/${encodeURIComponent(procId)}/${e.target.value}`) },
          versions.map((v) => h("option", { value: String(v.version), selected: which === String(v.version) }, `v${v.version} · ${fmtDate(v.at)} · ${v.by || ""}`)),
          h("option", { value: "draft", selected: which === "draft" }, "Current draft")),
        h("div.spacer"),
        h("span.small.muted", "File name: ", h("b", fileTitle + ".pdf")),
        h("button.btn", { type: "button", title: "Download as a Word document in the same layout", onclick: () => PR.word.exportProcedure(procId, which) }, "⇩ Word (.docx)"),
        h("button.btn.btn-primary", { type: "button", onclick: () => { toast("Choose “Save as PDF” as the printer", "info", 3000); setTimeout(() => window.print(), 300); } }, "⇩ Save as PDF"));

      const role = (step, section) => {
        const t = step.target || "none";
        if (t === "none") return "";
        if (t === "primary" || t === "secondary") { const r = env.roles[t]; const ph = M().phaseOf(step, section); return `${ph === "post" ? r.post : r.pre} (role)`; }
        if (t === "both") return "Both sites";
        if (t === "custom") return step.targetLabel || "Other";
        if (t.startsWith("site:")) { const s = M().siteById(p, t.slice(5)); return s ? `${s.name} (fixed)` : ""; }
        return "";
      };

      el.append(h("div.report.print-doc", toolbar,
        h("header.pd-head",
          h("div.pd-brand", h("img", { src: "app/icons/icon.svg", alt: "" }), h("div", h("b", cfg.orgName || ""), h("span", cfg.teamName || ""))),
          h("div.rp-kicker", "Procedure"), h("h1", p.title),
          p.description ? h("p.pd-desc", p.description) : null,
          h("table.kv.pd-meta", h("tbody",
            h("tr", h("th", "Version"), h("td", verLabel), h("th", "Status"), h("td", doc.status)),
            h("tr", h("th", "Last modified by"), h("td", modBy || "—"), h("th", "Last modified"), h("td", fmtDateTime(modAt))),
            h("tr", h("th", "Exported"), h("td", `${fmtDateTime(now())} by ${PR.app.me}`), h("th", "Steps"), h("td", `${steps.length}${M().estimateMinutes(p) ? " · est. " + fmtMin(M().estimateMinutes(p)) : ""}`)),
            (() => { const ids = [...new Set([M().ownerOf(doc), ...tracks.map((t) => t.dept)].filter(Boolean))]; const name = (id) => (PR.app.dept(id) || {}).name || id;
              return ids.length ? h("tr", h("th", "Department"), h("td", M().ownerOf(doc) ? name(M().ownerOf(doc)) : "—"), h("th", "Teams involved"), h("td", ids.map(name).join(", "))) : null; })(),
            (p.tags || []).length ? h("tr", h("th", "Tags"), h("td", { colspan: 3 }, p.tags.join(", "))) : null,
            (() => { const a = M().approvalsCfg(p); return a.enforced || a.approvers.length ? h("tr", h("th", "Approvals"), h("td", { colspan: 3 }, `${a.enforced ? "Required — cannot be bypassed" : "Optional"} · approvers: ${[...a.approvers, ...a.chairs.map((c) => c + " chair")].join(", ") || "—"}`)) : null; })()))),

        env.enabled ? sec("E", "Environments",
          tbl(["Datacenter", "Code", "HMC partition (fixed)", "HMC URL"], M().sites(p).map((s) => h("tr", h("td", h("b", s.name)), h("td", s.code), h("td", s.partition || "—"), h("td.small", s.hmc || "")))),
          env.directional ? [h("h3", "Role mapping by direction"), h("div.help", "Steps target a logical role. The run asks which datacenter is primary at the start; this is how roles map in each direction."),
            tbl(["Direction", ...M().sites(p).map((s) => s.name)], M().sites(p).map((ps) => h("tr", h("td", h("b", `${ps.name} → ${(M().otherSite(p, ps.id) || {}).name}`)),
              M().sites(p).map((s) => { const r = env.roles[s.id === ps.id ? "primary" : "secondary"]; return h("td", `${r.pre} → ${r.post}`); }))))] : null) : null,

        tracks.length ? sec("L", "Lanes & teams", tbl(["Lane", "Department", "Responsible for", "Steps"], tracks.map((t) => h("tr", h("td", h("b", t.name)), h("td", t.dept && PR.app.dept(t.dept) ? PR.app.dept(t.dept).full || PR.app.dept(t.dept).name : "—"), h("td", t.desc || ""), h("td", String(steps.filter(({ step, section }) => M().trackOf(step, section) === t.id).length)))))) : null,
        tracks.length || steps.some(({ step }) => M().deps(step).length) ? sec("W", "Workflow", h("div.help", "Lanes run side by side. Dashed lines follow the order on the page; bold arrows are hand-offs — the step waits until the step the arrow comes from is done."), h("div.pd-flow", PR.flow.render({ proc: p, zoomKey: "printFlowZoom" }))) : null,

        (p.setup.readiness.length || p.setup.milestones.length) ? sec("R", "Run setup",
          p.setup.readiness.length ? [h("h3", "Readiness checklist"), h("ul.pd-checks", p.setup.readiness.map((r) => h("li", "☐ ", r.label)))] : null,
          p.setup.milestones.length ? [h("h3", "Completion milestones"), h("ul.pd-checks", p.setup.milestones.map((r) => h("li", "☐ ", r.label)))] : null) : null,

        M().hasImpact(p) ? sec("M", M().impactName(p), h("ul", steps.filter(({ step }) => step.impact && step.impact.mark).map(({ step }) =>
          h("li", step.impact.mark === "down" ? "🔴 Members impacted " : "🟢 Service restored ", step.impact.on === "start" ? "when step " : "after step ", h("b", `${step.num} ${step.title}`), step.impact.on === "start" ? " starts" : " completes")))) : null,

        p.sections.map((section, si) => h("section.pd-section",
          h("h2.pd-sec-h", h("span.rp-n", String(si + 1)), section.title,
            (() => { const t = M().trackById(p, section.track); return t ? h("span.track-chip", { style: { "--c": t.color } }, t.name) : null; })(),
            section.phase === "post" && env.directional ? h("span.chip.c-amber-o", "after cutover") : null),
          M().sheetLabel(p, section) ? h("div.pd-sheet", "Run sheet: ", M().sheetLabel(p, section)) : null,
          section.description ? h("p.muted", section.description) : null,
          section.steps.map((step) => {
            const t = M().trackById(p, M().trackOf(step, section));
            const meta = [role(step, section) && `Target: ${role(step, section)}`, t && `Lane: ${t.name}`, step.owner && `Owner: ${step.owner}`, step.contact && `Escalation: ${step.contact}`, step.window && `When: ${step.window}`, step.estMin && `Est. ${step.estMin} min`,
              step.parallel && "Runs in parallel with previous", step.hold && "Hold point", step.critical && "★ Critical",
              step.condition && `Only when ${(M().siteById(p, step.condition.slice(4)) || {}).name} is primary`,
              M().deps(step).length && `Waits for step ${M().deps(step).map((id) => (M().findStep(p, id) || { step: {} }).step.num || "?").join(", ")}`,
              step.impact && step.impact.mark && (step.impact.mark === "down" ? "🔴 Starts member impact" : "🟢 Ends member impact")].filter(Boolean);
            return h("div.pd-step",
              h("div.pd-step-h", h("span.pd-num", step.num || "•"), h("span.pd-title", step.title), PR.ui.catChip(step.category), h("span.pd-box", "☐")),
              meta.length ? h("div.pd-meta-line", meta.join(" · ")) : null,
              (step.blocks || []).length ? h("div.pd-blocks", step.blocks.map((b) => { const d = PR.blocks.def(b.type); return d ? h("div.pd-blk", d.preview(b, ctx)) : null; })) : null,
              PR.guide.pagesOf(step).length ? h("div.pd-guide", h("div.small.muted", "📖 How to"), PR.guide.pagesOf(step).map((g, k) => h("div.pd-guide-page", h("b", `${k + 1}.`),
                h("div", (g.text || "").trim() ? h("div", { html: PR.u.md(g.text) }) : null, g.img && g.img.startsWith("data:") ? h("img", { src: g.img, alt: "" }) : null)))) : null);
          }))),
        h("footer.pd-foot", `${p.title} · ${verLabel} · last modified by ${modBy || "unknown"} ${fmtDate(modAt)} · exported ${fmtDateTime(now())}`)));
    },
    unmount() { restoreTitle(); },
  };

  /* ======================= COMPARE RUNS ======================= */
  function metrics(run) {
    const p = run.snapshot; const st = (id) => (run.steps || {})[id] || {};
    const all = M().allSteps(p).filter(({ step }) => M().isApplicable(step, run.setup));
    const done = all.filter(({ step }) => st(step.id).status === "done").length;
    const skipped = all.filter(({ step }) => ["skipped", "na"].includes(st(step.id).status)).length;
    const issues = Object.values(run.issues || {});
    const rb = issues.filter((i) => i.blocking);
    const im = M().impactState(run, run.completedAt || now());
    const vals = Object.values(run.steps || {});
    const doneSteps = vals.filter((s) => s.status === "done");
    return {
      date: run.startedAt || run.createdAt, duration: run.startedAt ? (run.completedAt || now()) - run.startedAt : null, direction: run.directionLabel || M().directionLabel(p, run.setup),
      version: run.procVersion, outcome: (run.completion || {}).outcome || run.status, done, skipped, total: all.length,
      issues: issues.length, roadblocks: rb.length, roadblockMs: rb.reduce((a, i) => a + ((i.resolvedAt || run.completedAt || now()) - i.at), 0),
      impactMs: im.enabled ? im.totalMs : null, interruptions: im.periods.length,
      timingAuto: doneSteps.filter((s) => (s.timing || "auto") === "auto").length, timingUnreliable: doneSteps.filter((s) => s.timing === "unavailable").length, doneCount: doneSteps.length,
      comms: Object.values(run.comms || {}).length, participants: (run.setup.participants || []).map((x) => x.name).filter(Boolean),
    };
  }
  const dur = (s) => (s && s.status === "done" && s.startedAt && s.finishedAt && s.timing !== "unavailable" ? s.finishedAt - s.startedAt : null);
  function delta(a, b, { time = true, lowerBetter = true } = {}) {
    if (a == null || b == null) return h("span.muted", "—");
    const d = b - a; if (!d) return h("span.muted", "same");
    const better = lowerBetter ? d < 0 : d > 0;
    const txt = time ? `${d > 0 ? "+" : "−"}${fmtDur(Math.abs(d), { short: true })}` : `${d > 0 ? "+" : ""}${d}`;
    const pct = time && a ? ` (${d > 0 ? "+" : ""}${Math.round((d / a) * 100)}%)` : "";
    return h(`span.${better ? "dl-good" : "dl-bad"}`, txt + pct);
  }

  PR.views.compare = {
    async mount(el, idA, idB) {
      let [A, B] = await Promise.all([S().getRun(idA), S().getRun(idB)]);
      if (!A || !B) { el.append(h("div.empty", h("div.empty-title", "Run not found"))); return; }
      if ((A.startedAt || A.createdAt) > (B.startedAt || B.createdAt)) [A, B] = [B, A]; // A = earlier (baseline), B = later
      A.snapshot = M().normalize(A.snapshot); B.snapshot = M().normalize(B.snapshot);
      const mA = metrics(A), mB = metrics(B);
      const siblings = (await S().listRuns(B.procId)).filter((r) => !r.practice && r.id !== B.id).sort((x, y) => (y.startedAt || y.createdAt) - (x.startedAt || x.createdAt));
      setDocTitle(safeName(`Run comparison - ${B.procTitle} - ${fmtDate(mA.date)} vs ${fmtDate(mB.date)}`));

      // step-level rows: B order first, then steps only in A
      const rowsB = M().allSteps(B.snapshot), idsB = new Set(rowsB.map((x) => x.step.id));
      const rowsA = M().allSteps(A.snapshot), byIdA = Object.fromEntries(rowsA.map((x) => [x.step.id, x]));
      const rows = [...rowsB.map((x) => ({ id: x.step.id, b: x, a: byIdA[x.step.id] })), ...rowsA.filter((x) => !idsB.has(x.step.id)).map((x) => ({ id: x.step.id, a: x, b: null }))]
        .map((r) => { const sa = (A.steps || {})[r.id], sb = (B.steps || {})[r.id]; const da = dur(sa), db = dur(sb); return { ...r, sa, sb, da, db, d: da != null && db != null ? db - da : null }; });
      const added = rows.filter((r) => r.b && !r.a), removed = rows.filter((r) => r.a && !r.b);
      const changed = rows.filter((r) => r.a && r.b && (r.a.step.title !== r.b.step.title || r.a.step.num !== r.b.step.num || JSON.stringify(r.a.step.blocks) !== JSON.stringify(r.b.step.blocks) || r.a.step.target !== r.b.step.target));
      const slower = rows.filter((r) => r.d != null && r.d > 60000 && r.d > r.da * 0.2).sort((x, y) => y.d - x.d);
      const faster = rows.filter((r) => r.d != null && r.d < -60000 && -r.d > r.da * 0.2).sort((x, y) => x.d - y.d);
      const statusDiff = rows.filter((r) => r.a && r.b && ((r.sa || {}).status || "pending") !== ((r.sb || {}).status || "pending"));
      // validations / decisions that changed outcome
      const blockOutcome = (run, type) => { const o = {}; M().allSteps(run.snapshot).forEach(({ step }) => (step.blocks || []).filter((b) => b.type === type).forEach((b) => { const v = (((run.steps || {})[step.id] || {}).values || {})[b.id]; o[b.id] = { step, b, v }; })); return o; };
      const valA = blockOutcome(A, "validation"), valB = blockOutcome(B, "validation");
      const valDiff = Object.keys(valB).filter((k) => valA[k] && ((valA[k].v || {}).result || "") !== ((valB[k].v || {}).result || ""));
      const decA = blockOutcome(A, "decision"), decB = blockOutcome(B, "decision");
      const decDiff = Object.keys(decB).filter((k) => decA[k] && ((decA[k].v || {}).decision || "") !== ((decB[k].v || {}).decision || ""));
      const issA = Object.values(A.issues || {}), issB = Object.values(B.issues || {});
      const norm = (t) => String(t || "").toLowerCase().trim();
      const newIssues = issB.filter((i) => !issA.some((j) => norm(j.title) === norm(i.title)));
      const recurring = issB.filter((i) => issA.some((j) => norm(j.title) === norm(i.title)));
      const goneIssues = issA.filter((i) => !issB.some((j) => norm(j.title) === norm(i.title)));
      const carried = Object.values(B.carried || {});

      // headline bullets
      const bullets = [];
      if (mA.duration && mB.duration) { const d = mB.duration - mA.duration; bullets.push(`${d > 0 ? "Took" : "Finished"} ${fmtDur(Math.abs(d), { short: true })} ${d > 0 ? "longer" : "faster"} overall (${fmtDur(mB.duration, { short: true })} vs ${fmtDur(mA.duration, { short: true })}).`); }
      if (mA.impactMs != null && mB.impactMs != null && (mA.impactMs || mB.impactMs)) { const d = mB.impactMs - mA.impactMs; bullets.push(`Members were impacted for ${fmtDur(mB.impactMs, { short: true })} (${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmtDur(Math.abs(d), { short: true })} vs last time).`); }
      if (mA.direction && mB.direction && mA.direction !== mB.direction) bullets.push(`Opposite direction: ${mB.direction} (last time ${mA.direction}).`);
      if (A.procVersion !== B.procVersion) bullets.push(`Procedure changed: ${A.procVersion === "draft" ? "draft" : "v" + A.procVersion} → ${B.procVersion === "draft" ? "draft" : "v" + B.procVersion} (${added.length} added, ${removed.length} removed, ${changed.length} edited steps).`);
      if (slower.length) bullets.push(`${slower.length} step(s) noticeably slower — biggest: ${slower[0].b.step.num} ${slower[0].b.step.title} (+${fmtDur(slower[0].d, { short: true })}).`);
      if (faster.length) bullets.push(`${faster.length} step(s) noticeably faster — biggest: ${faster[0].b.step.num} ${faster[0].b.step.title} (−${fmtDur(-faster[0].d, { short: true })}).`);
      if (newIssues.length) bullets.push(`${newIssues.length} new issue(s) this time; ${recurring.length} repeated from last time.`);
      if (valDiff.length) bullets.push(`${valDiff.length} validation result(s) changed.`);
      if (carried.length) bullets.push(`${carried.filter((c) => c.result === "improved").length} of ${carried.length} improvements from last time worked.`);

      const pick = (side) => h("select.inp.sm.w-auto", { onchange: (e) => PR.app.go(side === "a" ? `#/compare/${e.target.value}/${B.id}` : `#/compare/${A.id}/${e.target.value}`) },
        [...siblings, { id: B.id, name: B.name, startedAt: B.startedAt }].filter((r) => side === "a" ? r.id !== B.id : r.id !== A.id).map((r) => h("option", { value: r.id, selected: r.id === (side === "a" ? A.id : B.id) }, `${fmtDate(r.startedAt || r.createdAt)} · ${r.name || ""}`)));
      const label = (run) => `${fmtDate(run.startedAt || run.createdAt)}`;
      const sumRow = (k, va, vb, d) => h("tr", h("th", k), h("td", va ?? "—"), h("td", vb ?? "—"), h("td", d || ""));

      el.append(h("div.report",
        h("div.rp-bar.no-print", h("a.icon-btn", { href: `#/history/${encodeURIComponent(B.procId)}` }, "←"), h("span.small.muted", "Previous"), pick("a"), h("span.small.muted", "vs"), pick("b"),
          h("div.spacer"), h("button.btn", { type: "button", onclick: () => window.print() }, "🖨 Print / PDF")),
        h("header.rp-head", h("div", h("div.rp-kicker", "Run comparison"), h("h1", B.procTitle), h("div.muted", `${label(A)} (${A.name}) → ${label(B)} (${B.name})`))),
        sec("★", "What was different", bullets.length ? h("ul.cmp-bullets", bullets.map((b) => h("li", b))) : h("div.muted", "No notable differences.")),
        sec("1", "Side by side", h("table.rp-table.cmp-sum", h("thead", h("tr", h("th", ""), h("th", `Previous · ${label(A)}`), h("th", `This run · ${label(B)}`), h("th", "Change"))), h("tbody",
          sumRow("Direction", mA.direction, mB.direction, mA.direction !== mB.direction ? "reversed" : ""),
          sumRow("Procedure version", A.procVersion === "draft" ? "draft" : `v${A.procVersion}`, B.procVersion === "draft" ? "draft" : `v${B.procVersion}`),
          sumRow("Outcome", mA.outcome, mB.outcome),
          sumRow("Total duration", mA.duration != null ? fmtDur(mA.duration) : null, mB.duration != null ? fmtDur(mB.duration) : null, delta(mA.duration, mB.duration)),
          mA.impactMs != null || mB.impactMs != null ? sumRow("Member impact", mA.impactMs != null ? fmtDur(mA.impactMs) : null, mB.impactMs != null ? fmtDur(mB.impactMs) : null, delta(mA.impactMs, mB.impactMs)) : null,
          sumRow("Steps done / skipped", `${mA.done} / ${mA.skipped}`, `${mB.done} / ${mB.skipped}`),
          sumRow("Issues", mA.issues, mB.issues, delta(mA.issues, mB.issues, { time: false })),
          sumRow("Roadblocks (time held up)", `${mA.roadblocks} (${fmtDur(mA.roadblockMs, { short: true })})`, `${mB.roadblocks} (${fmtDur(mB.roadblockMs, { short: true })})`, delta(mA.roadblockMs, mB.roadblockMs)),
          sumRow("Timing captured automatically", `${mA.timingAuto}/${mA.doneCount}`, `${mB.timingAuto}/${mB.doneCount}`),
          sumRow("Communications sent", mA.comms, mB.comms),
          sumRow("Participants", mA.participants.join(", "), mB.participants.join(", "))))),
        sec("2", "Biggest timing changes",
          slower.length || faster.length ? tbl(["#", "Step", "Previous", "This run", "Change"], [...slower.slice(0, 10), ...faster.slice(0, 5)].map((r) => h("tr", h("td", r.b.step.num), h("td", r.b.step.title), h("td", fmtDur(r.da, { short: true })), h("td", fmtDur(r.db, { short: true })), h("td", delta(r.da, r.db))))) : h("div.muted", "No step changed by more than a minute and 20%.")),
        sec("3", "Phase durations", tbl(["Section", "Previous", "This run", "Change"], B.snapshot.sections.map((sb) => {
          const span = (run, ids) => { const ss = ids.map((id) => (run.steps || {})[id]).filter((x) => x && x.startedAt && x.finishedAt); return ss.length ? Math.max(...ss.map((x) => x.finishedAt)) - Math.min(...ss.map((x) => x.startedAt)) : null; };
          const ids = sb.steps.map((x) => x.id); const a = span(A, ids), b = span(B, ids);
          return h("tr", h("td", sb.title), h("td", a != null ? fmtDur(a, { short: true }) : "—"), h("td", b != null ? fmtDur(b, { short: true }) : "—"), h("td", delta(a, b)));
        }))),
        sec("4", "Issues & roadblocks",
          newIssues.length ? [h("h3", "New this time"), h("ul", newIssues.map((i) => h("li", i.blocking ? "🚧 " : "", h("b", i.title), i.resolution ? ` — ${i.resolution}` : "")))] : null,
          recurring.length ? [h("h3", "Happened again"), h("ul", recurring.map((i) => h("li.dl-bad", i.title)))] : null,
          goneIssues.length ? [h("h3", "Didn't recur"), h("ul", goneIssues.map((i) => h("li.dl-good", i.title)))] : null,
          !issA.length && !issB.length ? h("div.muted", "No issues in either run.") : null),
        valDiff.length || decDiff.length ? sec("5", "Checks & decisions that changed",
          tbl(["Step", "Item", "Previous", "This run"], [...valDiff.map((k) => h("tr", h("td", valB[k].step.num), h("td", M().interpolate(valB[k].b.test, {}, false)), h("td", ((valA[k].v || {}).result || "not recorded").toUpperCase()), h("td", ((valB[k].v || {}).result || "not recorded").toUpperCase()))),
            ...decDiff.map((k) => h("tr", h("td", decB[k].step.num), h("td", decB[k].b.question), h("td", ((decA[k].v || {}).decision || "pending").toUpperCase()), h("td", ((decB[k].v || {}).decision || "pending").toUpperCase())))])) : null,
        statusDiff.length ? sec("6", "Steps handled differently", tbl(["#", "Step", "Previous", "This run"], statusDiff.map((r) => h("tr", h("td", r.b.step.num), h("td", r.b.step.title),
          h("td", `${(r.sa || {}).status || "pending"}${(r.sa || {}).skipReason ? " — " + r.sa.skipReason : ""}`), h("td", `${(r.sb || {}).status || "pending"}${(r.sb || {}).skipReason ? " — " + r.sb.skipReason : ""}`))))) : null,
        added.length || removed.length || changed.length ? sec("7", "Procedure changes between the runs",
          added.length ? [h("h3", `Added (${added.length})`), h("ul", added.map((r) => h("li", `${r.b.step.num} ${r.b.step.title}`)))] : null,
          removed.length ? [h("h3", `Removed (${removed.length})`), h("ul", removed.map((r) => h("li", `${r.a.step.num} ${r.a.step.title}`)))] : null,
          changed.length ? [h("h3", `Edited (${changed.length})`), h("ul", changed.map((r) => h("li", `${r.b.step.num} ${r.b.step.title}`, r.a.step.title !== r.b.step.title ? h("span.muted", ` (was “${r.a.step.title}”)`) : "")))] : null) : null,
        carried.length ? sec("8", "Did last time's improvements work?", tbl(["Lesson", "Result", "Checked by"], carried.map((c) => h("tr", h("td", c.text), h("td", h("b", c.result === "improved" ? "✓ Improved" : c.result === "not_improved" ? "✕ Not improved" : "Not tested")), h("td", `${c.by} ${fmtTime(c.at, false)}`))))) : null,
        sec("9", "Every step", tbl(["#", "Step", "Previous", "This run", "Change"], rows.map((r) => { const s = (r.b || r.a).step;
          return h(`tr${!r.a ? ".row-added" : !r.b ? ".row-removed" : ""}`, h("td", s.num), h("td", s.title, !r.a ? h("span.chip.c-green", "new") : !r.b ? h("span.chip.c-red", "removed") : null),
            h("td", r.da != null ? fmtDur(r.da, { short: true }) : (r.sa || {}).status || "—"), h("td", r.db != null ? fmtDur(r.db, { short: true }) : (r.sb || {}).status || "—"), h("td", delta(r.da, r.db))); }), ".rp-steps"))));
    },
    unmount() { restoreTitle(); },
  };

  /* Find the run before this one (same procedure, not practice) */
  PR.compareWithPrevious = async (run) => {
    const prev = (await S().listRuns(run.procId)).filter((r) => r.id !== run.id && !r.practice && (r.startedAt || r.createdAt) < (run.startedAt || run.createdAt))
      .sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt))[0];
    if (!prev) return toast("No earlier run of this procedure to compare with", "warn");
    PR.app.go(`#/compare/${prev.id}/${run.id}`);
  };
})();
