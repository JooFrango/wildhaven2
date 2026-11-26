#!/usr/bin/env python3
from __future__ import annotations
import argparse, importlib.util, json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[5]
BASE=ROOT/"assets/models/creatures/fauna-optimization-v01/source/pipeline.py"
PRES=ROOT/"assets/models/creatures/fauna-optimization-v05/source/optimize_pair.py"
sp=importlib.util.spec_from_file_location("base",BASE);base=importlib.util.module_from_spec(sp);sp.loader.exec_module(base)
sp2=importlib.util.spec_from_file_location("pres",PRES);pres=importlib.util.module_from_spec(sp2);sp2.loader.exec_module(pres)
CFG={
 "cervalume":{"src":"assets/models/creatures/cervalume/cervalume-animated-v01.glb","prefix":"cervalume-optimized-v01","budgets":[6200,3500,1400]},
 "lobrapedra":{"src":"assets/models/creatures/lobrapedra/lobrapedra-animated-v01.glb","prefix":"lobrapedra-optimized-v01","budgets":[4800,2600,1100]}
}
def one(name,cfg):
    src=ROOT/cfg["src"];before=base.glb_stats(src);d,b=base.load_glb(src);sig=base.animation_signature(d,b);lods=[]
    for i,budget in enumerate(cfg["budgets"]):
        dest=src.parent/f'{cfg["prefix"]}-LOD{i}.glb'
        rec=pres.preserve_layout_optimize(src,dest,budget,i,cfg["prefix"]);lods.append(rec)
        print("BUILT",name,i,rec["trianglesDrawnPerInstance"],rec["estimatedDrawCalls"],rec["bytes"],flush=True)
    previews={}
    lod0=src.parent/f'{cfg["prefix"]}-LOD0.glb'
    for angle in ("side","front","three-quarter"):
        a="three_quarter" if angle=="three-quarter" else angle
        p=src.parent/f'{cfg["prefix"]}-real-3d-{angle}.png';previews[angle]=base.render(lod0,p,a)
    p=src.parent/f'{cfg["prefix"]}-real-3d-wireframe.png';previews["wireframe"]=base.render(lod0,p,"three_quarter",wire=True)
    m={"species":name,"source":cfg["src"],"sourceStats":before,"animationSignature":sig,"lods":lods,"previews":previews,"method":"preserve-layout","artisticStatus":"modeled_candidate_pending_user_preview_approval"}
    # validation
    last=10**18
    for i in range(3):
        p=src.parent/f'{cfg["prefix"]}-LOD{i}.glb';d2,b2=base.load_glb(p);st=base.glb_stats(p)
        assert base.animation_signature(d2,b2)==sig
        assert st["animations"]==before["animations"]
        assert st["skins"]==before["skins"] and st["skinJointCounts"]==before["skinJointCounts"]
        assert st["estimatedDrawCalls"]==before["estimatedDrawCalls"]
        assert st["trianglesDrawnPerInstance"]<last;last=st["trianglesDrawnPerInstance"]
    return m
def main():
    ms={k:one(k,v) for k,v in CFG.items()}
    (ROOT/"assets/models/creatures/cervalume/cervalume-model-manifest-v01.json").write_text(json.dumps(ms["cervalume"],ensure_ascii=False,indent=2)+"\n")
    (ROOT/"assets/models/creatures/lobrapedra/lobrapedra-model-manifest-v01.json").write_text(json.dumps(ms["lobrapedra"],ensure_ascii=False,indent=2)+"\n")
    out=ROOT/"assets/models/creatures/fauna-optimization-v11/previews";out.mkdir(parents=True,exist_ok=True)
    canvas=Image.new("RGB",(1200,650),(232,233,227));d=ImageDraw.Draw(canvas);font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",22)
    cards=[("Cervalume",ROOT/"assets/models/creatures/cervalume/cervalume-optimized-v01-real-3d-three-quarter.png"),("Lobrapedra",ROOT/"assets/models/creatures/lobrapedra/lobrapedra-optimized-v01-real-3d-three-quarter.png")]
    for i,(title,p) in enumerate(cards):
        d.text((24+i*590,18),title,fill=(43,50,48),font=font);im=Image.open(p).convert("RGB");im.thumbnail((540,500));canvas.paste(im,(25+i*590+(540-im.width)//2,75+(500-im.height)//2))
    canvas.save(out/"Wildhaven_Cervalume_Lobrapedra_Real_Previews.png",optimize=True)
    base.audit(ROOT)
    print(json.dumps(ms,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
