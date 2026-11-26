#!/usr/bin/env python3
"""Compare honest V02 and V03 GLB renderer captures without AI reconstruction."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
ROOT=Path(__file__).resolve().parent.parent
old=Path(__file__).resolve().parents[2]/'mastelio'/'mastelio-real-3d-three_quarter-v02.png'
# local source archive layout may differ; fallback to explicitly shipped prior render.
if not old.is_file():
 old=Path('/mnt/data/Wildhaven_Megafauna_Savana_v02/previews/mastelio-real-3d-three_quarter-v02.png')
new=ROOT/'previews/mastelio-v03-real-glb-three_quarter.png'
if not old.is_file():
 raise FileNotFoundError('Missing real v02 model screenshot; provide it for authentic comparison')
canvas=Image.new('RGB',(2300,1140),'#ecebe2')
d=ImageDraw.Draw(canvas)
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',34)
 label=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',23)
except OSError:
 font=ImageFont.load_default();label=font
for file,x,tag in [(old,30,'V02 — MODELO ANTERIOR'),(new,1170,'V03 — BLOCKOUT FACETADO')]:
 img=Image.open(file).convert('RGB')
 fit=ImageOps.contain(img,(1070,950))
 canvas.paste(fit,(x+(1070-fit.width)//2,100+(950-fit.height)//2))
 d.text((x,45),tag,font=font,fill='#2b443b')
d.text((36,1081),'Ambos os quadros são capturas de GLBs reais. Comparação não representa aprovação artística.',font=label,fill='#4a5a52')
out=ROOT/'previews/Mastelio_Comparacao_Real_V02_V03.png'
canvas.save(out,optimize=True)
print('SAVED',out)