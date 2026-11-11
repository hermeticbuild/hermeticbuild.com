"""Serve the local prototypes with live reload for the original website."""

import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
WEBSITE = ROOT / "website"
RELOAD_PATH = "/__preview_version"
WATCHED_SUFFIXES = {
    ".html", ".css", ".js", ".svg", ".png", ".jpg", ".webp",
    ".woff", ".woff2", ".otf",
}
RELOAD_SCRIPT = """
<script>
  (() => {
    const initialVersion = 'VERSION';
    async function checkForChanges() {
      try {
        const response = await fetch('/__preview_version', { cache: 'no-store' });
        if (response.ok && await response.text() !== initialVersion) {
          location.reload();
          return;
        }
      } catch {
        // Keep polling while the local server restarts.
      }
      setTimeout(checkForChanges, 750);
    }
    setTimeout(checkForChanges, 750);
  })();
</script>
"""


def revision():
    digest = hashlib.sha256()
    for path in sorted(WEBSITE.glob("**/*")):
        if path.suffix.lower() not in WATCHED_SUFFIXES:
            continue
        try:
            stat = path.stat()
        except FileNotFoundError:
            continue
        digest.update(f"{path.relative_to(WEBSITE)}:{stat.st_mtime_ns}:{stat.st_size}\n".encode())
    return digest.hexdigest()


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        route = urlsplit(self.path).path
        if route == RELOAD_PATH:
            payload = revision().encode()
            content_type = "text/plain"
        elif route in {"/website/", "/website/index.html"}:
            script = RELOAD_SCRIPT.replace("VERSION", revision())
            html = (WEBSITE / "index.html").read_text(encoding="utf-8")
            payload = html.replace("</body>", script + "</body>", 1).encode()
            content_type = "text/html; charset=utf-8"
        else:
            return super().send_head()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return BytesIO(payload)

    def log_request(self, code="-", size="-"):
        if urlsplit(self.path).path != RELOAD_PATH or code != 200:
            super().log_request(code, size)


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 8765), PreviewHandler) as server:
        print("Live preview: http://127.0.0.1:8765/website/", flush=True)
        server.serve_forever()
