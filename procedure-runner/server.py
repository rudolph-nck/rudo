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
import signal
import socket
import subprocess
import sys
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
from urllib.request import ProxyHandler, build_opener

# Talk to localhost directly: on Windows urllib otherwise picks up the system (corporate) proxy from the registry.
_direct = build_opener(ProxyHandler({}))
NO_WINDOW = {"creationflags": 0x08000000} if os.name == "nt" else {}  # CREATE_NO_WINDOW: no console flash under pythonw

APP_DIR = os.path.dirname(os.path.abspath(__file__))
VERSION = "3.12"  # keep in sync with BUILD in index.html
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
        "approvals": [{"id": a.get("id"), "kind": a.get("kind"), "title": a.get("title"), "stepId": a.get("stepId"), "to": a.get("to") or [],
                       "requestedBy": a.get("requestedBy"), "requestedAt": a.get("requestedAt"), "pingAt": a.get("pingAt")}
                      for a in (r.get("approvals") or {}).values() if isinstance(a, dict) and a.get("status") == "pending"],
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
            return self.send_json(200, {"ok": True, "server": "procedure-runner", "version": VERSION, "dataDir": DATA, "appDir": APP_DIR,
                                        "pid": os.getpid(), "host": socket.gethostname()})
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


def same_title(title, skip_id):
    """id of another (non-deleted) procedure with this title, if any."""
    d = p("procedures")
    if not title or not os.path.isdir(d):
        return None
    for name in os.listdir(d):
        if name.endswith(".json") and name[:-5] != skip_id:
            doc = read_json(os.path.join(d, name)) or {}
            if ((doc.get("draft") or {}).get("title") or "").strip().lower() == title.strip().lower() and doc.get("status") != "archived":
                return doc.get("id")
    return None


def running_instance(port):
    """What is answering on this port on this PC, if it's a Procedure Runner."""
    try:
        with _direct.open("http://127.0.0.1:%d/api/ping" % port, timeout=2) as r:
            info = json.loads(r.read().decode("utf-8"))
        return info if info.get("server") == "procedure-runner" else {}
    except Exception:
        return None


def port_owners(port):
    """PIDs listening on a TCP port. On Windows several programs can end up sharing one port (SO_REUSEADDR)."""
    pids = []
    try:
        if os.name == "nt":
            out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True, timeout=10, **NO_WINDOW).stdout
            for line in out.splitlines():
                cols = line.split()
                if len(cols) >= 5 and cols[3].upper() == "LISTENING" and cols[1].rsplit(":", 1)[-1] == str(port):
                    pids.append(int(cols[4]))
        elif os.path.exists("/proc/net/tcp"):
            inodes = set()
            for tbl in ("/proc/net/tcp", "/proc/net/tcp6"):
                if os.path.exists(tbl):
                    for line in open(tbl).read().splitlines()[1:]:
                        cols = line.split()
                        if cols[3] == "0A" and int(cols[1].rsplit(":", 1)[1], 16) == port:
                            inodes.add("socket:[%s]" % cols[9])
            for d in os.listdir("/proc"):
                if d.isdigit():
                    try:
                        if any(os.readlink("/proc/%s/fd/%s" % (d, fd)) in inodes for fd in os.listdir("/proc/%s/fd" % d)):
                            pids.append(int(d))
                    except OSError:
                        pass
    except Exception:
        pass
    return sorted(set(pids))


def process_name(pid):
    try:
        if os.name == "nt":
            out = subprocess.run(["tasklist", "/FI", "PID eq %d" % pid, "/FO", "CSV", "/NH"], capture_output=True, text=True, timeout=10, **NO_WINDOW).stdout
            m = re.match(r'"([^"]+)"', out.strip())
            return m.group(1) if m else ""
        return open("/proc/%d/cmdline" % pid, "rb").read().replace(b"\0", b" ").decode("utf-8", "replace").strip()
    except Exception:
        return ""


def is_python(pid):
    return bool(re.search(r"(^|[\\/ ])(py|pyw|python[0-9.]*w?)(\.exe)?\b", process_name(pid), re.I))


