#!/usr/bin/env python3
"""
TMPT Dev Server — Python HTTP server dengan no-cache headers.
Gunakan ini untuk development agar perubahan file langsung terlihat di browser.

Perbaikan Windows 11:
- allow_reuse_address = True: mencegah error "Address already in use" saat restart.
- ThreadingMixIn: handle multiple request secara bersamaan (tidak blocking).
- Fallback port: jika port utama terpakai, coba port berikutnya otomatis.
"""

import sys
import os
import socket
import socketserver
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Handler HTTP dengan header no-cache untuk dev server."""

    def end_headers(self) -> None:
        """Tambahkan header no-cache sebelum mengirim response."""
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        """Tampilkan log lebih ringkas di terminal."""
        path = args[0].split('"')[1] if '"' in args[0] else args[0]
        print(f"  {args[1]}  {path}")


class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    """
    HTTP server dengan threading untuk handle concurrent requests.
    Kompatibel Windows 11 — mengatasi isu socket blocking.
    """

    # Mencegah error "Address already in use" saat server di-restart
    allow_reuse_address = True
    # Tutup koneksi daemon thread saat server berhenti
    daemon_threads = True


def find_free_port(start_port: int) -> int:
    """Cari port yang tersedia mulai dari start_port."""
    port = start_port
    while port < start_port + 10:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("", port))
                return port
            except OSError:
                port += 1
    raise OSError(f"Tidak ada port tersedia dari {start_port} hingga {start_port + 9}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    port = find_free_port(PORT)
    if port != PORT:
        print(f"[TMPT Dev] Port {PORT} terpakai, beralih ke port {port}.")

    print(f"[TMPT Dev] Server berjalan di http://localhost:{port}")
    print(f"[TMPT Dev] No-cache aktif — setiap request akan mengambil file terbaru.")
    print(f"[TMPT Dev] Tekan Ctrl+C untuk berhenti.\n")

    try:
        with ThreadingHTTPServer(("", port), NoCacheHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[TMPT Dev] Server dihentikan.")

