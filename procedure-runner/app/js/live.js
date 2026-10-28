/* live.js — read-only "follow along" view for teammates, leadership or a war-room screen.
   #/live/<runId> refreshes itself; nobody can change the run from here. */
PR.views.live = (() => {
  const { h, $, now, fmtDur, fmtTime, fmtMin } = PR.u;
  const S = () => PR.store.b;
  const M = () => PR.model;
  let timer, runId, rev;

  async function mount(el, id) {
    runId = id; rev = null;
    el.append(h("div.live-page#live", h("div.loading", "Loading…")));
    await refresh(true);
    timer = setInterval(() => refresh(false), 4000);
  }
  function unmount() { clearInterval(timer); }

  async function refresh(force) {
    try {
      if (!force && PR.store.kind === "server") { const r = await S().runRev(runId); if (r === rev) return; }
      const run = await S().getRun(runId);
      if (!run) { $("#live").innerHTML = ""; $("#live").append(h("div.empty", h("div.empty-title", "Run not found"))); return; }
      rev = run.rev;
      run.snapshot = M().normalize(run.snapshot);
      draw(run);
    } catch (e) { const b = $("#liveConn"); if (b) b.textContent = "Reconnecting…"; }
  }

  function ring(pct) {
    const r = 54, c = 2 * Math.PI * r;
    const svg = `<svg viewBox="0 0 128 128" class="ring"><circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--vivid)" stroke-width="12" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 64 64)" stroke-linecap="butt"/></svg>`;
    return h("div.ring-wrap", { html: svg }, h("div.ring-v", h("b", `${pct}%`), h("span", "complete")));
  }

  function draw(run) {
    const el = $("#live"); if (!el) return;
    const p = run.snapshot; const su = run.setup || {};
    const st = (id) => (run.steps || {})[id] || { status: "pending" };
    const all = M().allSteps(p).filter(({ step }) => M().isApplicable(step, su));
    const done = all.filter(({ step }) => ["done", "skipped", "na"].includes(st(step.id).status)).length;
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;
    const active = all.filter(({ step }) => st(step.id).status === "active");
    const next = all.find(({ step }) => st(step.id).status === "pending");
    const remain = all.filter(({ step }) => ["pending", "active"].includes(st(step.id).status)).reduce((a, { step }) => a + (Number(step.estMin) || 0), 0);
    const live = ["active", "paused"].includes(run.status);
    const issues = Object.values(run.issues || {}).filter((i) => i.status !== "resolved");
    const lastComm = Object.values(run.comms || {}).filter((c) => c.plan).sort((a, b) => b.at - a.at)[0];
    const sites = p.environments.enabled ? M().sites(p) : [];
    const card = (title, ...kids) => h("section.lv-card", h("div.lv-h", title), kids);
    const oldFlow = $(".lv-flow .flow-scroll", el); const fk = oldFlow ? [oldFlow.scrollLeft, oldFlow.scrollTop] : null;
    const showFlow = M().tracks(p).length > 0 || M().allSteps(p).some(({ step }) => M().deps(step).length);
    const isDone = (id) => ["done", "skipped", "na"].includes(st(id).status) || !M().isApplicable((M().findStep(p, id) || {}).step || {}, su);
    el.innerHTML = "";
    el.append(
      h("div.lv-hero",
        h("div.lv-titles",
          h("div.lv-kicker", run.practice ? "Practice run · following live" : "Following live"),
          h("h1.live-title", run.name),
          h("div.lv-meta", M().directionLabel(p, su) ? h("span.dir-pill", "⇄ ", M().directionLabel(p, su)) : null, PR.app.statusChip(run.status), su.changeId ? h("span.chip", su.changeId) : null,
            h("span#liveConn.muted.small", `Updated ${fmtTime(now())}`))),
        h("div.lv-stats",
          h("div.lv-stat", h("div.lv-k", "Elapsed"), h("div.lv-v", run.startedAt ? (live ? h("span", { dataset: { since: String(run.startedAt) } }, fmtDur(now() - run.startedAt)) : fmtDur((run.completedAt || now()) - run.startedAt)) : "—")),
          h("div.lv-stat", h("div.lv-k", "Steps"), h("div.lv-v", `${done}/${all.length}`)),
          h("div.lv-stat", h("div.lv-k", "Est. finish"), h("div.lv-v", live && remain ? fmtTime(now() + remain * 60000, false) : "—")),
          ring(pct)),
        h("div.lv-tools",
          h("button.btn.btn-sm", { type: "button", onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()) }, "⛶ Full screen"),
          h("button.btn.btn-sm", { type: "button", onclick: () => PR.u.copyText(PR.comms.liveURL(run)) }, "⧉ Copy link"))),
      PR.ui.impactPanel(M().impactState(run), { size: "hero" }),
      run.status === "paused" ? h("div.banner.b-warn", h("b", "⏸ Paused. "), run.halt ? run.halt.reason : "") : null,
      (() => { const pend = M().pendingApprovals(run); return pend.length ? h("div.banner.b-info.lv-approvals", h("b", "✍ Waiting on approval: "), pend.map((r) => h("span.ap-chip", r.title, h("span.muted", ` — ${(r.to || []).join(", ") || "approver"} · `, h("span", { dataset: { since: String(r.requestedAt) } }, PR.u.fmtDur(now() - r.requestedAt)))))) : null; })(),
      run.status === "completed" ? h("div.banner.b-ok", h("b", "✓ Complete. "), (run.completion || {}).outcome || "") : null,
      h("div.lv-grid",
        roadblocks(run),
        M().tracks(p).length ? card("Lanes", M().tracks(p).map((t) => {
          const pg = M().trackProgress(run, t.id); const d = t.dept && PR.app.dept(t.dept);
          return h("div.lv-track", { style: { "--c": t.color } }, h("div.lv-site-top", h("b", d ? `${d.icon} ${t.name}` : t.name), h("span.muted.small", t.desc || "")),
            h("div.bar", h("div.bar-fill", { style: { width: pg.pct + "%", background: t.color } })),
            h("div.small", pg.signoff ? h("span.c-green-t", `✓ Signed off by ${pg.signoff.by} at ${fmtTime(pg.signoff.at, false)}`) : `${pg.done}/${pg.total} steps`,
              !pg.signoff && pg.active.length ? ` · now: ${pg.active.map((x) => x.num + " " + x.title).join(", ")}` : !pg.signoff && pg.next ? ` · next: ${pg.next.num} ${pg.next.title}` : ""));
        })) : null,
        card("Happening now", active.length ? active.map(({ step, section }) => {
          const t = M().resolveTarget(p, step, section, su); const s = st(step.id);
          return h("div.lv-now", { style: { "--c": t.color || "var(--vivid)" } },
            h("div.lv-now-top", h("span.lv-num", step.num), PR.ui.envBadge(t, { size: "sm" }), h("div.spacer"), h("b.timer.live", { dataset: { since: String(s.startedAt) } }, fmtDur(now() - s.startedAt))),
            h("div.lv-now-t", step.title), h("div.muted.small", `${section.title}${s.startedBy ? " · " + s.startedBy : ""}`));
        }) : h("div.muted", live ? "Between steps" : run.status === "setup" ? "Getting ready" : "Nothing in progress"),
        next ? h("div.lv-next", h("span.un-k", "Up next "), h("b", `${next.step.num} ${next.step.title}`)) : null),
        sites.length ? card("Datacenters", sites.map((s) => {
          const mine = all.filter(({ step, section }) => { const t = M().resolveTarget(p, step, section, su); return t.site && t.site.id === s.id; });
          const d = mine.filter(({ step }) => ["done", "skipped", "na"].includes(st(step.id).status)).length;
          const t = M().resolveTarget(p, { target: `site:${s.id}` }, { phase: "pre" }, su);
          return h("div.lv-site", { style: { "--c": s.color } }, h("div.lv-site-top", h("b", s.name), h("span.muted.small", [s.partition, t.roleLabel].filter(Boolean).join(" · "))),
            h("div.bar", h("div.bar-fill", { style: { width: (mine.length ? (d / mine.length) * 100 : 0) + "%", background: s.color } })), h("div.small.muted", `${d}/${mine.length} steps`));
        })) : null,
        card("Phases", p.sections.map((sec) => {
          const ss = sec.steps.filter((x) => M().isApplicable(x, su)); const d = ss.filter((x) => ["done", "skipped", "na"].includes(st(x.id).status)).length;
          const cur = ss.some((x) => st(x.id).status === "active");
          return h(`div.lv-phase${d === ss.length && ss.length ? ".done" : ""}${cur ? ".cur" : ""}`, h("span.lv-ph-ic", d === ss.length && ss.length ? "✓" : cur ? "◉" : "○"), h("span.lv-ph-t", sec.title), h("span.muted.small", `${d}/${ss.length}`));
        })),
        lastComm ? card("Latest update", h("div.lv-update", h("b", lastComm.request), h("div.muted.small", `${lastComm.who} · ${fmtTime(lastComm.at, false)} · ${lastComm.by}`))) : null,
        card(`Open issues (${issues.length})`, issues.length ? issues.map((i) => h("div.lv-issue", "⚠ ", i.title, h("span.muted.small", ` · ${fmtTime(i.at, false)}`))) : h("div.muted", "None")),
        card("Recent activity", h("div.log", (run.events || []).slice(-12).reverse().map((e) => h("div.log-row", h("span.log-t", fmtTime(e.at, false)), h("span.log-w", e.by || ""), h("span.log-x", e.text || e.type)))))),
      showFlow ? h("section.lv-card.lv-flow", h("div.lv-h", "Workflow"), PR.flow.render({ proc: p, zoomKey: "liveFlowZoom",
        keep: (step) => M().isApplicable(step, su) && !(su.excluded || []).includes(step.id),
        status: (step) => (M().isApplicable(step, su) ? st(step.id).status || "pending" : "na"),
        blocked: (step) => M().deps(step).some((id) => !isDone(id)),
        laneInfo: (l) => { if (l.shared) return { icon: "👥", sub: "shared — everyone" }; const pg = M().trackProgress(run, l.id); const d = l.dept && PR.app.dept(l.dept); return { icon: d ? d.icon : "", sub: `${pg.done}/${pg.total} done${pg.signoff ? " · signed off" : ""}` }; } })) : null);
    const nf = $(".lv-flow .flow-scroll", el); if (nf && fk) { nf.scrollLeft = fk[0]; nf.scrollTop = fk[1]; }
  }
  function roadblocks(run) {
    const im = M().impactState(run);
    const { open, resolved } = im.roadblocks;
    if (!open.length && !resolved.length) return null;
    const p = run.snapshot;
    const stepOf = (i) => { const f = i.stepId && M().findStep(p, i.stepId); return f ? `Step ${f.step.num} ${f.step.title}` : "General"; };
    return h("section.lv-card.rb-card", h("div.lv-h", `🚧 Roadblocks (${open.length} open)`),
      open.map((i) => h("div.lv-rb", h("div.lv-rb-top", h("b", i.title), h("span.timer.live", { dataset: { since: String(i.at) } }, fmtDur(now() - i.at))),
        h("div.small.muted", `${stepOf(i)} · since ${fmtTime(i.at, false)} · ${i.by || ""}`),
        i.troubleshooting ? h("div.small", "Trying: ", i.troubleshooting) : null, i.assistance ? h("div.small", "Help: ", i.assistance) : null)),
      resolved.slice(-3).map((i) => h("div.lv-rb.res", h("div.lv-rb-top", h("b", "✓ ", i.title), h("span.small.muted", `held up ${fmtDur((i.resolvedAt || now()) - i.at, { short: true })}`)), i.resolution ? h("div.small", i.resolution) : null)));
  }
  return { mount, unmount };
})();
