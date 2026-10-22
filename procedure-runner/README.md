# Core Team Procedure Runner

Build runbooks like web pages (drag-and-drop steps and components), then run them step by step. Every run records who did what, timing, issues, communications, decisions, validations, and lessons learned. It's built for long Symitar procedures (100–200 steps), including **direction-aware datacenter failovers**.

No install and no build step. It's plain HTML/JS plus a small Python server from the standard library.

## Start it

| How | What you get |
|---|---|
| Double-click **`ProcedureRunner.bat`**, or the desktop icon from `Install_Desktop_Shortcut.bat` | **Desktop app.** Procedure Runner boots quietly in the background, with no console window, and opens in its own app window. If it's already running, the window just opens. `Stop_ProcedureRunner.bat` stops it. |
| Double-click **`Start_ProcedureRunner.bat`** | Team server on port 8000 in a console window, so you can see the log. Teammates open `http://<your-pc-name>:8000/`. |
| `py server.py --data I:\Core\Procedures\ProcedureRunner\data` | The same, with data on the shared drive. |
| Open `index.html` directly | **Local mode**: data stays in this browser only. Good for drafting; use Export/Import JSON to move work. |

**Desktop app settings**: copy `ProcedureRunner.cfg.example` to `ProcedureRunner.cfg` to change the port, the data folder or who can connect.
- `DATA=I:\Core\ProcedureRunner\data` keeps everyone on the same runs.
- `HOST=0.0.0.0` lets teammates connect to your PC.
- Logs are kept in `%LOCALAPPDATA%\ProcedureRunner`.

`Install_Desktop_Shortcut.bat` can also start Procedure Runner in the background when you sign in to Windows. Turn that off any time in Task Manager › Startup apps.

Several people can run `server.py` against the same `--data` folder on a shared drive; writes are file-locked. The simplest setup is still one person hosting and everyone else connecting to that address.

## Build (✎ Edit)

