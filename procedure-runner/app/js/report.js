/* report.js — run report (printable; covers setup → lessons learned), procedure history & insights,
   all-runs list and the lessons-learned board. */
(() => {
  const { h, $, $$, esc, toast, modal, menu, uid, clone, now, fmtDur, fmtTime, fmtDateTime, fmtDate, fmtMin, median, csv, download } = PR.u;
  const S = () => PR.store.b;
  const M = () => PR.model;

  function stepRows(run) {
    const p = run.snapshot;
    return M().allSteps(p).map(({ step, section }) => {
      const s = (run.steps || {})[step.id] || {};
      const applicable = M().isApplicable(step, run.setup);
      const status = applicable ? s.status || "pending" : "na";
      return { step, section, s, status, t: M().resolveTarget(p, step, section, run.setup), dur: status === "done" && s.startedAt && s.finishedAt && s.timing !== "unavailable" ? s.finishedAt - s.startedAt : null };
    });
  }
  function blockValues(run, type) {
    const out = [];
    M().allSteps(run.snapshot).forEach(({ step }) => (step.blocks || []).filter((b) => b.type === type).forEach((b) => out.push({ step, block: b, v: (((run.steps || {})[step.id] || {}).values || {})[b.id] })));
    return out;
  }
  function comms(run) {
    const ctx = M().varContext(run);
    const out = blockValues(run, "contact").map(({ step, block: b, v = {} }) => ({ step, who: b.who, method: b.method, detail: M().interpolate(b.detail || "", ctx, false), request: M().interpolate(b.request || "", ctx, false), at: v.contactedAt, by: v.by, confirmedAt: v.confirmedAt, confirmed: v.confirmedAt ? true : v.confirmed === false ? false : null, reference: v.reference, response: v.response }));
    Object.values(run.comms || {}).forEach((c) => out.push({ ...c, step: c.stepId ? (M().findStep(run.snapshot, c.stepId) || {}).step : null }));
    return out.sort((a, b) => (a.at || Infinity) - (b.at || Infinity));
  }
  const sec = (n, title, ...kids) => h("section.rp-sec", h("h2", h("span.rp-n", n), title), kids);
  const kv = (rows) => h("table.kv", h("tbody", rows.filter(Boolean).map(([k, v]) => h("tr", h("th", k), h("td", v ?? "—")))));
  const tbl = (head, rows, cls = "") => h(`table.rp-table${cls}`, h("thead", h("tr", head.map((x) => h("th", x)))), h("tbody", rows));
  const none = (t = "None recorded.") => h("div.muted", t);

  /* ======================= RUN REPORT ======================= */
  PR.views.report = {
    async mount(el, runId) {
      const run = await S().getRun(runId);
      if (!run) { el.append(h("div.empty", h("div.empty-title", "Run not found"))); return; }
      run.snapshot = M().normalize(run.snapshot);
      const p = run.snapshot; const su = run.setup || {}; const env = p.environments;
      const rows = stepRows(run);
      const pr = rows.filter((r) => r.status !== "na");
      const timingCounts = { auto: 0, manual: 0, unavailable: 0 };
      pr.forEach((r) => { if (r.status === "done") timingCounts[r.s.timing || "auto"]++; });
      const issues = Object.values(run.issues || {}).sort((a, b) => a.at - b.at);
      const elapsed = run.startedAt ? (run.completedAt || now()) - run.startedAt : null;
      const directional = env.enabled && env.directional;

      const exportCSV = () => download(`${PR.u.slug(run.name)}.steps.csv`, csv([
        ["Step", "Title", "Section", "Datacenter", "HMC partition", "Role", "Status", "Started", "Finished", "Duration (s)", "Timing", "Started by", "Finished by", "Notes"],
        ...rows.map((r) => [r.step.num, r.step.title, r.section.title, r.t.title || "", r.t.partition || "", r.t.roleLabel || "", r.status, r.s.startedAt ? fmtDateTime(r.s.startedAt) : "", r.s.finishedAt ? fmtDateTime(r.s.finishedAt) : "", r.dur != null ? Math.round(r.dur / 1000) : "", r.s.timing ? PR.ui.TIMING[r.s.timing].label : "", r.s.startedBy || "", r.s.finishedBy || "", r.s.skipReason || (r.s.incomplete ? "Incomplete: " + r.s.incomplete.join("; ") : "")]),
      ]), "text/csv");

      el.append(h("div.report",
        h("div.rp-bar.no-print", h("a.icon-btn", { href: "#/" }, "←"), h("div.spacer"),
          ["active", "paused", "setup"].includes(run.status) ? h("a.btn.btn-primary", { href: `#/run/${run.id}` }, "Back to run") : null,
          h("button.btn", { type: "button", onclick: () => window.print() }, "🖨 Print / PDF"), h("button.btn", { type: "button", onclick: exportCSV }, "⇩ Steps CSV"),
          h("button.btn", { type: "button", onclick: async () => download(`${PR.u.slug(run.name)}.run.json`, JSON.stringify(await PR.store.exportRunBundle(run), null, 2)) }, "⇩ JSON"),
          h("button.btn", { type: "button", title: "What was different from the previous run", onclick: () => PR.compareWithPrevious(run) }, "⇄ Compare with previous"),
          h("a.btn.btn-ghost", { href: `#/history/${encodeURIComponent(run.procId)}` }, "📈 History")),
        h("header.rp-head",
          h("div", h("div.rp-kicker", run.practice ? "Practice run report" : "Run report"), h("h1", run.name), h("div.muted", `${run.procTitle} · ${run.procVersion === "draft" ? "draft" : "v" + run.procVersion}`)),
          h("div.rp-hstats", PR.app.statusChip(run.status), run.completion && run.completion.outcome ? h("span.chip.c-blue", run.completion.outcome) : null,
            h("div.stat", h("div.stat-v", elapsed != null ? fmtDur(elapsed) : "—"), h("div.stat-k", "Elapsed")),
            h("div.stat", h("div.stat-v", `${pr.filter((r) => ["done", "skipped"].includes(r.status)).length}/${pr.length}`), h("div.stat-k", "Steps")),
            h("div.stat", h("div.stat-v", String(issues.length)), h("div.stat-k", "Issues")))),

        sec("1", "Run setup",
          kv([["Date", su.exerciseDate], ["Change / exercise ID", su.changeId], ["Started", fmtDateTime(run.startedAt)], ["Completed", fmtDateTime(run.completedAt)],
            directional ? ["Direction", h("b", M().directionLabel(p, su))] : null,
            ["Participants", (su.participants || []).filter((x) => x.name).map((x) => `${x.name}${x.chair ? " — " + x.chair : ""}`).join("; ")]]),
          directional ? mapTable(p, su.primarySiteId) : null),

        env.enabled ? sec("2", "Environment verification",
          su.verification ? kv([["Verified by", su.verification.by], ["At", fmtDateTime(su.verification.at)], ["Note", su.verification.note]]) : h("div.banner.b-warn.sm", "Mapping was not verified before the run started."),
          h("div.rp-sites", M().sites(p).map((s) => PR.ui.envBadge(M().resolveTarget(p, { target: `site:${s.id}` }, null, su), { size: "md" })))) : null,

        p.setup.readiness.length ? sec("3", "Pre-run readiness",
          tbl(["Item", "Confirmed", "By", "At", "Note"], p.setup.readiness.map((r) => { const v = (su.readiness || {})[r.id] || {}; return h(`tr${v.done ? "" : ".warn-row"}`, h("td", r.label), h("td", v.done ? "✓" : "✕ not confirmed"), h("td", v.by || ""), h("td", v.at ? fmtTime(v.at) : ""), h("td", v.note || "")); }))) : null,

        (() => {
          const im = M().impactState(run, run.completedAt || now());
          const rbs = [...im.roadblocks.open, ...im.roadblocks.resolved].sort((a, b) => a.at - b.at);
          if (!im.enabled && !rbs.length) return null;
          const stepTxt = (id) => { const f = id && M().findStep(p, id); return f ? `${f.step.num} ${f.step.title}` : "declared manually"; };
          return sec("M", `${im.name} & roadblocks`,
            im.enabled ? [h("div.rp-note", im.periods.length || im.down ? `Total time members were impacted: ` : "Members were not impacted during this run.", im.periods.length || im.down ? h("b", fmtDur(im.totalMs)) : null),
              (im.periods.length || im.down) ? tbl(["Impact began", "Trigger", "Service restored", "Trigger", "Duration"], [...im.periods, ...(im.down ? [{ start: im.since, startStep: null, end: null }] : [])].map((x) => h("tr",
                h("td", fmtDateTime(x.start)), h("td", stepTxt(x.startStep)), h("td", x.end ? fmtDateTime(x.end) : "still impacted"), h("td", x.end ? stepTxt(x.endStep) : ""), h("td", h("b", fmtDur((x.end || now()) - x.start, { short: true })))))) : null,
              (run.impactLog || []).length ? h("div.small.muted", "Manual declarations: ", (run.impactLog || []).map((e) => `${e.type === "down" ? "down" : "up"} ${fmtTime(e.at)} by ${e.by}${e.note ? " (" + e.note + ")" : ""}`).join("; ")) : null] : null,
            rbs.length ? [h("h3", "Roadblocks"), tbl(["Roadblock", "Step", "Logged", "Resolved", "Time held up", "Resolution"], rbs.map((i) => h(`tr${i.status === "resolved" ? "" : ".warn-row"}`,
              h("td", h("b", i.title)), h("td", i.stepId ? stepTxt(i.stepId) : "General"), h("td", fmtTime(i.at)), h("td", i.resolvedAt ? fmtTime(i.resolvedAt) : "open"),
              h("td", fmtDur((i.resolvedAt || run.completedAt || now()) - i.at, { short: true })), h("td", i.resolution || ""))))] : null);
        })(),

        M().tracks(p).length ? sec("C", "Chairs", tbl(["Chair", "Responsible for", "Worked by", "Steps", "First start", "Last finish", "Signed off"], M().tracks(p).map((t) => {
          const pg = M().trackProgress(run, t.id);
          const rs = rows.filter((r) => M().trackOf(r.step, r.section) === t.id);
          const st = rs.filter((r) => r.s.startedAt).map((r) => r.s.startedAt), fi = rs.filter((r) => r.s.finishedAt).map((r) => r.s.finishedAt);
          const who = [...new Set(rs.map((r) => r.s.finishedBy || r.s.startedBy).filter(Boolean))].join(", ");
          return h("tr", h("td", h("b", t.name)), h("td", t.desc || ""), h("td", who), h("td", `${pg.done}/${pg.total}`), h("td", st.length ? fmtTime(Math.min(...st)) : ""), h("td", fi.length ? fmtTime(Math.max(...fi)) : ""),
            h("td", pg.signoff ? `${pg.signoff.by} · ${fmtDateTime(pg.signoff.at)}${pg.signoff.open ? ` (${pg.signoff.open} open)` : ""}` : h("b.c-red-t", "not signed off")));
        })), (run.completion || {}).chairOverride ? h("div.banner.b-warn.sm", `Closed without sign-off from ${run.completion.chairOverride.unsigned.join(", ")} — ${run.completion.chairOverride.reason} (${run.completion.chairOverride.by})`) : null) : null,

        sec("4", "Step execution & timing",
          h("div.rp-note", `Timing captured automatically: ${timingCounts.auto} · entered afterward: ${timingCounts.manual} · unreliable (no start time): ${timingCounts.unavailable}`),
          tbl(["#", "Step", "Target", "Executed by", "Status", "Start", "Finish", "Duration", "Timing"], rows.map((r) => h(`tr.st-${r.status}`,
            h("td", r.step.num), h("td", r.step.title, r.s.skipReason ? h("div.small.muted", r.s.skipReason) : null, r.s.incomplete ? h("div.small.c-amber-t", "Incomplete: " + r.s.incomplete.join(", ")) : null),
            h("td", PR.ui.envBadge(r.t, { size: "sm" }), (() => { const t = M().trackById(p, M().trackOf(r.step, r.section)); return t ? h("div", h("span.track-chip.sm", { style: { "--c": t.color } }, t.name)) : null; })()), h("td", ...(() => { const who = r.status === "done" ? r.s.finishedBy || r.s.startedBy : r.status === "active" ? r.s.startedBy : ""; return [who || "", chairShort(su, who)]; })()),
            h("td", PR.ui.STEP_STATUS[r.status].label), h("td", r.s.startedAt ? fmtTime(r.s.startedAt) : ""), h("td", r.s.finishedAt ? fmtTime(r.s.finishedAt) : ""),
            h("td", r.dur != null ? fmtDur(r.dur, { short: true }) : ""), h("td", r.s.timing && r.status !== "pending" ? PR.ui.timingChip(r.s.timing) : ""))), ".rp-steps")),

        sec("5", "Parallel operations & timeline", parallelSummary(p, rows, run), timeline(rows, run)),

        sec("6", "Problems & exceptions", issues.length ? issues.map((i) => {
          const f = i.stepId && M().findStep(p, i.stepId);
          return h(`div.rp-issue.sev-${i.severity}`, h("div.ri-h", h("b", i.title), h("span.chip", i.severity || ""), h("span.chip", i.status === "resolved" ? "Resolved" : "Open")),
            kv([["When", fmtDateTime(i.at)], ["Step", f ? `${f.step.num} · ${f.step.title}` : "General"], ["Logged by", i.by], ["What happened", i.what], ["Troubleshooting", i.troubleshooting], ["Assistance received", i.assistance], ["Resolution", i.resolution], i.resolvedAt ? ["Resolved", `${fmtDateTime(i.resolvedAt)} by ${i.resolvedBy || ""}`] : null]),
            (i.evidence || []).length ? h("div.thumbs", i.evidence.map((ev) => PR.app.thumb(ev))) : null);
        }) : none()),

        sec("7", "Communication & handoffs", (() => { const c = comms(run); return c.length ? tbl(["When", "Step", "Who", "Method", "Request", "By", "Confirmation", "Ref / response"], c.map((x) => h("tr", h("td", x.at ? fmtTime(x.at) : "not done"), h("td", x.step ? x.step.num : "—"), h("td", x.who, x.detail ? h("div.small.muted", x.detail) : null), h("td", PR.blocks.def("contact").methodLabel(x.method)), h("td", { html: PR.u.md(x.request || "") }), h("td", x.by || ""), h("td", x.confirmedAt ? `✓ ${fmtTime(x.confirmedAt)}` : x.confirmed === false ? "✕ none received" : x.at ? "not confirmed" : ""), h("td", [x.reference, x.response].filter(Boolean).join(" · "))))) : none(); })()),

        sec("8", "Critical decisions", (() => { const d = blockValues(run, "decision"); return d.length ? tbl(["Step", "Decision", "Outcome", "Decision-maker", "Time", "Criteria", "Rationale / evidence"], d.map(({ step, block, v }) => h(`tr${v && v.decision === "nogo" ? ".warn-row" : ""}`, h("td", step.num), h("td", block.question), h("td", v && v.decision ? h("b", v.decision === "go" ? "GO" : "NO-GO") : "pending"), h("td", v ? v.maker : ""), h("td", v ? fmtDateTime(v.at) : ""), h("td.small", { html: PR.u.md(block.criteria) }), h("td", v ? v.rationale || "" : "")))) : none(); })(),
          (() => { const a = blockValues(run, "approval"); return a.length ? [h("h3", "Sign-offs"), tbl(["Step", "Approval", "Approver", "Time", "Comment"], a.map(({ step, block, v }) => h("tr", h("td", step.num), h("td", block.label), h("td", v ? v.approver : "—"), h("td", v ? fmtDateTime(v.at) : ""), h("td", v ? v.comment || "" : ""))))] : null; })()),

(() => { const ap = Object.values(run.approvals || {}).sort((a, b) => a.requestedAt - b.requestedAt); const cfg = M().approvalsCfg(p);
          return ap.length || cfg.enforced ? sec("P", "Approvals", h("div.help", cfg.enforced ? `Required and enforced — approvers: ${M().approversFor(p, run).join(", ") || "none named"}.` : "Optional approvals."),
            ap.length ? tbl(["Request", "Asked by", "Asked", "Approvers", "Outcome", "Decided by", "Waited", "Comment"], ap.map((r) => h(`tr${r.status === "rejected" || r.bypassed ? ".warn-row" : ""}`,
              h("td", r.title, r.note ? h("div.small.muted", r.note) : null), h("td", r.requestedBy), h("td", fmtTime(r.requestedAt)), h("td", (r.to || []).join(", ") || "any"),
              h("td", h("b", r.status === "approved" ? (r.kind === "decision" ? "GO" : "✓ Approved") : r.status === "rejected" ? (r.kind === "decision" ? "NO-GO" : "✕ Rejected") : r.bypassed ? "Bypassed" : r.status === "cancelled" ? "Withdrawn" : "Pending")),
              h("td", r.decidedBy ? `${r.decidedBy}${r.verbal ? ` (verbal, recorded by ${r.recordedBy})` : ""}` : r.cancelledBy || ""), h("td", r.decidedAt ? fmtDur(r.decidedAt - r.requestedAt, { short: true }) : ""), h("td", r.comment || "")))) : h("div.muted", "No approval requests.")) : null; })(),
        sec("9", "Validation", (() => { const ctx = M().varContext(run); const d = blockValues(run, "validation"); return d.length ? tbl(["Step", "Test performed", "Expected", "Actual", "Result", "By / time"], d.map(({ step, block, v }) => h(`tr${v && v.result === "fail" ? ".warn-row" : ""}`, h("td", step.num), h("td", M().interpolate(block.test, ctx, false)), h("td", M().interpolate(block.expected, ctx, false)), h("td", v ? v.actual || "" : ""), h("td", v && v.result ? h("b", v.result === "pass" ? "✓ PASS" : "✕ FAIL") : "not recorded"), h("td", v && v.at ? `${v.by} ${fmtTime(v.at)}` : "")))) : none(); })()),

        sec("10", "Final completion", (() => {
          const c = run.completion || {};
          return [kv([["Outcome", c.outcome], ["Authorized by", c.authorizedBy], ["Authorized at", fmtDateTime(c.authorizedAt)], ["Summary / remaining work", c.summary]]),
            p.setup.milestones.length ? tbl(["Milestone", "Confirmed", "By", "At"], p.setup.milestones.map((m) => { const v = (c.milestones || {})[m.id]; return h("tr", h("td", m.label), h("td", v && v.done ? "✓" : "—"), h("td", v ? v.by : ""), h("td", v ? fmtTime(v.at) : "")); })) : null,
            issues.filter((i) => i.status !== "resolved").length ? h("div.banner.b-warn.sm", `Remaining open issues: ${issues.filter((i) => i.status !== "resolved").map((i) => i.title).join("; ")}`) : null];
        })()),

        sec("11", "Lessons learned", lessonsTable(run), (() => {
          const carried = Object.values(run.carried || {});
          return carried.length ? [h("h3", "Did previous improvements work?"), tbl(["Lesson", "Result", "Checked by"], carried.map((c) => h("tr", h("td", c.text || ""), h("td", h("b", c.result === "improved" ? "✓ Improved" : c.result === "not_improved" ? "✕ Not improved" : "Not tested")), h("td", `${c.by} ${fmtTime(c.at)}`))))] : null;
        })(), (() => { const n = Object.values(run.notes || {}); return n.length ? [h("h3", "Improvement notes captured during the run"), tbl(["Step", "Note", "By", "At"], n.map((x) => h("tr", h("td", x.stepId ? (M().findStep(p, x.stepId) || { step: {} }).step.num : ""), h("td", x.text), h("td", x.by), h("td", fmtTime(x.at)))))] : null; })()),

        sec("A", "Captured values", (() => { const d = [...blockValues(run, "input"), ...blockValues(run, "confirm"), ...blockValues(run, "checklist"), ...blockValues(run, "evidence")]; return d.length ? tbl(["Step", "Item", "Value", "By / time"], d.map(({ step, block, v }) => h("tr", h("td", step.num), h("td", PR.blocks.def(block.type).label + (block.label ? `: ${block.label}` : "")),
          h("td", block.type === "evidence" ? h("div.thumbs", ((v && v.items) || []).map((it) => PR.app.thumb(it))) : PR.blocks.def(block.type).summary(block, v)), h("td", v && v.at ? `${v.by || ""} ${fmtTime(v.at)}` : "")))) : none(); })()),

        sec("B", "Audit log", h("div.log.rp-log", (run.events || []).map((e) => h("div.log-row", h("span.log-t", fmtDateTime(e.at)), h("span.log-w", e.by || ""), h("span.log-x", e.text || e.type)))))));
    },
  };
  function chairShort(su, name) {
    const p = (su.participants || []).find((x) => x.name === name);
    return p && p.chair ? h("div.small.muted", p.chair.split("—")[0].trim()) : null;
  }
  function mapTable(p, primaryId) {
    const env = p.environments;
    return tbl(["Physical datacenter", "HMC partition (fixed)", "Role at start", "Role after failover"], M().sites(p).map((s) => {
      const role = s.id === primaryId ? "primary" : "secondary"; const r = env.roles[role]; const after = role === "primary" ? env.roles.secondary : env.roles.primary;
      return h("tr", h("td", s.name), h("td", s.partition || "—"), h("td", `${r.pre}${r.hostname ? " (" + r.hostname + ")" : ""}`), h("td", `${r.post}${after.hostname ? " (" + after.hostname + ")" : ""}`));
    }));
  }
  function parallelSummary(p, rows, run) {
    const groups = new Map();
    rows.forEach((r) => { const k = r.t.site ? r.t.site.name : r.t.kind === "both" ? "Both sites" : "Coordination / other"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    let overlaps = 0;
    const timed = rows.filter((r) => r.s.startedAt && r.s.finishedAt).sort((a, b) => a.s.startedAt - b.s.startedAt);
    for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length && timed[j].s.startedAt < timed[i].s.finishedAt; j++) overlaps++;
    return [h("div.rp-note", `${overlaps} pair(s) of steps overlapped in time (performed simultaneously).`),
      tbl(["Environment", "Steps", "Done", "First start", "Last finish", "Busy time"], [...groups.entries()].map(([k, rs]) => {
        const st = rs.filter((r) => r.s.startedAt).map((r) => r.s.startedAt); const fi = rs.filter((r) => r.s.finishedAt).map((r) => r.s.finishedAt);
        return h("tr", h("td", h("b", k)), h("td", String(rs.filter((r) => r.status !== "na").length)), h("td", String(rs.filter((r) => r.status === "done").length)), h("td", st.length ? fmtTime(Math.min(...st)) : ""), h("td", fi.length ? fmtTime(Math.max(...fi)) : ""), h("td", fmtDur(rs.reduce((a, r) => a + (r.dur || 0), 0), { short: true })));
      }))];
  }
  function timeline(rows, run) {
    const timed = rows.filter((r) => r.s.startedAt && r.s.finishedAt && r.s.timing !== "unavailable");
    if (!timed.length) return none("No timed steps yet.");
    const t0 = Math.min(...timed.map((r) => r.s.startedAt)); const t1 = Math.max(...timed.map((r) => r.s.finishedAt)); const span = Math.max(1, t1 - t0);
    const ticks = 6;
    return h("div.gantt",
      h("div.g-axis", Array.from({ length: ticks + 1 }, (_, i) => h("span", { style: { left: (i / ticks) * 100 + "%" } }, fmtTime(t0 + (span * i) / ticks, false)))),
      timed.map((r) => h("div.g-row", h("span.g-l", `${r.step.num} ${r.step.title}`.slice(0, 42)),
        h("div.g-track", h("div.g-bar", { style: { left: ((r.s.startedAt - t0) / span) * 100 + "%", width: Math.max(0.4, (r.dur / span) * 100) + "%", background: r.t.color || "#64748b" }, title: `${r.step.num} ${r.step.title}: ${fmtTime(r.s.startedAt)}–${fmtTime(r.s.finishedAt)} (${fmtDur(r.dur, { short: true })})` })))));
  }
  function lessonsTable(run) {
    const ls = Object.values(run.lessons || {});
    if (!ls.length) return none("No lessons recorded yet.");
    const label = { wrong: "What went wrong", worked: "What worked", change: "What we'll change" };
    return tbl(["Type", "Lesson", "Step", "Owner", "Follow-up", "Next-run check"], ls.map((l) => h("tr", h("td", label[l.kind] || l.kind), h("td", l.text), h("td", l.stepId ? (M().findStep(run.snapshot, l.stepId) || { step: {} }).step.num : ""), h("td", l.owner || ""), h("td", l.status || "open"),
      h("td", l.lastCheck ? `${l.lastCheck.result.replace("_", " ")} (${fmtDate(l.lastCheck.at)})` : l.verifyNext ? "pending" : ""))));
  }

  /* ======================= PROCEDURE HISTORY & INSIGHTS ======================= */
  PR.views.history = {
    async mount(el, procId) {
      const doc = await S().getProcedure(procId);
      const sums = (await S().listRuns(procId)).sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt));
      const title = doc ? doc.draft.title : (sums[0] && sums[0].procTitle) || "Procedure";
      const real = sums.filter((r) => !r.practice);
      const completed = real.filter((r) => r.status === "completed").slice(0, 6);
      const full = (await Promise.all(completed.map((r) => S().getRun(r.id)))).filter(Boolean).reverse();
      const wrap = h("div.page");
      wrap.append(h("div.page-head", h("a.icon-btn", { href: "#/" }, "←"), h("div", h("h1", title), h("div.muted", "Run history & insights")), h("div.spacer"),
        doc ? h("button.btn.btn-primary", { type: "button", onclick: () => PR.runner.startNew(procId) }, "▶ Run") : null, doc ? h("a.btn", { href: `#/edit/${encodeURIComponent(procId)}` }, "✎ Edit") : null));
      wrap.append(h("h2", "Runs"), runsTable(sums));
      if (full.length) {
        const base = full[full.length - 1].snapshot;
        const steps = M().allSteps(base);
        const durOf = (r, id) => { const s = (r.steps || {})[id]; return s && s.status === "done" && s.startedAt && s.finishedAt && s.timing !== "unavailable" ? s.finishedAt - s.startedAt : null; };
        const meds = Object.fromEntries(steps.map(({ step }) => [step.id, median(full.map((r) => durOf(r, step.id)))]));
        const slow = steps.filter(({ step }) => meds[step.id]).sort((a, b) => meds[b.step.id] - meds[a.step.id]).slice(0, 10);
        wrap.append(h("h2", "Where the time goes"), h("div.muted", `Median over the last ${full.length} completed run(s). Use this to target improvements.`),
          tbl(["#", "Step", "Median", ...full.map((r) => fmtDate(r.startedAt))], slow.map(({ step }) => h("tr", h("td", step.num), h("td", step.title), h("td", h("b", fmtDur(meds[step.id], { short: true }))), full.map((r) => { const d = durOf(r, step.id); return h(`td${d && meds[step.id] && d > meds[step.id] * 1.5 ? ".slow" : ""}`, d != null ? fmtDur(d, { short: true }) : "—"); })))));
        wrap.append(h("h2", "Section durations"), tbl(["Section", ...full.map((r) => fmtDate(r.startedAt))], base.sections.map((sec) => h("tr", h("td", sec.title), full.map((r) => {
          const ss = sec.steps.map((s) => (r.steps || {})[s.id]).filter((x) => x && x.startedAt && x.finishedAt);
          return h("td", ss.length ? fmtDur(Math.max(...ss.map((x) => x.finishedAt)) - Math.min(...ss.map((x) => x.startedAt)), { short: true }) : "—");
        })))));
        wrap.append(h("h2", "Timing quality"), tbl(["Run", "Auto", "Entered after", "Unreliable", "Total time"], full.map((r) => { const v = Object.values(r.steps || {}); return h("tr", h("td", r.name), h("td", String(v.filter((s) => s.status === "done" && (s.timing || "auto") === "auto").length)), h("td", String(v.filter((s) => s.timing === "manual").length)), h("td", String(v.filter((s) => s.timing === "unavailable").length)), h("td", r.startedAt && r.completedAt ? fmtDur(r.completedAt - r.startedAt) : "—")); })));
      }
      wrap.append(h("h2", "Lessons learned"), await lessonsBoard({ procId }));
      el.append(wrap);
    },
  };
  function runsTable(sums) {
    if (!sums.length) return none("No runs yet.");
    return tbl(["Date", "Run", "Direction", "Version", "Status", "Outcome", "Steps", "Issues", "Duration", ""], sums.map((r) => h("tr",
      h("td", fmtDate(r.startedAt || r.createdAt)), h("td", r.name || r.procTitle, r.practice ? h("span.chip.c-gray", "practice") : null, r.changeId ? h("div.small.muted", r.changeId) : null), h("td", r.direction ? dirName(r) : ""),
      h("td", r.procVersion === "draft" ? "draft" : `v${r.procVersion}`), h("td", PR.app.statusChip(r.status)), h("td", r.outcome || ""), h("td", `${r.done}/${r.total}`), h("td", r.issues ? `${r.issues}${r.openIssues ? " (" + r.openIssues + " open)" : ""}` : "0"),
      h("td", r.startedAt ? fmtDur((r.completedAt || now()) - r.startedAt, { short: true }) : ""),
      h("td", h("a.btn.btn-sm", { href: ["active", "paused", "setup"].includes(r.status) ? `#/run/${r.id}` : `#/report/${r.id}` }, ["active", "paused", "setup"].includes(r.status) ? "Open" : "Report"),
        !r.practice ? h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Compare with the run before it", onclick: () => PR.compareWithPrevious(r) }, "⇄") : null,
        h("button.icon-btn.xs", { type: "button", title: "Delete run", onclick: async () => { if (await PR.u.confirmBox("Delete run?", `Permanently delete "${r.name}" and its record?`, { ok: "Delete", kind: "danger" })) { await S().deleteRun(r.id); PR.app.route(); } } }, "🗑")))));
  }
  function dirName(r) { return r.directionLabel || ""; }

  /* ======================= ALL RUNS ======================= */
  PR.views.runs = {
    async mount(el) {
      const sums = (await S().listRuns()).sort((a, b) => (b.startedAt || b.createdAt) - (a.startedAt || a.createdAt));
      el.append(h("div.page", h("div.page-head", h("a.icon-btn", { href: "#/" }, "←"), h("div", h("h1", "All runs"), h("div.muted", `${sums.length} run(s)`))), runsTable(sums)));
    },
  };

  /* ======================= LESSONS BOARD ======================= */
  async function lessonsBoard({ procId } = {}) {
    const sums = (await S().listRuns(procId)).filter((r) => !r.practice && ["completed", "aborted"].includes(r.status));
    const full = (await Promise.all(sums.map((r) => S().getRun(r.id)))).filter(Boolean);
    const items = [];
    full.forEach((r) => Object.values(r.lessons || {}).forEach((l) => items.push({ run: r, l })));
    if (!items.length) return none("No lessons yet — they're captured when a run is closed out.");
    const STAT = ["open", "in progress", "done", "verified", "closed"];
    const box = h("div");
    const draw = (onlyOpen) => {
      box.innerHTML = "";
      const shown = items.filter(({ l }) => !onlyOpen || !["verified", "closed"].includes(l.status)).sort((a, b) => (b.run.startedAt || 0) - (a.run.startedAt || 0));
      box.append(h("label.ck", h("input", { type: "checkbox", checked: onlyOpen, onchange: (e) => draw(e.target.checked) }), " Only open follow-ups"),
        tbl(["Run", "Type", "Lesson", "Step", "Owner", "Status", "Next-run check"], shown.map(({ run: r, l }) => h("tr",
          h("td", h("a", { href: `#/report/${r.id}` }, fmtDate(r.startedAt)), h("div.small.muted", r.procTitle)),
          h("td", { wrong: "Went wrong", worked: "Worked", change: "Change" }[l.kind] || l.kind), h("td", l.text),
          h("td", l.stepId ? (M().findStep(M().normalize(r.snapshot), l.stepId) || { step: {} }).step.num || "" : ""),
          h("td", h("input.inp.sm", { value: l.owner || "", list: "peopleList", onchange: (e) => { l.owner = e.target.value; S().patchRun(r.id, [{ op: "merge", path: ["lessons", l.id], value: { owner: l.owner } }]).then(() => toast("Saved", "ok", 800)); } })),
          h("td", h("select.inp.sm", { onchange: (e) => { l.status = e.target.value; S().patchRun(r.id, [{ op: "merge", path: ["lessons", l.id], value: { status: l.status } }]).then(() => toast("Saved", "ok", 800)); } }, STAT.map((s) => h("option", { value: s, selected: (l.status || "open") === s }, s)))),
          h("td", l.lastCheck ? h("b", l.lastCheck.result === "improved" ? "✓ improved" : l.lastCheck.result === "not_improved" ? "✕ not improved" : "not tested") : l.verifyNext ? "waiting for next run" : "")))));
    };
    draw(true);
    return box;
  }
  PR.views.lessons = {
    async mount(el) {
      el.append(h("div.page", h("div.page-head", h("a.icon-btn", { href: "#/" }, "←"), h("div", h("h1", "Lessons learned"), h("div.muted", "Follow-ups from every run. Items flagged for the next run show up on that step with a “did it work?” prompt."))), await lessonsBoard()));
    },
  };
})();
