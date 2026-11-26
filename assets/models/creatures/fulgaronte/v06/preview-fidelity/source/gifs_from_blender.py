#!/usr/bin/env python3
"""Make compressed GIFs and one side-by-side comparison from genuine Blender renders."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
data=json.loads((root/"render_manifest.json").read_text())
for name,info in data["clips"].items():
  frames=[]
  for p in info["frames"]:
    im=Image.open(root/p).convert("RGB")
    # Reduce file size; NOT texture approximation or geometry manipulation.
    im.thumbnail((640,480),Image.Resampling.LANCZOS)
    frames.append(im)
  gif=root/(name+"_blender_real.gif")
  frames[0].save(gif,save_all=True,append_images=frames[1:],duration=210,loop=0,optimize=True)
  print("GIF_FROM_BLENDER",gif.name,gif.stat().st_size)
a=Image.open(root/"fulgaronte_v04_blender_original.png").convert("RGB")
b=Image.open(root/"fulgaronte_v06_bind_pose_blender.png").convert("RGB")
assert a.size==b.size
sheet=Image.new("RGB",(a.width*2,a.height+44),(236,239,241))
sheet.paste(a,(0,44));sheet.paste(b,(a.width,44))
d=ImageDraw.Draw(sheet)
d.text((20,14),"ORIGINAL V04 CLAUDE — BLENDER",fill=(30,40,50))
d.text((a.width+20,14),"V06 REST/BIND POSE — BLENDER",fill=(30,40,50))
sheet.save(root/"comparacao_v04_v06_blender.png")
print("BLENDER_RENDER_COMPARISON",root/"comparacao_v04_v06_blender.png")
