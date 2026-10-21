/* util.js — shared helpers (DOM builder, formatting, modals, toasts, menus, files).
   Everything hangs off the global OC namespace so the app runs from file:// or http:// with no build step. */
window.OC = window.OC || {};

/* Make Element.append tolerant of null/false/arrays (we build lots of conditional UI). */
(() => {
  const orig = Element.prototype.append;
  const flat = (arr, out = []) => { for (const x of arr) { if (x == null || x === false) continue; if (Array.isArray(x)) flat(x, out); else out.push(x); } return out; };
  Element.prototype.append = function (...kids) { return orig.apply(this, flat(kids)); };
})();

OC.u = (() => {
  const now = () => Date.now();
  const uid = (p = "id") => `${p}_${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* h("div.card#main", {onclick, style, dataset, ...attrs}, ...children) */
  function h(tag, attrs, ...children) {
    let tagName = tag, id = null, classes = [];
    const m = tag.match(/^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i);
    if (m) {
      tagName = m[1] || "div";
      (m[2].match(/[.#][\w-]+/g) || []).forEach((t) => (t[0] === "." ? classes.push(t.slice(1)) : (id = t.slice(1))));
    }
    const el = document.createElement(tagName);
    if (id) el.id = id;
    if (classes.length) el.className = classes.join(" ");
    if (attrs != null && attrs !== false && (attrs.nodeType || typeof attrs !== "object" || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = [el.className, v].filter(Boolean).join(" ");
        else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k === "html") el.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "value") el.value = v;
        else if (k === "checked" || k === "disabled" || k === "selected" || k === "readOnly") el[k] = !!v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    appendKids(el, children);
    return el;
  }
  function appendKids(el, kids) {
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) appendKids(el, c);
      else if (c.nodeType) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
  }

  const pad = (n) => String(n).padStart(2, "0");
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtTime(ts) { if (!ts) return "—"; const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function fmtDateTime(ts) { return ts ? `${fmtDate(ts)} ${fmtTime(ts)}` : "—"; }
  function fmtLong(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  function ago(ts) {
    if (!ts) return "never";
    const d = (now() - ts) / 1000;
    if (d < 45) return "just now";
    if (d < 3600) return `${Math.max(1, Math.round(d / 60))} min ago`;
    if (d < 86400) return `${Math.round(d / 3600)} h ago`;
    return fmtDateTime(ts);
  }
  const plural = (n, word, many) => `${n} ${n === 1 ? word : many || word + "s"}`;

  function debounce(fn, ms) {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); return fn(...a); };
    d.cancel = () => clearTimeout(t);
    return d;
  }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item"; }
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  function initials(name) {
    const parts = String(name || "").replace(/[^A-Za-z\s'-]/g, " ").split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function download(name, content, type = "application/json") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const i = h("input", { type: "file", accept, style: "display:none" });
      i.onchange = () => { resolve(i.files[0] || null); i.remove(); };
      document.body.appendChild(i); i.click();
    });
  }
  function readFile(file, as = "text") {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = () => rej(r.error);
      if (as === "buffer") r.readAsArrayBuffer(file); else if (as === "dataurl") r.readAsDataURL(file); else r.readAsText(file);
    });
  }
  function csv(rows) {
    return rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\r\n");
  }
  async function copyText(text, msg = "Copied") {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = h("textarea", { style: "position:fixed;opacity:0" }); t.value = text;
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    toast(msg, "ok", 1400);
  }
  function isTyping(e) {
    const t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  /* ---------- Toasts (optionally with an action, e.g. Undo) ---------- */
  function toast(msg, kind = "info", ms = 2800, action) {
    let host = $("#toasts");
    if (!host) { host = h("div#toasts"); document.body.appendChild(host); }
    [...host.children].forEach((c) => { if (c.dataset.msg === String(msg)) c.remove(); });
    while (host.children.length >= 3) host.firstChild.remove();
    const t = h(`div.toast.t-${kind}`, { dataset: { msg: String(msg) } }, h("span", msg),
      action ? h("button.toast-act", { type: "button", onclick: () => { action.onClick(); t.remove(); } }, action.label) : null);
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, action ? Math.max(ms, 6000) : ms);
  }

  /* ---------- Modals ----------
     modal({ title, body: Node|fn(close)->Node, actions:[{label, kind, onClick(close)->bool|void, value}], size:'sm'|'md'|'lg'|'xl'|'full' })
     Resolves with the action value (or null on dismiss). */
  const modalStack = [];
  function modal({ title, subtitle, body, actions = [], size = "md", dismissable = true, onClose, className = "" }) {
    return new Promise((resolve) => {
      let done = false;
      const close = (val = null) => {
        if (done) return; done = true;
        if (back.contains(document.activeElement)) document.activeElement.blur();
        back.classList.remove("show");
        setTimeout(() => back.remove(), 160);
        modalStack.splice(modalStack.indexOf(close), 1);
        onClose && onClose(val);
        resolve(val);
      };
      const bodyNode = typeof body === "function" ? body(close) : body;
      const foot = actions.length ? h("div.modal-foot", actions.map((a) => {
        if (a.spacer) return h("div.spacer");
        return h(`button.btn${a.kind ? ".btn-" + a.kind : ""}`, {
          type: "button", disabled: a.disabled,
          onclick: async () => {
            if (a.onClick) { const r = await a.onClick(close); if (r === false) return; if (done) return; }
            close(a.value !== undefined ? a.value : a.label);
          },
        }, a.label);
      })) : null;
      const dlg = h(`div.modal.m-${size}${className ? "." + className : ""}`, { role: "dialog", "aria-modal": "true" },
        h("div.modal-head",
          h("div", h("div.modal-title", title || ""), subtitle ? h("div.modal-sub", subtitle) : null),
          dismissable ? h("button.icon-btn.modal-x", { type: "button", title: "Close (Esc)", onclick: () => close(null) }, "✕") : null),
        h("div.modal-body", bodyNode), foot);
      const back = h("div.modal-back", { onmousedown: (e) => { if (e.target === back && dismissable) close(null); } }, dlg);
      back._close = close; back._dismissable = dismissable;
      document.body.appendChild(back);
      modalStack.push(close);
      requestAnimationFrame(() => {
        back.classList.add("show");
        const f = dlg.querySelector("[autofocus], .modal-body input:not([type=checkbox]):not([type=radio]), .modal-body textarea, .modal-body select");
        if (f) f.focus();
      });
    });
  }
  const topModalOpen = () => modalStack.length > 0;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalStack.length) {
      const backs = $$(".modal-back");
      const top = backs[backs.length - 1];
      if (top && top._dismissable) { e.preventDefault(); e.stopPropagation(); top._close(null); }
    }
  }, true);

  function confirmBox(title, message, { ok = "Confirm", kind = "primary", cancel = "Cancel" } = {}) {
    return modal({
      title, size: "sm", body: h("div.confirm-msg", message),
      actions: [{ spacer: true }, { label: cancel, value: false }, { label: ok, kind, value: true }],
    }).then((v) => v === true);
  }
  function promptBox(title, { label = "", value = "", placeholder = "", ok = "Save", multiline = false, required = false, help = "" } = {}) {
    let input;
    return modal({
      title, size: "sm",
      body: h("div.field", label ? h("label.lbl", label) : null,
        input = multiline ? h("textarea.inp", { rows: 4, placeholder }, value) : h("input.inp", { value, placeholder, autofocus: true,
          onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); input.closest(".modal").querySelector(".btn-primary").click(); } } }),
        help ? h("div.help", help) : null),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, {
        label: ok, kind: "primary",
        onClick: () => { if (required && !input.value.trim()) { input.classList.add("err"); input.focus(); return false; } },
        value: "__ok",
      }],
    }).then((v) => (v === "__ok" ? input.value : null));
  }

  /* Popover menu anchored to an element or a {x,y} point. items: [{label, icon, onClick, danger, disabled, sep, header, checked, sub:[...]}] */
  function menu(anchor, items, { align = "left" } = {}) {
    closeMenus();
    const m = buildMenu(items);
    document.body.appendChild(m);
    place(m, anchor, align);
    setTimeout(() => { document.addEventListener("mousedown", outside, true); window.addEventListener("blur", closeMenus); }, 0);
    function outside(e) { if (!e.target.closest(".pop-menu")) closeMenus(); }
    m._cleanup = () => { document.removeEventListener("mousedown", outside, true); window.removeEventListener("blur", closeMenus); };
    return m;
  }
  function buildMenu(items, sub = false) {
    return h(`div.pop-menu${sub ? ".sub" : ""}`, { role: "menu" }, items.filter(Boolean).map((it) => {
      if (it.sep) return h("div.pm-sep");
      if (it.header) return h("div.pm-head", it.header);
      const btn = h(`button.pm-item${it.danger ? ".danger" : ""}${it.checked ? ".checked" : ""}`, {
        type: "button", role: "menuitem", disabled: it.disabled,
        onclick: (e) => { e.stopPropagation(); if (it.sub) return; closeMenus(); it.onClick && it.onClick(); },
      }, h("span.pm-ic", it.checked ? "✓" : it.icon || ""), h("span.pm-label", it.label), it.hint ? h("span.pm-hint", it.hint) : null, it.sub ? h("span.pm-arrow", "›") : null);
      if (it.sub) {
        const wrap = h("div.pm-subwrap", btn);
        let sm = null;
        wrap.addEventListener("mouseenter", () => { if (sm) return; sm = buildMenu(it.sub, true); document.body.appendChild(sm); const r = btn.getBoundingClientRect(); place(sm, { x: r.right - 4, y: r.top - 5 }); sm.addEventListener("mouseleave", (e) => { if (!wrap.contains(e.relatedTarget)) { sm.remove(); sm = null; } }); });
        wrap.addEventListener("mouseleave", (e) => { if (sm && !sm.contains(e.relatedTarget)) { sm.remove(); sm = null; } });
        btn.addEventListener("click", () => wrap.dispatchEvent(new Event("mouseenter")));
        return wrap;
      }
      return btn;
    }));
  }
  function place(m, anchor, align = "left") {
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left, top;
    if (anchor && anchor.nodeType) {
      const r = anchor.getBoundingClientRect();
      left = align === "right" ? r.right - mw : r.left; top = r.bottom + 4;
      if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    } else { left = anchor.x; top = anchor.y; if (top + mh > innerHeight - 8) top = Math.max(8, innerHeight - mh - 8); }
    left = Math.max(8, Math.min(left, innerWidth - mw - 8));
    m.style.left = left + "px"; m.style.top = top + "px";
  }
  function closeMenus() { $$(".pop-menu").forEach((m) => { m._cleanup && m._cleanup(); m.remove(); }); }

  /* Drag-to-reorder for a vertical list. onDrop(newOrderOfDatasetIds). Handles: [data-drag-handle] or whole row. */
  function sortable(list, { item = "[data-id]", onDrop, handle = null } = {}) {
    let dragEl = null;
    list.addEventListener("dragstart", (e) => {
      const it = e.target.closest && e.target.closest(item);
      if (!it || !list.contains(it)) return;
      if (handle && !(e.target.closest(handle) || it.dataset.dragAnywhere)) { /* allow */ }
      dragEl = it; it.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", it.dataset.id); } catch { /* ignore */ }
    });
    list.addEventListener("dragover", (e) => {
      if (!dragEl) return;
      e.preventDefault();
      const over = e.target.closest && e.target.closest(item);
      if (!over || over === dragEl || over.parentNode !== dragEl.parentNode) return;
      const r = over.getBoundingClientRect();
      over.parentNode.insertBefore(dragEl, e.clientY < r.top + r.height / 2 ? over : over.nextSibling);
    });
    list.addEventListener("dragend", () => {
      if (!dragEl) return;
      const parent = dragEl.parentNode;
      dragEl.classList.remove("dragging"); dragEl = null;
      onDrop && onDrop([...parent.children].filter((c) => c.matches(item)).map((c) => c.dataset.id), parent);
    });
  }

  return {
    now, uid, clone, isObj, $, $$, esc, h, fmtDate, fmtTime, fmtDateTime, fmtLong, ago, plural, debounce, slug, norm, initials,
    download, pickFile, readFile, csv, copyText, isTyping, toast, modal, topModalOpen, confirmBox, promptBox, menu, closeMenus, sortable,
  };
})();
