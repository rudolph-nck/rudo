/* builder.js — website-builder style procedure editor.
   Left: Outline (drag to reorder) / Add (drag steps & components onto the canvas).
   Center: canvas of sections → steps → components.  Right: inspector for the selection. */
PR.views.builder = (() => {
  const { h, $, $$, esc, toast, modal, confirmBox, promptBox, menu, uid, clone, now, fmtMin, debounce } = PR.u;
  const S = () => PR.store.b;

  let doc, proc, sel, multi, undoStack, redoStack, dirty, leftTab, compact, outlineQ, collapsedOutline;
  let editSnap = null; // snapshot taken on focus of an inline editor, pushed on first change
  let editGen = 0;     // bumps on every change, so a save only clears "dirty" if nothing changed meanwhile

  /* ======================= lifecycle ======================= */
  async function mount(el, id) {
    doc = await S().getProcedure(id);
    if (!doc) { el.appendChild(h("div.empty", h("div.empty-title", "Procedure not found"), h("a.btn", { href: "#/" }, "Back"))); return; }
    proc = M().normalize(clone(doc.draft));
    sel = null; multi = new Set(); undoStack = []; redoStack = []; dirty = false;
    leftTab = PR.app.LS.get("bldLeft", "add"); compact = PR.app.LS.get("bldCompact", false); outlineQ = ""; collapsedOutline = new Set();
    el.appendChild(h("div.bld",
      h("div.bld-bar#bldBar"),
      h("div.bld-main", h("aside.bld-left#bldLeft"), h("div.bld-canvas.builder-canvas#bldCanvas"), h("aside.bld-insp#bldInsp"))));
    renderAll();
    document.addEventListener("keydown", onKey);
    PR.app.dirty = () => dirty;
    dropLine();
  }
  async function unmount() {
    document.removeEventListener("keydown", onKey);
    if (dirty) await save.flush();
    PR.app.dirty = null;
    const dl = $("#dropLine"); if (dl) dl.remove();
  }
  function M() { return PR.model; }

  /* ======================= state changes ======================= */
  function snap() { undoStack.push(JSON.stringify(proc)); if (undoStack.length > 100) undoStack.shift(); redoStack = []; }
  function changed(render = "all") {
    dirty = true; editGen++; setSaveState("Unsaved…"); save();
    if (render === "all") renderAll();
    else if (render === "canvas") { renderCanvas(); renderOutline(); renderInspector(); }
    else if (render && render.step) { rerenderStep(render.step); renderOutline(); if (render.insp !== false) renderInspector(); }
    renderBar();
  }
  function mutate(fn, render = "all") { snap(); fn(); changed(render); }
  function beginEdit() { editSnap = JSON.stringify(proc); }
  function editing() { if (editSnap) { undoStack.push(editSnap); redoStack = []; editSnap = null; } dirty = true; editGen++; setSaveState("Unsaved…"); save(); }

  function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(proc)); proc = JSON.parse(undoStack.pop()); changed(); toast("Undone", "info", 900); }
  function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(proc)); proc = JSON.parse(redoStack.pop()); changed(); toast("Redone", "info", 900); }

  let savingP = null;
  async function doSave() {
    while (savingP) await savingP; // one save at a time; flush() waits for an in-flight one
    if (!dirty) return;
    const gen = editGen;
    savingP = (async () => {
      try {
        doc.draft = clone(proc); doc.dirtySincePublish = true; doc.updatedBy = PR.app.me;
        doc = await S().saveProcedure(doc, doc.rev);
        if (editGen === gen) { dirty = false; setSaveState("Saved"); }
      } catch (e) {
        if (e.conflict) await resolveConflict(e.current);
        else { setSaveState("Save failed — retrying"); setTimeout(() => save(), 3000); }
      }
    })();
    try { await savingP; } finally { savingP = null; }
    if (dirty && editGen !== gen) return doSave(); // edits arrived while saving
  }
  const save = debounce(doSave, 700);
  async function resolveConflict(current) {
    const v = await modal({
      title: "Someone else edited this procedure", size: "sm", dismissable: false,
      body: h("div", `${current && current.updatedBy ? current.updatedBy : "Another user"} saved changes while you were editing.`),
      actions: [{ label: "Load their version", value: "theirs" }, { spacer: true }, { label: "Keep mine (overwrite)", kind: "danger", value: "mine" }],
    });
    if (v === "theirs") { doc = current; proc = M().normalize(clone(doc.draft)); dirty = false; renderAll(); setSaveState("Loaded latest"); }
    else { doc.rev = current.rev; dirty = true; save(); }
  }
  function setSaveState(t) { const s = $("#saveState"); if (s) { s.textContent = t; s.className = "save-state " + (t === "Saved" ? "ok" : /fail/i.test(t) ? "err" : ""); } }

  /* ======================= selection ======================= */
  function select(kind, id, { add = false, scroll = false } = {}) {
    if (kind === "step" && add) {
      if (multi.has(id)) multi.delete(id); else multi.add(id);
      if (sel && sel.kind === "step" && !multi.size) multi.add(sel.id);
      sel = multi.size ? { kind: "step", id } : null;
    } else { multi = new Set(kind === "step" ? [id] : []); sel = kind ? { kind, id } : null; }
    applySelection();
    renderInspector();
    if (scroll) { const n = $(`[data-${kind === "section" ? "sec" : kind}-id="${id}"]`, $("#bldCanvas")); n && n.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }
  function applySelection() {
    $$(".is-sel").forEach((n) => n.classList.remove("is-sel"));
    $$(".is-multi").forEach((n) => n.classList.remove("is-multi"));
    if (!sel) return;
    if (sel.kind === "step") multi.forEach((id) => $$(`[data-step-id="${id}"]`).forEach((n) => n.classList.add(multi.size > 1 ? "is-multi" : "is-sel")));
    else $$(`[data-${sel.kind === "section" ? "sec" : sel.kind}-id="${sel.id}"]`).forEach((n) => n.classList.add("is-sel"));
  }
  function selectedStep() {
    if (!sel) return null;
    if (sel.kind === "step") return M().findStep(proc, sel.id);
    if (sel.kind === "block") { const f = M().findBlock(proc, sel.id); return f ? { step: f.step, section: f.section } : null; }
    return null;
  }

  /* ======================= structural ops ======================= */
  function locStep(id) { for (const sec of proc.sections) { const i = sec.steps.findIndex((s) => s.id === id); if (i >= 0) return { sec, i }; } return null; }
  function locSec(id) { const i = proc.sections.findIndex((s) => s.id === id); return i >= 0 ? i : null; }

  function insertStep(step, { secId, index } = {}) {
    let sec = secId ? proc.sections.find((s) => s.id === secId) : null;
    if (!sec) {
      const cur = selectedStep();
      if (cur) { sec = cur.section; index = sec.steps.indexOf(cur.step) + 1; }
      else if (sel && sel.kind === "section") sec = proc.sections.find((s) => s.id === sel.id);
      else sec = proc.sections[proc.sections.length - 1];
    }
    if (!sec) { sec = M().newSection({ title: "Section 1" }); proc.sections.push(sec); }
    if (index == null) index = sec.steps.length;
    if (!step.num) step.num = nextNum(sec, index);
    sec.steps.splice(index, 0, step);
    return step;
  }
  function nextNum(sec, index) {
    const prev = sec.steps[index - 1] || (() => { const all = M().allSteps(proc); const firstOfSec = all.findIndex((x) => x.section === sec); return firstOfSec > 0 ? all[firstOfSec - 1].step : null; })();
    const n = prev && /^\d+$/.test(prev.num) ? Number(prev.num) + 1 : M().allSteps(proc).length + 1;
    return String(n);
  }
  function addBlock(type, { stepId, index } = {}) {
    let target = stepId ? M().findStep(proc, stepId) : selectedStep();
    snap();
    if (!target) {
      const st = insertStep(M().newStep({ title: PR.blocks.def(type).label }));
      target = M().findStep(proc, st.id);
    }
    const b = M().newBlock(type);
    const blocks = target.step.blocks;
    if (index == null) index = sel && sel.kind === "block" && blocks.findIndex((x) => x.id === sel.id) >= 0 ? blocks.findIndex((x) => x.id === sel.id) + 1 : blocks.length;
    blocks.splice(index, 0, b);
    sel = { kind: "block", id: b.id }; multi = new Set();
    changed();
    setTimeout(() => select("block", b.id, { scroll: true }), 0);
  }
  function addStepFromTemplate(tplId, opts = {}) {
    const tpl = STEP_TEMPLATES.find((t) => t.id === tplId);
    if (tpl.id === "section") return addSection(opts.sectionIndex);
    snap();
    const st = insertStep(tpl.make(), opts);
    sel = { kind: "step", id: st.id }; multi = new Set([st.id]);
    changed();
    setTimeout(() => { select("step", st.id, { scroll: true }); const t = $(`[data-step-id="${st.id}"] .st-title`); t && t.select(); }, 0);
  }
  function addSection(index) {
    snap();
    const sec = M().newSection({ title: "New section" });
    if (index == null) { const i = sel && sel.kind === "section" ? locSec(sel.id) : selectedStep() ? proc.sections.indexOf(selectedStep().section) : proc.sections.length - 1; index = i + 1; }
    proc.sections.splice(index, 0, sec);
    sel = { kind: "section", id: sec.id };
    changed();
    setTimeout(() => { select("section", sec.id, { scroll: true }); const t = $(`[data-sec-id="${sec.id}"] .sec-title`); t && t.select(); }, 0);
  }
  function moveStep(stepId, toSecId, toIndex) {
    const from = locStep(stepId); if (!from) return;
    const to = proc.sections.find((s) => s.id === toSecId); if (!to) return;
    const [st] = from.sec.steps.splice(from.i, 1);
    if (from.sec === to && from.i < toIndex) toIndex--;
    to.steps.splice(toIndex, 0, st);
  }
  function moveBlock(blockId, toStepId, toIndex) {
    const f = M().findBlock(proc, blockId); const to = M().findStep(proc, toStepId);
    if (!f || !to) return;
    f.step.blocks.splice(f.index, 1);
    if (f.step === to.step && f.index < toIndex) toIndex--;
    to.step.blocks.splice(toIndex, 0, f.block);
  }
  function duplicateSel() {
    if (!sel) return;
    snap();
    if (sel.kind === "block") {
      const f = M().findBlock(proc, sel.id); const c = clone(f.block); c.id = uid("b");
      f.step.blocks.splice(f.index + 1, 0, c); sel = { kind: "block", id: c.id };
    } else if (sel.kind === "step") {
      const ids = [...multi];
      let lastId = null;
      ids.forEach((id) => {
        const l = locStep(id); const c = clone(l.sec.steps[l.i]); c.id = uid("st"); c.blocks.forEach((b) => (b.id = uid("b")));
        (c.blocks || []).forEach((b) => (b.items || []).forEach((it) => (it.id = uid("ci"))));
        l.sec.steps.splice(l.i + 1, 0, c); lastId = c.id;
      });
      sel = { kind: "step", id: lastId }; multi = new Set([lastId]);
    } else if (sel.kind === "section") {
      const i = locSec(sel.id); const c = clone(proc.sections[i]); c.id = uid("sec");
      c.steps.forEach((s) => { s.id = uid("st"); s.blocks.forEach((b) => (b.id = uid("b"))); });
      proc.sections.splice(i + 1, 0, c); sel = { kind: "section", id: c.id };
    }
    changed(); toast("Duplicated", "ok", 1000);
  }
  async function deleteSel() {
    if (!sel) return;
    if (sel.kind === "block") {
      mutate(() => { const f = M().findBlock(proc, sel.id); f.step.blocks.splice(f.index, 1); sel = { kind: "step", id: f.step.id }; multi = new Set([f.step.id]); });
    } else if (sel.kind === "step") {
      const ids = [...multi];
      const hasContent = ids.some((id) => (M().findStep(proc, id).step.blocks || []).length);
      if (hasContent && ids.length > 1 && !(await confirmBox("Delete steps?", `Delete ${ids.length} steps and their components? (Ctrl+Z to undo)`, { ok: "Delete", kind: "danger" }))) return;
      mutate(() => { ids.forEach((id) => { const l = locStep(id); l && l.sec.steps.splice(l.i, 1); }); sel = null; multi = new Set(); });
      toast(`Deleted ${ids.length} step${ids.length > 1 ? "s" : ""} — Ctrl+Z to undo`, "info");
    } else if (sel.kind === "section") {
      const i = locSec(sel.id); const sec = proc.sections[i];
      if (sec.steps.length && !(await confirmBox("Delete section?", `"${sec.title}" has ${sec.steps.length} steps. Delete the section and its steps?`, { ok: "Delete", kind: "danger" }))) return;
      mutate(() => { proc.sections.splice(i, 1); sel = null; });
    }
  }

  /* ======================= step templates ======================= */
  const B = (t, o) => M().newBlock(t, o);
  const STEP_TEMPLATES = [
    { id: "blank", icon: "▭", label: "Blank step", make: () => M().newStep({ title: "New step", blocks: [B("text")] }) },
    { id: "comm", icon: "☎", label: "Communication", make: () => M().newStep({ title: "Notify …", category: "Communication", blocks: [B("contact")] }) },
    { id: "validate", icon: "✔", label: "Validation", make: () => M().newStep({ title: "Validate …", category: "Validation", blocks: [B("validation"), B("evidence")] }) },
    { id: "decision", icon: "⚖", label: "Go / No-Go", make: () => M().newStep({ title: "Decision point", category: "Decisioning", critical: true, hold: true, blocks: [B("decision")] }) },
    { id: "record", icon: "✎", label: "Record a value", make: () => M().newStep({ title: "Record …", blocks: [B("path"), B("input", { label: "Value", variable: "" })] }) },
    { id: "command", icon: "⌘", label: "Run a command", make: () => M().newStep({ title: "Run …", category: "Processing", blocks: [B("path"), B("command")] }) },
    { id: "wait", icon: "⏳", label: "Wait", make: () => M().newStep({ title: "Wait", blocks: [B("timer")] }) },
    { id: "signoff", icon: "✍", label: "Sign-off", make: () => M().newStep({ title: "Approval", category: "Approval", hold: true, blocks: [B("approval")] }) },
    { id: "milestone", icon: "🏁", label: "Milestone", make: () => M().newStep({ title: "Milestone reached", category: "Milestone", blocks: [] }) },
    { id: "section", icon: "▤", label: "Section", make: null },
  ];

  /* ======================= drag & drop ======================= */
  let drag = null;
  function dropLine() { if (!$("#dropLine")) document.body.appendChild(h("div#dropLine")); }
  function showLine(container, y) {
    const r = container.getBoundingClientRect(); const l = $("#dropLine");
    Object.assign(l.style, { display: "block", left: r.left + 6 + "px", width: r.width - 12 + "px", top: y - 2 + "px" });
  }
  function hideLine() { const l = $("#dropLine"); if (l) l.style.display = "none"; }
  function startDrag(e, d) {
    drag = d; e.stopPropagation();
    e.dataTransfer.effectAllowed = d.kind.startsWith("new") ? "copy" : "move";
    e.dataTransfer.setData("text/plain", d.kind);
    document.body.classList.add("dragging", "drag-" + d.kind);
  }
  document.addEventListener("dragend", () => { drag = null; hideLine(); document.body.className = document.body.className.replace(/\bdrag(ging|-\S+)\b/g, "").trim(); $$(".drop-hover").forEach((n) => n.classList.remove("drop-hover")); });

  /* Make `container` accept drops. items(): child nodes in order. accepts(drag): bool. drop(index, drag). */
  function zone(container, { items, accepts, drop }) {
    const idx = (e) => {
      const list = items();
      for (let i = 0; i < list.length; i++) { const r = list[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) return { i, y: r.top - 3 }; }
      const last = list[list.length - 1];
      const cr = container.getBoundingClientRect();
      return { i: list.length, y: last ? last.getBoundingClientRect().bottom + 3 : cr.top + 14 };
    };
    container.addEventListener("dragover", (e) => {
      if (!drag || !accepts(drag)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = drag.kind.startsWith("new") ? "copy" : "move";
      const { y } = idx(e); showLine(container, y);
      container.classList.add("drop-hover");
    });
    container.addEventListener("dragleave", (e) => { if (!container.contains(e.relatedTarget)) container.classList.remove("drop-hover"); });
    container.addEventListener("drop", (e) => {
      if (!drag || !accepts(drag)) return;
      e.preventDefault(); e.stopPropagation();
      const d = drag; const { i } = idx(e);
      drag = null; hideLine(); container.classList.remove("drop-hover");
      drop(i, d);
    });
  }

  /* ======================= rendering ======================= */
  function renderAll() { renderBar(); renderLeft(); renderCanvas(); renderInspector(); renderLists(); }
  function renderLists() {
    let host = $("#bldLists");
    if (!host) { host = h("div#bldLists"); $("#bldCanvas").parentNode.append(host); }
    const all = M().allSteps(proc).map((x) => x.step);
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    const dl = (id, vals) => h(`datalist#${id}`, vals.map((v) => h("option", { value: v })));
    host.innerHTML = "";
    host.append(dl("catList", uniq([...Object.keys(M().CATEGORIES), ...all.map((s) => s.category)])), dl("ownerList", uniq(["Core", "Network", ...all.map((s) => s.owner)])),
      dl("windowList", uniq(["As soon as date selected", "Morning of", "1 hour before start", "During window", "After window", ...all.map((s) => s.window)])),
      dl("contactList", uniq(proc.contacts.map((c) => c.name))));
  }

  function renderBar() {
    const bar = $("#bldBar"); if (!bar) return;
    const lint = M().lint(proc);
    const errs = lint.filter((l) => l.level === "error").length;
    bar.innerHTML = "";
    bar.append(
      h("a.icon-btn", { href: "#/", title: "Back to library" }, "←"),
      h("input.bld-title", { value: proc.title, title: "Procedure name", onfocus: beginEdit, oninput: (e) => { proc.title = e.target.value; editing(); } }),
      PR.app.statusChip(doc.status), doc.publishedVersion ? h("span.chip.c-gray", `v${doc.publishedVersion}${doc.dirtySincePublish ? " + edits" : ""}`) : null,
      h("span#saveState.save-state", dirty ? "Unsaved…" : "Saved"),
      h("div.spacer"),
      h("span.muted.small", `${M().allSteps(proc).length} steps · ~${fmtMin(M().estimateMinutes(proc)) || "0m"}`),
      h("button.icon-btn", { type: "button", title: "Undo (Ctrl+Z)", disabled: !undoStack.length, onclick: undo }, "↶"),
      h("button.icon-btn", { type: "button", title: "Redo (Ctrl+Y)", disabled: !redoStack.length, onclick: redo }, "↷"),
      h(`button.btn.btn-ghost${compact ? ".on" : ""}`, { type: "button", title: "Collapse step contents to reorder quickly", onclick: () => { compact = !compact; PR.app.LS.set("bldCompact", compact); renderBar(); renderCanvas(); } }, compact ? "☰ Compact" : "☰ Detailed"),
      h("button.btn.btn-ghost", { type: "button", onclick: () => openSettings() }, "⚙ Settings"),
      h(`button.btn.btn-ghost${lint.length ? ".lint" : ""}`, { type: "button", title: "Checks before publishing", onclick: () => showLint() }, lint.length ? `${errs ? "⛔" : "⚠"} ${lint.length}` : "✓ Checks"),
      h("button.btn", { type: "button", title: "Try the draft in the runner (not counted in history)", onclick: async () => { await save.flush(); PR.runner.startNew(proc.id, { practice: true }); } }, "🧪 Practice"),
      h("button.btn.btn-primary", { type: "button", onclick: publish }, "Publish"));
  }

  function renderLeft() {
    const el = $("#bldLeft"); if (!el) return;
    el.innerHTML = "";
    el.append(h("div.tabs", [["add", "＋ Add"], ["outline", "☰ Outline"]].map(([k, l]) => h(`button.tab${leftTab === k ? ".on" : ""}`, { type: "button", onclick: () => { leftTab = k; PR.app.LS.set("bldLeft", k); renderLeft(); } }, l))));
    if (leftTab === "add") renderPalette(el); else renderOutline();
  }
  function renderPalette(el) {
    const tile = (kind, payload, icon, label, desc, onClick) => h("div.tile", {
      draggable: "true", title: desc || label,
      ondragstart: (e) => startDrag(e, { kind, payload }), onclick: onClick,
    }, h("span.tile-ic", icon), h("span.tile-l", label));
    el.append(h("div.pal",
      h("div.pal-hint", "Drag onto the canvas, or click to add after the selection."),
      h("div.pal-h", "Steps"),
      h("div.tile-grid", STEP_TEMPLATES.map((t) => tile(t.id === "section" ? "new-section" : "new-step", t.id, t.icon, t.label, null, () => addStepFromTemplate(t.id)))),
      PR.blocks.groups().map((g) => [h("div.pal-h", g.name), h("div.tile-grid", g.items.map((d) => tile("new-block", d.type, d.icon, d.label, d.desc, () => addBlock(d.type))))])));
  }
  function renderOutline() {
    const el = $("#bldLeft"); if (!el || leftTab !== "outline") return;
    let wrap = $(".outline", el);
    const q = outlineQ.toLowerCase();
    if (!wrap) {
      el.append(h("div.outline-search", h("input.inp", { placeholder: "Find step… (number or text)", value: outlineQ, oninput: (e) => { outlineQ = e.target.value; renderOutline(); } })));
      wrap = h("div.outline"); el.append(wrap);
    }
    wrap.innerHTML = "";
    proc.sections.forEach((sec) => {
      const steps = sec.steps.filter((s) => !q || `${s.num} ${s.title}`.toLowerCase().includes(q));
      if (q && !steps.length) return;
      const col = collapsedOutline.has(sec.id) && !q;
      const list = h("div.ol-steps");
      const secNode = h("div.ol-sec", { dataset: { secId: sec.id } },
        h("div.ol-sec-h", { draggable: "true", ondragstart: (e) => startDrag(e, { kind: "section", payload: sec.id }), onclick: () => select("section", sec.id, { scroll: true }) },
          h("button.ol-tog", { type: "button", onclick: (e) => { e.stopPropagation(); col ? collapsedOutline.delete(sec.id) : collapsedOutline.add(sec.id); renderOutline(); } }, col ? "▸" : "▾"),
          h("span.ol-sec-t", sec.title || "Untitled section"), h("span.ol-count", String(sec.steps.length))),
        col ? null : list);
      steps.forEach((st) => {
        const t = M().resolveTarget(proc, st, sec, {});
        list.append(h("div.ol-step", { dataset: { stepId: st.id }, draggable: "true",
          ondragstart: (e) => startDrag(e, { kind: "step", payload: st.id }),
          onclick: (e) => select("step", st.id, { add: e.ctrlKey || e.metaKey || e.shiftKey, scroll: true }) },
        h("span.ol-num", st.num || "·"), h("span.ol-dot", { style: { background: t.color || "transparent" }, title: t.title || "No environment" }), h("span.ol-t", st.title || "Untitled"),
        st.parallel ? h("span.ol-flag", { title: "Parallel" }, "⇉") : null, st.critical ? h("span.ol-flag.crit", { title: "Critical" }, "★") : null));
      });
      if (!q) zone(list, { items: () => $$(":scope > .ol-step", list), accepts: (d) => d.kind === "step" || d.kind === "new-step", drop: (i, d) => onStepDrop(sec.id, i, d) });
      wrap.append(secNode);
    });
    if (!q) zone(wrap, { items: () => $$(":scope > .ol-sec", wrap), accepts: (d) => d.kind === "section" || d.kind === "new-section", drop: (i, d) => onSectionDrop(i, d) });
    applySelection();
  }

  function onStepDrop(secId, i, d) {
    if (d.kind === "step") mutate(() => {
      const sec = proc.sections.find((s) => s.id === secId);
      if (multi.size > 1 && multi.has(d.payload)) {
        // move every selected step (in document order) to the drop point
        const anchor = sec.steps[i];
        const ids = M().allSteps(proc).filter((x) => multi.has(x.step.id)).map((x) => x.step.id);
        if (anchor && multi.has(anchor.id)) return;
        ids.forEach((id) => moveStep(id, secId, anchor ? sec.steps.indexOf(anchor) : sec.steps.length));
      } else moveStep(d.payload, secId, i);
    });
    else if (d.kind === "new-step") addStepFromTemplate(d.payload, { secId, index: i });
    else if (d.kind === "new-block") { snap(); const st = insertStep(M().newStep({ title: PR.blocks.def(d.payload).label, blocks: [M().newBlock(d.payload)] }), { secId, index: i }); sel = { kind: "step", id: st.id }; multi = new Set([st.id]); changed(); }
    else if (d.kind === "new-section") addSection(proc.sections.findIndex((s) => s.id === secId) + 1);
  }
  function onSectionDrop(i, d) {
    if (d.kind === "new-section") return addSection(i);
    mutate(() => { const from = locSec(d.payload); const [s] = proc.sections.splice(from, 1); proc.sections.splice(from < i ? i - 1 : i, 0, s); });
  }

  function renderCanvas() {
    const c = $("#bldCanvas"); if (!c) return;
    const st = c.scrollTop;
    c.innerHTML = "";
    const head = h("div.cv-head",
      h("textarea.cv-desc", { rows: 1, placeholder: "Add a description for this procedure…", onfocus: beginEdit, oninput: (e) => { proc.description = e.target.value; autoGrow(e.target); editing(); } }, proc.description),
      proc.environments.enabled ? h("div.cv-env", "Environments: ", M().sites(proc).map((s) => PR.ui.envBadge({ kind: "site", title: s.name, code: s.code, partition: s.partition, color: s.color }, { size: "sm" })),
        proc.environments.directional ? h("span.muted.small", " · steps target roles; the run picks the direction") : null,
        h("button.link-btn", { type: "button", onclick: () => openSettings("env") }, "Edit")) :
        h("div.cv-env.muted", "No environments defined. ", h("button.link-btn", { type: "button", onclick: () => openSettings("env") }, "Add datacenters / failover direction")));
    c.append(head);
    const secs = h("div.cv-secs");
    proc.sections.forEach((sec) => secs.append(sectionNode(sec)));
    c.append(secs);
    zone(secs, { items: () => $$(":scope > .sec", secs), accepts: (d) => d.kind === "section" || d.kind === "new-section", drop: (i, d) => onSectionDrop(i, d) });
    c.append(h("div.cv-foot", h("button.btn", { type: "button", onclick: () => addSection(proc.sections.length) }, "＋ Add section")));
    c.scrollTop = st;
    $$(".cv-desc", c).forEach(autoGrow);
    applySelection();
    c.onclick = (e) => { if (e.target === c || e.target.classList.contains("cv-secs")) select(null); };
  }
  function autoGrow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }

  function sectionNode(sec) {
    const est = sec.steps.reduce((a, s) => a + (Number(s.estMin) || 0), 0);
    const list = h("div.sec-steps");
    const node = h(`div.sec${sec.collapsed ? ".collapsed" : ""}`, { dataset: { secId: sec.id } },
      h("div.sec-head", { onclick: (e) => { if (e.target.tagName !== "INPUT" && !e.target.closest("button")) select("section", sec.id); } },
        h("span.handle", { draggable: "true", title: "Drag to reorder section", ondragstart: (e) => startDrag(e, { kind: "section", payload: sec.id }) }, "⠿"),
        h("button.icon-btn.sm", { type: "button", title: sec.collapsed ? "Expand" : "Collapse", onclick: () => { sec.collapsed = !sec.collapsed; dirty = true; save(); const n = sectionNode(sec); node.replaceWith(n); applySelection(); } }, sec.collapsed ? "▸" : "▾"),
        h("input.sec-title", { value: sec.title, placeholder: "Section title", onfocus: (e) => { beginEdit(); select("section", sec.id); }, oninput: (e) => { sec.title = e.target.value; editing(); renderOutline(); } }),
        sec.phase === "post" ? h("span.chip.c-amber-o", { title: "Role labels show the post-cutover names (New Primary / New Secondary)" }, "after cutover") : null,
        h("span.muted.small", `${sec.steps.length} steps${est ? " · ~" + fmtMin(est) : ""}`),
        h("button.icon-btn.sm", { type: "button", title: "Section menu", onclick: (e) => { select("section", sec.id); menu(e.currentTarget, [
          { icon: "＋", label: "Add step", onClick: () => addStepFromTemplate("blank", { secId: sec.id, index: sec.steps.length }) },
          { icon: "⧉", label: "Duplicate section", onClick: duplicateSel },
          { icon: "⇵", label: "Renumber all steps 1…n", onClick: () => mutate(() => M().renumber(proc)) },
          { icon: "🗑", label: "Delete section", danger: true, onClick: deleteSel }], { align: "right" }); } }, "⋯")),
      sec.collapsed ? null : [sec.description ? h("div.sec-desc", sec.description) : null, list,
        h("div.sec-add",
          h("button.add-btn", { type: "button", onclick: () => addStepFromTemplate("blank", { secId: sec.id, index: sec.steps.length }) }, "＋ Step"),
          h("button.add-btn", { type: "button", onclick: (e) => menu(e.currentTarget, STEP_TEMPLATES.filter((t) => t.make).map((t) => ({ icon: t.icon, label: t.label, onClick: () => addStepFromTemplate(t.id, { secId: sec.id, index: sec.steps.length }) }))) }, "＋ From template ▾"))]);
    if (!sec.collapsed) {
      sec.steps.forEach((st) => list.append(stepNode(st, sec)));
      if (!sec.steps.length) list.append(h("div.sec-empty", "Drop steps or components here"));
      zone(list, { items: () => $$(":scope > .st-card", list), accepts: (d) => ["step", "new-step", "new-block", "new-section"].includes(d.kind), drop: (i, d) => onStepDrop(sec.id, i, d) });
    }
    return node;
  }

  function stepNode(st, sec) {
    const t = M().resolveTarget(proc, st, sec, {});
    const ctx = M().varContext({ snapshot: proc, setup: {} });
    const blocks = h("div.st-blocks");
    const node = h(`div.st-card${st.critical ? ".critical" : ""}${st.parallel ? ".parallel" : ""}`, { dataset: { stepId: st.id },
      onclick: (e) => { if (e.target.closest(".blk-wrap") || e.target.closest("button") || e.target.closest(".handle")) return; if (e.target.tagName === "INPUT") return select("step", st.id); select("step", st.id, { add: e.ctrlKey || e.metaKey || e.shiftKey }); } },
      h("div.st-head",
        h("span.handle", { draggable: "true", title: "Drag to reorder (select several with Ctrl+click to move together)", ondragstart: (e) => startDrag(e, { kind: "step", payload: st.id }) }, "⠿"),
        h("input.st-num", { value: st.num, title: "Step number (original procedure number)", onfocus: (e) => { beginEdit(); select("step", st.id); }, oninput: (e) => { st.num = e.target.value; editing(); renderOutline(); } }),
        PR.ui.envBadge(t, { size: "sm" }),
        h("input.st-title", { value: st.title, placeholder: "Step title", onfocus: (e) => { beginEdit(); if (!multi.has(st.id) || multi.size > 1) select("step", st.id); }, oninput: (e) => { st.title = e.target.value; editing(); renderOutline(); },
          onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); addStepFromTemplate("blank"); } } }),
        PR.ui.catChip(st.category),
        st.estMin ? h("span.st-flag", { title: "Estimated minutes" }, `⏱ ${st.estMin}m`) : null,
        st.parallel ? h("span.st-flag.par", { title: "Runs in parallel with the previous step" }, "⇉ parallel") : null,
        st.hold ? h("span.st-flag.hold", { title: "Hold point: cannot start until earlier required steps are done" }, "✋ hold") : null,
        st.condition ? h("span.st-flag", { title: "Only runs in one direction" }, "⇄ " + (M().siteById(proc, st.condition.slice(4)) || {}).name + " primary only") : null,
        h("button.icon-btn.sm", { type: "button", title: "Step menu", onclick: (e) => { select("step", st.id); menu(e.currentTarget, [
          { icon: "⧉", label: "Duplicate", hint: "Ctrl+D", onClick: duplicateSel },
          { icon: "＋", label: "Insert step below", onClick: () => addStepFromTemplate("blank") },
          { icon: st.critical ? "☆" : "★", label: st.critical ? "Unmark critical" : "Mark critical", onClick: () => mutate(() => (st.critical = !st.critical), { step: st.id }) },
          { icon: "⇉", label: st.parallel ? "Run after previous" : "Run in parallel with previous", onClick: () => mutate(() => (st.parallel = !st.parallel), { step: st.id }) },
          { icon: "🗑", label: "Delete", hint: "Del", danger: true, onClick: deleteSel }], { align: "right" }); } }, "⋯")),
      (st.owner || st.contact || st.window) && !compact ? h("div.st-meta", st.owner ? h("span", "👥 ", st.owner) : null, st.contact ? h("span", "☎ ", st.contact) : null, st.window ? h("span", "🕘 ", st.window) : null) : null,
      compact ? null : blocks,
      compact ? null : h("div.st-add", h("button.add-btn.sm", { type: "button", onclick: (e) => { select("step", st.id); quickAdd(e.currentTarget, st.id); } }, "＋ Component")));
    if (!compact) {
      st.blocks.forEach((b) => blocks.append(blockNode(b, st, ctx)));
      if (!st.blocks.length) blocks.append(h("div.blk-empty", "Drop components here"));
      zone(blocks, { items: () => $$(":scope > .blk-wrap", blocks), accepts: (d) => d.kind === "new-block" || d.kind === "block", drop: (i, d) => {
        if (d.kind === "new-block") { addBlock(d.payload, { stepId: st.id, index: i }); }
        else mutate(() => moveBlock(d.payload, st.id, i));
      } });
    } else {
      // In compact mode, components dropped on a step card are appended.
      zone(node, { items: () => [], accepts: (d) => d.kind === "new-block" || d.kind === "block", drop: (i, d) => d.kind === "new-block" ? addBlock(d.payload, { stepId: st.id, index: st.blocks.length }) : mutate(() => moveBlock(d.payload, st.id, st.blocks.length)) });
    }
    return node;
  }
  function quickAdd(anchor, stepId) {
    menu(anchor, PR.blocks.groups().flatMap((g) => [{ header: g.name }, ...g.items.map((d) => ({ icon: d.icon, label: d.label, onClick: () => addBlock(d.type, { stepId }) }))]));
  }

  function blockNode(b, st, ctx) {
    const def = PR.blocks.def(b.type);
    return h("div.blk-wrap", { dataset: { blockId: b.id }, onclick: (e) => { e.stopPropagation(); select("block", b.id); } },
      h("div.blk-tools",
        h("span.handle", { draggable: "true", title: "Drag to move", ondragstart: (e) => startDrag(e, { kind: "block", payload: b.id }) }, "⠿"),
        h("span.blk-type", def ? `${def.icon} ${def.label}` : b.type),
        h("button.icon-btn.xs", { type: "button", title: "Duplicate", onclick: (e) => { e.stopPropagation(); select("block", b.id); duplicateSel(); } }, "⧉"),
        h("button.icon-btn.xs", { type: "button", title: "Delete", onclick: (e) => { e.stopPropagation(); select("block", b.id); deleteSel(); } }, "✕")),
      h("div.blk-body", def ? def.preview(b, ctx) : h("div.muted", `Unknown component "${b.type}"`)));
  }
  function rerenderStep(id) {
    const f = M().findStep(proc, id); const old = $(`#bldCanvas [data-step-id="${id}"]`);
    if (f && old) { old.replaceWith(stepNode(f.step, f.section)); applySelection(); } else renderCanvas();
  }

  /* ======================= inspector ======================= */
  function renderInspector() {
    const el = $("#bldInsp"); if (!el) return;
    el.innerHTML = "";
    if (!sel) return el.append(overviewPanel());
    if (sel.kind === "step" && multi.size > 1) return el.append(bulkPanel());
    if (sel.kind === "section") { const s = proc.sections.find((x) => x.id === sel.id); return s ? el.append(sectionPanel(s)) : el.append(overviewPanel()); }
    if (sel.kind === "step") { const f = M().findStep(proc, sel.id); return f ? el.append(stepPanel(f.step, f.section)) : el.append(overviewPanel()); }
    if (sel.kind === "block") { const f = M().findBlock(proc, sel.id); return f ? el.append(blockPanel(f.block, f.step)) : el.append(overviewPanel()); }
  }
  const field = (label, ctl, help) => h("div.field", h("label.lbl", label), ctl, help ? h("div.help", help) : null);
  const row = (...kids) => h("div.frow", kids);
  function bind(obj, key, render, { type = "text", parse } = {}) {
    // returns handlers for an inspector input bound to obj[key]
    return {
      onfocus: beginEdit,
      [type === "checkbox" || type === "select" ? "onchange" : "oninput"]: (e) => {
        let v = type === "checkbox" ? e.target.checked : e.target.value;
        if (parse) v = parse(v);
        obj[key] = v; editing();
        if (render) render();
      },
    };
  }
  function insHead(title, sub, actions) { return h("div.ins-head", h("div", h("div.ins-title", title), sub ? h("div.ins-sub", sub) : null), actions ? h("div.ins-actions", actions) : null); }

  function overviewPanel() {
    const vars = M().variablesDeclared(proc);
    return h("div.ins",
      insHead("Procedure", "Nothing selected — click a step, section or component to edit it."),
      field("Description", h("textarea.inp", { rows: 3, ...bind(proc, "description", () => { const d = $(".cv-desc"); if (d) d.value = proc.description; }) }, proc.description)),
      field("Tags", h("input.inp", { value: proc.tags.join(", "), placeholder: "Symitar, Failover", onfocus: beginEdit, oninput: (e) => { proc.tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean); editing(); } })),
      h("button.btn.btn-block", { type: "button", onclick: () => openSettings() }, "⚙ Environments, run setup, contacts…"),
      h("div.ins-sec", "Variables you can use"),
      h("div.var-list", M().BUILTIN_VARS.map(([k, d]) => h("div.var-row", { onclick: () => PR.u.copyText(`{{${k}}}`), title: "Click to copy" }, h("code", `{{${k}}}`), h("span.muted", d))),
        vars.map((v) => h("div.var-row", { onclick: () => PR.u.copyText(`{{var.${v.name}}}`) }, h("code", `{{var.${v.name}}}`), h("span.muted", `captured in step ${v.step.num}`)))),
      h("div.ins-sec", "Keyboard"),
      h("div.kbd-list", [["Ctrl+Z / Ctrl+Y", "Undo / redo"], ["Ctrl+D", "Duplicate selection"], ["Del", "Delete selection"], ["Enter in a title", "New step below"], ["Ctrl+click", "Select several steps"], ["Esc", "Clear selection"]].map(([k, d]) => h("div", h("kbd", k), " ", d))));
  }

  function sectionPanel(sec) {
    return h("div.ins",
      insHead("Section", `${sec.steps.length} steps`, [h("button.icon-btn", { type: "button", title: "Duplicate", onclick: duplicateSel }, "⧉"), h("button.icon-btn.danger", { type: "button", title: "Delete", onclick: deleteSel }, "🗑")]),
      field("Title", h("input.inp", { value: sec.title, ...bind(sec, "title", () => { const t = $(`[data-sec-id="${sec.id}"] .sec-title`); if (t) t.value = sec.title; renderOutline(); }) })),
      field("Description", h("textarea.inp", { rows: 3, ...bind(sec, "description") }, sec.description)),
      proc.environments.enabled && proc.environments.directional ? field("Role labels in this section",
        h("select.inp", { ...bind(sec, "phase", () => renderCanvas(), { type: "select" }) },
          h("option", { value: "pre", selected: sec.phase !== "post" }, `Before cutover (${proc.environments.roles.primary.pre} / ${proc.environments.roles.secondary.pre})`),
          h("option", { value: "post", selected: sec.phase === "post" }, `After cutover (${proc.environments.roles.secondary.post} / ${proc.environments.roles.primary.post})`)),
        "The physical datacenter never changes — only the label of its role. Use “after cutover” once the failover command has run.") : null,
      h("div.ins-sec", "Bulk actions"),
      h("button.btn.btn-block", { type: "button", onclick: () => { multi = new Set(sec.steps.map((s) => s.id)); sel = { kind: "step", id: sec.steps[0] && sec.steps[0].id }; if (sel.id) { applySelection(); renderInspector(); } } }, "Select all steps in section"));
  }

  function targetOptions(st) {
    const env = proc.environments;
    const opts = [["none", "— Not environment-specific —"]];
    if (env.enabled) {
      if (env.directional) {
        opts.push(["primary", `${env.roles.primary.pre} (role)`], ["secondary", `${env.roles.secondary.pre} (role)`]);
      }
      opts.push(["both", "Both sites"]);
      M().sites(proc).forEach((s) => opts.push([`site:${s.id}`, `📍 ${s.name} (fixed site${s.partition ? ", " + s.partition : ""})`]));
    }
    opts.push(["custom", "Other / custom label…"]);
    return opts;
  }

  function stepPanel(st, sec) {
    const env = proc.environments;
    const refresh = () => { rerenderStep(st.id); renderOutline(); };
    const t = M().resolveTarget(proc, st, sec, {});
    const tgtPreview = h("div.tgt-preview");
    const drawPreview = () => {
      tgtPreview.innerHTML = "";
      if (!(env.enabled && env.directional && (st.target === "primary" || st.target === "secondary"))) return;
      tgtPreview.append(h("div.help", "Resolves at run time:"), M().sites(proc).map((ps) => {
        const r = M().resolveTarget(proc, st, sec, { primarySiteId: ps.id });
        return h("div.tgt-row", h("span.muted.small", `If ${ps.name} is primary →`), PR.ui.envBadge(r, { size: "sm" }));
      }));
    };
    drawPreview();
    const panel = h("div.ins",
      insHead(`Step ${st.num || ""}`, sec.title, [h("button.icon-btn", { type: "button", title: "Duplicate (Ctrl+D)", onclick: duplicateSel }, "⧉"), h("button.icon-btn.danger", { type: "button", title: "Delete (Del)", onclick: deleteSel }, "🗑")]),
      row(field("No.", h("input.inp.w-num", { value: st.num, ...bind(st, "num", refresh) })), field("Title", h("input.inp", { value: st.title, ...bind(st, "title", () => { const i = $(`[data-step-id="${st.id}"] .st-title`); if (i) i.value = st.title; renderOutline(); }) }))),
      h("div.ins-sec", "Where"),
      field("Target environment", h("select.inp", { onfocus: beginEdit, onchange: (e) => { st.target = e.target.value; editing(); refresh(); renderInspector(); } },
        targetOptions(st).map(([v, l]) => h("option", { value: v, selected: st.target === v }, l)))),
      st.target === "custom" || (!env.enabled && st.target !== "none") ? field("Label", h("input.inp", { value: st.targetLabel, placeholder: "e.g. SymDev1", ...bind(st, "targetLabel", refresh) })) : null,
      tgtPreview,
      !env.enabled ? h("div.help", "Tip: define your datacenters in ", h("button.link-btn", { type: "button", onclick: () => openSettings("env") }, "Settings → Environments"), " to get direction-aware targets.") : null,
      env.enabled && env.directional ? field("Role label phase", h("select.inp", { ...bind(st, "phase", () => { refresh(); drawPreview(); }, { type: "select" }) },
        [["", `Inherit from section (${sec.phase === "post" ? "after" : "before"} cutover)`], ["pre", "Before cutover"], ["post", "After cutover"]].map(([v, l]) => h("option", { value: v, selected: (st.phase || "") === v }, l)))) : null,
      env.enabled && env.directional ? field("Only run when", h("select.inp", { ...bind(st, "condition", refresh, { type: "select" }) },
        h("option", { value: "", selected: !st.condition }, "Always (both directions)"),
        M().sites(proc).map((s) => h("option", { value: `dir:${s.id}`, selected: st.condition === `dir:${s.id}` }, `${s.name} is primary at start`))), "Steps that don't apply are shown as N/A for that direction.") : null,
      h("div.ins-sec", "Who & when"),
      row(field("Owner team", h("input.inp", { value: st.owner, placeholder: "Core", list: "ownerList", ...bind(st, "owner", refresh) })), field("Escalation contact", h("input.inp", { value: st.contact, placeholder: "Name", list: "peopleList", ...bind(st, "contact", refresh) }))),
      row(field("Timing window", h("input.inp", { value: st.window, placeholder: "e.g. Morning of failover", list: "windowList", ...bind(st, "window", refresh) })), field("Est. minutes", h("input.inp.w-num", { type: "number", min: 0, value: st.estMin || "", ...bind(st, "estMin", refresh, { parse: (v) => Number(v) || 0 }) }))),
      field("Category", h("input.inp", { value: st.category, list: "catList", placeholder: "Processing, Validation…", ...bind(st, "category", refresh) })),
      h("div.ins-sec", "Behaviour"),
      h("div.checks",
        h("label.ck", h("input", { type: "checkbox", checked: st.required, ...bind(st, "required", refresh, { type: "checkbox" }) }), " Required"),
        h("label.ck", h("input", { type: "checkbox", checked: st.critical, ...bind(st, "critical", refresh, { type: "checkbox" }) }), " Critical (highlighted)"),
        h("label.ck", h("input", { type: "checkbox", checked: st.parallel, ...bind(st, "parallel", refresh, { type: "checkbox" }) }), " Runs in parallel with previous step"),
        h("label.ck", h("input", { type: "checkbox", checked: st.hold, ...bind(st, "hold", refresh, { type: "checkbox" }) }), " Hold point (earlier required steps must be done)")),
      field("Author note (not shown to operators)", h("textarea.inp", { rows: 2, ...bind(st, "authorNote") }, st.authorNote)),
      h("div.ins-sec", `Components (${st.blocks.length})`),
      h("div.ins-blocks", st.blocks.map((b) => { const d = PR.blocks.def(b.type); return h("div.ins-blk", { onclick: () => select("block", b.id, { scroll: true }) }, h("span", d ? d.icon : "?"), h("span", d ? d.label : b.type), h("span.muted.small", blockHint(b))); })),
      h("button.btn.btn-block", { type: "button", onclick: (e) => quickAdd(e.currentTarget, st.id) }, "＋ Add component"));
    return panel;
  }
  function blockHint(b) { return String(b.text || b.code || b.trail || b.label || b.who || b.test || b.question || "").split("\n")[0].slice(0, 28); }

  function bulkPanel() {
    const ids = [...multi];
    const steps = ids.map((id) => M().findStep(proc, id)).filter(Boolean);
    const apply = (key, val) => mutate(() => steps.forEach(({ step }) => (step[key] = val)), "canvas");
    return h("div.ins",
      insHead(`${steps.length} steps selected`, "Changes apply to all selected steps", [h("button.icon-btn", { type: "button", title: "Duplicate", onclick: duplicateSel }, "⧉"), h("button.icon-btn.danger", { type: "button", title: "Delete", onclick: deleteSel }, "🗑")]),
      field("Target environment", h("select.inp", { onchange: (e) => e.target.value && apply("target", e.target.value) }, h("option", { value: "" }, "— leave as is —"), targetOptions({}).map(([v, l]) => h("option", { value: v }, l)))),
      field("Category", h("input.inp", { list: "catList", placeholder: "— leave as is —", onchange: (e) => apply("category", e.target.value) })),
      field("Owner team", h("input.inp", { list: "ownerList", placeholder: "— leave as is —", onchange: (e) => apply("owner", e.target.value) })),
      field("Timing window", h("input.inp", { list: "windowList", placeholder: "— leave as is —", onchange: (e) => apply("window", e.target.value) })),
      proc.environments.directional ? field("Role label phase", h("select.inp", { onchange: (e) => e.target.value !== "-" && apply("phase", e.target.value) }, [["-", "— leave as is —"], ["", "Inherit"], ["pre", "Before cutover"], ["post", "After cutover"]].map(([v, l]) => h("option", { value: v }, l)))) : null,
      h("div.checks",
        h("button.btn.btn-sm", { type: "button", onclick: () => apply("parallel", true) }, "⇉ Mark parallel"), h("button.btn.btn-sm", { type: "button", onclick: () => apply("parallel", false) }, "Sequential"),
        h("button.btn.btn-sm", { type: "button", onclick: () => apply("required", true) }, "Required"), h("button.btn.btn-sm", { type: "button", onclick: () => apply("required", false) }, "Optional"),
        h("button.btn.btn-sm", { type: "button", onclick: () => apply("critical", true) }, "★ Critical")),
      field("Move to section", h("select.inp", { onchange: (e) => { const to = e.target.value; if (!to) return; mutate(() => { const sec = proc.sections.find((s) => s.id === to); M().allSteps(proc).filter((x) => multi.has(x.step.id)).map((x) => x.step.id).forEach((id) => moveStep(id, to, sec.steps.length)); }, "canvas"); } },
        h("option", { value: "" }, "— choose —"), proc.sections.map((s) => h("option", { value: s.id }, s.title)))));
  }

  function blockPanel(b, st) {
    const def = PR.blocks.def(b.type);
    const refresh = () => rerenderStep(st.id);
    const kids = (def ? def.fields : []).filter((f) => !f.showIf || f.showIf(b)).map((f) => blockField(b, f, refresh));
    return h("div.ins",
      insHead(def ? `${def.icon} ${def.label}` : b.type, `in step ${st.num} · ${st.title}`, [
        h("button.icon-btn", { type: "button", title: "Back to step", onclick: () => select("step", st.id) }, "↑"),
        h("button.icon-btn", { type: "button", title: "Duplicate", onclick: duplicateSel }, "⧉"),
        h("button.icon-btn.danger", { type: "button", title: "Delete", onclick: deleteSel }, "🗑")]),
      def && def.desc ? h("div.help", def.desc) : null, kids);
  }
  function blockField(b, f, refresh) {
    const rr = () => { refresh(); };
    switch (f.type) {
      case "textarea": case "code":
        return field(f.label, h(`textarea.inp${f.type === "code" ? ".mono" : ""}`, { rows: f.rows || 4, placeholder: f.placeholder || "", spellcheck: f.type !== "code", ...bind(b, f.key, rr) }, b[f.key] || ""), f.help);
      case "select":
        return field(f.label, h("select.inp", { ...bind(b, f.key, () => { rr(); renderInspector(); }, { type: "select" }) }, f.options.map(([v, l]) => h("option", { value: v, selected: b[f.key] === v }, l))), f.help);
      case "checkbox":
        return h("label.ck", h("input", { type: "checkbox", checked: !!b[f.key], ...bind(b, f.key, rr, { type: "checkbox" }) }), " ", f.label);
      case "number":
        return field(f.label, h("input.inp.w-num", { type: "number", value: b[f.key] ?? "", ...bind(b, f.key, rr, { parse: (v) => Number(v) || 0 }) }), f.help);
      case "lines":
        return field(f.label, h("textarea.inp", { rows: 4, onfocus: beginEdit, oninput: (e) => { b[f.key] = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); editing(); rr(); } }, (b[f.key] || []).join("\n")), f.help);
      case "items":
        return field(f.label, h("textarea.inp", { rows: 6, onfocus: beginEdit, oninput: (e) => {
          const lines = e.target.value.split("\n").filter((s) => s.trim());
          b.items = lines.map((t, i) => ({ id: (b.items[i] && b.items[i].id) || uid("ci"), text: t.trim() }));
          editing(); rr();
        } }, (b.items || []).map((i) => i.text).join("\n")), f.help);
      case "image": {
        const set = async (blob) => { snap(); b.src = await PR.u.compressImage(blob); changed({ step: M().findBlock(proc, b.id).step.id }); };
        return field(f.label, h("div.img-field",
          b.src ? h("img.img-prev", { src: b.src }) : null,
          h("div.drop-zone", { tabindex: 0, onpaste: (e) => { const fl = e.clipboardData.files[0]; if (fl) { e.preventDefault(); set(fl); } },
            ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); const fl = e.dataTransfer.files[0]; if (fl) set(fl); },
            onclick: async () => { const fl = await PR.u.pickFile("image/*"); if (fl) set(fl); } }, "Click, paste (Ctrl+V) or drop an image"),
          b.src ? h("button.btn.btn-sm", { type: "button", onclick: () => mutate(() => (b.src = ""), "all") }, "Remove image") : null), "Images are stored inside the procedure, downscaled to keep it small.");
      }
      case "contact":
        return field(f.label, h("input.inp", { value: b[f.key] || "", list: "contactList", ...bind(b, f.key, () => {
          const c = proc.contacts.find((x) => x.name === b.who);
          if (c && !b.detail) { b.detail = b.method === "email" ? c.email || c.phone : c.phone || c.email; renderInspector(); }
          rr();
        }) }), "Pick from the contacts directory (Settings) or type a name.");
      case "noGo":
        return field(f.label, h("select.inp", { ...bind(b, f.key, rr, { type: "select" }) },
          h("option", { value: "halt", selected: b.noGo === "halt" }, "Halt the run (lead decides next)"),
          h("option", { value: "continue", selected: b.noGo === "continue" }, "Record only, continue"),
          proc.sections.map((s) => h("option", { value: `section:${s.id}`, selected: b.noGo === `section:${s.id}` }, `Jump to section: ${s.title}`))), "Tip: add a Rollback section and jump to it on NO-GO.");
      default:
        return field(f.label, h("input.inp", { value: b[f.key] || "", placeholder: f.placeholder || "", ...bind(b, f.key, rr) }), f.help);
    }
  }

  /* ======================= settings ======================= */
  function openSettings(tab = "general") {
    const draft = clone(proc);
    let cur = tab;
    const body = h("div.settings");
    const tabs = [["general", "General"], ["env", "Environments"], ["setup", "Run setup"], ["comms", "📣 Comms plan"], ["contacts", "Contacts"], ["versions", "Versions"]];
    const draw = () => {
      body.innerHTML = "";
      body.append(h("div.tabs", tabs.map(([k, l]) => h(`button.tab${cur === k ? ".on" : ""}`, { type: "button", onclick: () => { cur = k; draw(); } }, l))), h("div.settings-body", SETTINGS[cur](draft, draw)));
    };
    draw();
    modal({ title: "Procedure settings", size: "xl", body, actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Apply", kind: "primary", value: "apply" }] })
      .then((v) => { if (v === "apply") mutate(() => { Object.assign(proc, M().normalize(draft)); }); });
  }
  const tf = (obj, key, ph = "", o = {}) => h("input.inp", { value: obj[key] ?? "", placeholder: ph, oninput: (e) => (obj[key] = e.target.value), ...o });
  const SETTINGS = {
    general: (d) => h("div",
      field("Name", tf(d, "title")), field("Description", h("textarea.inp", { rows: 3, oninput: (e) => (d.description = e.target.value) }, d.description)),
      field("Tags (comma separated)", h("input.inp", { value: d.tags.join(", "), oninput: (e) => (d.tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean)) }))),
    env: (d, draw) => {
      const env = d.environments;
      const mapping = h("div.map-preview");
      const drawMap = () => {
        mapping.innerHTML = "";
        if (!(env.enabled && env.directional && env.sites.length === 2)) return;
        mapping.append(h("div.ins-sec", "Mapping preview"), env.sites.map((ps) => {
          const fake = { ...d, environments: env };
          return h("div.map-card", h("div.map-dir", `${ps.name} → ${M().otherSite(fake, ps.id).name}`),
            h("table.mini", h("thead", h("tr", h("th", "Datacenter"), h("th", "HMC partition (fixed)"), h("th", "Before cutover"), h("th", "After cutover"))),
              h("tbody", env.sites.map((s) => { const role = s.id === ps.id ? "primary" : "secondary"; const r = env.roles[role];
                return h("tr", h("td", PR.ui.envBadge({ kind: "site", title: s.name, code: s.code, color: s.color }, { size: "sm", showRole: false })), h("td", s.partition || "—"), h("td", r.pre, r.hostname ? ` (${r.hostname})` : ""), h("td", r.post, ` (${(role === "primary" ? env.roles.secondary : env.roles.primary).hostname || ""})`)); }))));
        }));
      };
      drawMap();
      const site = (s, i) => h("div.site-row",
        h("input.color", { type: "color", value: s.color, oninput: (e) => { s.color = e.target.value; drawMap(); } }),
        h("div.site-fields",
          row(field("Datacenter name", tf(s, "name", "Main datacenter", { oninput: (e) => { s.name = e.target.value; drawMap(); } })), field("Short code", tf(s, "code", "MAIN")), field("Label in playbook", tf(s, "label", "Main (City)"))),
          row(field("HMC partition label (fixed)", tf(s, "partition", "Symitar", { oninput: (e) => { s.partition = e.target.value; drawMap(); } })), field("HMC URL", tf(s, "hmc", "https://…")))),
        h("button.icon-btn.danger", { type: "button", title: "Remove site", onclick: () => { env.sites.splice(i, 1); draw(); } }, "🗑"));
      return h("div",
        h("label.ck", h("input", { type: "checkbox", checked: env.enabled, onchange: (e) => { env.enabled = e.target.checked; draw(); } }), " This procedure runs against specific datacenters / environments"),
        env.enabled ? [
          h("label.ck", h("input", { type: "checkbox", checked: env.directional, onchange: (e) => { env.directional = e.target.checked; draw(); } }), " Directional failover (two sites swap Primary / Secondary roles — the run asks which way)"),
          h("div.ins-sec", "Datacenters"),
          env.sites.map(site),
          h("button.btn", { type: "button", onclick: () => { env.sites.push({ id: uid("site"), name: "", code: "", partition: "", hmc: "", color: ["#2563eb", "#ea580c", "#16a34a", "#9333ea"][env.sites.length % 4] }); draw(); } }, "＋ Add datacenter"),
          env.directional ? [
            h("div.ins-sec", "Logical roles"),
            h("div.help", "Steps target a role. The hostname follows the role (moves with DNS); the HMC partition label stays with the datacenter."),
            ["primary", "secondary"].map((k) => row(field(`${k === "primary" ? "Primary" : "Secondary"} — before cutover`, tf(env.roles[k], "pre")), field("after cutover", tf(env.roles[k], "post")), field("Hostname", tf(env.roles[k], "hostname", k === "primary" ? "Symitar" : "Symbu")))),
            field("Default primary (usual base of operation)", h("select.inp", { onchange: (e) => (env.defaultPrimarySiteId = e.target.value) }, env.sites.map((s) => h("option", { value: s.id, selected: env.defaultPrimarySiteId === s.id }, s.name)))),
            mapping] : null] : null);
    },
    setup: (d) => h("div",
      h("label.ck", h("input", { type: "checkbox", checked: d.setup.requireChangeId, onchange: (e) => (d.setup.requireChangeId = e.target.checked) }), " Require a change / exercise ID to start"),
      h("label.ck", h("input", { type: "checkbox", checked: d.setup.requireVerification, onchange: (e) => (d.setup.requireVerification = e.target.checked) }), " Require someone to verify the environment mapping before starting"),
      field("Chairs / roles for participants (one per line)", h("textarea.inp", { rows: 6, oninput: (e) => (d.setup.chairs = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)) }, d.setup.chairs.join("\n"))),
      field("Pre-run readiness checklist (one per line)", h("textarea.inp", { rows: 6, oninput: (e) => (d.setup.readiness = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).map((label, i) => ({ id: (d.setup.readiness[i] && d.setup.readiness[i].label === label && d.setup.readiness[i].id) || uid("rd"), label }))) }, d.setup.readiness.map((r) => r.label).join("\n")), "Backups, transfers, replication status, approvals… shown at run setup with who/when."),
      field("Completion milestones (one per line)", h("textarea.inp", { rows: 5, oninput: (e) => (d.setup.milestones = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).map((label, i) => ({ id: (d.setup.milestones[i] && d.setup.milestones[i].id) || uid("ms"), label }))) }, d.setup.milestones.map((r) => r.label).join("\n")), "Confirmed when the run is closed out.")),
    comms: (d) => { const ph = h("div.muted", "Loading…"); PR.comms.planEditor(d).then((n) => ph.replaceWith(n)); return ph; },
    contacts: (d, draw) => h("div",
      h("div.help", "Contacts appear as suggestions in Contact components and in the runner's comms log."),
      h("table.edit-table", h("thead", h("tr", ["Name", "Organisation", "Phone", "Email", "Notes", ""].map((x) => h("th", x)))),
        h("tbody", d.contacts.map((c, i) => h("tr", ["name", "org", "phone", "email", "notes"].map((k) => h("td", tf(c, k))), h("td", h("button.icon-btn.danger", { type: "button", onclick: () => { d.contacts.splice(i, 1); draw(); } }, "🗑")))))),
      h("button.btn", { type: "button", onclick: () => { d.contacts.push({ name: "", org: "", phone: "", email: "", notes: "" }); draw(); } }, "＋ Add contact")),
    versions: () => {
      const box = h("div", h("div.help", "Every publish creates an immutable version. Runs always record which version they used."));
      const vs = (doc.versions || []).slice().reverse();
      if (!vs.length) box.append(h("div.muted", "Not published yet."));
      box.append(h("table.mini", h("tbody", vs.map((v) => h("tr", h("td", h("b", `v${v.version}`)), h("td", PR.u.fmtDateTime(v.at)), h("td", v.by || ""), h("td", v.note || ""),
        h("td", h("button.btn.btn-sm", { type: "button", onclick: async () => {
          const data = await S().getVersion(proc.id, v.version);
          if (!data) return toast("Version not found", "err");
          if (await confirmBox("Restore version?", `Replace the current draft with v${v.version}? (Undo is available.)`, { ok: "Restore" })) { PR.u.closeMenus(); $$(".modal-back").forEach((m) => m._close && m._close(null)); mutate(() => { proc = M().normalize(clone(data)); }); }
        } }, "Restore to draft")))))));
      return box;
    },
  };

  /* ======================= lint & publish ======================= */
  function lintList(lint) {
    return h("div.lint-list", lint.length ? lint.map((l) => h(`div.lint.l-${l.level}`, { onclick: () => { if (l.stepId) { $$(".modal-back").forEach((m) => m._close && m._close(null)); select("step", l.stepId, { scroll: true }); } } }, l.level === "error" ? "⛔ " : "⚠ ", l.msg)) : h("div.lint.l-ok", "✓ No problems found"));
  }
  function showLint() { modal({ title: "Checks", size: "md", body: lintList(M().lint(proc)), actions: [{ label: "Close", kind: "primary" }] }); }
  async function publish() {
    await save.flush();
    const lint = M().lint(proc);
    const errs = lint.filter((l) => l.level === "error");
    let note;
    const v = await modal({
      title: `Publish v${(doc.publishedVersion || 0) + 1}`, size: "md",
      body: h("div", h("div.help", "Published versions are what operators run. Your draft keeps evolving separately."),
        field("What changed?", note = h("input.inp", { placeholder: "e.g. Added DNS validation after step 62", autofocus: true })),
        lint.length ? [h("div.ins-sec", "Checks"), lintList(lint)] : null),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: errs.length ? "Fix errors first" : "Publish", kind: "primary", value: errs.length ? null : "go" }],
    });
    if (v !== "go") return;
    // Re-read so two authors publishing at once don't collide on a version number.
    const latest = await S().getProcedure(proc.id);
    if (latest && latest.rev !== doc.rev) { doc.rev = latest.rev; doc.publishedVersion = Math.max(doc.publishedVersion || 0, latest.publishedVersion || 0); doc.versions = latest.versions || doc.versions; }
    let version = (doc.publishedVersion || 0) + 1;
    const data = clone(proc);
    for (let tries = 0; ; tries++) {
      try { await S().putVersion(proc.id, version, data); break; }
      catch (e) { if (tries < 20 && (e.conflict || /exists/i.test(e.message))) { version++; continue; } toast(`Publish failed: ${e.message}`, "err", 5000); return; }
    }
    doc.versions = [...(doc.versions || []), { version, at: now(), by: PR.app.me, note: note.value, steps: M().allSteps(proc).length }];
    doc.publishedVersion = version; doc.publishedAt = now(); doc.status = "published"; doc.draft = data; doc.dirtySincePublish = false;
    try { doc = await S().saveProcedure(doc, doc.rev); }
    catch (e) {
      if (!e.conflict) { toast(`Publish failed: ${e.message}`, "err", 5000); return; }
      // Someone saved meanwhile: keep our publish record on top of their latest doc.
      const cur = e.current; cur.versions = [...(cur.versions || []).filter((x) => x.version !== version), doc.versions[doc.versions.length - 1]];
      cur.publishedVersion = Math.max(cur.publishedVersion || 0, version); cur.publishedAt = now(); cur.status = "published"; cur.draft = data; cur.dirtySincePublish = false;
      try { doc = await S().saveProcedure(cur, cur.rev); } catch (e2) { toast(`Publish failed: ${e2.message}`, "err", 5000); return; }
      proc = M().normalize(clone(doc.draft)); renderAll();
    }
    dirty = false; renderBar(); toast(`Published v${version}`, "ok");
  }

  /* ======================= keyboard ======================= */
  function onKey(e) {
    if (PR.u.topModalOpen()) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save.flush(); return; }
    if (PR.u.isTyping(e)) return; // native text undo inside inputs
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); return; }
    if (e.key === "Escape") { select(null); return; }
  }

  return { mount, unmount };
})();
