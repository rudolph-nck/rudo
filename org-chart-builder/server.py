#!/usr/bin/env python3
"""
Org Chart Builder — team server (Python 3.8+, standard library only).

    py server.py                      # serve on http://<this-pc>:8010, data in ./data
    py server.py --port 8080 --data I:\\HR\\OrgChart\\data

Everyone who works on the chart opens the printed address. The chart itself is shared only as downloaded files
(PDF or a single HTML file); the server never hosts a public copy of it. The server is the single source of truth, so
there is no folder to "connect", no lock file to claim and no "newer copy" warning: every change is a small op
(set / merge at a path) applied under a lock, and every open browser picks up the others' changes within seconds.

  data/project.json                   the working chart (people, pages, layouts, settings) with a revision number
  data/history/<timestamp>.json       automatic snapshots (every 10 minutes of editing, before imports/restores)
  data/published/v<N>.json            each published version (immutable)
  data/published/v<N>.html            the interactive chart exported at publish time (download only)
"""
import argparse
import json
import os
import re
import socket
import sys
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

APP_DIR = os.path.dirname(os.path.abspath(__file__))
VERSION = "2.0"  # keep in sync with OC_BUILD in index.html
MAX_BODY = 40 * 1024 * 1024
SNAPSHOT_EVERY_MS = 10 * 60 * 1000
KEEP_SNAPSHOTS = 300
PRESENCE_MS = 45 * 1000
NAME_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,120}$")

DATA = None
_lock = threading.RLock()
_presence = {}  # client id -> {name, page, at}


# ---------------------------------------------------------------- storage helpers
def p(*parts):
    return os.path.join(DATA, *parts)


def read_json(path, fallback=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return fallback
    except Exception:
        return fallback


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = "%s.%s.tmp" % (path, uuid.uuid4().hex[:8])
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    for attempt in range(10):  # Windows/SMB can briefly hold a handle on the target
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05 * (attempt + 1))
    os.replace(tmp, path)


