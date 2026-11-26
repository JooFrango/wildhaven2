#!/usr/bin/env python3
"""Build four inspected, animation-preserving geometric LOD tiers from real sources."""
from __future__ import annotations
import argparse,json,hashlib,collections
from pathlib import Path
from generate_species import generate,SPECS
from optimize import optimize_glb,load_glb,source_stats
from render_glb import render

TARGETS={
    'talvero':(24500,9500,3400),
    'rambrel':(21000,8200,3100),
    'rambrel_chapadas':(23500,9000,3400),
    'turvagal':(22500,8600,3200),
}

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
 p.add_argument('--only',choices=['talvero',*SPECS])
 p.add_argument('--no-render',action='store_true')
 arg=p.parse_args();root=arg.root.resolve()
 src_dir=root/'assets/models/creatures'
 build=root/'tmp-savanna-build/source'
 for id in ([arg.only] if arg.only else TARGETS):
  if id=='talvero':
    source=src_dir/id/'talvero-savanna-anatomy-skinned-v04.glb'
  else:
    source,_=generate(id,build/id)
  output=src_dir/id
  output.mkdir(parents=True,exist_ok=True)
  records=[]
  for i,budget in enumerate(TARGETS[id]):
    version='v05' if id=='talvero' else 'v03'
    out=output/f'{id}-savanna-animated-{version}-LOD{i}.glb'
    info=optimize_glb(source,out,1.,budget,f'LOD{i}')
    info['path']=out.relative_to(root).as_posix()
    assert info['skinJointCounts']==[17]
    assert len(info['animationNames'])==(10 if id=='talvero' else 11)
    assert info['triangles'] < info['originalTriangles']*.55
    records.append(info)
    print('LOD',id,i,info['triangles'],'triangles',info['bytes'],'bytes',flush=True)
  if not arg.no_render:
   for angle in ('side','three_quarter','front'):
     png=output/f'{id}-real-3d-{angle}-lowpoly-v05.png'
     val=render(output/f'{id}-savanna-animated-{version}-LOD0.glb',png,angle)
     print('RENDER',id,angle,png.stat().st_size,flush=True)
  result={
    'id':id,'version':version,'status':'artistic_review_pending','proposedStyle':'organic_midpoly',
    'source':source.relative_to(root).as_posix() if source.is_relative_to(root) else str(source),
    'lods':records,'fullSourceRetained':True,
    'animations':records[0]['animationNames'],
    'skinnedJoints':17,
    'integration':{'gameplay':False,'spawns':False,'ai':False},
    'method':'quadric surface simplification + normal recompute + joint and color projection; original GLB skin and animation channels preserved',
    'note':'Counts reflect actual exported GLB polygons. Pixel fidelity requires review. No gameplay changes.'
  }
  manifest=output/f'{id}-lowpoly-manifest-v05.json'
  manifest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
  print('PUBLISHED LOCAL',manifest,flush=True)
if __name__=='__main__':main()