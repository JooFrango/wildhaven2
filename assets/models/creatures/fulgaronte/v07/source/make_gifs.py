#!/usr/bin/env python3
"""GIFs from REAL Blender-rendered frames only, never synthetic stills."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];P=ROOT/"previews"
manifest=json.loads((P/"render_manifest.json").read_text())
for name,info in manifest["clips"].items():
 frames=[Image.open(P/f).convert("RGB") for f in info["frames"]]
 out=P/(name+".gif")
 frames[0].save(out,save_all=True,append_images=frames[1:],duration=180,loop=0,optimize=True)
 assert out.stat().st_size>20000
 print("TRUE_BLENDER_GIF",name,out.stat().st_size)
a=Image.open(P/"original_claude_v04.png").convert("RGB")
b=Image.open(P/"v07_neutral_bindpose.png").convert("RGB")
assert a.size==b.size
panel=Image.new("RGB",(a.width*2,a.height+38),(226,232,238))
panel.paste(a,(0,38));panel.paste(b,(a.width,38))
draw=ImageDraw.Draw(panel)
draw.text((12,12),"CLAUDE V04 (original)",fill=(29,35,42))
draw.text((a.width+12,12),"V07 (mesma geometria, rig e textura)",fill=(29,35,42))
panel.save(P/"comparativo_original_claude_v07.png")
print("REAL_BLENDER_COMPARISON_CREATED")
# Retain only the representative frame for each clip: the GIF contains all 10.
for name,info in manifest["clips"].items():
 frames=info["frames"]
 info["frames_rendered"]=len(frames)
 info["representative_still"]=frames[5]
 for i,f in enumerate(frames):
  if i!=5:(P/f).unlink(missing_ok=True)
 del info["frames"]
(P/"render_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("REMOVED_TEMPORARY_BLENDER_FRAMES")

