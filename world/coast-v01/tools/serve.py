"""Serve only review assets, the existing viewer libraries and the pilots' actual neighbours."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit,unquote
from pathlib import Path
import argparse
import tempfile
from context import prepare_background

from perimeter import BASE,ROOT,WORLD,TILES,source
import json

BOUNDARY={t['id'] for t in json.loads((ROOT/'perimetro.json').read_text('utf8'))['boundary']}
NEIGHBORS={t['id']:t for t in TILES if t['id'] in BOUNDARY}

class Review(SimpleHTTPRequestHandler):
    def translate_path(self,url):
        path=unquote(urlsplit(url).path).strip('/')
        if not path:return str(ROOT/'viewer/index.html')
        if path=='context.glb':return str(self.server.background)
        if path.startswith('neighbors/') and path.endswith('.glb'):
            key=path[10:-4]
            if key in NEIGHBORS:return str(source(NEIGHBORS[key]))
        routes={'vendor':WORLD/'world-visual-coherence-v12/viewer/vendor',
                'alpha':BASE/'game/alpha01/node_modules/three',
                'viewer':ROOT/'viewer','models':ROOT/'models'}
        prefix,_,name=path.partition('/')
        if prefix in routes:
            folder=routes[prefix].resolve()
            file=(folder/name).resolve()
            if file.is_relative_to(folder) and file.is_file():return str(file)
        if path in ('prototipos.json','perimetro.json'):return str(ROOT/path)
        return str(ROOT/'.missing')
    def list_directory(self,path):
        self.send_error(404)
    def log_message(self,*args):pass

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8816)
    args=parser.parse_args()
    with tempfile.TemporaryDirectory() as cache:
        server=ThreadingHTTPServer(('127.0.0.1',args.port),Review)
        server.background=Path(cache)/'context.glb'
        prepare_background(server.background)
        server.serve_forever()
