/* flow.js — workflow diagram: swimlanes (one per chair / team), steps placed left→right in the order they can happen,
   grey lines for the order on the page and bold arrows for hand-offs ("waits for").
   Used by the builder (drag to link / move between lanes) and read-only by the runner and the live view (with status). */
PR.flow = (() => {
  const { h } = PR.u;
  const NS = "http://www.w3.org/2000/svg";
  const W = 184, H = 62, COL = 226, ROW = 78, PAD = 14, LABEL = 168, TOP = 6;

  function s(tag, attrs = {}, ...kids) {
    if (attrs instanceof Node || Array.isArray(attrs) || typeof attrs === "string") { kids.unshift(attrs); attrs = {}; }
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
    kids.flat().forEach((c) => c != null && el.append(typeof c === "string" ? document.createTextNode(c) : c));
    return el;
  }
  // split a title over two lines of about n characters
  function wrap(text, n) {
    const words = String(text || "").split(/\s+/); const lines = [""];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if ((cur + " " + w).trim().length <= n) lines[lines.length - 1] = (cur + " " + w).trim();
      else if (lines.length < 2) lines.push(w);
      else { lines[1] = (lines[1] + " " + w).trim(); }
    }
    if (lines[1] && lines[1].length > n) lines[1] = lines[1].slice(0, n - 1) + "…";
    if (lines[0].length > n) lines[0] = lines[0].slice(0, n - 1) + "…";
    return lines.filter(Boolean);
  }

  const COLW = W + 26, ROWV = H + 46, HEAD = 70; // vertical: lanes are columns, steps flow downwards

  /* Team filter: which lanes are shown in full. [] = every lane. Other lanes keep only the steps that hand off to or
     from a shown lane (faded), and lanes with nothing linked fold into a thin bar. Stored per procedure for this person. */
  function focusGet(key, def = []) { const v = PR.app.LS.get(key, null); return Array.isArray(v) ? v : def; }
  function focusSet(key, v) { PR.app.LS.set(key, v); }
  /* Lanes this person belongs to (lanes linked to their departments) */
  function myLanes(proc) { const me = PR.app.me; return PR.model.tracks(proc).filter((t) => t.dept && PR.model.inDept(PR.app.dept(t.dept), me)).map((t) => t.id); }

  function filterGraph(g, focus) {
    if (!focus.length) { g.nodes.forEach((n) => (n.vis = "full")); return g; }
    const full = new Set(g.nodes.filter((n) => n.lane === "shared" || focus.includes(n.lane)).map((n) => n.id));
    g.nodes.forEach((n) => {
      n.vis = full.has(n.id) ? "full" : null;
    });
    g.nodes.forEach((n) => { // hand-offs crossing into or out of a shown lane keep the other team's step, faded
      if (n.vis !== "full") return;
      n.deps.forEach((m) => { if (!m.vis) m.vis = "ghost"; });
    });
    g.nodes.forEach((n) => { if (!n.vis && n.deps.some((m) => m.vis === "full")) n.vis = "ghost"; });
    const hidden = new Map();
    g.nodes.filter((n) => !n.vis).forEach((n) => hidden.set(n.lane, (hidden.get(n.lane) || 0) + 1));
    g.lanes.forEach((l) => { l.hiddenCount = hidden.get(l.id) || 0; l.focused = l.shared || focus.includes(l.id); l.minH = l.hiddenCount ? 118 : 0; });
    g.nodes = g.nodes.filter((n) => n.vis);
    g.byId = new Map(g.nodes.map((n) => [n.id, n]));
    g.nodes.forEach((n) => { n.order = n.vis === "full" ? n.order.filter((m) => m.vis === "full") : []; n.deps = n.deps.filter((m) => m.vis); });
    return g;
  }

  function layout(g, dir = "h") {
    // dense columns / rows: keep the order of the full workflow without gaps left by hidden steps
    const lv = [...new Set(g.nodes.map((n) => n.level))].sort((a, b) => a - b); const rank = new Map(lv.map((x, i) => [x, i]));
    g.nodes.forEach((n) => (n.level = rank.get(n.level)));
    const slot = new Map(), rows = new Map();
    g.nodes.forEach((n) => { const k = n.lane + "|" + n.level; n.row = slot.get(k) || 0; slot.set(k, n.row + 1); rows.set(n.lane, Math.max(rows.get(n.lane) || 1, n.row + 1)); });
    const has = new Set(g.nodes.map((n) => n.lane));
    g.lanes.forEach((l) => (l.collapsed = !has.has(l.id) && l.hiddenCount > 0));
    const maxLevel = Math.max(0, ...g.nodes.map((n) => n.level));
    const lane = new Map(g.lanes.map((l) => [l.id, l]));
    if (dir === "v") {
      let x = 0;
      g.lanes.forEach((l) => { l.x = x; l.rows = rows.get(l.id) || 1; l.w = l.collapsed ? 128 : Math.max(l.rows * COLW + PAD * 2 - 26, 210); x += l.w + 6; });
      g.nodes.forEach((n) => { const l = lane.get(n.lane) || g.lanes[0]; n.x = l.x + PAD + n.row * COLW + Math.max(0, (l.w - PAD * 2 - (l.rows * COLW - 26)) / 2); n.y = HEAD + 18 + n.level * ROWV; });
      g.width = x; g.height = HEAD + 18 + (maxLevel + 1) * ROWV;
      g.lanes.forEach((l) => (l.h = g.height));
    } else {
      let y = TOP;
      g.lanes.forEach((l) => { l.y = y; l.rows = rows.get(l.id) || 1; l.h = l.collapsed ? 40 : Math.max(l.rows * ROW + PAD * 2 - (ROW - H), l.minH || 0); y += l.h + 6; });
      g.nodes.forEach((n) => { const l = lane.get(n.lane) || g.lanes[0]; n.x = LABEL + 24 + n.level * COL; n.y = l.y + PAD + n.row * ROW; });
      g.width = LABEL + 24 + (maxLevel + 1) * COL + 40; g.height = y;
    }
    g.dir = dir;
    return g;
  }

  function edgePath(a, b, dir) {
    if (dir === "v") {
      const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y;
      if (y2 > y1 + 4) { const dy = Math.max(24, (y2 - y1) / 2); return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`; }
      const xx = Math.max(x1, x2) + W; return `M${x1},${y1} C${xx},${y1 + 60} ${xx},${y2 - 60} ${x2},${y2}`;
    }
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
    if (x2 > x1 + 4) { const dx = Math.max(28, (x2 - x1) / 2); return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`; }
    // same column (bad data) — loop around
    const yy = Math.max(y1, y2) + H; return `M${x1},${y1} C${x1 + 60},${yy} ${x2 - 60},${yy} ${x2},${y2}`;
  }

  /* opts: { proc, keep(step,section), editable, selected, laneInfo(lane) → {icon,sub}, status(step), blocked(step), mine(lane) → bool,
             onSelect(id), onOpen(id), onLink(fromId,toId), onUnlink(fromId,toId,ev), onMoveLane(id,laneId), onAdd(laneId),
             zoomKey, dirKey, focusKey (team filter, stored), defaultFocus [laneIds], onFocus(focus) } */
  function render(opts) {
    const root = h("div.flow");
    let scrollKeep = null;
    const draw = () => {
      const old = root.querySelector(".flow-scroll"); if (old) scrollKeep = [old.scrollLeft, old.scrollTop];
      root.innerHTML = "";
      build(root, opts, draw);
      const sc = root.querySelector(".flow-scroll"); if (sc && scrollKeep) { sc.scrollLeft = scrollKeep[0]; sc.scrollTop = scrollKeep[1]; }
    };
    draw();
    return root;
  }

  function build(root, opts, redraw) {
    const dir = PR.app.LS.get(opts.dirKey || "flowDir", "h") === "v" ? "v" : "h";
    const allLanes = PR.model.tracks(opts.proc);
    const focus = opts.focusKey ? focusGet(opts.focusKey, opts.defaultFocus || []).filter((id) => allLanes.some((t) => t.id === id)) : [];
    const g = layout(filterGraph(PR.model.flowGraph(opts.proc, opts.keep), focus), dir);
    const V = dir === "v";
    let zoom = Number(PR.app.LS.get(opts.zoomKey || "flowZoom", 1)) || 1;
    const svg = s("svg", { class: `flow-svg dir-${dir}`, viewBox: `0 0 ${g.width} ${g.height}`, role: "img", "aria-label": "Workflow diagram" });
    const applyZoom = () => { svg.setAttribute("width", Math.round(g.width * zoom)); svg.setAttribute("height", Math.round(g.height * zoom)); };
    applyZoom();
    const marker = (id, w) => s("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: w, markerHeight: w, orient: "auto-start-reverse" }, s("path", { d: "M0,0 L10,5 L0,10 z", class: id }));
    svg.append(s("defs", marker("fa-order", 6), marker("fa-dep", 7), marker("fa-wait", 7), marker("fa-ok", 7)));
    const setFocus = (f) => { if (!opts.focusKey) return; focusSet(opts.focusKey, f); if (opts.onFocus) opts.onFocus(f); redraw(); };

    // lanes
    const lanesG = s("g", { class: "flow-lanes" });
    g.lanes.forEach((l) => {
      const info = (opts.laneInfo && opts.laneInfo(l)) || {};
      const mine = opts.mine && opts.mine(l);
      const name = `${info.icon ? info.icon + " " : ""}${l.name}`;
      const hiddenTxt = l.hiddenCount ? `${l.hiddenCount} step${l.hiddenCount > 1 ? "s" : ""} hidden` : "";
      const lg = s("g", { class: `flow-lane${l.shared ? " shared" : ""}${mine ? " mine" : ""}${l.collapsed ? " collapsed" : ""}`, "data-lane": l.id, style: `--c:${l.color}` });
      if (V) lg.append(
        s("rect", { class: "fl-band", x: l.x, y: 0, width: l.w, height: g.height, rx: 10 }),
        s("rect", { class: "fl-bar", x: l.x, y: 0, width: l.w, height: 6, rx: 3 }),
        s("text", { class: "fl-name", x: l.x + 14, y: 28 }, name.slice(0, l.collapsed ? 13 : 24)),
        s("text", { class: "fl-sub", x: l.x + 14, y: 46 }, String(l.collapsed ? hiddenTxt : (mine ? "● your lane · " : "") + (info.sub || "")).slice(0, l.collapsed ? 18 : 30)),
        !l.collapsed && hiddenTxt ? s("text", { class: "fl-sub", x: l.x + 14, y: 62 }, `${hiddenTxt} — not linked`) : null);
      else lg.append(
        s("rect", { class: "fl-band", x: 0, y: l.y, width: g.width, height: l.h, rx: 10 }),
        s("rect", { class: "fl-bar", x: 0, y: l.y, width: 6, height: l.h, rx: 3 }),
        s("text", { class: "fl-name", x: 18, y: l.y + (l.collapsed ? 25 : 26) }, name.slice(0, 22)),
        l.collapsed ? s("text", { class: "fl-sub", x: LABEL + 24, y: l.y + 25 }, `${hiddenTxt} — none linked to the teams shown · click to show`) : null,
        !l.collapsed && info.sub ? s("text", { class: "fl-sub", x: 18, y: l.y + 44 }, String(info.sub).slice(0, 26)) : null,
        !l.collapsed && mine ? s("text", { class: "fl-sub fl-you", x: 18, y: l.y + (info.sub ? 60 : 44) }, "● your lane") : null,
        !l.collapsed && hiddenTxt ? s("text", { class: "fl-sub fl-hid", x: 18, y: l.y + (mine ? 76 : 60) }, `+${hiddenTxt.replace(" hidden", "")} not linked`) : null);
      if (l.collapsed || (!l.focused && focus.length && !l.shared)) {
        lg.classList.add("clickable");
        lg.append(s("title", `Show ${l.name}'s steps too`));
        lg.addEventListener("click", (e) => { if (e.target.closest("[data-node]")) return; setFocus([...focus, l.id]); });
      }
      if (opts.editable && opts.onAdd && !l.collapsed) {
        const add = V ? s("g", { class: "fl-add", "data-add": l.id, transform: `translate(${l.x + l.w - 34},14)` }, s("rect", { width: 24, height: 22, rx: 11 }), s("text", { x: 12, y: 15 }, "＋"), s("title", `Add a step for ${l.name}`))
          : s("g", { class: "fl-add", "data-add": l.id, transform: `translate(18,${l.y + l.h - 28})` }, s("rect", { width: 92, height: 22, rx: 11 }), s("text", { x: 46, y: 15 }, "＋ Add step"));
        add.addEventListener("click", (e) => { e.stopPropagation(); opts.onAdd(l.id); });
        lg.append(add);
      }
      lanesG.append(lg);
    });
    svg.append(lanesG);

    // edges
    const edges = s("g", { class: "flow-edges" });
    const st = (n) => (opts.status ? opts.status(n.step) : "");
    const doneish = (n) => ["done", "skipped", "na"].includes(st(n));
    const laneColor = (id) => (g.lanes.find((l) => l.id === id) || {}).color || "#64748b";
    g.nodes.forEach((n) => n.order.forEach((m) => edges.append(s("path", { class: "fe-order", d: edgePath(m, n, dir), "marker-end": "url(#fa-order)" }))));
    g.nodes.forEach((n) => n.deps.forEach((m) => {
      const runState = opts.status ? (doneish(m) ? "ok" : "wait") : "";
      const d = edgePath(m, n, dir);
      const hit = s("path", { class: "fe-hit", d, "data-from": m.id, "data-to": n.id }, s("title", `${n.step.num || ""} ${n.step.title} waits for ${m.step.num || ""} ${m.step.title}${opts.editable ? " — click to remove" : ""}`));
      if (opts.editable && opts.onUnlink) hit.addEventListener("click", (e) => { e.stopPropagation(); opts.onUnlink(m.id, n.id, e); });
      edges.append(s("path", { class: `fe-dep${runState ? " " + runState : ""}${m.vis === "ghost" || n.vis === "ghost" ? " cross" : ""}`, d, style: `--c:${laneColor(m.lane)}`, "marker-end": `url(#fa-${runState || "dep"})` }), hit);
    }));
    svg.append(edges);

    // nodes
    const nodesG = s("g", { class: "flow-nodes" });
    g.nodes.forEach((n) => {
      const status = st(n) || "";
      const blocked = status === "pending" && opts.blocked && opts.blocked(n.step);
      const lines = wrap(n.step.title, 25);
      const meta = [n.step.estMin ? `⏱ ${n.step.estMin}m` : "", n.deps.length ? `⏳ ${n.deps.map((d) => "#" + (d.step.num || "?")).join(" ")}` : "", n.step.critical ? "★" : "", (n.step.blocks || []).some((b) => b.type === "decision" || b.type === "approval") ? "⚖" : ""].filter(Boolean).join("  ");
      const badge = { done: "✓", active: "◉", skipped: "↷", na: "–" }[status] || (blocked ? "🔒" : "");
      const ln = g.lanes.find((l) => l.id === n.lane);
      const gN = s("g", { class: `flow-node${status ? " s-" + status : ""}${blocked ? " blocked" : ""}${n.vis === "ghost" ? " ghost" : ""}${opts.selected === n.id ? " is-sel" : ""}`, "data-node": n.id, "data-step-id": n.id, transform: `translate(${n.x},${n.y})`, tabindex: 0, style: `--c:${laneColor(n.lane)}` },
        s("rect", { class: "fn-box", width: W, height: H, rx: 9 }),
        s("rect", { class: "fn-stripe", width: 5, height: H, rx: 2 }),
        s("text", { class: "fn-num", x: 13, y: 17 }, n.step.num ? `#${n.step.num}` : "", n.vis === "ghost" && ln ? s("tspan", { class: "fn-owner" }, `  ${ln.name}`) : n.step.owner && n.lane === "shared" ? s("tspan", { class: "fn-owner" }, `  ${String(n.step.owner).slice(0, 16)}`) : null),
        lines.map((t, i) => s("text", { class: "fn-title", x: 13, y: 33 + i * 14 }, t)),
        meta ? s("text", { class: "fn-meta", x: W - 8, y: 17, "text-anchor": "end" }, meta.slice(0, 22)) : null,
        badge ? s("text", { class: "fn-badge", x: W - 10, y: H - 8, "text-anchor": "end" }, badge) : null,
        s("title", `${n.step.num || ""} ${n.step.title}${n.vis === "ghost" && ln ? `\n${ln.name}'s step — shown because it hands off to or from a team you're looking at` : ""}${n.deps.length ? "\nWaits for: " + n.deps.map((d) => `${d.step.num || ""} ${d.step.title}`).join(", ") : ""}${opts.editable ? "\nDrag the ● to another step to make it wait for this one. Drag the box to another lane to hand it to that team." : ""}`));
      if (opts.editable) gN.append(s("circle", { class: "fn-handle", cx: V ? W / 2 : W, cy: V ? H : H / 2, r: 7, "data-handle": n.id }));
      nodesG.append(gN);
    });
    svg.append(nodesG);

    const temp = s("path", { class: "fe-temp", d: "" });
    svg.append(temp);

    // interaction
    const pt = (e) => { const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: p.x, y: p.y }; };
    const nodeAt = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); const n = el && el.closest && el.closest("[data-node]"); return n ? n.dataset.node : null; };
    const laneAt = (p) => (V ? g.lanes.find((l) => p.x >= l.x && p.x <= l.x + l.w + 6) : g.lanes.find((l) => p.y >= l.y && p.y <= l.y + l.h + 6)) || null;
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const handle = e.target.closest("[data-handle]");
      const node = e.target.closest("[data-node]");
      if (!node) return;
      const id = node.dataset.node; const n = g.byId.get(id);
      if (opts.editable && handle) { drag = { kind: "link", id, n }; svg.setPointerCapture(e.pointerId); svg.classList.add("linking"); e.preventDefault(); return; }
      drag = { kind: "node", id, n, el: node, start: pt(e), moved: false };
      if (opts.editable) svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = pt(e);
      if (drag.kind === "link") {
        temp.setAttribute("d", V ? `M${drag.n.x + W / 2},${drag.n.y + H} L${p.x},${p.y}` : `M${drag.n.x + W},${drag.n.y + H / 2} L${p.x},${p.y}`);
        svg.querySelectorAll(".flow-node.drop").forEach((x) => x.classList.remove("drop"));
        const t = nodeAt(e); if (t && t !== drag.id) { const el = svg.querySelector(`[data-node="${t}"]`); el && el.classList.add("drop"); }
      } else if (opts.editable) {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        drag.el.setAttribute("transform", `translate(${drag.n.x + dx},${drag.n.y + dy})`);
        drag.el.classList.add("dragging");
        svg.querySelectorAll(".flow-lane.target").forEach((x) => x.classList.remove("target"));
        const l = laneAt(p); if (l && l.id !== drag.n.lane) { const el = svg.querySelector(`[data-lane="${l.id}"]`); el && el.classList.add("target"); }
      }
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      svg.classList.remove("linking"); temp.setAttribute("d", "");
      svg.querySelectorAll(".drop,.target").forEach((x) => x.classList.remove("drop", "target"));
      if (e.type === "pointercancel") { if (d.el) d.el.setAttribute("transform", `translate(${d.n.x},${d.n.y})`); return; }
      if (d.kind === "link") { const t = nodeAt(e); if (t && t !== d.id && opts.onLink) opts.onLink(d.id, t); return; }
      if (d.moved) {
        const l = laneAt(pt(e));
        d.el.setAttribute("transform", `translate(${d.n.x},${d.n.y})`); d.el.classList.remove("dragging");
        if (l && l.id !== d.n.lane && opts.onMoveLane) opts.onMoveLane(d.id, l.id);
        return;
      }
      opts.onSelect && opts.onSelect(d.id);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("dblclick", (e) => { const n = e.target.closest("[data-node]"); if (n && opts.onOpen) opts.onOpen(n.dataset.node); });
    svg.addEventListener("keydown", (e) => { const n = e.target.closest && e.target.closest("[data-node]"); if (n && e.key === "Enter") { e.preventDefault(); (opts.onOpen || opts.onSelect || (() => {}))(n.dataset.node); } });

    const scroller = h("div.flow-scroll", svg);
    const setZoom = (z) => { zoom = Math.max(0.4, Math.min(1.6, Math.round(z * 10) / 10)); PR.app.LS.set(opts.zoomKey || "flowZoom", zoom); applyZoom(); zl.textContent = Math.round(zoom * 100) + "%"; };
    const zl = h("span.flow-zl", Math.round(zoom * 100) + "%");
    const teams = opts.focusKey && allLanes.length > 1 ? teamBar(allLanes, focus, setFocus, opts) : null;
    const tools = h("div.flow-tools",
      teams,
      h("div.spacer"),
      h("div.seg.seg-sm.flow-dir", { title: "Lay the workflow out left → right or top → bottom" }, [["h", "⇢ Horizontal"], ["v", "⇣ Vertical"]].map(([k, l]) =>
        h(`button.seg-btn${dir === k ? ".on" : ""}`, { type: "button", onclick: () => { PR.app.LS.set(opts.dirKey || "flowDir", k); redraw(); } }, l))),
      h("button.icon-btn.sm", { type: "button", title: "Zoom out", onclick: () => setZoom(zoom - 0.1) }, "−"), zl,
      h("button.icon-btn.sm", { type: "button", title: "Zoom in", onclick: () => setZoom(zoom + 0.1) }, "＋"),
      h("button.btn.btn-sm.btn-ghost", { type: "button", title: "Fit the whole workflow in the window", onclick: () => { const w = scroller.clientWidth - 8; setZoom(Math.min(1, w / g.width)); } }, "Fit"));
    const legend = h("div.flow-legend",
      h("span.lg", h("i.lg-order"), "order"),
      h("span.lg", h("i.lg-dep"), opts.status ? "hand-off (green = ready, amber = waiting)" : "hand-off — waits for"),
      focus.length ? h("span.lg", h("i.lg-ghost"), "another team's step linked to yours") : null,
      opts.status ? [h("span.lg", h("i.lg-s.done"), "done"), h("span.lg", h("i.lg-s.active"), "in progress"), h("span.lg", "🔒 waiting on another team")] : null,
      opts.editable ? h("span.lg.muted", `Drag a step's ● onto another step to make it wait · drag a step into another lane · click an arrow to remove it`) : null);
    root.append(tools, legend, g.loop ? h("div.banner.b-warn.sm", "⚠ Some steps wait for each other in a loop — remove one of the arrows so the work can flow.") : null, scroller);
    root.graph = g;
    root.scrollToNode = (id) => { const n = g.byId.get(id); if (n) scroller.scrollTo({ left: Math.max(0, n.x * zoom - scroller.clientWidth / 2), top: Math.max(0, n.y * zoom - scroller.clientHeight / 2), behavior: "smooth" }); };
  }

  /* "Show: All teams · 🧩 Core · 🌐 Network …" — click a team to show only it, Ctrl/⇧+click to add more */
  function teamBar(lanes, focus, setFocus, opts) {
    const info = (l) => (opts.laneInfo && opts.laneInfo(l)) || {};
    const mine = lanes.filter((l) => opts.mine && opts.mine(l)).map((l) => l.id);
    return h("div.team-bar", h("span.tb-k", "Show"),
      h(`button.tb-chip${!focus.length ? ".on" : ""}`, { type: "button", onclick: () => setFocus([]) }, "All teams"),
      lanes.map((l) => h(`button.tb-chip${focus.includes(l.id) ? ".on" : ""}`, { type: "button", style: { "--c": l.color }, title: "Click: only this team (plus steps linked to it). Ctrl+click: add or remove it.",
        onclick: (e) => { const multi = e.ctrlKey || e.metaKey || e.shiftKey; setFocus(multi ? (focus.includes(l.id) ? focus.filter((x) => x !== l.id) : [...focus, l.id]) : focus.length === 1 && focus[0] === l.id ? [] : [l.id]); } },
        h("i"), `${info(l).icon ? info(l).icon + " " : ""}${l.name}`, mine.includes(l.id) ? h("small", " (you)") : null)));
  }

  return { render, layout, wrap, focusGet, focusSet, myLanes, teamBar };
})();
