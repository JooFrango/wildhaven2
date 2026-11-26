#!/usr/bin/env python3
"""Compose a sheet exclusively from real exported GLB renders; no synthesized pixels."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAMES=[('torvardo','TORVARDO','Grande herbívoro · manadas'),
 ('raizauro','RAIZAURO','Grande réptil · escavador'),
 ('mastelio','MASTÉLIO','Grande herbívoro · frugívoro'),
 ('garruva','GARRUVA','Réptil terrestre · necrófago')]
W,H=1120,705
im=Image.new('RGB',(W*2,H*2),(21,33,36));draw=ImageDraw.Draw(im)
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',28)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
except OSError:font=ImageFont.load_default();small=font
for idx,(sid,title,subtitle) in enumerate(NAMES):
 x=idx%2*W;y=idx//2*H
 draw.rounded_rectangle((x+11,y+12,x+W-11,y+H-10),radius=20,fill=(31,45,48))
 draw.text((x+35,y+24),title,font=font,fill=(242,229,197))
 draw.text((x+36,y+65),subtitle,font=small,fill=(172,196,191))
 for j,angle in enumerate(('three_quarter','side')):
  shot=Image.open(ROOT/'previews'/f'{sid}-real-3d-{angle}-v01.png').convert('RGB')
  ww=530;hh=540
  shot.thumbnail((ww,hh))
  xx=x+25+j*550+(ww-shot.width)//2;yy=y+114+(hh-shot.height)//2
  im.paste(shot,(xx,yy))
  draw.text((x+34+j*550,y+656), '3/4 · render GLB' if j==0 else 'Perfil · render GLB',font=small,fill=(208,219,213))
name=ROOT/'previews'/'Wildhaven_Megafauna_4_Modelos_Reais_v01.png'
im.save(name,optimize=True)
print('SHEET',name,im.size)