- **Left panel → Add**: drag *steps* (Blank, Communication, Validation, Go/No-Go, Record a value, Run a command, Wait, Sign-off, Milestone, Section) or *components* onto the canvas. You can also click a tile to add it after the current selection.
- **Components**: Instructions, Command (one-click copy), Menu path (Symop › BACKUP › (4)), Callout, Link, Screenshot, Table, Divider, Checklist, Record a value, Evidence (paste screenshots), Type-to-confirm, Contact/handoff, Validation (expected vs actual, pass/fail), Go/No-Go, Sign-off, and Wait/countdown.
- **Left panel → Outline**: drag to reorder steps and sections across the whole procedure. Ctrl+click selects several steps, which you can then bulk-edit or move together.
- **Inspector (right)**: target environment, owner, escalation contact, timing window, estimate, *parallel with previous*, *hold point*, *critical*, and *only run in one direction*.
- **⚙ Settings → Environments**: define the two datacenters (name, code, **fixed HMC partition label**, HMC URL, colour) and the logical roles (Current Primary → New Secondary, Current Secondary → New Primary, with hostnames).
- **Variables** work in any text, command, path or link: `{{primary.name}}`, `{{primary.partition}}`, `{{secondary.hmc}}`, `{{newPrimary.hostname}}`, `{{run.changeId}}`. Values you capture also become variables, e.g. step 48 records `{{var.nextAccountNumber}}` and step 85 shows it.
- **Undo/redo** (Ctrl+Z / Ctrl+Y), autosave, **🧪 Practice** runs of the draft, **Publish** with a change note. Publishing creates an immutable version, and runs always record which version they used.
- **Import**: New procedure ▾ → *From Excel / CSV*. This reads `.xlsx` and `.xlsm` directly. Location cells written as formulas (`=E2` vs `=IF(E2=…)`) become *Current Primary* / *Current Secondary* automatically. You can also paste rows from Excel.
- **Import from Word**: New procedure ▾ → *From Word…* (`.docx`). See [Word import & export](#word-import--export).

## How failover direction works

Steps target a **logical role**, not a city. At run setup you pick the direction (e.g. *Main → DR* or the reverse). Every step then shows a banner with:

| Datacenter (physical) | HMC partition (fixed to the site) | Logical role (changes after cutover) |
|---|---|---|

Sections or steps marked *after cutover* switch the role labels to New Primary / New Secondary. The hostname follows the role (DNS) and the partition label stays with the datacenter. A second person records the mapping verification before the run can start.

## Run (▶ Run)

1. **Setup wizard**: date, change/exercise ID, participants and chairs, direction, mapping verification (who and when), and a readiness checklist (backups, transfers, replication, approvals).
2. **Execute**: you can run the whole procedure from the keyboard.
   - `Enter` starts the focused step and jumps straight to the first thing that still needs doing in it: a checklist item, a value to record, a pass/fail, a sign-off.
   - `Enter` in a field saves it, and on a checkbox or button it ticks or clicks it, then moves to the next item. When nothing is left, focus lands on **Complete**.
   - `Enter` once more completes the step and moves to the next one, previewed under **Up next**.
   - `Shift+Enter` completes the step right away.
   - Other keys: `S` skip · `T` start or finish the countdown · `↑`/`↓` move between steps · `?` shows every key.
   - Several steps can run at once. Each gets its own live timer in **Active now**, and **Lanes** (`L`) shows one column per datacenter.
   - `I` logs an issue (paste screenshots with Ctrl+V). `N` adds an improvement note without leaving the step. `C` opens the comms log. `G` jumps to a step number.
   - **Forgot to press Start?** Click **✓ Already done**. The finish time is recorded and the timing is flagged *unreliable*. Adding the real start later marks it *entered afterward*.
   - A NO-GO decision halts the run, or jumps to a rollback section if you configure that.
3. **🏁 Finish**: milestones, remaining issues, outcome, who authorized completion, and lessons learned. Lessons are pre-filled from the notes and issues captured during the run. Lessons flagged *check next run* appear on that step next time with a "did it work?" prompt.

### Wait / countdown timers

- **Auto-start**: a countdown can start by itself when its step starts. This is the default, and the **⏳ Wait** step tile works this way.
- **Finishing early**: completing a step while its countdown is still running asks first, showing the time left. Esc keeps waiting; Enter finishes early.
- **Must run to the end**: with this option on (the default for the Wait step tile), finishing early or skipping a never-started countdown needs a reason.
- **Records**: early finishes and skips, with the time left and the reason, go into the run log and the run report.
- **When it hits zero**: it beeps, sends a desktop notification and prompts you to press Enter to continue.

## Concurrent chairs

Split any procedure between chairs that work at the same time, for example a 1st chair on the core failover and a 2nd chair on vendors and other parties.

- **Turn it on and assign work**: ⚙ Settings → 👥 Chairs turns it on and names the chairs. Assign a whole section to a chair (section inspector), or individual steps (step inspector → Chair, or Ctrl+click several steps). Steps with no chair are shared.
- **Handoffs**: set **Waits for** on a step and pick another chair's step. It shows "Waiting on …" until that step is done; starting early needs an override, which is recorded.
- **In the run**: each operator picks their chair when they open it and only sees their own steps plus shared ones. The run bar toggles All / 1st / 2nd, and the left panel shows every chair's progress.
- **Sign-off**: each chair signs off its own track. The master run can only be completed once every chair has signed off. An emergency override exists; its reason goes in the report.

## Console view

Use the **Console** component, or set a Command's *Show as* to **Console window**, to show text exactly as it appears in the terminal: dark window, spacing kept, expected output dimmed. **Copy commands** copies only the lines that start with the prompt (with the prompt stripped). **Copy all** copies everything, and clicking a single line copies that line. In any Instructions text, wrapping lines in ``` fences also renders them as a console box with a Copy button.

## Member impact (system down → back up)

- **Mark the boundaries**: select a step and set **Member impact** in the inspector to *Members impacted once this step completes / starts* or *Service restored once this step completes / starts*. You can also drag in the **🔴 System down** or **🟢 System back up** step tiles at the right spot, e.g. after step 12 and after step 36.
- **While members are impacted**, the runner and the live dashboard show:
  - a red **impact timer**;
  - a **progress bar toward the restore step** (steps done of steps remaining to get back online);
  - the restore ETA;
  - the step currently being worked.
  Once service is back, they turn green and show the total impact time.
- **Unplanned outages**: ⋯ → *Declare members impacted now* / *Declare service restored now*.
- **Roadblocks**: ⋯ → *Log a roadblock*, or tick 🚧 on any issue. The live dashboard shows it with its own timer until it's resolved, then how long it held you up.
- The run report gets a **Member impact & roadblocks** section, with every interruption, total impact and roadblock time.
- **Comms**: the *Members impacted* and *Systems available* templates trigger on these markers.

## Approvals (✍)

- **Who approves**: ⚙ Settings → ✍ Approvals. Name approvers, and/or tick run chairs whose people approve; by default that's the **Approver** chair the manager picks at run setup.
- **Automatic requests**: when a step with a **Sign-off** or **Go / No-Go** starts, the approvers are asked automatically.
- **Notifications**: approvers get a desktop notification and a **✍ approvals** badge in the top bar, wherever Procedure Runner is open. They approve, reject, or give GO / NO-GO from their own screen. The operator sees *Waiting for …* with a running timer, **🔔 Remind**, and **Copy for Teams / email**.
- **Approver at setup**: if a procedure has any sign-off or Go / No-Go steps, run setup asks *Approver(s) for this run* and won't start until one is named. Practice runs can leave it empty and approve their own steps. During a run, ⋯ → *Approvers…* (or **Assign approver…** on a waiting step) changes who approves, and waiting requests move to the new approver.
- **Ad-hoc approvals**: press `A`, or ⋯ → *Require approval for this step*, to add an approval layer to any step. That step then waits for an approver.
- **Required, can't be bypassed** (on for the failover template):
  - a run can't start without an approver;
  - only an approver can decide, signed as themselves, and never on their own request;
  - steps waiting on approval can't be completed anyway or skipped;
  - the run can't be closed out until an approver approves the close-out.
- **Without enforcement**: anyone can sign, operators can record a verbal approval, and steps can go ahead without approval. The bypass is recorded.
- **Records**: every request, who decided, how long it waited and any comment are in the run report's **Approvals** section and the audit log. The live dashboard shows what's waiting.
- **Limit**: approver identity is the name set with 👤, which isn't a sign-in. Separation of duties holds as long as people use their own name.

## Communication plan (📣)

The **Comms** page belongs to the communicator/manager. List the names under *Who can send*; everyone else sees what was sent but can't compose.

- **Audiences**: IT Teams, Leadership and Whole Organization by default, each with To/Cc distribution lists. You can add more.
- **Templates**: 12 ready-made messages, from the advance notice and IT briefing through start, Go/No-Go, progress every N minutes, issue, paused, "systems available", complete, rolled back and the post-run summary. Each has a subject, headline, a *key facts* table and a body. All of them accept variables such as `{{window.start}}`, `{{progress.pct}}`, `{{eta}}`, `{{decision.result}}`, `{{issues.latest}}` and `{{live.url}}`.
- **Per procedure**: ⚙ Settings → 📣 Comms plan chooses which templates apply and when they trigger. For example, *Systems available* fires when a specific step is completed.
- **During a run**: the **📣 Updates** tab flags messages as **Due** when their trigger happens. Each message is rendered as a branded, Outlook-safe email. You can:
  - **Copy for Outlook**: paste into a new email.
  - **Outlook draft (.eml)**: opens as a ready-to-send draft.
  - **mailto**.
  - **Copy for Teams**.

  Every send is logged with time, audience and sender, and appears in the run report.

## Follow along (📺)

`#/live/<run>` is a read-only, auto-refreshing view for teammates, leadership, or a war-room screen. It shows what's happening now per datacenter, phase progress, ETA, open issues and the latest update sent. Use **📺 Follow** in the runner to open it and copy the link. IT and leadership emails can include a *Follow along live* button.

## App icon & desktop shortcut

Run **`Install_Desktop_Shortcut.bat`**. It asks for the server address and puts a **Procedure Runner** shortcut, with the app icon, on the desktop. The shortcut opens the app in its own Edge window, which teammates can pin to the taskbar. Icons are in `app/icons/`: SVG, PNG sizes, and `ProcedureRunner.ico`.

## Branding

The app follows the brand guide:
- Anchor Gray `#53575a` and Vivid Blue `#00b2e3` as the primary colours.
- Click-me Green `#6abf4b` for call-to-action buttons (Start / Complete / Send).
- The brand's semantic colours for alerts.
- Open Sans (bundled, so it works offline) with ExtraBold headings.
- The blue line and angled notch as signature elements.

Light and dark modes are available from the ☾ / ☀ button. You can upload a white logo on the Comms page to show it in the header.

## Compare runs

On a run report, **⇄ Compare with previous** shows what was different from the last run of the same procedure. In History, the ⇄ button on any run does the same, and the dropdowns at the top let you pick any two runs. The comparison covers:
- a plain-English *What was different* summary;
- side-by-side totals: duration, member impact, issues, roadblocks, timing quality, direction, version;
- the biggest step timing changes and phase durations;
- issues that were new, repeated, or didn't come back;
- validations and decisions that changed outcome;
- steps added, removed or edited between procedure versions;
- whether last run's improvements worked.

It's printable to PDF.

## Export a procedure to PDF

Use **📄 PDF** in the builder, or **⋯ → Export PDF** on a library card. Choose the version, then **Save as PDF**. The suggested file name is *Procedure name - version - date - last modified by Name*, ready for the SharePoint procedures folder. The document includes:
- environments and the role mapping for both directions;
- chairs, readiness checklist, milestones and member-impact markers;
- every step with its details and a checkbox.

## Word import & export

**Import** (New procedure ▾ → *From Word…*) maps an existing Word procedure into steps:

| In the Word document | Becomes |
|---|---|
| Headings, or a short bold line that introduces a list | Sections |
| Top-level numbered or bulleted items | Steps. Long items get their first sentence as the title and keep the full text as details. |
| Deeper list levels | Bullets inside the step |
| A short bold line followed by text or code (e.g. *Token endpoint :-*) | A step with that title |
| `NOTE!` / `IMPORTANT!` / `TIP!` / `KNOWN ISSUE:` / `WARNING!` paragraphs | Callouts |
| Consolas or Courier text, `curl …`, PowerShell and similar | Console blocks with copy |
| Tables | Table components |
| Screenshots | Screenshot components. EMF/WMF images can't be shown in a browser, so a note marks where to paste a replacement. |
| Bold, italic, hyperlinks, Wingdings arrows (à → →) | Kept |
| Header fields such as *Index*, *Rev. Date*, *Rvw. Date* | The procedure description |

The preview lets you choose where steps come from: top-level items (the default), every list item, or one step per heading. Text that isn't a step is kept on the nearest step, so nothing is dropped. Old `.doc` files need *Save As .docx* in Word first.

**Export**: use **W Word** in the builder, **⋯ → Export Word (.docx)** on a library card, or **⇩ Word (.docx)** on the PDF page. The file has the same name as the PDF (*Procedure name - version - date - last modified by Name*). The layout matches the department's controlled documents:
- a grey header band with the team, procedure title, version, revision date and who last modified it;
- a details table and contents list;
- environments, chairs, run setup and member impact;
- numbered steps with checkboxes and a details line (target, chair, owner, estimate);
- console boxes, callouts, tables and screenshots;
- a *Page X of Y* footer.

It is a normal Word file, so people can comment on it or edit it there. The procedure itself also rides along inside the file. Re-importing an export that hasn't been edited offers **Restore exactly as exported**, which brings back environments, chairs, decisions and timers. If someone edited it in Word, **Rebuild from the Word text** picks up their changes.

## Records

- **📄 Report** (per run, printable and exportable to CSV/JSON) covers run setup, environment verification, readiness, step execution and timing source, parallel operations with a timeline, problems and exceptions with evidence, communications, critical decisions, validations, final completion, lessons learned, captured values, and the full audit log.
- **📈 History** (per procedure): all runs, the slowest steps across runs, section durations, timing quality, and the lessons board.

## Files

```
index.html              app shell
app/js/                 util, store (local + server), model, blocks (components), ui,
                        templates, importer, app (library), builder, runner, report
app/js/comms.js         communication plan, composer, Comms page
app/js/live.js          follow-along view
app/js/print.js         procedure PDF and run comparison
app/js/word.js          Word (.docx) import and export, no libraries
app/css/app.css         styles (brand-aligned, light + dark)
app/fonts/              Open Sans (SIL Open Font License)
app/icons/              app icon set (.svg, .png, .ico)
Install_Desktop_Shortcut.bat / tools/Install-Shortcut.ps1
server.py               team server (Python 3.8+, stdlib only)
data/                   created at runtime — procedures, runs, evidence (not in git)
```
