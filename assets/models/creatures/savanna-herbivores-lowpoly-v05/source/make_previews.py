from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,numpy as np,argparse
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);root=parser.parse_args().root.resolve();photos=root/'assets/models/creatures'
out=root/'assets/models/creatures/savanna-herbivores-lowpoly-v05/previews';out.mkdir(parents=True,exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
fname=lambda size:ImageFont.truetype(font,size)
configs=[('talvero','Talvero','24.000 alvo, modelo otimizado'),('rambrel','Rambrél comum','Navegador das acácias'),('rambrel_chapadas','Rambrél gigante','Subespécie das chapadas'),('turvagal','Turvagal','Herbívoro das margens')]
W,H=1920,1400;image=Image.new('RGB',(W,H),'#111c20');d=ImageDraw.Draw(image)
d.text((55,32),'WILDHAVEN   /   HERBÍVOROS DA SAVANA',font=fname(47),fill='#f0ede4')
d.text((58,97),'PRINTS REAIS DO GLB ANIMADO  •  VERSÃO EXPERIMENTAL LOW-POLY',font=fname(23),fill='#b7c0b9')
for i,(id,title,desc) in enumerate(configs):
    x0=44+(i%2)*942;y0=158+(i//2)*609
    d.rounded_rectangle((x0,y0,x0+921,y0+579),radius=12,fill='#222f32')
    pic=Image.open(photos/id/f'{id}-real-3d-side-lowpoly-v05.png').convert('RGB')
    arr=np.asarray(pic)
    bg=arr[:,0,:];mask=np.max(np.abs(arr.astype(np.float32)-bg[:,None,:]),axis=2)>22
    ys,xs=np.where(mask)
    box=(max(0,xs.min()-28),max(0,ys.min()-50),min(pic.width,xs.max()+29),min(pic.height,ys.max()+55))
    crop=pic.crop(box);crop.thumbnail((884,442),Image.Resampling.LANCZOS)
    ox=x0+(921-crop.width)//2;oy=y0+20+(442-crop.height)//2
    image.paste(crop,(ox,oy))
    d.text((x0+23,y0+474),title,font=fname(31),fill='#fff9e7')
    manifest=json.loads((photos/id/f'{id}-lowpoly-manifest-v05.json').read_text())
    tris=manifest['lods'][0]['triangles']
    d.text((x0+24,y0+527),f'{desc}  ·  {tris:,} triângulos  ·  17 ossos  ·  {len(manifest["animations"])} clipes',font=fname(19),fill='#a7c9b5')
image.save(out/'Wildhaven_4_Herbivoros_LowPoly_Previews_Reais.png',optimize=True)
# 2-panel comparative actual, no compositing synthetic creature imagery
from scipy import ndimage
p1=Image.open(root/'build/talvero-original-side.png').convert('RGB') if (root/'build/talvero-original-side.png').exists() else Image.open(photos/'talvero/talvero-real-3d-side-v04.png').convert('RGB')
p2=Image.open(photos/'talvero/talvero-real-3d-side-lowpoly-v05.png').convert('RGB')
before=Image.new('RGB',(2200,1020),'#182629');b=ImageDraw.Draw(before)
before.paste(p1,(0,100));before.paste(p2,(1100,100))
b.text((40,27),'TALVERO V04 ORIGINAL · 113.234 triângulos',font=fname(32),fill='white')
b.text((1140,27),'TALVERO V05 LOD0 · 25.247 triângulos',font=fname(32),fill='white')
before.save(out/'Talvero_Real_GLb_Original_vs_LowPoly.png',optimize=True)
print(out/'Wildhaven_4_Herbivoros_LowPoly_Previews_Reais.png')
print(out/'Talvero_Real_GLb_Original_vs_LowPoly.png')