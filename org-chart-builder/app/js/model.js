/* model.js — the project document, migration from the old single-file builder (v31–v44), the hierarchy index,
   the derived chart pages, per-page tree building and health checks. Pure data: no DOM.

   Project (schema 2):
   {
     schema, organization, title, ceoId, executiveIds: [],
     people:   { [id]: { id, name, title, department, managerId, email, employeeNumber, phone, location,
                         status: active|leave|inactive, type: employee|vacant|contractor, notes } },
     units:    { [department name]: { type: department|branch, ownerId?: executive id override } },
     pageState:{ [pageId | "*"]: { title, label, subtitle, hidden, layouts:{mgr:mode}, order:{mgr:[ids]},
                                   styles:{id:auto|standard|passive}, hiddenCards:{id:1}, collapsed:{id:1},
                                   expanded:{id:1}, links:{id:parentId}, extra:{id:{name,title,department,parentId,type}} } },
     customPages: { [id]: { id, kind: chart|divider, title, label, subtitle, rootId, depth, context, createdAt } },
     pageOrder: [pageId],
     settings: { theme: brand|classic, showCounts, showDept, cardDensity: comfortable|compact },
     published: { version, at, by, note, rev }, rev, updatedAt, updatedBy
   }
   "*" in pageState holds defaults that apply on every page (e.g. a manager's layout set from the directory). */
