#!/usr/bin/env python3
from __future__ import annotations
import argparse, importlib.util, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve()
PREV=HERE.parents[2]/"fauna-optimization-v02/source/optimize_pair.py"
spec=importlib.util.spec_from_file_location("pair_base",PREV)
pair=importlib.util.module_from_spec(spec); spec.loader.exec_module(pair)
base=pair.base

CONFIGS={
  "nivelio":{
    "species":"nivelio","variant":"snow-mountain","version":"v02",
    "source":"assets/models/creatures/detritivoros/nivelio-animated.glb",
    "budgets":[2400,1200,500],
    "prefix":"nivelio-optimized-v02",
    "actionSuffixes":["feed","flee"]
  },
  "dunebrio":{
    "species":"dunebrio","variant":"desert","version":"v02",
    "source":"assets/models/creatures/detritivoros/dunebrio-animated.glb",
    "budgets":[3000,1500,600],
    "prefix":"dunebrio-optimized-v02",
    "actionSuffixes":["feed","defend"]
  }
}

def resolve_action(animations,suffix):
    for name in animations:
        if name==suffix or name.endswith("_"+suffix): return name
    raise RuntimeError("animation suffix not found: "+suffix+" in "+repr(animations))

def build_one(root,key,cfg):
    source=root/cfg["source"]; folder=source.parent
    before=base.glb_stats(source)
    sd,sb=base.load_glb(source); sig=base.animation_signature(sd,sb)
    actions=[resolve_action(before["animations"],s) for s in cfg["actionSuffixes"]]
    records=[]
    for i,budget in enumerate(cfg["budgets"]):
        dest=folder/f'{cfg["prefix"]}-LOD{i}.glb'
        rec=pair.generic_optimize(source,dest,budget,i,cfg["prefix"])
        records.append(rec)
        print("BUILT",key,i,rec["trianglesDrawnPerInstance"],rec["estimatedDrawCalls"],rec["bytes"],flush=True)
    previews={}
    lod0=folder/f'{cfg["prefix"]}-LOD0.glb'
    for angle in ("side","front","three-quarter"):
        a="three_quarter" if angle=="three-quarter" else angle
        p=folder/f'{cfg["prefix"]}-real-3d-{angle}.png'
        previews[angle]=base.render(lod0,p,a)
    p=folder/f'{cfg["prefix"]}-real-3d-wireframe.png'
    previews["wireframe"]=base.render(lod0,p,"three_quarter",wire=True)
    for action,phase in ((actions[0],.55),(actions[1],.42)):
        p=folder/f'{cfg["prefix"]}-real-3d-{action}.png'
        previews[action]=base.render(lod0,p,"three_quarter",action,phase)
    return {
      "species":cfg["species"],"variant":cfg["variant"],"version":cfg["version"],
      "source":cfg["source"],"sourceStats":before,"animationSignature":sig,
      "resolvedPreviewActions":actions,"lods":records,"previews":previews,
      "method":[
        "batch static child meshes by animated parent + material",
        "bake local transforms before batching",
        "VTK quadric decimation with volume preservation",
        "nearest-surface transport of retained vertex attributes",
        "preserve animation sampler arrays and clip names"
      ],
      "integration":{"gameplay":False,"spawn":False,"world":False,"alpha01Touched":False},
      "artisticStatus":"optimized_candidate_pending_user_preview_approval"
    }

def validate_one(root,cfg,manifest):
    source=root/cfg["source"]; sd,sb=base.load_glb(source)
    sig=base.animation_signature(sd,sb); sst=base.glb_stats(source)
    errs=[]; last=10**18
    for i in range(3):
        p=source.parent/f'{cfg["prefix"]}-LOD{i}.glb'
        d,b=base.load_glb(p); st=base.glb_stats(p)
        if st["sha256"]!=manifest["lods"][i]["sha256"]:errs.append(f"hash {i}")
        if base.animation_signature(d,b)!=sig:errs.append(f"animation {i}")
        if st["animations"]!=sst["animations"]:errs.append(f"clips {i}")
        if st["trianglesDrawnPerInstance"]>=last:errs.append(f"lod order {i}")
        last=st["trianglesDrawnPerInstance"]
        if st["estimatedDrawCalls"]>=sst["estimatedDrawCalls"]:errs.append(f"drawcalls {i}")
    names=["side","front","three-quarter","wireframe"]+manifest["resolvedPreviewActions"]
    for name in names:
        p=source.parent/f'{cfg["prefix"]}-real-3d-{name}.png'
        if not p.exists() or p.stat().st_size<15000:errs.append(f"preview {name}")
    if errs:raise RuntimeError(cfg["prefix"]+" validation failed: "+", ".join(errs))

def write_bench(root,path,m):
    out={"species":m["species"],"variant":m["variant"],"source":m["sourceStats"],"instances":[10,25,50,100,200,500],"lods":[]}
    for i,r in enumerate(m["lods"]):
        out["lods"].append({"lod":i,"triangles":r["trianglesDrawnPerInstance"],"drawCalls":r["estimatedDrawCalls"],
          "scenarios":[{"instances":n,"trianglesPerFrame":n*r["trianglesDrawnPerInstance"],"drawCallsPerFrame":n*r["estimatedDrawCalls"]} for n in out["instances"]]})
    (root/path).write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")

def contact_sheet(root):
    outdir=root/"assets/models/creatures/fauna-optimization-v06/previews";outdir.mkdir(parents=True,exist_ok=True)
    cards=[
      ("Nivélio",root/"assets/models/creatures/detritivoros/nivelio-optimized-v02-real-3d-three-quarter.png"),
      ("Dunébrio",root/"assets/models/creatures/detritivoros/dunebrio-optimized-v02-real-3d-three-quarter.png")
    ]
    W,H=1200,650;canvas=Image.new("RGB",(W,H),(24,29,30));d=ImageDraw.Draw(canvas);font=ImageFont.load_default()
    d.text((28,18),"WILDHAVEN · NIVELIO + DUNEBRIO · PREVIEWS REAIS DOS GLBs",fill="white",font=font)
    for i,(title,p) in enumerate(cards):
        im=Image.open(p).convert("RGB");im.thumbnail((550,500))
        x=25+i*575+(550-im.width)//2;y=75+(500-im.height)//2
        canvas.paste(im,(x,y));d.text((35+i*575,595),title,fill="white",font=font)
    dest=outdir/"Wildhaven_Nivelio_Dunebrio_Real_Previews.png";canvas.save(dest,optimize=True);return dest

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",type=Path,default=Path("."));a=ap.parse_args();root=a.root.resolve()
    manifests={}
    for key,cfg in CONFIGS.items():
        manifests[key]=build_one(root,key,cfg)
        validate_one(root,cfg,manifests[key])
    (root/"assets/models/creatures/detritivoros/nivelio-optimization-manifest-v02.json").write_text(json.dumps(manifests["nivelio"],ensure_ascii=False,indent=2)+"\n")
    (root/"assets/models/creatures/detritivoros/dunebrio-optimization-manifest-v02.json").write_text(json.dumps(manifests["dunebrio"],ensure_ascii=False,indent=2)+"\n")
    write_bench(root,"assets/models/creatures/detritivoros/nivelio-structural-benchmark-v02.json",manifests["nivelio"])
    write_bench(root,"assets/models/creatures/detritivoros/dunebrio-structural-benchmark-v02.json",manifests["dunebrio"])
    sheet=contact_sheet(root)
    base.audit(root)
    print(json.dumps({"ok":True,"contactSheet":str(sheet.relative_to(root)),"manifests":manifests},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
