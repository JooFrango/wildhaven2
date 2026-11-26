"""Paint the settlement's original, shared PBR atlas. All UV islands use padded cells."""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT=Path(__file__).resolve().parents[1]/'textures'
CELL=192
NAMES=['oak','beam','bark','plaster','slate','hide','stone','iron','ivory','brass','banner','linen','moss','clay','coal','boards']
RGB=[(163,103,54),(88,56,37),(106,74,45),(203,174,125),(75,94,102),(158,76,48),(126,128,120),(66,76,78),
     (228,204,152),(181,133,68),(151,47,41),(214,192,143),(105,135,72),(153,84,46),(51,46,45),(145,99,59)]
ROUGH=[.74,.81,.94,.91,.88,.73,.94,.44,.63,.43,.94,.91,.97,.89,.96,.84]


def make():
    OUT.mkdir(exist_ok=True)
    rng=np.random.default_rng(171)
    atlas=Image.new('RGB',(CELL*4,CELL*4))
    surface=np.zeros((CELL*4,CELL*4),dtype=float)
    orm=np.zeros((CELL*4,CELL*4,3),dtype=np.uint8)
    y,x=np.mgrid[:CELL,:CELL]; u=x/CELL; v=y/CELL
    for i,name in enumerate(NAMES):
        noise=rng.normal(0,.017,(CELL,CELL))
        relief=.045*rng.normal(size=noise.shape)
        mottled=np.zeros_like(u)
        for _ in range(6):
            mottled+=.022*np.sin(x*rng.uniform(.012,.074)+y*rng.uniform(-.067,.076)+rng.uniform(0,6))
        variation=noise+mottled
        if name in ('oak','beam','bark','boards'):
            wave=6*v+.12*np.sin(9*u)+.12*np.cos(u*16+v*5)
            grain=np.sin(2*math.pi*wave*3.8)
            variation+=.06*np.sin(2*math.pi*wave)-.19*np.maximum(grain,0)**10
            relief+=.24*grain
            if name=='boards':
                gaps=(y%48)<3
                variation[gaps]-=.36;relief[gaps]-=1
        elif name=='slate':
            for row in range(4):
                top=row*48
                rowcol=(x+(row%2)*21)//43
                section=(y>=top)&(y<top+48)
                joint=((x+(row%2)*21)%43<2)&section
                variation+=section*(.10*np.sin(rowcol*3.4+row*7)+.15*((y-top)/48-.5))
                variation[joint]-=.32;relief[joint]-=.8
                seam=(y==top)|(y==top+1)
                variation[seam]-=.48;relief[seam]-=1
        elif name=='stone':
            for row in range(5):
                dy=y-row*39
                dx=(x+row*31)%68
                joint=(dy>=0)&(dy<39)&((dy<2+1.2*np.sin(x*.22))|(dx<3+np.sin(y*.4)))
                variation[joint]-=.36;relief[joint]-=1
                variation+=(dy>=0)*(dy<39)*.08*np.sin(((x+row*31)//68)*7+row*2)
        elif name in ('hide','linen','banner'):
            variation+=.022*np.sin(x*math.pi/2)+.025*np.sin(y*math.pi/2)+.052*np.cos((u+.1*v)*24)
            relief+=.14*np.sin(x*math.pi/2)+.13*np.sin(y*math.pi/2)
        elif name=='ivory':
            variation+=.04*np.sin(30*u+np.sin(10*v))-.12*(1-v)**6
        raw=np.clip((np.array(RGB[i])[None,None,:]*(1+variation[:,:,None])),0,255).astype('uint8')
        im=Image.fromarray(raw);d=ImageDraw.Draw(im)
        if name in ('banner','hide','linen'):
            border=(214,177,108) if name=='banner' else (144,118,80)
            for ax in [10,181]:
                d.line((ax,3,ax,189),fill=border,width=2)
                for yy in range(4,188,9):d.line((ax-2,yy,ax+2,yy+3),fill=(227,198,143),width=1)
        if name=='banner':
            gold=(234,202,133);bone=(249,224,165)
            d.polygon([(96,151),(73,117),(84,124),(93,105),(99,120),(112,105),(117,114)],fill=gold)
            for s in [-1,1]:
                def points(p):return [(96+s*a,b) for a,b in p]
                d.polygon(points([(8,107),(15,91),(33,81),(49,52),(44,79),(62,66),(54,84),(32,95),(20,109)]),fill=bone)
                d.polygon(points([(25,88),(20,65),(25,72),(27,52),(32,73),(30,86)]),fill=gold)
            d.polygon([(96,39),(104,56),(96,67),(88,56)],fill=gold)
            for yy in [25,163]:
                d.line([(18,yy),(75,yy),(84,yy+3)],fill=gold,width=2)
                d.line([(108,yy+3),(117,yy),(174,yy)],fill=gold,width=2)
        if name=='boards':
            for xx in [10,CELL-11]:
                for yy in range(24,CELL,48):d.ellipse((xx-2,yy-2,xx+1,yy+1),fill=(65,57,51))
        left,top=(i%4)*CELL,(i//4)*CELL
        atlas.paste(im,(left,top));surface[top:top+CELL,left:left+CELL]=relief
        patch=orm[top:top+CELL,left:left+CELL];patch[:,:,0]=255
        patch[:,:,1]=np.uint8(np.clip(ROUGH[i]+variation*.12,0,1)*255)
        patch[:,:,2]={'iron':210,'brass':174}.get(name,0)
    atlas.save(OUT/'village-color.jpg',quality=92,subsampling=0)
    Image.fromarray(orm).save(OUT/'village-orm.png',optimize=True)
    gy,gx=np.gradient(surface)
    normals=np.stack((-gx*.55,gy*.55,np.ones_like(gx)),axis=2)
    normals/=np.linalg.norm(normals,axis=2,keepdims=True)
    Image.fromarray(np.uint8(127.5+127.5*normals)).save(OUT/'village-normal.png',optimize=True)

if __name__=='__main__':
    make()

