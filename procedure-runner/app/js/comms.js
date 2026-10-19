/* comms.js — communication plan.
   Team level (Comms page, owned by the communicator/manager): audiences (distribution lists) and message templates.
   Procedure level (Settings → Comms plan): which templates apply and when they trigger.
   Run level (📣 Updates tab): what's due now, a branded composer (copy for Outlook, .eml draft, mailto, Teams text)
   and a sent log that feeds the run report's communication section. */
PR.comms = (() => {
  const { h, $, $$, esc, toast, modal, confirmBox, uid, clone, now, fmtTime, fmtDate, fmtDateTime, fmtDur, fmtMin, download, copyText } = PR.u;
  const S = () => PR.store.b;
  const M = () => PR.model;

  /* ======================= defaults ======================= */
  const TRIGGERS = [
    ["advance", "Advance notice (before the window)"], ["reminder", "Reminder (day before / day of)"], ["start", "When the run starts"],
    ["decision", "When a Go / No-Go is recorded"], ["step", "When a specific step is completed"], ["interval", "Progress update every N minutes"],
    ["issue", "When a high / critical issue is logged"], ["halt", "When the run is halted or NO-GO"], ["complete", "When the run is completed"],
    ["aborted", "When the run is aborted / rolled back"], ["after", "Post-run summary"], ["manual", "Manual only"],
  ];
  const TONES = { info: { label: "Information", color: "#2f73bb", soft: "#dfeaf6" }, warn: { label: "Attention", color: "#f6bf26", soft: "#fdf3d2", ink: "#5c4500" },
    success: { label: "All clear", color: "#347f3e", soft: "#e1efe2" }, error: { label: "Action needed", color: "#d7372a", soft: "#fbe4e1" }, neutral: { label: "Update", color: "#53575a", soft: "#eceeef" } };

  function defaults() {
    const A = { it: "aud_it", lead: "aud_lead", org: "aud_org" };
    return {
      communicators: [], orgName: "Addition Financial", teamName: "Core Team", signature: "Core Team | Information Technology", replyTo: "", tagline: "Count us in.",
      audiences: [
        { id: A.it, name: "IT Teams", desc: "Infrastructure, network, help desk, application owners", to: "", cc: "", teams: "" },
        { id: A.lead, name: "Leadership", desc: "Executive and IT leadership", to: "", cc: "", teams: "" },
        { id: A.org, name: "Whole Organization", desc: "All staff", to: "", cc: "", teams: "" },
      ],
      templates: [
        { id: "tpl_advance_org", name: "Scheduled maintenance notice", audiences: [A.org], trigger: "advance", tone: "info", includeLive: false,
          subject: "Heads up: scheduled maintenance on {{window.date}}",
          headline: "Scheduled maintenance on {{window.date}}",
          facts: "When | {{window.start}} – {{window.end}}\nWhat's affected | {{impact}}\nNeed help? | Contact the IT Service Desk",
          body: "We're doing some planned work on our core banking system to keep things running smoothly.\n\nDuring the window, some systems may be briefly unavailable. We'll let you know as soon as everything is back.\n\nThanks for your patience." },
        { id: "tpl_advance_it", name: "IT briefing", audiences: [A.it], trigger: "advance", tone: "info", includeLive: true,
          subject: "[IT] {{run.name}} planned for {{window.date}} ({{run.direction}})",
          headline: "Planned: {{run.name}}",
          facts: "Window | {{window.start}} – {{window.end}}\nDirection | {{run.direction}}\nChange | {{run.changeId}}\nImpact | {{impact}}",
          body: "**What we need from IT teams**\n- Pause non-essential changes during the window\n- Keep your on-call contact reachable\n- Watch for DNS / connectivity updates from the Core Team\n\nYou can follow along live during the window using the button below." },
        { id: "tpl_reminder", name: "Reminder", audiences: [A.org, A.it], trigger: "reminder", tone: "info", includeLive: false,
          subject: "Reminder: maintenance {{window.start}}",
          headline: "Reminder: maintenance starts {{window.start}}",
          facts: "When | {{window.start}} – {{window.end}}\nWhat's affected | {{impact}}",
          body: "Just a friendly reminder about tonight's planned maintenance. Save your work and log out of core systems before the window starts." },
        { id: "tpl_start", name: "Work has started", audiences: [A.it, A.lead], trigger: "start", tone: "neutral", includeLive: true,
          subject: "[Started] {{run.name}} — {{run.direction}}",
          headline: "{{run.name}} is underway",
          facts: "Started | {{started}}\nDirection | {{run.direction}}\nSteps | {{progress.total}}\nEstimated finish | {{eta}}",
          body: "The Core Team has started. We'll send updates at key milestones." },
        { id: "tpl_decision", name: "Go / No-Go decision", audiences: [A.lead, A.it], trigger: "decision", tone: "info", includeLive: true,
          subject: "[Decision] {{decision.result}} — {{run.name}}",
          headline: "Decision: {{decision.result}}",
          facts: "Decision | {{decision.question}}\nDecided by | {{decision.maker}} at {{decision.time}}\nRationale | {{decision.rationale}}\nProgress | {{progress.done}} of {{progress.total}} steps",
          body: "" },
        { id: "tpl_progress", name: "Progress update", audiences: [A.lead], trigger: "interval", minutes: 30, tone: "neutral", includeLive: true,
          subject: "[Update] {{run.name}} — {{progress.pct}}% complete",
          headline: "{{progress.pct}}% complete",
          facts: "Elapsed | {{elapsed}}\nProgress | {{progress.done}} of {{progress.total}} steps\nIn progress now | {{current.steps}}\nEstimated finish | {{eta}}\nOpen issues | {{issues.open}}",
          body: "" },
        { id: "tpl_issue", name: "Issue update", audiences: [A.lead, A.it], trigger: "issue", tone: "warn", includeLive: true,
          subject: "[Issue] {{run.name}}: {{issues.latest}}",
          headline: "We're working an issue",
          facts: "Issue | {{issues.latest}}\nSince | {{issues.latestTime}}\nImpact on schedule | (fill in)\nNext update | within 30 minutes",
          body: "The team is troubleshooting. We'll update you when it's resolved or if the plan changes." },
        { id: "tpl_halt", name: "Work paused", audiences: [A.lead, A.it], trigger: "halt", tone: "error", includeLive: true,
          subject: "[Paused] {{run.name}}",
          headline: "Work is paused",
          facts: "Reason | {{halt.reason}}\nPaused at | {{halt.time}}\nProgress | {{progress.done}} of {{progress.total}} steps",
          body: "Leadership will decide the next step. We'll follow up shortly." },
        { id: "tpl_available", name: "Systems available", audiences: [A.org], trigger: "step", tone: "success", includeLive: false,
          subject: "Systems are back up",
          headline: "We're back!",
          facts: "Available since | {{now}}",
          body: "Thanks for your patience. Core systems are available again.\n\nIf something doesn't look right, contact the IT Service Desk." },
        { id: "tpl_complete", name: "Completed", audiences: [A.it, A.lead], trigger: "complete", tone: "success", includeLive: false,
          subject: "[Complete] {{run.name}} — {{run.outcome}}",
          headline: "{{run.name}} complete",
          facts: "Outcome | {{run.outcome}}\nDuration | {{elapsed}}\nSteps | {{progress.done}} of {{progress.total}}\nIssues | {{issues.total}} ({{issues.open}} open)\nAuthorized by | {{run.authorizedBy}}",
          body: "Thanks to everyone who helped. A full report is available from the Core Team." },
        { id: "tpl_aborted", name: "Rolled back / cancelled", audiences: [A.it, A.lead, A.org], trigger: "aborted", tone: "error", includeLive: false,
          subject: "[Cancelled] {{run.name}}",
          headline: "Maintenance cancelled",
          facts: "Status | {{run.outcome}}\nReason | {{run.summary}}",
          body: "Systems remain on their current configuration. We'll share a new date once it's scheduled." },
        { id: "tpl_summary", name: "Post-run summary", audiences: [A.lead], trigger: "after", tone: "neutral", includeLive: false,
          subject: "Summary: {{run.name}} ({{run.date}})",
          headline: "How it went",
          facts: "Outcome | {{run.outcome}}\nDuration | {{elapsed}}\nIssues | {{issues.total}}\nTiming captured automatically | {{timing.auto}} of {{progress.done}} steps",
          body: "**Lessons learned**\n{{lessons.list}}" },
      ],
    };
  }

  /* ======================= team settings ======================= */
  let cache = null;
  async function load(force) {
    if (cache && !force) return cache;
    const s = await S().getSettings().catch(() => ({}));
    const d = defaults();
    cache = { ...d, ...(s.comms || {}) };
    if (!s.comms) cache.templates = d.templates;
    return cache;
  }
  async function save(cfg) {
    const s = await S().getSettings().catch(() => ({})); // re-read so we don't clobber other settings
    await S().saveSettings({ ...s, comms: cfg });
    cache = cfg;
    applyBranding();
  }
  function isCommunicator(cfg) { return !cfg.communicators.length || cfg.communicators.some((n) => n.toLowerCase() === PR.app.me.toLowerCase()); }
  function applyBranding() {
    if (!cache) return;
    const org = $("#brandOrg"); if (org) org.textContent = [cache.orgName, cache.teamName].filter(Boolean).join(" · ");
    const slot = $("#brandLogoSlot"); if (slot) { slot.innerHTML = ""; if (cache.logo) slot.append(h("img.brand-logo", { src: cache.logo, alt: cache.orgName })); }
  }

  /* ======================= plan for a procedure ======================= */
  function planFor(proc, cfg) {
    const items = proc.comms && Array.isArray(proc.comms.items) ? proc.comms.items : null;
    if (items) return items.filter((i) => i.enabled !== false && cfg.templates.some((t) => t.id === i.templateId)).map((i) => ({ ...i, tpl: cfg.templates.find((t) => t.id === i.templateId) }));
    return cfg.templates.map((t) => ({ id: "pl_" + t.id, templateId: t.id, trigger: t.trigger, minutes: t.minutes, stepId: "", tpl: t, enabled: true }));
  }

  /* ======================= variables ======================= */
  function liveURL(run) {
    const info = S().info || {};
    let base = location.origin + location.pathname;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && info.host) base = `${location.protocol}//${info.host}${location.port ? ":" + location.port : ""}${location.pathname}`;
    return `${base}#/live/${run.id}`;
  }
  function context(run, cfg, item) {
    const proc = run.snapshot;
    const ctx = M().varContext(run);
    const all = M().allSteps(proc).filter(({ step }) => M().isApplicable(step, run.setup));
    const st = (id) => (run.steps || {})[id] || {};
    const done = all.filter(({ step }) => ["done", "skipped", "na"].includes(st(step.id).status)).length;
    const remaining = all.filter(({ step }) => !["done", "skipped", "na"].includes(st(step.id).status)).reduce((a, { step }) => a + (Number(step.estMin) || 0), 0);
    const active = all.filter(({ step }) => st(step.id).status === "active").map(({ step, section }) => { const t = M().resolveTarget(proc, step, section, run.setup); return `${step.num} ${step.title}${t.title ? " (" + t.title + ")" : ""}`; });
    const decisions = [];
    all.forEach(({ step }) => (step.blocks || []).filter((b) => b.type === "decision").forEach((b) => { const v = (st(step.id).values || {})[b.id]; if (v && v.decision) decisions.push({ b, v }); }));
    decisions.sort((a, b) => a.v.at - b.v.at);
    const lastDec = decisions[decisions.length - 1];
    const issues = Object.values(run.issues || {}).sort((a, b) => a.at - b.at);
    const lastIssue = issues[issues.length - 1];
    const su = run.setup || {};
    const ws = su.windowStart ? new Date(su.windowStart).getTime() : null, we = su.windowEnd ? new Date(su.windowEnd).getTime() : null;
    const fmtW = (t) => (t ? new Date(t).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "(not set)");
    const c = run.completion || {};
    const lessons = Object.values(run.lessons || {}).filter((l) => l.text);
    const timedAuto = Object.values(run.steps || {}).filter((s) => s.status === "done" && (s.timing || "auto") === "auto").length;
    const step = item && item.stepId ? M().findStep(proc, item.stepId) : null;
    Object.assign(ctx, {
      now: fmtTime(now(), false), org: { name: cfg.orgName }, team: { name: cfg.teamName }, sender: PR.app.me, impact: su.impact || "Core banking may be briefly unavailable",
      window: { start: fmtW(ws), end: we ? (ws && fmtDate(ws) === fmtDate(we) ? new Date(we).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : fmtW(we)) : "(not set)", date: ws ? new Date(ws).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : (su.exerciseDate || "") },
      started: run.startedAt ? fmtTime(run.startedAt, false) : "(not started)", elapsed: run.startedAt ? fmtDur((run.completedAt || now()) - run.startedAt, { short: true }) : "—",
      eta: remaining && run.status !== "completed" ? `${fmtTime(now() + remaining * 60000, false)} (~${fmtMin(remaining)} remaining)` : "—",
      progress: { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 },
      current: { steps: active.length ? active.join("; ") : "Between steps" },
      decision: lastDec ? { result: lastDec.v.decision === "go" ? "GO" : "NO-GO", maker: lastDec.v.maker || "", time: fmtTime(lastDec.v.at, false), rationale: lastDec.v.rationale || "—", question: lastDec.b.question } : { result: "pending", maker: "", time: "", rationale: "", question: "" },
      issues: { open: issues.filter((i) => i.status !== "resolved").length, total: issues.length, latest: lastIssue ? lastIssue.title : "none", latestTime: lastIssue ? fmtTime(lastIssue.at, false) : "" },
      halt: run.halt ? { reason: run.halt.reason, time: fmtTime(run.halt.at, false) } : { reason: "", time: "" },
      step: step ? { title: step.step.title, num: step.step.num } : { title: "", num: "" },
      timing: { auto: timedAuto },
      lessons: { list: lessons.length ? lessons.map((l) => `- ${l.text}`).join("\n") : "- None recorded" },
      live: { url: liveURL(run) },
    });
    ctx.run = { ...ctx.run, name: run.name, status: run.status, outcome: c.outcome || "", summary: c.summary || "", authorizedBy: c.authorizedBy || "", date: su.exerciseDate || "" };
    return ctx;
  }
  const fill = (text, ctx) => M().interpolate(text || "", ctx, false);

  /* ======================= due status ======================= */
  function sentList(run, item) { return ((run.commsSent || {})[item.id]) || []; }
  function status(run, item) {
    const sent = sentList(run, item);
    const last = sent.length ? sent[sent.length - 1].at : 0;
    const st = run.status;
    const live = st === "active" || st === "paused";
    let due = false, why = "";
    switch (item.trigger) {
      case "advance": case "reminder": due = !sent.length && (st === "setup" || live); why = st === "setup" ? "Before you start" : "Not sent before start"; break;
      case "start": due = !sent.length && live; why = "Run has started"; break;
      case "decision": {
        let latest = 0;
        M().allSteps(run.snapshot).forEach(({ step }) => (step.blocks || []).filter((b) => b.type === "decision").forEach((b) => { const v = (((run.steps || {})[step.id] || {}).values || {})[b.id]; if (v && v.at > latest) latest = v.at; }));
        due = latest > last; why = "Decision recorded"; break;
      }
      case "step": { const s = item.stepId && (run.steps || {})[item.stepId]; due = !!(s && s.status === "done" && !sent.length); why = "Linked step completed"; break; }
      case "interval": { const mins = Number(item.minutes || item.tpl.minutes) || 30; due = st === "active" && now() - (last || run.startedAt || now()) >= mins * 60000; why = `Every ${mins} min`; break; }
      case "issue": due = Object.values(run.issues || {}).some((i) => ["high", "critical"].includes(i.severity) && i.at > last); why = "High-severity issue"; break;
      case "halt": due = st === "paused" && run.halt && run.halt.at > last; why = "Run halted"; break;
      case "complete": due = st === "completed" && !sent.length; why = "Run completed"; break;
      case "aborted": due = st === "aborted" && !sent.length; why = "Run aborted"; break;
      case "after": due = st === "completed" && !sent.length; why = "Run completed"; break;
      default: due = false; why = "Manual";
    }
    return { due, why, sent, last };
  }
  function dueCount(run, cfg) { return planFor(run.snapshot, cfg).filter((i) => status(run, i).due).length; }

  /* ======================= email rendering ======================= */
  function emailInline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" style="color:#00538b">$2</a>');
  }
  function emailBody(text) {
    const lines = String(text || "").split("\n");
    let html = "", list = false;
    for (const l of lines) {
      const b = l.match(/^\s*[-•]\s+(.*)$/);
      if (b) { if (!list) { html += '<ul style="margin:6px 0 12px;padding-left:20px">'; list = true; } html += `<li style="margin:3px 0">${emailInline(b[1])}</li>`; continue; }
      if (list) { html += "</ul>"; list = false; }
      if (l.trim()) html += `<p style="margin:0 0 12px">${emailInline(l)}</p>`;
    }
    if (list) html += "</ul>";
    return html;
  }
  /* Table-based layout with inline styles so it survives Outlook. Open Sans → Calibri (brand's internal typeface) → Arial. */
  function renderEmail(msg, cfg) {
    const tone = TONES[msg.tone] || TONES.neutral;
    const F = "'Open Sans',Calibri,Arial,sans-serif";
    const facts = String(msg.facts || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[0] && r.length > 1);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(msg.subject)}</title></head><body style="margin:0;padding:0;background:#f3f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5"><tr><td align="center" style="padding:24px 12px">
