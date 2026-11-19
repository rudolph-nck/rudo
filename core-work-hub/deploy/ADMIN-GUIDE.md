# Core Work Hub — Administrator Setup Guide

For the person setting up the hub for IT Core (shared folder, permissions, Service Desk API key, scheduled sync, Teams). Allow about an hour. Nothing is installed on users' PCs and nothing is hosted: the hub is one web page in a shared folder, opened in Microsoft Edge.

---

## 1. What's in the package

```
CoreWorkHub-v1.x/
  CoreWorkHub/                 ← copy this folder to the shared drive
    index.html                 the app (one self-contained file, no internet needed)
    hub-config.json            settings: people, roles, rotation, standards (edit this)
    changes/                   each person's change file is created here automatically
  Setup/
    ADMIN-GUIDE.md             this guide
    USER-GUIDE.md              one page for the team
    sync/Sync-ServiceDesk.ps1  reads Service Desk every 15 minutes (runs on one PC)
    sync/Register-SyncTask.ps1 schedules it in Task Scheduler
    sync/Test-WrikeAccess.ps1  checks whether the Wrike license allows API access
```

**How it works:** every browser reads `tickets.json` (written by the sync) and every file in `changes/`, every 20 seconds. Each person's browser writes only to their own `changes/<username>.jsonl`. No database, no server.

## 2. Requirements

