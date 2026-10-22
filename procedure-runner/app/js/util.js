/* util.js — shared helpers (DOM builder, formatting, modals, toasts, clipboard, images).
   Everything hangs off the global PR namespace so the app runs from file:// or http:// with no build step. */
window.PR = window.PR || {};

/* Make Element.append tolerant of null/false/arrays (we build lots of conditional UI). */
(() => {
  const orig = Element.prototype.append;
  const flat = (arr, out = []) => { for (const x of arr) { if (x == null || x === false) continue; if (Array.isArray(x)) flat(x, out); else out.push(x); } return out; };
  Element.prototype.append = function (...kids) { return orig.apply(this, flat(kids)); };
})();

PR.u = (() => {
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
    // anything that isn't a plain options object (text, numbers incl. 0, nodes, arrays, null) is the first child
    if (attrs !== undefined && (attrs === null || typeof attrs !== "object" || attrs.nodeType || Array.isArray(attrs))) {
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

  function pad(n) { return String(n).padStart(2, "0"); }
  function fmtDur(ms, { short = false } = {}) {
    if (ms == null || isNaN(ms)) return "—";
    const neg = ms < 0; ms = Math.abs(ms);
    const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    if (short) {
      if (hh) return `${neg ? "-" : ""}${hh}h ${mm}m`;
      if (mm) return `${neg ? "-" : ""}${mm}m ${ss}s`;
      return `${neg ? "-" : ""}${ss}s`;
    }
    return `${neg ? "-" : ""}${hh ? hh + ":" : ""}${pad(mm)}:${pad(ss)}`;
  }
  function fmtMin(min) {
    if (!min) return "";
    if (min < 60) return `${Math.round(min)}m`;
    return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  }
  function fmtTime(ts, sec = true) {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}${sec ? ":" + pad(d.getSeconds()) : ""}`;
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtDateTime(ts) { return ts ? `${fmtDate(ts)} ${fmtTime(ts)}` : "—"; }
  function toLocalInput(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return `${fmtDate(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function fromLocalInput(v) { const t = v ? new Date(v).getTime() : NaN; return isNaN(t) ? null : t; }
  function ago(ts) {
    if (!ts) return "never";
    const d = (now() - ts) / 1000;
    if (d < 60) return "just now";
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
    return fmtDate(ts);
  }

  function debounce(fn, ms) {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); return fn(...a); };
    return d;
  }

  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item"; }

  function download(name, content, type = "application/json") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const i = h("input", { type: "file", accept, style: "display:none" });
      i.onchange = () => { resolve(i.files[0] || null); i.remove(); };
      document.body.appendChild(i); i.click();
    });
  }
  function csv(rows) {
    return rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\r\n");
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = h("textarea", { style: "position:fixed;opacity:0" }); t.value = text;
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    toast("Copied to clipboard", "ok", 1200);
  }

  /* Downscale an image Blob to JPEG/PNG data URL so screenshots stay small in storage. */
  function compressImage(blob, maxDim = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL(blob.type === "image/png" && scale === 1 && blob.size < 400000 ? "image/png" : "image/jpeg", quality));
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }
  function fileToDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  function dataURLToBlob(d) {
    const [head, b64] = d.split(",");
    const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* ---------- Mini markdown: **bold**, *em*, `code`, [text](url), bare urls, nested "- " / "-- " bullets, "1." lists ---------- */
  function inline(s) {
    let t = esc(s);
    t = t.replace(/`([^`]+)`/g, '<code class="ic" data-copy="$1" title="Click to copy">$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    t = t.replace(/\{\{\s*([\w.]+)\s*\}\}/g, '<span class="var-chip">{{$1}}</span>');
    t = t.replace(/⁣([^⁤]*)⁤/g, '<span class="var-val">$1</span>');
    return t;
  }
  function md(src) {
    const lines = String(src || "").replace(/\r/g, "").split("\n");
    let out = "", depth = 0, fence = null;
    const close = (to) => { while (depth > to) { out += "</ul>"; depth--; } };
    for (const raw of lines) {
      // ``` fenced text renders as a console window (exact spacing, copy button)
      if (/^\s*```/.test(raw)) {
        if (fence) { const txt = fence.join("\n"); out += `<div class="console md-console"><div class="console-bar"><span class="console-dots"><i></i><i></i><i></i></span><span class="console-title">Console</span><span class="spacer"></span><button type="button" class="console-btn" data-copy-block="${esc(txt)}">Copy</button></div><pre class="console-body">${esc(txt)}</pre></div>`; fence = null; }
        else { close(0); fence = []; }
        continue;
      }
      if (fence) { fence.push(raw.replace(/\u2063|\u2064/g, "")); continue; }
      const line = raw.replace(/\s+$/, "");
      const b = line.match(/^\s*(-{1,4}|\*|•)\s+(.*)$/);
      if (b) {
        const lvl = b[1][0] === "-" ? b[1].length : 1;
        while (depth < lvl) { out += '<ul class="md-ul">'; depth++; }
        close(lvl);
        out += `<li>${inline(b[2])}</li>`;
        continue;
      }
      close(0);
      const n = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (n) { out += `<div class="md-ol"><span class="md-n">${n[1]}.</span> ${inline(n[2])}</div>`; continue; }
      if (!line.trim()) { out += '<div class="md-gap"></div>'; continue; }
      const hd = line.match(/^#{1,3}\s+(.*)$/);
      out += hd ? `<div class="md-h">${inline(hd[1])}</div>` : `<div class="md-p">${inline(line)}</div>`;
    }
    if (fence) out += `<pre class="console-body">${esc(fence.join("\n"))}</pre>`;
    close(0);
    return out;
  }

  /* ---------- Toasts ---------- */
  function toast(msg, kind = "info", ms = 2600) {
    let host = $("#toasts");
    if (!host) { host = h("div#toasts"); document.body.appendChild(host); }
    // replace an identical message instead of stacking, and keep at most 3 on screen
    [...host.children].forEach((c) => { if (c.textContent === String(msg)) c.remove(); });
    while (host.children.length >= 3) host.firstChild.remove();
    const t = h(`div.toast.t-${kind}`, msg);
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
  }

  /* ---------- Modals ----------
     modal({ title, body: Node|fn(close)->Node, actions:[{label, kind, onClick(close)->bool|void, value}], size:'sm'|'md'|'lg'|'xl', onClose })
     Resolves with the action value (or null on dismiss). */
  const modalStack = [];
  function modal({ title, subtitle, body, actions = [], size = "md", dismissable = true, onClose, className = "", enter = false }) {
    return new Promise((resolve) => {
      let done = false;
      const close = (val = null) => {
        if (done) return; done = true;
        // Release focus now so keystrokes during the fade-out reach the page, not the closing dialog.
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
          type: "button",
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
      back._close = close; back._dismissable = dismissable; back._enter = enter;
      document.body.appendChild(back);
      modalStack.push(close);
      requestAnimationFrame(() => {
        back.classList.add("show");
        const f = dlg.querySelector("[autofocus], .modal-body input:not([type=checkbox]), .modal-body textarea, .modal-body select");
        if (f) f.focus();
      });
    });
  }
  function topModalOpen() { return modalStack.length > 0; }
  document.addEventListener("keydown", (e) => {
    // enter:true modals (confirmations) take Enter as their primary button, so keyboard flows never need the mouse
    if (e.key === "Enter" && !e.shiftKey && modalStack.length) {
      const backs = $$(".modal-back"); const top = backs[backs.length - 1];
      const t = e.target;
      if (top && top._enter && !(t && (t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "SELECT"))) { const b = top.querySelector(".modal-foot .btn-primary"); if (b) { e.preventDefault(); b.click(); } }
    }
    if (e.key === "Escape" && modalStack.length) {
      const backs = $$(".modal-back");
      const top = backs[backs.length - 1];
      if (top && top._dismissable) { e.preventDefault(); top._close(null); }
    }
  });

  function confirmBox(title, message, { ok = "Confirm", kind = "primary", cancel = "Cancel" } = {}) {
    return modal({
      title, size: "sm", body: h("div.confirm-msg", message), enter: true,
      actions: [{ spacer: true }, { label: cancel, value: false }, { label: ok, kind, value: true }],
    }).then((v) => v === true);
  }
  function promptBox(title, { label = "", value = "", placeholder = "", ok = "Save", multiline = false, required = false } = {}) {
    let input;
    return modal({
      title, size: "sm",
      body: h("div.field", label ? h("label.lbl", label) : null,
        input = multiline ? h("textarea.inp", { rows: 4, placeholder }, value) : h("input.inp", { value, placeholder, autofocus: true,
          onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); input.closest(".modal").querySelector(".btn-primary").click(); } } })),
      actions: [{ spacer: true }, { label: "Cancel", value: null }, {
        label: ok, kind: "primary",
        onClick: () => { if (required && !input.value.trim()) { input.classList.add("err"); input.focus(); return false; } },
        value: undefined,
      }],
    }).then((v) => (v === ok ? input.value : null));
  }

  /* Popover menu anchored to an element. items: [{label, icon, onClick, danger, disabled, sep}] */
  function menu(anchor, items, { align = "left" } = {}) {
    closeMenus();
    const m = h("div.pop-menu", items.filter(Boolean).map((it) => it.sep ? h("div.pm-sep") :
      it.header ? h("div.pm-head", it.header) :
      h(`button.pm-item${it.danger ? ".danger" : ""}`, { type: "button", disabled: it.disabled, onclick: (e) => { e.stopPropagation(); closeMenus(); it.onClick && it.onClick(); } },
        h("span.pm-ic", it.icon || ""), h("span", it.label), it.hint ? h("span.pm-hint", it.hint) : null)));
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = align === "right" ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, innerWidth - mw - 8));
    let top = r.bottom + 4;
    if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    m.style.left = left + "px"; m.style.top = top + "px";
    setTimeout(() => document.addEventListener("mousedown", outside), 0);
    function outside(e) { if (!m.contains(e.target)) closeMenus(); }
    m._cleanup = () => document.removeEventListener("mousedown", outside);
    return m;
  }
  function closeMenus() { $$(".pop-menu").forEach((m) => { m._cleanup && m._cleanup(); m.remove(); }); }

  /* Click-to-copy for inline code anywhere */
  document.addEventListener("click", (e) => {
    const c = e.target.closest && e.target.closest("code.ic[data-copy]");
    if (c && !c.closest(".builder-canvas")) copyText(c.textContent);
    const cb = e.target.closest && e.target.closest("[data-copy-block]");
    if (cb && !cb.closest(".builder-canvas")) copyText(cb.dataset.copyBlock);
  });

  function isTyping(e) {
    const t = e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  function median(arr) {
    const a = arr.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  return {
    now, uid, clone, isObj, $, $$, esc, h, fmtDur, fmtMin, fmtTime, fmtDate, fmtDateTime, toLocalInput, fromLocalInput, ago,
    debounce, slug, download, pickFile, csv, copyText, compressImage, fileToDataURL, dataURLToBlob, md, inline,
    toast, modal, topModalOpen, confirmBox, promptBox, menu, closeMenus, isTyping, median,
  };
})();
