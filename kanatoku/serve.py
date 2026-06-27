#!/usr/bin/env python3
# ローカル確認用の簡易サーバ。  python3 serve.py  で起動し、
# 同じMacのブラウザで http://localhost:8000 を開く。
# スマホで開く場合は、このフォルダごと iPhone/Android に送って index.html を直接開くのが手軽。
import os, http.server, socketserver

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8000"))

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f"かなトク！ → http://localhost:{PORT}  (Ctrl+C で停止)")
    httpd.serve_forever()
