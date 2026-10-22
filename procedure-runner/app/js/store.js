/* store.js — persistence.
   Two interchangeable backends with the same async API:
     • ServerBackend — talks to server.py (shared team data on disk, multi-operator runs, live sync)
     • LocalBackend  — IndexedDB in this browser only (used when opened without the server)
   Runs are updated with small "ops" (set/merge/push at a path) so two operators working different
   steps of the same run never overwrite each other. The same op semantics are implemented in server.py. */
PR.store = (() => {
  const { now, clone, isObj } = PR.u;

  /* ---------- op application (mirror of server.py apply_ops) ---------- */
  function applyOps(doc, ops) {
    for (const op of ops) {
      const path = op.path || [];
      let cur = doc;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        if (!isObj(cur[k]) && !Array.isArray(cur[k])) cur[k] = {};
        cur = cur[k];
      }
      const last = path[path.length - 1];
      if (op.ifStatus) { // only apply if the target is still in an expected state (guards stale clicks from other operators)
        const cs = (isObj(cur[last]) && cur[last].status) || "pending";
        if (!op.ifStatus.includes(cs)) continue;
      }
      if (op.op === "set") {
        if (op.value === null || op.value === undefined) delete cur[last];
        else cur[last] = clone(op.value);
      } else if (op.op === "merge") {
        if (!isObj(cur[last])) cur[last] = {};
        for (const [k, v] of Object.entries(op.value || {})) {
          if (v === null || v === undefined) delete cur[last][k];
          else cur[last][k] = clone(v);
        }
      } else if (op.op === "push") {
        if (!Array.isArray(cur[last])) cur[last] = [];
        cur[last].push(clone(op.value));
      }
    }
    return doc;
  }

  function runSummary(r) {
    const pg = r.progress || {};
    const done = pg.done || 0, total = pg.total || 0;
    return {
      id: r.id, procId: r.procId, procVersion: r.procVersion, procTitle: r.procTitle, name: r.name, status: r.status,
      practice: !!r.practice, createdAt: r.createdAt, startedAt: r.startedAt, completedAt: r.completedAt, updatedAt: r.updatedAt,
      direction: r.setup ? r.setup.primarySiteId : null, directionLabel: r.directionLabel || "", changeId: r.setup ? r.setup.changeId : "", outcome: r.completion ? r.completion.outcome : "",
      openIssues: Object.values(r.issues || {}).filter((i) => i.status !== "resolved").length,
      issues: Object.keys(r.issues || {}).length, done, total,
      approvals: Object.values(r.approvals || {}).filter((x) => x.status === "pending").map((x) => ({ id: x.id, kind: x.kind, title: x.title, stepId: x.stepId, to: x.to || [], requestedBy: x.requestedBy, requestedAt: x.requestedAt, pingAt: x.pingAt || null })),
    };
  }
  function procSummary(p) {
    const d = p.draft || {};
    return {
      id: p.id, title: d.title || p.title || "Untitled", description: d.description || "", tags: d.tags || [], status: p.status,
      publishedVersion: p.publishedVersion || 0, updatedAt: p.updatedAt, updatedBy: p.updatedBy, rev: p.rev,
      steps: (d.sections || []).reduce((a, s) => a + (s.steps || []).length, 0), hasUnpublished: !!p.dirtySincePublish,
      directional: !!(d.environments && d.environments.directional), estMin: PR.model ? PR.model.estimateMinutes(d) : 0,
    };
  }

  /* ---------- IndexedDB (local) ---------- */
  function idb() {
    if (idb._p) return idb._p;
    idb._p = new Promise((res, rej) => {
      const req = indexedDB.open("procedure-runner", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        ["procedures", "versions", "runs", "blobs", "settings"].forEach((s) => db.objectStoreNames.contains(s) || db.createObjectStore(s));
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return idb._p;
  }
  async function tx(store, mode, fn) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r && "onsuccess" in r) r.onsuccess = () => (out = r.result);
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  }
  const iget = (s, k) => tx(s, "readonly", (st) => st.get(k));
  const iput = (s, k, v) => tx(s, "readwrite", (st) => st.put(v, k));
  const idel = (s, k) => tx(s, "readwrite", (st) => st.delete(k));
  const iall = (s) => tx(s, "readonly", (st) => st.getAll());

  const LocalBackend = {
    kind: "local",
    label: "Local (this browser only)",
    async listProcedures() { return (await iall("procedures")).map(procSummary); },
    async getProcedure(id) { return (await iget("procedures", id)) || null; },
    async saveProcedure(doc, baseRev) {
      const cur = await iget("procedures", doc.id);
      if (cur && baseRev != null && cur.rev !== baseRev) { const e = new Error("conflict"); e.conflict = true; e.current = cur; throw e; }
      const next = { ...doc, rev: (cur ? cur.rev : 0) + 1, updatedAt: now() };
      await iput("procedures", doc.id, next);
      return next;
    },
    async deleteProcedure(id) { await idel("procedures", id); },
    async getVersion(id, v) { return (await iget("versions", `${id}@${v}`)) || null; },
    async putVersion(id, v, data) { await iput("versions", `${id}@${v}`, data); },
    async listRuns(procId) {
      return (await iall("runs")).filter((r) => !procId || r.procId === procId).map(runSummary);
    },
    async getRun(id) { return (await iget("runs", id)) || null; },
    async createRun(run) { run.rev = 1; run.updatedAt = now(); await iput("runs", run.id, run); return run; },
    async patchRun(id, ops) {
      const r = await iget("runs", id);
      if (!r) throw new Error("Run not found");
      applyOps(r, ops); r.rev = (r.rev || 0) + 1; r.updatedAt = now();
      await iput("runs", id, r);
      return r;
    },
    async runRev(id) { const r = await iget("runs", id); return r ? r.rev : 0; },
    async deleteRun(id) { await idel("runs", id); },
    async putAttachment(runId, blob, name) {
      const key = `att_${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await iput("blobs", key, { blob, name, type: blob.type, runId });
      return `idb:${key}`;
    },
    async attachmentURL(ref) {
      if (!ref.startsWith("idb:")) return ref;
      const rec = await iget("blobs", ref.slice(4));
      return rec ? URL.createObjectURL(rec.blob) : "";
    },
    async getSettings() { return (await iget("settings", "team")) || {}; },
    async saveSettings(s) { await iput("settings", "team", s); return s; },
  };

  /* ---------- Server (shared) ---------- */
  async function api(method, path, body, raw) {
    const opts = { method, cache: "no-store", headers: {} };
    if (raw) { opts.body = raw; opts.headers["Content-Type"] = raw.type || "application/octet-stream"; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (res.status === 409) { const e = new Error("conflict"); e.conflict = true; e.current = data && data.current; throw e; }
    if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }
  const enc = encodeURIComponent;
  const ServerBackend = {
    kind: "server",
    label: "Shared (team server)",
    async listProcedures() { return (await api("GET", "api/procedures")).items.map(procSummary); },
    async getProcedure(id) { try { return await api("GET", `api/procedures/${enc(id)}`); } catch (e) { if (/404/.test(e.message) || /not found/i.test(e.message)) return null; throw e; } },
    async saveProcedure(doc, baseRev) { return await api("PUT", `api/procedures/${enc(doc.id)}`, { doc, baseRev }); },
    async deleteProcedure(id) { await api("DELETE", `api/procedures/${enc(id)}`); },
    async getVersion(id, v) { try { return await api("GET", `api/procedures/${enc(id)}/versions/${v}`); } catch { return null; } },
    async putVersion(id, v, data) { await api("PUT", `api/procedures/${enc(id)}/versions/${v}`, data); },
    async listRuns(procId) {
      const items = (await api("GET", `api/runs${procId ? "?procId=" + enc(procId) : ""}`)).items;
      return items; // server already returns summaries
    },
    async getRun(id) { try { return await api("GET", `api/runs/${enc(id)}`); } catch { return null; } },
    async createRun(run) { return await api("POST", "api/runs", run); },
    async patchRun(id, ops) { return await api("POST", `api/runs/${enc(id)}/ops`, { ops }); },
    async runRev(id) { return (await api("GET", `api/runs/${enc(id)}/rev`)).rev; },
    async deleteRun(id) { await api("DELETE", `api/runs/${enc(id)}`); },
    async putAttachment(runId, blob, name) {
      const r = await api("POST", `api/attachments?run=${enc(runId)}&name=${enc(name || "file")}`, undefined, blob);
      return r.ref;
    },
    async attachmentURL(ref) { return ref; },
    async getSettings() { return (await api("GET", "api/settings")) || {}; },
    async saveSettings(s) { return await api("PUT", "api/settings", s); },
  };

  let backend = LocalBackend;
  async function init() {
    if (location.protocol.startsWith("http")) {
      try {
        const r = await fetch("api/ping", { cache: "no-store" });
        const j = await r.json();
        if (j && j.server === "procedure-runner") { backend = ServerBackend; backend.info = j; }
      } catch { /* static hosting or offline → local */ }
    }
    return backend;
  }

  /* Run export/import helpers (also used to move runs between local and server). */
  async function exportRunBundle(run) {
    const r = clone(run);
    const atts = {};
    for (const iss of Object.values(r.issues || {})) {
      for (const ev of iss.evidence || []) if (ev.ref && ev.ref.startsWith("idb:")) {
        const url = await backend.attachmentURL(ev.ref);
        const blob = await (await fetch(url)).blob();
        atts[ev.ref] = await PR.u.fileToDataURL(blob);
      }
    }
    return { kind: "procedure-runner/run", version: 3, run: r, attachments: atts };
  }

  const urlCache = new Map();
  async function resolveURL(ref) {
    if (!ref) return "";
    if (ref.startsWith("data:") || /^https?:|^\//.test(ref) || ref.startsWith("data/")) return ref;
    if (urlCache.has(ref)) return urlCache.get(ref);
    const u = await backend.attachmentURL(ref);
    urlCache.set(ref, u);
    return u;
  }

  return {
    init, applyOps, runSummary, procSummary, exportRunBundle, resolveURL,
    get b() { return backend; },
    get kind() { return backend.kind; },
    get label() { return backend.label; },
  };
})();