def same_path(a, b):
    return bool(a and b) and os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def seed_procedures():
    """Procedures shipped in seed/*.procedure.json are added to a data folder (published as v1) the first time it
    sees them. data/seeded.json remembers what was added, so a seeded procedure you delete stays deleted."""
    sd = os.path.join(APP_DIR, "seed")
    if not os.path.isdir(sd):
        return
    marker = p("seeded.json")
    with _lock, FileLock(marker):
        done = read_json(marker, {}) or {}
        changed = False
        for name in sorted(os.listdir(sd)):
            if not name.endswith(".procedure.json"):
                continue
            raw = read_json(os.path.join(sd, name))
            proc = raw.get("procedure", raw) if isinstance(raw, dict) else None
            pid = proc.get("id") if isinstance(proc, dict) else None
            if not pid or not ID_RE.match(pid) or pid.startswith(".") or pid in done:
                continue
            t = now_ms()
            fp = p("procedures", pid + ".json")
            twin = same_title(proc.get("title"), pid)
            if twin:  # e.g. imported by hand before it shipped with the app — don't add a second copy
                print("  Kept        : %s (already in the library)" % proc.get("title"))
            elif not os.path.exists(fp):
                steps = sum(len(sec.get("steps") or []) for sec in proc.get("sections") or [])
                write_json(p("procedures", pid, "v1.json"), proc)
                write_json(fp, {"id": pid, "status": "published", "draft": proc, "publishedVersion": 1, "publishedAt": t,
                                "versions": [{"version": 1, "at": t, "by": "Procedure Runner", "note": "Included with the app (%s)" % name, "steps": steps}],
                                "createdAt": t, "updatedAt": t, "updatedBy": "Procedure Runner", "dirtySincePublish": False, "rev": 1})
                print("  Added       : %s (%d steps)" % (proc.get("title") or pid, steps))
            done[pid] = {"file": name, "at": t}
            changed = True
        if changed:
            write_json(marker, done)


class AppServer(ThreadingHTTPServer):
    daemon_threads = True
    # Python's HTTPServer sets SO_REUSEADDR. On Windows that lets a second program bind a port that is already
    # listening, so a new version would silently share port 8000 with an old one that keeps answering.
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def is_this_copy(info):
    return bool(info) and info.get("version") == VERSION and same_path(info.get("appDir"), APP_DIR) and same_path(info.get("dataDir"), DATA)


def claim_port(port):
    """Checked BEFORE binding (Windows may not refuse the bind): a Procedure Runner already answering on this port
    is either this exact copy (then just say so) or another version / folder / data folder, which is stopped."""
    for _ in range(8):  # there may be several stale copies sharing the port
        other = running_instance(port)
        if not other:
            return
        if is_this_copy(other):
            print("Procedure Runner %s is already running from this folder: http://localhost:%d/" % (VERSION, port))
            sys.exit(0)
        pids = set(port_owners(port))
        if other.get("pid"):
            pids.add(int(other["pid"]))
        pids = [x for x in pids if x != os.getpid() and is_python(x)]
        if not pids:
            print("Port %d is used by Procedure Runner %s from %s, but it couldn't be identified to stop it."
                  % (port, other.get("version", "?"), other.get("appDir", "another folder")))
            print("Run Stop_ProcedureRunner.bat (or restart the PC), then start this one again.")
            sys.exit(1)
        print("Stopping Procedure Runner %s from %s (data: %s) so this copy (%s) can use port %d."
              % (other.get("version", "?"), other.get("appDir", "another folder"), other.get("dataDir", "?"), VERSION, port))
        for pid in pids:
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception as e:
                print("  Couldn't stop process %d (%s)." % (pid, e))
        for _ in range(40):
            if not running_instance(port):
                break
            time.sleep(0.25)
    if running_instance(port):
        print("Another Procedure Runner keeps answering on port %d. Run Stop_ProcedureRunner.bat or restart the PC." % port)
        sys.exit(1)


def read_cfg():
    """ProcedureRunner.cfg (used by the desktop launcher): PORT / HOST / DATA."""
    cfg = {}
    try:
        for line in open(os.path.join(APP_DIR, "ProcedureRunner.cfg"), encoding="utf-8-sig"):
            m = re.match(r"\s*([A-Za-z]+)\s*=\s*(.*?)\s*$", line)
            if m and not line.lstrip().startswith(("#", ";")):
                cfg[m.group(1).upper()] = m.group(2)
    except OSError:
        pass
    return cfg


