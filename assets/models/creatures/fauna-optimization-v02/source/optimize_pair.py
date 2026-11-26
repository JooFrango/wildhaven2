#!/usr/bin/env python3
# Triggered independently after workflow creation; logic unchanged.
from __future__ import annotations
import copy, importlib.util, json, hashlib, argparse
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
import trimesh
from PIL import Image, ImageDraw, ImageFont

ROOT_HERE=Path(__file__).resolve()
BASE_PATH=ROOT_HERE.parents[2]/"fauna-optimization-v01/source/pipeline.py"
spec=importlib.util.spec_from_file_location("fauna_base",BASE_PATH)
base=importlib.util.module_from_spec(spec); spec.loader.exec_module(base)

CONFIGS={
 "rocantraz_forest":{
   "species":"rocantraz","variant":"forest",
   "source":"assets/models/creatures/rocantraz/rocantraz-forest-biped-animated-v04.glb",
   "version":"v05","budgets":[42000,18000,7000],
   "prefix":"rocantraz-forest-biped-optimized-v05",
   "actions":[("roar",.55),("run",.35)]
 },
 "rocantraz_desert":{
   "species":"rocantraz","variant":"desert",
   "source":"assets/models/creatures/rocantraz/rocantraz-desert-biped-animated-v04.glb",
   "version":"v05","budgets":[42000,18000,7000],
   "prefix":"rocantraz-desert-biped-optimized-v05",
   "actions":[("roar",.55),("run",.35)]
 },
 "dunlingua":{
   "species":"dunlingua","variant":"desert",
   "source":"assets/models/creatures/dunlingua/dunlingua-animated-v02.glb",
   "version":"v03","budgets":[12000,6000,2500],
   "prefix":"dunlingua-optimized-v03",
   "actions":[("dig",.55),("feed",.55)]
 }
}

def generic_optimize(source:Path,dest:Path,target_total:int,level:int,label:str):
    src,bb=base.load_glb(source); sig=base.animation_signature(src,bb)
    batches=base.batch_geometry(src,bb)
    counts=[len(b["faces"]) for b in batches]
    targets=base.allocate_targets(counts,target_total,level)
    simplified=[]
    for b,tgt in zip(batches,targets):
        v=b["attrs"]["POSITION"]
        nv,nf=base.simplify(v,b["faces"],tgt)
        tree=cKDTree(v); _,nn=tree.query(nv,k=1,workers=-1)
        attrs={}
        for k,arr in b["attrs"].items():
            if k=="POSITION": attrs[k]=nv
            elif k=="NORMAL":
                m=trimesh.Trimesh(vertices=nv,faces=nf,process=False)
                attrs[k]=np.asarray(m.vertex_normals,dtype=np.float32)
            else: attrs[k]=arr[nn].copy()
        simplified.append({**b,"attrs":attrs,"faces":nf})
    doc=copy.deepcopy(src); oldacc=src["accessors"]; oldviews=src["bufferViews"]
    newacc=[]; newviews=[]; newbuf=bytearray(); oldmap={}
    def put(data,ctype=None,typ=None,normalized=False,target=None,minmax=False):
        arr=np.ascontiguousarray(data)
        comp=1 if arr.ndim==1 else arr.shape[1]
        if ctype is None:
            ctype=base.CTYPE.get(arr.dtype,5126)
        if ctype is np.float32: ctype=5126
        if typ is None: typ=base.TYPES[comp]
        while len(newbuf)%4:newbuf.append(0)
        off=len(newbuf); raw=arr.tobytes(); newbuf.extend(raw)
        bv={"buffer":0,"byteOffset":off,"byteLength":len(raw)}
        if target:bv["target"]=target
        vi=len(newviews);newviews.append(bv)
        a={"bufferView":vi,"componentType":ctype,"count":len(arr),"type":typ}
        if normalized:a["normalized"]=True
        if minmax and arr.ndim==2:
            a["min"]=np.min(arr,axis=0).astype(float).tolist()
            a["max"]=np.max(arr,axis=0).astype(float).tolist()
        ai=len(newacc);newacc.append(a);return ai
    def retain(idx):
        if idx not in oldmap:
            a=oldacc[idx];v=oldviews[a["bufferView"]];data=base.read_accessor(src,bb,idx)
            oldmap[idx]=put(data,a["componentType"],a["type"],a.get("normalized",False),v.get("target"))
            for k in ("min","max"):
                if k in a:newacc[oldmap[idx]][k]=a[k]
        return oldmap[idx]
    for skin in doc.get("skins",[]):
        if "inverseBindMatrices" in skin:skin["inverseBindMatrices"]=retain(skin["inverseBindMatrices"])
    for a in doc.get("animations",[]):
        for s in a.get("samplers",[]):
            s["input"]=retain(s["input"]);s["output"]=retain(s["output"])
    for n in doc.get("nodes",[]):
        n.pop("mesh",None);n.pop("skin",None)
    doc["meshes"]=[]
    parent_children={i:list(n.get("children",[])) for i,n in enumerate(doc.get("nodes",[]))}
    safe=label.replace("-","_")
    for bi,b in enumerate(simplified):
        attrs={}
        schema_map=dict((x[0],x[1:]) for x in b["schema"])
        for k,arr in b["attrs"].items():
            ctype,typ,norm=schema_map[k]
            attrs[k]=put(arr,ctype,typ,norm,34962,minmax=(k=="POSITION"))
        flat=b["faces"].reshape(-1)
        dtype=np.uint16 if len(b["attrs"]["POSITION"])<65536 else np.uint32
        flat=flat.astype(dtype)
        idx=put(flat,5123 if dtype==np.uint16 else 5125,"SCALAR",False,34963)
        prim={"attributes":attrs,"indices":idx,"mode":4}
        if b["material"]>=0:prim["material"]=b["material"]
        meshidx=len(doc["meshes"])
        doc["meshes"].append({"name":f"{safe}_batch_{bi:03d}","primitives":[prim]})
        nodeidx=len(doc["nodes"])
        doc["nodes"].append({"name":f"{safe}_batch_{bi:03d}","mesh":meshidx})
        if b["parent"]>=0:
            parent_children.setdefault(b["parent"],list(doc["nodes"][b["parent"]].get("children",[]))).append(nodeidx)
        elif doc.get("scenes"):
            doc["scenes"][doc.get("scene",0)].setdefault("nodes",[]).append(nodeidx)
    for i,ch in parent_children.items():
        if ch:doc["nodes"][i]["children"]=ch
        else:doc["nodes"][i].pop("children",None)
    doc["accessors"]=newacc;doc["bufferViews"]=newviews
    dest.parent.mkdir(parents=True,exist_ok=True)
    base.write_glb(doc,newbuf,dest)
    d2,b2=base.load_glb(dest)
    if base.animation_signature(d2,b2)!=sig:raise RuntimeError(f"animation signature changed: {label}")
    st=base.glb_stats(dest)
    st.update({"targetTriangles":target_total,"animationSignature":sig,"batchedGroups":len(batches),
               "sourceMeshNodes":sum("mesh" in n for n in src.get("nodes",[]))})
    return st

