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

  return { envBadge, catChip, STEP_STATUS, TIMING, timingChip };
})();
