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

CONFIGS=[
  {
    "key":"cavoru_forest","species":"cavoru","variant":"temperate_forest","version":"v02",
    "source":"assets/models/creatures/cavoru/cavoru_forest_animated_v01.glb",
    "existingLod1":"assets/models/creatures/cavoru/cavoru_forest_LOD1_animated_v01.glb",
    "prefix":"cavoru-forest-optimized-v02","budgets":[18500,9000,3500]
  },
  {
    "key":"cavoru_plains","species":"cavoru","variant":"plains","version":"v02",
    "source":"assets/models/creatures/cavoru/cavoru_plains_animated_v01.glb",
    "existingLod1":"assets/models/creatures/cavoru/cavoru_plains_LOD1_animated_v01.glb",
    "prefix":"cavoru-plains-optimized-v02","budgets":[16500,8000,3200]
  },
  {
    "key":"nharuk_tropical","species":"nharuk","variant":"tropical","version":"v03",
    "source":"assets/models/creatures/nharuk/v02/nharuk_tropical_animated_v02.glb",
    "existingLod1":"assets/models/creatures/nharuk/v02/nharuk_tropical_LOD1_animated_v02.glb",
    "prefix":"nharuk-tropical-optimized-v03","budgets":[16000,8000,3200]
  },
  {
    "key":"nharuk_temperate","species":"nharuk","variant":"temperate_plains","version":"v03",
    "source":"assets/models/creatures/nharuk/v02/nharuk_temperate_plains_animated_v02.glb",
    "existingLod1":"assets/models/creatures/nharuk/v02/nharuk_temperate_plains_LOD1_animated_v02.glb",
    "prefix":"nharuk-temperate-plains-optimized-v03","budgets":[16000,8000,3200]
  }
]

def build(root,cfg):
    source=root/cfg["source"]; before=base.glb_stats(source)
    d,b=base.load_glb(source); sig=base.animation_signature(d,b)
    existing=base.glb_stats(root/cfg["existingLod1"])
    lods=[]
    for i,budget in enumerate(cfg["budgets"]):
        dest=source.parent/f'{cfg["prefix"]}-LOD{i}.glb'
        rec=pres.preserve_layout_optimize(source,dest,budget,i,cfg["prefix"])
        lods.append(rec)
        print("BUILT",cfg["key"],i,rec["trianglesDrawnPerInstance"],rec["estimatedDrawCalls"],rec["bytes"],flush=True)
    previews={}
    lod0=source.parent/f'{cfg["prefix"]}-LOD0.glb'
    for angle in ("side","front","three-quarter"):
        a="three_quarter" if angle=="three-quarter" else angle
        p=source.parent/f'{cfg["prefix"]}-real-3d-{angle}.png'
        previews[angle]=base.render(lod0,p,a)
    p=source.parent/f'{cfg["prefix"]}-real-3d-wireframe.png'
    previews["wireframe"]=base.render(lod0,p,"three_quarter",wire=True)
    return {
      "species":cfg["species"],"variant":cfg["variant"],"version":cfg["version"],
      "source":cfg["source"],"sourceStats":before,
      "existingPublishedLod1":existing,
      "animationSignature":sig,"lods":lods,"previews":previews,
      "method":"preserve-layout",
      "integration":{"gameplay":False,"spawn":False,"world":False,"alpha01Touched":False},
      "artisticStatus":"optimized_candidate_pending_user_preview_approval"
    }

