#!/usr/bin/env python3
"""
TMPT Dev Server — Python HTTP server dengan no-cache headers.
Gunakan ini untuk development agar perubahan file langsung terlihat di browser.
"""

import sys
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        # Tampilkan log lebih ringkas
        path = args[0].split('"')[1] if '"' in args[0] else args[0]
        print(f"  {args[1]}  {path}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print(f"[TMPT Dev] Server berjalan di http://localhost:{PORT}")
    print(f"[TMPT Dev] No-cache aktif — setiap request akan mengambil file terbaru.")
    print(f"[TMPT Dev] Tekan Ctrl+C untuk berhenti.\n")
    HTTPServer(("", PORT), NoCacheHandler).serve_forever()
