import http.server
import socketserver
import os
import sys

PORT = 8000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        if code == 404:
            # Cari file 404.html di direktori root saat ini
            root_404 = os.path.join(os.getcwd(), '404.html')
            if os.path.exists(root_404):
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                # Hapus header cache agar selalu memuat perubahan terbaru saat dev
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.end_headers()
                try:
                    with open(root_404, 'rb') as f:
                        self.wfile.write(f.read())
                    return
                except Exception as e:
                    print(f"Error serving 404.html: {e}", file=sys.stderr)
        
        super().send_error(code, message, explain)

# Gunakan port dari argumen baris perintah jika ada
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

Handler = CustomHTTPRequestHandler

# Izinkan penggunaan kembali alamat port agar tidak terjadi error 'address already in use'
socketserver.TCPServer.allow_reuse_address = True

print(f"TMPT local development server running on http://localhost:{PORT}")
print("Custom 404 handler is active. Press Ctrl+C to stop.")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