<div style="max-width:640px;margin:0 auto"><!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#ffffff;font-family:${F};color:#45494c">
<tr><td style="background:#53575a;padding:18px 28px;border-bottom:4px solid #00b2e3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="font-family:${F};color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-.2px">${esc(cfg.orgName || "")}</td>
  <td align="right" style="font-family:${F};color:#ffffff;font-size:12px;letter-spacing:1px;text-transform:uppercase">${esc(cfg.teamName || "")}</td></tr></table></td></tr>
<tr><td style="background:${tone.soft};border-left:6px solid ${tone.color};padding:8px 28px;font-family:${F};font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${tone.ink || tone.color}">${esc(tone.label)}</td></tr>
<tr><td style="padding:24px 28px 8px">
  <h1 style="margin:0 0 14px;font-family:${F};font-size:26px;line-height:1.2;font-weight:800;color:#53575a">${esc(msg.headline || msg.subject)}</h1>
  ${facts.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-top:1px solid #cfd2d3">${facts.map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #cfd2d3;font-family:${F};font-size:13px;font-weight:700;color:#53575a;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #cfd2d3;font-family:${F};font-size:14px;color:#45494c;vertical-align:top">${emailInline(v)}</td></tr>`).join("")}</table>` : ""}
  <div style="font-family:${F};font-size:15px;line-height:1.55;color:#45494c">${emailBody(msg.body)}</div>
  ${msg.includeLive && msg.liveURL ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="background:#6abf4b"><a href="${esc(msg.liveURL)}" style="display:inline-block;padding:12px 22px;font-family:${F};font-size:15px;font-weight:800;color:#ffffff;text-decoration:none">Follow along live &rarr;</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:4px 28px 24px;font-family:${F};font-size:13px;color:#767b7e">${esc(msg.sender || "")}<br>${esc(cfg.signature || "")}${cfg.tagline ? `<br><span style="color:#00b2e3;font-weight:700">${esc(cfg.tagline)}</span>` : ""}</td></tr>
<tr><td style="height:6px;background:#00b2e3;font-size:0;line-height:0">&nbsp;</td></tr>
</table><!--[if mso]></td></tr></table><![endif]--></div></td></tr></table></body></html>`;
  }
  function plainText(msg) {
    const facts = String(msg.facts || "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[0] && r.length > 1);
    return [msg.headline || msg.subject, "", ...facts.map(([k, v]) => `${k}: ${v}`), facts.length ? "" : null, String(msg.body || "").replace(/\*\*/g, ""),
      msg.includeLive && msg.liveURL ? `\nFollow along live: ${msg.liveURL}` : "", "", msg.sender, msg.signature].filter((x) => x !== null).join("\n").trim();
  }
  function emlFile(msg, html) {
    // X-Unsent makes Outlook open this as a new draft ready to send.
    const b64 = btoa(unescape(encodeURIComponent(html))).replace(/.{76}/g, "$&\r\n");
    const encH = (s) => `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
    return [`To: ${msg.to || ""}`, msg.cc ? `Cc: ${msg.cc}` : null, msg.replyTo ? `Reply-To: ${msg.replyTo}` : null, `Subject: ${encH(msg.subject)}`, "X-Unsent: 1", "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64].filter((x) => x !== null).join("\r\n");
  }
  async function copyRich(html, text) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      toast("Copied — paste into a new Outlook email", "ok");
    } catch {
      // Fallback for non-secure origins (http://hostname): select rendered HTML and copy
      const div = h("div", { html, style: "position:fixed;left:-9999px;top:0;background:#fff" });
      document.body.appendChild(div);
      const r = document.createRange(); r.selectNodeContents(div); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.execCommand("copy"); sel.removeAllRanges(); div.remove();
      toast("Copied — paste into a new Outlook email", "ok");
    }
  }

  /* ======================= composer ======================= */
  async function compose({ run, item, commit, readonly }) {
    const cfg = await load();
    const tpl = item.tpl;
    const ctx = context(run, cfg, item);
    const auds = cfg.audiences.filter((a) => (tpl.audiences || []).includes(a.id));
    const joinAddr = (k) => [...new Set(auds.map((a) => a[k]).join(";").split(/[;,]/).map((x) => x.trim()).filter(Boolean))].join("; ");
    const msg = {
      tone: tpl.tone, includeLive: tpl.includeLive, liveURL: ctx.live.url, sender: PR.app.me, signature: cfg.signature, replyTo: cfg.replyTo,
      to: joinAddr("to"), cc: joinAddr("cc"), subject: fill(tpl.subject, ctx), headline: fill(tpl.headline, ctx), facts: fill(tpl.facts, ctx), body: fill(tpl.body, ctx),
    };
    const frame = h("iframe.cm-preview", { title: "Email preview" });
    const draw = () => { frame.srcdoc = renderEmail(msg, cfg); };
    const inp = (k, ph) => h("input.inp", { value: msg[k], placeholder: ph, oninput: (e) => { msg[k] = e.target.value; draw(); } });
    const ta = (k, rows) => h("textarea.inp", { rows, oninput: (e) => { msg[k] = e.target.value; draw(); } }, msg[k]);
    const record = (method) => {
      if (readonly) return;
      const entry = { at: now(), by: PR.app.me, method, subject: msg.subject, audiences: auds.map((a) => a.name), to: msg.to };
      const cid = uid("cm");
      commit([{ op: "set", path: ["commsSent", item.id], value: [...sentList(run, item), entry] },
        { op: "set", path: ["comms", cid], value: { id: cid, at: entry.at, by: entry.by, who: entry.audiences.join(", ") || "Distribution", method: method === "teams" ? "teams" : "email", request: msg.subject, confirmed: null, plan: tpl.name } }],
      { event: { type: "comms", text: `📣 ${tpl.name} sent to ${entry.audiences.join(", ")} (${method})` } });
      toast(`Logged as sent to ${entry.audiences.join(", ") || "recipients"}`, "ok");
    };
    draw();
    await modal({
      title: `📣 ${tpl.name}`, subtitle: `${auds.map((a) => a.name).join(" · ") || "No audience"} — ${(TRIGGERS.find((t) => t[0] === item.trigger) || [, ""])[1]}`, size: "xl", className: "m-compose",
      body: h("div.cm-grid",
        h("div.cm-form",
          h("div.frow", h("div.field.grow", h("label.lbl", "To"), inp("to", "Set addresses on the Comms page"))), h("div.field", h("label.lbl", "Cc"), inp("cc", "")),
          h("div.field", h("label.lbl", "Subject"), inp("subject")), h("div.field", h("label.lbl", "Headline"), inp("headline")),
          h("div.field", h("label.lbl", "Key facts (Label | value per line)"), ta("facts", 5)), h("div.field", h("label.lbl", "Message"), ta("body", 7)),
          h("label.ck", h("input", { type: "checkbox", checked: msg.includeLive, onchange: (e) => { msg.includeLive = e.target.checked; draw(); } }), " Include “Follow along live” button"),
          (S().kind === "local" && msg.includeLive) ? h("div.help", "Live link only works for others when the app runs from the team server.") : null),
        h("div.cm-prev-wrap", frame)),
      actions: [
        { label: "⧉ Copy for Outlook", kind: "cta", onClick: async () => { await copyRich(renderEmail(msg, cfg), plainText(msg)); record("email"); return false; } },
        { label: "✉ Outlook draft (.eml)", onClick: () => { download(`${PR.u.slug(msg.subject)}.eml`, emlFile(msg, renderEmail(msg, cfg)), "message/rfc822"); record("email"); return false; } },
        { label: "mailto", onClick: () => { const body = plainText(msg).slice(0, 1800); location.href = `mailto:${encodeURIComponent(msg.to)}?${msg.cc ? "cc=" + encodeURIComponent(msg.cc) + "&" : ""}subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(body)}`; record("email"); return false; } },
        { label: "💬 Copy for Teams", onClick: () => { copyText(plainText(msg)); record("teams"); return false; } },
        { spacer: true }, { label: "Close", value: null },
      ],
    });
  }

  /* ======================= runner panel ======================= */
  async function runnerPanel(api) {
    const cfg = await load();
    const { run } = api;
    const plan = planFor(run.snapshot, cfg);
    const canSend = isCommunicator(cfg);
    const box = h("div.cm-panel");
    if (!canSend) box.append(h("div.banner.b-info.sm", `Updates are sent by ${cfg.communicators.join(", ")}. You can see what's been sent.`));
    if (!plan.length) box.append(h("div.muted.pad", "No communication plan for this procedure. Add templates on the Comms page."));
    const rows = plan.map((it) => ({ it, s: status(run, it) })).sort((a, b) => (b.s.due - a.s.due));
    rows.forEach(({ it, s }) => {
      const last = s.sent[s.sent.length - 1];
      box.append(h(`div.cm-item${s.due ? ".due" : ""}${s.sent.length ? ".sent" : ""}`,
        h("div.cm-top", h("span.cm-dot", { style: { background: (TONES[it.tpl.tone] || TONES.neutral).color } }), h("b", it.tpl.name), s.due ? h("span.chip.c-amber", "Due") : s.sent.length ? h("span.chip.c-green", `Sent ×${s.sent.length}`) : null),
        h("div.muted.small", cfg.audiences.filter((a) => (it.tpl.audiences || []).includes(a.id)).map((a) => a.name).join(" · "), " — ", s.due ? s.why : (TRIGGERS.find((t) => t[0] === it.trigger) || [, ""])[1]),
        last ? h("div.small", `Last: ${fmtTime(last.at, false)} by ${last.by}`) : null,
        canSend ? h(`button.btn.btn-sm${s.due ? ".btn-cta" : ""}`, { type: "button", onclick: () => compose({ run: api.run, item: it, commit: api.commit }) }, s.due ? "Compose now" : "Compose") : null));
    });
    if (canSend) box.append(h("a.link-btn.small", { href: "#/comms" }, "Edit templates & audiences →"));
    return box;
  }

  /* ======================= builder settings tab ======================= */
  async function planEditor(draft) {
    const cfg = await load();
    if (!draft.comms || !Array.isArray(draft.comms.items)) draft.comms = { items: planFor({}, cfg).map((i) => ({ id: i.id, templateId: i.templateId, trigger: i.trigger, minutes: i.minutes, stepId: "", enabled: true })) };
    const items = draft.comms.items;
    cfg.templates.forEach((t) => { if (!items.some((i) => i.templateId === t.id)) items.push({ id: "pl_" + t.id, templateId: t.id, trigger: t.trigger, minutes: t.minutes, stepId: "", enabled: false }); });
    const steps = M().allSteps(draft);
    const wrap = h("div");
    const draw = () => {
      wrap.innerHTML = "";
      wrap.append(h("div.help", "Pick which team templates apply to this procedure and when the runner should flag them as due. Templates and audiences are managed on the ", h("a", { href: "#/comms", onclick: () => $$(".modal-back").forEach((m) => m._close && m._close(null)) }, "Comms page"), "."),
        h("table.edit-table.cm-plan", h("thead", h("tr", ["Use", "Template", "Audience", "Trigger", ""].map((x) => h("th", x)))),
          h("tbody", items.map((it) => {
            const t = cfg.templates.find((x) => x.id === it.templateId); if (!t) return null;
            return h("tr", h("td", h("input", { type: "checkbox", checked: it.enabled !== false, onchange: (e) => { it.enabled = e.target.checked; } })),
              h("td", h("b", t.name)), h("td.small", cfg.audiences.filter((a) => (t.audiences || []).includes(a.id)).map((a) => a.name).join(", ")),
              h("td", h("select.inp.sm", { onchange: (e) => { it.trigger = e.target.value; draw(); } }, TRIGGERS.map(([v, l]) => h("option", { value: v, selected: it.trigger === v }, l)))),
              h("td", it.trigger === "step" ? h("select.inp.sm", { onchange: (e) => (it.stepId = e.target.value) }, h("option", { value: "" }, "— choose step —"), steps.map(({ step }) => h("option", { value: step.id, selected: it.stepId === step.id }, `${step.num} ${step.title}`.slice(0, 60)))) :
                it.trigger === "interval" ? h("span", h("input.inp.sm.w-num", { type: "number", min: 5, value: it.minutes || 30, oninput: (e) => (it.minutes = Number(e.target.value) || 30) }), " min") : null));
          }))));
    };
    draw();
    return wrap;
  }

  /* ======================= Comms page (communicator's workspace) ======================= */
  PR.views.comms = {
    async mount(el) {
      const cfg = clone(await load(true));
      const canEdit = isCommunicator(cfg);
      let sel = cfg.templates[0] ? cfg.templates[0].id : null;
      let dirty = false;
      const page = h("div.page.cm-page");
      el.append(page);
      const sample = () => {
        const fake = { id: "sample", name: "Symitar Failover", snapshot: M().normalize(PR.templates.get("failover").build()), status: "active", startedAt: now() - 47 * 60000,
          setup: { exerciseDate: fmtDate(now()), changeId: "CR-1234", windowStart: new Date(now() + 3600000).toISOString(), windowEnd: new Date(now() + 5 * 3600000).toISOString(), impact: "Online & mobile banking, ATMs, branch systems", primarySiteId: "site_main" },
          steps: {}, issues: { i1: { title: "Replication lag on DR", at: now() - 600000, severity: "high", status: "open" } }, completion: { outcome: "Successful", authorizedBy: "Failover lead" }, lessons: {} };
        const ss = M().allSteps(fake.snapshot); ss.slice(0, 14).forEach(({ step }) => (fake.steps[step.id] = { status: "done", startedAt: now() - 3e6, finishedAt: now() - 2e6, timing: "auto" })); if (ss[14]) fake.steps[ss[14].step.id] = { status: "active", startedAt: now() - 120000 };
        return fake;
      };
      const markDirty = () => { dirty = true; const b = $("#cmSave"); if (b) b.disabled = false; };
      const draw = () => {
        page.innerHTML = "";
        const t = cfg.templates.find((x) => x.id === sel);
        page.append(
          h("div.page-head", h("a.icon-btn", { href: "#/" }, "←"), h("div", h("h1", "Communications"), h("div.muted", "Audiences and message templates used by every procedure's communication plan. Updates are composed from the runner's 📣 Updates tab.")),
            h("div.spacer"), canEdit ? h("button#cmSave.btn.btn-primary", { type: "button", disabled: !dirty, onclick: async () => { await save(cfg); dirty = false; toast("Comms settings saved", "ok"); draw(); } }, "Save") : null),
          !canEdit ? h("div.banner.b-info", `Only ${cfg.communicators.join(", ")} can edit communications.`) : null,
          h("div.cm-cols",
            h("div.cm-side",
              h("div.ins-sec", "Who can send"),
              h("div.field", h("label.lbl", "Communicators (comma separated names — leave empty to let everyone send)"),
                h("input.inp", { value: cfg.communicators.join(", "), disabled: !canEdit, placeholder: "e.g. " + PR.app.me, oninput: (e) => { cfg.communicators = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); markDirty(); } })),
              canEdit && !cfg.communicators.length ? h("button.btn.btn-sm", { type: "button", onclick: () => { cfg.communicators = [PR.app.me]; markDirty(); draw(); } }, `Make me (${PR.app.me}) the communicator`) : null,
              h("div.ins-sec", "Sender & branding"),
              h("div.frow", h("div.field", h("label.lbl", "Organization"), h("input.inp", { value: cfg.orgName, disabled: !canEdit, oninput: (e) => { cfg.orgName = e.target.value; markDirty(); } })),
                h("div.field", h("label.lbl", "Team"), h("input.inp", { value: cfg.teamName, disabled: !canEdit, oninput: (e) => { cfg.teamName = e.target.value; markDirty(); } }))),
              h("div.field", h("label.lbl", "Signature line"), h("input.inp", { value: cfg.signature, disabled: !canEdit, oninput: (e) => { cfg.signature = e.target.value; markDirty(); } })),
              h("div.frow", h("div.field", h("label.lbl", "Reply-to"), h("input.inp", { value: cfg.replyTo, disabled: !canEdit, oninput: (e) => { cfg.replyTo = e.target.value; markDirty(); } })),
                h("div.field", h("label.lbl", "Sign-off"), h("input.inp", { value: cfg.tagline, disabled: !canEdit, oninput: (e) => { cfg.tagline = e.target.value; markDirty(); } }))),
              h("div.field", h("label.lbl", "Logo for the app header (reverse / white version, PNG or SVG)"),
                h("div.frow", cfg.logo ? h("img.cm-logo-prev", { src: cfg.logo }) : h("span.muted.small", "None — the app shows its icon and your organization name."),
                  canEdit ? h("button.btn.btn-sm", { type: "button", onclick: async () => { const f = await PR.u.pickFile("image/png,image/svg+xml"); if (f) { cfg.logo = await PR.u.fileToDataURL(f); markDirty(); draw(); } } }, "Upload") : null,
                  canEdit && cfg.logo ? h("button.btn.btn-sm", { type: "button", onclick: () => { cfg.logo = ""; markDirty(); draw(); } }, "Remove") : null)),
              h("div.ins-sec", "Audiences"),
              cfg.audiences.map((a, i) => h("div.cm-aud",
                h("div.frow", h("div.field.grow", h("input.inp.cm-aud-name", { value: a.name, disabled: !canEdit, oninput: (e) => { a.name = e.target.value; markDirty(); } })),
                  canEdit ? h("button.icon-btn.danger", { type: "button", title: "Remove audience", onclick: () => { cfg.audiences.splice(i, 1); markDirty(); draw(); } }, "🗑") : null),
                h("input.inp.sm", { value: a.desc, placeholder: "Who is this?", disabled: !canEdit, oninput: (e) => { a.desc = e.target.value; markDirty(); } }),
                h("input.inp.sm", { value: a.to, placeholder: "To: distribution list(s), separated by ;", disabled: !canEdit, oninput: (e) => { a.to = e.target.value; markDirty(); } }),
                h("input.inp.sm", { value: a.cc, placeholder: "Cc:", disabled: !canEdit, oninput: (e) => { a.cc = e.target.value; markDirty(); } }))),
              canEdit ? h("button.btn.btn-sm", { type: "button", onclick: () => { cfg.audiences.push({ id: uid("aud"), name: "New audience", desc: "", to: "", cc: "" }); markDirty(); draw(); } }, "＋ Audience") : null),
            h("div.cm-main",
              h("div.cm-tpl-list", cfg.templates.map((x) => h(`button.cm-tpl${x.id === sel ? ".on" : ""}`, { type: "button", onclick: () => { sel = x.id; draw(); } },
                h("span.cm-dot", { style: { background: (TONES[x.tone] || TONES.neutral).color } }), h("span", x.name), h("span.muted.small", (TRIGGERS.find((tr) => tr[0] === x.trigger) || [, ""])[1]))),
                canEdit ? h("button.btn.btn-sm", { type: "button", onclick: () => { const n = { id: uid("tpl"), name: "New template", audiences: [], trigger: "manual", tone: "neutral", includeLive: false, subject: "{{run.name}}", headline: "", facts: "", body: "" }; cfg.templates.push(n); sel = n.id; markDirty(); draw(); } }, "＋ Template") : null),
              t ? templateEditor(t, cfg, canEdit, markDirty, draw, sample) : h("div.muted", "No templates."))));
      };
      draw();
      PR.app.dirty = () => dirty;
    },
    unmount() { PR.app.dirty = null; },
  };

  function templateEditor(t, cfg, canEdit, markDirty, draw, sample) {
    const frame = h("iframe.cm-preview", { title: "Preview with sample data" });
    const run = sample();
    const preview = () => {
      const ctx = context(run, cfg, { stepId: "" });
      frame.srcdoc = renderEmail({ tone: t.tone, includeLive: t.includeLive, liveURL: ctx.live.url, subject: fill(t.subject, ctx), headline: fill(t.headline, ctx), facts: fill(t.facts, ctx), body: fill(t.body, ctx), sender: PR.app.me }, cfg);
    };
    const f = (k, el) => { el.disabled = !canEdit; el.addEventListener("input", () => { t[k] = el.value; markDirty(); preview(); }); return el; };
    preview();
    return h("div.cm-editor",
      h("div.cm-ed-form",
        h("div.frow", h("div.field.grow", h("label.lbl", "Template name"), f("name", h("input.inp", { value: t.name }))),
          h("div.field", h("label.lbl", "Style"), f("tone", h("select.inp", Object.entries(TONES).map(([k, v]) => h("option", { value: k, selected: t.tone === k }, v.label)))))),
        h("div.field", h("label.lbl", "Audiences"), h("div.cm-aud-pick", cfg.audiences.map((a) => h("label.ck", h("input", { type: "checkbox", disabled: !canEdit, checked: (t.audiences || []).includes(a.id), onchange: (e) => { t.audiences = e.target.checked ? [...new Set([...(t.audiences || []), a.id])] : (t.audiences || []).filter((x) => x !== a.id); markDirty(); } }), " ", a.name)))),
        h("div.frow", h("div.field.grow", h("label.lbl", "Default trigger"), f("trigger", h("select.inp", TRIGGERS.map(([v, l]) => h("option", { value: v, selected: t.trigger === v }, l))))),
          t.trigger === "interval" ? h("div.field", h("label.lbl", "Minutes"), f("minutes", h("input.inp.w-num", { type: "number", value: t.minutes || 30 }))) : null),
        h("div.field", h("label.lbl", "Subject"), f("subject", h("input.inp", { value: t.subject }))),
        h("div.field", h("label.lbl", "Headline"), f("headline", h("input.inp", { value: t.headline || "" }))),
        h("div.field", h("label.lbl", "Key facts — one per line: Label | value"), f("facts", h("textarea.inp.mono", { rows: 5 }, t.facts || ""))),
        h("div.field", h("label.lbl", "Message (- bullets, **bold**)"), f("body", h("textarea.inp", { rows: 6 }, t.body || ""))),
        h("label.ck", h("input", { type: "checkbox", disabled: !canEdit, checked: t.includeLive, onchange: (e) => { t.includeLive = e.target.checked; markDirty(); preview(); } }), " Include “Follow along live” button (IT / leadership audiences)"),
        h("details.cm-vars", h("summary", "Variables you can use"), h("div.var-list", VARS.map(([k, d]) => h("div.var-row", { onclick: () => copyText(`{{${k}}}`) }, h("code", `{{${k}}}`), h("span.muted", d))))),
        canEdit ? h("button.btn.btn-sm.btn-danger-o", { type: "button", onclick: async () => { if (await confirmBox("Delete template?", `Delete “${t.name}”?`, { ok: "Delete", kind: "danger" })) { cfg.templates.splice(cfg.templates.indexOf(t), 1); markDirty(); draw(); } } }, "Delete template") : null),
      h("div.cm-prev-wrap", h("div.muted.small", "Preview with sample data"), frame));
  }
  const VARS = [["run.name", "Run name"], ["run.direction", "e.g. Main → DR"], ["run.changeId", "Change ID"], ["window.start", "Maintenance window start"], ["window.end", "Window end"], ["window.date", "Window date"],
    ["impact", "Expected impact (run setup)"], ["started", "Start time"], ["elapsed", "Elapsed"], ["eta", "Estimated finish"], ["progress.pct", "% complete"], ["progress.done", "Steps done"], ["progress.total", "Total steps"],
    ["current.steps", "Steps in progress"], ["decision.result", "GO / NO-GO"], ["decision.maker", "Decision-maker"], ["decision.rationale", "Rationale"], ["issues.open", "Open issues"], ["issues.latest", "Latest issue"],
    ["halt.reason", "Why halted"], ["run.outcome", "Final outcome"], ["run.authorizedBy", "Who authorized completion"], ["lessons.list", "Lessons learned (bullets)"], ["live.url", "Follow-along link"], ["sender", "Your name"], ["now", "Current time"]];

  return { load, save, applyBranding, isCommunicator, planFor, status, dueCount, compose, runnerPanel, planEditor, renderEmail, context, liveURL, TRIGGERS, TONES };
})();
