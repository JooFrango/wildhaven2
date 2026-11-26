#!/usr/bin/env python3
"""Compare V02 and V03 real exported GLB renders without generating concept art."""
from pathlib import Path
from PIL import Image, ImageFont, ImageDraw, ImageOps
ROOT=Path(__file__).resolve().parent.parent
old=Path(__file__).resolve().parents[2]/'garruva'/'garruva-real-3d-three_quarter-v02.png'
if not old.is_file():
 old=Path('/mnt/data/ref-v02/Wildhaven_Megafauna_Savana_v02/previews/garruva-real-3d-three_quarter-v02.png')
new=ROOT/'previews/garruva-v03-real-glb-three_quarter.png'
if not old.exists():
 raise FileNotFoundError('Real V02 screenshot unavailable; cannot fabricate model comparison')
w,h=2300,1150
canvas=Image.new('RGB',(w,h),'#e9e7dd');d=ImageDraw.Draw(canvas)
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',34)
 smaller=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',23)
except OSError:
 font=ImageFont.load_default();smaller=font
for path,x,name in [(old,30,'V02 — MODELO ANTERIOR'),(new,1170,'V03 — BLOQUEIO FACETADO')]:
 im=Image.open(path).convert('RGB');f=ImageOps.contain(im,(1080,950))
 canvas.paste(f,(x+(1080-f.width)//2,90+(950-f.height)//2))
 d.text((x,38),name,fill='#273f33',font=font)
d.text((32,1090),'Ambas sao capturas reais de GLBs exportados; a v03 ainda aguarda aprovacao artistica.',font=smaller,fill='#435b50')
out=ROOT/'previews/Garruva_Comparacao_Real_V02_V03.png';canvas.save(out,optimize=True)
print('Comparison:',out)