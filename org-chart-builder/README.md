# Org Chart Builder 2.0

Build, review and publish the organizational chart as a team. This replaces the single-file Org Chart Builder (v31–v44). It has the same pages and the same idea (executive overview, executive direct reports, then every department and branch by executive area), rebuilt so that it works reliably:

- **The chart is drawn from computed positions.** Connector lines can't break, wide teams don't clip, and the screen, the HTML file and the PDF all come from the same layout.
- **One page at a time, with real pan and zoom**, instead of one 85-page scroll that resized itself.
- **A small team server** replaces "Connect Folder", check-out locks and "a newer copy exists" warnings. Several people can edit at once, every change saves on its own, and everyone sees the others' changes within seconds.
- **Undo for everything.** There are automatic snapshots and numbered published versions, and any of them can be restored.

No install and no build step. It's plain HTML/JS plus a Python server that uses only the standard library, the same setup as the Procedure Runner.

## Start it

| How | What you get |
|---|---|
| Double-click **`Start_OrgChartBuilder.bat`** (or the desktop shortcut) | Team server on port 8010 in a console window, then the app opens in its own window. Teammates open `http://<your-pc-name>:8010/`. The chart is saved in `.\data`. |
| `py server.py --data I:\HR\OrgChart\data` | Same, with the data on a shared drive. |
| Open `index.html` directly | **Local mode**: the chart lives in this browser only. Good for trying things out. Use Publish → *Project backup* / *Open a project file* to move it. |

The server is only for the people who maintain the chart. Nothing is hosted for anyone else: the chart is shared by downloading it as a **PDF** or a single **HTML file** (see *Sharing* below).

### Bring over the old chart

On first start, choose **Open old project…** and pick either:
- the **`.json` project** you saved from the old builder (this has your latest edits), or
- the old **`OrgChartBuilder.html`** file itself (this has the data that was built into it).

People, managers, departments/branches, executives, card styles, page order, hidden pages, custom sections and title overrides all come across. The old builder's "Horizontal" setting drew a team as one endless row and then shrank the page to fit. Those teams switch to **Auto**, which lays them out readably. Teams set to "Vertical" or "Grid" keep that setting.

## Using it

For the people who use it day to day there is a **step-by-step guide with pictures** in `docs/guide/index.html` (also `docs/guide/Org Chart Builder - Step-by-Step Guide.pdf`, and the green button under **?** in the app opens it). The rest of this section is the short version.


- **View / Edit** (top right, or press `E`). View is safe for browsing. Edit turns on every change below.
- **Chart**: the page list is on the left, the chart in the middle, and the person panel on the right.
  - Click a person for details. In Edit mode, every field in the panel edits in place.
  - **Drag a card onto someone** to change who they report to. A toast offers Undo.
  - **Right-click a card** to add a direct report or a vacancy, replace someone or fill a vacancy, change their team's layout (Auto / Side by side / Grid / Stacked, on this page or everywhere), order their team, change the card style, hide them on this page, show someone under them on this page only, add a placeholder card, or build a new page starting from them.
  - The **+N** button under a card shows people folded away on that page. **−** folds a team away.
  - Move around by dragging empty space, scrolling, or holding Space. `Ctrl + scroll` zooms. `F` fits the chart, `W` fits the width, `0` shows actual size, and `←` / `→` go to the previous or next page.
  - **Arrange** (page list, Edit mode): drag pages into a new order and hide or show pages. **+ New page** adds a custom chart page (someone plus 1, 2, 3 or all levels, with their management chain above if you like) or a section divider.
