#!/usr/bin/env python3
# Independent trigger after workflow registration; optimization logic unchanged.
from __future__ import annotations
import argparse, copy, importlib.util, json
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
import trimesh
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve()
PAIR_PATH=HERE.parents[2]/"fauna-optimization-v02/source/optimize_pair.py"
spec=importlib.util.spec_from_file_location("pair_base",PAIR_PATH)
pair=importlib.util.module_from_spec(spec); spec.loader.exec_module(pair)
base=pair.base

CONFIGS={
  "velsari":{
    "species":"velsari","variant":"savanna","version":"v02",
    "source":"assets/models/creatures/velsari/velsari-savanna-animated-v01.glb",
    "budgets":[18000,8000,3000],
    "prefix":"velsari-savanna-optimized-v02",
    "actions":[("run",.38),("leap",.55)],
    "method":"batched"
  },
  "torvalho":{
    "species":"torvalho","variant":"temperate-plains","version":"v02",
    "source":"assets/models/creatures/torvalho/torvalho_animated_v01.glb",
    "existingLod1":"assets/models/creatures/torvalho/torvalho_LOD1_animated_v01.glb",
    "budgets":[25000,12000,5000],
    "prefix":"torvalho-optimized-v02",
    "actions":[("charge",.52),("graze",.55)],
    "method":"preserve-layout"
  }
}

def put_accessor(newacc,newviews,newbuf,data,ctype=None,typ=None,normalized=False,target=None,minmax=False):
    arr=np.ascontiguousarray(data)
    comp=1 if arr.ndim==1 else arr.shape[1]
    if ctype is None: ctype=base.CTYPE.get(arr.dtype,5126)
    if ctype is np.float32: ctype=5126
    if typ is None: typ=base.TYPES[comp]
    while len(newbuf)%4:newbuf.append(0)
    off=len(newbuf); raw=arr.tobytes(); newbuf.extend(raw)
    bv={"buffer":0,"byteOffset":off,"byteLength":len(raw)}
    if target:bv["target"]=target
    vi=len(newviews); newviews.append(bv)
    a={"bufferView":vi,"componentType":ctype,"count":len(arr),"type":typ}
    if normalized:a["normalized"]=True
    if minmax and arr.ndim==2:
        a["min"]=np.min(arr,axis=0).astype(float).tolist()
        a["max"]=np.max(arr,axis=0).astype(float).tolist()
    ai=len(newacc); newacc.append(a); return ai

