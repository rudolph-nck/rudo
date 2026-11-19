# Core Work Hub — Administrator Setup Guide

For the person setting up the hub for IT Core (shared folder, permissions, Service Desk API key, scheduled sync, Teams). Allow about an hour. Nothing is hosted: the hub is one web page in a shared folder. Each person opens it from a **desktop icon** that starts a small Python helper on their own PC; the helper reads and writes the shared folder for the page. (Opening the page directly in Edge still works as a fallback, see step 5b.)

---

## 1. What's in the package

```
CoreWorkHub-v1.x/
  CoreWorkHub/                 ← copy this folder to the shared drive
    index.html                 the app (one self-contained file, no internet needed)
    Core Work Hub.bat          starts the hub (what the desktop icon runs)
    Install desktop icon.bat   each person double-clicks this once
    app/hub_server.py          the local helper (Python standard library only)
    app/Install-DesktopIcon.ps1, app/CoreWorkHub.ico
    hub-config.json            settings: people, roles, rotation, standards (edit this)
    changes/                   each person's change file is created here automatically
  Setup/
    ADMIN-GUIDE.md             this guide
    USER-GUIDE.md              one page for the team
    sync/Sync-ServiceDesk.ps1  reads Service Desk every 15 minutes (runs on one PC)
    sync/Connect-ZohoServiceDesk.ps1  one-time Zoho sign-in (Service Desk Plus Cloud only)
    sync/Register-SyncTask.ps1 schedules it in Task Scheduler
    sync/Copy-ExportToHub.ps1, Register-ExportCopyTask.ps1   interim: hourly export from SharePoint → hub
    sync/Test-WrikeAccess.ps1  checks whether the Wrike license allows API access
```

**How it works:** the desktop icon runs `app\hub_server.py` from the shared folder with the PC's Python. It listens only on `127.0.0.1` (the PC itself, not the network), opens the hub in Edge, and does the file work: it reads `tickets.json` (written by the sync) and every file in `changes/` every 20 seconds, and appends the person's changes to `changes\<Windows username>.jsonl`. The **Windows sign-in** decides who you are, so nobody picks a name. No database, no shared server; the helper stops by itself after 30 minutes with no hub tab open.

## 2. Requirements

