#!/usr/bin/env python3
# Trigger optimization workflow after registration.
from __future__ import annotations
import argparse, importlib.util, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve()
BASE_PATH=HERE.parents[2]/"fauna-optimization-v01/source/pipeline.py"
PRES_PATH=HERE.parents[2]/"fauna-optimization-v05/source/optimize_pair.py"
spec=importlib.util.spec_from_file_location("fauna_base",BASE_PATH)
base=importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
spec2=importlib.util.spec_from_file_location("pres_base",PRES_PATH)
pres=importlib.util.module_from_spec(spec2); spec2.loader.exec_module(pres)

CFG={
  "species":"tufrilo","variant":"temperate-forest","version":"v02",
  "source":"assets/models/creatures/tufrilo/tufrilo_animated_v01.glb",
  "existingLod1":"assets/models/creatures/tufrilo/tufrilo_LOD1_animated_v01.glb",
  "prefix":"tufrilo-optimized-v02","budgets":[8300,5200,2000]
}

def build(root):
    source=root/CFG["source"]; before=base.glb_stats(source)
    d,b=base.load_glb(source); sig=base.animation_signature(d,b)
    existing=base.glb_stats(root/CFG["existingLod1"])
    lods=[]
    for i,budget in enumerate(CFG["budgets"]):
        dest=source.parent/f'{CFG["prefix"]}-LOD{i}.glb'
        rec=pres.preserve_layout_optimize(source,dest,budget,i,CFG["prefix"])
        lods.append(rec)
        print("BUILT",i,rec["trianglesDrawnPerInstance"],rec["estimatedDrawCalls"],rec["bytes"],flush=True)
    previews={}
    lod0=source.parent/f'{CFG["prefix"]}-LOD0.glb'
    for angle in ("side","front","three-quarter"):
        a="three_quarter" if angle=="three-quarter" else angle
        p=source.parent/f'{CFG["prefix"]}-real-3d-{angle}.png'
        previews[angle]=base.render(lod0,p,a)
    p=source.parent/f'{CFG["prefix"]}-real-3d-wireframe.png'
    previews["wireframe"]=base.render(lod0,p,"three_quarter",wire=True)
    return {
      "species":CFG["species"],"variant":CFG["variant"],"version":CFG["version"],
      "source":CFG["source"],"sourceStats":before,"existingPublishedLod1":existing,
      "animationSignature":sig,"lods":lods,"previews":previews,
      "method":"preserve-layout",
      "integration":{"gameplay":False,"spawn":False,"world":False,"alpha01Touched":False},
      "artisticStatus":"optimized_candidate_pending_user_preview_approval"
    }

def validate(root,m):
    source=root/CFG["source"]; d,b=base.load_glb(source)
    sig=base.animation_signature(d,b); src=base.glb_stats(source)
    errs=[]; last=10**18
    for i in range(3):
        p=source.parent/f'{CFG["prefix"]}-LOD{i}.glb'
        d2,b2=base.load_glb(p); st=base.glb_stats(p)
        if st["sha256"]!=m["lods"][i]["sha256"]:errs.append(f"hash {i}")
        if base.animation_signature(d2,b2)!=sig:errs.append(f"animation {i}")
        if st["animations"]!=src["animations"]:errs.append(f"clips {i}")
        if st["skins"]!=src["skins"] or st["skinJointCounts"]!=src["skinJointCounts"]:errs.append(f"skin {i}")
        if st["estimatedDrawCalls"]!=src["estimatedDrawCalls"]:errs.append(f"drawcalls {i}")
        if st["trianglesDrawnPerInstance"]>=last:errs.append(f"lod order {i}")
        last=st["trianglesDrawnPerInstance"]
    for name in ("side","front","three-quarter","wireframe"):
        p=source.parent/f'{CFG["prefix"]}-real-3d-{name}.png'
        if not p.exists() or p.stat().st_size<15000:errs.append(f"preview {name}")
    if errs: raise RuntimeError("tufrilo validation failed: "+", ".join(errs))

def benchmark(root,m):
    out={"species":"tufrilo","variant":"temperate-forest","source":m["sourceStats"],"instances":[10,25,50,100,200,500],"lods":[]}
    for i,r in enumerate(m["lods"]):
        out["lods"].append({"lod":i,"triangles":r["trianglesDrawnPerInstance"],"drawCalls":r["estimatedDrawCalls"],
          "scenarios":[{"instances":n,"trianglesPerFrame":n*r["trianglesDrawnPerInstance"],"drawCallsPerFrame":n*r["estimatedDrawCalls"]} for n in out["instances"]]})
    (root/"assets/models/creatures/fauna-optimization-v10/tufrilo-structural-benchmark-v02.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")

def poster(root):
    outdir=root/"assets/models/creatures/fauna-optimization-v10/previews";outdir.mkdir(parents=True,exist_ok=True)
    src=root/"assets/models/creatures/tufrilo/tufrilo-optimized-v02-real-3d-three-quarter.png"
    W,H=1200,650;canvas=Image.new("RGB",(W,H),(232,233,227));d=ImageDraw.Draw(canvas)
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",22)
    d.text((24,18),"Tufrilo · preview real do GLB otimizado",fill=(43,50,48),font=font)
    im=Image.open(src).convert("RGB");im.thumbnail((1050,500))
    x=(W-im.width)//2;y=80+(500-im.height)//2;canvas.paste(im,(x,y))
    dest=outdir/"Wildhaven_Tufrilo_Real_Preview.png";canvas.save(dest,optimize=True);return dest

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",type=Path,default=Path("."));a=ap.parse_args();root=a.root.resolve()
    m=build(root);validate(root,m)
    (root/"assets/models/creatures/tufrilo/tufrilo-optimization-manifest-v02.json").write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n")
    benchmark(root,m);p=poster(root);base.audit(root)
    print(json.dumps({"ok":True,"poster":str(p.relative_to(root)),"manifest":m},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
