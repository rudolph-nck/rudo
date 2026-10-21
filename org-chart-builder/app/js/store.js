/* store.js — the open project, how changes are saved, undo/redo and live sync.

   Every edit is a list of small ops ({op:"set"|"merge", path, value}) applied to the in-memory project at once and
   queued for saving. Undo/redo are the inverse ops, computed when the change is made.
     • Server mode (opened from server.py): ops are sent in order to /api/ops. Every 4 s the page asks for the current
       revision; when someone else changed the chart it reloads it and re-applies anything not yet sent. Nobody has to
       "check out" the chart and nobody can overwrite someone else's newer work wholesale.
     • Local mode (index.html opened as a file): the project, its history and published versions live in this
       browser's IndexedDB. Use Download project / Open project to move work between computers. */
OC.store = (() => {
  const { clone, isObj, now, uid, toast, debounce } = OC.u;
  const listeners = {};
  const on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)));
  const emit = (ev, ...a) => (listeners[ev] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });

  let doc = null;
  let mode = "local";
  let serverInfo = null;
  let knownRev = 0;
  const undoStack = [], redoStack = [];
  const outbox = [];
  let sending = false, status = "saved", lastError = "";
  const clientId = uid("c");

  /* ---------- ops (mirror of server.py apply_ops) ---------- */
  function walk(root, path, create) {
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (!isObj(cur[k])) { if (!create) return null; cur[k] = {}; }
      cur = cur[k];
    }
    return cur;
  }
  function applyOps(d, ops) {
    for (const op of ops) {
      const path = op.path || [];
      if (!path.length) continue;
      const cur = walk(d, path, true);
      const last = path[path.length - 1];
      if (op.op === "set") {
        if (op.value === null || op.value === undefined) delete cur[last];
        else cur[last] = clone(op.value);
      } else if (op.op === "merge") {
        if (!isObj(cur[last])) cur[last] = {};
        for (const [k, v] of Object.entries(op.value || {})) {
          if (v === null || v === undefined) delete cur[last][k];
          else cur[last][k] = clone(v);
        }
      }
    }
    return d;
  }
  function inverseOf(d, ops) {
    const inv = [];
    for (const op of ops) {
      const path = op.path || [];
      const parent = walk(d, path, false);
      const last = path[path.length - 1];
      const curVal = parent ? parent[last] : undefined;
      if (op.op === "set") inv.unshift({ op: "set", path, value: curVal === undefined ? null : clone(curVal) });
      else if (op.op === "merge") {
        if (!isObj(curVal)) inv.unshift({ op: "set", path, value: curVal === undefined ? null : clone(curVal) });
        else {
          const back = {};
          for (const k of Object.keys(op.value || {})) back[k] = curVal[k] === undefined ? null : clone(curVal[k]);
          inv.unshift({ op: "merge", path, value: back });
        }
      }
    }
    return inv;
  }

  /* ---------- IndexedDB key/value (local mode) ---------- */
  function idb() {
    if (idb._p) return idb._p;
    idb._p = new Promise((res, rej) => {
      const req = indexedDB.open("org-chart-builder", 1);
      req.onupgradeneeded = () => ["kv", "history", "published"].forEach((s) => req.result.objectStoreNames.contains(s) || req.result.createObjectStore(s));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return idb._p;
  }
  async function tx(store, rw, fn) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction(store, rw ? "readwrite" : "readonly");
      let out; const r = fn(t.objectStore(store));
      if (r && "onsuccess" in r) r.onsuccess = () => (out = r.result);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  }
  const iget = (s, k) => tx(s, false, (st) => st.get(k));
  const iput = (s, k, v) => tx(s, true, (st) => st.put(v, k));
  const iall = (s) => tx(s, false, (st) => st.getAll());
  const ikeys = (s) => tx(s, false, (st) => st.getAllKeys());
  const idel = (s, k) => tx(s, true, (st) => st.delete(k));

  /* ---------- server API ---------- */
  async function api(method, path, body) {
    const opts = { method, cache: "no-store", headers: {} };
    if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) { const e = new Error((data && data.error) || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  /* ---------- identity ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } }
  let userName = lsGet("ocb.name") || "";
  const user = () => userName;
  function setUser(n) { userName = String(n || "").trim(); lsSet("ocb.name", userName); emit("user", userName); }

  /* ---------- load ---------- */
  async function init() {
    if (location.protocol.startsWith("http")) {
      try {
        const j = await (await fetch("api/ping", { cache: "no-store" })).json();
        if (j && j.server === "org-chart-builder") { mode = "server"; serverInfo = j; }
      } catch { /* static hosting or offline → local */ }
    }
    if (mode === "server") {
      const r = await api("GET", "api/project");
      if (r.doc) { doc = OC.model.normalize(r.doc); knownRev = doc.rev || 0; }
      // ops that never reached the server (tab closed while offline) are re-sent now
      const saved = lsGet("ocb.outbox");
      if (saved && doc) {
        try { const o = JSON.parse(saved); if (Array.isArray(o) && o.length) { o.forEach((x) => { applyOps(doc, x.ops); outbox.push(x); }); toast(`Re-sending ${o.length} unsaved change${o.length > 1 ? "s" : ""} from your last session`, "info"); flush(); } } catch { /* ignore */ }
      }
      startPolling();
    } else {
      const d = await iget("kv", "project");
      if (d) { doc = OC.model.normalize(d); knownRev = doc.rev || 0; }
    }
    if (doc) OC.model.touch(doc);
    return doc;
  }

  /* ---------- change ---------- */
  function change(ops, label = "Change", { undoable = true } = {}) {
    ops = ops.filter(Boolean);
    if (!ops.length || !doc) return;
    const inv = inverseOf(doc, ops);
    applyOps(doc, ops);
    OC.model.touch(doc);
    if (undoable) { undoStack.push({ ops, inv, label }); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }
    queue(ops);
    emit("change", { label, ops });
  }
  function undo() {
    const u = undoStack.pop(); if (!u) return toast("Nothing to undo", "info", 1200);
    applyOps(doc, u.inv); OC.model.touch(doc); redoStack.push(u); queue(u.inv);
    emit("change", { label: "Undo " + u.label, ops: u.inv, undo: true });
    toast(`Undid: ${u.label}`, "info", 1600);
  }
  function redo() {
    const u = redoStack.pop(); if (!u) return toast("Nothing to redo", "info", 1200);
    applyOps(doc, u.ops); OC.model.touch(doc); undoStack.push(u); queue(u.ops);
    emit("change", { label: u.label, ops: u.ops, redo: true });
    toast(`Redid: ${u.label}`, "info", 1600);
  }
  const canUndo = () => undoStack.length > 0, canRedo = () => redoStack.length > 0;
  const lastLabel = () => (undoStack.length ? undoStack[undoStack.length - 1].label : "");

  function setStatus(s, err = "") { status = s; lastError = err; emit("status", { status, error: err, pending: outbox.length }); }

  function queue(ops) {
    if (mode === "server") { outbox.push({ ops, at: now() }); persistOutbox(); flush(); }
    else saveLocalSoon();
  }
  function persistOutbox() { lsSet("ocb.outbox", outbox.length ? JSON.stringify(outbox) : null); }
  let retryMs = 1000, retryT = null;
  async function flush() {
    if (sending || !outbox.length) { if (!outbox.length && !sending) setStatus("saved"); return; }
    sending = true; setStatus("saving");
    // send everything queued so far as one batch, in order
    const batch = outbox.slice();
    try {
      const r = await api("POST", "api/ops", { ops: batch.flatMap((b) => b.ops), by: userName });
      outbox.splice(0, batch.length); persistOutbox();
      const expected = knownRev + 1;
      knownRev = r.rev; doc.rev = r.rev;
      retryMs = 1000;
      if (r.rev !== expected) await pull(); // someone else saved in between: take their version + re-apply ours
      sending = false;
      if (outbox.length) flush(); else setStatus("saved");
    } catch (e) {
      sending = false;
      if (e.status === 400) { // the server refused these ops: drop them and reload the true state
        outbox.splice(0, batch.length); persistOutbox();
        setStatus("error", e.message); toast("A change couldn't be saved: " + e.message, "err", 6000);
        await pull();
        return;
      }
      setStatus("offline", e.message);
      clearTimeout(retryT); retryT = setTimeout(flush, retryMs); retryMs = Math.min(retryMs * 2, 20000);
    }
  }
  const saveLocalSoon = debounce(async () => {
    try {
      doc.rev = (doc.rev || 0) + 1; doc.updatedAt = now(); doc.updatedBy = userName; knownRev = doc.rev;
      await iput("kv", "project", stripRuntime(doc));
      const last = (await ikeys("history")).sort().pop();
      if (!last || now() - Number(last) > 10 * 60 * 1000) await localSnapshot("Autosave");
      setStatus("saved");
    } catch (e) { setStatus("error", e.message); toast("Couldn't save in this browser: " + e.message, "err", 6000); }
  }, 500);
  function stripRuntime(d) { const c = clone(d); delete c._v; return c; }

  async function pull() {
    const r = await api("GET", "api/project");
    if (!r.doc) return;
    const fresh = OC.model.normalize(r.doc);
    for (const b of outbox) applyOps(fresh, b.ops);
    const by = fresh.updatedBy;
    doc = fresh; knownRev = r.doc.rev || 0;
    OC.model.touch(doc);
    emit("remote", { by });
  }

  /* ---------- polling + presence (server) ---------- */
  let presence = [];
  let viewName = "", editing = false;
  function setPresence(v, ed) { viewName = v; editing = ed; }
  function startPolling() {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await api("GET", "api/rev");
        if (r.rev > knownRev && !sending && !outbox.length) { await pull(); if (r.updatedBy && r.updatedBy !== userName) toast(`Updated with ${r.updatedBy}'s changes`, "info", 2200); }
        if (status === "offline" && !outbox.length) setStatus("saved");
      } catch { if (status !== "offline") setStatus("offline", "Can't reach the server"); }
    };
    const beat = async () => {
      if (document.hidden) return;
      try { presence = (await api("POST", "api/presence", { id: clientId, name: userName || "Someone", view: viewName, editing })).items.filter((x) => x.id !== clientId); emit("presence", presence); } catch { /* ignore */ }
    };
    setInterval(tick, 4000);
    setInterval(beat, 15000); setTimeout(beat, 500);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { tick(); beat(); } });
  }
  window.addEventListener("beforeunload", (e) => {
    if (outbox.length) { persistOutbox(); e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- whole-project operations ---------- */
  async function replace(newDoc, reason = "Replaced") {
    newDoc = OC.model.normalize(clone(newDoc));
    delete newDoc._v;
    if (mode === "server") {
      while (sending || outbox.length) { await flush(); await new Promise((r) => setTimeout(r, 120)); if (status === "offline") throw new Error("The server can't be reached right now."); }
      const r = await api("PUT", "api/project", { doc: newDoc, reason, by: userName });
      doc = OC.model.normalize(r.doc); knownRev = doc.rev;
    } else {
      if (doc) await localSnapshot("Before: " + reason);
      newDoc.published = doc ? doc.published : newDoc.published;
      newDoc.rev = ((doc && doc.rev) || 0) + 1; newDoc.updatedAt = now(); newDoc.updatedBy = userName;
      await iput("kv", "project", newDoc);
      doc = newDoc; knownRev = doc.rev;
    }
    undoStack.length = 0; redoStack.length = 0;
    OC.model.touch(doc);
    emit("remote", { by: userName, replaced: true });
    return doc;
  }

  async function localSnapshot(reason) {
    if (!doc) return;
    const id = String(now());
    await iput("history", id, { meta: { id, at: now(), reason, by: userName, rev: doc.rev || 0, people: OC.model.stats(doc).people }, doc: stripRuntime(doc) });
    const keys = (await ikeys("history")).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 40))) await idel("history", k);
  }
  async function checkpoint(reason) {
    if (mode === "server") return api("POST", "api/snapshot", { reason, by: userName });
    return localSnapshot(reason);
  }
  async function historyList() {
    if (mode === "server") return (await api("GET", "api/history")).items;
    return (await iall("history")).map((x) => x.meta).sort((a, b) => b.at - a.at);
  }
  async function historyGet(id) {
    if (mode === "server") return api("GET", `api/history/${encodeURIComponent(id)}`);
    return iget("history", String(id));
  }
  async function publish(html, note) {
    if (mode === "server") {
      while (sending || outbox.length) { await flush(); await new Promise((r) => setTimeout(r, 120)); if (status === "offline") throw new Error("The server can't be reached right now."); }
      const r = await api("POST", "api/publish", { html, note, by: userName });
      await pull();
      return r.meta;
    }
    const list = await publishedList();
    const version = (list[0] ? list[0].version : 0) + 1;
    doc.rev = (doc.rev || 0) + 1;
    const meta = { version, at: now(), by: userName, note, rev: doc.rev, people: OC.model.stats(doc).people, hasHtml: true };
    const pub = stripRuntime(doc); delete pub.published;
    await iput("published", version, { meta, doc: pub, html });
    doc.published = meta;
    await iput("kv", "project", stripRuntime(doc));
    await localSnapshot(`Published v${version}`);
    OC.model.touch(doc);
    emit("change", { label: "Publish", ops: [] });
    return meta;
  }
  async function publishedList() {
    if (mode === "server") return (await api("GET", "api/published")).items;
    return (await iall("published")).map((x) => x.meta).sort((a, b) => b.version - a.version);
  }
  async function publishedGet(n) {
    if (mode === "server") return api("GET", `api/published/${n}`);
    return iget("published", Number(n));
  }
  async function publishedHtml(n) {
    if (mode === "server") return (await fetch(`published/v${n}.html`, { cache: "no-store" })).text();
    const r = await iget("published", Number(n)); return r && r.html;
  }
  const dirty = () => !!doc && (!doc.published || (doc.rev || 0) > (doc.published.rev || 0) || outbox.length > 0);

  return {
    init, change, undo, redo, canUndo, canRedo, lastLabel, applyOps, replace, checkpoint, historyList, historyGet,
    publish, publishedList, publishedGet, publishedHtml, dirty, on, user, setUser, setPresence, flush,
    get doc() { return doc; }, get mode() { return mode; }, get server() { return serverInfo; }, get status() { return status; },
    get error() { return lastError; }, get pending() { return outbox.length; }, get presence() { return presence; },
  };
})();