- **People**: the master list every page is built from.
  - Search, filter and sort it. Edit any cell in place.
  - **⚠ things to check** finds reporting loops, missing or inactive managers, people outside the CEO's organization, and duplicate names, emails or employee numbers.
  - **Import spreadsheet** reads `.xlsx`/`.csv` and lets you match its columns to the fields. Choose *Update and add* (matched by employee #, then email, then name) or *Replace everyone*.
  - **Export** gives a real `.xlsx` or a `.csv`.
- **Removing someone** asks whether they're leaving (their position stays as a **vacancy** and their team stays under it), or whether the position goes too (you pick a new manager for each direct report, or one for all).
- **Settings** (⚙): organization name, chart title, CEO, the executive team (in order), card style (Brand or the old Classic teal), card size, and for each department whether it's a branch and which executive area it belongs to.

## Publishing

The chart you edit is the draft. The top bar shows whether it has unpublished changes.

**Publish** lists what changed since the last version (people added, removed, moved and updated). Publishing then saves a numbered version, and its HTML is kept with it. Earlier versions stay available: you can compare them, download them again as HTML or PDF, or restore them.

## Sharing

The chart is shared **only as a downloaded file**. There is no hosted page and no link. On the Publish screen, under **Share the chart** (also offered right after publishing):
- **PDF**: every page scaled to one landscape sheet. Choose *Save as PDF* in the print window. From a page's **⋯** menu you can also print just that page or an executive area.
- **HTML file**: one file with every page, search, and contact details when you click a person. It opens in any browser from an email attachment or a shared folder, fits any screen, and prints one page per sheet.

Files made while there are unpublished changes are marked **DRAFT**. **Other downloads** has the **People (.xlsx)** list and a **project backup (.json)**. These are for keeping records, not for sharing the chart.

## Safety nets

- Snapshots are taken every 10 minutes while people edit, and before every import, restore and publish (Publish → Snapshots). Restoring takes a snapshot first.
- Changes that can't reach the server (for example, a network blip) are kept and re-sent. The top bar shows *Offline · N unsaved* until they're sent.
- The server writes files atomically and locks them, so two servers pointed at the same shared `--data` folder stay consistent. The simplest setup is still one person hosting and everyone connecting to that address.

## Desktop shortcut

Run **`Install_Desktop_Shortcut.bat`** and pick one of these:

1. **This PC runs Org Chart Builder.** The shortcut runs `Start_OrgChartBuilder.bat`. That opens the server console window (keep it open while people use the chart; close it to stop the server) and then opens the app in its own Edge window. If the server is already running, the shortcut just opens the app.
2. **Connect to Org Chart Builder on another PC.** The shortcut opens that PC's address in its own Edge window. This is the one to give teammates.

Either way, the shortcut gets the app icon and goes on the real desktop, even when it's redirected to OneDrive or by Group Policy.

## Branding

The app follows the Addition Financial brand guide (rev. 8.25.25), like the Procedure Runner:
- Anchor Gray `#53575a` and Vivid Blue `#00b2e3` as the primary colours, and Click-me Green `#6abf4b` only for calls to action (Publish, Add person, Import).
- Open Sans (bundled, so it works offline) with ExtraBold headings, falling back to Calibri.
- The blue line on page titles and on the top edge of every card, the angled notch on section dividers, and the upright vivid-blue plus.
- Light and dark modes are available (☾ / ☀). Exports are always light.

## Files

```
index.html                 app shell
app/js/util.js             DOM helper, modals, menus, toasts
app/js/model.js            project model, migration from v31–v44, hierarchy, pages, health checks
app/js/layout.js           card/connector geometry (shared by the screen, the HTML file and the PDF)
app/js/store.js            saving (server or this browser), undo/redo, live sync, history, publishing
app/js/chartstyle.js       card and connector styles (shared with exports)
app/js/chart.js            chart view: pan/zoom, select, drag to re-assign
app/js/actions.js          every change (people, layouts, pages)
app/js/panel.js            person panel
app/js/directory.js        People screen, spreadsheet import/export
app/js/sheet.js            .xlsx/.csv read, .xlsx write (no libraries)
app/js/export.js           the HTML file and print/PDF
app/js/publish.js          Publish screen: changes, versions, snapshots
app/js/app.js              routes, top bar, search, page list, settings, first run
app/css/app.css            app styles (brand-aligned, light + dark)
app/fonts/                 Open Sans (SIL Open Font License)
app/icons/                 app icon set (.svg, .png, .ico)
docs/guide/                step-by-step user guide (HTML + PDF, screenshots of a made-up sample organization)
server.py                  team server (Python 3.8+, standard library only)
Start_OrgChartBuilder.bat  starts the server console and opens the app (or just opens it if it's running)
Install_Desktop_Shortcut.bat, tools/   desktop shortcut installer and the app-window opener
data/                      created at runtime: project.json, history/, published/ (not in git)
```
