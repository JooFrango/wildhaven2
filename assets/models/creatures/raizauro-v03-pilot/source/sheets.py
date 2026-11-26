"""Present crops of actual exported-GLB screenshots; no synthetic model paintings."""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import numpy as np
R=Path(__file__).resolve().parent.parent
P=R/'previews'
try:
 H=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',42)
 M=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25)
 L=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
except Exception:
 H=M=L=ImageFont.load_default()

def cropped(path,pad=.09):
 image=Image.open(path).convert('RGB')
 a=np.asarray(image).astype(np.int16)
 ref=(a[:,:15,:].mean(axis=1)+a[:,-15:,:].mean(axis=1))/2
 delta=np.abs(a-ref[:,None,:]).mean(2)
 yy,xx=np.where(delta>24)
 if not len(xx):return image
 x0,x1=xx.min(),xx.max();y0,y1=yy.min(),yy.max()
 padding=int(max(x1-x0,y1-y0)*pad)
 return image.crop((max(0,x0-padding),max(0,y0-padding),min(image.width,x1+padding),min(image.height,y1+padding)))

def fit(img,box):
 # contain then paste on solid pale off-white background
 result=Image.new('RGB',box,'#ebeae1')
 img=ImageOps.contain(img,box,Image.Resampling.LANCZOS)
 result.paste(img,((box[0]-img.width)//2,(box[1]-img.height)//2))
 return result

imgs={a:cropped(P/f'raizauro-v03-real-glb-{a}.png',.08) for a in ('three_quarter','side','front')}
out=Image.new('RGB',(2048,1120),'#e6e4d9');d=ImageDraw.Draw(out)
d.text((38,26),'RAIZAURO v03  /  BLOQUEIO ANATÔMICO EM GLB REAL',font=H,fill='#2c3d31')
d.text((40,84),'Silhueta facetada • patas escavadoras • bico córneo • placas integradas • 4.822 triângulos',font=M,fill='#52645b')
out.paste(fit(imgs['three_quarter'],(1204,850)),(24,143))
out.paste(fit(imgs['side'],(782,420)),(1245,143))
out.paste(fit(imgs['front'],(782,420)),(1245,605))
d.text((46,1010),'3/4 • malha GLB original, sem rig (etapa de aprovação da silhueta)',font=M,fill='#394d42')
d.text((1258,571),'PERFIL',font=M,fill='#394d42')
d.text((1258,1026),'FRENTE',font=M,fill='#394d42')
path=P/'Raizauro_v03_Preview_GLb_Real_3_Angulos.png'
out.save(path,optimize=True)
print('preview',path)

# Compare only actual GLB renders. v02 is an earlier GLB screenshot, not concept art.
old=Path('/mnt/data/Wildhaven_Megafauna_Savana_v02/previews/raizauro-real-3d-three_quarter-v02.png')
if old.is_file():
 oldim=cropped(old,.10)
 compare=Image.new('RGB',(2048,1050),'#e6e4d9');cd=ImageDraw.Draw(compare)
 cd.text((40,27),'RAIZAURO: COMPARAÇÃO DOS DOIS MODELOS GLB REAIS',font=H,fill='#263d30')
 compare.paste(fit(oldim,(984,800)),(24,122))
 compare.paste(fit(imgs['three_quarter'],(984,800)),(1039,122))
 cd.text((42,948),'V02 — FORMAS GENÉRICAS / 2.159 TRIÂNGULOS',font=M,fill='#713d2e')
 cd.text((1058,948),'V03 — PLANOS E ANATOMIA / 4.822 TRIÂNGULOS',font=M,fill='#285c3f')
 compare.save(P/'Raizauro_Comparacao_Real_V02_V03.png',optimize=True)