"""Compare published binaries and previews against a fresh authenticated, sparse GitHub checkout."""
import argparse
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
ROOT=HERE.parents[1]


def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('commit');args=parser.parse_args()
    if len(args.commit)!=40 or any(c not in '0123456789abcdef' for c in args.commit):
        raise ValueError('Informe o SHA completo do commit publicado.')
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
    site=json.loads((HERE/'site.json').read_text(encoding='utf8'))
    paths=[HERE/x['file'] for x in manifest['files']]
    paths += [HERE/'Wildhaven_Vila_Hunters.blend',*sorted((HERE/'preview').glob('*.png'))]
    source=HERE.parent/'world-visual-coherence-v12'
    paths += [source/'models/world_170_v12.glb']+[source/'detailed'/(e['id'].lower()+'_v12.glb') for e in site['edges']]
    result=[]
    env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never')
    with tempfile.TemporaryDirectory(prefix='wildhaven-published-',ignore_cleanup_errors=True) as tmp:
        def git(*cmd,**kwargs):
            return subprocess.run(['git','-C',tmp,*cmd],check=True,env=env,**kwargs)
        git('init','--quiet')
        git('remote','add','origin','https://github.com/carioca1111/wildhaven-new.git')
        git('config','remote.origin.promisor','true');git('config','remote.origin.partialclonefilter','blob:none')
        git('fetch','--depth=1','--filter=blob:none','origin',args.commit)
        rels=[p.relative_to(ROOT).as_posix() for p in paths]
        git('sparse-checkout','set','--no-cone','--stdin',input=''.join('/'+r+'\n' for r in rels),text=True)
        git('checkout','--quiet','--detach','FETCH_HEAD')
        assert git('rev-parse','HEAD',capture_output=True,text=True).stdout.strip()==args.commit
        for path,rel in zip(paths,rels):
            remote=Path(tmp)/rel
            SHA=digest(remote)
            assert SHA==digest(path) and remote.stat().st_size==path.stat().st_size,rel
            result.append(dict(file=rel,sha256=SHA,bytes=path.stat().st_size))
    report=dict(repository='carioca1111/wildhaven-new',commit=args.commit,method='fresh sparse GitHub checkout',downloaded=result)
    (HERE/'tests/remote.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('Verified',len(result),'published files against local SHA-256.')

if __name__=='__main__':main()