def validate(root,cfg,m):
    source=root/cfg["source"]; d,b=base.load_glb(source)
    sig=base.animation_signature(d,b); src=base.glb_stats(source)
    errs=[]; last=10**18
    for i in range(3):
        p=source.parent/f'{cfg["prefix"]}-LOD{i}.glb'
        d2,b2=base.load_glb(p); st=base.glb_stats(p)
        if st["sha256"]!=m["lods"][i]["sha256"]:errs.append(f"hash {i}")
        if base.animation_signature(d2,b2)!=sig:errs.append(f"animation {i}")
        if st["animations"]!=src["animations"]:errs.append(f"clips {i}")
        if st["skins"]!=src["skins"] or st["skinJointCounts"]!=src["skinJointCounts"]:errs.append(f"skin {i}")
        if st["estimatedDrawCalls"]!=src["estimatedDrawCalls"]:errs.append(f"drawcalls {i}")
        if st["trianglesDrawnPerInstance"]>=last:errs.append(f"lod order {i}")
        last=st["trianglesDrawnPerInstance"]
    for name in ("side","front","three-quarter","wireframe"):
        p=source.parent/f'{cfg["prefix"]}-real-3d-{name}.png'
        if not p.exists() or p.stat().st_size<18000:errs.append(f"preview {name}")
    if errs: raise RuntimeError(cfg["key"]+" validation failed: "+", ".join(errs))

def benchmark(root,path,m):
    out={"species":m["species"],"variant":m["variant"],"source":m["sourceStats"],"instances":[10,25,50,100,200],"lods":[]}
    for i,r in enumerate(m["lods"]):
        out["lods"].append({"lod":i,"triangles":r["trianglesDrawnPerInstance"],"drawCalls":r["estimatedDrawCalls"],
          "scenarios":[{"instances":n,"trianglesPerFrame":n*r["trianglesDrawnPerInstance"],"drawCallsPerFrame":n*r["estimatedDrawCalls"]} for n in out["instances"]]})
    (root/path).write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")

def sheet(root):
    outdir=root/"assets/models/creatures/fauna-optimization-v08/previews";outdir.mkdir(parents=True,exist_ok=True)
    cards=[
      ("Cavoru · floresta",root/"assets/models/creatures/cavoru/cavoru-forest-optimized-v02-real-3d-three-quarter.png"),
      ("Nharuk · tropical",root/"assets/models/creatures/nharuk/v02/nharuk-tropical-optimized-v03-real-3d-three-quarter.png")
    ]
    W,H=1200,650;canvas=Image.new("RGB",(W,H),(232,233,227));d=ImageDraw.Draw(canvas)
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",22)
    for i,(title,p) in enumerate(cards):
        d.text((24+i*590,18),title,fill=(43,50,48),font=font)
        im=Image.open(p).convert("RGB");im.thumbnail((540,500))
        x=25+i*590+(540-im.width)//2;y=75+(500-im.height)//2
        canvas.paste(im,(x,y))
    dest=outdir/"Wildhaven_Cavoru_Nharuk_Real_Previews.png";canvas.save(dest,optimize=True);return dest

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",type=Path,default=Path("."));a=ap.parse_args();root=a.root.resolve()
    ms={}
    for cfg in CONFIGS:
        m=build(root,cfg);validate(root,cfg,m);ms[cfg["key"]]=m
    cavoru={"species":"cavoru","version":"v02","variants":{"forest":ms["cavoru_forest"],"plains":ms["cavoru_plains"]}}
    nharuk={"species":"nharuk","version":"v03","sourceAnatomy":"v02","variants":{"tropical":ms["nharuk_tropical"],"temperate_plains":ms["nharuk_temperate"]}}
    (root/"assets/models/creatures/cavoru/cavoru-optimization-manifest-v02.json").write_text(json.dumps(cavoru,ensure_ascii=False,indent=2)+"\n")
    (root/"assets/models/creatures/nharuk/v02/nharuk-optimization-manifest-v03.json").write_text(json.dumps(nharuk,ensure_ascii=False,indent=2)+"\n")
    for cfg in CONFIGS:
        benchmark(root, f'assets/models/creatures/fauna-optimization-v08/{cfg["key"]}-structural-benchmark.json', ms[cfg["key"]])
    sh=sheet(root);base.audit(root)
    print(json.dumps({"ok":True,"sheet":str(sh.relative_to(root)),"manifests":ms},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
