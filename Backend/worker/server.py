"""Sandboxed video-editing worker.

POST /run  {"script": "...", "timeout_s": 120, "files": [{"name": "clip_1.mp4", "b64": "..."}]}
  → writes files to ./in/, runs the script with `python3 -I` in a throwaway directory under
    resource limits, and returns everything the script wrote to ./out/:
  ← {"exit_code": 0, "timed_out": false, "stdout": "...", "stderr": "...", "duration_ms": 1234,
     "outputs": [{"name": "final.mp4", "size": 123, "b64": "...", "probe": {...}}]}
GET /health → {"ok": true}

The worker is stateless: nothing survives a request. Isolation comes from the container
(no internet, read-only root, dropped capabilities, memory/CPU/pids limits) plus per-run
rlimits, a fresh temp dir and a minimal environment.
"""
from __future__ import annotations

import base64
import json
import os
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vidkit  # noqa: E402  (used for probing outputs)

MAX_BODY = int(os.environ.get("MAX_BODY_MB", "300")) * 1024 * 1024
MAX_OUTPUT = int(os.environ.get("MAX_OUTPUT_MB", "200")) * 1024 * 1024
MAX_TIMEOUT = int(os.environ.get("MAX_TIMEOUT_S", "300"))
CONCURRENCY = threading.Semaphore(int(os.environ.get("CONCURRENCY", "2")))
TAIL = 8000
MEDIA_EXT = {".mp4", ".mov", ".webm", ".mkv", ".mp3", ".wav", ".m4a", ".aac"}


def _limits(timeout: int):
    def apply():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (timeout * 4, timeout * 4))  # ffmpeg is multi-threaded
        resource.setrlimit(resource.RLIMIT_FSIZE, (1 << 30, 1 << 30))
        resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    return apply


def _safe_name(name: str) -> str:
    base = os.path.basename(name.replace("\\", "/"))
    base = "".join(c for c in base if c.isalnum() or c in "._-")
    if not base or base.startswith("."):
        raise ValueError(f"invalid file name: {name!r}")
    return base


def run_job(req: dict) -> dict:
    script = req.get("script") or ""
    if not script.strip():
        raise ValueError("script is required")
    timeout = max(5, min(MAX_TIMEOUT, int(req.get("timeout_s") or 120)))
    work = tempfile.mkdtemp(prefix="job-")
    try:
        os.makedirs(os.path.join(work, "in"))
        os.makedirs(os.path.join(work, "out"))
        for f in req.get("files") or []:
            with open(os.path.join(work, "in", _safe_name(f["name"])), "wb") as fh:
                fh.write(base64.b64decode(f["b64"]))
        with open(os.path.join(work, "script.py"), "w", encoding="utf-8") as fh:
            fh.write(script)
        env = {
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": work,
            "TMPDIR": work,
            "LANG": "C.UTF-8",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        start = time.monotonic()
        proc = subprocess.Popen([sys.executable, "-I", "script.py"], cwd=work, env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                preexec_fn=_limits(timeout))
        timed_out = False
        try:
            out, err = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGKILL)
            out, err = proc.communicate()
        duration_ms = int((time.monotonic() - start) * 1000)

        outputs, total = [], 0
        out_dir = os.path.join(work, "out")
        for name in sorted(os.listdir(out_dir)):
            p = os.path.join(out_dir, name)
            if not os.path.isfile(p):
                continue
            size = os.path.getsize(p)
            total += size
            if total > MAX_OUTPUT:
                err += f"\n[worker] output limit exceeded, dropped {name}"
                continue
            item = {"name": name, "size": size}
            if os.path.splitext(name)[1].lower() in MEDIA_EXT:
                try:
                    item["probe"] = vidkit.probe(p)
                except Exception as e:  # noqa: BLE001
                    item["probe_error"] = str(e)
            with open(p, "rb") as fh:
                item["b64"] = base64.b64encode(fh.read()).decode()
            outputs.append(item)
        return {
            "exit_code": proc.returncode,
            "timed_out": timed_out,
            "stdout": out[-TAIL:],
            "stderr": err[-TAIL:],
            "duration_ms": duration_ms,
            "outputs": outputs,
        }
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "vidkit-worker/1"

    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            return self._send(200, {"ok": True})
        self._send(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/run":
            return self._send(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._send(413, {"error": f"body must be 1..{MAX_BODY} bytes"})
        try:
            req = json.loads(self.rfile.read(length))
        except Exception as e:  # noqa: BLE001
            return self._send(400, {"error": f"invalid JSON: {e}"})
        with CONCURRENCY:
            try:
                res = run_job(req)
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            except Exception as e:  # noqa: BLE001
                return self._send(500, {"error": f"{type(e).__name__}: {e}"})
        self._send(200, res)

    def log_message(self, fmt, *args):
        sys.stderr.write("[worker] " + (fmt % args) + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"[worker] listening on :{port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