def preserve_layout_optimize(source:Path,dest:Path,target_total:int,level:int,label:str):
    src,bb=base.load_glb(source)
    sig=base.animation_signature(src,bb)
    doc=copy.deepcopy(src)
    oldacc=src.get("accessors",[]); oldviews=src.get("bufferViews",[])
    newacc=[]; newviews=[]; newbuf=bytearray(); accmap={}; viewmap={}

    def retain_accessor(idx):
        if idx in accmap:return accmap[idx]
        a=oldacc[idx]; v=oldviews[a["bufferView"]]
        data=base.read_accessor(src,bb,idx)
        ni=put_accessor(newacc,newviews,newbuf,data,a["componentType"],a["type"],a.get("normalized",False),v.get("target"))
        for k in ("min","max"):
            if k in a:newacc[ni][k]=a[k]
        accmap[idx]=ni
        return ni

    def retain_view(idx):
        if idx in viewmap:return viewmap[idx]
        v=oldviews[idx]
        off=v.get("byteOffset",0); ln=v["byteLength"]
        while len(newbuf)%4:newbuf.append(0)
        noff=len(newbuf); newbuf.extend(bb[off:off+ln])
        nv={k:copy.deepcopy(val) for k,val in v.items() if k not in ("byteOffset","buffer")}
        nv["buffer"]=0; nv["byteOffset"]=noff; nv["byteLength"]=ln
        ni=len(newviews); newviews.append(nv); viewmap[idx]=ni
        return ni

    for skin in doc.get("skins",[]):
        if "inverseBindMatrices" in skin:skin["inverseBindMatrices"]=retain_accessor(skin["inverseBindMatrices"])
    for anim in doc.get("animations",[]):
        for samp in anim.get("samplers",[]):
            samp["input"]=retain_accessor(samp["input"]); samp["output"]=retain_accessor(samp["output"])
    for img in doc.get("images",[]):
        if "bufferView" in img:img["bufferView"]=retain_view(img["bufferView"])

    prim_refs=[]
    counts=[]
    for mi,m in enumerate(src.get("meshes",[])):
        for pi,p in enumerate(m.get("primitives",[])):
            if "POSITION" not in p.get("attributes",{}):continue
            if "indices" in p:
                faces=base.read_accessor(src,bb,p["indices"]).reshape(-1,3)
            else:
                v=base.read_accessor(src,bb,p["attributes"]["POSITION"]).reshape(-1,3)
                faces=np.arange(len(v),dtype=np.uint32).reshape(-1,3)
            prim_refs.append((mi,pi,p,faces))
            counts.append(len(faces))
    targets=base.allocate_targets(counts,target_total,level)

    new_meshes=copy.deepcopy(src.get("meshes",[]))
    for (mi,pi,p,faces),tgt in zip(prim_refs,targets):
        pos=base.read_accessor(src,bb,p["attributes"]["POSITION"]).reshape(-1,3).astype(np.float32)
        nv,nf=base.simplify(pos,faces,tgt)
        tree=cKDTree(pos); _,nn=tree.query(nv,k=1,workers=-1)
        attrs={}
        for semantic,ai in p.get("attributes",{}).items():
            old=oldacc[ai]; arr=base.read_accessor(src,bb,ai)
            if semantic=="POSITION":
                data=nv
            elif semantic=="NORMAL":
                mesh=trimesh.Trimesh(vertices=nv,faces=nf,process=False)
                data=np.asarray(mesh.vertex_normals,dtype=np.float32)
            else:
                data=arr[nn].copy()
            attrs[semantic]=put_accessor(newacc,newviews,newbuf,data,old["componentType"],old["type"],old.get("normalized",False),34962,minmax=(semantic=="POSITION"))
        flat=nf.reshape(-1)
        dtype=np.uint16 if len(nv)<65536 else np.uint32
        flat=flat.astype(dtype)
        idx=put_accessor(newacc,newviews,newbuf,flat,5123 if dtype==np.uint16 else 5125,"SCALAR",False,34963)
        np_={"attributes":attrs,"indices":idx,"mode":p.get("mode",4)}
        for k in ("material","extras","extensions"):
            if k in p:np_[k]=copy.deepcopy(p[k])
        new_meshes[mi]["primitives"][pi]=np_

    doc["meshes"]=new_meshes
    doc["accessors"]=newacc; doc["bufferViews"]=newviews
    doc["buffers"]=[{"byteLength":len(newbuf)}]
    dest.parent.mkdir(parents=True,exist_ok=True)
    base.write_glb(doc,newbuf,dest)

    d2,b2=base.load_glb(dest)
    if base.animation_signature(d2,b2)!=sig:
        raise RuntimeError(f"animation signature changed: {label}")
    st=base.glb_stats(dest)
    st.update({"targetTriangles":target_total,"animationSignature":sig,
               "preservedMeshDefinitions":len(src.get("meshes",[])),
               "preservedMeshNodes":sum("mesh" in n for n in src.get("nodes",[]))})
    return st

def render_set(source:Path,cfg):
    folder=source.parent; lod0=folder/f'{cfg["prefix"]}-LOD0.glb'; previews={}
    for angle in ("side","front","three-quarter"):
        a="three_quarter" if angle=="three-quarter" else angle
        p=folder/f'{cfg["prefix"]}-real-3d-{angle}.png'
        previews[angle]=base.render(lod0,p,a)
    p=folder/f'{cfg["prefix"]}-real-3d-wireframe.png'
    previews["wireframe"]=base.render(lod0,p,"three_quarter",wire=True)
    if cfg["method"]!="preserve-layout":
        for action,phase in cfg["actions"]:
            p=folder/f'{cfg["prefix"]}-real-3d-{action}.png'
            previews[action]=base.render(lod0,p,"three_quarter",action,phase)
    return previews

