/* guide.js — optional step-by-step "how to" for a step: pages of screenshot + short text.
   step.guide = [{ id, img: dataURL | "", text: markdown }]
   - Runner: "📖 Guide" opens a page-by-page viewer (← → / Enter), or it shows inline when the operator turns on
     "Always show guides".
   - Builder: paste screenshots (each becomes a page), write a line per page, draw highlight boxes.
   - Runs keep the text only: screenshots are left out of the run's copy of the procedure (they'd make every run
     file megabytes) and are loaded from the published version when shown. */
PR.guide = (() => {
  const { h, modal, toast, uid, md, inline } = PR.u;
  const M = () => PR.model;
  const ASSET = "asset"; // placeholder left in run snapshots where an image was
  const pagesOf = (step) => (Array.isArray(step.guide) ? step.guide : []).filter((g) => g && (g.img || (g.text || "").trim()));
  const inlinePref = () => PR.app.LS.get("guideInline", false);

  /* ---------- run snapshots: images out, back in when needed ---------- */
  function strip(p) {
    let n = 0;
    M().allSteps(p).forEach(({ step }) => {
      (step.guide || []).forEach((g) => { if (g.img && g.img.startsWith("data:")) { g.img = ASSET; n++; } });
      (step.blocks || []).forEach((b) => { if (b.type === "image" && b.src && b.src.startsWith("data:")) { b.src = ASSET; n++; } });
    });
    if (n) p._assets = true;
    return p;
  }
  const cache = {};
  async function fullFor(run) {
    const key = `${run.procId}@${run.procVersion}`;
    if (!cache[key]) cache[key] = (async () => {
      const S = PR.store.b;
      const v = run.procVersion && run.procVersion !== "draft" ? await S.getVersion(run.procId, Number(run.procVersion)) : null;
      if (v) return v;
      const d = await S.getProcedure(run.procId); return d ? d.draft : null;
    })().catch(() => null);
    return cache[key];
  }
  /* Put the images back into an in-memory procedure (the run's snapshot). Returns true if anything changed. */
  async function hydrate(run, p) {
    if (!p || !p._assets) return false;
    const full = await fullFor(run); if (!full) return false;
    const imgs = {};
    M().allSteps(full).forEach(({ step }) => {
      (step.guide || []).forEach((g) => { if (g.id && g.img) imgs[g.id] = g.img; });
      (step.blocks || []).forEach((b) => { if (b.type === "image" && b.src) imgs[b.id] = b.src; });
    });
    let changed = false;
    M().allSteps(p).forEach(({ step }) => {
      (step.guide || []).forEach((g) => { if (g.img === ASSET && imgs[g.id]) { g.img = imgs[g.id]; changed = true; } });
      (step.blocks || []).forEach((b) => { if (b.type === "image" && b.src === ASSET && imgs[b.id]) { b.src = imgs[b.id]; changed = true; } });
    });
    return changed;
  }

  /* ---------- runner: viewer + inline ---------- */
  const picture = (g, onZoom) => g.img && g.img !== ASSET
    ? h("img.gd-img", { src: g.img, alt: "", title: "Click to zoom", onclick: () => onZoom(g.img) })
    : g.img === ASSET ? h("div.gd-img.gd-loading", "Loading screenshot…") : null;
  const pageText = (g) => (g.text || "").trim() ? h("div.gd-text", { html: md(g.text) }) : null;

  function open(step, { start = 0, title } = {}) {
    const pages = pagesOf(step); if (!pages.length) return;
    let i = Math.max(0, Math.min(start, pages.length - 1));
    const body = h("div.gd-view");
    let nextBtn;
    const draw = () => {
      const g = pages[i];
      body.innerHTML = "";
      body.append(
        h(`div.gd-page-view${g.img ? "" : ".text-only"}`, picture(g, (src) => PR.app.lightbox(src)),
          h("div.gd-side", h("div.gd-count", `${i + 1} of ${pages.length}`), pageText(g) || h("div.muted", "—"))),
        h("div.gd-dots", pages.map((_, k) => h(`button.gd-dot${k === i ? ".on" : ""}`, { type: "button", title: `Page ${k + 1}`, onclick: () => { i = k; draw(); } }))),
        h("label.ck.gd-pref", h("input", { type: "checkbox", checked: inlinePref(), onchange: (e) => { PR.app.LS.set("guideInline", e.target.checked); document.dispatchEvent(new CustomEvent("pr:guide-pref")); } }),
          " Always show guides open on steps (good while learning)"));
      if (nextBtn) nextBtn.textContent = i === pages.length - 1 ? "✓ Done" : "Next ›";
    };
    const keys = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); if (i < pages.length - 1) { i++; draw(); } }
      if (e.key === "ArrowLeft") { e.preventDefault(); if (i > 0) { i--; draw(); } }
    };
    document.addEventListener("keydown", keys);
    const m = modal({
      title: title || `📖 ${step.num ? "Step " + step.num + " · " : ""}${step.title}`, size: "xl", body, enter: true, className: "gd-modal",
      onClose: () => document.removeEventListener("keydown", keys),
      actions: [{ label: "‹ Back", onClick: () => { if (i > 0) { i--; draw(); } return false; } }, { spacer: true },
        { label: "Next ›", kind: "primary", onClick: () => { if (i < pages.length - 1) { i++; draw(); return false; } } }],
    });
    requestAnimationFrame(() => { nextBtn = document.querySelector(".gd-modal .modal-foot .btn-primary"); draw(); });
    return m;
  }

  /* Inline walkthrough inside the step card (for people who switched "Always show guides" on). */
  const inlinePage = {};
  function inlineView(step) {
    const pages = pagesOf(step); if (!pages.length) return null;
    const i = Math.min(inlinePage[step.id] || 0, pages.length - 1);
    const g = pages[i];
    const go = (k) => { inlinePage[step.id] = k; document.dispatchEvent(new CustomEvent("pr:guide-pref")); };
    return h("div.gd-inline",
      h("div.gd-inline-h", h("b", "📖 How to"), h("span.muted.small", ` · ${i + 1} of ${pages.length}`), h("div.spacer"),
        h("button.btn-text", { type: "button", disabled: i === 0, onclick: () => go(i - 1) }, "‹"),
        h("button.btn-text", { type: "button", disabled: i === pages.length - 1, onclick: () => go(i + 1) }, "›"),
        h("button.btn-text", { type: "button", title: "Open large (H)", onclick: () => open(step, { start: i }) }, "⤢")),
      h(`div.gd-page-view.compact${g.img ? "" : ".text-only"}`, picture(g, () => open(step, { start: i })), h("div.gd-side", pageText(g))));
  }
  /* The button on the step card. */
  function button(step) {
    const n = pagesOf(step).length; if (!n) return null;
    return h("button.gd-btn", { type: "button", title: "Step-by-step guide with screenshots (H)", onclick: () => open(step) }, "📖 Guide", h("span.gd-n", String(n)));
  }

  /* ---------- builder: editor + highlight tool ---------- */
  async function toImage(file) { return PR.u.compressImage(file, 1600, 0.82); }
  function editor(st, { mutate, bind }) {
    st.guide = Array.isArray(st.guide) ? st.guide : [];
    const add = async (files) => {
      const imgs = [];
      for (const f of files) if (f && f.type && f.type.startsWith("image/")) imgs.push(await toImage(f));
      if (!imgs.length) return toast("Paste or drop a screenshot (image)", "warn");
      mutate(() => imgs.forEach((img) => st.guide.push({ id: uid("gp"), img, text: "" })));
      toast(`${imgs.length} page${imgs.length > 1 ? "s" : ""} added — write a line for each`, "ok", 2200);
    };
    const zone = (onFiles, label) => h("div.drop-zone.gd-drop", { tabindex: 0,
      onpaste: (e) => { const fs = [...(e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); onFiles(fs); } },
      ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); onFiles([...e.dataTransfer.files]); },
      onclick: async () => { const f = await PR.u.pickFile("image/*"); if (f) onFiles([f]); } }, label);
    const move = (i, d) => mutate(() => { const [x] = st.guide.splice(i, 1); st.guide.splice(i + d, 0, x); });
    return h("div.gd-editor",
      h("div.ins-sec", `📖 Guide — detailed how-to${st.guide.length ? ` (${st.guide.length})` : ""}`),
      h("div.help", "Optional. A page-by-page walkthrough with screenshots for anyone who needs it — operators open it with 📖 Guide (H). The step card stays clean."),
      st.guide.map((g, i) => h("div.gd-ed-page",
        h("div.gd-ed-top", h("b", `Page ${i + 1}`), h("div.spacer"),
          g.img ? h("button.mini-btn", { type: "button", title: "Draw boxes on the screenshot to show where to click", onclick: async () => { const out = await annotate(g.img); if (out) mutate(() => (g.img = out)); } }, "✏ Highlight") : null,
          h("button.mini-btn", { type: "button", disabled: i === 0, title: "Move up", onclick: () => move(i, -1) }, "↑"),
          h("button.mini-btn", { type: "button", disabled: i === st.guide.length - 1, title: "Move down", onclick: () => move(i, 1) }, "↓"),
          h("button.mini-btn.danger", { type: "button", title: "Remove page", onclick: () => mutate(() => st.guide.splice(i, 1)) }, "✕")),
        g.img ? h("img.gd-thumb", { src: g.img, title: "Click to highlight", onclick: async () => { const out = await annotate(g.img); if (out) mutate(() => (g.img = out)); } })
          : zone(async (fs) => { const f = fs.find((x) => x.type && x.type.startsWith("image/")); if (f) { const img = await toImage(f); mutate(() => (g.img = img)); } }, "Paste (Ctrl+V), drop or click to add a screenshot"),
        h("textarea.inp", { rows: 2, placeholder: "What to do on this screen, e.g. Click **Batch Control** › select TEST.GN.DAILY", ...bind(g, "text") }, g.text || ""))),
      zone(add, st.guide.length ? "＋ Paste more screenshots (Ctrl+V) — each becomes a page" : "＋ Paste screenshots here (Ctrl+V), drop or click — each becomes a page"),
      h("button.btn.btn-sm", { type: "button", onclick: () => mutate(() => st.guide.push({ id: uid("gp"), img: "", text: "" })) }, "＋ Text-only page"));
  }

  /* Draw red boxes on a screenshot. Resolves with the new image, or null if cancelled. */
  function annotate(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = h("canvas.gd-canvas"); c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d");
        const boxes = []; let drag = null;
        const lw = Math.max(3, Math.round(Math.max(img.width, img.height) / 300));
        const paint = () => {
          ctx.drawImage(img, 0, 0);
          ctx.lineWidth = lw; ctx.strokeStyle = "#e5252a";
          [...boxes, drag].filter(Boolean).forEach((b) => { ctx.strokeRect(b.x, b.y, b.w, b.h); });
        };
        const pos = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
        c.onmousedown = (e) => { const p = pos(e); drag = { x: p.x, y: p.y, w: 0, h: 0, ox: p.x, oy: p.y }; };
        c.onmousemove = (e) => { if (!drag) return; const p = pos(e); drag.x = Math.min(drag.ox, p.x); drag.y = Math.min(drag.oy, p.y); drag.w = Math.abs(p.x - drag.ox); drag.h = Math.abs(p.y - drag.oy); paint(); };
        c.onmouseup = () => { if (drag && drag.w > 4 && drag.h > 4) boxes.push(drag); drag = null; paint(); };
        paint();
        modal({ title: "Highlight where to look", subtitle: "Drag to draw a box. Draw as many as you need.", size: "xl", className: "gd-annot",
          body: h("div.gd-canvas-wrap", c),
          actions: [{ label: "Undo box", onClick: () => { boxes.pop(); paint(); return false; } }, { spacer: true }, { label: "Cancel", value: null },
            { label: "Save", kind: "primary", value: "save" }] })
          .then((v) => resolve(v === "save" ? c.toDataURL("image/jpeg", 0.86) : null));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  return { pagesOf, strip, hydrate, open, inlineView, button, editor, annotate, inlinePref, ASSET };
})();
