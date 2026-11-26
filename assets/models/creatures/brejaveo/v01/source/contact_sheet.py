from PIL import Image,ImageDraw,ImageFont
import numpy as np
from pathlib import Path
root=Path(__file__).resolve().parent.parent
base=Image.new('RGB',(1480,1550),'#101c1a');draw=ImageDraw.Draw(base)
fb='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';reg='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
F=lambda p,s:ImageFont.truetype(p,s)
draw.text((55,44),'BREJÁVEO  ·  BLOCKOUT v01',font=F(fb,52),fill='#f4e4b9')
draw.text((55,112),'3 vistas reais do GLB reimportado  •  conceito aprovado / forma em revisão',font=F(reg,25),fill='#aac7ae')

def region(n):
 im=Image.open(root/f'previews/brejaveo-v01-real-glb-{n}.png').convert('RGB').crop((0,90,1300,940))
 a=np.asarray(im);r=a[:,:,0].astype(float);g=a[:,:,1].astype(float);b=a[:,:,2].astype(float)
 mask=((g>95)&(g>r*1.18)&(g>b*1.2))|((r>110)&(r>g*1.2)&(g>45))
 yy,xx=np.nonzero(mask)
 pad=35
 bbox=(max(0,int(xx.min())-pad),max(0,int(yy.min())-pad),min(im.width,int(xx.max())+pad),min(im.height,int(yy.max())+pad))
 return im.crop(bbox)

def tile(n,label,box):
 x,y,w,h=box
 draw.rounded_rectangle((x,y,x+w,y+h),radius=18,fill='#263b32')
 draw.text((x+30,y+21),label,font=F(fb,30),fill='#f5d99a')
 im=region(n)
 iw,ih=im.size
 s=min((w-45)/iw,(h-96)/ih)
 im=im.resize((int(iw*s),int(ih*s)),Image.Resampling.LANCZOS)
 base.paste(im,(x+(w-im.width)//2,y+71+(h-93-im.height)//2))

tile('perfil','01  PERFIL — APOIO DAS ASAS',(38,175,1404,662))
tile('frente','02  FRENTE — ENVERGADURA',(38,861,681,613))
tile('tres-quartos','03  TRÊS-QUARTOS',(743,861,699,613))
draw.text((60,1513),'5,46 m comprimento   •   6,96 m envergadura   •   UV pintada   •   sem rig e sem clipes',font=F(reg,21),fill='#bfd0bd')
p=root/'previews/brejaveo-v01-real-glb-3-vistas.png';base.save(p,optimize=True);print(p)