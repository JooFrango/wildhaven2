#!/usr/bin/env python3
"""Render real imported GLB bytes with vtkGLTFImporter, six views plus contact sheet."""
from __future__ import annotations
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
PREVIOUS=ROOT/'savanna-small-herbivores-v01'/'source'/'render_exported.py'
spec=importlib.util.spec_from_file_location('wildhaven_render_imported',PREVIOUS)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
preview_dir=HERE.parent/'previews'
preview_dir.mkdir(parents=True,exist_ok=True)
shots=[]
for species in ('sevilho','arbelio'):
    model=ROOT/species/f'{species}-savanna-faceted-v02-LOD0.glb'
    for angle in ('side','front','three_quarter'):
        out=preview_dir/f'{species}-v02-real-GLB-{angle}.png'
        module.render_one(model,out,angle)
        shots.append((species,angle,out))
sheet=Image.new('RGB',(1800,940),'#e4e7df')
pen=ImageDraw.Draw(sheet)
for i,(species,angle,path) in enumerate(shots):
    x=(i%3)*600;y=(i//3)*470
    src=Image.open(path).convert('RGB')
    src.thumbnail((580,420))
    sheet.paste(src,(x+(600-src.width)//2,y+18))
    pen.text((x+16,y+445),f'{species.title()} - {angle} | real imported glTF v02',fill='#283329')
sheet.save(preview_dir/'Wildhaven_Sevilho_Arbelio_Real_GLBS_v02.png',optimize=True)
print('CAPTURE_REAL_GLB_OK',len(shots),flush=True)