def build_one(root,key,cfg):
    source=root/cfg["source"]; before=base.glb_stats(source)
    sd,sb=base.load_glb(source); sig=base.animation_signature(sd,sb)
    records=[]
    for i,budget in enumerate(cfg["budgets"]):
        dest=source.parent/f'{cfg["prefix"]}-LOD{i}.glb'
        if cfg["method"]=="preserve-layout":
            rec=preserve_layout_optimize(source,dest,budget,i,cfg["prefix"])
        else:
            rec=pair.generic_optimize(source,dest,budget,i,cfg["prefix"])
        records.append(rec)
        print("BUILT",key,i,rec["trianglesDrawnPerInstance"],rec["estimatedDrawCalls"],rec["bytes"],flush=True)
    existing=None
    if cfg.get("existingLod1"):
        existing=base.glb_stats(root/cfg["existingLod1"])
    previews=render_set(source,cfg)
    return {
      "species":cfg["species"],"variant":cfg["variant"],"version":cfg["version"],
      "source":cfg["source"],"sourceStats":before,"existingPublishedLod1":existing,
      "animationSignature":sig,"lods":records,"previews":previews,
      "method":cfg["method"],
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
        if cfg["method"]=="preserve-layout":
            if st["estimatedDrawCalls"]!=sst["estimatedDrawCalls"]:errs.append(f"drawcalls changed {i}")
        else:
            if st["estimatedDrawCalls"]>=sst["estimatedDrawCalls"]:errs.append(f"drawcalls not reduced {i}")
    names=["side","front","three-quarter","wireframe"]
    if cfg["method"]!="preserve-layout":
        names += [cfg["actions"][0][0],cfg["actions"][1][0]]
    for name in names:
        p=source.parent/f'{cfg["prefix"]}-real-3d-{name}.png'
        if not p.exists() or p.stat().st_size<20000:errs.append(f"preview {name}")
    if errs:raise RuntimeError(cfg["prefix"]+" validation failed: "+", ".join(errs))

def write_bench(root,path,m):
    out={"species":m["species"],"variant":m["variant"],"source":m["sourceStats"],"instances":[10,25,50,100,200],"lods":[]}
    for i,r in enumerate(m["lods"]):
        out["lods"].append({"lod":i,"triangles":r["trianglesDrawnPerInstance"],"drawCalls":r["estimatedDrawCalls"],
          "scenarios":[{"instances":n,"trianglesPerFrame":n*r["trianglesDrawnPerInstance"],"drawCallsPerFrame":n*r["estimatedDrawCalls"]} for n in out["instances"]]})
    (root/path).write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")

def contact_sheet(root):
    outdir=root/"assets/models/creatures/fauna-optimization-v05/previews"; outdir.mkdir(parents=True,exist_ok=True)
    cards=[
      ("Velsari",root/"assets/models/creatures/velsari/velsari-savanna-optimized-v02-real-3d-three-quarter.png"),
      ("Torvalho",root/"assets/models/creatures/torvalho/torvalho-optimized-v02-real-3d-three-quarter.png")
    ]
    W,H=1200,650; canvas=Image.new("RGB",(W,H),(24,29,30)); d=ImageDraw.Draw(canvas); font=ImageFont.load_default()
    d.text((28,18),"WILDHAVEN · VELSARI + TORVALHO · PREVIEWS REAIS DOS GLBs",fill="white",font=font)
    for i,(title,p) in enumerate(cards):
        im=Image.open(p).convert("RGB"); im.thumbnail((550,500))
        x=25+i*575+(550-im.width)//2; y=75+(500-im.height)//2
        canvas.paste(im,(x,y)); d.text((35+i*575,595),title,fill="white",font=font)
    dest=outdir/"Wildhaven_Velsari_Torvalho_Real_Previews.png"; canvas.save(dest,optimize=True); return dest

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--root",type=Path,default=Path(".")); a=ap.parse_args(); root=a.root.resolve()
    manifests={}
    for key,cfg in CONFIGS.items():
        manifests[key]=build_one(root,key,cfg)
        validate_one(root,cfg,manifests[key])
    (root/"assets/models/creatures/velsari/velsari-optimization-manifest-v02.json").write_text(json.dumps(manifests["velsari"],ensure_ascii=False,indent=2)+"\n")
    (root/"assets/models/creatures/torvalho/torvalho-optimization-manifest-v02.json").write_text(json.dumps(manifests["torvalho"],ensure_ascii=False,indent=2)+"\n")
    write_bench(root,"assets/models/creatures/velsari/velsari-structural-benchmark-v02.json",manifests["velsari"])
    write_bench(root,"assets/models/creatures/torvalho/torvalho-structural-benchmark-v02.json",manifests["torvalho"])
    sheet=contact_sheet(root)
    base.audit(root)
    print(json.dumps({"ok":True,"contactSheet":str(sheet.relative_to(root)),"manifests":manifests},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
