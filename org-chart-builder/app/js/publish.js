/* publish.js — the Publish screen: what changed since the official version, publish, sharing (the chart is shared only
   as a downloaded PDF or HTML file — never by link), earlier versions and automatic snapshots (restore any of them). */
OC.publish = (() => {
  const { h, $, toast, modal, confirmBox, plural, fmtDateTime, ago, promptBox } = OC.u;
  const M = () => OC.model, S = () => OC.store;
  const P = () => S().doc;
  let editing = false;

  /* People-level differences between two projects. */
  function diff(oldDoc, newDoc) {
    const act = (d) => new Map(Object.values(d.people || {}).filter((x) => x.status !== "inactive").map((x) => [x.id, x]));
    const a = act(oldDoc), b = act(newDoc);
    const nm = (d, id) => (d.people[id] ? d.people[id].name || "Vacant" : "—");
    const out = { added: [], removed: [], moved: [], changed: [] };
    for (const [id, x] of b) {
      const o = a.get(id);
      if (!o) { out.added.push(x); continue; }
      if (o.managerId !== x.managerId) out.moved.push({ x, from: nm(oldDoc, o.managerId), to: nm(newDoc, x.managerId) });
      const ch = ["name", "title", "department", "type", "status"].filter((k) => (o[k] || "") !== (x[k] || ""));
      if (ch.length) out.changed.push({ x, fields: ch.map((k) => `${OC.actions.LABELS[k] || k}: “${o[k] || "—"}” → “${x[k] || "—"}”`) });
    }
    for (const [id, x] of a) if (!b.has(id)) out.removed.push(x);
    out.count = out.added.length + out.removed.length + out.moved.length + out.changed.length;
    return out;
  }
  function diffView(d) {
    if (!d.count) return h("div.muted", "No changes to people or reporting lines. (Layout and page changes aren't listed.)");
    const sec = (title, items, fn) => items.length ? h("details.diff-sec", { open: items.length <= 12 }, h("summary", h("b", items.length), " ", title), h("ul", items.slice(0, 300).map(fn))) : null;
    return h("div.diff",
      sec("added", d.added, (x) => h("li", h("b", x.name || "Vacant"), ` — ${x.title}`, x.department ? h("span.muted", ` · ${x.department}`) : null)),
      sec("removed", d.removed, (x) => h("li", h("b", x.name || "Vacant"), ` — ${x.title}`)),
      sec("moved to a new manager", d.moved, (m) => h("li", h("b", m.x.name || "Vacant"), `: ${m.from} → ${m.to}`)),
      sec("updated", d.changed, (c) => h("li", h("b", c.x.name || "Vacant"), h("div.muted.small", c.fields.join(" · ")))));
  }

  async function render(view, opts) {
    editing = opts.editing;
    const p = P();
    const root = h("div.publish");
    view.append(root);
    const pub = p.published;
    const dirty = S().dirty();

    const status = h("div.pub-status.blue-line" + (dirty ? ".draft" : ".ok"),
      h("div",
        h("div.ps-k", dirty ? "Draft" : "Up to date"),
        h("h1", dirty ? (pub ? `Changes since version ${pub.version}` : "Not published yet") : `Version ${pub.version} is the official chart`),
        h("div.muted", pub ? `Version ${pub.version} published ${ago(pub.at)}${pub.by ? " by " + pub.by : ""}${pub.note ? ` — “${pub.note}”` : ""}` : "Publishing saves the chart as a numbered, official version.")),
      h("div.ps-act",
        h("button.btn.btn-cta.btn-xl", { type: "button", disabled: !dirty && !!pub, onclick: publishNow }, pub ? "Publish changes" : "Publish")));
    root.append(status);

    const changes = h("div.card-box", h("h2", "What changed"), h("div.muted.small", "Loading…"));
    root.append(changes);
    if (pub) {
      S().publishedGet(pub.version).then((r) => { changes.lastChild.replaceWith(r && r.doc ? diffView(diff(r.doc, p)) : h("div.muted", "The published version couldn't be loaded.")); }).catch(() => changes.lastChild.replaceWith(h("div.muted", "The published version couldn't be loaded.")));
    } else changes.lastChild.replaceWith(h("div.muted", `Everything — ${plural(M().stats(p).people, "person", "people")} — will be in the first version.`));

    const dl = (icon, title, text, fn) => h("button.dl-card", { type: "button", onclick: fn }, h("span.dl-ic", icon), h("span", h("b", title), h("span.muted.small", text)));
    root.append(h("div.card-box", h("h2", "Share the chart"),
      h("p.muted.small.share-note", "Download the chart as a file, then attach it to an email or save it to a shared folder. ", dirty ? h("b", "There are unpublished changes, so the file will be marked DRAFT.") : null),
      h("div.dl-grid", shareCards(dl))));
    root.append(h("div.card-box", h("h2", "Other downloads"), h("div.dl-grid",
      dl("▦", "People (.xlsx)", "The full list with managers and departments, for keeping records.", () => OC.directory.exportXlsx()),
      dl("⛁", "Project backup (.json)", "Everything, to move the chart or keep a copy.", () => OC.actions.exportProjectFile()),
      editing ? dl("⇪", "Open a project file…", "Replace the chart with a backup or a file from the old builder.", () => OC.actions.importProjectFile(false)) : null)));

    const versions = h("div.card-box", h("h2", "Published versions"), h("div.muted.small", "Loading…"));
    const snaps = h("div.card-box", h("div.row-between", h("h2", "Snapshots"), editing ? h("button.btn.btn-sm", { type: "button", onclick: async () => { const r = await promptBox("Save a snapshot", { label: "Name (optional)", value: "Checkpoint", ok: "Save" }); if (r == null) return; await S().checkpoint(r || "Checkpoint"); toast("Snapshot saved", "ok"); OC.app.render(); } }, "Save a snapshot now") : null),
      h("div.muted.small", "The chart is saved automatically every 10 minutes while people edit, and before every import, restore and publish."), h("div.muted.small", "Loading…"));
    root.append(h("div.two-col", versions, snaps));

    try {
      const list = await S().publishedList();
      versions.lastChild.replaceWith(list.length ? h("table.tbl.tbl-sm", h("tbody", list.map((v) => h("tr",
        h("td", h("b", `v${v.version}`), pub && pub.version === v.version ? h("span.chip.c-green", "current") : null),
        h("td", fmtDateTime(v.at), h("div.muted.small", v.by || "")),
        h("td.small", v.note || h("span.muted", "—")),
        h("td.num", `${v.people}`),
        h("td.c-act", h("button.icon-btn.sm", { type: "button", title: "Actions", onclick: (e) => OC.u.menu(e.currentTarget, versionMenu(v), { align: "right" }) }, "⋯")))))) : h("div.muted", "Nothing published yet."));
    } catch (e) { versions.lastChild.replaceWith(h("div.muted", e.message)); }
    try {
      const list = await S().historyList();
      snaps.lastChild.replaceWith(list.length ? h("div.snap-list", h("table.tbl.tbl-sm", h("tbody", list.slice(0, 60).map((s) => h("tr",
        h("td", fmtDateTime(s.at), h("div.muted.small", ago(s.at))),
        h("td.small", s.reason, s.by ? h("div.muted.small", s.by) : null),
        h("td.num", `${s.people}`),
        h("td.c-act", h("button.icon-btn.sm", { type: "button", title: "Actions", onclick: (e) => OC.u.menu(e.currentTarget, snapMenu(s), { align: "right" }) }, "⋯"))))))) : h("div.muted", "No snapshots yet."));
    } catch (e) { snaps.lastChild.replaceWith(h("div.muted", e.message)); }
  }

  function versionMenu(v) {
    return [
      { label: "Download it as HTML", icon: "⤓", onClick: async () => OC.u.download(`OrgChart_v${v.version}.html`, await S().publishedHtml(v.version), "text/html") },
      { label: "Print / save it as PDF…", icon: "⎙", onClick: () => printVersion(v.version) },
      { label: "What changed since then", icon: "≠", onClick: async () => { const r = await S().publishedGet(v.version); modal({ title: `Changes since v${v.version}`, size: "lg", body: diffView(diff(r.doc, P())) }); } },
      editing ? { label: "Restore as the working draft…", icon: "↺", onClick: async () => restore(`version ${v.version}`, (await S().publishedGet(v.version)).doc) } : null,
    ];
  }
  function snapMenu(s) {
    return [
      { label: "What changed since then", icon: "≠", onClick: async () => { const r = await S().historyGet(s.id); modal({ title: `Changes since ${fmtDateTime(s.at)}`, size: "lg", body: diffView(diff(r.doc, P())) }); } },
      editing ? { label: "Restore this snapshot…", icon: "↺", onClick: async () => restore(`the snapshot from ${fmtDateTime(s.at)}`, (await S().historyGet(s.id)).doc) } : null,
    ];
  }
  async function restore(what, doc) {
    if (!(await confirmBox(`Restore ${what}?`, "The current chart becomes a snapshot first, so this can be reversed from this screen.", { ok: "Restore", kind: "danger" }))) return;
    await S().replace(doc, `Restored ${what}`);
    toast(`Restored ${what}`, "ok");
    OC.app.render();
  }

  async function publishNow() {
    if (!editing) { await OC.app.setEditing(true); if (!OC.app.editing) return; }
    const p = P();
    const errors = M().health(p).filter((i) => i.level === "error");
    let note;
    const body = h("div",
      errors.length ? h("div.callout.warn", h("b", `${plural(errors.length, "problem")} in the people list`), h("div.small", errors.slice(0, 4).map((e) => e.msg).join(" ")), h("a.small", { href: "#/people" }, "Review on the People screen")) : null,
      h("div.field", h("label.lbl", "What changed? (shown in the version list)"), note = h("textarea.inp", { rows: 3, placeholder: "e.g. New Digital Services team; Q3 promotions", autofocus: true })),
      h("p.muted.small", "Publishing saves this as the next official version and keeps every earlier one. Afterwards you can download it as a PDF or HTML file to share."));
    const v = await modal({ title: "Publish the chart", size: "md", body, actions: [{ spacer: true }, { label: "Cancel", value: null }, { label: "Publish", kind: "cta", value: "ok" }] });
    if (v !== "ok") return;
    try {
      const html = await OC.exporter.buildHtml({ forPublish: true });
      const meta = await S().publish(html, note.value.trim());
      OC.app.render();
      const dl = (icon, title, text, fn) => h("button.dl-card", { type: "button", onclick: fn }, h("span.dl-ic", icon), h("span", h("b", title), h("span.muted.small", text)));
      modal({ title: `Version ${meta.version} is now the official chart`, size: "md",
        body: h("div", h("p", "To share it, download it as a file and attach it to an email or save it to a shared folder."), h("div.dl-grid.dl-2", shareCards(dl))),
        actions: [{ spacer: true }, { label: "Done", kind: "primary", value: "ok" }] });
    } catch (e) { toast("Publishing failed: " + e.message, "err", 8000); }
  }

  /* The two ways to share the chart: a PDF (print view) or the single interactive HTML file. */
  function shareCards(dl) {
    return [
      dl("⎙", "PDF", "Every page on its own landscape sheet. In the print window choose “Save as PDF”.", () => OC.exporter.printDialog(null)),
      dl("◫", "HTML file", "One file with every page, search and contact details. Opens in any web browser.", () => OC.exporter.downloadHtml()),
    ];
  }
  /* Print (or save as PDF) an earlier published version from its saved HTML. */
  async function printVersion(n) {
    const w = window.open("", "_blank");
    if (!w) return toast("The browser blocked the print window — allow pop-ups for this site", "err", 6000);
    const html = await S().publishedHtml(n);
    w.document.open(); w.document.write(String(html || "").replace('"autoprint":false', '"autoprint":true')); w.document.close();
  }

  return { render, diff, publishNow, $ };
})();