| Item | Detail |
|---|---|
| Python | **Python 3.8 or later** on every user's PC (`python --version`). Standard library only: no `pip install`. Either the python.org installer or the Microsoft Store version works. |
| Browser | Microsoft Edge (any current version) |
| Shared folder | A folder on an internal file share the IT Core team can reach |
| Sync PC | One always-on-during-business-hours Windows PC (Nick's) with **PowerShell 7** (`winget install Microsoft.PowerShell`) |
| Service Desk | **Cloud:** a Zoho Self Client with scope `SDPOnDemand.requests.READ` (step 6A). **On-premises:** a read-only technician API key (step 6B). |
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
| `people[].username` | The person's **Windows username** (as in `DOMAIN\username`), lowercase. The launcher signs people in with it and names their change file with it, so it must match exactly. To check: `echo %USERNAME%` on their PC. |
| `people[].name` | Display name. |
| `people[].role` | `manager` (Nick), `analyst`, or `viewer` (Matt: read-only). |
| `people[].works` | `true` for a manager who also takes tickets (Nick). |
| `people[].sdName` | Their name exactly as it appears as *Technician* in Service Desk, e.g. `"Wesley Wilson"`. |
| `people[].email` | Work email / Teams sign-in, for “Message in Teams” buttons. |
| `people[].wipLimit` | Items allowed in Doing at once (start at 2). |
| `systems` | Ownership map: system name, Service Desk sub-categories (`aliases`), primary/secondary/third owner usernames. |
| `rotation` | Level 1 support order, shift length (`week`, `2weeks`, `month`), who is on now and their last day, escalation (`nick`), anyone out. |
| `ticketUrls.SD` | Link pattern to open a ticket from a **CSV import**: `{num}` = digits only (e.g. 79744), `{id}` = full ID (e.g. INC-79744). On-premises: copy any ticket's address and put `{num}` in place of the number. Cloud ticket pages (`…/ui/requests/160433000056590076/details`) use a long internal ID that CSV exports don't include, and Cloud rejects the old `WorkOrder.do?woID=` link. For Cloud with CSV imports use `<Base URL>/ui/requests#cwhcopy={id}`: clicking a ticket link copies its number (e.g. INC-157761) and opens Service Desk's request list to paste it into search. The API sync builds exact links itself. |
| `teamsChannelUrl` | In Teams: channel → **⋯** → **Get link to channel**. Used by “Post digest to Teams”. |
| `commStandard.holidays` | Business holidays as `"YYYY-MM-DD"`. The communication-standard clock pauses on these. |
| `commStandard.enforceFrom` | **Go-live date** (`"YYYY-MM-DD"`). Response and update clocks start no earlier than this, so tickets that went quiet before the hub existed don't all escalate on day one. Set it to the day the team starts using the hub. |
| `people[].aliases` | Other spellings of the person's name in Wrike or other exports (e.g. `["Catherine Garcia"]`). The import screen adds these for you when you match names. |
| `closedStatuses`, `statusColumns` | Already set for the Core report’s statuses. Change only if Service Desk statuses change. |

**Levels and time split** (Settings → WIP limits / Weekly time split by level): give each analyst a level (Senior / Mid / Junior). The Team page compares their logged hours with that level's weekly split, and with the **support-week** split during their shift. Defaults (hours per ~40 h week, projects / maintenance / own tickets / support / documentation): Senior 16/8/10/2/4, Mid 12/8/12/4/4, Junior 4/8/14/8/6, Support week 2/4/8/20/6. Suggested Doing limits: Senior 3 (Project 1, Maintenance 1, Support 2), Mid 3 (same), Junior 2 (Project 1, Maintenance 1, Support 2), Nick 1; team Project limit 3. Whoever is on support can't pull a Project into Doing during the shift (Nick can override).

**Priority standard** (Settings → Priority standard; stored in the change files, so no file editing): P1–P4 first response, update cadence and target to resolve; the **start date** (older tickets become the backlog with a weekly clear-down goal instead of all going overdue at once); at-risk point, bump flag, and department idle days. Defaults: P1 1 hour / hourly / same day, P2 4 hours / daily / 3 days, P3 1 day / twice a week / 10 days, P4 1 day / weekly / 20 days.

The other `commStandard` values encode the IT Core Team Communication Standards (first response P1 2 business hours / 1 business day; updates P1 every 2 business hours / weekly; requester follow-ups 48 h; escalation to support after 1 business day, to Nick after 2). Change them here if the standard changes.

## 5. Install the desktop icon (each PC, once)

1. On the team member's PC, open the shared folder in File Explorer and double-click **Install desktop icon.bat**. A **Core Work Hub** icon appears on the desktop.
2. Double-click the icon. Edge opens the hub, already signed in as that person (from Windows).
3. Drag any card and confirm `changes\<their username>.jsonl` appears in the folder.

Notes:
- The installer runs PowerShell with `-ExecutionPolicy Bypass` for that one script only (it only creates the shortcut). If PowerShell is blocked, create the shortcut by hand: right-click **Core Work Hub.bat** → **Send to → Desktop (create shortcut)**.
- “You're not on the hub yet” means that Windows username isn't in `hub-config.json` `people`. Add it.
- If Python isn't found, the .bat shows a message. Install Python 3.8+ (tick “Add python.exe to PATH”) and try again.
- Security review (for Lee): the helper binds to `127.0.0.1` only, refuses requests from other websites (Origin check) and requests without the random per-launch key, can read only `hub-config.json`, `tickets.json` and `changes\*.jsonl`, and can write only `hub-config.json` / `tickets.json` (Nick's settings, imports) and the person's **own** change file. It holds no passwords or API keys. Log: `%LOCALAPPDATA%\CoreWorkHub\launcher.log`.

### 5b. Fallback: open the page directly in Edge (no Python)

1. Open `\\fileserver\IT\CoreWorkHub\index.html` in Edge.
2. Click **Choose the shared folder**, select the CoreWorkHub folder, and **Allow** edits (tick “Allow on every visit” if offered).
3. Pick your name from the list (remembered on that PC).

**If Edge blocks it:** the File System Access API is controlled by Edge policies. Ask the endpoint team to allow it for the hub’s address, using the policies `FileSystemReadAskForUrls` and `FileSystemWriteAskForUrls` (add `file:///` or the hub’s exact `file://` address), or set `DefaultFileSystemReadGuardSetting` / `DefaultFileSystemWriteGuardSetting` to **Ask (3)**. Confirm current policy names in Microsoft’s Edge policy reference.

## 5c. Interim (no API yet): automatic import of the hourly export

Until the API connection is approved, the hub can import the **Core - All** report export automatically. Anything that puts the file at `<hub folder>\import\Core - All.csv` works; whenever that file changes, the first open hub imports it (same rules as **Settings → Ticket data**: metadata only, numbers masked, technicians matched) and everyone sees it within about 20 seconds. **Settings → Ticket data → Auto-import** shows when it was last exported and imported, and warns if the file is over 3 hours old.

**Easiest:** point the hourly export at the hub's `import\` folder (or have the export script also copy it there).

**If the export must stay in SharePoint:** copy it across every 15 minutes from Nick's PC.

1. In SharePoint, open the folder with the export and click **Sync** (or **Add shortcut to My files**). In File Explorer, right-click the folder → **Always keep on this device**.
2. Copy the synced folder's path from File Explorer's address bar (or right-click the file → **Copy as path**). It looks like `C:\Users\nick\<Company>\<Site> - Documents\...`. With a folder, the task takes the newest `Core - All*.csv` in it (or, failing that, the newest CSV, and logs which one).
3. In a normal PowerShell window (Windows PowerShell is fine):

```powershell
cd <package>\Setup\sync
powershell -ExecutionPolicy Bypass -File .\Register-ExportCopyTask.ps1 `
  -Source 'C:\Users\nick\<Company>\<Site> - Documents\Exports' `
  -HubFolder '\\fileserver\IT\CoreWorkHub'
```

A mapped drive letter for the hub folder (e.g. `I:\Core\Hub`) is fine: the task is set up with the network path behind it. It copies only when the export changed, skips a file still being written, and swaps the new file in whole. Log: `%LOCALAPPDATA%\CoreWorkHub\export-copy.log`. No credentials are involved; it runs as Nick, only while he's signed in.

**When the API sync goes live:** remove the task (`Unregister-ScheduledTask 'Core Work Hub - copy Service Desk export'`), delete `import\Core - All.csv`, and set `"autoImport": { "enabled": false }` in `hub-config.json`.

## 6. Service Desk API key (read-only) — on the sync PC only

The key is stored in **Windows Credential Manager on the sync PC**. It is never written to the shared folder, the page, or the code.

**Which one are you on?** If Service Desk's address is `sdpondemand.manageengine.com` (or `.eu`, `.in`, `.com.au`) or a custom domain hosted by ManageEngine/Zoho, you're on **Cloud**: follow 6A. If it's a server inside the company, follow 6B.

### 6A. Cloud (Zoho): Self Client and refresh token

Zoho access tokens last only 1 hour, so the sync stores a **refresh token** instead and gets a fresh access token on every run.

1. **Sign in to the Zoho API Console as the account the sync should act as:** https://api-console.zoho.com (`.eu`, `.in`… for other data centres). Ideally a dedicated account that can only *view* Core requests. If you use your own account, the read-only scope below still stops the sync from changing anything, but it can see whatever you can see.
2. **Choose a Client Type → Self Client → CREATE NOW → OK.** (Self Client is for a script you run yourself; none of the other types fit and none need a redirect URL.)
3. **Client Secret tab:** keep the **Client ID** and **Client Secret** handy. Treat the secret like a password.
4. **Generate Code tab:**
   - **Scope:** `SDPOnDemand.requests.READ`. Read-only: requests and their notes. Don't add any write scopes.
   - **Time Duration:** 10 minutes
   - **Scope Description:** `Core Work Hub sync (read-only)`
   - Click **CREATE**, pick the Service Desk portal if asked, and copy the code.
5. **Straight away, on the sync PC** (the code works once and expires), in PowerShell 7:

```powershell
cd <package>\Setup\sync
pwsh -File .\Connect-ZohoServiceDesk.ps1
# EU/India/Australia data centre: add -AccountsUrl https://accounts.zoho.eu (or .in, .com.au)
```

   Paste the Client ID, Client Secret and code when asked. It prints “Connected” and stores everything in Credential Manager as `CoreWorkHub-SDP`, for this Windows user only.
6. **Find your Base URL:** open any request in Service Desk and copy the address up to and including the portal name, e.g. `https://sdpondemand.manageengine.com/app/itdesk` (custom domains look like `https://servicedesk.yourcompany.com/app/itdesk`).
7. **Test it** (reads one page of open Core requests; writes nothing):

```powershell
pwsh -File .\Sync-ServiceDesk.ps1 -HubFolder '\\fileserver\IT\CoreWorkHub' `
     -BaseUrl 'https://sdpondemand.manageengine.com/app/itdesk' -Edition Cloud -Groups 'Core Team' -Test
```

8. Ticket links: the sync links each card to `<Base URL>/ui/requests/<long internal ID>/details` by itself (the long ID, e.g. `160433000056590076`, comes from the API). `ticketUrls.SD` in `hub-config.json` is only used for CSV imports, which don't contain that long ID; see the `ticketUrls.SD` row in step 4.

Use `-Edition Cloud` in step 7 (scheduling) too. **To revoke:** API Console → Self Client → delete it (or Zoho Accounts → Connected Apps). **To reconnect:** generate a new code and run `Connect-ZohoServiceDesk.ps1` again.

### 6B. On-premises: technician API key

1. **Create a dedicated technician** in Service Desk Plus (e.g. “Core Hub Sync”) with a role that can **only view** requests in the Core group queues. No edit, close, or admin rights.
2. **Generate its API key:** sign in as that technician (or as an admin) → **Admin → Technicians** → edit the technician → **Generate API Key** (set an expiry per policy). Copy the key.
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

### Both

You should see “TEST: OK — N open requests visible” and sample subjects. The Core report’s group is **Core Team**; add other queue names if Core owns more.

**Run it once for real** (same command without `-Test`) and check that `tickets.json` appears in the shared folder. Open the hub: tickets appear within 20 seconds.

The sync also reads each open ticket’s first-response time and its latest requester-visible note (one extra API call per open ticket), so the hub can enforce the communication standard. Add `-SkipNotes` if the API is rate-limited.

**To rotate the key (on-premises):** generate a new one, run the `cmdkey` line again, done.

## 7. Schedule the sync

```powershell
pwsh -File .\Register-SyncTask.ps1 -HubFolder '\\fileserver\IT\CoreWorkHub' `
     -BaseUrl 'https://servicedesk.yourcompany.com' -Groups 'Core Team'      # Cloud: your /app/<portal> Base URL and -Edition Cloud
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

1. Nick installs the icon, opens the hub, and imports the first **Core - All** CSV in **Settings → Ticket data** (skip if the sync already ran). He confirms the technician name matches.
2. Each team member runs **Install desktop icon.bat** once, then uses the icon. They are signed in from Windows.
3. Matt does the same; he sees everything read-only.

## 11. Updating the app

Replace `index.html` (and the `app\` folder, if the release notes say it changed) in the shared folder. Desktop icons don't need reinstalling. `hub-config.json`, `tickets.json` and `changes/` stay as they are; everyone’s board picks up the new version on their next reload.

## 12. Data, privacy and security

- **Stored:** ticket metadata only (ID, subject, status, technician, dates, SLA, department, sub-category). No descriptions or notes. Card/account-number patterns in subjects are masked.
- **Token:** only in Credential Manager on the sync PC; read-only technician.
- **Access:** NTFS on the folder (IT Core modify, Matt read).
- **Identity:** with the desktop icon, from the Windows sign-in (each helper writes only its own user's file). In the Edge fallback, people pick their name from a fixed list (honor system). Either way the change file’s owner on disk shows who wrote it, and the **Audit log** shows every change with before → after.
- **Avatars:** people can pick a colour, emoji or photo for themselves (never for someone else). A photo is cropped and shrunk to 128 px (about 10 KB) and stored in that person's change file. “Use my Windows picture” reads only the account picture Windows keeps for the signed-in user (`C:\Users\Public\AccountPictures\<SID>` or `%APPDATA%\Microsoft\Windows\AccountPictures`); it is not uploaded anywhere else.
- **Backups:** covered by the share’s backup. Size grows slowly (a few MB a year).

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| Icon does nothing | Run `Core Work Hub.bat` from the shared folder to see the message; usually Python is missing. Check `%LOCALAPPDATA%\CoreWorkHub\launcher.log`. |
| “You're not on the hub yet” | Add their Windows username to `people` in `hub-config.json`. |
| “Lost connection to the hub helper” / blank page | The helper stopped (idle 30 min, or PC asleep). Double-click the icon again. |
| “Open this page in Microsoft Edge” | Edge fallback only: it was opened in another browser. Use Edge. |
| Folder prompt every time (fallback) | Choose “Allow on every visit”; or the Edge policy resets permissions (see step 5). |
| “Could not save your change” | The person lacks Modify on the folder (Matt is read-only by design). |
| Auto-import shows “over 3 hours old” | The hourly export or the copy task stopped. Check `%LOCALAPPDATA%\CoreWorkHub\export-copy.log` and that OneDrive is syncing. |
| No tickets / stale tickets | Check `%LOCALAPPDATA%\CoreWorkHub\sync.log` on the sync PC; run the sync with `-Test`. |
| Cloud: “Zoho refused: invalid_code” | The grant code expired (10 min) or was used. Generate a new one and rerun `Connect-ZohoServiceDesk.ps1` straight away. |
| Cloud: “invalid_client” | Wrong ID/secret, or wrong data centre: add `-AccountsUrl https://accounts.zoho.eu` (or `.in`, `.com.au`). |
| Cloud: “Zoho refused the refresh token” | The Self Client was deleted or access revoked. Reconnect (step 6A). |
| Sync error 401/403 | Key expired or the technician lacks view rights to the queue. Regenerate / fix the role, rerun `cmdkey`. |
| Owner shows initials only | That Service Desk technician isn’t matched to a hub person: set `sdName`, or match it in the import screen. |
| Wrong ticket links | Fix `ticketUrls.SD` (`{num}` vs `{id}`). |
| Clock seems off on holidays | Add the date to `commStandard.holidays`. |
| A line in the Audit log says “Ignored” | Someone without permission tried a change (e.g. a viewer), or a change file was edited by hand. |