def write_json(path, obj):
    write_text(path, json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


class FileLock:
    """Cross-process lock (lock file) so two server instances pointed at one shared folder stay safe."""

    def __init__(self, path, timeout=10.0, stale=30.0):
        self.path, self.timeout, self.stale = path + ".lock", timeout, stale

    def __enter__(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        start = time.time()
        while True:
            try:
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                return self
            except FileExistsError:
                try:
                    if time.time() - os.path.getmtime(self.path) > self.stale:
                        os.remove(self.path)
                        continue
                except OSError:
                    pass
                if time.time() - start > self.timeout:
                    raise TimeoutError("Could not lock " + self.path)
                time.sleep(0.03)

    def __exit__(self, *a):
        try:
            os.remove(self.path)
        except OSError:
            pass


def apply_ops(doc, ops):
    """Mirror of OC.store.applyOps in app/js/store.js. set (None deletes) and merge (None values delete keys)."""
    for op in ops:
        path = op.get("path") or []
        if not path:
            continue
        cur = doc
        for k in path[:-1]:
            k = str(k)
            if not isinstance(cur.get(k), dict):
                cur[k] = {}
            cur = cur[k]
        last = str(path[-1])
        kind, val = op.get("op"), op.get("value")
        if kind == "set":
            if val is None:
                cur.pop(last, None)
            else:
                cur[last] = val
        elif kind == "merge":
            if not isinstance(cur.get(last), dict):
                cur[last] = {}
            for k, v in (val or {}).items():
                if v is None:
                    cur[last].pop(k, None)
                else:
                    cur[last][k] = v
        else:
            raise ValueError("Unknown op %r" % kind)
    return doc


def now_ms():
    return int(time.time() * 1000)


def snapshot(doc, reason, by=""):
    """Keep a restorable copy of the project. Called with _lock held."""
    if not doc:
        return None
    sid = "%d" % now_ms()
    meta = {"id": sid, "at": now_ms(), "reason": reason, "by": by or "", "rev": doc.get("rev", 0),
            "people": sum(1 for x in (doc.get("people") or {}).values() if x.get("status") != "inactive")}
    write_json(p("history", sid + ".json"), {"meta": meta, "doc": doc})
    files = sorted(f for f in os.listdir(p("history")) if f.endswith(".json"))
    for old in files[:-KEEP_SNAPSHOTS]:
        try:
            os.remove(p("history", old))
        except OSError:
            pass
    return meta


def last_snapshot_at():
    files = sorted(f for f in os.listdir(p("history")) if f.endswith(".json"))
    return int(files[-1][:-5]) if files else 0


def published_list():
    items = []
    d = p("published")
    for name in os.listdir(d):
        m = re.match(r"^v(\d+)\.json$", name)
        if m:
            doc = read_json(os.path.join(d, name)) or {}
            meta = doc.get("meta") or {}
            meta["version"] = int(m.group(1))
            meta["hasHtml"] = os.path.exists(os.path.join(d, "v%s.html" % m.group(1)))
            items.append(meta)
    items.sort(key=lambda x: x["version"], reverse=True)
    return items


# ---------------------------------------------------------------- HTTP
class Handler(SimpleHTTPRequestHandler):
    server_version = "OrgChartBuilder/" + VERSION
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "application/javascript", ".json": "application/json",
                      ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP_DIR, **kw)

    def log_message(self, fmt, *args):
        if "/api/rev" in (self.path or "") or "/api/presence" in (self.path or ""):
            return  # polling noise
        sys.stderr.write("%s  %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def end_headers(self):
        # never let browsers keep an old copy of the app after an update
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    # -- helpers
    def send_json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_file(self, path, ctype, download_name=None):
        if not os.path.isfile(path):
            return self.send_error(404, "File not found")
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        if download_name:
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % download_name)
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n < 0 or n > MAX_BODY:
            raise ValueError("Request too large")
        return self.rfile.read(n) if n else b""

    def body_json(self):
        return json.loads(self.body().decode("utf-8") or "null")

    def route(self):
        u = urlparse(self.path)
        parts = [unquote(x) for x in u.path.strip("/").split("/") if x]
        return parts, parse_qs(u.query)

    def guard(self, fn):
        try:
            fn()
        except (ValueError, json.JSONDecodeError) as e:
            self.send_json(400, {"error": str(e)})
        except TimeoutError as e:
            self.send_json(503, {"error": str(e)})
        except Exception as e:  # keep the server alive for everyone else
            import traceback
            traceback.print_exc()
            self.send_json(500, {"error": "Server error: %s" % e})

    # -- verbs
    def do_GET(self):
        parts, q = self.route()
        if parts and parts[0] == "data":
            return self.send_error(404)  # data folder is only reachable through the API
        if not parts or parts[0] != "api":
            return super().do_GET()
        self.guard(lambda: self.api_get(parts[1:], q))

    def do_POST(self):
        parts, q = self.route()
        if not parts or parts[0] != "api":
            return self.send_json(404, {"error": "Unknown endpoint"})
        self.guard(lambda: self.api_post(parts[1:], q))

    def do_PUT(self):
        parts, q = self.route()
        if not parts or parts[0] != "api":
            return self.send_json(404, {"error": "Unknown endpoint"})
        self.guard(lambda: self.api_put(parts[1:], q))

    def presence(self):
        cutoff = now_ms() - PRESENCE_MS
        for k in [k for k, v in _presence.items() if v["at"] < cutoff]:
            _presence.pop(k, None)
        return [{"id": k, "name": v["name"], "view": v.get("view", ""), "editing": v.get("editing", False)} for k, v in _presence.items()]

    def api_get(self, parts, q):
        if parts == ["ping"]:
            return self.send_json(200, {"ok": True, "server": "org-chart-builder", "version": VERSION, "dataDir": DATA, "host": socket.gethostname()})
        if parts == ["project"]:
            doc = read_json(p("project.json"))
            return self.send_json(200, {"doc": doc})
        if parts == ["rev"]:
            doc = read_json(p("project.json")) or {}
            return self.send_json(200, {"rev": doc.get("rev", 0), "updatedBy": doc.get("updatedBy", "")})
        if parts == ["history"]:
            items = []
            for name in sorted(os.listdir(p("history")), reverse=True)[:200]:
                if name.endswith(".json"):
                    snap = read_json(p("history", name)) or {}
                    if snap.get("meta"):
                        items.append(snap["meta"])
            return self.send_json(200, {"items": items})
        if len(parts) == 2 and parts[0] == "history":
            sid = parts[1]
            if not sid.isdigit():
                raise ValueError("Bad snapshot id")
            snap = read_json(p("history", sid + ".json"))
            return self.send_json(200, snap) if snap else self.send_json(404, {"error": "Snapshot not found"})
        if parts == ["published"]:
            return self.send_json(200, {"items": published_list()})
        if len(parts) == 2 and parts[0] == "published":
            n = int(parts[1])
            doc = read_json(p("published", "v%d.json" % n))
            return self.send_json(200, doc) if doc else self.send_json(404, {"error": "Version not found"})
        if len(parts) == 3 and parts[0] == "published" and parts[2] == "html":
            # a published version's chart, as a file download (sharing is by file, not by link)
            n = int(parts[1])
            return self.send_file(p("published", "v%d.html" % n), "text/html; charset=utf-8", download_name="OrgChart_v%d.html" % n)
        self.send_json(404, {"error": "Unknown endpoint"})

    def api_post(self, parts, q):
        fp = p("project.json")
        if parts == ["ops"]:
            body = self.body_json() or {}
            ops, by = body.get("ops"), str(body.get("by") or "")[:80]
            if not isinstance(ops, list):
                raise ValueError("Expected { ops: [] }")
            with _lock, FileLock(fp):
                doc = read_json(fp)
                if not doc:
                    return self.send_json(409, {"error": "No project yet"})
                if now_ms() - last_snapshot_at() > SNAPSHOT_EVERY_MS:
                    snapshot(doc, "Autosave", by)
                apply_ops(doc, ops)
                doc["rev"] = doc.get("rev", 0) + 1
                doc["updatedAt"], doc["updatedBy"] = now_ms(), by
                write_json(fp, doc)
            return self.send_json(200, {"rev": doc["rev"]})
        if parts == ["presence"]:
            body = self.body_json() or {}
            cid = str(body.get("id") or "")[:64]
            if cid:
                _presence[cid] = {"name": str(body.get("name") or "Someone")[:80], "view": str(body.get("view") or "")[:40],
                                  "editing": bool(body.get("editing")), "at": now_ms()}
            return self.send_json(200, {"items": self.presence()})
        if parts == ["snapshot"]:
            body = self.body_json() or {}
            with _lock, FileLock(fp):
                meta = snapshot(read_json(fp), str(body.get("reason") or "Manual checkpoint")[:200], str(body.get("by") or "")[:80])
            return self.send_json(200, meta or {})
        if parts == ["publish"]:
            body = self.body_json() or {}
            html = body.get("html")
            if not isinstance(html, str) or "<html" not in html[:400].lower():
                raise ValueError("Expected the exported chart HTML")
            by, note = str(body.get("by") or "")[:80], str(body.get("note") or "")[:2000]
            with _lock, FileLock(fp):
                doc = read_json(fp)
                if not doc:
                    raise ValueError("No project to publish")
                versions = published_list()
                n = (versions[0]["version"] if versions else 0) + 1
                new_rev = doc.get("rev", 0) + 1  # the chart is "unchanged since publishing" while doc rev == meta rev
                meta = {"version": n, "at": now_ms(), "by": by, "note": note, "rev": new_rev,
                        "people": sum(1 for x in (doc.get("people") or {}).values() if x.get("status") != "inactive")}
                pub = dict(doc)
                pub.pop("published", None)
                write_json(p("published", "v%d.json" % n), {"meta": meta, "doc": pub})
                write_text(p("published", "v%d.html" % n), html)
                doc["published"] = meta
                doc["rev"] = new_rev
                doc["updatedAt"], doc["updatedBy"] = now_ms(), by
                write_json(fp, doc)
                snapshot(doc, "Published v%d" % n, by)
            return self.send_json(200, {"meta": meta, "rev": doc["rev"]})
        self.send_json(404, {"error": "Unknown endpoint"})

    def api_put(self, parts, q):
        if parts == ["project"]:
            # Replace the whole project: first-time setup, import, or restoring a snapshot/published version.
            body = self.body_json() or {}
            doc, reason, by = body.get("doc"), str(body.get("reason") or "Replaced")[:200], str(body.get("by") or "")[:80]
            if not isinstance(doc, dict) or not isinstance(doc.get("people"), dict):
                raise ValueError("Expected { doc } with people")
            fp = p("project.json")
            with _lock, FileLock(fp):
                cur = read_json(fp)
                if cur:
                    snapshot(cur, "Before: " + reason, by)
                    doc["published"] = cur.get("published")  # publishing history belongs to the server, not the file
                doc["rev"] = (cur.get("rev", 0) if cur else 0) + 1
                doc["updatedAt"], doc["updatedBy"] = now_ms(), by
                write_json(fp, doc)
            return self.send_json(200, {"doc": doc})
        self.send_json(404, {"error": "Unknown endpoint"})


def main():
    global DATA
    ap = argparse.ArgumentParser(description="Org Chart Builder team server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("OC_PORT", 8010)))
    ap.add_argument("--host", default=os.environ.get("OC_HOST", "0.0.0.0"), help="0.0.0.0 = reachable by teammates, 127.0.0.1 = this PC only")
    ap.add_argument("--data", default=os.environ.get("OC_DATA", os.path.join(APP_DIR, "data")), help="folder for the chart, history and published versions")
    args = ap.parse_args()
    DATA = os.path.abspath(args.data)
    for sub in ("history", "published"):
        os.makedirs(p(sub), exist_ok=True)
    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError:
        print("Port %d is already in use." % args.port)
        print("An older Org Chart Builder window is probably still running (maybe from a different folder).")
        print("Close that window, then start this one again - otherwise your browser keeps showing the old version.")
        sys.exit(1)
    host = socket.gethostname()
    print("Org Chart Builder %s" % VERSION)
    print("  App folder     : %s" % APP_DIR)
    print("  Data folder    : %s" % DATA)
    print("  This PC        : http://localhost:%d/" % args.port)
    if args.host != "127.0.0.1":
        print("  Teammates      : http://%s:%d/" % (host, args.port))
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
