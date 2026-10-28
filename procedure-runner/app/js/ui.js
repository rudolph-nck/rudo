/* ui.js — small shared renderers used by builder, runner and reports. */
PR.ui = (() => {
  const { h } = PR.u;

  /* Environment badge: physical datacenter + fixed HMC partition + logical role for the step's phase. */
  function envBadge(t, { size = "md", showRole = true } = {}) {
    if (!t || t.kind === "none") return null;
    if (t.kind === "custom") return h(`span.env.env-${size}`, { style: { "--c": t.color } }, h("span.env-dot"), h("span.env-site", t.title));
    if (t.kind === "both") return h(`span.env.env-${size}.env-both`, { style: { "--c": t.color } }, h("span.env-dot"), h("span.env-site", t.title), t.sub ? h("span.env-sub", t.sub) : null);
    const title = `${t.title}${t.partition ? ` — HMC partition "${t.partition}" (fixed)` : ""}${t.roleLabel ? ` — ${t.roleLabel}` : ""}${t.hostname ? ` — hostname ${t.hostname}` : ""}`;
    if (size === "lg") {
      return h("div.env-banner", { style: { "--c": t.color }, title },
        h("div.envb-site", h("span.envb-k", "Datacenter"), h("span.envb-v", t.title, t.code ? h("span.envb-code", t.code) : null)),
        t.partition ? h("div.envb-part", h("span.envb-k", "HMC partition (fixed)"), h("span.envb-v", t.partition)) : null,
        t.roleLabel ? h("div.envb-role", h("span.envb-k", "Logical role"), h("span.envb-v", t.roleLabel, t.hostname ? h("span.envb-host", ` · ${t.hostname}`) : null)) : null);
    }
    return h(`span.env.env-${size}`, { style: { "--c": t.color }, title },
      h("span.env-dot"), h("span.env-site", t.code || t.title),
      t.partition && size !== "sm" ? h("span.env-part", t.partition) : null,
      showRole && t.roleLabel ? h("span.env-role", t.roleLabel) : null);
  }

  function catChip(c) {
    if (!c) return null;
    const m = PR.model.catMeta(c);
    return h("span.cat", { style: { "--c": m.color } }, m.icon, " ", c);
  }

  const STEP_STATUS = {
    pending: { icon: "○", label: "Not started", cls: "s-pending" },
    active: { icon: "◉", label: "In progress", cls: "s-active" },
    done: { icon: "✓", label: "Done", cls: "s-done" },
    skipped: { icon: "⤼", label: "Skipped", cls: "s-skipped" },
    na: { icon: "∅", label: "N/A", cls: "s-na" },
    failed: { icon: "✕", label: "Failed", cls: "s-failed" },
    blocked: { icon: "⏸", label: "Blocked", cls: "s-blocked" },
  };
  const TIMING = {
    auto: { label: "Auto", title: "Start and finish captured automatically", cls: "tm-auto" },
    manual: { label: "Entered after", title: "Times entered or corrected after the fact", cls: "tm-manual" },
    unavailable: { label: "Timing unreliable", title: "Completed without a start time — duration unknown", cls: "tm-unavail" },
  };
  function timingChip(src) { const t = TIMING[src]; return t ? h(`span.tm.${t.cls}`, { title: t.title }, t.label) : null; }

  /* Member-impact panel. size "strip" (runner, one line) or "hero" (live dashboard). */
  function impactPanel(im, { size = "strip" } = {}) {
    const { fmtDur, fmtTime, fmtMin, now } = PR.u;
    if (!im || !im.enabled) return null;
    const when = (step, on) => (step ? `${on === "start" ? "starts" : "completes"}: step ${step.num} ${step.title}` : "");
    const rb = im.roadblocks.open;
    const rbNode = rb.length ? h("span.imp-rb", { title: rb.map((i) => i.title).join("\n") }, `🚧 ${rb.length} roadblock${rb.length > 1 ? "s" : ""}`) : null;
    if (im.down) {
      const r = im.restore;
      return h(`div.impact.down.imp-${size}`,
        h("div.imp-state", h("span.imp-pulse"), h("div", h("div.imp-k", `${im.name} · members impacted`), h("div.imp-timer", { dataset: { since: String(im.since) } }, fmtDur(now() - im.since)))),
        h("div.imp-body",
          r ? [h("div.imp-line", h("b", "Back online when "), `step ${r.step.num} ${r.step.title}`, r.on === "start" ? " starts" : " completes"),
            h("div.imp-prog", h("div.bar", h("div.bar-fill", { style: { width: r.pct + "%" } })), h("span", `${r.done}/${r.total} steps`)),
            h("div.imp-sub", `Down since ${fmtTime(im.since, false)}`, r.current ? ` · now: ${r.current.num} ${r.current.title}` : "", r.etaAt ? ` · restore ETA ${fmtTime(r.etaAt, false)} (~${fmtMin(r.remainMin)})` : "")]
            : h("div.imp-line", `Down since ${fmtTime(im.since, false)} — no restore step defined; declare “service restored” when members are back.`)),
        rbNode);
    }
    if (im.periods.length) {
      const last = im.periods[im.periods.length - 1];
      return h(`div.impact.up.imp-${size}`, h("div.imp-state", h("span.imp-ok", "✓"), h("div", h("div.imp-k", `${im.name} · service restored`), h("div.imp-timer", fmtDur(im.totalMs)))),
        h("div.imp-body", h("div.imp-line", `Members were impacted ${fmtTime(im.periods[0].start, false)} – ${fmtTime(last.end, false)}`, im.periods.length > 1 ? ` (${im.periods.length} interruptions)` : ""),
          h("div.imp-sub", "Total impact ", h("b", fmtDur(im.totalMs, { short: true })))), rbNode);
    }
    return h(`div.impact.pending.imp-${size}`, h("div.imp-state", h("span.imp-idle", "○"), h("div", h("div.imp-k", im.name), h("div.imp-timer.muted", "Not yet impacted"))),
      h("div.imp-body", im.plannedDown ? h("div.imp-line", "Impact begins when ", when(im.plannedDown, im.plannedDownOn)) : null,
        im.plannedUp ? h("div.imp-sub", "Restored when ", when(im.plannedUp, im.plannedUpOn)) : null), rbNode);
  }

  /* Schedule editor for a run sheet (variant): when it is suggested as today's sheet. Edits v in place; onChange redraws the caller's summary. */
  function scheduleEditor(v, onChange = () => {}) {
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const flip = (arr, x, on) => { const a = new Set(arr || []); on ? a.add(x) : a.delete(x); return [...a].sort((p, q) => p - q); };
    const box = h("div.sched");
    const draw = () => {
      box.innerHTML = "";
      const chip = (on, label, toggle, title) => h(`button.sch-chip${on ? ".on" : ""}`, { type: "button", title: title || "", onclick: () => { toggle(!on); draw(); onChange(); } }, label);
      box.append(
        h("div.sch-row", h("span.sch-k", "Days"), DAYS.map((d, i) => chip((v.days || []).includes(i), d, (on) => (v.days = flip(v.days, i, on)))),
          (v.days || []).length ? h("label.sch-every", "every ", h("select.inp.sm", { onchange: (e) => { const n = Number(e.target.value); v.everyWeeks = n > 1 ? { n, from: (v.everyWeeks && v.everyWeeks.from) || PR.model.ymd(new Date()) } : null; draw(); onChange(); } },
            [1, 2, 3, 4].map((n) => h("option", { value: n, selected: ((v.everyWeeks && v.everyWeeks.n) || 1) === n }, n === 1 ? "week" : `${n} weeks`))),
            v.everyWeeks && v.everyWeeks.n > 1 ? [" starting the week of ", h("input.inp.sm", { type: "date", value: v.everyWeeks.from || "", onchange: (e) => { v.everyWeeks.from = e.target.value; onChange(); } })] : null) : null),
        h("div.sch-row", h("span.sch-k", "Month"),
          chip((v.biz || []).includes("first"), "First business day", (on) => (v.biz = on ? [...new Set([...(v.biz || []), "first"])] : (v.biz || []).filter((x) => x !== "first"))),
          chip((v.biz || []).includes("last"), "Last business day", (on) => (v.biz = on ? [...new Set([...(v.biz || []), "last"])] : (v.biz || []).filter((x) => x !== "last"))),
          h("label.sch-every", "day(s) ", h("input.inp.sm.w-num", { value: (v.dom || []).join(", "), placeholder: "e.g. 1, 15", oninput: (e) => { v.dom = e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x >= 1 && x <= 31); onChange(); } }))),
        h("div.sch-row", h("span.sch-k", "Holidays"),
          chip(!!v.holidays, "On a holiday", (on) => (v.holidays = on)),
          chip(!!v.afterHoliday, "Day after a holiday", (on) => (v.afterHoliday = on), "The first business day after a holiday")),
        h("div.sch-row", h("span.sch-k", "Only in"), MON.map((m, i) => chip((v.months || []).includes(i + 1), m, (on) => (v.months = flip(v.months, i + 1, on)))), h("span.muted.small", (v.months || []).length ? "" : " (every month)")),
        h("div.sch-sum", "🗓 ", PR.model.scheduleLabel(v)));
    };
    draw();
    return box;
  }

  return { envBadge, catChip, STEP_STATUS, TIMING, timingChip, impactPanel, scheduleEditor };
})();
