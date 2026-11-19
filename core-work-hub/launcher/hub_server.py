"""
Core Work Hub launcher (Python 3.8+, standard library only).

Started by "Core Work Hub.bat" from the desktop icon. It serves the hub page from the shared folder at
http://127.0.0.1:<port>/ and does the reading and writing in that folder for the browser, so there is no Edge
folder permission, no Edge policy to change, and no name to pick: changes are written as the logged-in Windows
user.

Safety:
  * Listens on 127.0.0.1 only: other PCs can't reach it.
  * Every API call must carry the one-time key the launcher gave the browser it opened (X-Hub-Key), and requests
    from other web pages (another Origin) are refused, so other sites or local apps can't drive it.
  * It writes only: changes/<your Windows username>.jsonl (append-only), and, for the manager's screens,
    hub-config.json and tickets.json. Nothing else in the folder can be touched.
  * It stops by itself after 30 minutes with no browser activity. The icon starts it again.

Usage (the .bat does this):  pythonw hub_server.py [--folder <shared folder>] [--browser edge|default]
"""

import argparse
import getpass
import http.server
import json
import os
import re
import secrets
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser

IDLE_EXIT_SECONDS = 30 * 60
STATE_DIR = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "CoreWorkHub")
STATE_FILE = os.path.join(STATE_DIR, "launcher.json")
WHOLE_FILES = {"hub-config.json", "tickets.json"}
SAFE_NAME = re.compile(r"^[a-z0-9._-]+$")
# Export files dropped in <hub>\import\ for auto-import (read-only for the page).
TRAINING_NAME = re.compile(r"^[a-z0-9-]{1,40}\.(mp4|webm)$")
IMPORT_NAME = re.compile(r"^[\w .()&+-]{1,120}\.(csv|xlsx)$", re.IGNORECASE)


def windows_username():
    """DOMAIN\\user -> user, lowercase: the same rule the hub uses for change files."""
    name = os.environ.get("USERNAME") or getpass.getuser()
    return re.sub(r"[^a-z0-9._-]", "_", name.split("\\")[-1].lower())


