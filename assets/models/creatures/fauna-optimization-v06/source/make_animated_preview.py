#!/usr/bin/env python3
# Trigger animated-preview workflow after registration.
from __future__ import annotations
import importlib.util, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve()
BASE_PATH=HERE.parents[2]/"fauna-optimization-v01/source/pipeline.py"
spec=importlib.util.spec_from_file_location("fauna_base",BASE_PATH)
base=importlib.util.module_from_spec(spec); spec.loader.exec_module(base)

ROOT=HERE.parents[5]
OUT=ROOT/"assets/models/creatures/fauna-optimization-v06/previews"
TMP=OUT/"animated_frames"
OUT.mkdir(parents=True,exist_ok=True); TMP.mkdir(parents=True,exist_ok=True)

CASES=[
  {
    "title":"Nivélio  ·  flee",
    "glb":ROOT/"assets/models/creatures/detritivoros/nivelio-optimized-v02-LOD0.glb",
    "clip":"nivelio_flee",
    "prefix":"nivelio"
  },
  {
    "title":"Dunébrio  ·  defend",
    "glb":ROOT/"assets/models/creatures/detritivoros/dunebrio-optimized-v02-LOD0.glb",
    "clip":"dunebrio_defend",
    "prefix":"dunebrio"
  }
]

FRAMES=14
DURATION=110
W,H=1240,620
PANEL_W=560
PANEL_H=460
BG=(232,233,227)
INK=(43,50,48)

def crop_stage(img:Image.Image)->Image.Image:
    img=img.convert("RGB")
    # remove most empty lower margin while preserving feet/antennae
    box=img.getbbox()
    if box:
        img=img.crop(box)
    img.thumbnail((PANEL_W-30,PANEL_H-45),Image.Resampling.LANCZOS)
    return img

def draw_label(draw,xy,text,font):
    draw.text(xy,text,fill=INK,font=font)

font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",24)
footer_font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",20)
frames=[]
for fi in range(FRAMES):
    phase=fi/FRAMES
    rendered=[]
    for case in CASES:
        p=TMP/f'{case["prefix"]}-{fi:02d}.png'
        base.render(case["glb"],p,"three_quarter",case["clip"],phase)
        rendered.append(crop_stage(Image.open(p)))
    canvas=Image.new("RGB",(W,H),BG)
    d=ImageDraw.Draw(canvas)
    draw_label(d,(22,16),CASES[0]["title"],font)
    draw_label(d,(640,16),CASES[1]["title"],font)
    xslots=[20,640]
    for x,im in zip(xslots,rendered):
        px=x+(PANEL_W-im.width)//2
        py=78+(PANEL_H-im.height)//2
        canvas.paste(im,(px,py))
    # subtle center divider + footer like a compact ChatGPT preview card
    d.line((620,72,620,548),fill=(190,194,188),width=1)
    d.text((22,575),"Wildhaven · animações reais dos GLBs otimizados",fill=(70,78,74),font=footer_font)
    frames.append(canvas)

gif=OUT/"Wildhaven_Nivelio_Dunebrio_Animated_GLBS.gif"
frames[0].save(
    gif,save_all=True,append_images=frames[1:],duration=DURATION,
    loop=0,optimize=True,disposal=2
)
poster=OUT/"Wildhaven_Nivelio_Dunebrio_Animated_GLBS_Poster.png"
frames[0].save(poster,optimize=True)
print(gif)
print(poster)
