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

  /* Wrap procedure data in a stored document */
  function newDoc(data, by) {
    return { id: data.id, status: "draft", draft: data, publishedVersion: 0, versions: [], createdAt: now(), updatedAt: now(), updatedBy: by || "", dirtySincePublish: true };
  }

  return {
    CATEGORIES, catMeta, DEFAULT_CHAIRS, BUILTIN_VARS, defaultEnvironments, newProcedure, newSection, newStep, newBlock, normalize, fromLegacy,
    allSteps, findStep, findBlock, estimateMinutes, renumber, sites, siteById, otherSite, primarySite, directionLabel, phaseOf,
    resolveTarget, isApplicable, countRunnable, varContext, interpolate, variablesDeclared, lint, newDoc,
  };
})();
