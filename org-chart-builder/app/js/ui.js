/* ui.js — small shared widgets: a searchable person picker (624 people don't fit in a <select>) and a unit picker. */
OC.ui = (() => {
  const { h, $$, norm, esc } = OC.u;

  /* personPicker({ value, placeholder, onPick(person|null), exclude:Set|fn, allowNone, noneLabel, disabled })
     -> { el, value, set(id), clear(), focus() } */
  function personPicker({ value = "", placeholder = "Search people…", onPick, exclude, allowNone = false, noneLabel = "No manager", disabled = false } = {}) {
    let cur = value || "";
    const p = () => OC.store.doc;
    const nameOf = (id) => { const x = id && OC.model.person(p(), id); return x ? x.name : ""; };
    const input = h("input.inp.pp-input", { placeholder, value: nameOf(cur), disabled, autocomplete: "off", spellcheck: "false" });
    const list = h("div.pp-list.hidden", { role: "listbox" });
    const wrap = h("div.pp", input, list);
    let items = [], active = 0;
    const excluded = (x) => (typeof exclude === "function" ? exclude(x) : exclude && exclude.has(x.id));
    function open() {
      const q = norm(input.value === nameOf(cur) ? "" : input.value);
      const words = q.split(" ").filter(Boolean);
      const all = OC.model.index(p()).active.filter((x) => !excluded(x));
      items = (words.length ? all.filter((x) => { const hay = norm(`${x.name} ${x.title} ${x.department}`); return words.every((w) => hay.includes(w)); }) : all).slice(0, 60);
      if (allowNone) items.unshift(null);
      active = Math.max(0, items.findIndex((x) => x && x.id === cur));
      list.innerHTML = "";
      if (!items.length) list.append(h("div.pp-empty", "No matches"));
      items.forEach((x, i) => {
        const row = x ? h("div.pp-item", { dataset: { i } }, h("b", x.name), h("span", [x.title, x.department].filter(Boolean).join(" · ")))
          : h("div.pp-item.none", { dataset: { i } }, h("b", noneLabel));
        row.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
        list.append(row);
      });
      hl(); list.classList.remove("hidden");
    }
    const hl = () => $$(".pp-item", list).forEach((r) => { const on = Number(r.dataset.i) === active; r.classList.toggle("on", on); if (on) r.scrollIntoView({ block: "nearest" }); });
    function pick(i) {
      const x = items[i];
      cur = x ? x.id : "";
      input.value = x ? x.name : "";
      list.classList.add("hidden");
      onPick && onPick(x);
    }
    input.addEventListener("focus", () => { input.select(); open(); });
    input.addEventListener("input", open);
    input.addEventListener("blur", () => setTimeout(() => { list.classList.add("hidden"); if (input.value !== nameOf(cur)) input.value = nameOf(cur); }, 150));
    input.addEventListener("keydown", (e) => {
      if (list.classList.contains("hidden") && (e.key === "ArrowDown" || e.key === "Enter")) { open(); e.preventDefault(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); hl(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); hl(); }
      else if (e.key === "Enter") { e.preventDefault(); if (items.length) pick(active); }
      else if (e.key === "Escape") { if (!list.classList.contains("hidden")) { e.stopPropagation(); list.classList.add("hidden"); input.value = nameOf(cur); } }
    });
    return {
      el: wrap, get value() { return cur; },
      set(id) { cur = id || ""; input.value = nameOf(cur); },
      clear() { cur = ""; input.value = ""; },
      focus() { input.focus(); },
      set disabled(v) { input.disabled = v; },
    };
  }

  /* A department/branch text box with suggestions from existing units. */
  function unitInput(value = "", attrs = {}) {
    const id = "units-" + Math.random().toString(36).slice(2, 7);
    const dl = h("datalist", { id }, OC.model.unitNames(OC.store.doc).map((u) => h("option", { value: u })));
    const input = h("input.inp", { value, list: id, placeholder: "Department or branch", ...attrs });
    return { el: h("span.unit-input", input, dl), input };
  }

  /* Quick avatar/initials chip for lists. */
  const av = (name) => h("span.av", OC.u.initials(name));

  return { personPicker, unitInput, av, esc };
})();
