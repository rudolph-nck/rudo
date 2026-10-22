/* model.js — procedure/run data model: defaults, normalization, environment (failover direction) resolution,
   variables, estimates, and authoring lint. Pure functions; no DOM. */
PR.model = (() => {
  const { uid, clone, isObj, now } = PR.u;

  const CATEGORIES = {
    "Communication": { icon: "☎", color: "#7c3aed" },
    "Prep-Work": { icon: "🧰", color: "#0891b2" },
    "Processing": { icon: "⚙", color: "#2563eb" },
    "Validation": { icon: "✔", color: "#059669" },
    "Decisioning": { icon: "⚖", color: "#d97706" },
    "Review": { icon: "🔍", color: "#0d9488" },
    "Approval": { icon: "✍", color: "#be185d" },
    "Milestone": { icon: "🏁", color: "#16a34a" },
    "Rollback": { icon: "↩", color: "#dc2626" },
    "Celebration": { icon: "🎉", color: "#16a34a" },
  };
  const catMeta = (c) => CATEGORIES[c] || { icon: "•", color: "#64748b" };

  const DEFAULT_CHAIRS = [
    "Chair 1 — Primary-site operator",
    "Chair 2 — Secondary-site operator",
    "Coordinator / Comms",
    "Timekeeper / Scribe",
    "Approver",
    "Observer",
  ];

  function defaultEnvironments() {
    return {
      enabled: false,
      directional: false,
      sites: [],
      roles: {
        primary: { name: "Primary", pre: "Current Primary", post: "New Secondary", hostname: "" },
        secondary: { name: "Secondary", pre: "Current Secondary", post: "New Primary", hostname: "" },
      },
      defaultPrimarySiteId: "",
    };
  }

  function newProcedure(meta = {}) {
    return normalize({
      id: meta.id || uid("proc"),
      title: meta.title || "Untitled procedure",
      description: meta.description || "",
      tags: meta.tags || [],
      sections: meta.sections || [newSection({ title: "Section 1", steps: [newStep({ title: "First step" })] })],
      environments: meta.environments,
      setup: meta.setup,
    });
  }
  function newSection(o = {}) {
    return { id: uid("sec"), title: "New section", description: "", phase: "", collapsed: false, steps: [], ...o };
  }
  function newStep(o = {}) {
    return {
      id: uid("st"), num: "", title: "New step", category: "", target: "none", targetLabel: "", phase: "",
      owner: "", contact: "", window: "", estMin: 0, required: true, critical: false, parallel: false, hold: false,
      condition: "", authorNote: "", blocks: [], ...o,
    };
  }
  function newBlock(type, o = {}) {
    const def = PR.blocks.def(type);
    return { id: uid("b"), type, ...(def ? clone(def.defaults()) : {}), ...o };
  }

  function normalize(p) {
    p = p || {};
    p.id = p.id || uid("proc");
    p.title = p.title || "Untitled procedure";
    p.description = p.description || "";
    p.tags = Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    const env = { ...defaultEnvironments(), ...(p.environments || {}) };
    env.roles = { ...defaultEnvironments().roles, ...(env.roles || {}) };
    env.roles.primary = { ...defaultEnvironments().roles.primary, ...env.roles.primary };
    env.roles.secondary = { ...defaultEnvironments().roles.secondary, ...env.roles.secondary };
    env.sites = (env.sites || []).map((s, i) => ({ id: s.id || uid("site"), name: s.name || `Site ${i + 1}`, code: s.code || "", label: s.label || "", partition: s.partition || "", hmc: s.hmc || "", color: s.color || ["#2563eb", "#ea580c", "#16a34a", "#9333ea"][i % 4], notes: s.notes || "" }));
    p.environments = env;
    p.setup = {
      requireChangeId: true, requireVerification: true, chairs: DEFAULT_CHAIRS.slice(), readiness: [], milestones: [], runNameTemplate: "",
      ...(p.setup || {}),
    };
    p.contacts = Array.isArray(p.contacts) ? p.contacts : [];
    p.approvals = approvalsCfg(p);
    p.sections = (p.sections || []).map((s) => ({
      ...newSection(), ...s, id: s.id || uid("sec"),
      steps: (s.steps || []).map((st) => ({ ...newStep(), ...st, id: st.id || uid("st"), blocks: (st.blocks || []).map((b) => ({ id: b.id || uid("b"), ...b })) })),
    }));
    return p;
  }

  /* Convert the older ProcedureRunner JSON (sections/steps with fields, substeps, details, resources, attachments). */
  function fromLegacy(raw) {
    const p = newProcedure({ title: raw.title || raw.name || "Imported procedure", description: raw.description || "", tags: raw.tags || [] });
    p.sections = (raw.sections || []).map((s) => newSection({
      title: s.title || s.name || "Section", description: s.description || "",
      steps: (s.steps || []).map((st, i) => {
        const blocks = [];
        if (st.description) blocks.push(newBlock("text", { text: st.description }));
        if (st.details) blocks.push(newBlock("callout", { tone: "tip", text: st.details }));
        if (Array.isArray(st.substeps) && st.substeps.length) blocks.push(newBlock("checklist", { items: st.substeps.map((x) => ({ id: uid("ci"), text: x.title || x.text || "" })) }));
        for (const f of st.fields || []) {
          const t = f.type || f.field_type || "text";
          if (t === "confirm_phrase") blocks.push(newBlock("confirm", { label: f.label || "Confirm", phrase: f.default_value || f.placeholder || "CONFIRMED" }));
          else blocks.push(newBlock("input", { label: f.label || f.id, inputType: ["text", "textarea", "number", "select", "date", "time"].includes(t) ? t : "text", placeholder: f.placeholder || "", required: !!f.required, options: Array.isArray(f.options) ? f.options : String(f.options || "").split(/[;|]/).map((o) => o.trim()).filter(Boolean) }));
        }
        for (const r of st.resources || []) blocks.push(newBlock("link", { label: r.label || r.url, url: r.url || "" }));
        for (const a of st.attachments || st.aids || []) {
          if (a.url) blocks.push(newBlock("link", { label: a.label || a.caption || a.url, url: a.url }));
          else if (a.dataUrl) blocks.push(newBlock("image", { src: a.dataUrl, caption: a.caption || a.label || "" }));
          else if (a.file) blocks.push(newBlock("callout", { tone: "info", text: `Attachment: ${a.file}${a.caption ? " — " + a.caption : ""}` }));
        }
        return newStep({ num: String(i + 1), title: st.title || "Step", required: st.required !== false, blocks });
      }),
    }));
    return normalize(p);
  }

  /* ---------- approvals ----------
     procedure.approvals = { enforced, approvers:[names], chairs:[run chairs whose people approve], selfApprove }
     run.approvals[id]   = { id, kind: approval|decision|adhoc|closeout, stepId, blockId, title, note, to:[names],
                             requestedBy, requestedAt, pingAt, status: pending|approved|rejected|cancelled, decidedBy, decidedAt, comment } */
  const APPROVAL_TYPES = ["approval", "decision"];
  function approvalsCfg(p) {
    const a = (p && p.approvals) || {};
    return { enforced: !!a.enforced, approvers: Array.isArray(a.approvers) ? a.approvers.filter(Boolean) : [], chairs: Array.isArray(a.chairs) ? a.chairs : ["Approver"], selfApprove: !!a.selfApprove };
  }
  function approversFor(p, run) {
    const c = approvalsCfg(p);
    const fromChairs = ((run && run.setup && run.setup.participants) || []).filter((x) => x.name && c.chairs.includes(x.chair)).map((x) => x.name.trim());
    const forRun = ((run && run.setup && run.setup.approvers) || []).map((n) => String(n).trim());
    return [...new Set([...c.approvers.map((n) => n.trim()), ...fromChairs, ...forRun])].filter(Boolean);
  }
  const needsApproval = (step) => (step.blocks || []).some((b) => APPROVAL_TYPES.includes(b.type));
  const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  /* Can <me> decide this request? Enforced procedures: only a listed approver, never the person who asked (practice runs excepted). */
  function canApprove(p, run, req, me) {
    if (!req || req.status !== "pending") return false;
    const c = approvalsCfg(p);
    const list = req.to && req.to.length ? req.to : approversFor(p, run);
    if (list.length && !list.some((n) => sameName(n, me))) return false;
    if (c.enforced && !list.length && !run.practice) return false; // nobody assigned yet — assign an approver first
    // Never your own request when approvals are enforced; otherwise only if allowed, or if nobody else is assigned
    if (sameName(me, req.requestedBy) && !run.practice && (c.enforced || (!c.selfApprove && list.length))) return false;
    return true;
  }
  function pendingApprovals(run) {
    return Object.values((run && run.approvals) || {}).filter((r) => r.status === "pending");
  }

  /* ---------- traversal ---------- */
  function allSteps(p) {
    const out = [];
    (p.sections || []).forEach((sec, si) => (sec.steps || []).forEach((step, ti) => out.push({ step, section: sec, si, ti })));
    return out;
  }
  function findStep(p, id) { return allSteps(p).find((x) => x.step.id === id) || null; }
  function findBlock(p, blockId) {
    for (const { step, section } of allSteps(p)) {
      const i = (step.blocks || []).findIndex((b) => b.id === blockId);
      if (i >= 0) return { block: step.blocks[i], step, section, index: i };
    }
    return null;
  }
  function estimateMinutes(p) {
    return allSteps(p || {}).reduce((a, { step }) => a + (Number(step.estMin) || 0), 0);
  }
  function renumber(p) {
    let n = 1;
    allSteps(p).forEach(({ step }) => { step.num = String(n++); });
  }

  /* ---------- environments / failover direction ---------- */
  function sites(p) { return (p.environments && p.environments.sites) || []; }
  function siteById(p, id) { return sites(p).find((s) => s.id === id) || null; }
  function otherSite(p, id) { return sites(p).find((s) => s.id !== id) || null; }
  function primarySite(p, setup) {
    const id = (setup && setup.primarySiteId) || p.environments.defaultPrimarySiteId || (sites(p)[0] || {}).id;
    return siteById(p, id);
  }
  function directionLabel(p, setup) {
    const a = primarySite(p, setup); const b = a && otherSite(p, a.id);
    return a && b ? `${a.name} → ${b.name}` : "";
  }
  function phaseOf(step, section) { return step.phase || (section && section.phase) || "pre"; }

  /* Resolve where a step executes. Returns {kind, site, title, role, roleLabel, partition, hostname, color} */
  function resolveTarget(p, step, section, setup) {
    const env = p.environments || defaultEnvironments();
    const t = step.target || "none";
    const phase = phaseOf(step, section);
    if (t === "none" || !env.enabled) {
      if (t === "custom" && step.targetLabel) return { kind: "custom", title: step.targetLabel, color: "#64748b" };
      return t === "none" || !step.targetLabel ? { kind: "none" } : { kind: "custom", title: step.targetLabel, color: "#64748b" };
    }
    if (t === "both") return { kind: "both", title: "Both sites", sub: sites(p).map((s) => s.code || s.name).join(" + "), color: "#475569" };
    if (t === "custom") return { kind: "custom", title: step.targetLabel || "Other", color: "#64748b" };
    let site = null, role = null;
    if (t === "primary" || t === "secondary") {
      role = t;
      const ps = primarySite(p, setup);
      site = t === "primary" ? ps : ps && otherSite(p, ps.id);
    } else if (t.startsWith("site:")) {
      site = siteById(p, t.slice(5));
      if (env.directional && site) { const ps = primarySite(p, setup); role = ps && ps.id === site.id ? "primary" : "secondary"; }
    }
    if (!site) return { kind: "custom", title: step.targetLabel || t, color: "#64748b" };
    const r = role ? env.roles[role] : null;
    const roleLabel = r ? (phase === "post" ? r.post : r.pre) : "";
    // After cutover the hostname follows the logical role: the site that started as secondary now answers as primary.
    const logical = r ? (phase === "post" ? (role === "primary" ? env.roles.secondary : env.roles.primary) : r) : null;
    return {
      kind: "site", site, title: site.name, code: site.code, role, roleLabel, partition: site.partition, hmc: site.hmc,
      hostname: logical ? logical.hostname : "", color: site.color,
    };
  }

  function isApplicable(step, setup) {
    if (!step.condition) return true;
    if (step.condition.startsWith("dir:")) return !setup || !setup.primarySiteId || setup.primarySiteId === step.condition.slice(4);
    return true;
  }

  function countRunnable(run) {
    const p = run.snapshot; if (!p) return 0;
    return allSteps(p).filter(({ step }) => isApplicable(step, run.setup)).length;
  }

  /* ---------- variables ---------- */
  function siteVars(p, site, roleKey, phase) {
    if (!site) return {};
    const env = p.environments; const r = roleKey ? env.roles[roleKey] : null;
    return { name: site.name, code: site.code, label: site.label || site.name, partition: site.partition, hmc: site.hmc, hostname: r ? r.hostname : "", role: r ? (phase === "post" ? r.post : r.pre) : "" };
  }
  function varContext(run, extra = {}) {
    const p = run.snapshot || run;
    const setup = run.setup || {};
    const ctx = { var: {}, run: { name: run.name || "", changeId: setup.changeId || "", date: setup.exerciseDate || "", direction: directionLabel(p, setup) }, site: {} };
    if (p.environments && p.environments.enabled) {
      const ps = primarySite(p, setup), ss = ps && otherSite(p, ps.id);
      ctx.primary = siteVars(p, ps, "primary"); ctx.secondary = siteVars(p, ss, "secondary");
      ctx.newPrimary = { ...siteVars(p, ss, "secondary", "post"), hostname: p.environments.roles.primary.hostname };
      ctx.newSecondary = { ...siteVars(p, ps, "primary", "post"), hostname: p.environments.roles.secondary.hostname };
      sites(p).forEach((s) => { if (s.code) ctx.site[s.code.toLowerCase()] = siteVars(p, s); });
    }
    // values captured by input blocks that declare a variable name
    for (const { step } of allSteps(p)) {
      for (const b of step.blocks || []) {
        if (b.variable) {
          const v = run.steps && run.steps[step.id] && run.steps[step.id].values && run.steps[step.id].values[b.id];
          const val = v && typeof v === "object" ? v.value : v;
          if (val !== undefined && val !== "") ctx.var[b.variable] = val;
        }
      }
    }
    Object.assign(ctx, extra);
    return ctx;
  }
  function lookup(ctx, path) {
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : (o && o[k.toLowerCase()] !== undefined ? o[k.toLowerCase()] : undefined)), ctx);
  }
  /* mark=true wraps resolved values in invisible markers so md() can highlight them */
  function interpolate(text, ctx, mark = true) {
    if (!text || !ctx) return text || "";
    return String(text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, path) => {
      const v = lookup(ctx, path);
      if (v === undefined || v === null || v === "") return m;
      return mark ? `⁣${v}⁤` : String(v);
    });
  }
  function variablesDeclared(p) {
    const out = [];
    for (const { step } of allSteps(p)) for (const b of step.blocks || []) if (b.variable) out.push({ name: b.variable, step, block: b });
    return out;
  }
  const BUILTIN_VARS = [
    ["primary.name", "Site that is Primary at start"], ["primary.partition", "HMC partition label at that site (fixed)"],
    ["primary.hmc", "HMC URL at that site"], ["primary.hostname", "Primary hostname"],
    ["secondary.name", "Site that is Secondary at start"], ["secondary.partition", "HMC partition label (fixed)"],
    ["secondary.hmc", "HMC URL"], ["newPrimary.name", "Site that becomes Primary"], ["newSecondary.name", "Site that becomes Secondary"],
    ["run.changeId", "Change / exercise ID"], ["run.date", "Exercise date"], ["run.direction", "e.g. Main → DR"],
  ];

  /* ---------- lint before publishing ---------- */
  function lint(p) {
    const issues = [];
    const nums = new Map();
    const declared = new Set(variablesDeclared(p).map((v) => v.name));
    if (!allSteps(p).length) issues.push({ level: "error", msg: "Procedure has no steps." });
    if (p.environments.enabled && p.environments.directional && sites(p).length !== 2) issues.push({ level: "error", msg: "Directional failover needs exactly two sites (Settings → Environments)." });
    for (const { step, section } of allSteps(p)) {
      const ref = { stepId: step.id };
      if (!step.title || !step.title.trim()) issues.push({ level: "error", msg: `Step in "${section.title}" has no title.`, ...ref });
      if (step.num) { if (nums.has(step.num)) issues.push({ level: "warn", msg: `Step number ${step.num} is used more than once.`, ...ref }); nums.set(step.num, 1); }
      if (p.environments.enabled && (step.target === "primary" || step.target === "secondary") && !p.environments.directional)
        issues.push({ level: "warn", msg: `Step ${step.num || step.title}: role targets need "directional" enabled.`, ...ref });
      for (const b of step.blocks || []) {
        if (b.type === "decision" && !String(b.criteria || "").trim()) issues.push({ level: "warn", msg: `Step ${step.num}: Go/No-Go has no criteria.`, ...ref });
        if (b.type === "validation" && !String(b.expected || "").trim()) issues.push({ level: "warn", msg: `Step ${step.num}: validation has no expected result.`, ...ref });
        const texts = [b.text, b.code, b.expected, b.request, b.detail, b.label, b.url].filter(Boolean).join(" ");
        for (const m of texts.matchAll(/\{\{\s*var\.([\w]+)\s*\}\}/g)) if (!declared.has(m[1])) issues.push({ level: "warn", msg: `Step ${step.num}: {{var.${m[1]}}} is never captured by an input block.`, ...ref });
      }
    }
    return issues;
  }

  /* ---------- concurrent chairs (tracks) ----------
     A procedure can split work between chairs (e.g. 1st chair = core failover, 2nd chair = vendors / other parties).
     A step belongs to step.track, else its section's track, else it's shared (both chairs see it). */
  const TRACK_COLORS = ["#00b2e3", "#6abf4b", "#00538b", "#f6bf26"];
  function tracks(p) { return ((p && p.tracks) || []).map((t, i) => ({ color: TRACK_COLORS[i % 4], ...t })); }
  function trackOf(step, section) { return (step && step.track) || (section && section.track) || ""; }
  function trackById(p, id) { return tracks(p).find((t) => t.id === id) || null; }
  const DONE = ["done", "skipped", "na"];
  function trackProgress(run, trackId) {
    const p = run.snapshot; const st = (id) => (run.steps || {})[id] || {};
    const mine = allSteps(p).filter(({ step, section }) => trackOf(step, section) === trackId && isApplicable(step, run.setup));
    const done = mine.filter(({ step }) => DONE.includes(st(step.id).status)).length;
    const active = mine.filter(({ step }) => st(step.id).status === "active").map((x) => x.step);
    const next = mine.find(({ step }) => (st(step.id).status || "pending") === "pending");
    const signoff = (run.trackSignoff || {})[trackId] || null;
    return { done, total: mine.length, pct: mine.length ? Math.round((done / mine.length) * 100) : 0, active, next: next ? next.step : null, complete: done === mine.length, signoff };
  }

  /* ---------- member impact (system down → back up) ----------
     A step can mark the moment members become impacted (down) or service is restored (up), on start or on completion.
     Operators can also declare it manually (run.impactLog) for unplanned outages. */
  function impactName(p) { return (p && p.impactName) || "Member impact"; }
  function hasImpact(p) { return allSteps(p || {}).some(({ step }) => step.impact && step.impact.mark); }
  function impactEvents(run) {
    const p = run.snapshot; const ev = [];
    allSteps(p).forEach(({ step }) => {
      const im = step.impact; if (!im || !im.mark) return;
      const s = (run.steps || {})[step.id] || {};
      const at = im.on === "start" ? s.startedAt : s.status === "done" ? s.finishedAt : null;
      if (at) ev.push({ type: im.mark, at, stepId: step.id, source: "step" });
    });
    (run.impactLog || []).forEach((e) => ev.push({ ...e, source: "manual" }));
    return ev.sort((a, b) => a.at - b.at);
  }
  function impactState(run, nowTs = Date.now()) {
    const p = run.snapshot; const all = allSteps(p);
    const events = impactEvents(run);
    const periods = []; let open = null;
    events.forEach((e) => {
      if (e.type === "down" && !open) open = { start: e.at, startStep: e.stepId, startBy: e.by, note: e.note };
      else if (e.type === "up" && open) { periods.push({ ...open, end: e.at, endStep: e.stepId }); open = null; }
    });
    const down = !!open;
    const totalMs = periods.reduce((a, x) => a + (x.end - x.start), 0) + (open ? nowTs - open.start : 0);
    const idxOf = (id) => all.findIndex((x) => x.step.id === id);
    const markers = all.map((x, i) => ({ ...x, i })).filter((x) => x.step.impact && x.step.impact.mark);
    const st = (id) => (run.steps || {})[id] || {};
    const applicable = (step) => isApplicable(step, run.setup);
    // planned: first down marker and the first up marker after it
    const plannedDown = markers.find((m) => m.step.impact.mark === "down");
    const plannedUp = markers.find((m) => m.step.impact.mark === "up" && (!plannedDown || m.i > plannedDown.i));
    let restore = null;
    if (open) {
      // the up marker that will end this impact: first not-yet-done up marker after where the impact started
      const fromIdx = open.startStep ? idxOf(open.startStep) : -1;
      const up = markers.find((m) => m.step.impact.mark === "up" && m.i > fromIdx && st(m.step.id).status !== "done") || markers.find((m) => m.step.impact.mark === "up" && st(m.step.id).status !== "done");
      if (up) {
        // steps still to do (as of when the impact began) up to and including the restore step
        const span = all.slice(0, up.i + 1).filter(({ step }) => applicable(step) && !(st(step.id).finishedAt && st(step.id).finishedAt <= open.start && ["done", "skipped", "na"].includes(st(step.id).status)));
        const done = span.filter(({ step }) => ["done", "skipped", "na"].includes(st(step.id).status)).length;
        const remainMin = span.filter(({ step }) => !["done", "skipped", "na"].includes(st(step.id).status)).reduce((a, { step }) => a + (Number(step.estMin) || 0), 0);
        const current = all.find(({ step }) => st(step.id).status === "active");
        restore = { step: up.step, on: up.step.impact.on || "complete", done, total: span.length, pct: span.length ? Math.round((done / span.length) * 100) : 0, remainMin, etaAt: remainMin ? nowTs + remainMin * 60000 : null, current: current ? current.step : null };
      }
    }
    const roadblocks = Object.values(run.issues || {}).filter((i) => i.blocking).sort((a, b) => a.at - b.at);
    return {
      name: impactName(p), enabled: hasImpact(p) || events.length > 0, down, since: open ? open.start : null, periods, totalMs, events, restore,
      plannedDown: plannedDown ? plannedDown.step : null, plannedUp: plannedUp ? plannedUp.step : null,
      plannedDownOn: plannedDown ? plannedDown.step.impact.on || "complete" : null, plannedUpOn: plannedUp ? plannedUp.step.impact.on || "complete" : null,
      roadblocks: { open: roadblocks.filter((i) => i.status !== "resolved"), resolved: roadblocks.filter((i) => i.status === "resolved") },
    };
  }

  /* Wrap procedure data in a stored document */
  function newDoc(data, by) {
    return { id: data.id, status: "draft", draft: data, publishedVersion: 0, versions: [], createdAt: now(), updatedAt: now(), updatedBy: by || "", dirtySincePublish: true };
  }

  return { approvalsCfg, approversFor, needsApproval, canApprove, pendingApprovals, sameName, APPROVAL_TYPES,
    CATEGORIES, catMeta, DEFAULT_CHAIRS, BUILTIN_VARS, defaultEnvironments, newProcedure, newSection, newStep, newBlock, normalize, fromLegacy,
    allSteps, findStep, findBlock, estimateMinutes, renumber, sites, siteById, otherSite, primarySite, directionLabel, phaseOf,
    resolveTarget, isApplicable, countRunnable, varContext, interpolate, variablesDeclared, lint, newDoc, impactName, hasImpact, impactEvents, impactState, tracks, trackOf, trackById, trackProgress, TRACK_COLORS,
  };
})();