def log(msg):
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(os.path.join(STATE_DIR, "launcher.log"), "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + msg + "\n")
    except OSError:
        pass


def replace_file(tmp, dest, tries=15):
    """Swap tmp in for dest. On a network share Windows refuses the swap while anyone has dest open (the hub
    reading it, Notepad, Explorer's preview, antivirus), so retry for a few seconds, then write dest in place."""
    for i in range(tries):
        try:
            os.replace(tmp, dest)
            return
        except PermissionError:
            time.sleep(0.2 * (i + 1) if i < 5 else 0.5)
    with open(tmp, "rb") as src:
        data = src.read()
    with open(dest, "r+b" if os.path.exists(dest) else "wb") as f:
        f.write(data)
        f.truncate()
        f.flush()
        os.fsync(f.fileno())
    try:
        os.remove(tmp)
    except OSError:
        pass


# ---------------------------------------------------------------- Windows account picture
def _sid():
    """The signed-in user's SID, e.g. S-1-5-21-..., via whoami (Windows only)."""
    try:
        out = subprocess.run(["whoami", "/user", "/fo", "csv", "/nh"], capture_output=True, text=True, timeout=5,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
        m = re.search(r"S-1-[0-9-]+", out)
        return m.group(0) if m else None
    except Exception:  # noqa: BLE001
        return None


def _jpegs_in(blob):
    """JPEGs embedded in an .accountpicture-ms file: each runs from one SOI marker to the last EOI before the next."""
    starts = [m.start() for m in re.finditer(rb"\xff\xd8\xff", blob)]
    out = []
    for i, a in enumerate(starts):
        b = starts[i + 1] if i + 1 < len(starts) else len(blob)
        end = blob.rfind(b"\xff\xd9", a, b)
        if end > a:
            out.append(blob[a:end + 2])
    return out


def windows_picture():
    """(bytes, content type) of the user's Windows account picture, or None.

    Windows keeps it in C:\\Users\\Public\\AccountPictures\\<SID>\\{id}-Image<size>.jpg, and the source in
    %APPDATA%\\Microsoft\\Windows\\AccountPictures\\*.accountpicture-ms. Only these fixed places are read."""
    dirs = []
    if os.environ.get("CWH_PICTURE_DIR"):  # tests
        dirs.append(os.environ["CWH_PICTURE_DIR"])
    elif os.name == "nt":
        sid = _sid()
        public = os.environ.get("PUBLIC", r"C:\Users\Public")
        if sid:
            dirs.append(os.path.join(public, "AccountPictures", sid))
        if os.environ.get("APPDATA"):
            dirs.append(os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "AccountPictures"))
    best = None  # (score, bytes, type): prefer the size closest to 192 px
    for d in dirs:
        try:
            names = os.listdir(d)
        except OSError:
            continue
        for fn in names:
            p = os.path.join(d, fn)
            low = fn.lower()
            try:
                if low.endswith((".jpg", ".jpeg", ".png")) and os.path.getsize(p) < 5_000_000:
                    m = re.search(r"image(\d+)", low)
                    size = int(m.group(1)) if m else 448
                    with open(p, "rb") as f:
                        data = f.read()
                    cand = (abs(size - 192), data, "image/png" if low.endswith(".png") else "image/jpeg")
                elif low.endswith(".accountpicture-ms") and os.path.getsize(p) < 10_000_000:
                    with open(p, "rb") as f:
                        jp = _jpegs_in(f.read())
                    if not jp:
                        continue
                    cand = (100, max(jp, key=len), "image/jpeg")  # the larger of the two (usually 448 px)
                else:
                    continue
            except OSError:
                continue
            if best is None or cand[0] < best[0]:
                best = cand
    return (best[1], best[2]) if best else None


class Hub:
    def __init__(self, folder, user):
        self.folder = os.path.abspath(folder)
        self.user = user
        self.key = secrets.token_urlsafe(24)
        self.last_seen = time.time()
        self.stop = None
        self.lock = threading.Lock()

    def path(self, name):
        return os.path.join(self.folder, name)


def make_handler(hub, port):
    origin_ok = {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "CoreWorkHub/1.0"

        def log_message(self, fmt, *args):  # keep quiet; errors go to launcher.log
            pass

        # ---------------------------------------------------------------- helpers
        def send_range(self, data, ctype):
            # Video players ask for byte ranges (seeking); answer them.
            rng = self.headers.get("Range")
            m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
            if not m or (not m.group(1) and not m.group(2)):
                return self.send(200, data, ctype, {"Accept-Ranges": "bytes"})
            size = len(data)
            if m.group(1):
                start = int(m.group(1))
                end = min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
            else:
                start = max(0, size - int(m.group(2)))
                end = size - 1
            if start >= size or start > end:
                return self.send(416, b"", ctype, {"Content-Range": f"bytes */{size}"})
            return self.send(206, data[start:end + 1], ctype, {"Accept-Ranges": "bytes", "Content-Range": f"bytes {start}-{end}/{size}"})

        def send(self, code, body=b"", ctype="application/json; charset=utf-8", extra=None):
            if isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def json(self, code, obj):
            self.send(code, json.dumps(obj))

        def authorized(self):
            origin = self.headers.get("Origin")
            if origin and origin not in origin_ok:
                return False
            return secrets.compare_digest(self.headers.get("X-Hub-Key", ""), hub.key)

        def body(self, limit=20 * 1024 * 1024):
            n = int(self.headers.get("Content-Length") or 0)
            if n > limit:
                raise ValueError("request too large")
            return self.rfile.read(n)

        # ---------------------------------------------------------------- routes
        def do_GET(self):
            hub.last_seen = time.time()
            url = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(url.query)
            if url.path in ("/", "/index.html"):
                # The page itself, straight from the shared folder (so an index.html update reaches everyone).
                try:
                    with open(hub.path("index.html"), "rb") as f:
                        return self.send(200, f.read(), "text/html; charset=utf-8", {"Content-Security-Policy": "frame-ancestors 'none'"})
                except OSError as e:
                    return self.send(500, f"Cannot read index.html in {hub.folder}: {e}", "text/plain; charset=utf-8")
            if url.path == "/favicon.ico":
                return self.send(204)
            if url.path.startswith("/training/"):
                # Lesson videos shipped next to the hub: <hub>\training\<lesson>.mp4 (read-only, no key needed).
                name = urllib.parse.unquote(url.path[len("/training/"):])
                if not TRAINING_NAME.match(name):
                    return self.send(404, "")
                try:
                    with open(os.path.join(hub.path("training"), name), "rb") as f:
                        data = f.read()
                except OSError:
                    return self.send(404, "")
                return self.send_range(data, "video/mp4" if name.endswith(".mp4") else "video/webm")
            if not url.path.startswith("/api/"):
                return self.send(404, "{}")
            if not self.authorized():
                return self.json(403, {"error": "This hub session belongs to another window. Use the desktop icon."})
            try:
                if url.path == "/api/whoami":
                    writable = os.access(hub.folder, os.W_OK)
                    return self.json(200, {"username": hub.user, "folder": hub.folder, "label": os.path.basename(hub.folder.rstrip("\\/")) or hub.folder, "writable": writable})
                if url.path == "/api/ping":
                    return self.json(200, {"ok": True})
                if url.path == "/api/import":
                    name = (q.get("name") or [""])[0]
                    if not IMPORT_NAME.match(name) or ".." in name:
                        return self.json(400, {"error": "not allowed"})
                    p = os.path.join(hub.path("import"), name)
                    try:
                        st = os.stat(p)
                    except FileNotFoundError:
                        return self.json(404, {"error": "not found"})
                    if q.get("stat"):
                        return self.json(200, {"lastModified": int(st.st_mtime * 1000), "size": st.st_size})
                    with open(p, "rb") as f:
                        return self.send(200, f.read(), "application/octet-stream")
                if url.path == "/api/windows-picture":
                    pic = windows_picture()
                    if not pic:
                        return self.json(404, {"error": "No Windows account picture found on this PC."})
                    return self.send(200, pic[0], pic[1])
                if url.path == "/api/file":
                    name = (q.get("name") or [""])[0]
                    if name not in WHOLE_FILES:
                        return self.json(400, {"error": "not allowed"})
                    try:
                        with open(hub.path(name), "rb") as f:
                            return self.send(200, f.read())
                    except FileNotFoundError:
                        return self.json(404, {"error": "not found"})
                if url.path == "/api/changes":
                    # List of change files with sizes, so the page reads only what's new.
                    d = hub.path("changes")
                    out = []
                    if os.path.isdir(d):
                        for fn in sorted(os.listdir(d)):
                            if fn.endswith(".jsonl") and SAFE_NAME.match(fn[:-6]):
                                st = os.stat(os.path.join(d, fn))
                                out.append({"user": fn[:-6], "size": st.st_size, "mtime": int(st.st_mtime * 1000)})
                    return self.json(200, out)
                if url.path == "/api/changes/read":
                    user = (q.get("user") or [""])[0]
                    offset = int((q.get("offset") or ["0"])[0])
                    if not SAFE_NAME.match(user):
                        return self.json(400, {"error": "bad name"})
                    p = os.path.join(hub.path("changes"), user + ".jsonl")
                    with open(p, "rb") as f:
                        f.seek(max(0, offset))
                        return self.send(200, f.read(), "text/plain; charset=utf-8")
            except Exception as e:  # noqa: BLE001 - report, don't crash the server
                log(f"GET {url.path} failed: {e!r}")
                return self.json(500, {"error": str(e)})
            return self.json(404, {"error": "unknown"})

        def do_PUT(self):
            hub.last_seen = time.time()
            url = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(url.query)
            if not self.authorized():
                return self.json(403, {"error": "forbidden"})
            name = (q.get("name") or [""])[0]
            if url.path != "/api/file" or name not in WHOLE_FILES:
                return self.json(400, {"error": "not allowed"})
            try:
                data = self.body()
                json.loads(data.decode("utf-8"))  # must be valid JSON
                tmp = hub.path(f"{name}.tmp-{secrets.token_hex(4)}")
                with open(tmp, "wb") as f:
                    f.write(data)
                replace_file(tmp, hub.path(name))  # swap in whole, so readers never see half a file
                return self.json(200, {"ok": True})
            except Exception as e:  # noqa: BLE001
                log(f"PUT {name} failed: {e!r}")
                return self.json(500, {"error": str(e)})

        def do_POST(self):
            hub.last_seen = time.time()
            url = urllib.parse.urlparse(self.path)
            if not self.authorized():
                return self.json(403, {"error": "forbidden"})
            if url.path == "/api/stop":
                # A newer launch for a different hub folder replaces this one.
                log("asked to stop by a newer launch")
                self.json(200, {"ok": True})
                if hub.stop:
                    threading.Thread(target=hub.stop, daemon=True).start()
                return None
            if url.path != "/api/changes/append":
                return self.json(404, {"error": "unknown"})
            try:
                lines = self.body(2 * 1024 * 1024).decode("utf-8")
                # Every line must be a JSON event; the file is always the logged-in user's own.
                for ln in lines.splitlines():
                    if ln.strip():
                        json.loads(ln)
                d = hub.path("changes")
                os.makedirs(d, exist_ok=True)
                p = os.path.join(d, hub.user + ".jsonl")
                with hub.lock:
                    prefix = ""
                    if os.path.exists(p) and os.path.getsize(p) > 0:
                        with open(p, "rb") as f:
                            f.seek(-1, os.SEEK_END)
                            if f.read(1) != b"\n":
                                prefix = "\n"
                    with open(p, "a", encoding="utf-8", newline="\n") as f:
                        f.write(prefix + lines if lines.endswith("\n") else prefix + lines + "\n")
                        f.flush()
                        os.fsync(f.fileno())
                return self.json(200, {"ok": True, "file": f"changes/{hub.user}.jsonl"})
            except Exception as e:  # noqa: BLE001
                log(f"append failed: {e!r}")
                return self.json(500, {"error": str(e)})

        def do_HEAD(self):
            return self.do_GET()

    return Handler


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = False


def free_port(preferred=47615):
    for p in [preferred] + list(range(preferred + 1, preferred + 40)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError("no free local port")


def open_browser(url, which):
    if which == "edge" and sys.platform == "win32":
        try:
            subprocess.Popen(["cmd", "/c", "start", "", "msedge", url], creationflags=0x08000000)
            return
        except OSError:
            pass
    if which != "none":
        webbrowser.open(url)


def already_running(user, folder):
    """If this user's launcher is already up for this hub folder, reuse it (one per person per PC).
    One left running for a different folder (e.g. the hub was moved) is told to stop."""
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            st = json.load(f)
        if st.get("user") != user:
            return None
        import urllib.request

        same = os.path.normcase(os.path.abspath(st.get("folder", ""))) == os.path.normcase(os.path.abspath(folder))
        if not same:
            try:
                req = urllib.request.Request(f"http://127.0.0.1:{st['port']}/api/stop", data=b"", method="POST", headers={"X-Hub-Key": st["key"]})
                urllib.request.urlopen(req, timeout=2).close()
                log(f"stopped the helper for {st.get('folder')} (now {folder})")
            except Exception:  # noqa: BLE001
                pass
            return None

        req = urllib.request.Request(f"http://127.0.0.1:{st['port']}/api/ping", headers={"X-Hub-Key": st["key"]})
        with urllib.request.urlopen(req, timeout=2) as r:
            if r.status == 200:
                return st
    except Exception:  # noqa: BLE001
        return None
    return None


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="Core Work Hub launcher")
    ap.add_argument("--folder", default=os.environ.get("CWH_FOLDER") or os.path.dirname(here), help="shared hub folder (default: the folder above this script)")
    ap.add_argument("--browser", default=os.environ.get("CWH_BROWSER", "edge"), choices=["edge", "default", "none"])
    ap.add_argument("--port", type=int, default=int(os.environ.get("CWH_PORT", "0") or 0))
    ap.add_argument("--user", default=os.environ.get("CWH_USER"), help=argparse.SUPPRESS)  # tests only
    args = ap.parse_args()

    user = args.user or windows_username()
    if not os.path.isfile(os.path.join(args.folder, "index.html")):
        log(f"index.html not found in {args.folder}")
        print(f"index.html not found in {args.folder}", file=sys.stderr)
        sys.exit(2)

    st = already_running(user, args.folder) if not args.port else None
    if st:
        open_browser(f"http://127.0.0.1:{st['port']}/#key={st['key']}", args.browser)
        return

    hub = Hub(args.folder, user)
    port = args.port or free_port()
    httpd = Server(("127.0.0.1", port), make_handler(hub, port))
    hub.stop = httpd.shutdown
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump({"port": port, "key": hub.key, "user": user, "folder": hub.folder, "pid": os.getpid()}, f)
    except OSError:
        pass
    log(f"started for {user} on 127.0.0.1:{port}, folder {hub.folder}")

    def idle_watch():
        while True:
            time.sleep(30)
            if time.time() - hub.last_seen > IDLE_EXIT_SECONDS:
                log("idle: stopping")
                httpd.shutdown()
                return

    threading.Thread(target=idle_watch, daemon=True).start()
    url = f"http://127.0.0.1:{port}/#key={hub.key}"
    print(f"CWH_READY {url}", flush=True)
    open_browser(url, args.browser)
    try:
        httpd.serve_forever(poll_interval=0.5)
    finally:
        httpd.server_close()
        try:
            with open(STATE_FILE, encoding="utf-8") as f:
                if json.load(f).get("pid") == os.getpid():
                    os.remove(STATE_FILE)
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    main()