| Item | Detail |
|---|---|
| Browser | Microsoft Edge (Chromium) 122 or later on every user's PC |
| Shared folder | A folder on an internal file share the IT Core team can reach |
| Sync PC | One always-on-during-business-hours Windows PC (Nick's) with **PowerShell 7** (`winget install Microsoft.PowerShell`) |
| Service Desk | A **read-only** API key for a dedicated technician account that can view the Core group queues |
| Teams (optional) | Each person's work email (Teams sign-in), and a link to the team channel |
| Wrike (optional) | A permanent API token, if the license allows API access |

## 3. Create the shared folder and set permissions

1. Create the folder, e.g. `\\fileserver\IT\CoreWorkHub`.
2. Set NTFS permissions (replace the group and account names):

```powershell
$path = '\\fileserver\IT\CoreWorkHub'
icacls $path /inheritance:r
icacls $path /grant:r 'DOMAIN\IT-Core:(OI)(CI)M'        # team: modify
icacls $path /grant:r 'DOMAIN\matt.username:(OI)(CI)RX' # Matt: read only
icacls $path /grant:r 'DOMAIN\Domain Admins:(OI)(CI)F'  # admins
icacls $path
```

Nobody else needs access. The folder's normal backup covers the hub; `changes/` files are append-only, so history is never overwritten.

## 4. Copy the app and configure it

1. Copy the **contents** of `CoreWorkHub/` from the package into the shared folder.
2. Open `hub-config.json` in Notepad (or VS Code) and fill in the fields below. Keep it valid JSON (commas, quotes). Nick can change most settings later in the app (WIP limits, rotation, time off, ownership map); people and roles are only changed here.

| Field | What to put |
|---|---|
| `people[].username` | The person's **Windows username** (as in `DOMAIN\username`). It names their change file. Use lowercase. |
| `people[].name` | Display name (what they pick from the list on first open). |
| `people[].role` | `manager` (Nick), `analyst`, or `viewer` (Matt: read-only). |
| `people[].works` | `true` for a manager who also takes tickets (Nick). |
| `people[].sdName` | Their name exactly as it appears as *Technician* in Service Desk, e.g. `"Wesley Wilson"`. |
| `people[].email` | Work email / Teams sign-in, for “Message in Teams” buttons. |
| `people[].wipLimit` | Items allowed in Doing at once (start at 2). |
| `systems` | Ownership map: system name, Service Desk sub-categories (`aliases`), primary/secondary/third owner usernames. |
| `rotation` | Level 1 support order, shift length (`week`, `2weeks`, `month`), who is on now and their last day, escalation (`nick`), anyone out. |
| `ticketUrls.SD` | Link pattern to open a ticket. Open any ticket in Service Desk, copy its address, and replace the number with `{num}` (digits only, e.g. 79744) or `{id}` (full ID, e.g. INC-79744). |
| `teamsChannelUrl` | In Teams: channel → **⋯** → **Get link to channel**. Used by “Post digest to Teams”. |
| `commStandard.holidays` | Business holidays as `"YYYY-MM-DD"`. The communication-standard clock pauses on these. |
| `commStandard.enforceFrom` | **Go-live date** (`"YYYY-MM-DD"`). Response and update clocks start no earlier than this, so tickets that went quiet before the hub existed don't all escalate on day one. Set it to the day the team starts using the hub. |
| `people[].aliases` | Other spellings of the person's name in Wrike or other exports (e.g. `["Catherine Garcia"]`). The import screen adds these for you when you match names. |
| `closedStatuses`, `statusColumns` | Already set for the Core report’s statuses. Change only if Service Desk statuses change. |

The other `commStandard` values encode the IT Core Team Communication Standards (first response P1 2 business hours / 1 business day; updates P1 every 2 business hours / weekly; requester follow-ups 48 h; escalation to support after 1 business day, to Nick after 2). Change them here if the standard changes.

## 5. Check that Edge can use the folder (day-one test)

1. On a team PC, open `\\fileserver\IT\CoreWorkHub\index.html` in Edge.
2. Click **Choose the shared folder**, select the CoreWorkHub folder, and **Allow** edits (tick “Allow on every visit” if offered).
3. Pick your name, drag any card, and confirm `changes\<your username>.jsonl` appears in the folder.

**If Edge blocks it:** the File System Access API is controlled by Edge policies. Ask the endpoint team to allow it for the hub’s address, using the policies `FileSystemReadAskForUrls` and `FileSystemWriteAskForUrls` (add `file:///` or the hub’s exact `file://` address), or set `DefaultFileSystemReadGuardSetting` / `DefaultFileSystemWriteGuardSetting` to **Ask (3)**. Confirm current policy names in Microsoft’s Edge policy reference. If folder access can’t be allowed, the fallback is hosting the same page on SharePoint or as a Power Apps code app (decide with Security).

## 6. Service Desk API key (read-only) — on the sync PC only

The key is stored in **Windows Credential Manager on the sync PC**. It is never written to the shared folder, the page, or the code.

1. **Create a dedicated technician** in Service Desk Plus (e.g. “Core Hub Sync”) with a role that can **only view** requests in the Core group queues. No edit, close, or admin rights.
2. **Generate its API key:**
   - *On-premises SDP:* sign in as that technician (or as an admin) → **Admin → Technicians** → edit the technician → **Generate API Key** (set an expiry per policy). Copy the key.
   - *SDP Cloud (Zoho):* create an OAuth self-client in the Zoho API Console for scope `SDPOnDemand.requests.READ`, generate a token, and use `-Edition Cloud`. Token refresh may need an extra step; ask the Service Desk admin.
3. **Store it** on the sync PC, signed in as the account the scheduled task will run as:

```powershell
cmdkey /generic:CoreWorkHub-SDP /user:token /pass:<the API key>
```

4. **Test it** (reads one page of open Core requests; writes nothing):

```powershell
cd <package>\Setup\sync
pwsh -File .\Sync-ServiceDesk.ps1 -HubFolder '\\fileserver\IT\CoreWorkHub' `
     -BaseUrl 'https://servicedesk.yourcompany.com' -Groups 'Core Team' -Test
```

You should see “TEST: OK — N open requests visible” and sample subjects. The Core report’s group is **Core Team**; add other queue names if Core owns more.

5. **Run it once for real** (same command without `-Test`) and check that `tickets.json` appears in the shared folder. Open the hub: tickets appear within 20 seconds.

The sync also reads each open ticket’s first-response time and its latest requester-visible note (one extra API call per open ticket), so the hub can enforce the communication standard. Add `-SkipNotes` if the API is rate-limited.

**To rotate the key:** generate a new one, run the `cmdkey` line again, done.

## 7. Schedule the sync

```powershell
pwsh -File .\Register-SyncTask.ps1 -HubFolder '\\fileserver\IT\CoreWorkHub' `
     -BaseUrl 'https://servicedesk.yourcompany.com' -Groups 'Core Team'
Start-ScheduledTask -TaskName 'Core Work Hub - Service Desk sync'
```

Runs every 15 minutes, 7:00–18:00, Monday–Friday, as the current user. Log: `%LOCALAPPDATA%\CoreWorkHub\sync.log`. If the sync PC is off, the hub keeps working on the last snapshot; Nick can also import a CSV in **Settings → Ticket data**.

## 8. Wrike (optional)

**Today (no API):** in Wrike, export the Projects view to Excel, then in the hub go to **Settings → Ticket data**, choose **Wrike export**, and pick the `.xlsx`. The hub reads each project’s Wrike ID from its link, skips group-heading rows and cancelled projects, and matches assignees (save any new name matches once). Re-import whenever the Wrike list changes; hub grades and ranks stay attached by Wrike ID.

**API check:**

```powershell
cmdkey /generic:CoreWorkHub-Wrike /user:token /pass:<permanent token>
pwsh -File .\Test-WrikeAccess.ps1
```

If any check fails, the license limits the API: Wrike items are entered by hand in the hub (**New work → Wrike task**).

## 9. Teams

- **Message in Teams / Nudge** buttons open a Teams chat with the message already typed; the sender presses Send. Needs `email` for each person.
- **Post digest to Teams** copies a summary of late or escalated updates and opens `teamsChannelUrl` to paste it.
- **Fully automatic posts** (no click) need a Teams *Workflows* webhook plus something to call it, e.g. a future step in the sync script. Not set up in v1.

## 10. First run

1. Nick opens the hub, chooses the folder, picks his name, and imports the first **Core - All** CSV in **Settings → Ticket data** (skip if the sync already ran). He confirms the technician name matches.
2. Each team member opens the same `index.html` address in Edge, allows the folder once, and picks their name from the list. The choice is remembered on that PC. “Not you?” in the sidebar changes it (with a confirmation).
3. Matt does the same; he sees everything read-only.
4. Bookmark the hub or set it as Edge’s start page.

## 11. Updating the app

Replace **only** `index.html` in the shared folder with the new one. `hub-config.json`, `tickets.json` and `changes/` stay as they are; everyone’s board picks up the new version on their next reload.

## 12. Data, privacy and security

- **Stored:** ticket metadata only (ID, subject, status, technician, dates, SLA, department, sub-category). No descriptions or notes. Card/account-number patterns in subjects are masked.
- **Token:** only in Credential Manager on the sync PC; read-only technician.
- **Access:** NTFS on the folder (IT Core modify, Matt read).
- **Identity:** people pick their name from a fixed list (honor system); every change file’s owner on disk also shows who wrote it, and the **Audit log** shows every change with before → after.
- **Backups:** covered by the share’s backup. Size grows slowly (a few MB a year).

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| “Open this page in Microsoft Edge” | It was opened in another browser. Use Edge. |
| Folder prompt every time | Choose “Allow on every visit”; or the Edge policy resets permissions (see step 5). |
| “Could not save your change” | The person lacks Modify on the folder (Matt is read-only by design). |
| No tickets / stale tickets | Check `%LOCALAPPDATA%\CoreWorkHub\sync.log` on the sync PC; run the sync with `-Test`. |
| Sync error 401/403 | Key expired or the technician lacks view rights to the queue. Regenerate / fix the role, rerun `cmdkey`. |
| Owner shows initials only | That Service Desk technician isn’t matched to a hub person: set `sdName`, or match it in the import screen. |
| Wrong ticket links | Fix `ticketUrls.SD` (`{num}` vs `{id}`). |
| Clock seems off on holidays | Add the date to `commStandard.holidays`. |
| A line in the Audit log says “Ignored” | Someone without permission tried a change (e.g. a viewer), or a change file was edited by hand. |
