/* templates.js — starter procedures. Generic placeholders only (no environment-specific hosts or contacts). */
PR.templates = (() => {
  const M = () => PR.model;
  const B = (type, o) => M().newBlock(type, o);
  const txt = (text) => B("text", { text });
  const cmd = (code, label = "") => B("command", { code, label });
  const path = (trail, label = "") => B("path", { trail: trail.join("\n"), label });
  const co = (tone, text, title = "") => B("callout", { tone, text, title });
  const contact = (who, method, detail, request, requireConfirmation = true) => B("contact", { who, method, detail, request, requireConfirmation });
  const val = (test, expected) => B("validation", { test, expected, required: true });
  const dec = (question, criteria, decisionMaker = "Failover lead", noGo = "halt") => B("decision", { question, criteria, decisionMaker, noGo });
  const inp = (label, variable = "", inputType = "text", o = {}) => B("input", { label, variable, inputType, required: true, ...o });
  const chk = (items, title = "") => B("checklist", { title, required: true, items: items.map((t) => ({ id: PR.u.uid("ci"), text: t })) });
  const evi = (label, required = false) => B("evidence", { label, required });
  const conf = (label, phrase) => B("confirm", { label, phrase });
  const timer = (label, minutes) => B("timer", { label, minutes });
  const appr = (label, approverRole) => B("approval", { label, approverRole });
  const link = (label, url, note = "") => B("link", { label, url, note });

  let n = 0;
  const T = (title, target, o = {}, blocks = []) => M().newStep({ num: String(++n), title, target, ...o, blocks });
  const S = (title, phase, description, steps) => M().newSection({ title, phase, description, steps });

  function failover() {
    n = 0;
    const siteA = { id: "site_main", name: "Main datacenter", code: "MAIN", label: "Main", partition: "Symitar", hmc: "https://hmc-main.example.local/hmc/connect", color: "#2563eb" };
    const siteB = { id: "site_dr", name: "DR datacenter", code: "DR", label: "DR", partition: "Symbu", hmc: "https://hmc-dr.example.local/hmc/connect", color: "#ea580c" };
    const core = { owner: "Core" };
    const p = M().newProcedure({
      title: "Symitar Failover (template)",
      description: "Planned failover between datacenters. Steps target the logical role (Current Primary / Current Secondary); the runner maps them to the physical datacenter once the direction is chosen.",
      tags: ["Symitar", "Failover", "DR"],
      environments: {
        enabled: true, directional: true, sites: [siteA, siteB], defaultPrimarySiteId: siteA.id,
        roles: { primary: { name: "Primary", pre: "Current Primary", post: "New Secondary", hostname: "Symitar" }, secondary: { name: "Secondary", pre: "Current Secondary", post: "New Primary", hostname: "Symbu" } },
      },
      setup: {
        requireChangeId: true, requireVerification: true,
        readiness: [
          { id: "r_bk", label: "AIX backups completed at both sites" }, { id: "r_tx", label: "Backups transferred off-host" },
          { id: "r_rep", label: "Replication status healthy (no lag)" }, { id: "r_cr", label: "Change request approved" },
          { id: "r_vend", label: "Vendors / third parties notified" }, { id: "r_team", label: "All chairs present and logged in" },
        ],
        milestones: [{ id: "m_down", label: "Old primary taken down" }, { id: "m_up", label: "New primary up and replicating" }, { id: "m_dns", label: "DNS updated and verified" }, { id: "m_avail", label: "Host available to vendors" }, { id: "m_valid", label: "Business validation complete" }],
      },
      sections: [],
    });
    p.sections = [
      S("Notifications", "pre", "As soon as the date is selected.", [
        T("Create vendor support ticket", "none", { ...core, category: "Communication", window: "As soon as date selected", estMin: 10 }, [contact("Core vendor support", "ticket", "https://support.vendor.example", "Open a ticket for the planned failover window on {{run.date}} ({{run.direction}}).", false)]),
        T("Notify card processor", "none", { ...core, category: "Communication", window: "As soon as date selected", estMin: 5, parallel: true }, [contact("Card processor", "phone", "800-555-0100", "Inform of downtime window and request a testing contact for after failover.")]),
        T("Create change request", "none", { ...core, category: "Communication", window: "As soon as date selected", estMin: 10 }, [inp("Change request #", "changeRequest"), txt("Title format: **Failover {{run.date}} {{run.direction}}**")]),
      ]),
      S("Morning-of prep", "pre", "Backups and job holds.", [
        T("Create AIX backup", "primary", { ...core, category: "Prep-Work", window: "Morning of failover", estMin: 20 }, [path(["Symop", "BACKUP", "(4) Perform a System Backup (AIX)"]), txt("Answer: **4**, Y (Continue), 2 (Disk), 1 (DVD), Y (Batch options), Y (OK)")]),
        T("Create AIX backup", "secondary", { ...core, category: "Prep-Work", window: "Morning of failover", estMin: 20, parallel: true }, [path(["Symop", "BACKUP", "(4) Perform a System Backup (AIX)"])]),
        T("Transfer AIX backup", "primary", { ...core, category: "Prep-Work", estMin: 15 }, [path(["Symop", "BACKUP", "(5) Transfer a System Backup (AIX)"]), txt("Answer: 5, 1 (FTP transfer), 1 (Current)")]),
        T("Place nightly jobs on HOLD in scheduler", "primary", { ...core, category: "Prep-Work", estMin: 5 }, [txt("- Right-click each nightly schedule\n- Select **HOLD**\n-- Schedule turns light blue when held"), evi("Screenshot of held schedules")]),
      ]),
      S("Pre-failover shutdown & checks", "pre", "Quiesce both sites and confirm balances before the go/no-go.", [
        T("Check replication status", "primary", { ...core, category: "Validation", estMin: 3 }, [path(["Symop", "REPLICATION"]), val("Replication status at {{primary.name}}", "Up to date, no lag")]),
        T("Check replication status", "secondary", { ...core, category: "Validation", estMin: 3, parallel: true }, [path(["Symop", "REPLICATION"]), val("Replication status at {{secondary.name}}", "Up to date, no lag")]),
        T("Stop transaction logging", "primary", { ...core, category: "Processing", estMin: 3 }, [path(["Symop", "STOPLOGGING"]), txt("- Stop device list: `ALL`\n- Bring remote poster off host: `Y`")]),
        T("Stop replication services", "secondary", { ...core, category: "Processing", estMin: 5 }, [path(["Symop", "REPLICATIONSERVICE", "(5) Stop Replication Service"]), timer("Wait before the next step", 3)]),
        T("Stop replication services", "primary", { ...core, category: "Processing", estMin: 3 }, [path(["Symop", "REPLICATIONSERVICE", "(5) Stop Replication Service"])]),
        T("Run FAILOVER.REPORTS.JOB", "primary", { ...core, category: "Processing", estMin: 10 }, [path(["Episys", "Batch Control"]), cmd("FAILOVER.REPORTS.JOB"), txt("Enter through the date prompt.")]),
        T("Run FAILOVER.REPORTS.JOB", "secondary", { ...core, category: "Processing", estMin: 10, parallel: true }, [path(["Episys", "Batch Control"]), cmd("FAILOVER.REPORTS.JOB")]),
        T("Record next account number", "primary", { ...core, category: "Prep-Work", estMin: 2 }, [path(["Episys", "Parameter Manager", "Miscellaneous Parameter"]), inp("Next account number", "nextAccountNumber", "number")]),
        T("Compare Trial Balance Summary reports", "both", { ...core, category: "Review", estMin: 15, critical: true }, [path(["Episys", "Print Control", "Trial Balance Summary Report"]), val("Side-by-side compare of both locations", "Account totals match (available balance may differ)"), evi("Both reports side by side", true)]),
        T("Decision point", "both", { ...core, category: "Decisioning", estMin: 5, critical: true, hold: true }, [dec("Proceed with failover?", "- Trial balances match\n- Replication stopped cleanly at both sites\n- No open critical issues", "Failover lead")]),
      ]),
      S("Failover cutover", "pre", "Take the current primary down and bring the other site up as primary.", [
        T("Log into HMC and open terminal", "primary", { ...core, category: "Processing", estMin: 3, critical: true }, [link("Open HMC at {{primary.name}}", "{{primary.hmc}}", "Credentials in password vault"), conf("Type the HMC partition label you selected", "{{primary.partition}}")]),
        T("Take primary to HARD DOWN", "primary", { ...core, category: "Processing", estMin: 5, critical: true }, [txt("- Login as **symop**\n- Issue `UP` and confirm date/time\n- Shut down to HARD DOWN")]),
        T("Validate primary is down", "primary", { ...core, category: "Validation", estMin: 2 }, [val("PING {{primary.hostname}}", "No reply")]),
        T("Log into HMC and open terminal", "secondary", { ...core, category: "Processing", estMin: 3, critical: true }, [link("Open HMC at {{secondary.name}}", "{{secondary.hmc}}"), conf("Type the HMC partition label you selected", "{{secondary.partition}}")]),
        T("Take secondary to HARD DOWN", "secondary", { ...core, category: "Processing", estMin: 5 }, [co("warn", "If SECURITYSERVER.EXE or EVENTBUSSERVER.EXE is running stop Internal Sym Level Services (25). If DBMS is running stop DBMS (30).")]),
        T("Start partition", "secondary", { ...core, category: "Processing", estMin: 10 }, [txt("HMC → tick **{{secondary.partition}}** → Operations → **Activate**")]),
        T("Issue FAILOVER command", "secondary", { ...core, category: "Processing", estMin: 10, critical: true }, [B("console", { label: "symop@{{secondary.partition}}", prompt: "$", code: "$ UP\n$ FAILOVER\n   (0) Display Failover Configuration\n   (6) Execute Failover\nSelection: 6\nFailover Primary/Secondary? Y\nAre you sure you want to continue? Y", note: "Answer Y to both prompts." })]),
        T("Validate new primary", "secondary", { ...core, category: "Validation", estMin: 3, phase: "post" }, [path(["FAILOVER", "(1) Display Replication Services Status Details"]), val("Hostname shown on {{newPrimary.name}}", "Hostname = {{newPrimary.hostname}}")]),
        T("Ask Network to change primary DNS", "none", { owner: "Network", category: "Communication", estMin: 10, phase: "post" }, [contact("Network team", "teams", "", "Point **{{newPrimary.hostname}}** DNS to {{newPrimary.name}}.")]),
        T("Validate DNS response", "secondary", { ...core, category: "Validation", estMin: 3, phase: "post" }, [val("PING {{newPrimary.hostname}}", "Responds with {{newPrimary.name}} IP")]),
        T("Start replication", "secondary", { ...core, category: "Processing", estMin: 3, phase: "post" }, [path(["REPLICATIONSERVICE", "(4) Start Replication Services"])]),
      ]),
      S("Bring up services", "post", "Former primary becomes the new secondary.", [
        T("Start partition & bring new secondary UP", "primary", { ...core, category: "Processing", estMin: 15 }, [txt("HMC → tick **{{primary.partition}}** → Operations → **Activate**, then `UP`")]),
        T("Restart services", "secondary", { ...core, category: "Processing", estMin: 10 }, [B("table", { header: true, rows: "Service | Option\nATM Network | (5)\nAudio and Home Banking | (3)\nCredit Retrieval | (11)" })]),
        T("Restart services", "primary", { ...core, category: "Processing", estMin: 10, parallel: true }, [path(["Symop", "RESTART"])]),
        T("Update next account number on new primary", "secondary", { ...core, category: "Processing", estMin: 3 }, [path(["Episys", "Parameter Manager", "Miscellaneous Parameter"]), txt("Set **Next Account Number** to **{{var.nextAccountNumber}}** (recorded earlier).")]),
        T("Run FAILOVER.ONLINE and verify devices ON HOST", "secondary", { ...core, category: "Processing", estMin: 10 }, [cmd("FAILOVER.ONLINE"), chk(["ATM", "CRS", "FICS server", "SymConnect", "Pagers"], "Confirm ON HOST")]),
      ]),
      S("Validation & close-out", "post", "", [
        T("Inform vendors the host is available", "none", { ...core, category: "Communication", estMin: 10 }, [contact("Card processor", "phone", "800-555-0100", "Host is available on {{newPrimary.name}}.")]),
        T("Test connectivity and Episys functionality", "secondary", { ...core, category: "Validation", estMin: 20 }, [val("Log in, open an account, post a test transaction", "All succeed")]),
        T("Confirm phone and online banking", "secondary", { ...core, category: "Validation", estMin: 10, parallel: true }, [val("Phone & online banking login", "Works")]),
        T("Verify /etc/hosts permissions are 644", "secondary", { ...core, category: "Validation", estMin: 3 }, [cmd("ls -l /etc/hosts"), val("Permissions", "-rw-r--r--")]),
        T("Release scheduler holds / confirm nightly jobs on correct host", "secondary", { ...core, category: "Processing", estMin: 5 }, [path(["Symop", "BATCHSTATUS"])]),
        T("Failover complete", "none", { ...core, category: "Celebration", estMin: 1 }, [appr("Failover complete — authorize close", "Failover lead")]),
      ]),
    ];
    // Communication plan: team templates with this procedure's triggers ("Systems available" fires when service is restored).
    // Member impact: members are impacted from the moment the primary goes HARD DOWN until FAILOVER.ONLINE puts devices back ON HOST.
    const allSt = p.sections.flatMap((x) => x.steps);
    const downStep = allSt.find((x) => /hard down/i.test(x.title) && x.target === "primary");
    const upStep = allSt.find((x) => /FAILOVER\.ONLINE/i.test(x.title));
    if (downStep) downStep.impact = { mark: "down", on: "start" };
    if (upStep) upStep.impact = { mark: "up", on: "complete" };
    p.impactName = "Member impact";
    // Concurrent chairs: 1st chair runs the core failover, 2nd chair handles vendors, notifications and other teams.
    p.tracks = [{ id: "chair1", name: "1st chair", desc: "Core failover" }, { id: "chair2", name: "2nd chair", desc: "Vendors, notifications & other teams" }];
    p.sections.forEach((sec) => { sec.track = /notification/i.test(sec.title) ? "chair2" : "chair1"; });
    const find = (re) => allSt.find((x) => re.test(x.title));
    const dns = find(/Network to change primary DNS/i), dnsCheck = find(/Validate DNS response/i), vendors = find(/Inform vendors the host is available/i);
    if (dns) dns.track = "chair2";
    if (dnsCheck && dns) dnsCheck.waitFor = dns.id;
    if (vendors) { vendors.track = "chair2"; if (upStep) vendors.waitFor = upStep.id; }
    p.comms = { items: [["tpl_advance_org", "advance"], ["tpl_advance_it", "advance"], ["tpl_reminder", "reminder"], ["tpl_start", "start"], ["tpl_impact_down", "impact-down"], ["tpl_decision", "decision"], ["tpl_progress", "interval", { minutes: 30 }],
      ["tpl_issue", "issue"], ["tpl_halt", "halt"], ["tpl_available", "impact-up"], ["tpl_complete", "complete"], ["tpl_aborted", "aborted"], ["tpl_summary", "after"]]
      .map(([templateId, trigger, o]) => ({ id: "pl_" + templateId, templateId, trigger, enabled: true, stepId: "", ...(o || {}) })) };
    return p;
  }

  function release() {
    n = 0;
    const p = M().newProcedure({ title: "Core release / upgrade (template)", description: "Pre-checks, install, validation and sign-off.", tags: ["Release"] });
    p.sections = [
      S("Planning", "", "", [
        T("Confirm maintenance window and stakeholders", "none", { estMin: 10 }, [inp("Window start", "windowStart", "datetime"), inp("Window end", "windowEnd", "datetime"), inp("Change ticket #", "ticket")]),
        T("Validate prerequisites", "none", { estMin: 15 }, [chk(["Last backup completed", "Monitoring and alerts active", "Vendor release notes reviewed"])]),
      ]),
      S("Execution", "", "", [
        T("Capture baseline health", "none", { estMin: 10 }, [evi("Baseline dashboard screenshot")]),
        T("Approval to proceed", "none", { estMin: 2, hold: true }, [appr("Begin install", "Change approver")]),
        T("Install release", "none", { estMin: 45 }, [txt("Follow vendor sequence."), inp("Release version", "version")]),
        T("Post-install validation", "none", { estMin: 20 }, [val("Smoke test", "All core functions succeed")]),
      ]),
      S("Close-out", "", "", [T("Notify stakeholders", "none", { estMin: 5 }, [contact("IT staff", "email", "it-staff@example.com", "Release {{var.version}} complete.", false)])]),
    ];
    return p;
  }

  function checklist() {
    n = 0;
    const p = M().newProcedure({ title: "Simple checklist", description: "" });
    p.sections = [S("Checklist", "", "", [T("First task", "none", {}, [txt("What to do.")]), T("Second task", "none", {}, [txt("What to do.")])])];
    return p;
  }

  const list_ = [
    { id: "failover", icon: "🔁", title: "Symitar failover (two datacenters)", hint: "direction-aware", build: failover },
    { id: "release", icon: "🚀", title: "Release / upgrade", build: release },
    { id: "checklist", icon: "☑", title: "Simple checklist", build: checklist },
  ];
  return { list: () => list_, get: (id) => list_.find((t) => t.id === id) };
})();