def diagnose(port):
    """Plain-language report of what is running and why the browser might show an old copy."""
    out = []
    say = out.append
    problems = []
    say("Procedure Runner diagnostics — %s" % time.strftime("%Y-%m-%d %H:%M:%S"))
    say("")
    say("THIS COPY")
    say("  Version      : %s" % VERSION)
    say("  App folder   : %s" % APP_DIR)
    say("  Python       : %s (%s)" % (sys.version.split()[0], sys.executable))
    cfg = read_cfg()
    say("  Settings     : %s" % (", ".join("%s=%s" % kv for kv in cfg.items()) if cfg else "none (ProcedureRunner.cfg not used)"))
    say("  Data folder  : %s" % DATA)
    sd = os.path.join(APP_DIR, "seed")
    seeds = sorted(n for n in os.listdir(sd) if n.endswith(".procedure.json")) if os.path.isdir(sd) else []
    say("  Included     : %s" % (", ".join(seeds) or "nothing in seed/"))
    procs = []
    d = p("procedures")
    if os.path.isdir(d):
        for name in sorted(os.listdir(d)):
            if name.endswith(".json"):
                doc = read_json(os.path.join(d, name)) or {}
                dr = doc.get("draft") or {}
                procs.append("%s [%s v%s%s]" % (dr.get("title", name), doc.get("status", "?"), doc.get("publishedVersion", 0),
                                                ", quick start" if (dr.get("runOptions") or {}).get("quickStart") else ""))
    say("  Procedures   : %d in this data folder" % len(procs))
    for x in procs:
        say("                 - %s" % x)
    seeded = read_json(p("seeded.json"), {}) or {}
    say("  Seeded so far: %s" % (", ".join(seeded) or "none yet (added the first time the server starts with this data folder)"))
    say("")
    say("PORT %d" % port)
    other = running_instance(port)
    owners = port_owners(port)
    if other is None:
        say("  Nothing is answering at http://localhost:%d/" % port)
    elif not other:
        say("  ANOTHER PROGRAM (not Procedure Runner) is using this port.")
        problems.append("Port %d is taken by another program. Set PORT=8080 in ProcedureRunner.cfg (copy ProcedureRunner.cfg.example)." % port)
    else:
        say("  Answering    : Procedure Runner %s" % other.get("version", "?"))
        say("  Its folder   : %s" % other.get("appDir", "(not reported - version 3.10 or older)"))
        say("  Its data     : %s" % other.get("dataDir", "?"))
        if is_this_copy(other):
            say("  -> This is THIS copy. Good.")
        else:
            problems.append("The browser is talking to Procedure Runner %s from %s, not this copy (%s). "
                            "Start this copy with ProcedureRunner.bat or Start_ProcedureRunner.bat - it stops the other one."
                            % (other.get("version", "?"), other.get("appDir", "another folder"), VERSION))
    for pid in owners:
        say("  Listening    : process %d  %s" % (pid, process_name(pid)[:90]))
    if len(owners) > 1:
        problems.append("%d programs are listening on port %d at once (older versions could share the port on Windows). "
                        "Starting this copy stops the stale ones." % (len(owners), port))
    if seeds and not procs:
        problems.append("The data folder is empty - the included procedures are added when the server starts.")
    if os.path.isdir(os.path.join(APP_DIR, "data")) and not same_path(DATA, os.path.join(APP_DIR, "data")):
        say("")
        say("  Note: this folder also has a 'data' folder that is NOT being used (DATA is set to %s)." % DATA)
    say("")
    say("RESULT")
    if problems:
        for x in problems:
            say("  ! " + x)
    else:
        say("  No problems found.")
    return "\n".join(out)


def open_browser_when_ready(port):
    def go():
        for _ in range(40):
            if is_this_copy(running_instance(port)):
                break
            time.sleep(0.25)
        try:
            import webbrowser
            webbrowser.open("http://localhost:%d/" % port)
        except Exception:
            pass
    threading.Thread(target=go, daemon=True).start()


def main():
    global DATA
    # Defaults: command line > environment > ProcedureRunner.cfg > built-in, so every way of starting agrees
    cfg = read_cfg()
    cfg_data = cfg.get("DATA")
    if cfg_data and not os.path.isabs(cfg_data):
        cfg_data = os.path.join(APP_DIR, cfg_data)
    ap = argparse.ArgumentParser(description="Procedure Runner team server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PR_PORT") or cfg.get("PORT") or 8000))
    ap.add_argument("--host", default=os.environ.get("PR_HOST") or cfg.get("HOST") or "0.0.0.0", help="0.0.0.0 = reachable by teammates, 127.0.0.1 = this PC only")
    ap.add_argument("--data", default=os.environ.get("PR_DATA") or cfg_data or os.path.join(APP_DIR, "data"), help="folder for procedures, runs and evidence")
    ap.add_argument("--open", action="store_true", help="open the browser once this copy is ready")
    ap.add_argument("--diagnose", action="store_true", help="print what is running on the port and exit")
    args = ap.parse_args()
    DATA = os.path.abspath(args.data)
    if args.diagnose:
        print(diagnose(args.port))
        return
    for sub in ("procedures", "runs", "attachments"):
        os.makedirs(p(sub), exist_ok=True)
    seed_procedures()
    claim_port(args.port)
    httpd = None
    for attempt in range(40):
        try:
            httpd = AppServer((args.host, args.port), Handler)
            break
        except OSError:
            if running_instance(args.port):
                claim_port(args.port)  # a Procedure Runner grabbed it meanwhile
            elif attempt == 0:
                print("Port %d is already in use by another program." % args.port)
                print("Start Procedure Runner on a different port, e.g.  py server.py --port 8080  (or PORT=8080 in ProcedureRunner.cfg).")
                sys.exit(1)
            time.sleep(0.25)
    if httpd is None:
        print("Port %d is still busy - close the other Procedure Runner and try again." % args.port)
        sys.exit(1)
    host = socket.gethostname()
    print("Procedure Runner %s" % VERSION)
    print("  App folder  : %s" % APP_DIR)
    print("  Data folder : %s" % DATA)
    print("  This PC     : http://localhost:%d/" % args.port)
    if args.host != "127.0.0.1":
        print("  Teammates   : http://%s:%d/" % (host, args.port))
    print("Press Ctrl+C to stop.")
    if args.open:
        open_browser_when_ready(args.port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
