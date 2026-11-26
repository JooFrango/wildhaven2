#!/usr/bin/env python3
"""Arrange only genuine screenshots loaded from the exported GLBs; no AI generation."""
from PIL import Image,ImageOps,ImageDraw,ImageFont
from pathlib import Path
import argparse
ROOT=Path(__file__).resolve().parents[1]
def main(root=ROOT):
    source=root/'previews';ids=[('Sevilho','sevilho'),('Arbélio','arbelio'),('Frutavil','frutavil'),('Cromátil','cromatil')]
    W,H=1180,795;sheet=Image.new('RGB',(2*W,2*(H+52)),'#e8e7df');d=ImageDraw.Draw(sheet)
    for i,(name,id) in enumerate(ids):
        img=Image.open(source/f'{id}-real-3d-three_quarter-v01.png').convert('RGB')
        img=ImageOps.fit(img,(W,H));x=(i%2)*W;y=(i//2)*(H+52)+52;sheet.paste(img,(x,y))
        try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',29)
        except OSError:font=ImageFont.load_default()
        d.text((x+20,y-37),name,fill='#24322d',font=font)
    p=source/'Wildhaven_4_Pequenos_Previews_Reais_v01.png';sheet.save(p);print('Captured GLB contact sheet',p)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=ROOT);a=p.parse_args();main(a.root)