/* chart.js — one chart page on screen: cards + connectors from OC.layout, pan & zoom, selection, search highlight,
   drag a card onto another card to change who they report to (edit mode), right-click menu.
   cardHTML() is shared with the exporter so the official HTML/PDF looks exactly like the editor. */
OC.chart = (() => {
  const { h, esc, plural } = OC.u;
  const M = () => OC.model;

  function badges(n, opts) {
    const x = n.p, out = [];
    if (x.type === "vacant") out.push('<span class="ocb ocb-vac">Vacant</span>');
    if (x.type === "contractor") out.push('<span class="ocb ocb-con">Contractor</span>');
    if (x.status === "leave") out.push('<span class="ocb ocb-leave">On leave</span>');
    if (n.extra) out.push('<span class="ocb ocb-page" title="Only on this page">Page only</span>');
    if (opts.showCounts && opts.counts && !n.extra) {
      const c = opts.counts(n.id);
      if (c > 0) out.push(`<span class="ocb ocb-count" title="${c} ${c === 1 ? "person" : "people"} in this organization">${c}</span>`);
    }
    return out.join("");
  }
  /* One card. pos = {x, y} in chart units. */
  function cardHTML(n, pos, S, opts = {}) {
    const x = n.p;
    const vac = x.type === "vacant";
    const name = vac ? (x.name && !/^vacant/i.test(x.name) ? `Vacant · ${x.name}` : "Vacant position") : x.name;
    const cls = ["oc-card", `s-${n.style || "standard"}`, n.level === 0 && !n.context ? "lvl0" : "", vac ? "t-vacant" : "", x.status === "leave" ? "t-leave" : "", n.extra ? "t-extra" : "", n.context ? "t-context" : ""].filter(Boolean).join(" ");
    const tog = n.hiddenKids ? `<button type="button" class="oc-tog more" data-tog="open" title="Show ${n.hiddenKids} more">+${n.hiddenKids}</button>`
      : n.kids && n.kids.length && opts.collapsible ? `<button type="button" class="oc-tog less" data-tog="close" title="Collapse">−</button>` : "";
    return `<div class="${cls}" data-id="${esc(n.id)}" style="left:${pos.x}px;top:${pos.y}px;width:${S.CW}px;height:${S.CH}px"${opts.draggable && !n.context ? ' draggable="true"' : ""} tabindex="-1">`
      + `<div class="oc-name" title="${esc(name)}">${esc(name)}</div>`
      + `<div class="oc-title" title="${esc(x.title)}">${esc(x.title || "")}</div>`
      + (opts.showDept && x.department ? `<div class="oc-dept">${esc(x.department)}</div>` : "")
      + `<div class="oc-badges">${badges(n, opts)}</div>${tog}</div>`;
  }

  /* Static markup of a whole page (used by the live view and the exporter). */
  function pageMarkup(p, pg, opts = {}) {
    const tree = M().pageTree(p, pg);
    const L = OC.layout.layout(tree, { density: p.settings.cardDensity });
    const S = L.S || OC.layout.SIZES[p.settings.cardDensity] || OC.layout.SIZES.comfortable;
    const counts = (id) => M().headcount(p, id);
    const o = { showCounts: p.settings.showCounts, showDept: p.settings.showDept, counts, ...opts };
    const cards = L.cards.map((c) => cardHTML(c.node, c, S, o)).join("");
    const svg = `<svg class="oc-lines" width="${Math.ceil(L.w)}" height="${Math.ceil(L.h)}" viewBox="0 0 ${Math.ceil(L.w)} ${Math.ceil(L.h)}" aria-hidden="true"><path d="${OC.layout.pathOf(L.segs)}"/></svg>`;
    return { html: svg + cards, w: Math.ceil(L.w), h: Math.ceil(L.h), L, tree, count: L.cards.length };
  }

  /* ---------------------------------------------------------------- live view */
  const zoomMemory = new Map(); // pageId -> {s, tx, ty} for this session

  function mount(host, pg, { editable = false, onSelect, onMenu, onToggle, onDrop, selectedId = null } = {}) {
    const p = OC.store.doc;
    const viewport = h("div.oc-viewport", { tabindex: "0", "aria-label": `${pg.title} chart` });
    const canvas = h("div.oc-canvas");
    viewport.appendChild(canvas);
    host.appendChild(viewport);
    let s = 1, tx = 0, ty = 0, W = 0, H = 0, PAD = 48;
    let zoomLabel = null;

    function render() {
      const m = pageMarkup(OC.store.doc, pg, { draggable: editable, collapsible: true });
      W = m.w; H = m.h;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      canvas.innerHTML = m.html;
      canvas.classList.toggle("editable", editable);
      viewport.classList.toggle("theme-classic", OC.store.doc.settings.theme === "classic");
      if (selectedId) mark(selectedId, "selected");
      if (!m.count) canvas.innerHTML = '<div class="oc-empty">Nobody to show on this page yet.</div>';
      return m;
    }
    function apply() {
      canvas.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
      if (zoomLabel) zoomLabel.textContent = Math.round(s * 100) + "%";
      zoomMemory.set(pg.id, { s, tx, ty, w: W, h: H });
    }
    function fit(mode = "auto") {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      if (!vw || !vh) return;
      const sw = (vw - PAD * 2) / W, sh = (vh - PAD * 2) / H;
      if (mode === "page") s = Math.min(1, sw, sh);
      else if (mode === "width") s = Math.min(1, sw);
      else s = Math.min(1, Math.max(Math.min(sw, sh), Math.min(sw, 0.55))); // whole chart, unless that makes it unreadable: then fit width
      s = Math.max(0.12, s);
      tx = Math.max(PAD, (vw - W * s) / 2);
      ty = H * s + PAD * 2 <= vh ? Math.max(PAD, (vh - H * s) / 2.4) : PAD;
      // Too big to read when fitted: open at a readable size on the top of the chart instead (Fit shows it all).
      if (mode === "auto" && s < 0.42) {
        s = 0.62;
        const root = canvas.querySelector(".oc-card.lvl0") || canvas.querySelector(".oc-card");
        const cx = root ? parseFloat(root.style.left) + root.offsetWidth / 2 : W / 2;
        tx = vw / 2 - cx * s; ty = PAD;
      }
      apply();
    }
    function zoomAt(f, cx, cy) {
      const r = viewport.getBoundingClientRect();
      if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
      const ns = Math.min(2.5, Math.max(0.12, s * f));
      tx = cx - (cx - tx) * (ns / s); ty = cy - (cy - ty) * (ns / s); s = ns;
      apply();
    }
    function setZoom(z) { zoomAt(z / s); }
    function centerOn(id, { zoom = null } = {}) {
      const el = cardEl(id); if (!el) return false;
      if (zoom) s = zoom; else if (s < 0.6) s = Math.min(1, 0.9);
      const x = parseFloat(el.style.left) + el.offsetWidth / 2, y = parseFloat(el.style.top) + el.offsetHeight / 2;
      tx = viewport.clientWidth / 2 - x * s; ty = viewport.clientHeight / 2.4 - y * s;
      canvas.classList.add("smooth"); apply(); setTimeout(() => canvas.classList.remove("smooth"), 380);
      return true;
    }
    const cardEl = (id) => canvas.querySelector(`.oc-card[data-id="${CSS.escape(id)}"]`);
    function mark(id, cls) {
      canvas.querySelectorAll("." + cls).forEach((e) => e.classList.remove(cls));
      const el = id && cardEl(id); if (el) el.classList.add(cls);
      return el;
    }
    function highlight(id) {
      const el = mark(id, "hit");
      if (el) { centerOn(id); setTimeout(() => el.classList.remove("hit"), 4200); }
      return !!el;
    }

    // ---- pan (drag empty space, or anywhere with space held / middle button) and wheel
    let pan = null, spaceDown = false;
    viewport.addEventListener("pointerdown", (e) => {
      const onCard = e.target.closest(".oc-card");
      if (e.button === 1 || spaceDown || (!onCard && e.button === 0)) {
        if (e.target.closest("button")) return;
        pan = { x: e.clientX, y: e.clientY, tx, ty, moved: false };
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add("panning");
        e.preventDefault();
      }
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
      tx = pan.tx + dx; ty = pan.ty + dy; apply();
    });
    const endPan = () => { if (pan) { viewport.classList.remove("panning"); if (!pan.moved && onSelect) onSelect(null); pan = null; } };
    viewport.addEventListener("pointerup", endPan);
    viewport.addEventListener("pointercancel", endPan);
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { const r = viewport.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top); }
      else { tx -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; ty -= e.shiftKey && !e.deltaX ? 0 : e.deltaY; apply(); }
    }, { passive: false });
    const keyDown = (e) => { if (e.code === "Space" && !OC.u.isTyping(e)) { spaceDown = true; viewport.classList.add("grab"); } };
    const keyUp = (e) => { if (e.code === "Space") { spaceDown = false; viewport.classList.remove("grab"); } };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);

    // ---- cards
    canvas.addEventListener("click", (e) => {
      const tog = e.target.closest(".oc-tog");
      const card = e.target.closest(".oc-card");
      if (!card) return;
      e.stopPropagation();
      if (tog) { onToggle && onToggle(card.dataset.id, tog.dataset.tog); return; }
      onSelect && onSelect(card.dataset.id);
    });
    canvas.addEventListener("dblclick", (e) => {
      const card = e.target.closest(".oc-card");
      if (card && onSelect) onSelect(card.dataset.id, { open: true });
    });
    canvas.addEventListener("contextmenu", (e) => {
      const card = e.target.closest(".oc-card");
      if (!card || !onMenu) return;
      e.preventDefault();
      onMenu(card.dataset.id, { x: e.clientX, y: e.clientY });
    });

    // ---- drag a card onto a new manager (edit mode)
    let dragId = null;
    canvas.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".oc-card"); if (!card || !editable) return;
      dragId = card.dataset.id; card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", dragId); } catch { /* ignore */ }
      viewport.classList.add("dnd");
    });
    canvas.addEventListener("dragover", (e) => {
      if (!dragId) return;
      const card = e.target.closest(".oc-card");
      canvas.querySelectorAll(".drop-ok,.drop-no").forEach((x) => x.classList.remove("drop-ok", "drop-no"));
      if (!card || card.dataset.id === dragId) return;
      const ok = !card.dataset.id.startsWith("x:") && (dragId.startsWith("x:") || !M().wouldLoop(OC.store.doc, dragId, card.dataset.id));
      card.classList.add(ok ? "drop-ok" : "drop-no");
      if (ok) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
    });
    canvas.addEventListener("drop", (e) => {
      const card = e.target.closest(".oc-card");
      if (!dragId || !card) return;
      e.preventDefault();
      const from = dragId, to = card.dataset.id;
      cleanupDrag();
      onDrop && onDrop(from, to);
    });
    const cleanupDrag = () => { dragId = null; viewport.classList.remove("dnd"); canvas.querySelectorAll(".dragging,.drop-ok,.drop-no").forEach((x) => x.classList.remove("dragging", "drop-ok", "drop-no")); };
    canvas.addEventListener("dragend", cleanupDrag);

    const ro = new ResizeObserver(() => { const mem = zoomMemory.get(pg.id); if (!mem || mem.fitOnResize) fit(); });
    let first = true;
    function refresh({ keepView = true } = {}) {
      const before = { W, H };
      render();
      if (first || !keepView) {
        const mem = zoomMemory.get(pg.id);
        if (first && mem && mem.w === W && mem.h === H) { s = mem.s; tx = mem.tx; ty = mem.ty; apply(); }
        else fit();
        first = false;
      } else if (before.W !== W) {
        // keep the chart's horizontal center stable when its width changes (layout switch, new person…)
        tx += ((before.W - W) * s) / 2;
        apply();
      } else apply();
    }
    refresh();
    requestAnimationFrame(() => { if (!zoomMemory.get(pg.id) || zoomMemory.get(pg.id).w !== W) fit(); ro.observe(viewport); });

    return {
      el: viewport, refresh, fit, zoomBy: (f) => zoomAt(f), setZoom, centerOn, highlight,
      select(id) { selectedId = id; mark(id, "selected"); },
      bindZoomLabel(el) { zoomLabel = el; apply(); },
      get scale() { return s; },
      size: () => ({ w: W, h: H }),
      destroy() { ro.disconnect(); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); viewport.remove(); },
    };
  }

  /* Divider pages: a branded title card. */
  function dividerMarkup(pg) {
    return `<div class="oc-divider"><div class="oc-divider-inner"><div class="oc-divider-label">${esc(pg.label || "")}</div><div class="oc-divider-title">${esc(pg.title)}</div>${pg.subtitle ? `<div class="oc-divider-sub">${esc(pg.subtitle)}</div>` : ""}</div></div>`;
  }

  return { cardHTML, pageMarkup, dividerMarkup, mount, plural };
})();
