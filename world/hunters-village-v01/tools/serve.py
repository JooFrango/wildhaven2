"""Serve the dedicated village viewer and its immutable, SHA-256 checked v12 dependencies."""
import argparse
import functools
import os
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote,urlsplit

from base_world import HERE,resolve

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.pinned=None
        path=unquote(urlsplit(self.path).path)
        if path=='/':
            self.send_response(302);self.send_header('Location','/world/hunters-village-v01/viewer/');self.end_headers();return
        marker='/world/world-visual-coherence-v12/'
        if path.startswith(marker):
            try:self.pinned=resolve(path[len(marker):])
            except FileNotFoundError:self.send_error(404);return
            except (ValueError,OSError,subprocess.SubprocessError) as exc:self.send_error(502,str(exc));return
        elif not path.startswith('/world/hunters-village-v01/'):
            self.send_error(404);return
        super().do_GET()

    def translate_path(self,url):
        if getattr(self,'pinned',None):return str(self.pinned)
        prefix='/world/hunters-village-v01/'
        rel=unquote(urlsplit(url).path)[len(prefix):]
        path=(HERE/rel).resolve()
        if not path.is_relative_to(HERE) or '.build' in path.parts or '__pycache__' in path.parts:return str(HERE/'__invalid__')
        return str(path)

    def list_directory(self,path):
        self.send_error(404);return None

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8799);parser.add_argument('--world',type=Path)
    args=parser.parse_args()
    if args.world:os.environ['WILDHAVEN_WORLD_V12']=str(args.world.resolve())
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'http://127.0.0.1:{args.port}/world/hunters-village-v01/viewer/',flush=True)
    server.serve_forever()

