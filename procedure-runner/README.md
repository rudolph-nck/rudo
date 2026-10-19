# Core Team Procedure Runner

Build runbooks like web pages (drag-and-drop steps and components), then run them step by step. Every run records who did what, timing, issues, communications, decisions, validations, and lessons learned. It's built for long Symitar procedures (100–200 steps), including **direction-aware datacenter failovers**.

No install and no build step. It's plain HTML/JS plus a small Python server from the standard library.

## Start it

| How | What you get |
|---|---|
| Double-click **`Start_ProcedureRunner.bat`** | Team server on port 8000. Your browser opens it. Teammates open `http://<your-pc-name>:8000/`. Data is saved in `.\data`. |
| `py server.py --data I:\Core\Procedures\ProcedureRunner\data` | Same, with data on the shared drive. |
| Open `index.html` directly | **Local mode**: data stays in this browser only. Good for drafting; use Export/Import JSON to move work. |

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

## How failover direction works

Steps target a **logical role**, not a city. At run setup you pick the direction (e.g. *Main → DR* or the reverse). Every step then shows a banner with:

| Datacenter (physical) | HMC partition (fixed to the site) | Logical role (changes after cutover) |
|---|---|---|

Sections or steps marked *after cutover* switch the role labels to New Primary / New Secondary. The hostname follows the role (DNS) and the partition label stays with the datacenter. A second person records the mapping verification before the run can start.

## Run (▶ Run)

1. **Setup wizard**: date, change/exercise ID, participants and chairs, direction, mapping verification (who and when), and a readiness checklist (backups, transfers, replication, approvals).
2. **Execute**: `Enter` starts the focused step and `Enter` again completes it. The next step is focused automatically and previewed under **Up next**.
   - Several steps can run at once. Each gets its own live timer in **Active now**, and **Lanes** (`L`) shows one column per datacenter.
   - `I` logs an issue (paste screenshots with Ctrl+V). `N` adds an improvement note without leaving the step. `C` opens the comms log. `G` jumps to a step number.
   - **Forgot to press Start?** Click **✓ Already done**. The finish time is recorded and the timing is flagged *unreliable*. Adding the real start later marks it *entered afterward*.
   - A NO-GO decision halts the run, or jumps to a rollback section if you configure that.
3. **🏁 Finish**: milestones, remaining issues, outcome, who authorized completion, and lessons learned. Lessons are pre-filled from the notes and issues captured during the run. Lessons flagged *check next run* appear on that step next time with a "did it work?" prompt.

## Records

- **📄 Report** (per run, printable and exportable to CSV/JSON) covers run setup, environment verification, readiness, step execution and timing source, parallel operations with a timeline, problems and exceptions with evidence, communications, critical decisions, validations, final completion, lessons learned, captured values, and the full audit log.
- **📈 History** (per procedure): all runs, the slowest steps across runs, section durations, timing quality, and the lessons board.

## Files

```
index.html              app shell
app/js/                 util, store (local + server), model, blocks (components), ui,
                        templates, importer, app (library), builder, runner, report
app/css/app.css         styles (light + dark)
server.py               team server (Python 3.8+, stdlib only)
data/                   created at runtime — procedures, runs, evidence (not in git)
```
