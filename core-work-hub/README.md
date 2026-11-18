# Core Work Hub

One Kanban board for every IT Core work item from Service Desk Plus and Wrike. Rank work, limit work in progress, and see each analyst's load at a glance. It runs from the team's shared folder in Edge: no server, no install, nothing to host.

**Status:** Phase 0 is built (board, intake and grading, triage, analyst view, WIP limits, audit log, CSV import), plus Phase 1's sync script and an early Metrics view with CSV exports. The sync scripts are written but **have not been run against Service Desk or Wrike** (see [What hasn't been tested](#what-hasnt-been-tested)).

## What's in the folder

```
core-work-hub/
  release/index.html     the built app: copy this to the shared folder
  deploy/hub-config.json starter config (people, roles, WIP limits, SAMPLE ownership map)
  sync/                  PowerShell 7 scripts for Nick's PC (Service Desk sync, task registration, Wrike check)
  src/                   React + TypeScript source (Vite single-file build, dnd-kit)
  tests/                 unit tests (vitest) and a multi-user browser test (Playwright)
```

## How it works

```
\\server\share\CoreWorkHub\
  index.html            the app (one self-contained file; fonts and code inlined)
  hub-config.json       people, roles, WIP limits, ownership map, dispatch rotation (Nick edits)
  tickets.json          Service Desk snapshot. Only the sync script or Nick's CSV import writes it
  changes\nick.jsonl    one append-only file per person; each line is one move, grade, rank or comment
  changes\wes.jsonl
  ...
```

- **Reading tickets:** `sync/Sync-ServiceDesk.ps1` runs on Nick's PC every 15 minutes in business hours and writes `tickets.json`. The token stays in Windows Credential Manager on that PC. Until then, Nick imports a Service Desk CSV export in **Settings → Ticket data**.
- **Saving changes:** each browser writes only to its own person's change file, so two people working at once never write the same file.
- **Seeing others' changes:** every 20 seconds (and when the tab regains focus) the page re-reads `tickets.json` and every change file, then replays all changes in time order. When two people re-rank the same list, the later change wins. The change files are the audit log.
- **Sync rules:** new source tickets land in Intake. A ticket closed in Service Desk moves to Done. The sync never touches hub fields (bucket, rank, grade, WIP state). If Service Desk changes the technician or priority *after* the hub set it, the Service Desk value is kept and the conflict is listed under **Audit log → Sync conflicts**.
- **Permissions:** checked when changes are replayed, using the *file name* (not anything written inside the file). Matt's (viewer) changes and changes from unknown names are ignored and flagged in the audit log. The real lock is NTFS: Matt gets read-only on the folder.
- **Identity:** on first open each person picks their name. Their changes go to `changes/<username>.jsonl`. This is honor-system within the team, backed by NTFS: the file owner on disk shows who actually wrote each file.

### Screens

| View | What it does |
|---|---|
| **Board** (home, Concept A) | Needs-you tiles (waiting for acknowledgment, no owner, ready to close), bucket switcher, swimlanes, filters by analyst/priority/system/source. Drag between columns; drag within a bucket's To Do to re-rank. Each card's ⋯ menu offers "Move to…" for keyboard and touch users. |
| **Intake → Triage and rank** (Concept C) | Intake queue on the left, ranked To Do on the right. One-click bucket and 1–5 impact/urgency/effort; live score `(impact × urgency) ÷ effort` and suggested priority; owner suggested from the ownership map, alternating primary and secondary. **Send to To Do** shows the rank it will get. Capacity strip shows Doing slots vs WIP limit. Shortcuts: **J/K** move, **1–4** priority, **Enter** send. |
| **My work** | Everything you own, by column; acknowledge assignments; log time against the capacity buckets. |
| **Team** | One row per analyst: Doing vs WIP limit, To Do queue, overdue updates, unacknowledged items, dispatcher/backup badge, and hours vs the capacity model. |
| **Metrics** | Open by bucket × priority, opened vs closed per week, average age, overdue updates, cycle time, throughput per analyst. CSV exports (items, weekly, time) for Power BI. |
| **Audit log** | Every change with who, when, and before → after; sync conflicts; ignored changes; CSV export. |
| **Settings** | CSV import, WIP limits (per analyst, per analyst per bucket, per team bucket), dispatch rotation, ownership map. Nick edits; everyone else reads. |

Score → suggested priority: ≥15 P1, ≥8 P2, ≥3 P3, otherwise P4. When a card enters Doing or Waiting without a next-update date, it gets one `defaultUpdateDays` (2) days out.

## Setup

### Day one: three checks before anything else

1. **Edge folder access.** Copy `release/index.html` and `deploy/hub-config.json` into the shared folder. Open `index.html` in Edge on a team PC → **Choose the shared folder** → pick that folder → allow edits. Move a card, then check that `changes\<you>.jsonl` appeared. If company policy blocks this, the fallback is a Power Apps code app or SharePoint, to be decided with Lee.
2. **Service Desk token.** On Nick's PC:
   ```powershell
   cmdkey /generic:CoreWorkHub-SDP /user:token /pass:<read-only technician key>
   pwsh -File sync\Sync-ServiceDesk.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://<sdp host>' -Groups '<Core queue 1>','<Core queue 2>' -Test
   ```
   `-Test` reads one page of open requests and writes nothing. Use `-Edition Cloud` if the instance is Zoho-hosted (OAuth token).
3. **Wrike license.**
   ```powershell
   cmdkey /generic:CoreWorkHub-Wrike /user:token /pass:<permanent token>
   pwsh -File sync\Test-WrikeAccess.ps1
   ```
   If any check fails, v1 ships with Service Desk only and Wrike items are entered by hand (**New work → Wrike task**).

### Configure

Edit `hub-config.json` in the shared folder:
- `people[].username`: replace the placeholders with real **Windows usernames**. Add `sdName` if the Service Desk technician name differs from `name`.
- `systems`: the sample ownership map is placeholder data. Replace it with the real map (or edit it in Settings).
- `wipLimit` per analyst (starts at 2), `capacityModel` (weekly hours per bucket, from the communication standards), `closedStatuses` and `resolvedStatuses` to match your Service Desk statuses.

### Folder permissions (NTFS)
- IT Core group: **Modify** on the folder.
- Matt: **Read & execute** only.
- No one else.

### Phase 1: turn on the sync
```powershell
pwsh -File sync\Register-SyncTask.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://<sdp host>' -Groups '<Core queue 1>','<Core queue 2>'
```
This runs every 15 minutes, 7:00–18:00, Monday–Friday, as Nick. It logs to `%LOCALAPPDATA%\CoreWorkHub\sync.log`.

### Try it without the shared folder
Open `index.html?demo` (or click **Try it with demo data**). Sample data lives only in that browser. Open two tabs as different people to watch live updates.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests: replay, ranking, sync rules, permissions, WIP, CSV
npm run contrast   # WCAG AA check of every color token pair, light and dark
npm run build      # typecheck + single-file build -> release/index.html
npm run e2e        # multi-user browser test (serve dist/ on :4173 first, see the file header)
```

`index.html` is ~590 KB with fonts inlined and makes no network requests.

## Acceptance criteria (v1, phases 0–1)

| Criterion | Status |
|---|---|
| Open Core SD tickets appear within 15 min | Sync script written and scheduled every 15 min. **Not run against Service Desk yet.** |
| Drag between columns and re-rank; everyone sees it within 30 s | Done. Polls every 20 s. Browser test: a second user saw a move in 20.0 s. |
| To Do ranks unique per bucket | Done. Ranks are derived positions (1..n) from sort keys, so ties can't happen. Unit-tested. |
| Past a WIP limit: warning plus logged override | Done. Nick must give a reason, which is stored in the change file. Analysts are blocked and told to ask Nick. |
| Analyst view: all six, Doing vs limit, overdue updates | Done (Team view). |
| Light and dark mode pass WCAG AA | Done for every token pair (`npm run contrast`, lowest 4.97:1). Touch targets 44 px; real buttons and labelled inputs. |
| Only IT Core can change files; Matt read-only | NTFS setup step (above). The app also treats Matt as read-only and ignores any viewer changes. |
| Every change appears in the audit log | Done. The change files are the log. Browser test: 10 of 10 changes shown. |
| No API token in the shared folder, code or page | The token is read only from Credential Manager on Nick's PC. The page never needs it. |

## What hasn't been tested

- **The PowerShell scripts.** PowerShell wasn't available in the build environment. `Sync-ServiceDesk.ps1` follows the SDP v3 `list_info` / `search_criteria` format, but the exact field names (for example `status.in_progress`, `completed_time`, `display_id`) can differ by edition and version. Run `-Test` first.
- **Edge on the real network share.** Browser tests used Chromium's private file system, which has the same API as the shared folder. Network-share behavior and company policy are the day-one check above.
- **Clock skew.** Changes are ordered by each PC's clock. Domain-joined PCs sync time, so this should be fine.

## Assumptions to confirm

- Item IDs for synced tickets are `SD:<ticket number>` (stable across every browser with no coordination), not random UUIDs. Hub-entered items use UUIDs.
- Grading and ranking are manager-only by default. Set `"analystsCanGrade": true` to let the team grade from any seat.
- "Ready to close" means resolved in Service Desk (not yet closed), or every task under the item is done.
- Moving an SD item to Done in the hub doesn't close the ticket. Triage's **Close** reminds you to close it in Service Desk. Write-back waits for an approved server (v2).
- Calendar maintenance work is entered with **New work → Hub only** (open question in the scope).
