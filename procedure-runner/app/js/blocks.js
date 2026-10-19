/* blocks.js — the component library. Each block type defines:
     defaults()           new-block properties
     fields               inspector form (builder)
     preview(b, ctx)      read-only rendering on the builder canvas
     run(b, r)            interactive rendering in the runner. r = { value, set(v,{render}), ctx, me, people, readonly, onDecision, putFile, resolveURL }
     needs(b)             true if the block must be filled before the step can complete
     complete(b, v)       is the captured value sufficient?
     summary(b, v)        one-line text for reports */
PR.blocks = (() => {
  const { h, md, esc, fmtTime, fmtDateTime, now, copyText, uid } = PR.u;
  const I = (t, ctx) => PR.model.interpolate(t, ctx);
  const stamp = (v) => (v && v.at ? h("span.stamp", `${v.by || ""} · ${fmtTime(v.at)}`) : null);
  const mdNode = (text, ctx, cls = "md") => h(`div.${cls}`, { html: md(I(text, ctx)) });

  const defs = {};
  const order = [];
  function reg(type, def) { defs[type] = { type, ...def }; order.push(type); }

  /* ======================= CONTENT ======================= */
  reg("text", {
    label: "Instructions", icon: "¶", group: "Content", desc: "Rich text with bullets, bold, links and {{variables}}",
    defaults: () => ({ text: "Describe what to do.\n- Bullet\n-- Sub-bullet" }),
    fields: [{ key: "text", label: "Text", type: "textarea", rows: 8, help: "Use - and -- for nested bullets, **bold**, `code` (click to copy), {{primary.name}} variables." }],
    preview: (b, ctx) => mdNode(b.text, ctx),
    run: (b, r) => mdNode(b.text, r.ctx),
  });

  function codeView(b, ctx) {
    const code = PR.model.interpolate(b.code || "", ctx, false);
    return h("div.blk-code",
      b.label ? h("div.blk-code-h", h("span", b.label), h("button.mini-btn", { type: "button", onclick: () => copyText(code) }, "Copy all")) :
        h("div.blk-code-h", h("span", "Command"), h("button.mini-btn", { type: "button", onclick: () => copyText(code) }, "Copy")),
      h("pre", code.split("\n").map((line) => h("div.code-line", { title: "Click to copy this line", onclick: () => line.trim() && copyText(line.trim()) }, line || " "))),
      b.note ? h("div.blk-note", b.note) : null);
  }
  reg("command", {
    label: "Command", icon: "⌘", group: "Content", desc: "Monospace command with one-click copy",
    defaults: () => ({ label: "", code: "FAILOVER.OFFLINE", note: "" }),
    fields: [{ key: "label", label: "Label", placeholder: "e.g. Terminal window" }, { key: "code", label: "Command(s)", type: "code", rows: 4 }, { key: "note", label: "Note", placeholder: "Optional" }],
    preview: (b, ctx) => codeView(b, ctx), run: (b, r) => codeView(b, r.ctx),
  });

  function pathView(b, ctx) {
    const parts = String(b.trail || "").split("\n").map((s) => PR.model.interpolate(s.trim(), ctx, false)).filter(Boolean);
    return h("div.blk-path", b.label ? h("span.path-lbl", b.label) : null,
      parts.map((p, i) => [i ? h("span.path-sep", "›") : null, h("span.path-chip", { title: "Click to copy", onclick: () => copyText(p) }, p)]));
  }
  reg("path", {
    label: "Menu path", icon: "›", group: "Content", desc: "Navigation trail, e.g. Symop › BACKUP › (4)",
    defaults: () => ({ label: "", trail: "Symop\nBACKUP\n(4) Perform a System Backup (AIX)" }),
    fields: [{ key: "label", label: "Label", placeholder: "Optional, e.g. Navigate" }, { key: "trail", label: "Path (one item per line)", type: "textarea", rows: 5 }],
    preview: (b, ctx) => pathView(b, ctx), run: (b, r) => pathView(b, r.ctx),
  });

  const TONES = { info: "ℹ", tip: "💡", warn: "⚠", danger: "⛔", success: "✓" };
  function calloutView(b, ctx) {
    return h(`div.blk-callout.tone-${b.tone || "info"}`, h("div.co-ic", TONES[b.tone] || "ℹ"),
      h("div", b.title ? h("div.co-title", PR.model.interpolate(b.title, ctx, false)) : null, mdNode(b.text, ctx)));
  }
  reg("callout", {
    label: "Callout", icon: "⚠", group: "Content", desc: "Info, tip, warning or danger note",
    defaults: () => ({ tone: "warn", title: "", text: "Important note." }),
    fields: [{ key: "tone", label: "Style", type: "select", options: [["info", "Info"], ["tip", "Tip"], ["warn", "Warning"], ["danger", "Danger / stop"], ["success", "Success"]] },
      { key: "title", label: "Title", placeholder: "Optional" }, { key: "text", label: "Text", type: "textarea", rows: 4 }],
    preview: (b, ctx) => calloutView(b, ctx), run: (b, r) => calloutView(b, r.ctx),
  });

  function linkView(b, ctx) {
    const url = PR.model.interpolate(b.url || "", ctx, false);
    const label = PR.model.interpolate(b.label || "", ctx, false);
    return h("div.blk-link", h("a", { href: url || "#", target: "_blank", rel: "noopener" }, "↗ ", label || url || "Link"),
      url ? h("button.mini-btn", { type: "button", onclick: () => copyText(url) }, "Copy URL") : null, b.note ? h("span.muted", " " + b.note) : null);
  }
  reg("link", {
    label: "Link", icon: "↗", group: "Content", desc: "URL to a tool, SharePoint doc, ticket",
    defaults: () => ({ label: "Open console", url: "https://", note: "" }),
    fields: [{ key: "label", label: "Label" }, { key: "url", label: "URL" }, { key: "note", label: "Note", placeholder: "e.g. Credentials in password vault" }],
    preview: (b, ctx) => linkView(b, ctx), run: (b, r) => linkView(b, r.ctx),
  });

  function imageView(b) {
    return h("figure.blk-img", b.src ? h("img", { src: b.src, alt: b.caption || "", onclick: (e) => PR.app && PR.app.lightbox(e.target.src) }) : h("div.img-empty", "No image yet — choose one in the inspector"),
      b.caption ? h("figcaption", b.caption) : null);
  }
  reg("image", {
    label: "Screenshot", icon: "🖼", group: "Content", desc: "Reference image (paste or upload)",
    defaults: () => ({ src: "", caption: "" }),
    fields: [{ key: "src", label: "Image", type: "image" }, { key: "caption", label: "Caption" }],
    preview: (b) => imageView(b), run: (b) => imageView(b),
  });

  function tableView(b, ctx) {
    const rows = String(b.rows || "").split("\n").filter((l) => l.trim()).map((l) => l.split("|").map((c) => PR.model.interpolate(c.trim(), ctx, false)));
    if (!rows.length) return h("div.muted", "Empty table");
    const head = b.header ? rows.shift() : null;
    return h("table.blk-table", head ? h("thead", h("tr", head.map((c) => h("th", c)))) : null, h("tbody", rows.map((r) => h("tr", r.map((c) => h("td", c))))));
  }
  reg("table", {
    label: "Table", icon: "▦", group: "Content", desc: "Reference table (devices, services, IPs)",
    defaults: () => ({ header: true, rows: "Service | Option\nATM Network | (4)\nAudio and Home Banking | (2)" }),
    fields: [{ key: "header", label: "First row is header", type: "checkbox" }, { key: "rows", label: "Rows (cells separated by |)", type: "code", rows: 6 }],
    preview: (b, ctx) => tableView(b, ctx), run: (b, r) => tableView(b, r.ctx),
  });

  reg("divider", {
    label: "Divider", icon: "—", group: "Content", desc: "Visual separator",
    defaults: () => ({}), fields: [], preview: () => h("hr.blk-hr"), run: () => h("hr.blk-hr"),
  });

  /* ======================= CAPTURE ======================= */
  const itemsOf = (b) => (b.items || []);
  reg("checklist", {
    label: "Checklist", icon: "☑", group: "Capture", desc: "Sub-tasks to tick off (timestamped)",
    defaults: () => ({ title: "", required: true, items: [{ id: uid("ci"), text: "First item" }, { id: uid("ci"), text: "Second item" }] }),
    fields: [{ key: "title", label: "Title", placeholder: "Optional" }, { key: "items", label: "Items (one per line)", type: "items" }, { key: "required", label: "All items required to complete step", type: "checkbox" }],
    preview: (b, ctx) => h("div.blk-check", b.title ? h("div.blk-title", b.title) : null, itemsOf(b).map((it) => h("label.ck-row", h("input", { type: "checkbox", disabled: true }), h("span", { html: PR.u.inline(I(it.text, ctx)) })))),
    run: (b, r) => {
      const v = r.value || {};
      return h("div.blk-check", b.title ? h("div.blk-title", b.title) : null, itemsOf(b).map((it) => {
        const st = v[it.id];
        return h(`label.ck-row${st ? ".on" : ""}`,
          h("input", { type: "checkbox", checked: !!st, disabled: r.readonly, onchange: (e) => r.set({ ...v, [it.id]: e.target.checked ? { at: now(), by: r.me } : null }) }),
          h("span", { html: PR.u.inline(I(it.text, r.ctx)) }), st ? h("span.stamp", `${st.by || ""} · ${fmtTime(st.at)}`) : null);
      }));
    },
    needs: (b) => !!b.required && itemsOf(b).length > 0,
    complete: (b, v) => itemsOf(b).every((it) => v && v[it.id]),
    summary: (b, v) => `${itemsOf(b).filter((it) => v && v[it.id]).length}/${itemsOf(b).length} checked`,
  });

  function inputCtl(b, value, onChange, disabled) {
    const common = { disabled, class: "inp", placeholder: b.placeholder || "" };
    const t = b.inputType || "text";
    if (t === "textarea") return h("textarea", { ...common, rows: 3, oninput: (e) => onChange(e.target.value, false), onchange: (e) => onChange(e.target.value, true) }, value || "");
    if (t === "select") return h("select", { ...common, onchange: (e) => onChange(e.target.value, true) }, h("option", { value: "" }, "— choose —"), (b.options || []).map((o) => h("option", { value: o, selected: o === value }, o)));
    if (t === "yesno") return h("div.seg", ["Yes", "No"].map((o) => h(`button.seg-btn${value === o ? ".on" : ""}`, { type: "button", disabled, onclick: () => onChange(o, true) }, o)));
    const type = { number: "number", date: "date", time: "time", datetime: "datetime-local" }[t] || "text";
    return h("input", { ...common, type, value: value || "", oninput: (e) => onChange(e.target.value, false), onchange: (e) => onChange(e.target.value, true) });
  }
  reg("input", {
    label: "Record a value", icon: "✎", group: "Capture", desc: "Text/number/date/select captured during the run. Can feed a {{var.name}}",
    defaults: () => ({ label: "Value", inputType: "text", options: [], placeholder: "", required: true, variable: "", help: "" }),
    fields: [{ key: "label", label: "Label" },
      { key: "inputType", label: "Type", type: "select", options: [["text", "Short text"], ["textarea", "Long text"], ["number", "Number"], ["date", "Date"], ["time", "Time"], ["datetime", "Date & time"], ["select", "Dropdown"], ["yesno", "Yes / No"]] },
      { key: "options", label: "Dropdown options (one per line)", type: "lines", showIf: (b) => b.inputType === "select" },
      { key: "placeholder", label: "Placeholder" }, { key: "help", label: "Help text" },
      { key: "variable", label: "Save as variable", placeholder: "e.g. nextAccountNumber", help: "Reuse later as {{var.nextAccountNumber}} in any text, command or path." },
      { key: "required", label: "Required to complete step", type: "checkbox" }],
    preview: (b) => h("div.field.blk-input", h("label.lbl", b.label, b.required ? h("span.req", " *") : null, b.variable ? h("span.var-chip", `→ {{var.${b.variable}}}`) : null), inputCtl(b, "", () => {}, true), b.help ? h("div.help", b.help) : null),
    run: (b, r) => {
      const v = r.value || {};
      return h("div.field.blk-input", h("label.lbl", b.label, b.required ? h("span.req", " *") : null, stamp(v)),
        inputCtl(b, v.value, (val, commit) => r.set({ value: val, at: now(), by: r.me }, { render: commit && (b.inputType === "yesno" || b.inputType === "select") }), r.readonly),
        b.help ? h("div.help", b.help) : null);
    },
    needs: (b) => !!b.required, complete: (b, v) => v && v.value !== undefined && String(v.value).trim() !== "",
    summary: (b, v) => `${b.label}: ${v && v.value ? v.value : "—"}`,
  });

  reg("evidence", {
    label: "Evidence", icon: "📎", group: "Capture", desc: "Paste screenshots or attach files as proof",
    defaults: () => ({ label: "Screenshot of result", required: false, help: "" }),
    fields: [{ key: "label", label: "What to capture" }, { key: "help", label: "Help text" }, { key: "required", label: "Required to complete step", type: "checkbox" }],
    preview: (b) => h("div.blk-evi", h("div.blk-title", "📎 ", b.label, b.required ? h("span.req", " *") : null), h("div.drop-hint", "Operators paste (Ctrl+V) or drop screenshots here")),
    run: (b, r) => {
      const items = (r.value && r.value.items) || [];
      const add = async (files) => {
        const added = [];
        for (const f of files) added.push({ ref: await r.putFile(f), name: f.name || "screenshot.png", type: f.type, at: now(), by: r.me });
        if (added.length) r.set({ items: [...items, ...added] });
      };
      const zone = h("div.drop-zone", { tabindex: 0, title: "Click, paste (Ctrl+V) or drop files",
        onpaste: (e) => { const fs = [...(e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); add(fs); } },
        ondragover: (e) => { e.preventDefault(); zone.classList.add("over"); }, ondragleave: () => zone.classList.remove("over"),
        ondrop: (e) => { e.preventDefault(); zone.classList.remove("over"); add([...e.dataTransfer.files]); },
        onclick: async () => { const f = await PR.u.pickFile("image/*,.pdf,.txt,.log"); if (f) add([f]); } },
      "📋 Paste screenshot (Ctrl+V), drop a file, or click to browse");
      return h("div.blk-evi", h("div.blk-title", "📎 ", b.label, b.required ? h("span.req", " *") : null), b.help ? h("div.help", b.help) : null,
        h("div.thumbs", items.map((it) => PR.app.thumb(it))), r.readonly ? null : zone);
    },
    needs: (b) => !!b.required, complete: (b, v) => !!(v && v.items && v.items.length),
    summary: (b, v) => `${b.label}: ${(v && v.items && v.items.length) || 0} file(s)`,
  });

  reg("confirm", {
    label: "Type to confirm", icon: "⌨", group: "Capture", desc: "Operator must type an exact phrase (guard rail)",
    defaults: () => ({ label: "Type the phrase to confirm you are on the correct system", phrase: "{{secondary.partition}}" }),
    fields: [{ key: "label", label: "Instruction" }, { key: "phrase", label: "Exact phrase", help: "Variables allowed, e.g. {{primary.partition}} so the operator confirms the right HMC partition." }],
    preview: (b, ctx) => h("div.blk-confirm", h("div", b.label), h("div.phrase", { html: PR.u.inline(I(b.phrase, ctx)) })),
    run: (b, r) => {
      const phrase = PR.model.interpolate(b.phrase || "", r.ctx, false);
      const v = r.value || {};
      const inp = h("input.inp", { value: v.value || "", disabled: r.readonly || v.ok, placeholder: phrase, autocomplete: "off",
        oninput: (e) => { const ok = e.target.value.trim() === phrase.trim(); inp.classList.toggle("ok", ok); if (ok) r.set({ value: e.target.value, ok: true, at: now(), by: r.me }); } });
      if (v.ok) inp.classList.add("ok");
      return h("div.blk-confirm", h("div", b.label, " ", stamp(v)), h("div.phrase", phrase), inp);
    },
    needs: () => true, complete: (b, v) => !!(v && v.ok), summary: (b, v) => (v && v.ok ? `Confirmed "${v.value}"` : "Not confirmed"),
  });

  /* ======================= OPERATIONS ======================= */
  const METHODS = [["phone", "📞 Phone"], ["email", "✉ Email"], ["ticket", "🎫 Ticket / portal"], ["teams", "💬 Teams / chat"], ["inperson", "🧍 In person"], ["page", "📟 Page"]];
  const methodLabel = (m) => (METHODS.find((x) => x[0] === m) || [m, m])[1];
  reg("contact", {
    label: "Contact / handoff", icon: "☎", group: "Operations", desc: "Who to contact, how, what to ask — records time and confirmation",
    defaults: () => ({ who: "Vendor support", method: "phone", detail: "", request: "Notify of maintenance window", requireConfirmation: true }),
    fields: [{ key: "who", label: "Who", type: "contact" }, { key: "method", label: "Method", type: "select", options: METHODS },
      { key: "detail", label: "Number / address / portal", placeholder: "888-555-0100 or support@vendor.com" },
      { key: "request", label: "What to request / tell them", type: "textarea", rows: 3 },
      { key: "requireConfirmation", label: "Confirmation required to complete step", type: "checkbox" }],
    preview: (b, ctx) => h("div.blk-contact", h("div.ct-head", h("span.ct-who", b.who || "Contact"), h("span.chip", methodLabel(b.method)), b.detail ? h("span.ct-detail", I(b.detail, ctx).replace(/[⁣⁤]/g, "")) : null),
      b.request ? mdNode(b.request, ctx) : null, h("div.ct-actions.muted", "Runner: [Contacted] → [Confirmation received]")),
    run: (b, r) => {
      const v = r.value || {};
      const detail = PR.model.interpolate(b.detail || "", r.ctx, false);
      const href = b.method === "email" && detail.includes("@") ? `mailto:${detail}` : b.method === "phone" ? `tel:${detail.replace(/[^\d+]/g, "")}` : null;
      return h("div.blk-contact",
        h("div.ct-head", h("span.ct-who", b.who || "Contact"), h("span.chip", methodLabel(b.method)),
          detail ? (href ? h("a.ct-detail", { href }, detail) : h("span.ct-detail", detail)) : null,
          detail ? h("button.mini-btn", { type: "button", onclick: () => copyText(detail) }, "Copy") : null),
        b.request ? mdNode(b.request, r.ctx) : null,
        h("div.ct-actions",
          v.contactedAt ? h("span.done-pill", `✓ Contacted ${fmtTime(v.contactedAt)} by ${v.by || ""}`) :
            h("button.btn.btn-sm", { type: "button", disabled: r.readonly, onclick: () => r.set({ ...v, contactedAt: now(), by: r.me }) }, "☎ Mark contacted"),
          v.confirmedAt ? h("span.done-pill", `✓ Confirmed ${fmtTime(v.confirmedAt)}`) :
            h("button.btn.btn-sm", { type: "button", disabled: r.readonly || !v.contactedAt, onclick: () => r.set({ ...v, confirmedAt: now(), confirmed: true }) }, "✓ Confirmation received"),
          v.contactedAt && !v.confirmedAt ? h("button.btn.btn-sm.btn-ghost", { type: "button", disabled: r.readonly, onclick: () => r.set({ ...v, confirmed: false, noConfirmAt: now() }) }, "No response") : null),
        h("div.ct-grid",
          h("input.inp", { placeholder: "Ticket / reference #", value: v.reference || "", disabled: r.readonly, onchange: (e) => r.set({ ...v, reference: e.target.value }, { render: false }) }),
          h("input.inp", { placeholder: "Response / who you spoke with", value: v.response || "", disabled: r.readonly, onchange: (e) => r.set({ ...v, response: e.target.value }, { render: false }) })));
    },
    needs: (b) => !!b.requireConfirmation,
    complete: (b, v) => !!(v && v.contactedAt && v.confirmedAt),
    summary: (b, v) => `${b.who} (${methodLabel(b.method)}): ${v && v.contactedAt ? "contacted " + fmtTime(v.contactedAt) : "not contacted"}${v && v.confirmedAt ? ", confirmed " + fmtTime(v.confirmedAt) : ""}`,
    methodLabel,
  });

  reg("validation", {
    label: "Validation check", icon: "✔", group: "Operations", desc: "Test, expected vs actual, pass/fail",
    defaults: () => ({ test: "PING {{primary.hostname}}", expected: "No reply", required: true }),
    fields: [{ key: "test", label: "Test performed", type: "textarea", rows: 2 }, { key: "expected", label: "Expected result", type: "textarea", rows: 2 }, { key: "required", label: "Pass/fail required to complete step", type: "checkbox" }],
    preview: (b, ctx) => h("div.blk-val", h("div.val-row", h("span.val-k", "Test"), h("span", { html: PR.u.inline(I(b.test, ctx)) })), h("div.val-row", h("span.val-k", "Expected"), h("span", { html: PR.u.inline(I(b.expected, ctx)) })), h("div.val-row", h("span.val-k", "Actual"), h("span.muted", "recorded at run time")), h("div.seg", h("span.seg-btn", "Pass"), h("span.seg-btn", "Fail"))),
    run: (b, r) => {
      const v = r.value || {};
      return h(`div.blk-val${v.result ? ".res-" + v.result : ""}`,
        h("div.val-row", h("span.val-k", "Test"), h("span", { html: PR.u.inline(I(b.test, r.ctx)) })),
        h("div.val-row", h("span.val-k", "Expected"), h("span", { html: PR.u.inline(I(b.expected, r.ctx)) })),
        h("div.val-row", h("span.val-k", "Actual"), h("input.inp", { placeholder: "What did you observe?", value: v.actual || "", disabled: r.readonly, onchange: (e) => r.set({ ...v, actual: e.target.value }, { render: false }) })),
        h("div.val-row", h("span.val-k", ""), h("div.seg",
          h(`button.seg-btn.pass${v.result === "pass" ? ".on" : ""}`, { type: "button", disabled: r.readonly, onclick: () => r.set({ ...v, result: "pass", at: now(), by: r.me }) }, "✓ Pass"),
          h(`button.seg-btn.fail${v.result === "fail" ? ".on" : ""}`, { type: "button", disabled: r.readonly, onclick: () => { r.set({ ...v, result: "fail", at: now(), by: r.me }); r.onFail && r.onFail(b); } }, "✕ Fail")), stamp(v)));
    },
    needs: (b) => !!b.required, complete: (b, v) => !!(v && v.result),
    summary: (b, v) => `${PR.model.interpolate(b.test, {}, false)} → ${v && v.result ? v.result.toUpperCase() : "not recorded"}${v && v.actual ? " (" + v.actual + ")" : ""}`,
  });

  reg("decision", {
    label: "Go / No-Go", icon: "⚖", group: "Operations", desc: "Critical decision with criteria, decision-maker and timestamp",
    defaults: () => ({ question: "Proceed with failover?", criteria: "- Trial balances match (available balance may differ)\n- No open critical issues", decisionMaker: "Approver", noGo: "halt" }),
    fields: [{ key: "question", label: "Decision" }, { key: "criteria", label: "Criteria / evidence required", type: "textarea", rows: 4 },
      { key: "decisionMaker", label: "Decision-maker (role or name)" },
      { key: "noGo", label: "On NO-GO", type: "noGo" }],
    preview: (b, ctx) => h("div.blk-dec", h("div.dec-q", "⚖ ", b.question), b.criteria ? mdNode(b.criteria, ctx) : null, h("div.muted.small", `Decision-maker: ${b.decisionMaker || "—"}`), h("div.seg", h("span.seg-btn.pass", "GO"), h("span.seg-btn.fail", "NO-GO"))),
    run: (b, r) => {
      const v = r.value || {};
      let maker, why;
      const decide = (d) => {
        const val = { decision: d, maker: maker.value || r.me, rationale: why.value, at: now(), by: r.me };
        r.set(val);
        r.onDecision && r.onDecision(b, val);
      };
      return h(`div.blk-dec${v.decision ? ".dec-" + v.decision : ""}`,
        h("div.dec-q", "⚖ ", b.question),
        b.criteria ? h("div.dec-crit", h("div.val-k", "Criteria"), mdNode(b.criteria, r.ctx)) : null,
        h("div.ct-grid",
          h("div.field", h("label.lbl", `Decision-maker (${b.decisionMaker || "any"})`),
            maker = h("input.inp", { list: "peopleList", value: v.maker || "", placeholder: "Name", disabled: r.readonly || !!v.decision })),
          h("div.field", h("label.lbl", "Rationale / evidence"), why = h("input.inp", { value: v.rationale || "", placeholder: "e.g. TB reports match", disabled: r.readonly || !!v.decision }))),
        v.decision ? h("div.dec-result", h("span.big", v.decision === "go" ? "GO" : "NO-GO"), ` — ${v.maker} at ${fmtDateTime(v.at)}`,
          r.readonly ? null : h("button.mini-btn", { type: "button", onclick: () => r.set(null) }, "Change")) :
          h("div.seg.big", h("button.seg-btn.pass", { type: "button", disabled: r.readonly, onclick: () => decide("go") }, "✓ GO"),
            h("button.seg-btn.fail", { type: "button", disabled: r.readonly, onclick: () => decide("nogo") }, "✕ NO-GO")));
    },
    needs: () => true, complete: (b, v) => v && v.decision === "go",
    summary: (b, v) => `${b.question} → ${v && v.decision ? v.decision.toUpperCase() + " by " + v.maker + " @ " + fmtDateTime(v.at) : "pending"}`,
  });

  reg("approval", {
    label: "Sign-off", icon: "✍", group: "Operations", desc: "Named approval with timestamp",
    defaults: () => ({ label: "Approval to proceed", approverRole: "Change approver" }),
    fields: [{ key: "label", label: "What is being approved" }, { key: "approverRole", label: "Approver role" }],
    preview: (b) => h("div.blk-appr", h("div.blk-title", "✍ ", b.label), h("div.muted.small", `Approver: ${b.approverRole || "—"}`)),
    run: (b, r) => {
      const v = r.value || {};
      let who, note;
      return h(`div.blk-appr${v.at ? ".signed" : ""}`, h("div.blk-title", "✍ ", b.label), h("div.muted.small", `Approver: ${b.approverRole || "—"}`),
        v.at ? h("div.done-pill", `✓ Approved by ${v.approver} at ${fmtDateTime(v.at)}${v.comment ? " — " + v.comment : ""}`, r.readonly ? null : h("button.mini-btn", { type: "button", onclick: () => r.set(null) }, "Revoke")) :
          h("div.ct-grid", who = h("input.inp", { list: "peopleList", placeholder: "Approver name", disabled: r.readonly }), note = h("input.inp", { placeholder: "Comment (optional)", disabled: r.readonly }),
            h("button.btn.btn-sm.btn-primary", { type: "button", disabled: r.readonly, onclick: () => { if (!who.value.trim()) { who.classList.add("err"); who.focus(); return; } r.set({ approver: who.value.trim(), comment: note.value, at: now(), by: r.me }); } }, "Sign off")));
    },
    needs: () => true, complete: (b, v) => !!(v && v.at),
    summary: (b, v) => `${b.label}: ${v && v.at ? "approved by " + v.approver + " @ " + fmtDateTime(v.at) : "not approved"}`,
  });

  reg("timer", {
    label: "Wait / countdown", icon: "⏳", group: "Operations", desc: "Countdown with an alert when done (e.g. wait 5 minutes)",
    defaults: () => ({ label: "Wait for replication to stop", minutes: 3 }),
    fields: [{ key: "label", label: "Label" }, { key: "minutes", label: "Minutes", type: "number" }],
    preview: (b) => h("div.blk-timer", h("span.tm-ic", "⏳"), h("span", b.label), h("span.tm-val", PR.u.fmtDur((b.minutes || 0) * 60000))),
    run: (b, r) => {
      const v = r.value || {};
      const total = (Number(b.minutes) || 0) * 60000;
      const el = h("div.blk-timer", h("span.tm-ic", "⏳"), h("span", b.label),
        v.startedAt ? h("span.tm-val", { dataset: { countdown: String(v.startedAt + total) } }, PR.u.fmtDur(Math.max(0, v.startedAt + total - now()))) : h("span.tm-val", PR.u.fmtDur(total)),
        r.readonly ? null : (v.startedAt ? h("button.mini-btn", { type: "button", onclick: () => r.set(null) }, "Reset") :
          h("button.btn.btn-sm", { type: "button", onclick: () => r.set({ startedAt: now(), by: r.me }) }, "Start countdown")));
      return el;
    },
    summary: (b, v) => `${b.label}: ${v && v.startedAt ? "started " + fmtTime(v.startedAt) : "not started"}`,
  });

  const def = (t) => defs[t];
  const list = () => order.map((t) => defs[t]);
  const groups = () => ["Content", "Capture", "Operations"].map((g) => ({ name: g, items: list().filter((d) => d.group === g) }));
  return { def, list, groups, METHODS };
})();
