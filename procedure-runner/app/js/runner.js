/* runner.js — executing a procedure.
   Setup wizard (exercise info, failover direction, mapping verification, readiness) → workspace
   (one-click start/complete, auto-advance with next-step preview, parallel timers, lanes per datacenter,
   issues with pasted screenshots, comms log, improvement notes) → completion & lessons learned. */
PR.runner = (() => {
  const { h, $, $$, esc, toast, modal, confirmBox, promptBox, menu, uid, clone, now, fmtDur, fmtTime, fmtDateTime, fmtDate, fmtMin, toLocalInput, fromLocalInput, debounce, median } = PR.u;
  const S = () => PR.store.b;
  const M = () => PR.model;
  const me = () => PR.app.me;

  let chairView = ""; // "" = all chairs (coordinator), else a track id
  let run, proc, host, focusId, filter, siteFilter, mode, pollT, deferRender, forceArm, histStats, priorLessons, rightTab, editingSetup, commsCfg, lastDue, dueT;

  /* ======================= start a new run ======================= */
  async function startNew(procId, { practice = false } = {}) {
    const doc = await S().getProcedure(procId);
    if (!doc) return toast("Procedure not found", "err");
    let data, version;
    if (!practice && doc.publishedVersion) {
      data = await S().getVersion(procId, doc.publishedVersion);
      version = doc.publishedVersion;
      if (!data) { data = doc.draft; version = "draft"; }
    } else {
      if (!practice) {
        const ok = await confirmBox("Not published yet", "This procedure has no published version. Start a practice run of the current draft? Practice runs are kept out of history and timing statistics.", { ok: "Start practice run" });
        if (!ok) return;
      }
      practice = true; data = doc.draft; version = "draft";
    }
    data = M().normalize(clone(data));
    const ro = M().runOptions(data);
    const quick = ro.quickStart ? await quickStartModal(data) : null;
    if (ro.quickStart && !quick) return;
    const env = data.environments;
    const run = {
      id: uid("run"), procId, procVersion: version, procTitle: data.title, practice,
      name: `${data.title} — ${fmtDate(now())}`, snapshot: data, status: "setup", createdAt: now(), createdBy: me(),
      setup: {
        exerciseDate: fmtDate(now()), changeId: "", participants: [{ id: uid("pp"), name: me(), chair: data.setup.chairs[0] || "" }],
        primarySiteId: "", // the operator must choose the direction explicitly — never pre-filled
        verification: null, readiness: {},
      },
      steps: {}, issues: {}, notes: {}, comms: {}, events: [{ at: now(), by: me(), type: "created", text: `Run created from ${version === "draft" ? "draft" : "v" + version}` }],
      completion: {}, lessons: {}, carried: {}, progress: { done: 0, total: M().countRunnable({ snapshot: data, setup: {} }) },
    };
    if (quick) { // run sheet: no setup wizard — straight into the steps
      const v = ro.variants.find((x) => x.id === quick.variant);
      const flagsYes = ro.flags.filter((x) => quick.flags[x.id]).map((x) => x.label);
      const extra = data.sections.filter((x) => quick.include[x.id]).map((x) => x.title);
      Object.assign(run.setup, { quick: true, variant: quick.variant, variantName: v ? v.name : "", flags: quick.flags, include: quick.include });
      run.setup.excluded = M().excludedSteps(data, run.setup);
      run.status = "active"; run.startedAt = now();
      run.name = `${v ? v.name : data.title} — ${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`;
      run.progress.total = M().countRunnable(run);
      run.events.push({ at: now(), by: me(), type: "begin", text: `Started ${v ? v.name : "run"}${flagsYes.length ? " · " + flagsYes.join(", ") : ""}${extra.length ? " · also: " + extra.join(", ") : ""}` });
    }
    await S().createRun(run);
    PR.app.go(`#/run/${run.id}`);
  }

  /* Quick start: "Which run sheet?" (today's is pre-selected), a few yes/no questions, and optional sections due this month. */
  async function quickStartModal(p) {
    const o = M().runOptions(p); const today = new Date();
    const { holiday, due } = M().variantsDue(p, today);
    const inV = (arr, v) => !Array.isArray(arr) || !arr.length || !v || arr.includes(v);
    const q = { variant: (due[0] || o.variants[0] || {}).id || "", flags: {}, include: {} };
    o.flags.forEach((x) => (q.flags[x.id] = !!x.default));
    const inVariant = () => M().allSteps(p).filter(({ step, section }) => inV(section.variants, q.variant) && inV(step.variants, q.variant));
    const optSecs = () => p.sections.filter((x) => x.optional && inV(x.variants, q.variant) && x.steps.some((y) => inV(y.variants, q.variant)));
    const pickIncludes = () => { q.include = {}; optSecs().forEach((x) => (q.include[x.id] = M().sectionDue(x, today))); };
    pickIncludes();
    const body = h("div.qs");
    const draw = () => {
      body.innerHTML = "";
      const usedFlags = new Set(inVariant().flatMap(({ step, section }) => [step.flag, section.flag]).filter(Boolean));
      const flags = o.flags.filter((x) => usedFlags.has(x.id));
      const n = M().allSteps(p).length - M().excludedSteps(p, q).length;
      body.append(
        o.variants.length ? [h("div.qs-q", "Which run sheet?"), h("div.qs-cards", o.variants.map((v, i) => h(`button.qs-card${q.variant === v.id ? ".on" : ""}`, { type: "button", onclick: () => { q.variant = v.id; pickIncludes(); draw(); } },
          h("span.qs-top", h("span.qs-ic", v.icon || "📋"), h("kbd", String(i + 1)), due.includes(v) ? h("span.chip.c-green", due[0] === v ? "Today" : "Also due today") : null),
          h("b.qs-name", v.name), v.desc ? h("span.small.muted", v.desc) : null)))] : null,
        holiday ? h("div.help", "📅 Today is on the holiday list.") : null,
        flags.length ? [h("div.qs-q", "Quick questions"), flags.map((x) => h("div.qs-flag", h("div", h("b", x.label), x.help ? h("div.small.muted", x.help) : null),
          h("div.seg", [[true, "Yes"], [false, "No"]].map(([val, l]) => h(`button.seg-btn${!!q.flags[x.id] === val ? ".on" : ""}`, { type: "button", onclick: () => { q.flags[x.id] = val; draw(); } }, l)))))] : null,
        optSecs().length ? [h("div.qs-q", "Also include"), optSecs().map((x) => h("label.ck.qs-opt", h("input", { type: "checkbox", checked: !!q.include[x.id], onchange: (e) => { q.include[x.id] = e.target.checked; draw(); } }),
          " ", h("b", x.title), M().sectionDue(x, today) && (x.optional.months || []).length ? h("span.chip.c-green", "due this month") : null, x.optional.note ? h("span.small.muted", ` — ${x.optional.note}`) : null))] : null,
        h("div.qs-sum", `${n} step${n === 1 ? "" : "s"} · `, h("kbd", "Enter"), " to start"));
      requestAnimationFrame(() => { const b = document.querySelector(".modal-foot .btn-primary"); b && b.focus(); });
    };
    const keys = (e) => { const i = Number(e.key) - 1; if (o.variants[i] && !e.ctrlKey && !e.altKey && !PR.u.isTyping(e)) { e.preventDefault(); q.variant = o.variants[i].id; pickIncludes(); draw(); } };
    document.addEventListener("keydown", keys);
    draw();
    const v = await modal({ title: p.title, subtitle: today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), size: "md", body, enter: true, className: "qs-modal",
      onClose: () => document.removeEventListener("keydown", keys),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "▶ Start", kind: "primary", value: "go" }] });
    return v === "go" ? q : null;
  }

  /* ======================= mount ======================= */
  async function mount(el, runId) {
    host = el;
    run = await S().getRun(runId);
    if (!run) { el.appendChild(h("div.empty", h("div.empty-title", "Run not found"), h("a.btn", { href: "#/" }, "Back"))); return; }
    proc = M().normalize(run.snapshot);
    run.snapshot = proc;
    const ob = outbox(runId);
    if (ob.queue.length) { PR.store.applyOps(run, ob.queue); flush(ob); } // unsent changes from an earlier visit / closed tab
    ob.lastRev = Math.max(ob.lastRev, run.rev || 0);
    editingSetup = false; deferRender = false; forceArm = {}; histStats = {}; priorLessons = [];
    filter = PR.app.LS.get("runFilter", "all"); siteFilter = "all"; mode = PR.app.LS.get("runMode", "list"); rightTab = "active";
    focusId = (run.ui && run.ui[me()]) || firstOpen();
    commsCfg = await PR.comms.load().catch(() => null); lastDue = null;
    el.appendChild(h("div.run#run"));
    dueT = setInterval(checkDue, 30000); // interval-based updates become due with time
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pr:countdown-done", onCountdownDone);
    chairView = hasTracks() ? PR.app.LS.get(`chair_${run.id}`, "") || "" : "";
    if (hasTracks() && chairView && !myStepsInOrder().some((x) => x.step.id === focusId)) focusId = firstOpen();
    render();
    if (hasTracks() && PR.app.LS.get(`chair_${run.id}`, null) === null) {
      if (amApprover() && !(run.setup.participants || []).some((p) => M().sameName(p.name, me()) && p.track)) { PR.app.LS.set(`chair_${run.id}`, ""); chairView = ""; } // approvers oversee every chair
      else setTimeout(() => chooseChair(), 50);
    }
    if (PR.store.kind === "server") pollT = setInterval(poll, 2500);
    loadHistory();
    if (run.status === "active" && "Notification" in window && Notification.permission === "default") try { Notification.requestPermission(); } catch { /* ignore */ }
  }
  async function unmount() {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("pr:countdown-done", onCountdownDone);
    clearInterval(pollT); clearInterval(dueT);
    // The outbox keeps retrying in the background; nothing to wait for here.
  }

  async function loadHistory() {
    if (run.practice) return;
    try {
      const runs = (await S().listRuns(run.procId)).filter((r) => r.id !== run.id && !r.practice && r.status === "completed")
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 6);
      const full = (await Promise.all(runs.map((r) => S().getRun(r.id)))).filter(Boolean);
      const durs = {};
      full.forEach((r) => Object.entries(r.steps || {}).forEach(([sid, s]) => {
        if (s.status === "done" && s.startedAt && s.finishedAt && s.timing !== "unavailable") (durs[sid] = durs[sid] || []).push(s.finishedAt - s.startedAt);
      }));
      histStats = Object.fromEntries(Object.entries(durs).map(([k, v]) => [k, { median: median(v), n: v.length }]));
      priorLessons = [];
      full.forEach((r) => Object.values(r.lessons || {}).forEach((l) => {
        if (l.verifyNext && l.status !== "closed" && l.status !== "verified") priorLessons.push({ runId: r.id, runName: r.name, runDate: r.startedAt || r.createdAt, lesson: l });
      }));
      render();
    } catch (e) { console.warn("history", e); }
  }

  /* ======================= ops / sync ======================= */
  function progressOf() {
    const all = M().allSteps(proc).filter(({ step }) => M().isApplicable(step, run.setup));
    const done = all.filter(({ step }) => ["done", "skipped", "na"].includes(st(step.id).status)).length;
    return { done, total: all.length };
  }
  function commit(ops, { render: doRender = true, event } = {}) {
    if (event) ops.push({ op: "push", path: ["events"], value: { at: now(), by: me(), ...event } });
    PR.store.applyOps(run, ops);
    const pg = progressOf();
    if (!run.progress || pg.done !== run.progress.done || pg.total !== run.progress.total) { const o = { op: "set", path: ["progress"], value: pg }; PR.store.applyOps(run, [o]); ops.push(o); }
    const ob = outbox(run.id);
    ob.queue.push(...ops); persistQ(ob);
    flush(ob);
    if (doRender) render();
  }

  /* Outbox per run id: survives navigating away, is backed up to localStorage until the server confirms,
     and retries while offline. Replies for a run that is no longer on screen never touch the view. */
  const outboxes = {};
  function outbox(id) {
    if (!outboxes[id]) {
      let saved = [];
      try { saved = JSON.parse(localStorage.getItem("pr_q_" + id) || "[]"); } catch { /* ignore */ }
      outboxes[id] = { id, queue: Array.isArray(saved) ? saved : [], sending: null, lastRev: 0 };
    }
    return outboxes[id];
  }
  function persistQ(ob) { try { if (ob.queue.length) localStorage.setItem("pr_q_" + ob.id, JSON.stringify(ob.queue)); else localStorage.removeItem("pr_q_" + ob.id); } catch { /* storage full/private */ } }
  const isCurrent = (ob) => run && run.id === ob.id && $("#run");
  function flush(ob = outbox(run.id)) {
    if (ob.sending) return ob.sending;
    if (!ob.queue.length) return Promise.resolve();
    ob.sending = (async () => {
      while (ob.queue.length) {
        const batch = ob.queue.slice();
        if (isCurrent(ob)) setSync("saving");
        try {
          const r = await S().patchRun(ob.id, batch);
          ob.queue.splice(0, batch.length); persistQ(ob);
          ob.lastRev = Math.max(ob.lastRev, r.rev || 0);
          if (isCurrent(ob)) { if (!ob.queue.length && PR.store.kind === "server") adopt(r); else run.rev = r.rev; setSync("ok"); }
        } catch (e) {
          console.warn("sync failed", e);
          if (e.status === 404 || e.status === 400) { // not retryable: drop the batch rather than loop forever
            ob.queue.splice(0, batch.length); persistQ(ob);
            if (isCurrent(ob)) toast(`A change could not be saved: ${e.message}`, "err", 5000);
            continue;
          }
          if (isCurrent(ob)) setSync("err");
          await new Promise((res) => setTimeout(res, 3000));
        }
      }
      ob.sending = null;
    })();
    return ob.sending;
  }
  /* Wait until everything for the current run is saved (gives up after `ms` — the outbox keeps retrying). */
  async function drain(ms = 8000) {
    const ob = outbox(run.id);
    const until = now() + ms;
    while ((ob.queue.length || ob.sending) && now() < until) await Promise.race([flush(ob), new Promise((r) => setTimeout(r, 500))]);
  }
  function adopt(remote) {
    const ob = outbox(remote.id);
    if ((remote.rev || 0) < ob.lastRev) return; // older than what we already have
    ob.lastRev = remote.rev || ob.lastRev;
    const changedByOthers = JSON.stringify(remote.steps) !== JSON.stringify(run.steps) || JSON.stringify(remote.issues) !== JSON.stringify(run.issues) || remote.status !== run.status || JSON.stringify(remote.setup) !== JSON.stringify(run.setup) || (remote.events || []).length !== (run.events || []).length;
    remote.snapshot = proc;
    run = remote;
    if (changedByOthers) safeRender();
  }
  async function poll() {
    if (!run) return;
    const ob = outbox(run.id);
    if (ob.sending || ob.queue.length || document.hidden) return;
    try {
      const id = run.id;
      const rev = await S().runRev(id);
      if (rev !== run.rev) { const r = await S().getRun(id); if (r && run.id === id && !ob.queue.length && !ob.sending) adopt(r); }
      setSync("ok");
    } catch { setSync("err"); }
  }
  function safeRender() {
    const a = document.activeElement;
    if (a && $("#run") && $("#run").contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { deferRender = true; return; }
    render();
  }
  function onFocusOut() { if (deferRender) setTimeout(() => { if (deferRender) { const a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { deferRender = false; render(); } } }, 50); }
  function setSync(s) { const c = $("#runSync"); if (!c) return; c.className = "sync-dot " + s; c.title = { ok: "All changes saved", saving: "Saving…", err: "Offline — changes are queued and will retry" }[s]; }

  /* ======================= helpers ======================= */
  const st = (id) => (run.steps && run.steps[id]) || { status: "pending" };
  const stepsInOrder = () => M().allSteps(proc);
  const applicable = (step) => M().isApplicable(step, run.setup);
  const statusOf = (step) => (!applicable(step) ? "na" : st(step.id).status || "pending");
  const targetOf = (step, section) => M().resolveTarget(proc, step, section, run.setup);
  const ctx = () => M().varContext(run);
  const hasTracks = () => M().tracks(proc).length > 0;
  /* In a chair's view: their own steps plus shared ones. */
  function inMyChair(step, section) {
    if (run.setup.excluded && run.setup.excluded.includes(step.id)) return false; // not on the run sheet chosen at start
    if (!chairView || !hasTracks()) return true;
    const t = M().trackOf(step, section);
    return !t || t === "shared" || t === chairView || !M().trackById(proc, t);
  }
  function myStepsInOrder() { return stepsInOrder().filter(({ step, section }) => inMyChair(step, section)); }
  function firstOpen() { const all = myStepsInOrder(); const f = all.find(({ step }) => ["pending", "active"].includes(statusOf(step))); return f ? f.step.id : (all[0] || stepsInOrder()[0] || { step: {} }).step.id; }
  function nextOpenAfter(id) {
    const all = myStepsInOrder(); const i = all.findIndex((x) => x.step.id === id);
    for (let k = i + 1; k < all.length; k++) if (statusOf(all[k].step) === "pending") return all[k].step.id;
    const any = all.find((x) => statusOf(x.step) === "pending"); return any ? any.step.id : null;
  }
  function people() { return (run.setup.participants || []).map((p) => p.name).filter(Boolean); }
  function chairOf(name) { const p = (run.setup.participants || []).find((x) => x.name === name); return p ? p.chair : ""; }
  function duration(s) { return s.startedAt && s.finishedAt ? s.finishedAt - s.startedAt : null; }
  function missingFor(step) {
    const s = st(step.id); const vals = s.values || {};
    return (step.blocks || []).filter((b) => { const d = PR.blocks.def(b.type); return d && d.needs && d.needs(b) && !d.complete(b, vals[b.id]); });
  }
  function priorFor(stepId) { return priorLessons.filter((p) => p.lesson.stepId === stepId); }

  /* ======================= step actions ======================= */
  async function startStep(id, opts = {}) {
    const { quiet } = opts;
    const f = M().findStep(proc, id); if (!f) return;
    if (run.status === "paused") { toast("Run is halted — resume it first", "warn"); return; }
    const w = waitingOn(f.step);
    if (w) {
      const t = M().trackById(proc, M().trackOf(w.step, w.section));
      if (!(await confirmBox("Waiting on a handoff", `Step ${f.step.num} waits for ${t ? t.name + " · " : ""}step ${w.step.num} ${w.step.title}, which isn't done yet. Start anyway? (Recorded.)`, { ok: "Start anyway", kind: "danger" }))) return;
      commit([], { render: false, event: { type: "override", stepId: id, text: `Started ${f.step.num} before handoff from step ${w.step.num}` } });
    }
    if (f.step.hold) {
      const blockers = stepsInOrder().slice(0, stepsInOrder().findIndex((x) => x.step.id === id)).filter(({ step }) => step.required && applicable(step) && !["done", "skipped", "na"].includes(statusOf(step)));
      if (blockers.length && !(await confirmBox("Hold point", h("div", `Step ${f.step.num} is a hold point. ${blockers.length} earlier required step(s) aren't finished: `, h("b", blockers.slice(0, 6).map((b) => b.step.num).join(", ")), blockers.length > 6 ? "…" : "", ". Start anyway? (This override is recorded.)"), { ok: "Override & start", kind: "danger" }))) return;
      if (blockers.length) commit([], { render: false, event: { type: "override", stepId: id, text: `Hold point overridden with ${blockers.length} open step(s)` } });
    }
    const impBefore = M().impactState(run);
    const t0 = now();
    commit([{ op: "merge", path: ["steps", id], ifStatus: ["pending"], value: { status: "active", startedAt: t0, startedBy: me(), timing: "auto", finishedAt: null } }], { render: false, event: { type: "start", stepId: id, text: `Started ${f.step.num} ${f.step.title}` } });
    // Countdowns set to start with the step begin now (only if this click actually started it)
    const vals = st(id).values || {};
    const autoT = st(id).startedAt === t0 ? (f.step.blocks || []).filter((b) => b.type === "timer" && b.autoStart !== false && !vals[b.id]) : [];
    const apOps = st(id).startedAt === t0 ? autoRequestOps(f.step) : [];
    if (apOps.length) commit(apOps, { render: false, event: { type: "approval-request", stepId: id, text: `Approval requested — ${apOps.map((o) => o.value.title).join("; ")} → ${whoLabel(apOps[0].value.to)}` } });
    if (autoT.length) commit(autoT.map((b) => ({ op: "set", path: ["steps", id, "values", b.id], value: { startedAt: t0, by: me(), auto: true } })), { render: false, event: { type: "timer", stepId: id, text: `Countdown started: ${autoT.map((b) => `${b.label} (${b.minutes} min)`).join(", ")}` } });
    announceImpact(impBefore);
    if (!quiet) { focusId = id; saveUi(); }
    render();
    if (!quiet) { scrollToFocus(); if (opts.guide) setTimeout(() => guideNext(id, { fromStart: true }), 30); }
  }

  /* Open approvals on a step. Enforced procedures: hard stop. Otherwise the operator may go ahead (recorded). */
  async function approvalStepGate(step) {
    const enf = acfg().enforced;
    const adhoc = reqList().filter((r) => r.stepId === step.id && r.kind === "adhoc" && ["pending", "rejected"].includes(r.status));
    const vals = st(step.id).values || {};
    const blocks = enf ? (step.blocks || []).filter((b) => M().APPROVAL_TYPES.includes(b.type) && !PR.blocks.def(b.type).complete(b, vals[b.id])) : [];
    if (!adhoc.length && !blocks.length) return true;
    if (enf) {
      $$(`[data-fc="${step.id}"] .ap-panel`).forEach((n) => { n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash"); });
      toast(`Step ${step.num} needs approval from ${whoLabel(approverNames())}. This procedure doesn't allow approvals to be bypassed.`, "err", 5000);
      return false;
    }
    if (!(await confirmBox("Approval not given", `Step ${step.num} is waiting on approval (${adhoc.map((r) => r.title).join("; ")}). Complete it without approval? This is recorded.`, { ok: "Complete without approval", kind: "danger" }))) return false;
    commit(adhoc.map((r) => ({ op: "merge", path: ["approvals", r.id], value: { status: "cancelled", cancelledBy: me(), cancelledAt: now(), bypassed: true } })), { render: false, event: { type: "override", stepId: step.id, text: `Step ${step.num} completed without approval (${adhoc.map((r) => r.title).join("; ")})` } });
    return true;
  }

  /* Timers that are still running (or required and never started) when a step is being finished.
     Asks before cutting them short; a "must finish" timer needs a reason. Returns false to keep waiting. */
  async function timerGate(step, only) {
    const T = PR.blocks.def("timer");
    const vals = st(step.id).values || {};
    const list = (step.blocks || []).filter((b) => b.type === "timer" && (!only || b.id === only.id))
      .map((b) => ({ b, v: vals[b.id], state: T.timerState(b, vals[b.id]) }))
      .filter((x) => x.state === "running" || (x.state === "idle" && x.b.required));
    if (!list.length) return true;
    const needReason = list.some((x) => x.b.required);
    let why;
    const ok = await modal({
      title: list.every((x) => x.state === "idle") ? "Required wait not started" : list.length > 1 ? "Timers still running" : "Timer still running", size: "sm", enter: true,
      body: h("div",
        list.map((x) => h("div.tg-timer", "⏳ ", h("b", x.b.label), x.state === "running" ? h("span", " — ", h("b", { dataset: { countdown: String(x.v.startedAt + x.b.minutes * 60000) } }, fmtDur(T.timerLeft(x.b, x.v))), " left") : " — never started", x.b.required ? h("span.chip.c-amber-o", "must finish") : null)),
        h("div.field", h("label.lbl", needReason ? "Why finish early? (required — recorded in the run report)" : "Reason (optional — recorded in the run report)"),
          why = h("input.inp", { autofocus: true, placeholder: "e.g. Replication confirmed stopped on the console" })),
        h("div.help", "Enter to confirm · Esc to keep waiting")),
      actions: [{ spacer: true }, { label: "Keep waiting", value: false },
        { label: only ? "Finish timer now" : "Finish early & complete", kind: "primary", value: true, onClick: () => { if (needReason && !why.value.trim()) { why.classList.add("err"); why.focus(); toast("This wait is marked “must finish” — give a reason", "warn"); return false; } } }],
    });
    if (ok !== true) return false;
    const reason = why.value.trim(); const t = now();
    commit(list.map((x) => ({ op: "set", path: ["steps", step.id, "values", x.b.id], value: x.state === "running"
      ? { ...x.v, endedEarly: true, endedAt: t, endedBy: me(), reason, leftMs: T.timerLeft(x.b, x.v) }
      : { skipped: true, endedAt: t, endedBy: me(), reason } })), { render: !!only, event: { type: "timer-early", stepId: step.id,
      text: `Step ${step.num}: ${list.map((x) => x.state === "running" ? `“${x.b.label}” ended early with ${fmtDur(T.timerLeft(x.b, x.v), { short: true })} left` : `“${x.b.label}” skipped`).join("; ")}${reason ? " — " + reason : ""}` } });
    return true;
  }
  async function completeStep(id) {
    const f = M().findStep(proc, id); if (!f) return;
    if (run.status === "paused") { toast("Run is halted — resume it first", "warn"); return; }
    if (!(await timerGate(f.step))) return;
    if (!(await approvalStepGate(f.step))) return;
    const s = st(id);
    const missing = missingFor(f.step);
    let incomplete = null;
    if (missing.length) {
      if (!forceArm[id] || now() - forceArm[id] > 8000) {
        forceArm[id] = now();
        $$(`[data-fc="${id}"] [data-bid]`).forEach((n) => n.classList.toggle("missing", missing.some((b) => b.id === n.dataset.bid)));
        const firstMissing = $(`[data-fc="${id}"] .missing`); firstMissing && firstMissing.scrollIntoView({ block: "center", behavior: "smooth" });
        toast(`${missing.length} item${missing.length > 1 ? "s" : ""} still needed: ${missing.map((b) => PR.blocks.def(b.type).label).join(", ")}. Click again within 8s to finish anyway (recorded as incomplete).`, "warn", 4500);
        const btn = $(`[data-fc="${id}"] .act-primary`); if (btn) { btn.textContent = "Complete anyway"; btn.classList.add("btn-warn"); }
        return;
      }
      incomplete = missing.map((b) => PR.blocks.def(b.type).label);
    }
    delete forceArm[id];
    const started = !!s.startedAt;
    const val = { status: "done", finishedAt: now(), finishedBy: me(), timing: started ? (s.timing || "auto") : "unavailable", incomplete };
    if (!started) val.startedAt = null;
    const impBefore = M().impactState(run);
    const next = nextOpenAfter(id);
    commit([{ op: "merge", path: ["steps", id], ifStatus: ["pending", "active"], value: val }], { render: false, event: { type: "complete", stepId: id, text: `Completed ${f.step.num} ${f.step.title}${started ? " in " + fmtDur(val.finishedAt - s.startedAt, { short: true }) : " (no start time — timing unreliable)"}${incomplete ? " — incomplete: " + incomplete.join(", ") : ""}` } });
    announceImpact(impBefore);
    if (!started) toast(`Step ${f.step.num} recorded. Timing marked unreliable — add the start time if you know it.`, "warn", 3500);
    if (next && focusId === id) focusId = next;
    saveUi();
    render();
    scrollToFocus();
    if (!next && progressOf().done === progressOf().total) setTimeout(() => (useQuickFinish() ? quickFinish() : toast("All steps finished — click 🏁 Finish to close out the run", "ok", 5000)), 300);
  }
  async function skipStep(id, kind = "skipped") {
    const f = M().findStep(proc, id);
    if (acfg().enforced && M().needsApproval(f.step) && applicable(f.step)) return toast(`Step ${f.step.num} has an approval or Go / No-Go and can't be skipped in this procedure`, "err", 4500);
    const reason = kind === "skipped" && f.step.required === false ? "Not needed" // optional steps: one click, no questions
      : await promptBox(kind === "na" ? `Mark step ${f.step.num} not applicable` : `Skip step ${f.step.num}`, { label: "Reason (recorded in the run report)", ok: kind === "na" ? "Mark N/A" : "Skip", required: true });
    if (reason == null) return;
    const next = nextOpenAfter(id);
    commit([{ op: "merge", path: ["steps", id], value: { status: kind, skipReason: reason, finishedAt: now(), finishedBy: me() } }], { render: false, event: { type: kind, stepId: id, text: `${kind === "na" ? "N/A" : "Skipped"} ${f.step.num}: ${reason}` } });
    if (next && focusId === id) focusId = next;
    render(); scrollToFocus();
  }
  function reopenStep(id) {
    const s = st(id); const f = M().findStep(proc, id);
    commit([{ op: "merge", path: ["steps", id], value: { status: s.startedAt ? "active" : "pending", finishedAt: null, finishedBy: null, incomplete: null, skipReason: null } }], { event: { type: "reopen", stepId: id, text: `Reopened ${f.step.num}` } });
    setFocus(id);
  }
  async function editTimes(id) {
    const s = st(id); const f = M().findStep(proc, id);
    let a, b, who;
    const v = await modal({
      title: `Times for step ${f.step.num}`, size: "sm", subtitle: "Corrected times are marked “entered afterward” in the report.",
      body: h("div",
        h("div.field", h("label.lbl", "Started"), a = h("input.inp", { type: "datetime-local", step: 1, value: toLocalInput(s.startedAt) })),
        h("div.field", h("label.lbl", "Finished"), b = h("input.inp", { type: "datetime-local", step: 1, value: toLocalInput(s.finishedAt) })),
        h("div.field", h("label.lbl", "Executed by"), who = h("input.inp", { list: "peopleList", value: s.finishedBy || s.startedBy || "" })),
        s.startedAt == null && s.finishedAt ? h("div.quick-start", "Quick: started ", [2, 5, 10, 15, 30].map((m) => h("button.mini-btn", { type: "button", onclick: () => { a.value = toLocalInput(s.finishedAt - m * 60000); } }, `${m}m`)), " before finish") : null),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Save", kind: "primary", value: "save" }],
    });
    if (v !== "save") return;
    const sa = fromLocalInput(a.value), fa = fromLocalInput(b.value);
    if (sa && fa && fa < sa) return toast("Finish is before start", "err");
    commit([{ op: "merge", path: ["steps", id], value: { startedAt: sa, finishedAt: fa, timing: sa && fa ? "manual" : (fa ? "unavailable" : s.timing), startedBy: s.startedBy || who.value, finishedBy: who.value || s.finishedBy, status: fa ? (s.status === "pending" ? "done" : s.status) : sa ? "active" : s.status } }],
      { event: { type: "times", stepId: id, text: `Times edited for ${f.step.num}: ${fmtTime(s.startedAt)}–${fmtTime(s.finishedAt)} → ${fmtTime(sa)}–${fmtTime(fa)}` } });
  }
  function primaryAction(id) {
    const s = statusOf(M().findStep(proc, id).step);
    if (s === "pending") startStep(id);
    else if (s === "active") completeStep(id);
  }

  /* ---------- keyboard flow inside a step ----------
     Enter starts the step and jumps to the first thing that still needs doing (checklist item, value, check, sign-off…).
     Enter in a field saves it and moves on; when nothing is left, Enter completes the step and focus moves to the next step. */
  let passed = { id: null, keys: new Set() }; // fields the operator stepped past with Enter (left empty on purpose)
  const ctlKey = (el) => { const blk = el.closest(".fc-blk"); return blk ? blk.dataset.bid + ":" + [...blk.querySelectorAll("input,select,textarea,button,.drop-zone")].indexOf(el) : ""; };
  function actionables(id) {
    if (passed.id !== id) passed = { id, keys: new Set() };
    const f = M().findStep(proc, id); if (!f) return [];
    const missing = new Set(missingFor(f.step).map((b) => b.id));
    const out = [];
    $$(`.fcard[data-fc="${id}"] .fc-blk`).forEach((blk) => {
      if (!missing.has(blk.dataset.bid)) return;
      const ctl = blk.querySelector("input[type=checkbox]:not(:checked):not(:disabled)") ||
        [...blk.querySelectorAll("input:not([type=checkbox]):not(:disabled), select:not(:disabled), textarea:not(:disabled)")].find((x) => !String(x.value || "").trim() && !x.classList.contains("ok")) ||
        blk.querySelector(".tm-start, .drop-zone, .seg-btn:not(:disabled), .btn:not(:disabled)");
      const all = [...blk.querySelectorAll("input[type=checkbox]:not(:checked):not(:disabled), input:not([type=checkbox]):not(:disabled), select:not(:disabled), textarea:not(:disabled), .tm-start, .drop-zone, .seg-btn:not(:disabled), .btn:not(:disabled)")]
        .filter((x) => !passed.keys.has(ctlKey(x)) && !(x.matches("input:not([type=checkbox]), select, textarea") && (String(x.value || "").trim() || x.classList.contains("ok"))));
      const ok = (x) => x && !x.closest(".ap-acts") && !passed.keys.has(ctlKey(x));
      const pick = ok(ctl) ? ctl : all.find(ok);
      if (pick) out.push(pick);
    });
    return out;
  }
  function guideNext(id, { fromStart } = {}) {
    if (focusId !== id || statusOf(M().findStep(proc, id).step) !== "active") return false;
    const next = actionables(id)[0];
    if (next) {
      next.focus({ preventScroll: true }); next.scrollIntoView({ block: "nearest" });
      return true;
    }
    if (!fromStart) { const b = $(`.fcard[data-fc="${id}"] .act-primary`); if (b) { b.focus({ preventScroll: true }); b.classList.add("kb-ready"); } }
    return false;
  }
  function onFocusIn(e) {
    $$(".fc-blk.kb-cur").forEach((n) => n.classList.remove("kb-cur"));
    const blk = e.target.closest && e.target.closest(".fcard .fc-blk"); if (blk) blk.classList.add("kb-cur");
  }
  function setFocus(id, { scroll = true } = {}) {
    focusId = id; saveUi(); render(); if (scroll) scrollToFocus();
  }
  const saveUi = debounce(() => { if (run && run.status !== "completed") commit([{ op: "set", path: ["ui", me()], value: focusId }], { render: false }); }, 1500);
  // Instant (not smooth) on purpose: a re-render during a smooth scroll would strand the focused card off-screen.
  function scrollToFocus() { requestAnimationFrame(() => { const n = $(`.fcard[data-fc="${focusId}"]`); n && n.scrollIntoView({ block: "nearest" }); }); }
  function patchValue(stepId, blockId, delta, renderIt = true) {
    commit([{ op: "merge", path: ["steps", stepId, "values", blockId], value: delta }], { render: renderIt });
  }
  function setValue(stepId, blockId, value, renderIt = true) {
    commit([{ op: "set", path: ["steps", stepId, "values", blockId], value }], { render: renderIt });
  }

  function onDecision(step, block, val) {
    if (val.decision === "go") { toast("GO recorded", "ok"); return; }
    if (block.noGo === "continue") { toast("NO-GO recorded", "warn"); return; }
    if (block.noGo && block.noGo.startsWith("section:")) {
      const sec = proc.sections.find((s) => s.id === block.noGo.slice(8));
      commit([], { event: { type: "nogo", stepId: step.id, text: `NO-GO at ${step.num} by ${val.maker} → ${sec ? sec.title : "section"}` } });
      if (sec && sec.steps[0]) setFocus(sec.steps[0].id);
      toast(`NO-GO — moved to “${sec ? sec.title : ""}”`, "warn", 4000);
      return;
    }
    commit([{ op: "set", path: ["status"], value: "paused" }, { op: "set", path: ["halt"], value: { at: now(), by: val.maker, stepId: step.id, reason: `NO-GO at step ${step.num}: ${val.rationale || block.question}` } }],
      { event: { type: "nogo", stepId: step.id, text: `NO-GO at ${step.num} by ${val.maker} — run halted` } });
  }

  /* ======================= approvals =======================
     Approval / Go-No-Go components ask the approvers (named in settings, or people in the Approver chair) when their step
     starts. Approvers see the request in their runner and get a desktop notification wherever Procedure Runner is open.
     Operators can add an ad-hoc approval to any step (A). In an enforced procedure only an approver — not the person who
     asked — can decide, and nothing (Complete anyway, Skip, close-out) gets past an open approval. */
  const acfg = () => M().approvalsCfg(proc);
  const reqList = () => Object.values(run.approvals || {});
  const latestReq = (stepId, blockId) => reqList().filter((r) => (r.stepId || null) === (stepId || null) && (r.blockId || null) === (blockId || null) && r.status !== "cancelled").sort((a, b) => b.requestedAt - a.requestedAt)[0] || null;
  const approverNames = () => M().approversFor(proc, run);
  const whoLabel = (to) => (to && to.length ? to.join(", ") : "any approver");
  const amApprover = () => approverNames().some((n) => M().sameName(n, me()));
  const blockTitle = (b) => (b.type === "decision" ? `Go / No-Go: ${M().interpolate(b.question || "", ctx(), false)}` : `Sign-off: ${b.label || "Approval"}`);
  function newRequest({ step = null, block = null, kind, title, note = "" }) {
    const id = uid("ap");
    return { op: "set", path: ["approvals", id], value: { id, kind, stepId: step ? step.id : null, blockId: block ? block.id : null, title, note, to: approverNames(), requestedBy: me(), requestedAt: now(), status: "pending" } };
  }
  function autoRequestOps(step) {
    const vals = st(step.id).values || {};
    return (step.blocks || []).filter((b) => M().APPROVAL_TYPES.includes(b.type) && !vals[b.id] && !["pending", "approved"].includes((latestReq(step.id, b.id) || {}).status))
      .map((b) => newRequest({ step, block: b, kind: b.type, title: `Step ${step.num} · ${blockTitle(b)}` }));
  }
  function requestApproval(step, b, note = "", kind) {
    const op = newRequest({ step, block: b, kind: kind || (b ? b.type : "adhoc"), title: step ? `Step ${step.num} · ${b ? blockTitle(b) : step.title}` : `Close out: ${run.name || proc.title}`, note });
    commit([op], { event: { type: "approval-request", stepId: step ? step.id : null, text: `Approval requested — ${op.value.title} → ${whoLabel(op.value.to)}${note ? " · " + note : ""}` } });
    toast(`Approval requested from ${whoLabel(op.value.to)}`, "ok");
    return op.value;
  }
  /* Name (or change) the approvers during a run — e.g. a run that started before anyone was assigned. */
  async function assignApprovers() {
    const cur = (run.setup.approvers || []).join(", ");
    const v = await promptBox("Approvers for this run", { label: `Who approves? Separate several names with commas.${approverNames().length ? " Current: " + approverNames().join(", ") : ""}`, value: cur, placeholder: "e.g. Pat Manager", ok: "Save approvers" });
    if (v == null) return;
    const names = v.split(",").map((x) => x.trim()).filter(Boolean);
    const all = [...new Set([...M().approversFor(proc, { ...run, setup: { ...run.setup, approvers: [] } }), ...names])];
    if (acfg().enforced && !run.practice && all.length && all.every((n) => M().sameName(n, me()))) return toast("You can't be the only approver in this procedure — name someone else", "err", 4500);
    const ops = [{ op: "set", path: ["setup", "approvers"], value: names }];
    M().pendingApprovals(run).forEach((r) => ops.push({ op: "merge", path: ["approvals", r.id], value: { to: all, pingAt: now() } })); // waiting requests go to the new approvers
    commit(ops, { event: { type: "approvers", text: `Approvers for this run: ${all.join(", ") || "none"}` } });
    PR.app.rememberPeople && PR.app.rememberPeople(names);
    toast(all.length ? `Approvers: ${all.join(", ")} — waiting requests were sent to them` : "No approvers assigned", all.length ? "ok" : "warn", 4000);
  }
  async function addAdhocApproval(id) {
    const f = M().findStep(proc, id); if (!f) return;
    const note = await promptBox(`Require approval for step ${f.step.num}`, { label: `What should ${whoLabel(approverNames())} approve? (optional)`, placeholder: "e.g. OK to restart services during business hours", ok: "Request approval" });
    if (note == null) return;
    requestApproval(f.step, null, note.trim());
  }
  function pingRequest(req) {
    commit([{ op: "merge", path: ["approvals", req.id], value: { pingAt: now() } }], { event: { type: "approval-ping", stepId: req.stepId, text: `Reminder sent — ${req.title}` } });
    toast("Reminder sent — approvers get a notification in Procedure Runner", "ok");
  }
  const shareText = (req) => `Approval needed: ${req.title}\nProcedure: ${proc.title}${run.setup.changeId ? " · " + run.setup.changeId : ""}\nRequested by ${req.requestedBy} at ${fmtTime(req.requestedAt)}${req.note ? "\nNote: " + req.note : ""}\nOpen: ${location.href.split("#")[0]}#/run/${run.id}`;
  function decideRequest(req, ok, comment = "", { verbalBy } = {}) {
    const t = now(); const by = verbalBy || me();
    const ops = [{ op: "merge", path: ["approvals", req.id], ifStatus: ["pending"], value: { status: ok ? "approved" : "rejected", decidedBy: by, decidedAt: t, comment, ...(verbalBy ? { verbal: true, recordedBy: me() } : {}) } }];
    const fb = req.blockId ? M().findBlock(proc, req.blockId) : null;
    let dec = null;
    if (fb && fb.block.type === "approval" && ok) ops.push({ op: "set", path: ["steps", req.stepId, "values", req.blockId], value: { approver: by, comment, at: t, by: me(), requestId: req.id } });
    if (fb && fb.block.type === "decision") { dec = { decision: ok ? "go" : "nogo", maker: by, rationale: comment, at: t, by: me(), requestId: req.id }; ops.push({ op: "set", path: ["steps", req.stepId, "values", req.blockId], value: dec }); }
    commit(ops, { event: { type: ok ? "approved" : "rejected", stepId: req.stepId, text: `${req.title} — ${req.kind === "decision" ? (ok ? "GO" : "NO-GO") : ok ? "approved" : "rejected"} by ${by}${verbalBy ? ` (verbal, recorded by ${me()})` : ""}${comment ? " — " + comment : ""}` } });
    if (dec) onDecision(fb.step, fb.block, dec); else toast(ok ? "Approved" : "Rejected", ok ? "ok" : "warn");
  }
  // An approver signing inside the component itself also answers the open request
  function resolveFromBlock(step, b, v) {
    const req = latestReq(step.id, b.id);
    if (!req || req.status !== "pending" || !v) return;
    const ok = b.type === "decision" ? v.decision === "go" : !!v.at;
    commit([{ op: "merge", path: ["approvals", req.id], ifStatus: ["pending"], value: { status: ok ? "approved" : "rejected", decidedBy: v.maker || v.approver || me(), decidedAt: v.at || now(), comment: v.rationale || v.comment || "" } }], { render: false });
  }
  async function verbalApproval(req) {
    const who = await promptBox("Record a verbal approval", { label: "Who approved? (recorded as verbal, with your name)", placeholder: "Name", ok: "Record approval", required: true });
    if (who) decideRequest(req, true, "Verbal approval", { verbalBy: who.trim() });
  }
  function decideControls(req) {
    let c;
    const isDec = req.kind === "decision";
    return h("div.ap-decide",
      c = h("input.inp", { placeholder: isDec ? "Rationale / evidence" : "Comment (optional)" }),
      h("button.btn.btn-sm.btn-success", { type: "button", onclick: () => decideRequest(req, true, c.value.trim()) }, isDec ? "✓ GO" : "✓ Approve"),
      h("button.btn.btn-sm.btn-danger", { type: "button", onclick: async () => {
        if (isDec && !(await confirmBox("Record NO-GO?", "The run will halt (or move to the rollback section).", { ok: "NO-GO", kind: "danger" }))) return;
        decideRequest(req, false, c.value.trim()); } }, isDec ? "✕ NO-GO" : "✕ Reject"));
  }
  function approvalPanel(step, b, req) {
    const live = run.status === "active" || run.status === "paused";
    const enf = acfg().enforced;
    if (!req && !approverNames().length && !run.practice) return h("div.ap-panel.ap-idle", "✍ Needs an approver — none is assigned to this run yet. ",
      live ? h("span.ap-acts.ap-fix", h("button.btn.btn-sm", { type: "button", onclick: () => assignApprovers() }, "Assign approver…")) : null);
    if (!req) return h("div.ap-panel.ap-idle", "✍ Needs approval from ", h("b", whoLabel(approverNames())),
      statusOf(step) === "pending" ? " — requested automatically when the step starts." : ". ",
      live && statusOf(step) === "active" ? h("span.ap-acts", h("button.btn.btn-sm", { type: "button", onclick: () => requestApproval(step, b) }, "Request approval")) : null);
    if (req.status === "rejected") return h("div.ap-panel.ap-rejected", h("div", req.kind === "decision" ? "✕ NO-GO from " : "✕ Rejected by ", h("b", req.decidedBy), ` at ${fmtTime(req.decidedAt)}`, req.comment ? ` — ${req.comment}` : ""),
      live ? h("div.ap-acts", h("button.btn.btn-sm", { type: "button", onclick: () => requestApproval(step, b, "Asking again", req.kind) }, "Request again")) : null);
    if (req.status === "approved") return h("div.ap-panel.ap-ok", req.kind === "decision" ? "✓ GO from " : "✓ Approved by ", h("b", req.decidedBy), ` at ${fmtTime(req.decidedAt)}`,
      req.verbal ? ` (verbal, recorded by ${req.recordedBy})` : "", req.comment ? ` — ${req.comment}` : "");
    const can = M().canApprove(proc, run, req, me());
    if (!approverNames().length && !(req.to || []).length && !can) return h("div.ap-panel.ap-rejected",
      h("div", h("b", "No approver is assigned to this run."), " Name who approves and the request goes to them."),
      live ? h("div.ap-acts.ap-fix", h("button.btn.btn-sm.btn-primary", { type: "button", onclick: () => assignApprovers() }, "✍ Assign approver…")) : null);
    return h("div.ap-panel.ap-wait",
      h("div", "⏳ Waiting for ", h("b", whoLabel(req.to)), h("span.muted.small", ` · asked ${fmtTime(req.requestedAt)} by ${req.requestedBy} · `, h("span", { dataset: { since: String(req.requestedAt) } }, fmtDur(now() - req.requestedAt)))),
      req.note ? h("div.small.ap-note", "“", req.note, "”") : null,
      can ? decideControls(req) : live ? h("div.ap-acts",
        h("button.btn.btn-sm", { type: "button", onclick: () => pingRequest(req) }, "🔔 Remind"),
        h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Change who approves this run", onclick: () => assignApprovers() }, "Change approver…"),
        h("button.btn.btn-sm.btn-ghost", { type: "button", onclick: () => { PR.u.copyText(shareText(req)); toast("Copied — paste it into Teams or an email", "ok"); } }, "Copy for Teams / email"),
        !enf ? h("button.btn.btn-sm.btn-ghost", { type: "button", onclick: () => verbalApproval(req) }, "Record verbal approval…") : null,
        req.kind === "adhoc" && (!enf || M().sameName(req.requestedBy, me())) ? h("button.mini-btn", { type: "button", onclick: () => commit([{ op: "merge", path: ["approvals", req.id], value: { status: "cancelled", cancelledBy: me(), cancelledAt: now() } }], { event: { type: "approval-cancel", stepId: req.stepId, text: `Approval request withdrawn — ${req.title}` } }) }, "Withdraw") : null) : null);
  }
  /* Used by Approval / Go-No-Go components to decide whether this person may sign, or should see the waiting panel. */
  function approvalGate(step, b) {
    const c = acfg(); const req = latestReq(step.id, b.id);
    if (!c.enforced && !(req && req.status === "pending")) return null;
    const isApprover = !!run.practice || amApprover();
    const canDecide = req && req.status === "pending" ? M().canApprove(proc, run, req, me())
      : c.enforced ? isApprover && (!!run.practice || !M().sameName(me(), st(step.id).startedBy)) : true;
    return { enforced: c.enforced, isApprover, canDecide, panel: approvalPanel(step, b, req) };
  }
  function approvalInbox() {
    const pend = M().pendingApprovals(run);
    if (!pend.length) return null;
    const mine = pend.filter((r) => M().canApprove(proc, run, r, me()));
    const others = pend.filter((r) => !mine.includes(r));
    return h(`div.ap-inbox${mine.length ? ".mine" : ""}`,
      mine.length ? [h("div.ap-inbox-h", `✍ ${mine.length} approval${mine.length > 1 ? "s" : ""} waiting for you`),
        mine.map((r) => h("div.ap-item",
          h("div.ap-item-t", h("b", r.title), h("span.muted.small", ` · asked by ${r.requestedBy} at ${fmtTime(r.requestedAt)} · waiting `, h("span", { dataset: { since: String(r.requestedAt) } }, fmtDur(now() - r.requestedAt)))),
          r.note ? h("div.small.ap-note", "“", r.note, "”") : null,
          h("div.ap-item-a", r.stepId ? h("button.btn.btn-sm.btn-ghost", { type: "button", onclick: () => { filter = "all"; setFocus(r.stepId); } }, "Open step") : null, decideControls(r))))] : null,
      others.length ? h("div.ap-inbox-h.wait", "⏳ Waiting on approval: ", others.map((r) => h("span.ap-chip", { onclick: () => r.stepId && setFocus(r.stepId) }, r.title.replace(/^Step /, ""), h("span.muted", ` — ${whoLabel(r.to)}`)))) : null);
  }

  /* ======================= render ======================= */
  function render() {
    const root = $("#run"); if (!root) return;
    deferRender = false;
    if (run.status === "setup" || editingSetup) { root.innerHTML = ""; root.append(setupWizard()); fillSetupComms(); return; }
    const sc = $("#runCenter"); const top = sc && render.lastMode === mode ? sc.scrollTop : null;
    render.lastMode = mode;
    root.innerHTML = "";
    if (commsCfg) { const d = commsDue(); if (lastDue != null && d > lastDue && PR.comms.isCommunicator(commsCfg)) dueToast(d); lastDue = d; }
    root.append(bar(), banner(), approvalInbox(), impactStrip(), h("div.run-main", leftNav(), h("div.run-center#runCenter", mode === "lanes" ? lanes() : list()), rightPanel()), datalists());
    if (top != null) $("#runCenter").scrollTop = top;
  }
  function commsDue() { return commsCfg ? PR.comms.dueCount(run, commsCfg) : 0; }
  let lastDueToast = 0;
  function dueToast(d) { if (now() - lastDueToast < 15000) return; lastDueToast = now(); toast(`📣 ${d} update${d > 1 ? "s" : ""} due — open the Updates tab`, "info", 4000); }
  function checkDue() {
    if (!run || !commsCfg) return;
    const d = commsDue();
    if (lastDue != null && d > lastDue && PR.comms.isCommunicator(commsCfg)) dueToast(d);
    if (d !== lastDue) { lastDue = d; const t = $('.run-right .tab[data-k="comms"]'); if (t) t.textContent = `📣 Updates${d ? " (" + d + ")" : ""}`; t && t.classList.toggle("due", d > 0); }
  }
  function fillSetupComms() {
    const box = $("#wzComms"); if (!box || !commsCfg) return;
    const items = PR.comms.planFor(proc, commsCfg).filter((i) => ["advance", "reminder", "start"].includes(i.trigger));
    if (!items.length) return;
    const can = PR.comms.isCommunicator(commsCfg);
    box.append(h("h3", "📣 Communications before you start"), items.map((it) => {
      const s = PR.comms.status(run, it); const last = s.sent[s.sent.length - 1];
      return h("div.cm-item.inline", h("b", it.tpl.name), h("span.muted.small", ` — ${commsCfg.audiences.filter((a) => (it.tpl.audiences || []).includes(a.id)).map((a) => a.name).join(", ")}`),
        h("div.spacer"), last ? h("span.chip.c-green", `Sent ${fmtTime(last.at, false)}`) : null,
        can ? h("button.btn.btn-sm", { type: "button", onclick: () => PR.comms.compose({ run, item: it, commit }) }, "Compose") : null);
    }));
  }
  function datalists() { return h("datalist#runPeople", people().map((p) => h("option", { value: p }))); }

  function bar() {
    const pg = progressOf(); const pct = pg.total ? Math.round((pg.done / pg.total) * 100) : 0;
    const remainMin = stepsInOrder().filter(({ step }) => ["pending", "active"].includes(statusOf(step))).reduce((a, { step }) => a + ((histStats[step.id] && histStats[step.id].median / 60000) || Number(step.estMin) || 0), 0);
    const dir = M().directionLabel(proc, run.setup);
    const live = ["active", "paused"].includes(run.status);
    return h("div.run-bar",
      h("a.icon-btn", { href: "#/", title: "Library" }, "←"),
      h("div.rb-title", h("div.rb-name", run.name), h("div.rb-sub", run.procTitle, " · ", run.procVersion === "draft" ? "draft" : `v${run.procVersion}`, run.setup.changeId ? ` · ${run.setup.changeId}` : "")),
      dir ? h("span.dir-pill", { title: "Failover direction (current primary → new primary)" }, "⇄ ", dir) : null,
      run.practice ? h("span.chip.c-gray", "Practice") : null,
      PR.app.statusChip(run.status),
      hasTracks() ? h("div.seg.seg-sm.chair-seg", { title: "Which chair's steps you see" }, [["", "All"], ...M().tracks(proc).map((t) => [t.id, t.name])].map(([k, l]) =>
        h(`button.seg-btn${chairView === k ? ".on" : ""}`, { type: "button", onclick: () => setChair(k) }, l))) : null,
      h("div.spacer"),
      run.startedAt ? h("div.rb-clock", { title: "Elapsed since run start" }, h("span.muted.small", "⏱ "), live ? h("b", { dataset: { since: String(run.startedAt) } }, fmtDur(now() - run.startedAt)) : h("b", fmtDur((run.completedAt || now()) - run.startedAt))) : null,
      h("div.rb-prog", { title: `${pg.done} of ${pg.total} steps finished` }, h("div.bar", h("div.bar-fill", { style: { width: pct + "%" } })), h("span.small", `${pg.done}/${pg.total}`)),
      live && remainMin ? h("div.rb-eta.small", { title: "Remaining estimate (history median or author estimate)" }, "ETA ", h("b", fmtTime(now() + remainMin * 60000, false)), h("span.muted", ` (~${fmtMin(remainMin)})`)) : null,
      h("span#runSync.sync-dot.ok", { title: "All changes saved" }),
      h("button.btn.btn-sm.btn-warn-o", { type: "button", title: "Log an issue (I)", onclick: () => issueModal({ stepId: focusId }) }, "⚠ Issue"),
      h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Communication log (C)", onclick: commsModal }, "☎ Comms"),
      h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Read-only live view to share with the team or put on a screen", onclick: () => { PR.u.copyText(PR.comms.liveURL(run)); window.open(`#/live/${run.id}`, "_blank"); } }, "📺 Follow"),
      h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Run report", onclick: () => PR.app.go(`#/report/${run.id}`) }, "📄 Report"),
      h("button.icon-btn", { type: "button", title: "More", onclick: (e) => menu(e.currentTarget, [
        { icon: "⚙", label: "Edit run setup (participants, direction…)", onClick: () => { editingSetup = true; setupWizard.page = "info"; render(); } },
        { icon: "✍", label: `Approvers… (${approverNames().join(", ") || "none assigned"})`, onClick: () => assignApprovers() },
        run.status === "paused" ? { icon: "▶", label: "Resume run", onClick: resumeRun } : { icon: "⏸", label: "Halt run", onClick: haltRun },
        { icon: "🚧", label: "Log a roadblock", onClick: () => issueModal({ stepId: focusId, blocking: true, severity: "high" }) },
        M().impactState(run).down ? { icon: "🟢", label: "Declare service restored now", onClick: () => declareImpact("up") } : { icon: "🔴", label: "Declare members impacted now", onClick: () => declareImpact("down") },
        { icon: "⇩", label: "Export run (JSON)", onClick: async () => PR.u.download(`${PR.u.slug(run.name)}.run.json`, JSON.stringify(await PR.store.exportRunBundle(run), null, 2)) },
        { icon: "⌨", label: "Keyboard shortcuts", onClick: () => PR.app.help() },
        { sep: true },
        { icon: "✕", label: "Abort run", danger: true, onClick: abortRun }], { align: "right" }) }, "⋯"),
      live ? h("button.btn.btn-sm.btn-primary", { type: "button", onclick: finishWizard }, "🏁 Finish") : null);
  }
  function banner() {
    if (run.status === "paused") return h("div.banner.b-warn", h("b", "⏸ Run halted. "), run.halt ? `${run.halt.reason} — ${run.halt.by} at ${fmtTime(run.halt.at)}` : "", h("div.spacer"),
      h("button.btn.btn-sm", { type: "button", onclick: resumeRun }, "Resume run"), h("button.btn.btn-sm.btn-danger", { type: "button", onclick: abortRun }, "Abort"));
    if (run.status === "completed" || run.status === "aborted") return h("div.banner.b-ok", run.status === "completed" ? "✓ Run completed " : "Run aborted ", fmtDateTime(run.completedAt), h("div.spacer"), h("button.btn.btn-sm", { type: "button", onclick: () => PR.app.go(`#/report/${run.id}`) }, "View report"));
    if (run.practice) return h("div.banner.b-info", "🧪 Practice run — not counted in history or timing statistics.");
    return null;
  }
  function chairKey() { return `chair_${run.id}`; }
  function setChair(id) { chairView = id; PR.app.LS.set(chairKey(), id); const f = myStepsInOrder().some((x) => x.step.id === focusId); if (!f) focusId = firstOpen(); render(); scrollToFocus(); }
  async function chooseChair(force) {
    if (!hasTracks() || run.status === "setup") return;
    const saved = PR.app.LS.get(chairKey(), null);
    if (saved !== null && !force) { chairView = saved; return; }
    const mine = (run.setup.participants || []).find((p) => p.name === me() && p.track);
    const v = await modal({
      title: "Which chair are you working?", size: "md", subtitle: "You'll only see your chair's steps (plus shared ones). Switch any time from the run bar.",
      body: (close) => h("div.chair-pick",
        M().tracks(proc).map((t) => { const pg = M().trackProgress(run, t.id); return h(`button.chair-card${mine && mine.track === t.id ? ".on" : ""}`, { type: "button", style: { "--c": t.color }, onclick: () => close(t.id) },
          h("b", t.name), h("span", t.desc || ""), h("span.muted.small", `${pg.done}/${pg.total} steps`)); }),
        h("button.chair-card.all", { type: "button", onclick: () => close("") }, h("b", "All chairs"), h("span", "Coordinator / lead — see everything"))),
    });
    setChair(v == null ? (mine ? mine.track : "") : v);
  }
  async function signOffTrack(t) {
    const pg = M().trackProgress(run, t.id);
    if (!pg.complete && !(await confirmBox(`Sign off ${t.name}?`, `${pg.total - pg.done} step(s) in ${t.name} aren't finished. Sign off anyway? (Recorded.)`, { ok: "Sign off anyway", kind: "danger" }))) return;
    commit([{ op: "set", path: ["trackSignoff", t.id], value: { by: me(), at: now(), open: pg.total - pg.done } }], { event: { type: "signoff", text: `✍ ${t.name} signed off by ${me()}${pg.complete ? "" : ` with ${pg.total - pg.done} open step(s)`}` } });
    toast(`${t.name} signed off`, "ok");
  }
  function tracksPanel() {
    if (!hasTracks()) return null;
    return h("div.tracks-panel", h("div.ns-top", h("span.ns-t", "Chairs"), h("button.link-btn.small", { type: "button", onclick: () => chooseChair(true) }, "switch")),
      M().tracks(proc).map((t) => {
        const pg = M().trackProgress(run, t.id);
        return h(`div.track-card${chairView === t.id ? ".on" : ""}`, { style: { "--c": t.color }, onclick: (e) => { if (!e.target.closest("button")) setChair(chairView === t.id ? "" : t.id); } },
          h("div.ns-top", h("span.ns-t", t.name), h("span.ns-c", `${pg.done}/${pg.total}`)),
          h("div.bar.thin", h("div.bar-fill", { style: { width: pg.pct + "%", background: t.color } })),
          pg.signoff ? h("div.small.c-green-t", `✓ Signed off · ${pg.signoff.by} ${fmtTime(pg.signoff.at, false)}`) :
            pg.active.length ? h("div.small", `◉ ${pg.active.map((x) => x.num + " " + x.title).join(", ")}`.slice(0, 80)) : pg.next ? h("div.small.muted", `Next: ${pg.next.num} ${pg.next.title}`.slice(0, 70)) : null,
          !pg.signoff && run.status === "active" && (pg.complete || chairView === t.id) ? h(`button.btn.btn-sm${pg.complete ? ".btn-cta" : ""}`, { type: "button", onclick: () => signOffTrack(t) }, `✍ Sign off ${t.name}`) : null);
      }));
  }
  function waitingOn(step) {
    if (!step.waitFor) return null;
    const f = M().findStep(proc, step.waitFor); if (!f) return null;
    return ["done", "skipped", "na"].includes(statusOf(f.step)) ? null : f;
  }
  function impactStrip() {
    const im = M().impactState(run);
    if (im.enabled) return PR.ui.impactPanel(im, { size: "strip" });
    const rb = im.roadblocks.open;
    return rb.length ? h("div.banner.b-warn.sm", `🚧 ${rb.length} open roadblock${rb.length > 1 ? "s" : ""}: `, rb.map((i) => i.title).join(" · ")) : null;
  }
  function impactFlag(step) {
    const im = step.impact; if (!im || !im.mark) return null;
    return h(`span.imp-flag.${im.mark}`, { title: `${M().impactName(proc)}: ${im.mark === "down" ? "members impacted" : "service restored"} when this step ${im.on === "start" ? "starts" : "completes"}` },
      im.mark === "down" ? (im.on === "start" ? "🔴 DOWN at start" : "🔴 DOWN after") : (im.on === "start" ? "🟢 UP at start" : "🟢 UP after"));
  }
  /* Manual declaration for unplanned outages, or when reality differs from the planned markers. */
  async function declareImpact(type) {
    const note = await PR.u.promptBox(type === "down" ? "Members impacted now?" : "Service restored now?", { label: type === "down" ? "What's down / who is impacted? (shown on the dashboard)" : "Note (optional)", ok: type === "down" ? "🔴 Start impact timer" : "🟢 Stop impact timer", required: type === "down" });
    if (note == null) return;
    const before = M().impactState(run);
    commit([{ op: "push", path: ["impactLog"], value: { type, at: now(), by: me(), note } }], { event: { type: "impact", text: type === "down" ? `🔴 ${M().impactName(proc)}: members impacted — ${note}` : `🟢 ${M().impactName(proc)}: service restored${before.since ? " after " + fmtDur(now() - before.since, { short: true }) : ""}${note ? " — " + note : ""}` } });
  }
  /* Toast + log line when a step marked as an impact boundary flips the state. */
  function announceImpact(before) {
    const after = M().impactState(run);
    if (!before.down && after.down) { toast(`🔴 ${after.name}: members impacted — timer started`, "err", 4000); commit([], { render: false, event: { type: "impact", text: `🔴 ${after.name}: members impacted` } }); }
    if (before.down && !after.down) { toast(`🟢 Service restored — members were impacted for ${fmtDur(now() - before.since, { short: true })}`, "ok", 5000); commit([], { render: false, event: { type: "impact", text: `🟢 ${after.name}: service restored after ${fmtDur(now() - before.since, { short: true })}` } }); }
  }
  async function haltRun() {
    const r = await promptBox("Halt run", { label: "Reason", ok: "Halt", required: true });
    if (r) commit([{ op: "set", path: ["status"], value: "paused" }, { op: "set", path: ["halt"], value: { at: now(), by: me(), reason: r } }], { event: { type: "halt", text: `Run halted: ${r}` } });
  }
  function resumeRun() { commit([{ op: "set", path: ["status"], value: "active" }, { op: "set", path: ["halt"], value: null }], { event: { type: "resume", text: "Run resumed" } }); }
  async function abortRun() {
    const r = await promptBox("Abort run?", { label: "Reason (the run is kept and marked aborted)", ok: "Abort run", required: true });
    if (r) { commit([{ op: "set", path: ["status"], value: "aborted" }, { op: "set", path: ["completedAt"], value: now() }, { op: "merge", path: ["completion"], value: { outcome: "Aborted", summary: r, authorizedBy: me(), authorizedAt: now() } }], { event: { type: "abort", text: `Run aborted: ${r}` } }); await drain(); PR.app.go(`#/report/${run.id}`); }
  }

  /* ---------- left navigation ---------- */
  function leftNav() {
    const sites = proc.environments.enabled ? M().sites(proc) : [];
    return h("aside.run-left", tracksPanel(),
      h("div.seg.seg-sm.seg-wide", [["all", "All"], ["open", "Open"], ["active", "Active"], ["issues", "Issues"]].map(([k, l]) =>
        h(`button.seg-btn${filter === k ? ".on" : ""}`, { type: "button", onclick: () => { filter = k; PR.app.LS.set("runFilter", k); render(); } }, l))),
      sites.length ? h("div.site-filter", h(`button.sf${siteFilter === "all" ? ".on" : ""}`, { type: "button", onclick: () => { siteFilter = "all"; render(); } }, "All sites"),
        sites.map((s) => h(`button.sf${siteFilter === s.id ? ".on" : ""}`, { type: "button", style: { "--c": s.color }, onclick: () => { siteFilter = s.id; render(); } }, h("span.env-dot"), s.code || s.name))) : null,
      h("div.seg.seg-sm.seg-wide", [["list", "☰ List"], ["lanes", "▥ Lanes"]].map(([k, l]) => h(`button.seg-btn${mode === k ? ".on" : ""}`, { type: "button", title: k === "lanes" ? "One column per datacenter (L)" : "Single list (L)", onclick: () => { mode = k; PR.app.LS.set("runMode", k); render(); } }, l))),
      h("div.nav-secs", proc.sections.map((sec) => {
        const steps = sec.steps.filter(applicable);
        if (!steps.length && (run.setup.excluded || []).length) return null;
        const done = steps.filter((s) => ["done", "skipped", "na"].includes(statusOf(s))).length;
        const act = steps.filter((s) => statusOf(s) === "active").length;
        const hasFocus = sec.steps.some((s) => s.id === focusId);
        return h(`div.nav-sec${hasFocus ? ".on" : ""}${done === steps.length && steps.length ? ".complete" : ""}`, { onclick: () => { const t = sec.steps.find((s) => ["pending", "active"].includes(statusOf(s))) || sec.steps[0]; if (t) { if (mode === "lanes") { mode = "list"; } setFocus(t.id); } } },
          h("div.ns-top", h("span.ns-t", sec.title), h("span.ns-c", `${done}/${steps.length}`)),
          h("div.bar.thin", h("div.bar-fill", { style: { width: (steps.length ? (done / steps.length) * 100 : 0) + "%" } })),
          act ? h("div.ns-act", `◉ ${act} active`) : null);
      })));
  }

  /* ---------- list (center) ---------- */
  function visible(step, section) {
    if (!inMyChair(step, section)) return false;
    const s = statusOf(step);
    if (filter === "open" && !["pending", "active"].includes(s)) return step.id === focusId;
    if (filter === "active" && s !== "active") return step.id === focusId;
    if (filter === "issues" && !Object.values(run.issues || {}).some((i) => i.stepId === step.id)) return step.id === focusId;
    if (siteFilter !== "all") { const t = targetOf(step, section); if (!(t.site && t.site.id === siteFilter) && t.kind !== "both") return step.id === focusId; }
    return true;
  }
  function list() {
    const wrap = h("div.run-list");
    proc.sections.forEach((sec) => {
      const rows = sec.steps.filter((s) => visible(s, sec));
      if (!rows.length) return;
      const steps = sec.steps.filter(applicable);
      const done = steps.filter((s) => ["done", "skipped", "na"].includes(statusOf(s))).length;
      wrap.append(h("div.rl-sec", h("span.rl-sec-t", sec.title), sec.phase === "post" && proc.environments.directional ? h("span.chip.c-amber-o", "after cutover") : null, h("span.muted.small", `${done}/${steps.length}`)));
      rows.forEach((step, i) => wrap.append(step.id === focusId ? focusCard(step, sec) : stepRow(step, sec, rows[i - 1])));
    });
    if (!wrap.children.length) wrap.append(h("div.empty", h("div.empty-title", "Nothing here"), h("div.muted", "No steps match this filter.")));
    return wrap;
  }
  function stepRow(step, sec, prev) {
    const s = st(step.id); const status = statusOf(step); const t = targetOf(step, sec);
    const ss = PR.ui.STEP_STATUS[status];
    const issues = Object.values(run.issues || {}).filter((i) => i.stepId === step.id);
    return h(`div.srow.${ss.cls}${step.critical ? ".critical" : ""}${step.parallel ? ".parallel" : ""}`, { dataset: { fc: step.id }, onclick: (e) => { if (!e.target.closest("button")) setFocus(step.id, { scroll: false }); } },
      h("button.st-btn", { type: "button", title: status === "pending" ? "Start (one click)" : status === "active" ? "Complete" : ss.label, disabled: !["pending", "active"].includes(status) || run.status !== "active",
        onclick: () => (status === "pending" ? startStep(step.id, { quiet: true }) : completeStep(step.id)) }, ss.icon),
      h("span.sr-num", step.num),
      PR.ui.envBadge(t, { size: "sm" }),
      h("span.sr-title", step.title), impactFlag(step),
      !chairView && hasTracks() ? (() => { const t = M().trackById(proc, M().trackOf(step, sec)); return t ? h("span.track-chip.sm", { style: { "--c": t.color } }, t.name) : null; })() : null,
      statusOf(step) === "pending" && waitingOn(step) ? h("span.sr-wait", { title: "Waiting on a handoff from another chair" }, `⏳ #${waitingOn(step).step.num}`) : null,
      step.window && status === "pending" ? h("span.sr-win", step.window) : null,
      issues.length ? h("span.sr-iss", { title: `${issues.length} issue(s)` }, `⚠ ${issues.length}`) : null,
      h("span.sr-right",
        status === "active" ? h("span.timer.live", { dataset: { since: String(s.startedAt) } }, fmtDur(now() - s.startedAt)) : null,
        status === "done" ? [s.timing === "unavailable" ? PR.ui.timingChip("unavailable") : h("span.timer", fmtDur(duration(s), { short: true })), s.timing === "manual" ? PR.ui.timingChip("manual") : null] : null,
        status === "skipped" || status === "na" ? h("span.muted.small", status === "na" && !applicable(step) ? "not this direction" : s.skipReason || "") : null,
        (s.finishedBy || s.startedBy) ? h("span.sr-who", s.finishedBy || s.startedBy) : null));
  }

  function focusCard(step, sec) {
    const s = st(step.id); const status = statusOf(step); const t = targetOf(step, sec);
    const vals = s.values || {};
    const c = ctx();
    const nextId = nextOpenAfter(step.id);
    const nextF = nextId && nextId !== step.id ? M().findStep(proc, nextId) : null;
    const hs = histStats[step.id];
    const live = run.status === "active";
    const issues = Object.values(run.issues || {}).filter((i) => i.stepId === step.id);
    const notes = Object.values(run.notes || {}).filter((n) => n.stepId === step.id);
    let noteInp;
    const r = (b) => ({
      value: vals[b.id], ctx: c, me: me(), people: people(), readonly: !live || ["done", "skipped", "na"].includes(status),
      set: (v, o = {}) => { const ap = M().APPROVAL_TYPES.includes(b.type); setValue(step.id, b.id, v, o.render !== false && !ap); if (ap) { resolveFromBlock(step, b, v); if (o.render !== false) render(); } },
      approvalGate: (blk) => approvalGate(step, blk),
      patch: (d, o = {}) => patchValue(step.id, b.id, d, o.render !== false),
      onDecision: (blk, v) => onDecision(step, blk, v),
      finishTimer: (blk) => timerGate(step, blk),
      onFail: (blk) => setTimeout(async () => { if (await confirmBox("Validation failed", "Log an issue for this failed check?", { ok: "Log issue" })) issueModal({ stepId: step.id, title: `Validation failed: ${M().interpolate(blk.test, c, false)}` }); }, 50),
      putFile: async (f) => S().putAttachment(run.id, f.type && f.type.startsWith("image/") ? PR.u.dataURLToBlob(await PR.u.compressImage(f)) : f, f.name),
    });
    const primaryBtn = status === "pending" ? h("button.btn.btn-primary.btn-xl.act-primary", { type: "button", disabled: !live, onclick: () => startStep(step.id) }, "▶ Start", h("kbd", "Enter"))
      : status === "active" ? h("button.btn.btn-success.btn-xl.act-primary", { type: "button", disabled: !live, onclick: () => completeStep(step.id) }, "✓ Complete", h("kbd", "Enter"))
        : h("button.btn.btn-xl", { type: "button", disabled: !live || !applicable(step), onclick: () => reopenStep(step.id) }, "↺ Reopen");
    return h(`div.fcard.${PR.ui.STEP_STATUS[status].cls}${step.critical ? ".critical" : ""}`, { dataset: { fc: step.id }, style: { "--c": t.color || "var(--line)" } },
      h("div.fc-top",
        h("span.fc-num", step.num || "•"),
        h("div.fc-tt", h("div.fc-title", step.title), h("div.fc-sub", sec.title, step.category ? " · " : "", PR.ui.catChip(step.category), step.critical ? h("span.crit-tag", "★ critical") : null, step.parallel ? h("span.par-tag", "⇉ parallel with previous") : null, impactFlag(step))),
        h("div.fc-stat",
          status === "active" ? h("div.fc-timer", h("span.muted.small", "Elapsed"), h("b", { dataset: { since: String(s.startedAt) } }, fmtDur(now() - s.startedAt))) : null,
          status === "done" ? h("div.fc-timer", h("span.muted.small", "Duration"), h("b", s.timing === "unavailable" ? "—" : fmtDur(duration(s))), PR.ui.timingChip(s.timing)) : null,
          h(`span.chip.${PR.ui.STEP_STATUS[status].cls}`, PR.ui.STEP_STATUS[status].label))),
      PR.ui.envBadge(t, { size: "lg" }),
      h("div.fc-meta",
        step.owner ? h("span", "👥 ", step.owner) : null, step.contact ? h("span", "☎ Escalation: ", step.contact) : null, step.window ? h("span", "🕘 ", step.window) : null,
        step.estMin ? h("span", `⏱ est ${step.estMin}m`) : null, hs ? h("span", { title: `Median of ${hs.n} previous run(s)` }, `📈 usually ${fmtDur(hs.median, { short: true })}`) : null,
        s.startedAt ? h("span", `▶ ${fmtTime(s.startedAt)} ${s.startedBy || ""}`) : null, s.finishedAt ? h("span", `✓ ${fmtTime(s.finishedAt)} ${s.finishedBy || ""}${chairOf(s.finishedBy) ? " (" + chairOf(s.finishedBy).split("—")[0].trim() + ")" : ""}`) : null,
        status === "skipped" || status === "na" ? h("span", `Reason: ${s.skipReason || (applicable(step) ? "" : "does not apply to this direction")}`) : null),
      s.incomplete ? h("div.banner.b-warn.sm", `Completed with missing items: ${s.incomplete.join(", ")}`) : null,
      (() => { const w = status === "pending" && waitingOn(step); if (!w) return null; const t = M().trackById(proc, M().trackOf(w.step, w.section)); const ws = st(w.step.id);
        return h("div.banner.b-info.sm.waiting", "⏳ Waiting on ", h("b", t ? t.name : "another step"), ` · step ${w.step.num} ${w.step.title}`, ws.status === "active" ? h("span", " — in progress, ", h("span", { dataset: { since: String(ws.startedAt) } }, fmtDur(now() - ws.startedAt))) : " — not started yet"); })(),
      s.timing === "unavailable" && status === "done" ? h("div.banner.b-warn.sm", "Timing unreliable — no start time was captured. ", h("button.mini-btn", { type: "button", onclick: () => editTimes(step.id) }, "Add start time")) : null,
      priorFor(step.id).map((p) => priorLessonBanner(p)),
      reqList().filter((r) => r.stepId === step.id && r.kind === "adhoc" && r.status !== "cancelled").map((r) => approvalPanel(step, null, r)),
      h("div.fc-blocks", step.blocks.map((b) => { const d = PR.blocks.def(b.type); return d ? h("div.fc-blk", { dataset: { bid: b.id } }, d.run(b, r(b))) : null; })),
      issues.length || notes.length ? h("div.fc-extra",
        issues.map((i) => h(`div.mini-issue.${i.status === "resolved" ? "res" : "open"}`, { onclick: () => issueModal(i) }, i.status === "resolved" ? "✓ " : "⚠ ", h("b", i.title || "Issue"), ` · ${fmtTime(i.at)} · ${i.by}`)),
        notes.map((n) => h("div.mini-note", "💡 ", n.text, h("span.muted", ` — ${n.by} ${fmtTime(n.at)}`)))) : null,
      h("div.fc-actions",
        primaryBtn,
        status === "pending" ? h("button.btn", { type: "button", disabled: !live, title: "Already did it but forgot to press Start — records the finish time and flags timing as unreliable", onclick: () => completeStep(step.id) }, "✓ Already done") : null,
        status === "pending" || status === "active" ? h("button.btn.btn-ghost", { type: "button", disabled: !live, title: step.required === false ? "Optional step — skip it without a reason" : "Skip (asks for a reason)", onclick: () => skipStep(step.id) }, step.required === false ? "⤼ Not needed" : "⤼ Skip") : null,
        h("button.btn.btn-warn-o", { type: "button", onclick: () => issueModal({ stepId: step.id }) }, "⚠ Issue", h("kbd", "I")),
        h("div.spacer"),
        h("button.icon-btn", { type: "button", title: "More", onclick: (e) => menu(e.currentTarget, [
          { icon: "🕘", label: "Edit times / executed by", onClick: () => editTimes(step.id) },
          { icon: "✍", label: "Require approval for this step…", hint: "A", disabled: !live || ["done", "skipped", "na"].includes(status), onClick: () => addAdhocApproval(step.id) },
          { icon: "∅", label: "Mark not applicable", disabled: !live, onClick: () => skipStep(step.id, "na") },
          { icon: "↺", label: "Reopen", disabled: !live || status === "pending" || status === "active", onClick: () => reopenStep(step.id) }], { align: "right" }) }, "⋯")),
      live && (status === "pending" || status === "active") ? h("div.kb-hint",
        status === "pending" ? [h("kbd", "Enter"), " start"] : [h("kbd", "Enter"), " next item / complete"], " · ", h("kbd", "Shift"), "+", h("kbd", "Enter"), " complete now · ",
        h("kbd", "↑"), h("kbd", "↓"), " steps · ", h("kbd", "S"), " skip · ", h("kbd", "I"), " issue · ", h("kbd", "N"), " note · ", h("button.linkish", { type: "button", onclick: () => keysHelp() }, h("kbd", "?"), " all keys")) : null,
      h("div.fc-note", h("span", "💡"), noteInp = h("input.inp#noteInp", { placeholder: "Improvement note for next time — press Enter to save (N)", onkeydown: (e) => {
        if (e.key === "Enter" && noteInp.value.trim()) { const id = uid("nt"); commit([{ op: "set", path: ["notes", id], value: { id, stepId: step.id, at: now(), by: me(), kind: "improve", text: noteInp.value.trim() } }], { render: false }); toast("Note saved — it will appear in lessons learned", "ok", 1600); noteInp.value = ""; render(); }
        if (e.key === "Escape") noteInp.blur();
      } })),
      nextF ? h("div.upnext", { onclick: (e) => { if (!e.target.closest("button")) setFocus(nextF.step.id); } },
        h("span.un-k", "Up next"), h("span.sr-num", nextF.step.num), PR.ui.envBadge(targetOf(nextF.step, nextF.section), { size: "sm" }), h("span.un-t", nextF.step.title),
        nextF.step.parallel ? h("span.par-tag", "⇉ can run in parallel") : null,
        status === "active" && live ? h("button.btn.btn-sm", { type: "button", title: "Start the next step now while this one keeps running", onclick: () => startStep(nextF.step.id, { quiet: true }) }, "▶ Start in parallel") : null) : null);
  }
  function priorLessonBanner(p) {
    const key = `${p.runId}:${p.lesson.id}`;
    const v = (run.carried || {})[key];
    const set = (result) => {
      commit([{ op: "set", path: ["carried", key], value: { result, by: me(), at: now(), text: p.lesson.text } }], { event: { type: "lesson", stepId: p.lesson.stepId, text: `Prior lesson "${p.lesson.text}" → ${result}` } });
      S().patchRun(p.runId, [{ op: "merge", path: ["lessons", p.lesson.id], value: { lastCheck: { result, runId: run.id, at: now(), by: me() }, status: result === "improved" ? "verified" : p.lesson.status || "open" } }]).catch(() => {});
    };
    return h("div.prior", h("div", h("b", `From ${fmtDate(p.runDate)}: `), p.lesson.text, p.lesson.owner ? h("span.muted", ` (owner: ${p.lesson.owner})`) : null),
      v ? h("span.done-pill", v.result === "improved" ? "✓ Improvement worked" : v.result === "not_improved" ? "✕ Still an issue" : "Not tested") :
        h("div.seg.seg-sm", h("span.muted.small", "Did the change work? "), h("button.seg-btn.pass", { type: "button", onclick: () => set("improved") }, "Yes"), h("button.seg-btn.fail", { type: "button", onclick: () => set("not_improved") }, "No"), h("button.seg-btn", { type: "button", onclick: () => set("not_tested") }, "N/A")));
  }

  /* ---------- lanes: one column per datacenter ---------- */
  function lanes() {
    const cols = new Map();
    const sites = M().sites(proc);
    sites.forEach((s) => cols.set(s.id, { title: s.name, site: s, items: [] }));
    cols.set("_both", { title: "Both / coordination", items: [] });
    stepsInOrder().forEach(({ step, section }) => {
      if (!visible(step, section)) return;
      const t = targetOf(step, section);
      const key = t.site ? t.site.id : "_both";
      (cols.get(key) || cols.get("_both")).items.push({ step, section, t });
    });
    return h("div.lanes", [...cols.values()].filter((c) => c.items.length || c.site).map((c) => {
      const act = c.items.filter((x) => statusOf(x.step) === "active");
      const done = c.items.filter((x) => ["done", "skipped", "na"].includes(statusOf(x.step))).length;
      const t0 = c.site ? c.items[0] && c.items[0].t : null;
      return h("div.lane", { style: { "--c": c.site ? c.site.color : "#64748b" } },
        h("div.lane-h", h("div.lane-t", c.title), c.site ? h("div.lane-sub", c.site.partition ? `HMC: ${c.site.partition}` : "", t0 && t0.roleLabel ? ` · ${t0.roleLabel}` : "") : null,
          h("div.lane-c", `${done}/${c.items.length} done`, act.length ? h("span.lane-act", ` · ◉ ${act.length} active`) : null)),
        h("div.lane-body", c.items.map(({ step, section, t }) => {
          const s = st(step.id); const status = statusOf(step); const ss = PR.ui.STEP_STATUS[status];
          return h(`div.lcard.${ss.cls}${step.id === focusId ? ".focus" : ""}`, { onclick: (e) => { if (!e.target.closest("button")) { mode = "list"; PR.app.LS.set("runMode", mode); setFocus(step.id); } } },
            h("button.st-btn", { type: "button", disabled: !["pending", "active"].includes(status) || run.status !== "active", onclick: () => (status === "pending" ? startStep(step.id, { quiet: true }) : completeStep(step.id)) }, ss.icon),
            h("span.sr-num", step.num), h("span.lc-t", step.title, t.roleLabel ? h("span.lc-role", t.roleLabel) : null),
            status === "active" ? h("span.timer.live", { dataset: { since: String(s.startedAt) } }, fmtDur(now() - s.startedAt)) : status === "done" ? h("span.timer", s.timing === "unavailable" ? "?" : fmtDur(duration(s), { short: true })) : null);
        })));
    }));
  }

  /* ---------- right panel ---------- */
  function rightPanel() {
    const active = stepsInOrder().filter(({ step }) => statusOf(step) === "active");
    const open = Object.values(run.issues || {}).filter((i) => i.status !== "resolved");
    const due = commsDue();
    const tabs = [["active", `Active (${active.length})`], ["comms", `📣 Updates${due ? " (" + due + ")" : ""}`], ["issues", `Issues${open.length ? " (" + open.length + ")" : ""}`], ["log", "Log"], ["team", "Team"]];
    let body;
    if (rightTab === "active") {
      body = active.length ? active.map(({ step, section }) => {
        const s = st(step.id);
        return h(`div.act-card${step.id === focusId ? ".focus" : ""}`, { style: { "--c": targetOf(step, section).color || "var(--accent)" }, onclick: (e) => { if (!e.target.closest("button")) setFocus(step.id); } },
          h("div.ac-top", h("span.sr-num", step.num), PR.ui.envBadge(targetOf(step, section), { size: "sm" }), h("div.spacer"), h("b.timer.live", { dataset: { since: String(s.startedAt) } }, fmtDur(now() - s.startedAt))),
          h("div.ac-t", step.title), h("div.ac-b", h("span.muted.small", `${s.startedBy || ""} · since ${fmtTime(s.startedAt, false)}`),
            h("button.btn.btn-success.btn-sm", { type: "button", disabled: run.status !== "active", onclick: () => completeStep(step.id) }, "✓ Complete")));
      }) : h("div.muted.pad", "No steps running. Start the focused step with Enter. Steps you start in parallel each get their own timer here.");
    } else if (rightTab === "issues") {
      const all = Object.values(run.issues || {}).sort((a, b) => b.at - a.at);
      body = [h("button.btn.btn-warn-o.btn-block", { type: "button", onclick: () => issueModal({ stepId: focusId }) }, "＋ Log issue (I)"),
        all.length ? all.map((i) => { const f = i.stepId && M().findStep(proc, i.stepId); return h(`div.iss-card.${i.status === "resolved" ? "res" : "open"}.sev-${i.severity || "medium"}`, { onclick: () => issueModal(i) },
          h("div.ic-top", h("b", i.blocking ? "🚧 " : "", i.title || "Issue"), h("span.chip", i.status === "resolved" ? "Resolved" : "Open")),
          h("div.muted.small", f ? `Step ${f.step.num} · ` : "", fmtTime(i.at), " · ", i.by, (i.evidence || []).length ? ` · 📎 ${i.evidence.length}` : "")); }) : h("div.muted.pad", "No issues logged.")];
    } else if (rightTab === "comms") {
      const ph = h("div.muted.pad", "Loading…");
      PR.comms.runnerPanel({ run, commit }).then((n) => ph.replaceWith(n)).catch((e) => { ph.textContent = "Couldn't load communications: " + e.message; });
      body = ph;
    } else if (rightTab === "log") {
      body = h("div.log", (run.events || []).slice().reverse().slice(0, 300).map((e) => h("div.log-row", { onclick: () => e.stepId && setFocus(e.stepId) }, h("span.log-t", fmtTime(e.at)), h("span.log-w", e.by || ""), h("span.log-x", e.text || e.type))));
    } else {
      body = h("div", (run.setup.participants || []).map((p) => {
        const doneBy = Object.values(run.steps || {}).filter((s) => s.finishedBy === p.name).length;
        const act = stepsInOrder().filter(({ step }) => statusOf(step) === "active" && st(step.id).startedBy === p.name);
        return h("div.team-row", h("div", h("b", p.name), h("div.muted.small", p.chair || "")), h("div.small", `${doneBy} done`, act.length ? h("div.c-blue-t", `◉ ${act.map((x) => x.step.num).join(", ")}`) : null));
      }), h("button.btn.btn-sm", { type: "button", onclick: () => { editingSetup = true; setupWizard.page = "info"; render(); } }, "Edit participants"));
    }
    return h("aside.run-right", h("div.tabs", tabs.map(([k, l]) => h(`button.tab${rightTab === k ? ".on" : ""}${k === "comms" && due ? ".due" : ""}`, { type: "button", dataset: { k }, onclick: () => { rightTab = k; render(); } }, l))), h("div.rr-body", body));
  }

  /* ======================= issue capture ======================= */
  async function issueModal(existing = {}) {
    const isNew = !existing.id;
    const iss = { id: uid("iss"), at: now(), by: me(), status: "open", severity: "medium", evidence: [], stepId: existing.stepId || focusId || "", title: "", what: "", troubleshooting: "", assistance: "", resolution: "", ...clone(existing) };
    const steps = stepsInOrder();
    const thumbs = h("div.thumbs");
    const drawThumbs = () => { thumbs.innerHTML = ""; iss.evidence.forEach((ev, i) => thumbs.append(h("div.thumb-wrap", PR.app.thumb(ev), h("button.thumb-x", { type: "button", title: "Remove", onclick: () => { iss.evidence.splice(i, 1); drawThumbs(); } }, "✕")))); };
    drawThumbs();
    const uploads = new Set();
    const addFiles = (files) => { const p = addFilesNow(files); uploads.add(p); p.finally(() => uploads.delete(p)); return p; };
    const addFilesNow = async (files) => {
      for (const f of files) {
        const blob = f.type && f.type.startsWith("image/") ? PR.u.dataURLToBlob(await PR.u.compressImage(f)) : f;
        iss.evidence.push({ ref: await S().putAttachment(run.id, blob, f.name || "screenshot.jpg"), name: f.name || "screenshot", type: blob.type, at: now(), by: me() });
      }
      drawThumbs();
    };
    const onPaste = (e) => { const fs = [...(e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } };
    document.addEventListener("paste", onPaste);
    const ta = (k, ph, rows = 3) => h("textarea.inp", { rows, placeholder: ph, oninput: (e) => (iss[k] = e.target.value) }, iss[k] || "");
    const whenInp = h("input.inp", { type: "datetime-local", step: 1, value: toLocalInput(iss.at), onchange: (e) => (iss.at = fromLocalInput(e.target.value) || iss.at) });
    const v = await modal({
      title: isNew ? "⚠ Log an issue" : "Issue", size: "lg", subtitle: "Only the title is needed now — fill in the rest when you can. Paste screenshots anywhere with Ctrl+V.",
      onClose: () => document.removeEventListener("paste", onPaste),
      body: h("div.issue-form",
        h("div.frow", h("div.field.grow", h("label.lbl", "What happened? (short title)"), h("input.inp", { value: iss.title, autofocus: true, placeholder: "e.g. FAILOVER.OFFLINE hung on ATM device", oninput: (e) => (iss.title = e.target.value) })),
          h("div.field", h("label.lbl", "Severity"), h("select.inp", { onchange: (e) => (iss.severity = e.target.value) }, ["low", "medium", "high", "critical"].map((s) => h("option", { value: s, selected: iss.severity === s }, s))))),
        h("div.frow", h("div.field.grow", h("label.lbl", "Step"), h("select.inp", { onchange: (e) => (iss.stepId = e.target.value) }, h("option", { value: "" }, "— general —"), steps.map(({ step }) => h("option", { value: step.id, selected: iss.stepId === step.id }, `${step.num} · ${step.title}`)))),
          h("div.field", h("label.lbl", "When it occurred"), whenInp)),
        h("div.field", h("label.lbl", "Details"), ta("what", "What did you see? Error text, codes, which device…")),
        h("div.field", h("label.lbl", "Screenshots / evidence"), thumbs,
          h("div.drop-zone", { tabindex: 0, ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }, onclick: async () => { const f = await PR.u.pickFile("image/*,.pdf,.txt,.log"); if (f) addFiles([f]); } }, "📋 Paste (Ctrl+V), drop, or click to attach")),
        h("div.frow", h("div.field.grow", h("label.lbl", "Troubleshooting performed"), ta("troubleshooting", "What did you try?")), h("div.field.grow", h("label.lbl", "Assistance received"), ta("assistance", "Vendor / person / ticket #"))),
        h("label.ck.rb-check", h("input", { type: "checkbox", checked: !!iss.blocking, onchange: (e) => (iss.blocking = e.target.checked) }), " 🚧 Roadblock — this is blocking progress (shown on the live dashboard with a timer until resolved)"),
        h("div.frow", h("div.field.grow", h("label.lbl", "Resolution"), ta("resolution", "How was it resolved?")),
          h("div.field", h("label.lbl", "Status"), h("select.inp", { onchange: (e) => (iss.status = e.target.value) }, h("option", { value: "open", selected: iss.status !== "resolved" }, "Open"), h("option", { value: "resolved", selected: iss.status === "resolved" }, "Resolved"))))),
      actions: [isNew ? null : { label: "Delete", kind: "danger-o", value: "delete" }, { spacer: true }, { label: "Cancel", value: null }, { label: isNew ? "Save issue" : "Save", kind: "primary", value: "save" }].filter(Boolean),
    });
    if (v === "delete") { if (await confirmBox("Delete issue?", "This removes it from the run record.", { ok: "Delete", kind: "danger" })) commit([{ op: "set", path: ["issues", iss.id], value: null }], { event: { type: "issue", stepId: iss.stepId, text: `Deleted issue: ${iss.title}` } }); return; }
    if (v !== "save") return;
    if (uploads.size) { toast("Finishing screenshot upload…", "info", 1200); await Promise.allSettled([...uploads]); }
    if (!iss.title.trim()) iss.title = iss.what ? iss.what.split("\n")[0].slice(0, 80) : "Issue";
    if (iss.status === "resolved" && !iss.resolvedAt) { iss.resolvedAt = now(); iss.resolvedBy = me(); }
    if (iss.status !== "resolved") { iss.resolvedAt = null; }
    commit([{ op: "set", path: ["issues", iss.id], value: iss }], { event: { type: "issue", stepId: iss.stepId, text: `${isNew ? "Issue logged" : "Issue updated"}: ${iss.title}${iss.status === "resolved" ? " (resolved)" : ""}` } });
    toast(isNew ? "Issue logged" : "Issue saved", "ok");
  }

  /* ======================= comms ======================= */
  function allComms() {
    const out = [];
    stepsInOrder().forEach(({ step }) => (step.blocks || []).filter((b) => b.type === "contact").forEach((b) => {
      const v = (st(step.id).values || {})[b.id] || {};
      out.push({ src: "step", step, who: b.who, method: b.method, detail: M().interpolate(b.detail || "", ctx(), false), request: M().interpolate(b.request || "", ctx(), false), at: v.contactedAt, by: v.by, confirmed: v.confirmedAt ? true : v.confirmed === false ? false : null, confirmedAt: v.confirmedAt, reference: v.reference, response: v.response });
    }));
    Object.values(run.comms || {}).forEach((c) => out.push({ src: "log", ...c, step: c.stepId ? (M().findStep(proc, c.stepId) || {}).step : null }));
    return out.sort((a, b) => (a.at || Infinity) - (b.at || Infinity));
  }
  async function commsModal() {
    const draw = (box) => {
      box.innerHTML = "";
      const rows = allComms();
      box.append(h("table.mini.comms", h("thead", h("tr", ["When", "Step", "Who", "How", "Request", "By", "Confirmation", ""].map((x) => h("th", x)))),
        h("tbody", rows.map((c) => h(`tr${c.at ? "" : ".muted"}`, h("td", c.at ? fmtTime(c.at) : "not yet"), h("td", c.step ? c.step.num : "—"), h("td", h("b", c.who || ""), c.detail ? h("div.small.muted", c.detail) : null),
          h("td", PR.blocks.def("contact").methodLabel(c.method)), h("td.small", c.request || ""), h("td", c.by || ""),
          h("td", c.confirmedAt ? `✓ ${fmtTime(c.confirmedAt)}` : c.confirmed === false ? "✕ none" : c.at ? "pending" : ""),
          h("td", c.src === "log" && !c.confirmedAt ? h("button.mini-btn", { type: "button", onclick: () => { commit([{ op: "merge", path: ["comms", c.id], value: { confirmedAt: now(), confirmed: true } }], { render: false }); draw(box); } }, "Confirmed") : null))))));
    };
    const box = h("div");
    draw(box);
    const f = { who: "", method: "phone", request: "", stepId: focusId || "", confirmed: false };
    const form = h("div.comms-form",
      h("div.ins-sec", "Log a contact"),
      h("div.frow", h("div.field.grow", h("label.lbl", "Who"), h("input.inp", { list: "commsContacts", oninput: (e) => (f.who = e.target.value) })),
        h("div.field", h("label.lbl", "How"), h("select.inp", { onchange: (e) => (f.method = e.target.value) }, PR.blocks.METHODS.map(([v, l]) => h("option", { value: v }, l)))),
        h("div.field.grow", h("label.lbl", "What was requested"), h("input.inp", { oninput: (e) => (f.request = e.target.value) }))),
      h("label.ck", h("input", { type: "checkbox", onchange: (e) => (f.confirmed = e.target.checked) }), " Confirmation already received"),
      h("datalist#commsContacts", proc.contacts.map((c) => h("option", { value: c.name }))));
    await modal({
      title: "☎ Communication & handoffs", size: "xl", body: h("div", box, form),
      actions: [{ spacer: true }, { label: "Close", value: null }, { label: "Add entry", kind: "primary", onClick: () => {
        if (!f.who.trim()) return false;
        const id = uid("cm");
        commit([{ op: "set", path: ["comms", id], value: { id, at: now(), by: me(), who: f.who, method: f.method, request: f.request, stepId: f.stepId, confirmed: f.confirmed || null, confirmedAt: f.confirmed ? now() : null } }], { render: false, event: { type: "comms", text: `Contacted ${f.who}${f.request ? ": " + f.request : ""}` } });
        draw(box); toast("Logged", "ok", 1000); return false;
      } }],
    });
    render();
  }

  /* ======================= setup wizard ======================= */
  function setupWizard() {
    const su = run.setup; const env = proc.environments;
    const directional = env.enabled && env.directional && M().sites(proc).length === 2;
    const set = (path, value, renderIt = false) => commit([{ op: "set", path: ["setup", ...path], value }], { render: renderIt });
    const pagesAll = [
      ["info", "1", "Exercise details"],
      directional ? ["dir", "2", "Failover direction"] : null,
      env.enabled ? ["verify", "3", "Verify environments"] : null,
      proc.setup.readiness.length ? ["ready", "4", "Readiness"] : null,
      ["go", "✓", "Review & start"],
    ].filter(Boolean);
    let page = setupWizard.page && pagesAll.some((p) => p[0] === setupWizard.page) ? setupWizard.page : "info";
    const goPage = (p) => { setupWizard.page = p; render(); };
    const idx = pagesAll.findIndex((p) => p[0] === page);
    const nav = h("div.wz-nav", pagesAll.map(([k, n, l], i) => h(`button.wz-step${k === page ? ".on" : ""}${wizardDone(k) ? ".done" : ""}`, { type: "button", onclick: () => goPage(k) }, h("span.wz-n", wizardDone(k) ? "✓" : String(i + 1)), l)));
    const footer = h("div.wz-foot",
      idx > 0 ? h("button.btn", { type: "button", onclick: () => goPage(pagesAll[idx - 1][0]) }, "← Back") : h("a.btn.btn-ghost", { href: "#/" }, "Cancel"),
      h("div.spacer"),
      idx < pagesAll.length - 1 ? h("button.btn.btn-primary", { type: "button", onclick: () => goPage(pagesAll[idx + 1][0]) }, "Next →") : null);
    const body = h("div.wz-body", SETUP_PAGES[page]({ su, env, set, directional, goPage }));
    return h("div.wizard",
      h("div.wz-head", h("a.icon-btn", { href: "#/" }, "←"), h("div", h("div.wz-title", "Set up run"), h("div.muted", `${run.procTitle} · ${run.procVersion === "draft" ? "draft (practice)" : "v" + run.procVersion}`))),
      h("div.wz-main", nav, h("div.wz-panel", body, footer)));
  }
  function wizardDone(k) {
    const su = run.setup;
    if (k === "info") return !!(su.exerciseDate && (!proc.setup.requireChangeId || su.changeId) && (su.participants || []).some((p) => p.name));
    if (k === "dir") return !!(su.primarySiteId && su.directionChosen);
    if (k === "verify") return !!su.verification;
    if (k === "ready") return proc.setup.readiness.every((r) => su.readiness && su.readiness[r.id] && su.readiness[r.id].done);
    return false;
  }
  function mappingTable(primaryId) {
    const env = proc.environments;
    return h("table.map-table", h("thead", h("tr", h("th", "Physical datacenter"), h("th", "HMC partition label (fixed)"), h("th", "Logical role now"), h("th", "Role after failover"))),
      h("tbody", M().sites(proc).map((s) => {
        const role = s.id === primaryId ? "primary" : "secondary"; const r = env.roles[role]; const after = role === "primary" ? env.roles.secondary : env.roles.primary;
        return h("tr", h("td", PR.ui.envBadge({ kind: "site", title: s.name, code: s.code, color: s.color }, { size: "md", showRole: false })), h("td", h("code", s.partition || "—")),
          h("td", h("b", r.pre), r.hostname ? h("span.muted", ` · ${r.hostname}`) : null), h("td", h("b", r.post), after.hostname ? h("span.muted", ` · ${after.hostname}`) : null));
      })));
  }
  const SETUP_PAGES = {
    info: ({ su, set }) => {
      const parts = su.participants || [];
      const chairs = proc.setup.chairs;
      const drawParts = () => h("div.parts", parts.map((p, i) => h("div.part-row",
        h("input.inp", { value: p.name, list: "peopleList", placeholder: "Name", onchange: (e) => { parts[i].name = e.target.value; set(["participants"], parts); } }),
        h("select.inp", { onchange: (e) => { parts[i].chair = e.target.value; set(["participants"], parts); } }, h("option", { value: "" }, "— chair / role —"), chairs.map((c) => h("option", { value: c, selected: p.chair === c }, c))),
        M().tracks(proc).length ? h("select.inp", { title: "Which chair's steps this person works", onchange: (e) => { parts[i].track = e.target.value; set(["participants"], parts); } }, h("option", { value: "" }, "All chairs"), M().tracks(proc).map((t) => h("option", { value: t.id, selected: p.track === t.id }, t.name))) : null,
        h("button.icon-btn.danger", { type: "button", title: "Remove", onclick: () => { parts.splice(i, 1); set(["participants"], parts, true); } }, "✕"))),
      h("button.btn.btn-sm", { type: "button", onclick: () => { parts.push({ id: uid("pp"), name: "", chair: "" }); set(["participants"], parts, true); } }, "＋ Add participant"));
      const needAp = acfg().enforced || stepsInOrder().some(({ step }) => M().needsApproval(step));
      const apField = needAp ? h("div.field.ap-setup",
        h("label.lbl", "Approver(s) for this run", run.practice ? null : h("span.req", " *")),
        h("input.inp", { value: (su.approvers || []).join(", "), list: "peopleList", placeholder: "e.g. Pat Manager (separate several with commas)",
          onchange: (e) => set(["approvers"], e.target.value.split(",").map((x) => x.trim()).filter(Boolean), true) }),
        h("div.help", `This procedure has ${stepsInOrder().filter(({ step }) => M().needsApproval(step)).length} sign-off / Go-No-Go step(s)${acfg().enforced ? " and approvals can't be bypassed" : ""}. `,
          approverNames().length ? ["Approvers: ", h("b", approverNames().join(", ")), " — they're notified when their approval is needed."] : run.practice ? "Practice run: leave empty to approve your own steps." : "Name who approves, or add a participant in the Approver chair.")) : null;
      return h("div",
        h("h2", "Exercise details"), h("p.muted", "Recorded on the run report."),
        h("div.field", h("label.lbl", "Run name"), h("input.inp", { value: run.name, onchange: (e) => commit([{ op: "set", path: ["name"], value: e.target.value }], { render: false }) })),
        h("div.frow", h("div.field", h("label.lbl", "Exercise date"), h("input.inp", { type: "date", value: su.exerciseDate, onchange: (e) => set(["exerciseDate"], e.target.value) })),
          h("div.field.grow", h("label.lbl", "Change / exercise ID", proc.setup.requireChangeId ? h("span.req", " *") : null), h("input.inp", { value: su.changeId, placeholder: "e.g. CR-2423", onchange: (e) => set(["changeId"], e.target.value) }))),
        h("div.frow", h("div.field", h("label.lbl", "Maintenance window start"), h("input.inp", { type: "datetime-local", value: su.windowStart || "", onchange: (e) => set(["windowStart"], e.target.value) })),
          h("div.field", h("label.lbl", "Window end"), h("input.inp", { type: "datetime-local", value: su.windowEnd || "", onchange: (e) => set(["windowEnd"], e.target.value) }))),
        h("div.field", h("label.lbl", "Expected impact (used in communications)"), h("input.inp", { value: su.impact || "", placeholder: "e.g. Online & mobile banking, ATMs and branch systems briefly unavailable", onchange: (e) => set(["impact"], e.target.value) })),
        h("div.field", h("label.lbl", "Participants & chairs"), drawParts()),
        apField,
        h("div.help", "Everyone joining opens this run from the library on their own PC (shared mode) and sets their name — each click is stamped with who did it."));
    },
    dir: ({ su, set }) => {
      const sites = M().sites(proc);
      return h("div",
        h("h2", "Which way are we failing over?"), h("p.muted", "Pick the datacenter that is primary right now. Every step will show its physical datacenter and HMC partition from this choice."),
        h("div.dir-cards", sites.map((s) => {
          const other = M().otherSite(proc, s.id);
          return h(`button.dir-card${su.directionChosen && su.primarySiteId === s.id ? ".on" : ""}`, { type: "button", onclick: () => { commit([{ op: "set", path: ["setup", "primarySiteId"], value: s.id }, { op: "set", path: ["setup", "directionChosen"], value: { by: me(), at: now() } }, ...(su.verification && su.primarySiteId !== s.id ? [{ op: "set", path: ["setup", "verification"], value: null }] : [])]); } },
            h("div.dc-flow", h("span", { style: { color: s.color } }, s.name), h("span.dc-arrow", "→"), h("span", { style: { color: other.color } }, other.name)),
            h("div.muted.small", `${s.name} is primary now · fail over to ${other.name}`));
        })),
        su.primarySiteId && su.directionChosen ? [h("h3", "Resulting mapping"), mappingTable(su.primarySiteId)] : h("div.banner.b-info.sm", "Choose a direction above — it isn't pre-selected, so nobody starts a failover on an assumption."));
    },
    verify: ({ su, set, directional }) => {
      let who;
      const v = su.verification;
      return h("div",
        h("h2", "Verify the environment mapping"), h("p.muted", "A second person confirms the physical datacenters, fixed HMC partition labels and logical roles before anyone touches a system."),
        directional && !su.directionChosen ? h("div.banner.b-warn.sm", "Choose the failover direction first.", h("div.spacer"), h("button.mini-btn", { type: "button", onclick: () => goPage("dir") }, "Choose")) :
        directional ? mappingTable(su.primarySiteId) : h("div", M().sites(proc).map((s) => PR.ui.envBadge({ kind: "site", title: s.name, code: s.code, partition: s.partition, color: s.color }))),
        v ? h("div.banner.b-ok", `✓ Mapping verified by ${v.by} at ${fmtDateTime(v.at)}${v.note ? " — " + v.note : ""}`, h("div.spacer"), h("button.btn.btn-sm", { type: "button", onclick: () => { set(["verification"], null, true); } }, "Redo")) :
          h("div.verify-box",
            h("label.ck", h("input.vchk", { type: "checkbox" }), " Physical datacenters are correct"),
            h("label.ck", h("input.vchk", { type: "checkbox" }), " HMC partition labels match what I see in each HMC"),
            directional ? h("label.ck", h("input.vchk", { type: "checkbox" }), " Logical roles (Primary / Secondary) are correct for today") : null,
            h("div.frow", h("div.field.grow", h("label.lbl", "Verified by"), who = h("input.inp", { list: "peopleList", value: (su.participants || []).map((p) => p.name).find((n) => n && n !== me()) || me() })),
              h("div.field.grow", h("label.lbl", "Note"), h("input.inp#vnote", { placeholder: "Optional" }))),
            h("button.btn.btn-primary", { type: "button", onclick: () => {
              if (directional && !su.directionChosen) return toast("Choose the failover direction first", "warn");
              if ($$(".vchk").some((c) => !c.checked)) return toast("Tick every check first", "warn");
              set(["verification"], { by: who.value || me(), at: now(), note: $("#vnote").value, primarySiteId: su.primarySiteId }, true);
              commit([], { render: false, event: { type: "verify", text: `Environment mapping verified by ${who.value || me()}` } });
            } }, "✓ Record verification")));
    },
    ready: ({ su, set }) => h("div",
      h("h2", "Pre-run readiness"), h("p.muted", "Backups, transfers, replication, approvals. Each tick is stamped with who and when."),
      h("div.ready-list", proc.setup.readiness.map((r) => {
        const v = (su.readiness || {})[r.id] || {};
        return h(`div.ready-row${v.done ? ".on" : ""}`,
          h("label.ck", h("input", { type: "checkbox", checked: !!v.done, onchange: (e) => set(["readiness", r.id], e.target.checked ? { ...v, done: true, by: me(), at: now() } : { ...v, done: false }, true) }), " ", h("b", r.label)),
          v.done ? h("span.stamp", `${v.by} · ${fmtTime(v.at)}`) : null,
          h("input.inp.sm", { placeholder: "Note / evidence (e.g. backup ID, approver)", value: v.note || "", onchange: (e) => set(["readiness", r.id], { ...v, note: e.target.value }) }));
      }))),
    go: ({ su, env, directional, goPage }) => {
      const warn = [];
      if (proc.setup.requireChangeId && !su.changeId) warn.push(["info", "Change / exercise ID is required"]);
      if (!(su.participants || []).some((p) => p.name)) warn.push(["info", "Add at least one participant"]);
      const apSteps = stepsInOrder().filter(({ step }) => M().needsApproval(step)).length;
      if ((acfg().enforced || apSteps) && !run.practice && !approverNames().length) warn.push(["info", `Name the approver for this run — ${apSteps ? `${apSteps} step(s) need a sign-off or Go / No-Go` : "this procedure requires approvals"}`]);
      else if (acfg().enforced && !run.practice && approverNames().every((n) => M().sameName(n, me()))) warn.push(["info", "You can't approve your own steps in this procedure — add another approver"]);
      if (directional && !(su.primarySiteId && su.directionChosen)) warn.push(["dir", "Choose the failover direction"]);
      if (env.enabled && proc.setup.requireVerification && !su.verification) warn.push(["verify", "Environment mapping has not been verified"]);
      if (su.verification && su.verification.primarySiteId && su.verification.primarySiteId !== su.primarySiteId) warn.push(["verify", "Direction changed after verification — verify again"]);
      const notReady = proc.setup.readiness.filter((r) => !(su.readiness && su.readiness[r.id] && su.readiness[r.id].done));
      const blocking = warn.length > 0;
      return h("div",
        h("h2", "Review & start"),
        h("table.kv", h("tbody",
          h("tr", h("th", "Run"), h("td", run.name)), h("tr", h("th", "Date"), h("td", su.exerciseDate)), h("tr", h("th", "Change ID"), h("td", su.changeId || "—")),
          approverNames().length ? h("tr", h("th", "Approvers"), h("td", approverNames().join(", "))) : null,
          h("tr", h("th", "Participants"), h("td", (su.participants || []).filter((p) => p.name).map((p) => `${p.name}${p.chair ? " (" + p.chair + ")" : ""}`).join(", "))),
          directional ? h("tr", h("th", "Direction"), h("td", h("b", M().directionLabel(proc, su)))) : null,
          env.enabled ? h("tr", h("th", "Verified"), h("td", su.verification ? `${su.verification.by} at ${fmtTime(su.verification.at)}` : "—")) : null,
          proc.setup.readiness.length ? h("tr", h("th", "Readiness"), h("td", `${proc.setup.readiness.length - notReady.length}/${proc.setup.readiness.length} confirmed`)) : null)),
        warn.map(([p, w]) => h("div.banner.b-warn.sm", "⚠ ", w, h("div.spacer"), h("button.mini-btn", { type: "button", onclick: () => goPage(p) }, "Fix"))),
        h("div.wz-comms#wzComms"),
        notReady.length ? h("div.banner.b-info.sm", `${notReady.length} readiness item(s) not confirmed: ${notReady.map((r) => r.label).join(", ")}. You can start anyway — it's recorded.`) : null,
        h("button.btn.btn-primary.btn-xl", { type: "button", disabled: blocking, onclick: async () => {
          if (notReady.length && !(await confirmBox("Start with open readiness items?", `${notReady.length} item(s) are not confirmed. Starting anyway is recorded in the run log.`, { ok: "Start anyway" }))) return;
          const resume = editingSetup;
          editingSetup = false;
          const ops = [{ op: "set", path: ["directionLabel"], value: M().directionLabel(proc, su) || null }];
          if (!resume) ops.push({ op: "set", path: ["status"], value: "active" }, { op: "set", path: ["startedAt"], value: run.startedAt || now() });
          commit(ops,
            { event: { type: resume ? "setup" : "begin", text: resume ? "Run setup updated" : `Run started${directional ? " — " + M().directionLabel(proc, su) : ""}${notReady.length ? ` with ${notReady.length} open readiness item(s)` : ""}` } });
          PR.app.rememberPeople((su.participants || []).map((p) => p.name));
          focusId = focusId || firstOpen();
          render();
          if (!resume && hasTracks()) setTimeout(() => chooseChair(), 50);
        } }, editingSetup ? "Save & return to run" : "▶ Begin run"));
    },
  };

  /* ======================= completion & lessons ======================= */
  /* Run sheets: one screen, one click — what was captured, anything left, an optional note. */
  async function quickFinish() {
    const pg = progressOf();
    const remaining = stepsInOrder().filter(({ step, section }) => inMyChair(step, section) && ["pending", "active"].includes(statusOf(step)));
    const openIss = Object.values(run.issues || {}).filter((i) => i.status !== "resolved");
    const captured = [];
    stepsInOrder().forEach(({ step }) => (step.blocks || []).forEach((b) => { const v = (st(step.id).values || {})[b.id]; if (b.type === "input" && v && String(v.value || "").trim()) captured.push([b.label, v.value]); }));
    let note;
    const v = await modal({ title: `Complete ${run.name}?`, size: "md", enter: true,
      body: h("div",
        h("div.fin-stats", stat("Time", run.startedAt ? fmtDur(now() - run.startedAt) : "—"), stat("Done", `${pg.done}/${pg.total}`), stat("Open issues", String(openIss.length))),
        remaining.length ? h("div.banner.b-warn.sm", `${remaining.length} step(s) not finished (${remaining.map((x) => x.step.num).join(", ")}) — they'll be marked “not done”.`) : null,
        captured.length ? h("table.kv.qs-cap", h("tbody", captured.map(([k, val]) => h("tr", h("th", k), h("td", String(val)))))) : null,
        h("div.field", h("label.lbl", "Note for the next person (optional)"), note = h("input.inp", { autofocus: true, placeholder: "e.g. Periodic mortgage download not found — ticket opened" }))),
      actions: [{ spacer: true }, { label: "Keep working", value: null }, { label: "✓ Complete run sheet", kind: "primary", value: "done" }] });
    if (v !== "done") return;
    const comp = { outcome: openIss.length || remaining.length ? "Successful with issues" : "Successful", authorizedBy: me(), authorizedAt: now(), summary: note.value.trim(), milestones: {} };
    const ops = [{ op: "set", path: ["completion"], value: comp }];
    // Improvement notes and issues become lessons, so the next run shows them on the step ("did it work?")
    if (!Object.keys(run.lessons || {}).length) {
      const lessons = {};
      Object.values(run.notes || {}).forEach((n) => { const id = uid("ls"); lessons[id] = { id, kind: "change", text: n.text, stepId: n.stepId, owner: "", verifyNext: true, status: "open", from: "note" }; });
      Object.values(run.issues || {}).forEach((i) => { const id = uid("ls"); lessons[id] = { id, kind: "wrong", text: i.title + (i.resolution ? ` — resolved: ${i.resolution}` : ""), stepId: i.stepId, owner: "", verifyNext: false, status: "open", from: "issue" }; });
      if (Object.keys(lessons).length) ops.push({ op: "set", path: ["lessons"], value: lessons });
    }
    remaining.forEach(({ step }) => ops.push({ op: "merge", path: ["steps", step.id], value: { status: "skipped", skipReason: "Not done at close-out", finishedAt: now(), finishedBy: me() } }));
    ops.push({ op: "set", path: ["status"], value: "completed" }, { op: "set", path: ["completedAt"], value: now() });
    commit(ops, { render: false, event: { type: "complete-run", text: `Run sheet completed by ${me()} — ${comp.outcome}${comp.summary ? " · " + comp.summary : ""}` } });
    await drain();
    PR.app.go(`#/report/${run.id}`);
  }
  const useQuickFinish = () => M().runOptions(proc).quickFinish && !acfg().enforced && !hasTracks();
  async function finishWizard() {
    if (useQuickFinish()) return quickFinish();
    const pg = progressOf();
    const unsigned = M().tracks(proc).filter((t) => !M().trackProgress(run, t.id).signoff);
    let override = false, overrideWhy = "";
    const remaining = stepsInOrder().filter(({ step }) => ["pending", "active"].includes(statusOf(step)));
    const openIss = Object.values(run.issues || {}).filter((i) => i.status !== "resolved");
    const unreliable = Object.values(run.steps || {}).filter((s) => s.timing === "unavailable").length;
    const comp = { outcome: openIss.length ? "Successful with issues" : "Successful", milestones: {}, authorizedBy: "", summary: "", ...clone(run.completion || {}) };
    const lessons = clone(run.lessons || {});
    // Seed lessons from improvement notes and issues the first time.
    if (!Object.keys(lessons).length) {
      Object.values(run.notes || {}).forEach((n) => { const id = uid("ls"); lessons[id] = { id, kind: "change", text: n.text, stepId: n.stepId, owner: "", verifyNext: true, status: "open", from: "note" }; });
      Object.values(run.issues || {}).forEach((i) => { const id = uid("ls"); lessons[id] = { id, kind: "wrong", text: i.title + (i.resolution ? ` — resolved: ${i.resolution}` : ""), stepId: i.stepId, owner: "", verifyNext: false, status: "open", from: "issue" }; });
    }
    let markRest = remaining.length > 0;
    // Enforced procedures: an approver signs off the close-out before the run can be completed
    const enf = acfg().enforced;
    const closeReq = () => latestReq(null, null);
    const closeBox = h("div.ap-close#closeGate");
    const drawClose = () => {
      if (!enf) return;
      const r = closeReq();
      closeBox.innerHTML = "";
      closeBox.append(h("div.ins-sec", "Close-out approval"),
        !r || r.status === "rejected" ? h("div.ap-panel.ap-idle",
          r ? h("div", "✕ Rejected by ", h("b", r.decidedBy), r.comment ? ` — ${r.comment}` : "") : h("div", "This procedure needs ", h("b", whoLabel(approverNames())), " to approve the close-out."),
          h("div.ap-acts", h("button.btn.btn-sm.btn-primary", { type: "button", onclick: () => { requestApproval(null, null, `Outcome: ${comp.outcome} · ${progressOf().done}/${progressOf().total} steps done${remaining.length ? ` · ${remaining.length} not finished` : ""}${openIss.length ? ` · ${openIss.length} open issue(s)` : ""}`, "closeout"); drawClose(); } }, "Request close-out approval")))
          : approvalPanel(null, null, r));
      if (r && r.status === "approved") { comp.authorizedBy = r.decidedBy; const a = $("#authBy"); if (a) { a.value = r.decidedBy; a.disabled = true; } }
    };
    drawClose();
    const closeT = enf ? setInterval(drawClose, 2500) : null;
    const stepOpts = () => [h("option", { value: "" }, "— general —"), ...stepsInOrder().map(({ step }) => h("option", { value: step.id }, `${step.num} ${step.title}`.slice(0, 50)))];
    const lessonBox = h("div");
    const drawLessons = () => {
      lessonBox.innerHTML = "";
      [["wrong", "What went wrong"], ["worked", "What worked"], ["change", "What we'll change"]].forEach(([k, title]) => {
        const items = Object.values(lessons).filter((l) => l.kind === k);
        lessonBox.append(h("div.ls-col", h("div.ls-h", title, h("button.mini-btn", { type: "button", onclick: () => { const id = uid("ls"); lessons[id] = { id, kind: k, text: "", stepId: "", owner: "", verifyNext: k === "change", status: "open" }; drawLessons(); } }, "＋ Add")),
          items.map((l) => h("div.ls-row",
            h("textarea.inp", { rows: 2, placeholder: "Describe…", oninput: (e) => (l.text = e.target.value) }, l.text),
            h("div.frow", h("select.inp.sm", { onchange: (e) => (l.stepId = e.target.value) }, stepOpts().map((o) => { if (o.value === l.stepId) o.selected = true; return o; })),
              k === "change" ? h("input.inp.sm", { placeholder: "Owner", list: "peopleList", value: l.owner, oninput: (e) => (l.owner = e.target.value) }) : null,
              k === "change" ? h("label.ck.sm", { title: "Show on this step in the next run and ask whether it worked" }, h("input", { type: "checkbox", checked: l.verifyNext, onchange: (e) => (l.verifyNext = e.target.checked) }), " check next run") : null,
              h("button.icon-btn.xs.danger", { type: "button", onclick: () => { delete lessons[l.id]; drawLessons(); } }, "✕"))))));
      });
    };
    drawLessons();
    const priorBox = priorLessons.length ? h("div", h("div.ins-sec", "Changes from previous runs"), priorLessons.map((p) => { const v = (run.carried || {})[`${p.runId}:${p.lesson.id}`]; return h("div.prior", h("div", p.lesson.text), v ? h("span.done-pill", v.result.replace("_", " ")) : h("span.muted.small", "not checked during this run")); })) : null;
    const v = await modal({
      title: "🏁 Close out the run", size: "xl",
      body: h("div.finish",
        hasTracks() ? h("div#trackGate.track-gate", h("div.ins-sec", "Chairs — every chair must sign off before the master run can be completed"),
          M().tracks(proc).map((t) => { const tp = M().trackProgress(run, t.id); return h(`div.tg-row${tp.signoff ? ".ok" : ""}`, { style: { "--c": t.color } }, h("b", t.name), h("span.muted.small", t.desc || ""), h("div.spacer"), h("span.small", `${tp.done}/${tp.total} steps`),
            tp.signoff ? h("span.done-pill", `✓ ${tp.signoff.by} · ${fmtTime(tp.signoff.at, false)}`) : h("span.chip.c-amber", "Not signed off")); }),
          unsigned.length ? h("div.tg-override", h("label.ck", h("input", { type: "checkbox", onchange: (e) => (override = e.target.checked) }), " Close without every chair's sign-off (emergency)"),
            h("input.inp", { placeholder: "Reason (required, recorded in the report)", oninput: (e) => (overrideWhy = e.target.value) })) : null) : null,
        enf ? closeBox : null,
        h("div.fin-stats", stat("Elapsed", run.startedAt ? fmtDur(now() - run.startedAt) : "—"), stat("Steps finished", `${pg.done}/${pg.total}`), stat("Open issues", String(openIss.length)), stat("Timing unreliable", String(unreliable))),
        remaining.length ? h("div.banner.b-warn.sm", `${remaining.length} step(s) not finished (${remaining.slice(0, 8).map((x) => x.step.num).join(", ")}${remaining.length > 8 ? "…" : ""}). `,
          h("label.ck", h("input", { type: "checkbox", checked: markRest, onchange: (e) => (markRest = e.target.checked) }), " mark them skipped (“not performed at close-out”)")) : null,
        proc.setup.milestones.length ? [h("div.ins-sec", "Operational milestones"), h("div.ms-list", proc.setup.milestones.map((m) => h("label.ck", h("input", { type: "checkbox", checked: !!(comp.milestones[m.id] && comp.milestones[m.id].done), onchange: (e) => (comp.milestones[m.id] = e.target.checked ? { done: true, at: now(), by: me() } : null) }), " ", m.label)))] : null,
        openIss.length ? [h("div.ins-sec", "Remaining issues"), h("div", openIss.map((i) => h("div.mini-issue.open", "⚠ ", h("b", i.title), ` — ${i.what || ""}`)))] : null,
        h("div.frow",
          h("div.field", h("label.lbl", "Final outcome"), h("select.inp", { onchange: (e) => (comp.outcome = e.target.value) }, ["Successful", "Successful with issues", "Partially completed", "Rolled back", "Aborted"].map((o) => h("option", { value: o, selected: comp.outcome === o }, o)))),
          h("div.field.grow", h("label.lbl", "Completion authorized by", h("span.req", " *")), h("input.inp#authBy", { list: "peopleList", value: comp.authorizedBy, oninput: (e) => (comp.authorizedBy = e.target.value) }))),
        h("div.field", h("label.lbl", "Summary / remaining work"), h("textarea.inp", { rows: 3, oninput: (e) => (comp.summary = e.target.value) }, comp.summary)),
        h("div.ins-sec", "Lessons learned"), h("div.help", "Pre-filled from improvement notes and issues captured during the run. Items marked “check next run” appear on that step next time with a “did it work?” prompt."),
        h("div.ls-grid", lessonBox), priorBox),
      actions: [{ spacer: true }, { label: "Save draft", value: "draft" }, { label: "Complete run", kind: "primary", onClick: () => {
        if (unsigned.length && !(override && overrideWhy.trim())) { toast(`Waiting on sign-off: ${unsigned.map((t) => t.name).join(", ")}`, "warn", 4000); const o = $("#trackGate"); o && o.scrollIntoView({ block: "center" }); return false; }
        if (enf && !run.practice && (closeReq() || {}).status !== "approved") { toast(`Close-out needs approval from ${whoLabel(approverNames())} — this procedure doesn't allow it to be bypassed`, "err", 5000); closeBox.scrollIntoView({ block: "center" }); return false; }
        if (!comp.authorizedBy.trim()) { const a = $("#authBy"); a.classList.add("err"); a.focus(); toast("Who authorized completion?", "warn"); return false; } }, value: "done" }],
    });
    clearInterval(closeT);
    if (!v) return;
    const ops = [{ op: "set", path: ["completion"], value: comp }, { op: "set", path: ["lessons"], value: Object.fromEntries(Object.entries(lessons).filter(([, l]) => l.text && l.text.trim())) }];
    if (v === "done") {
      comp.authorizedAt = now();
      if (markRest) remaining.forEach(({ step }) => ops.push({ op: "merge", path: ["steps", step.id], value: { status: "skipped", skipReason: "Not performed at close-out", finishedAt: now(), finishedBy: me() } }));
      if (unsigned.length && override) comp.chairOverride = { reason: overrideWhy, by: me(), at: now(), unsigned: unsigned.map((t) => t.name) };
      ops.push({ op: "set", path: ["status"], value: comp.outcome === "Aborted" ? "aborted" : "completed" }, { op: "set", path: ["completedAt"], value: now() });
    }
    commit(ops, { render: false, event: v === "done" ? { type: "complete-run", text: `Run completed — ${comp.outcome}, authorized by ${comp.authorizedBy}` } : null });
    await drain();
    if (v === "done") PR.app.go(`#/report/${run.id}`); else { toast("Close-out draft saved", "ok"); render(); }
  }
  const stat = (k, v) => h("div.stat", h("div.stat-v", v), h("div.stat-k", k));

  /* ======================= keyboard ======================= */
  function onKey(e) {
    if (!run || run.status === "setup" || editingSetup || PR.u.topModalOpen() || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    const inCard = a && a.closest && a.closest(".fcard .fc-blocks");
    // Inside a step's components: Enter saves the field / ticks the box and moves to the next item
    if (e.key === "Enter" && inCard && !e.shiftKey) {
      const tag = a.tagName;
      if (tag === "TEXTAREA" && !e.ctrlKey) return; // new line; Ctrl+Enter moves on
      if (tag === "BUTTON" || (tag === "INPUT" && a.type === "checkbox") || a.classList.contains("drop-zone")) {
        e.preventDefault(); const id = focusId; if (a.classList.contains("drop-zone")) { actionables(id); passed.keys.add(ctlKey(a)); } a.click(); setTimeout(() => { if (!PR.u.topModalOpen()) guideNext(id); }, 60); return;
      }
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        e.preventDefault(); const id = focusId; actionables(id); passed.keys.add(ctlKey(a)); a.blur(); setTimeout(() => { if (deferRender) render(); guideNext(id); }, 60); return;
      }
    }
    if (e.ctrlKey) return;
    if (PR.u.isTyping(e)) { if (e.key === "Escape") document.activeElement.blur(); return; }
    // A focused button anywhere else (e.g. a menu or "Start in parallel") handles Enter itself
    if (e.key === "Enter" && a && a.tagName === "BUTTON" && !a.classList.contains("act-primary") && $("#run") && $("#run").contains(a)) return;
    const all = stepsInOrder().filter(({ step, section }) => visible(step, section));
    const i = all.findIndex((x) => x.step.id === focusId);
    switch (e.key) {
      case "Enter": {
        e.preventDefault(); if (!focusId) break;
        const stt = statusOf(M().findStep(proc, focusId).step);
        if (e.shiftKey) { if (stt === "pending") startStep(focusId); else if (stt === "active") completeStep(focusId); break; }
        if (stt === "pending") startStep(focusId, { guide: true });
        else if (stt === "active") { if (!guideNext(focusId, { fromStart: true })) completeStep(focusId); }
        break;
      }
      case "ArrowDown": case "j": e.preventDefault(); if (all[i + 1]) setFocus(all[i + 1].step.id); break;
      case "ArrowUp": case "k": e.preventDefault(); if (i > 0) setFocus(all[i - 1].step.id); break;
      case "i": case "I": e.preventDefault(); issueModal({ stepId: focusId }); break;
      case "n": case "N": e.preventDefault(); { const n = $("#noteInp"); n && n.focus(); } break;
      case "s": case "S": e.preventDefault(); if (focusId && ["pending", "active"].includes(statusOf(M().findStep(proc, focusId).step))) skipStep(focusId); break;
      case "t": case "T": e.preventDefault(); { const b = $(`.fcard[data-fc="${focusId}"] .tm-start`); if (b) b.click(); else { const f = M().findStep(proc, focusId); f && f.step.blocks.some((x) => x.type === "timer") && timerGate(f.step, f.step.blocks.find((x) => x.type === "timer")); } } break;
      case "c": case "C": e.preventDefault(); commsModal(); break;
      case "a": case "A": e.preventDefault(); if (focusId && ["pending", "active"].includes(statusOf(M().findStep(proc, focusId).step))) addAdhocApproval(focusId); break;
      case "l": case "L": e.preventDefault(); mode = mode === "lanes" ? "list" : "lanes"; PR.app.LS.set("runMode", mode); render(); break;
      case "?": e.preventDefault(); keysHelp(); break;
      case "g": case "G": e.preventDefault(); promptBox("Go to step", { label: "Step number", ok: "Go" }).then((n) => { if (!n) return; const f = myStepsInOrder().find((x) => x.step.num === n.trim()) || stepsInOrder().find((x) => x.step.num === n.trim() && applicable(x.step)); if (f) { filter = "all"; siteFilter = "all"; mode = "list"; setFocus(f.step.id); } else toast("No step " + n, "warn"); }); break;
      default:
    }
  }
  function keysHelp() {
    const row = (k, d) => h("tr", h("td", k.map((x) => h("kbd", x))), h("td", d));
    modal({ title: "Keyboard", size: "md", body: h("table.keys-tbl", h("tbody",
      row(["Enter"], "Start the focused step. Focus jumps to the first thing that still needs doing in it."),
      row(["Enter"], "In a field or checklist: save / tick it and move to the next item. When nothing is left: complete the step and move to the next one."),
      row(["Shift", "Enter"], "Complete the step now (it still asks about running timers and missing items)."),
      row(["Ctrl", "Enter"], "In a long text box: save and move on."),
      row(["Tab"], "Next control inside the step"), row(["Esc"], "Leave a field and go back to step keys"),
      row(["↑", "↓"], "Previous / next step (also K / J)"), row(["S"], "Skip the step (asks for a reason)"),
      row(["T"], "Start the step's countdown, or finish it early"), row(["I"], "Log an issue (paste screenshots)"),
      row(["A"], "Require approval for the step (asks the approvers)"), row(["N"], "Improvement note"), row(["C"], "Communications"), row(["G"], "Go to a step number"), row(["L"], "List / lanes view"), row(["?"], "This list"))),
      actions: [{ spacer: true }, { label: "Close", kind: "primary", value: true }] });
  }
  function onCountdownDone(e) {
    const card = e.detail && e.detail.el && e.detail.el.closest(".fcard"); if (!card) return;
    const f = M().findStep(proc, card.dataset.fc); if (!f) return;
    safeRender();
    if (statusOf(f.step) === "active") toast(`⏳ Wait finished on step ${f.step.num} — press Enter to continue`, "ok", 6000);
  }

  PR.views.runner = { mount, unmount };
  return { startNew };
})();
