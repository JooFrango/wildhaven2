#!/usr/bin/env python3
"""Reproducible lowpoly pipeline: four unique source sculpts -> 12 skinned animated GLBs.

Never touches map, game or previously published GLBs. Source is regenerated in
workspace and exported GLBs rendered for actual geometry previews.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from generate_species import generate,SPECS
from optimize import optimize_glb
from render_glb import render

ROOT=Path(__file__).resolve().parents[1]
BUDGETS={
 'torvardo':(4000,2600,1250),
 'raizauro':(4000,2600,1200),
 'mastelio':(3500,2200,900),
 'garruva':(3500,2200,1000)
}
CLASSES={'torvardo':'large-herbivore-grazer','raizauro':'large-herbivore-digger',
  'mastelio':'large-herbivore-frugivore','garruva':'large-terrestrial-scavenger-reptile'}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=ROOT)
 ap.add_argument('--only',choices=list(SPECS));ap.add_argument('--no-render',action='store_true')
 args=ap.parse_args();root=args.root.resolve()
 for sid in ([args.only] if args.only else SPECS):
  src,srcinfo=generate(sid,root/'sources'/sid)
  outdir=root/'models'/sid;outdir.mkdir(parents=True,exist_ok=True)
  record=[]
  for i,budget in enumerate(BUDGETS[sid]):
   output=outdir/f'{sid}-savanna-animated-v02-LOD{i}.glb'
   result=optimize_glb(src,output,1.0,budget,f'LOD{i}')
   assert result['skinJointCounts'] and result['skinJointCounts'][0]>=17
   assert len(result['animationNames'])==(13 if sid=='garruva' else 12)
   assert result['triangles'] <=budget*1.16
   result['path']=f'assets/models/creatures/{sid}/{output.name}'
   result['sourcePath']=src.relative_to(root).as_posix()
   record.append(result)
   print('LOD',sid,i,result['triangles'],result['bytes'],'bytes',flush=True)
  if not args.no_render:
   for angle in ('side','three_quarter','front'):
    output=root/'previews'/f'{sid}-real-3d-{angle}-v02.png'
    info=render(outdir/f'{sid}-savanna-animated-v02-LOD0.glb',output,angle,width=1100,height=840)
    assert output.stat().st_size>20000
    print('RENDER GLB',sid,angle,info['bytes'],flush=True)
  manifest={'id':sid,'category':CLASSES[sid],'status':'rebuild_v02_in_artistic_review',
    'approvedConcept':True,'approvedModel':False,'version':'v02',
    'sourceGeometryTriangles':srcinfo['triangles'],
    'sourceGeometrySha256':hashlib.sha256(src.read_bytes()).hexdigest(),
    'clipCount':len(record[0]['animationNames']),
    'clipNames':record[0]['animationNames'],'skinJoints':srcinfo['skinJoints'],
    'lods':record,'realScreenshots':[f'{sid}-real-3d-{a}-v02.png' for a in ('side','front','three_quarter')],
    'gameplayIntegrated':False,'renderSource':'Final exported LOD0 GLB, via VTK offscreen rasterizer',
    'limits':['LOD tests only validate structure; visual review required','clipped in-place root; no terrain IK','no gameplay/spawn AI']}
  (outdir/f'{sid}-manifest-v02.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('READY: four creatures, 12 GLBs, 4 manifests, 12 true GLB preview PNGs',flush=True)
if __name__=='__main__':main()