def render_set(root:Path,key,cfg,lod0:Path):
    folder=lod0.parent
    slug=cfg["prefix"]
    previews={}
    for angle in ("side","front","three-quarter"):
        a="three_quarter" if angle=="three-quarter" else angle
        p=folder/f"{slug}-real-3d-{angle}.png"
        previews[angle]=base.render(lod0,p,a)
    p=folder/f"{slug}-real-3d-wireframe.png"
    previews["wireframe"]=base.render(lod0,p,"three_quarter",wire=True)
    for action,phase in cfg["actions"]:
        p=folder/f"{slug}-real-3d-{action}.png"
        previews[action]=base.render(lod0,p,"three_quarter",action,phase)
    return previews

def build_one(root:Path,key,cfg):
    source=root/cfg["source"]; folder=source.parent
    before=base.glb_stats(source); sd,sb=base.load_glb(source); sig=base.animation_signature(sd,sb)
    records=[]
    for i,budget in enumerate(cfg["budgets"]):
        dest=folder/f'{cfg["prefix"]}-LOD{i}.glb'
        rec=generic_optimize(source,dest,budget,i,cfg["prefix"])
        records.append(rec)
        print("BUILT",key,i,rec["trianglesDrawnPerInstance"],rec["estimatedDrawCalls"],rec["bytes"],flush=True)
    previews=render_set(root,key,cfg,folder/f'{cfg["prefix"]}-LOD0.glb')
    return {
      "species":cfg["species"],"variant":cfg["variant"],"version":cfg["version"],
      "source":cfg["source"],"sourceStats":before,"animationSignature":sig,"lods":records,
      "previews":previews,
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

def make_contact_sheet(root:Path):
    outdir=root/"assets/models/creatures/fauna-optimization-v02/previews";outdir.mkdir(parents=True,exist_ok=True)
    cards=[
      ("Rocantraz · floresta",root/"assets/models/creatures/rocantraz/rocantraz-forest-biped-optimized-v05-real-3d-three-quarter.png"),
      ("Rocantraz · deserto",root/"assets/models/creatures/rocantraz/rocantraz-desert-biped-optimized-v05-real-3d-three-quarter.png"),
      ("Dunlíngua",root/"assets/models/creatures/dunlingua/dunlingua-optimized-v03-real-3d-three-quarter.png"),
    ]
    W,H=1500,600; canvas=Image.new("RGB",(W,H),(24,29,30));d=ImageDraw.Draw(canvas);font=ImageFont.load_default()
    d.text((28,18),"WILDHAVEN · PREVIEWS REAIS DOS GLBs OTIMIZADOS",fill="white",font=font)
    x=20
    for title,p in cards:
        im=Image.open(p).convert("RGB");im.thumbnail((470,470))
        y=80+(470-im.height)//2
        canvas.paste(im,(x+(470-im.width)//2,y));d.text((x+10,555),title,fill="white",font=font);x+=490
    dest=outdir/"Wildhaven_Rocantraz_Dunlingua_Real_Previews.png";canvas.save(dest,optimize=True);return dest

def write_bench(root:Path,name,manifest):
    out={"species":manifest["species"],"variant":manifest["variant"],"source":manifest["sourceStats"],"instances":[10,25,50,100,200],"lods":[]}
    for i,r in enumerate(manifest["lods"]):
        out["lods"].append({"lod":i,"triangles":r["trianglesDrawnPerInstance"],"drawCalls":r["estimatedDrawCalls"],
          "scenarios":[{"instances":n,"trianglesPerFrame":n*r["trianglesDrawnPerInstance"],"drawCallsPerFrame":n*r["estimatedDrawCalls"]} for n in out["instances"]]})
    p=root/name;p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")

def validate_one(root:Path,cfg,manifest):
    source=root/cfg["source"]; sd,sb=base.load_glb(source);sig=base.animation_signature(sd,sb);sst=base.glb_stats(source)
    last=10**18;errs=[]
    for i in range(3):
        p=source.parent/f'{cfg["prefix"]}-LOD{i}.glb'; d,b=base.load_glb(p);st=base.glb_stats(p)
        if st["sha256"]!=manifest["lods"][i]["sha256"]:errs.append(f"hash {i}")
        if base.animation_signature(d,b)!=sig:errs.append(f"animation {i}")
        if st["animations"]!=sst["animations"]:errs.append(f"clips {i}")
        if st["trianglesDrawnPerInstance"]>=last:errs.append(f"lod order {i}")
        last=st["trianglesDrawnPerInstance"]
        if st["estimatedDrawCalls"]>=sst["estimatedDrawCalls"]:errs.append(f"drawcalls {i}")
    for name in ("side","front","three-quarter","wireframe",cfg["actions"][0][0],cfg["actions"][1][0]):
        p=source.parent/f'{cfg["prefix"]}-real-3d-{name}.png'
        if not p.exists() or p.stat().st_size<20000:errs.append(f"preview {name}")
    if errs:raise RuntimeError(cfg["prefix"]+" validation failed: "+", ".join(errs))

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",type=Path,default=Path("."));a=ap.parse_args();root=a.root.resolve()
    manifests={}
    for key,cfg in CONFIGS.items():
        manifests[key]=build_one(root,key,cfg)
        validate_one(root,cfg,manifests[key])
    roc={"species":"rocantraz","version":"v05-optimization","variants":{"forest":manifests["rocantraz_forest"],"desert":manifests["rocantraz_desert"]}}
    dun=manifests["dunlingua"]
    (root/"assets/models/creatures/rocantraz/rocantraz-optimization-manifest-v05.json").write_text(json.dumps(roc,ensure_ascii=False,indent=2)+"\n")
    (root/"assets/models/creatures/dunlingua/dunlingua-optimization-manifest-v03.json").write_text(json.dumps(dun,ensure_ascii=False,indent=2)+"\n")
    write_bench(root,"assets/models/creatures/rocantraz/rocantraz-structural-benchmark-v05.json",manifests["rocantraz_forest"])
    write_bench(root,"assets/models/creatures/dunlingua/dunlingua-structural-benchmark-v03.json",dun)
    contact=make_contact_sheet(root)
    base.audit(root)
    print(json.dumps({"ok":True,"contactSheet":str(contact.relative_to(root)),"manifests":manifests},ensure_ascii=False,indent=2))

if __name__=="__main__":main()
