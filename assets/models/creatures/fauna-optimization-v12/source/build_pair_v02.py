#!/usr/bin/env python3
from __future__ import annotations
import importlib.util,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[5]
BASE=ROOT/"assets/models/creatures/fauna-optimization-v01/source/pipeline.py"
PRES=ROOT/"assets/models/creatures/fauna-optimization-v05/source/optimize_pair.py"
sp=importlib.util.spec_from_file_location("base",BASE);base=importlib.util.module_from_spec(sp);sp.loader.exec_module(base)
sp2=importlib.util.spec_from_file_location("pres",PRES);pres=importlib.util.module_from_spec(sp2);sp2.loader.exec_module(pres)

CFG={
 'cervalume':{'src':'assets/models/creatures/cervalume/v02/cervalume-animated-v02.glb','prefix':'cervalume-optimized-v02','budgets':[1500,900,450]},
 'lobrapedra':{'src':'assets/models/creatures/lobrapedra/v02/lobrapedra-animated-v02.glb','prefix':'lobrapedra-optimized-v02','budgets':[1250,750,380]}
}
def build(name,cfg):
    src=ROOT/cfg['src']; before=base.glb_stats(src); d,b=base.load_glb(src); sig=base.animation_signature(d,b); lods=[]
    for i,budget in enumerate(cfg['budgets']):
        dest=src.parent/f"{cfg['prefix']}-LOD{i}.glb"
        rec=pres.preserve_layout_optimize(src,dest,budget,i,cfg['prefix']);lods.append(rec)
        print('BUILT',name,i,rec['trianglesDrawnPerInstance'],rec['estimatedDrawCalls'],rec['bytes'],flush=True)
    previews={};lod0=src.parent/f"{cfg['prefix']}-LOD0.glb"
    for angle in ('side','front','three-quarter'):
        a='three_quarter' if angle=='three-quarter' else angle
        p=src.parent/f"{cfg['prefix']}-real-3d-{angle}.png";previews[angle]=base.render(lod0,p,a)
    p=src.parent/f"{cfg['prefix']}-real-3d-wireframe.png";previews['wireframe']=base.render(lod0,p,'three_quarter',wire=True)
    m={'species':name,'revision':'v02','source':cfg['src'],'sourceStats':before,'animationSignature':sig,'lods':lods,'previews':previews,
       'style':'official-guide-defined-planes','artisticStatus':'revision_artistic_pending_user_approval'}
    last=10**18
    for i in range(3):
        p=src.parent/f"{cfg['prefix']}-LOD{i}.glb";d2,b2=base.load_glb(p);st=base.glb_stats(p)
        assert base.animation_signature(d2,b2)==sig
        assert st['animations']==before['animations']
        assert st['skins']==before['skins'] and st['skinJointCounts']==before['skinJointCounts']
        assert st['estimatedDrawCalls']==before['estimatedDrawCalls']
        assert st['trianglesDrawnPerInstance']<last; last=st['trianglesDrawnPerInstance']
    return m
def main():
    ms={k:build(k,v) for k,v in CFG.items()}
    (ROOT/'assets/models/creatures/cervalume/v02/cervalume-model-manifest-v02.json').write_text(json.dumps(ms['cervalume'],ensure_ascii=False,indent=2)+'\n')
    (ROOT/'assets/models/creatures/lobrapedra/v02/lobrapedra-model-manifest-v02.json').write_text(json.dumps(ms['lobrapedra'],ensure_ascii=False,indent=2)+'\n')
    out=ROOT/'assets/models/creatures/fauna-optimization-v12/previews';out.mkdir(parents=True,exist_ok=True)
    canvas=Image.new('RGB',(1200,650),(232,233,227));d=ImageDraw.Draw(canvas);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
    cards=[('Cervalume v02',ROOT/'assets/models/creatures/cervalume/v02/cervalume-optimized-v02-real-3d-three-quarter.png'),
           ('Lobrapedra v02',ROOT/'assets/models/creatures/lobrapedra/v02/lobrapedra-optimized-v02-real-3d-three-quarter.png')]
    for i,(title,p) in enumerate(cards):
        d.text((24+i*590,18),title,fill=(43,50,48),font=font);im=Image.open(p).convert('RGB');im.thumbnail((540,500));canvas.paste(im,(25+i*590+(540-im.width)//2,75+(500-im.height)//2))
    canvas.save(out/'Wildhaven_Cervalume_Lobrapedra_v02_Real_Previews.png',optimize=True)
    base.audit(ROOT)
    print(json.dumps(ms,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