OC.model = (() => {
  const { clone, slug, norm, now } = OC.u;

  const LAYOUTS = [
    { id: "auto", label: "Auto", hint: "Managers side by side, individual contributors stacked" },
    { id: "horizontal", label: "Side by side", hint: "One row" },
    { id: "grid", label: "Grid", hint: "Wrap into rows" },
    { id: "vertical", label: "Stacked", hint: "One column" },
  ];
  const STATUS = { active: "Active", leave: "On leave", inactive: "Inactive (removed)" };
  const TYPES = { employee: "Employee", vacant: "Vacant position", contractor: "Contractor" };

  function emptyProject(org = "My Organization") {
    return {
      schema: 2, organization: org, title: `${org} Organizational Chart`, ceoId: "", executiveIds: [],
      people: {}, units: {}, pageState: {}, customPages: {}, pageOrder: [],
      settings: { theme: "brand", showCounts: true, showDept: true, cardDensity: "comfortable" },
      createdAt: now(),
    };
  }
  function normalize(p) {
    p.schema = 2;
    p.people = p.people || {}; p.units = p.units || {}; p.pageState = p.pageState || {}; p.customPages = p.customPages || {};
    p.pageOrder = Array.isArray(p.pageOrder) ? p.pageOrder : [];
    p.executiveIds = Array.isArray(p.executiveIds) ? p.executiveIds : [];
    p.settings = Object.assign({ theme: "brand", showCounts: true, showDept: true, cardDensity: "comfortable" }, p.settings || {});
    p.organization = p.organization || "My Organization";
    p.title = p.title || `${p.organization} Organizational Chart`;
    for (const [id, x] of Object.entries(p.people)) {
      x.id = id; x.name = x.name || "Unnamed"; x.title = x.title || ""; x.department = x.department || "";
      x.managerId = x.managerId || ""; x.status = x.status || "active"; x.type = x.type || "employee";
    }
    return p;
  }

  /* ---------------------------------------------------------------- migration from the v31–v44 single-file builder */
  function looksLikeV44(raw) {
    const d = raw && raw.project && raw.project.employees ? raw.project : raw;
    return d && Array.isArray(d.employees);
  }
  /* Pulls the embedded project out of an old OrgChartBuilder.html file. */
  function extractFromV44Html(text) {
    const i = text.indexOf("const INITIAL_PROJECT=");
    if (i < 0) throw new Error("This HTML file doesn't contain an Org Chart Builder project.");
    const start = text.indexOf("{", i);
    let depth = 0, inStr = false, escp = false;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (inStr) { if (escp) escp = false; else if (c === "\\") escp = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, j + 1));
    }
    throw new Error("The project inside this HTML file is incomplete.");
  }

  function fromV44(raw) {
    const src = raw.project && raw.project.employees ? raw.project : raw;
    const org = src.organization || "Organization";
    const p = emptyProject(org);
    p.title = (src.settings && src.settings.organizationTitle) || `${org} Organizational Chart`;
    p.importedFrom = { app: "Org Chart Builder " + (src.appVersion || "v4x"), version: src.version || "", at: now() };

    // ids: readable and stable, derived from the old key ("anderson, shakyma" -> "anderson-shakyma")
    const idOf = new Map(), used = new Set();
    src.employees.forEach((e, i) => {
      const key = e.key || String(e.name || `employee-${i + 1}`).trim().toLowerCase();
      let id = slug(key) || `person-${i + 1}`;
      while (used.has(id)) id += "-2";
      used.add(id); idOf.set(key, id);
    });
    const branchUnits = new Set();
    src.employees.forEach((e, i) => {
      const key = e.key || String(e.name || `employee-${i + 1}`).trim().toLowerCase();
      const id = idOf.get(key);
      let dept = e.department || "";
      if (typeof e.branch === "string" && e.branch) { if (!dept) dept = e.branch; branchUnits.add(e.branch); }
      else if (e.branch && dept) branchUnits.add(dept);
      p.people[id] = {
        id, name: e.name || e.title || "Unnamed position", title: e.title || "", department: dept,
        managerId: idOf.get(e.managerKey) || "", email: e.email || "", employeeNumber: e.employeeNumber || "",
        phone: "", location: "", status: e.status || "active", type: e.positionType || "employee", notes: e.notes || "",
      };
    });
    for (const x of Object.values(p.people)) if (x.department && !p.units[x.department]) p.units[x.department] = { type: branchUnits.has(x.department) ? "branch" : "department" };

    p.ceoId = idOf.get(src.ceoKey) || "";
    p.executiveIds = (src.executiveKeys || []).map((k) => idOf.get(k)).filter(Boolean);

    // Old "scopes" -> new page ids
    const unitPage = (name) => `unit:${slug(name)}`;
    const scopePage = (scope) => {
      if (!scope || scope === "ALL") return "*";
      if (scope === "EXEC_OVERVIEW") return "overview";
      if (scope.startsWith("EXEC:")) { const id = idOf.get(scope.slice(5)); return id ? `exec:${id}` : null; }
      if (scope.startsWith("CUSTOM:")) return `custom:${slug(scope.slice(7))}`;
      return unitPage(scope);
    };
    const nameToId = new Map(Object.values(p.people).map((x) => [x.name.toLowerCase(), x.id]));
    const ps = (pid) => (p.pageState[pid] = p.pageState[pid] || {});

    // layouts: keyed by "<lower name>" (global) or "<lower name>::<scope>"
    for (const [k, mode] of Object.entries(src.layouts || {})) {
      const [nm, scope] = k.split("::");
      const id = nameToId.get(nm) || idOf.get(nm);
      const pid = scopePage(scope);
      // The old "Horizontal" drew one endless row (then shrank the page to fit); Auto lays those teams out readably.
      if (!id || !pid || !["grid", "vertical"].includes(mode)) continue;
      (ps(pid).layouts = ps(pid).layouts || {})[id] = mode;
    }
    for (const [k, keys] of Object.entries(src.sortOrders || {})) {
      const [mk, scope] = k.split("::"); const id = idOf.get(mk); const pid = scopePage(scope);
      if (!id || !pid || !Array.isArray(keys)) continue;
      (ps(pid).order = ps(pid).order || {})[id] = keys.map((x) => idOf.get(x)).filter(Boolean);
    }
    for (const [k, style] of Object.entries(src.cardStyles || {})) {
      const cut = k.indexOf("::"); const scope = k.slice(0, cut), id = idOf.get(k.slice(cut + 2)); const pid = scopePage(scope);
      if (!id || !pid) continue;
      (ps(pid).styles = ps(pid).styles || {})[id] = style === "standard" ? "standard" : style === "passive" ? "passive" : "auto";
    }
    for (const [scope, st] of Object.entries(src.scopeOverrides || {})) {
      const pid = scopePage(scope); if (!pid || pid === "*") continue;
      (st.hiddenKeys || []).forEach((k) => { const id = idOf.get(k); if (id) (ps(pid).hiddenCards = ps(pid).hiddenCards || {})[id] = 1; });
      (st.links || []).forEach((l) => { const id = idOf.get(l.key), m = idOf.get(l.managerKey); if (id && m) (ps(pid).links = ps(pid).links || {})[id] = m; });
      (st.customCards || []).forEach((c) => { const parent = idOf.get(c.managerKey) || c.managerKey; (ps(pid).extra = ps(pid).extra || {})[slug(c.key || c.name)] = { name: c.name || "", title: c.title || "", department: c.department || "", parentId: parent, type: c.positionType || "employee" }; });
    }
    // custom sections -> custom pages
    (src.customSections || []).forEach((s) => {
      const id = slug(s.id || s.title || `page-${Math.random()}`);
      const pid = `custom:${id}`;
      p.customPages[id] = {
        id, kind: s.sectionType === "divider" ? "divider" : "chart", title: s.title || "New page", label: s.pageLabel || "",
        subtitle: s.description || "", rootId: idOf.get(s.rootKey) || "", depth: s.fullHierarchy ? 0 : 1, context: !!s.showContext, createdAt: now(),
      };
      (s.expandedKeys || []).forEach((k) => { const x = idOf.get(k); if (x) (ps(pid).expanded = ps(pid).expanded || {})[x] = 1; });
      (s.hiddenKeys || []).forEach((k) => { const x = idOf.get(k); if (x) (ps(pid).hiddenCards = ps(pid).hiddenCards || {})[x] = 1; });
      (s.customCards || []).forEach((c) => { (ps(pid).extra = ps(pid).extra || {})[slug(c.key || c.name)] = { name: c.name || "", title: c.title || "", department: c.department || "", parentId: idOf.get(c.managerKey) || slug(c.managerKey || ""), type: c.positionType || "employee" }; });
    });
    // section title overrides and page order/visibility (old container ids)
    const containerPage = (cid) => {
      if (!cid) return null;
      if (cid === "container:executive-overview") return "overview";
      if (cid === "container:executive-direct-divider") return "div:exec-direct";
      if (cid === "container:executive-area-divider") return "div:areas";
      let m;
      if ((m = cid.match(/^container:executive-direct:(.+)$/))) return idOf.get(m[1]) ? `exec:${idOf.get(m[1])}` : null;
      if ((m = cid.match(/^container:executive-divider:(.+)$/))) return idOf.get(m[1]) ? `div:area:${idOf.get(m[1])}` : null;
      if ((m = cid.match(/^container:(?:department|branch):(.+)$/))) return unitPage(m[1]);
      if ((m = cid.match(/^container:custom:(.+)$/))) return `custom:${slug(m[1])}`;
      return null;
    };
    for (const [cid, o] of Object.entries(src.sectionOverrides || {})) {
      const pid = containerPage(cid); if (!pid) continue;
      if (o.title !== undefined) ps(pid).title = o.title;
      if (o.label !== undefined) ps(pid).label = o.label;
      if (o.subtitle !== undefined) ps(pid).subtitle = o.subtitle;
    }
    const cs = src.chartStructure || {};
    p.pageOrder = (cs.containerOrder || []).map(containerPage).filter(Boolean);
    (cs.hidden || []).map(containerPage).filter(Boolean).forEach((pid) => (ps(pid).hidden = true));
    return normalize(p);
  }

  /* Accepts: a v2 project, a v2 export bundle, a v31–v44 project/JSON, or the text of an old OrgChartBuilder.html */
  function importAny(textOrObj) {
    let raw = textOrObj;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t.startsWith("<") || t.includes("const INITIAL_PROJECT=")) raw = extractFromV44Html(t);
      else raw = JSON.parse(t);
    }
    if (raw && raw.kind === "org-chart-builder/project" && raw.doc) raw = raw.doc;
    if (raw && raw.schema === 2 && raw.people) return normalize(clone(raw));
    if (looksLikeV44(raw)) return fromV44(raw);
    throw new Error("This file isn't an Org Chart Builder project.");
  }

  /* ---------------------------------------------------------------- index */
  let IX = null, ixDoc = null, ixRev = -1;
  function index(p) {
    if (IX && ixDoc === p && ixRev === p._v) return IX;
    const byId = new Map(), kids = new Map(), byUnit = new Map(), active = [];
    for (const x of Object.values(p.people)) {
      byId.set(x.id, x);
      if (x.status === "inactive") continue;
      active.push(x);
      if (!kids.has(x.managerId)) kids.set(x.managerId, []);
      kids.get(x.managerId).push(x);
      if (x.department) { if (!byUnit.has(x.department)) byUnit.set(x.department, []); byUnit.get(x.department).push(x); }
    }
    const byName = (a, b) => a.name.localeCompare(b.name);
    kids.forEach((l) => l.sort(byName)); byUnit.forEach((l) => l.sort(byName)); active.sort(byName);
    IX = { byId, kids, byUnit, active, desc: new Map(), owner: new Map(), pages: null, unitGroups: null };
    ixDoc = p; ixRev = p._v;
    return IX;
  }
  const touch = (p) => { p._v = (p._v || 0) + 1; }; // call after any change to invalidate caches
  const person = (p, id) => index(p).byId.get(id);
  const childrenOf = (p, id) => index(p).kids.get(id) || [];
  function descendants(p, id) {
    const ix = index(p);
    if (ix.desc.has(id)) return ix.desc.get(id);
    const out = new Set(), stack = [id], seen = new Set();
    while (stack.length) { const k = stack.pop(); if (seen.has(k)) continue; seen.add(k); for (const c of ix.kids.get(k) || []) { out.add(c.id); stack.push(c.id); } }
    out.delete(id);
    ix.desc.set(id, out);
    return out;
  }
  const headcount = (p, id) => descendants(p, id).size;
  function chain(p, id, max = 50) { // managers above id, nearest first
    const out = []; const seen = new Set([id]);
    let cur = person(p, id);
    while (cur && cur.managerId && out.length < max) {
      if (seen.has(cur.managerId)) break; seen.add(cur.managerId);
      cur = person(p, cur.managerId); if (!cur) break; out.push(cur);
    }
    return out;
  }
  function execOwner(p, id) {
    const ix = index(p);
    if (ix.owner.has(id)) return ix.owner.get(id);
    let o = null;
    if (p.executiveIds.includes(id)) o = id;
    else for (const m of chain(p, id)) if (p.executiveIds.includes(m.id)) { o = m.id; break; }
    ix.owner.set(id, o);
    return o;
  }
  const isBranch = (p, unit) => !!(p.units[unit] && p.units[unit].type === "branch");
  const unitNames = (p) => [...index(p).byUnit.keys()].sort((a, b) => a.localeCompare(b));

  /* ---------------------------------------------------------------- pages */
  /* A unit (department/branch) page shows its members plus enough management context (up to 4 levels, stopping at an
     executive) to connect every team in it. Context people who aren't members render as passive (outlined) cards. */
  function unitGroups(p) {
    const ix = index(p);
    if (ix.unitGroups) return ix.unitGroups;
    const top = new Set([p.ceoId, ...p.executiveIds]);
    const groups = [];
    for (const name of unitNames(p)) {
      // The CEO and executives are on the overview and their own pages, so a unit page lists everyone else
      // (e.g. "Executive Office" shows the office staff, not the whole executive team again).
      const members = ix.byUnit.get(name).filter((m) => !top.has(m.id));
      if (!members.length) continue;
      const memberIds = new Set(members.map((m) => m.id));
      const allowed = new Set(memberIds);
      for (const m of members) {
        let cur = m;
        for (let lvl = 0; lvl < 4 && cur && cur.managerId; lvl++) {
          cur = ix.byId.get(cur.managerId);
          if (!cur || cur.status === "inactive") break;
          allowed.add(cur.id);
          if (top.has(cur.id)) break;
        }
      }
      const roots = [...allowed].filter((id) => { const x = ix.byId.get(id); return x && (!x.managerId || !allowed.has(x.managerId)); }).map((id) => ix.byId.get(id));
      const counts = {};
      members.forEach((m) => { const o = execOwner(p, m.id); if (o) counts[o] = (counts[o] || 0) + 1; });
      const override = p.units[name] && p.units[name].ownerId;
      const owner = override && p.executiveIds.includes(override) ? override : (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [null])[0];
      groups.push({ name, members, memberIds, allowed, roots, owner, branch: isBranch(p, name) });
    }
    ix.unitGroups = groups;
    return groups;
  }

  /* All pages in default order, before the user's custom order/visibility is applied. */
  function defaultPages(p) {
    const ix = index(p);
    const out = [];
    const ceo = ix.byId.get(p.ceoId);
    const execs = p.executiveIds.map((id) => ix.byId.get(id)).filter((x) => x && x.status !== "inactive");
    const org = p.organization;
    if (ceo) {
      out.push({ id: "overview", kind: "chart", group: "Executive", label: "Executive Offices", title: `${org} Executive Offices`,
        subtitle: `${ceo.name} and the executive leadership team.`, roots: [ceo.id], allowed: new Set([ceo.id, ...execs.map((e) => e.id)]), depth: 1, context: [], rootLayout: "grid" });
    }
    const withReports = execs.filter((e) => childrenOf(p, e.id).length);
    if (withReports.length) {
      out.push({ id: "div:exec-direct", kind: "divider", group: "Executive", label: "Executive Office Reporting", title: "Executive Direct Reports", subtitle: "Each executive's direct reports, before the drill-through by area." });
      for (const e of withReports) {
        out.push({ id: `exec:${e.id}`, kind: "chart", group: "Executive", label: "Executive reporting page", title: e.name, subtitle: `${e.title ? e.title + " · " : ""}direct reports.`,
          roots: [e.id], allowed: null, depth: 1, context: ceo ? [ceo.id] : [], personId: e.id });
      }
    }
    const groups = unitGroups(p);
    const byOwner = new Map();
    groups.forEach((g) => { const k = g.owner || ""; if (!byOwner.has(k)) byOwner.set(k, []); byOwner.get(k).push(g); });
    const unitPage = (g, area) => ({
      id: `unit:${slug(g.name)}`, kind: "chart", group: area, unit: g.name, branch: g.branch,
      label: g.branch ? "Branch reporting page" : "Department reporting page", title: g.name,
      subtitle: `${g.members.length} ${g.members.length === 1 ? "person" : "people"} in this ${g.branch ? "branch" : "department"}.`,
      roots: g.roots.map((r) => r.id), allowed: g.allowed, depth: 0, context: [], members: g.memberIds,
    });
    if (groups.length) out.push({ id: "div:areas", kind: "divider", group: "Areas", label: "Organizational Drill-Through", title: "Executive Areas", subtitle: "Every department and branch, grouped by executive area." });
    for (const e of execs) {
      const mine = byOwner.get(e.id);
      if (!mine) continue;
      out.push({ id: `div:area:${e.id}`, kind: "divider", group: e.name, label: "Executive Area", title: e.name, subtitle: `${e.title} · ${mine.length} ${mine.length === 1 ? "department or branch" : "departments and branches"}`, personId: e.id });
      mine.forEach((g) => out.push(unitPage(g, e.name)));
    }
    const orphans = byOwner.get("");
    if (orphans) {
      out.push({ id: "div:area:none", kind: "divider", group: "Other", label: "Other", title: "Other Departments", subtitle: "Departments that don't report up to a listed executive." });
      orphans.forEach((g) => out.push(unitPage(g, "Other")));
    }
    for (const c of Object.values(p.customPages)) {
      out.push({ id: `custom:${c.id}`, kind: c.kind === "divider" ? "divider" : "chart", group: "Custom", custom: c, label: c.label || (c.kind === "divider" ? "Section" : "Custom page"),
        title: c.title || "Untitled page", subtitle: c.subtitle || "", roots: c.rootId ? [c.rootId] : [], allowed: null, depth: c.depth == null ? 1 : c.depth,
        context: c.context && c.rootId ? chain(p, c.rootId).filter((m) => m.status !== "inactive").reverse().map((m) => m.id) : [] });
    }
    return out;
  }

  /* Pages in the user's order, with their title overrides and hidden flags applied. */
  function pages(p, { includeHidden = true } = {}) {
    const ix = index(p);
    if (!ix.pages) {
      const list = defaultPages(p);
      const rank = new Map(p.pageOrder.map((id, i) => [id, i]));
      // Pages without a saved position keep their default place relative to the page before them.
      const placed = [];
      list.forEach((pg, i) => { pg.defaultIndex = i; });
      const ordered = list.filter((pg) => rank.has(pg.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id));
      const rest = list.filter((pg) => !rank.has(pg.id));
      if (!ordered.length) placed.push(...list);
      else {
        placed.push(...ordered);
        for (const pg of rest) {
          // insert after the nearest earlier default page that is already placed
          let at = -1;
          for (let i = pg.defaultIndex - 1; i >= 0 && at < 0; i--) at = placed.indexOf(list[i]);
          placed.splice(at + 1, 0, pg);
        }
      }
      for (const pg of placed) {
        const st = p.pageState[pg.id] || {};
        pg.defaults = { title: pg.title, label: pg.label, subtitle: pg.subtitle };
        if (st.title != null && st.title !== "") pg.title = st.title;
        if (st.label != null && st.label !== "") pg.label = st.label;
        if (st.subtitle != null) pg.subtitle = st.subtitle;
        pg.hidden = !!st.hidden;
      }
      ix.pages = placed;
    }
    return includeHidden ? ix.pages : ix.pages.filter((pg) => !pg.hidden);
  }
  const pageById = (p, id) => pages(p).find((pg) => pg.id === id) || null;
  const pageState = (p, pid) => p.pageState[pid] || {};

  /* Which page best represents a person: their department page, else the overview/executive page. */
  function homePage(p, id) {
    const x = person(p, id);
    if (!x) return null;
    const list = pages(p);
    if (x.id === p.ceoId) return list.find((pg) => pg.id === "overview") || null;
    if (p.executiveIds.includes(x.id)) return list.find((pg) => pg.id === `exec:${x.id}`) || list.find((pg) => pg.id === "overview") || null;
    const u = x.department && list.find((pg) => pg.unit === x.department && pg.members && pg.members.has(x.id));
    if (u) return u;
    return list.find((pg) => pg.kind === "chart" && pg.allowed && pg.allowed.has(x.id)) || null;
  }
  function pagesWith(p, id) {
    const x = person(p, id);
    const shows = (pg) => {
      if (pg.allowed) return pg.allowed.has(id);
      if (pg.roots.includes(id) || pg.context.includes(id)) return true;
      if (pg.depth === 0) return pg.roots.some((r) => descendants(p, r).has(id));
      return !!x && pg.roots.includes(x.managerId);
    };
    return pages(p).filter((pg) => pg.kind === "chart" && shows(pg));
  }

  /* ---------------------------------------------------------------- per-page tree
     Returns { roots:[node], context:[node] } where node = { id, p (person-like), level, kids:[node], hiddenKids, style, layout, extra }.
     Honors: allowed set, depth, per-page expanded/collapsed, hidden cards, page-only links (re-parenting) and page-only cards. */
  function layoutFor(p, pid, mgrId) {
    const st = p.pageState[pid], g = p.pageState["*"];
    return (st && st.layouts && st.layouts[mgrId]) || (g && g.layouts && g.layouts[mgrId]) || "auto";
  }
  function orderFor(p, pid, mgrId) {
    const st = p.pageState[pid], g = p.pageState["*"];
    return (st && st.order && st.order[mgrId]) || (g && g.order && g.order[mgrId]) || null;
  }
  function styleFor(p, pid, id) {
    const st = p.pageState[pid], g = p.pageState["*"];
    return (st && st.styles && st.styles[id]) || (g && g.styles && g.styles[id]) || "auto";
  }

  function pageTree(p, pg) {
    const ix = index(p);
    const st = p.pageState[pg.id] || {};
    const hidden = st.hiddenCards || {}, collapsed = st.collapsed || {}, expanded = st.expanded || {}, links = st.links || {}, extra = st.extra || {};
    const linkedTo = new Map();
    for (const [id, parent] of Object.entries(links)) { if (!linkedTo.has(parent)) linkedTo.set(parent, []); const x = ix.byId.get(id); if (x && x.status !== "inactive") linkedTo.get(parent).push(x); }
    const extraTo = new Map();
    for (const [id, e] of Object.entries(extra)) {
      const x = { id: `x:${id}`, extraId: id, name: e.name || "New card", title: e.title || "", department: e.department || "", type: e.type || "employee", managerId: e.parentId, status: "active", isExtra: true };
      if (!extraTo.has(e.parentId)) extraTo.set(e.parentId, []); extraTo.get(e.parentId).push(x);
    }
    const allowedSet = pg.allowed;
    const passiveSet = new Set(pg.context);
    if (pg.members) for (const id of pg.allowed) if (!pg.members.has(id)) passiveSet.add(id);

    function candidates(id) {
      const base = (ix.kids.get(id) || []).filter((c) => (links[c.id] === undefined || links[c.id] === id) && (!allowedSet || allowedSet.has(c.id) || links[c.id] === id));
      const linked = (linkedTo.get(id) || []).filter((c) => !base.includes(c));
      const ex = extraTo.get(id) || [];
      let list = [...base, ...linked, ...ex].filter((c) => !hidden[c.id]);
      const ord = orderFor(p, pg.id, id);
      if (ord) {
        const rank = new Map(ord.map((k, i) => [k, i]));
        list = list.slice().sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e6) - (rank.has(b.id) ? rank.get(b.id) : 1e6) || a.name.localeCompare(b.name));
      }
      return list;
    }
    const seen = new Set();
    function build(x, level) {
      seen.add(x.id);
      const all = candidates(x.id).filter((c) => !seen.has(c.id));
      const open = !collapsed[x.id] && (pg.depth === 0 || level < pg.depth || expanded[x.id]);
      const node = { id: x.id, p: x, level, kids: [], hiddenKids: 0, layout: layoutFor(p, pg.id, x.id), extra: !!x.isExtra };
      const style = styleFor(p, pg.id, x.id);
      node.style = style !== "auto" ? style : passiveSet.has(x.id) ? "passive" : "standard";
      if (open) node.kids = all.map((c) => build(c, level + 1));
      else node.hiddenKids = all.length;
      node.collapsed = !!collapsed[x.id];
      node.expandedBeyond = !!expanded[x.id] && pg.depth !== 0 && level >= pg.depth;
      return node;
    }
    const roots = pg.roots.map((id) => ix.byId.get(id)).filter((x) => x && !hidden[x.id]).map((x) => build(x, 0));
    if (pg.id === "overview" && roots[0] && !(st.layouts && st.layouts[roots[0].id])) roots[0].layout = "grid";
    const context = pg.context.map((id) => ix.byId.get(id)).filter(Boolean).map((x) => ({ id: x.id, p: x, level: -1, kids: [], hiddenKids: 0, style: styleFor(p, pg.id, x.id) === "standard" ? "standard" : "passive", context: true }));
    return { roots, context };
  }

  /* ---------------------------------------------------------------- health checks */
  function health(p) {
    const ix = index(p);
    const issues = [];
    const add = (kind, level, msg, ids = [], fix = null) => issues.push({ kind, level, msg, ids, fix });
    if (!ix.byId.get(p.ceoId)) add("ceo", "error", "No top leader (CEO) is set. Choose one in Settings.");
    p.executiveIds.forEach((id) => { const x = ix.byId.get(id); if (!x) add("exec", "warn", "An executive in Settings no longer exists."); else if (x.status === "inactive") add("exec", "warn", `${x.name} is listed as an executive but is inactive.`, [id]); });
    for (const x of ix.active) {
      if (x.id === p.ceoId) continue;
      if (!x.managerId) add("nomgr", "warn", `${x.name} has no manager.`, [x.id]);
      else {
        const m = ix.byId.get(x.managerId);
        if (!m) add("badmgr", "error", `${x.name}'s manager no longer exists.`, [x.id]);
        else if (m.status === "inactive") add("inactivemgr", "error", `${x.name} reports to ${m.name}, who is inactive.`, [x.id, m.id]);
      }
      if (!x.department) add("nodept", "info", `${x.name} has no department, so they only appear on executive pages.`, [x.id]);
    }
    // cycles
    const state = new Map();
    for (const x of ix.active) {
      if (state.get(x.id)) continue;
      const path = []; let cur = x; const onPath = new Set();
      while (cur && !state.get(cur.id)) {
        if (onPath.has(cur.id)) { const loop = path.slice(path.indexOf(cur.id)); add("cycle", "error", `Reporting loop: ${loop.map((id) => ix.byId.get(id).name).join(" → ")} → ${cur.name}.`, loop); break; }
        onPath.add(cur.id); path.push(cur.id);
        cur = cur.managerId ? ix.byId.get(cur.managerId) : null;
      }
      path.forEach((id) => state.set(id, 1));
    }
    // not connected to the CEO
    if (ix.byId.get(p.ceoId)) {
      const reach = descendants(p, p.ceoId);
      const lost = ix.active.filter((x) => x.id !== p.ceoId && !reach.has(x.id) && x.managerId && ix.byId.get(x.managerId));
      if (lost.length) add("orphan", "warn", `${lost.length} ${lost.length === 1 ? "person isn't" : "people aren't"} connected to ${ix.byId.get(p.ceoId).name}'s organization.`, lost.map((x) => x.id));
    }
    // duplicates
    const dup = (field, label) => {
      const m = new Map();
      ix.active.forEach((x) => { const v = norm(x[field]); if (!v || (field === "name" && x.type === "vacant")) return; if (!m.has(v)) m.set(v, []); m.get(v).push(x.id); });
      for (const ids of m.values()) if (ids.length > 1) add("dup", "warn", `${ids.length} people share the ${label} “${ix.byId.get(ids[0])[field]}”.`, ids);
    };
    dup("name", "name"); dup("employeeNumber", "employee number"); dup("email", "email");
    unitGroups(p).filter((g) => !g.owner).forEach((g) => add("unitowner", "info", `${g.name} doesn't roll up to an executive. It's listed under “Other Departments”.`, []));
    const order = { error: 0, warn: 1, info: 2 };
    return issues.sort((a, b) => order[a.level] - order[b.level]);
  }

  /* Would making `mgrId` the manager of `id` create a loop? */
  const wouldLoop = (p, id, mgrId) => id === mgrId || descendants(p, id).has(mgrId);

  function newPersonId(p, name) {
    let base = slug(name || "person"); if (base === "item") base = "person";
    let id = base, n = 2;
    while (p.people[id]) id = `${base}-${n++}`;
    return id;
  }

  function stats(p) {
    const ix = index(p);
    const a = ix.active;
    return {
      people: a.filter((x) => x.type !== "vacant").length, vacant: a.filter((x) => x.type === "vacant").length,
      contractors: a.filter((x) => x.type === "contractor").length, leave: a.filter((x) => x.status === "leave").length,
      units: unitNames(p).length, managers: a.filter((x) => (ix.kids.get(x.id) || []).length).length,
    };
  }

  return {
    LAYOUTS, STATUS, TYPES, emptyProject, normalize, importAny, fromV44, extractFromV44Html, looksLikeV44,
    index, touch, person, childrenOf, descendants, headcount, chain, execOwner, isBranch, unitNames, unitGroups,
    pages, pageById, pageState, homePage, pagesWith, pageTree, layoutFor, styleFor, orderFor, health, wouldLoop, newPersonId, stats,
  };
})();
