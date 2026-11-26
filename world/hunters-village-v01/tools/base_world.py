"""Read the pinned 170-tile source pack, or fetch an individual verified file on cache miss."""
import argparse
import hashlib
import json
import os
import subprocess
import tempfile
import threading
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
LOCAL=HERE.parent/'world-visual-coherence-v12'
CACHE=HERE/'.build/base'
LOCKS={}
LOCK=threading.Lock()
GIT_LOCK=threading.Lock()


def base_path():
    ptr=os.environ.get('WILDHAVEN_WORLD_V12')
    return Path(ptr) if ptr else (LOCAL if (LOCAL/'composition.json').is_file() else CACHE)


def resolve(key):
    src=json.loads((HERE/'base-source.json').read_text(encoding='utf8'))
    expected=src['files'].get(key)
    if expected is None:raise FileNotFoundError(key)
    with LOCK:lock=LOCKS.setdefault(key,threading.Lock())
    with lock:
        for root in [base_path(),CACHE]:
            f=root/key
            if f.is_file():
                with f.open('rb') as stream:
                    if hashlib.file_digest(stream,'sha256').hexdigest()==expected['sha256']:return f
        dest=CACHE/key;dest.parent.mkdir(exist_ok=True,parents=True)
        # Optional tiles can live in the original private repository. Use the normal
        # Git credential helper; never put access tokens in a browser or asset URL.
        gitdir=CACHE/'.source-git'
        env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never')
        def git(*args,stdout=subprocess.DEVNULL):
            subprocess.run(['git','-C',str(gitdir),*args],check=True,stdout=stdout,env=env,timeout=240)
        with GIT_LOCK:
            available=(gitdir.is_dir() and subprocess.run(
                ['git','-C',str(gitdir),'cat-file','-e',src['commit']+'^{commit}'],
                stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env).returncode==0)
            if not available:
                gitdir.mkdir(parents=True,exist_ok=True);git('init','--bare','--quiet')
                git('config','remote.origin.url','https://github.com/'+src['repository']+'.git')
                git('config','remote.origin.promisor','true');git('config','remote.origin.partialclonefilter','blob:none')
                git('fetch','--depth=1','--filter=blob:none','origin',src['commit'])
        fd,name=tempfile.mkstemp(dir=dest.parent)
        try:
            with os.fdopen(fd,'wb') as out:
                git('cat-file','blob',src['commit']+':world/world-visual-coherence-v12/'+key,stdout=out)
            tmp=Path(name)
            with tmp.open('rb') as stream:
                if hashlib.file_digest(stream,'sha256').hexdigest()!=expected['sha256']:
                    raise ValueError('SHA-256 inválido para '+key)
            tmp.replace(dest);return dest
        except subprocess.SubprocessError as exc:
            raise OSError('Git não conseguiu recuperar a peça da revisão fixada.') from exc
        finally:
            Path(name).unlink(missing_ok=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--all',action='store_true')
    args=parser.parse_args()
    site=json.loads((HERE/'site.json').read_text(encoding='utf8'))
    needed={'detailed/'+e['id'].lower()+'_v12.glb' for e in site['edges']}
    for key in json.loads((HERE/'base-source.json').read_text(encoding='utf8'))['files']:
        if args.all or key in needed or key in ['composition.json','manifest.json']:
            print(resolve(key),flush=True)

