#!/usr/bin/env python3
"""
Procedure Runner — team server (Python 3.8+, standard library only).

    py server.py                      # serve on http://<this-pc>:8000, data in ./data
    py server.py --port 8080 --data I:\\Core\\Procedures\\ProcedureRunner\\data

Everyone on the team opens the printed address. Procedures, runs and evidence are stored as
individual JSON files under the data folder (one file per procedure / run), so two people editing
different things never overwrite each other:

  data/procedures/<id>.json                 current document (draft + publish history)
  data/procedures/<id>/v<N>.json            immutable published versions
  data/runs/<id>.json                       one file per run (updated with small ops)
  data/attachments/<runId>/<file>           pasted screenshots / evidence
  data/settings.json                        team settings (people list)

Runs are updated with small "ops" (set / merge / push at a path) applied under a lock, which is what lets
several operators work the same failover at once. Procedures use a revision number: a stale save gets
HTTP 409 and the browser asks the user what to do.
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
VERSION = "3.3"  # keep in sync with BUILD in index.html
MAX_BODY = 60 * 1024 * 1024
ID_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,120}$")

DATA = None
# Evidence types served inline; anything else is stored as .bin and downloaded, never rendered.
SAFE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
              ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".log": "text/plain; charset=utf-8"}
_lock = threading.RLock()
_summary_cache = {}  # path -> (mtime, summary)


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


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = "%s.%s.tmp" % (path, uuid.uuid4().hex[:8])
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    for attempt in range(10):  # Windows/SMB can briefly hold a handle on the target
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05 * (attempt + 1))
    os.replace(tmp, path)


class FileLock:
    """Cross-process lock (lock file) so several server instances on one shared drive stay safe."""

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
    """Mirror of PR.store.applyOps in app/js/store.js."""
    for op in ops:
        path = op.get("path") or []
        if not path:
            continue
        cur = doc
        ok = True
        for k in path[:-1]:
            if isinstance(cur, list):
                try:
                    cur = cur[int(k)]
                    continue
                except (ValueError, IndexError):
                    ok = False
                    break
            k = str(k)
            if not isinstance(cur.get(k), (dict, list)):
                cur[k] = {}
            cur = cur[k]
        if not ok or not isinstance(cur, dict):
            raise ValueError("Op path does not address an object: %r" % (path,))
        last = str(path[-1])
        kind, val = op.get("op"), op.get("value")
        if op.get("ifStatus") is not None:  # guard against stale clicks from another operator
            tgt = cur.get(last)
            status = (tgt.get("status") if isinstance(tgt, dict) else None) or "pending"
            if status not in op["ifStatus"]:
                continue
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
        elif kind == "push":
            if not isinstance(cur.get(last), list):
                cur[last] = []
            cur[last].append(val)
    return doc


def run_summary(r):
    setup = r.get("setup") or {}
    issues = (r.get("issues") or {}).values()
    pg = r.get("progress") or {}
    return {
        "id": r.get("id"), "procId": r.get("procId"), "procVersion": r.get("procVersion"), "procTitle": r.get("procTitle"),
        "name": r.get("name"), "status": r.get("status"), "practice": bool(r.get("practice")),
        "createdAt": r.get("createdAt"), "startedAt": r.get("startedAt"), "completedAt": r.get("completedAt"), "updatedAt": r.get("updatedAt"),
        "direction": setup.get("primarySiteId"), "directionLabel": r.get("directionLabel") or "", "changeId": setup.get("changeId") or "",
        "outcome": (r.get("completion") or {}).get("outcome") or "",
        "openIssues": sum(1 for i in issues if i.get("status") != "resolved"), "issues": len(r.get("issues") or {}),
        "done": pg.get("done", 0), "total": pg.get("total", 0),
    }


def cached_summary(path, fn):
    try:
        m = os.path.getmtime(path)
    except OSError:
        return None
    c = _summary_cache.get(path)
    if c and c[0] == m:
        return c[1]
    doc = read_json(path)
    if not isinstance(doc, dict):
        return None
    s = fn(doc)
    _summary_cache[path] = (m, s)
    return s


def now_ms():
    return int(time.time() * 1000)


# ---------------------------------------------------------------- HTTP
class Handler(SimpleHTTPRequestHandler):
    server_version = "ProcedureRunner/" + VERSION
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP_DIR, **kw)

    def log_message(self, fmt, *args):
        if "/api/runs/" in (self.path or "") and self.path.endswith("/rev"):
            return  # polling noise
        sys.stderr.write("%s  %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def end_headers(self):
        if not self.path.startswith("/data/"):  # never let browsers keep an old copy of the app after an update
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

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n < 0 or n > MAX_BODY:
            raise ValueError("Request too large")
        return self.rfile.read(n) if n else b""

    def body_json(self):
        raw = self.body()
        return json.loads(raw.decode("utf-8") or "null")

    def route(self):
        u = urlparse(self.path)
        parts = [unquote(x) for x in u.path.strip("/").split("/") if x]
        return u, parts, parse_qs(u.query)

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

    @staticmethod
    def check_id(x):
        if not x or not ID_RE.match(x) or x.startswith("."):
            raise ValueError("Bad id")
        return x

    # -- verbs
    def do_GET(self):
        u, parts, q = self.route()
        if not parts or parts[0] != "api":
            if parts and parts[0] == "data":
                return self.serve_attachment(parts[1:])
            return super().do_GET()
        self.guard(lambda: self.api_get(parts[1:], q))

    def do_POST(self):
        u, parts, q = self.route()
        if not parts or parts[0] != "api":
            return self.send_json(404, {"error": "Unknown endpoint"})
        self.guard(lambda: self.api_write("POST", parts[1:], q))

    def do_PUT(self):
        u, parts, q = self.route()
        if not parts or parts[0] != "api":
            return self.send_json(404, {"error": "Unknown endpoint"})
        self.guard(lambda: self.api_write("PUT", parts[1:], q))

    def do_DELETE(self):
        u, parts, q = self.route()
        if not parts or parts[0] != "api":
            return self.send_json(404, {"error": "Unknown endpoint"})
        self.guard(lambda: self.api_write("DELETE", parts[1:], q))

    def serve_attachment(self, rest):
        if len(rest) != 3 or rest[0] != "attachments":
            return self.send_error(404)
        run_id, name = self.check_id(rest[1]), os.path.basename(rest[2])
        fp = p("attachments", run_id, name)
        if not os.path.isfile(fp):
            return self.send_error(404)
        ext = os.path.splitext(name)[1].lower()
        ctype = SAFE_TYPES.get(ext, "application/octet-stream")
        with open(fp, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        if ext not in SAFE_TYPES or ext in (".txt", ".log"):
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % name)
        self.send_header("Cache-Control", "private, max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    def api_get(self, parts, q):
        if parts == ["ping"]:
            return self.send_json(200, {"ok": True, "server": "procedure-runner", "version": VERSION, "dataDir": DATA, "host": socket.gethostname()})
        if parts == ["settings"]:
            return self.send_json(200, read_json(p("settings.json"), {}) or {})
        if parts and parts[0] == "procedures":
            if len(parts) == 1:
                items = []
                d = p("procedures")
                if os.path.isdir(d):
                    for name in os.listdir(d):
                        if name.endswith(".json"):
                            s = cached_summary(os.path.join(d, name), lambda doc: doc)
                            if s:
                                items.append(s)
                return self.send_json(200, {"items": items})
            pid = self.check_id(parts[1])
            if len(parts) == 2:
                doc = read_json(p("procedures", pid + ".json"))
                return self.send_json(200, doc) if doc else self.send_json(404, {"error": "Procedure not found"})
            if len(parts) == 4 and parts[2] == "versions":
                v = read_json(p("procedures", pid, "v%d.json" % int(parts[3])))
                return self.send_json(200, v) if v else self.send_json(404, {"error": "Version not found"})
        if parts and parts[0] == "runs":
            if len(parts) == 1:
                pid = (q.get("procId") or [None])[0]
                items = []
                d = p("runs")
                if os.path.isdir(d):
                    for name in os.listdir(d):
                        if name.endswith(".json"):
                            s = cached_summary(os.path.join(d, name), run_summary)
                            if s and (not pid or s.get("procId") == pid):
                                items.append(s)
                return self.send_json(200, {"items": items})
            rid = self.check_id(parts[1])
            doc = read_json(p("runs", rid + ".json"))
            if not doc:
                return self.send_json(404, {"error": "Run not found"})
            if len(parts) == 3 and parts[2] == "rev":
                return self.send_json(200, {"rev": doc.get("rev", 0)})
            return self.send_json(200, doc)
        self.send_json(404, {"error": "Unknown endpoint"})

    def api_write(self, verb, parts, q):
        if not parts:
            return self.send_json(404, {"error": "Unknown endpoint"})
        if parts == ["settings"] and verb == "PUT":
            body = self.body_json()
            if not isinstance(body, dict):
                raise ValueError("Expected object")
            with _lock, FileLock(p("settings.json")):
                write_json(p("settings.json"), body)
            return self.send_json(200, body)

        if parts[0] == "procedures" and len(parts) >= 2:
            pid = self.check_id(parts[1])
            fp = p("procedures", pid + ".json")
            if len(parts) == 2 and verb == "PUT":
                body = self.body_json() or {}
                doc, base = body.get("doc"), body.get("baseRev")
                if not isinstance(doc, dict) or doc.get("id") != pid:
                    raise ValueError("Expected { doc } with matching id")
                with _lock, FileLock(fp):
                    cur = read_json(fp)
                    if cur and base is not None and cur.get("rev") != base:
                        return self.send_json(409, {"error": "conflict", "current": cur})
                    doc["rev"] = (cur.get("rev", 0) if cur else 0) + 1
                    doc["updatedAt"] = now_ms()
                    write_json(fp, doc)
                return self.send_json(200, doc)
            if len(parts) == 2 and verb == "DELETE":
                with _lock, FileLock(fp):
                    if os.path.exists(fp):
                        os.replace(fp, fp + ".deleted-%d" % now_ms())  # keep a recoverable copy
                return self.send_json(200, {"ok": True})
            if len(parts) == 4 and parts[2] == "versions" and verb == "PUT":
                vp = p("procedures", pid, "v%d.json" % int(parts[3]))
                data = self.body_json()
                with _lock:
                    if os.path.exists(vp):
                        return self.send_json(409, {"error": "Version already exists"})
                    write_json(vp, data)
                return self.send_json(200, {"ok": True})

        if parts[0] == "runs":
            if len(parts) == 1 and verb == "POST":
                run = self.body_json()
                if not isinstance(run, dict):
                    raise ValueError("Expected run object")
                rid = self.check_id(run.get("id"))
                fp = p("runs", rid + ".json")
                with _lock, FileLock(fp):
                    if os.path.exists(fp):
                        return self.send_json(409, {"error": "Run already exists"})
                    run["rev"], run["updatedAt"] = 1, now_ms()
                    write_json(fp, run)
                return self.send_json(200, run)
            rid = self.check_id(parts[1])
            fp = p("runs", rid + ".json")
            if len(parts) == 3 and parts[2] == "ops" and verb == "POST":
                body = self.body_json() or {}
                ops = body.get("ops")
                if not isinstance(ops, list):
                    raise ValueError("Expected { ops: [] }")
                with _lock, FileLock(fp):
                    run = read_json(fp)
                    if not run:
                        return self.send_json(404, {"error": "Run not found"})
                    apply_ops(run, ops)
                    run["rev"] = run.get("rev", 0) + 1
                    run["updatedAt"] = now_ms()
                    write_json(fp, run)
                slim = {k: v for k, v in run.items() if k != "snapshot"}  # browser keeps its own copy of the procedure
                return self.send_json(200, slim)
            if len(parts) == 2 and verb == "DELETE":
                with _lock, FileLock(fp):
                    if os.path.exists(fp):
                        os.replace(fp, fp + ".deleted-%d" % now_ms())
                return self.send_json(200, {"ok": True})

        if parts == ["attachments"] and verb == "POST":
            rid = self.check_id((q.get("run") or [""])[0])
            name = os.path.basename((q.get("name") or ["file"])[0]) or "file"
            name = re.sub(r"[^A-Za-z0-9_.\-]", "_", name)[-80:]
            ctype = (self.headers.get("Content-Type") or "").split(";")[0]
            ext = os.path.splitext(name)[1].lower() or {"image/png": ".png", "image/jpeg": ".jpg", "application/pdf": ".pdf"}.get(ctype, ".bin")
            if ext not in SAFE_TYPES:
                ext = ".bin"  # never store something the browser would execute (html, svg, js…)
            fname = "%d_%s%s" % (now_ms(), uuid.uuid4().hex[:6], ext)
            data = self.body()
            d = p("attachments", rid)
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, fname), "wb") as f:
                f.write(data)
            return self.send_json(200, {"ref": "data/attachments/%s/%s" % (rid, fname)})

        self.send_json(404, {"error": "Unknown endpoint"})


def main():
    global DATA
    ap = argparse.ArgumentParser(description="Procedure Runner team server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PR_PORT", 8000)))
    ap.add_argument("--host", default=os.environ.get("PR_HOST", "0.0.0.0"), help="0.0.0.0 = reachable by teammates, 127.0.0.1 = this PC only")
    ap.add_argument("--data", default=os.environ.get("PR_DATA", os.path.join(APP_DIR, "data")), help="folder for procedures, runs and evidence")
    args = ap.parse_args()
    DATA = os.path.abspath(args.data)
    for sub in ("procedures", "runs", "attachments"):
        os.makedirs(p(sub), exist_ok=True)
    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError:
        print("Port %d is already in use." % args.port)
        print("An older Procedure Runner window is probably still running (maybe from a different folder).")
        print("Close that window, then start this one again - otherwise your browser keeps showing the old version.")
        sys.exit(1)
    host = socket.gethostname()
    print("Procedure Runner %s" % VERSION)
    print("  App folder  : %s" % APP_DIR)
    print("  Data folder : %s" % DATA)
    print("  This PC     : http://localhost:%d/" % args.port)
    if args.host != "127.0.0.1":
        print("  Teammates   : http://%s:%d/" % (host, args.port))
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
