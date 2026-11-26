#!/usr/bin/env python3
"""Wildhaven Hunter Workshop: two new real low-poly hairstyles (v03 batch).

Original styles: medium swept-back + compact short ponytail. Single mesh per
GLB, one opaque UV-painted material, Head-rest-local vertices. No duplicate rig.
No changes to any v01/v02 model.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw
from generate_hairs import HEAD_REST_WORLD, read_head_matrix

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

class Geometry:
    def __init__(self):
        self.vertices=[]
        self.uv=[]
        self.faces=[]

    def add(self, verts, uv, tris):
        at=len(self.vertices)
        self.vertices.extend(verts)
        self.uv.extend(uv)
        self.faces.extend((at+a,at+b,at+c) for a,b,c in tris)

    def ribbon(self, rows, band_u=(0.05,0.85)):
        """Long sculptural stripe with real raised faceted ridge and two flanks."""
        verts=[];uv=[];tris=[]
        for i,row in enumerate(rows):
            assert len(row)==3
            for j,pt in enumerate(row):
                verts.append(pt)
                uv.append((band_u[0]+(band_u[1]-band_u[0])*j/2,.03+.91*i/(len(rows)-1)))
        for i in range(len(rows)-1):
            for j in range(2):
                a=3*i+j;b=a+1;c=a+3;d=c+1
                tris.extend([(a,c,b),(b,c,d)])
        self.add(verts,uv,tris)

    def wedge(self, pts, uv_shift=0):
        """Five-point solid triangularly faceted tip, geometry for silhouette only."""
        self.add(pts,[(.05+uv_shift,.06),(.42+uv_shift,.09),(.10+uv_shift,.48),
                     (.52+uv_shift,.51),(.31+uv_shift,.78)],
                 [(0,1,4),(1,3,4),(3,2,4),(2,0,4),(0,2,1),(1,2,3)])

    def tube(self, rings, uv_v=(.06,.84), sides=8):
        """Closed faceted ponytail/tie using successive 3D cross section rings."""
        assert all(len(x)==sides for x in rings)
        verts=[];uv=[];tris=[]
        for ri,ring in enumerate(rings):
            for i,p in enumerate(ring):
                verts.append(p)
                uv.append((i/sides,uv_v[0]+(uv_v[1]-uv_v[0])*ri/(len(rings)-1)))
        for k in range(len(rings)-1):
            for i in range(sides):
                a=k*sides+i;b=k*sides+(i+1)%sides;c=a+sides;d=b+sides
                tris.extend([(a,b,c),(b,d,c)])
        verts.extend([np.mean(rings[0],axis=0).tolist(),np.mean(rings[-1],axis=0).tolist()])
        uv.extend([(.5,uv_v[0]),(.5,uv_v[1])])
        begin=len(verts)-2;end=len(verts)-1
        for i in range(sides):
            tris.append((begin,(i+1)%sides,i))
            off=(len(rings)-1)*sides
            tris.append((end,off+i,off+(i+1)%sides))
        self.add(verts,uv,tris)

def head_surface(x,z,kind):
    """Hair coverage fitted above the original Hunter skull in its rest pose."""
    high=1.733 if kind=='swept-back' else 1.721
    side=.108*(abs(x)/.119)**2
    fore=.136*(max(0.0,(z-.022)/.099))**2
    back=.100*(max(0.0,(-z-.023)/.102))**2
    return high-side-fore-back

def build_cap(kind):
    g=Geometry()
    zs=[.102,.094,.082,.064,.038,.008,-.022,-.050,-.077,-.099,-.119]
    n=12
    rows=[]
    for k,z in enumerate(zs):
        x_extent=.117*math.sqrt(max(.13,1-(z/.142)**2))
        row=[]
        for j in range(n):
            x=x_extent*(2*j/(n-1)-1)
            y=head_surface(x,z,kind)
            y+=.0020*math.sin(2.9*k+.57*j)
            row.append([x,y,z])
        rows.append(row)
    pos=[];uv=[];faces=[]
    for k,row in enumerate(rows):
        for j,p in enumerate(row):
            pos.append(p)
            uv.append((.01+.96*j/(n-1),.05+.86*k/(len(rows)-1)))
    for k in range(len(rows)-1):
        for j in range(n-1):
            a=k*n+j;b=a+1;c=a+n;d=b+n
            faces.extend(((a,c,b),(b,c,d)))
    g.add(pos,uv,faces)
    for side in (-1,1):
        top=[];bottom=[]
        for k,z in enumerate(zs[1:-1]):
            xx=side*.117*math.sqrt(max(.13,1-(z/.142)**2))
            yy=head_surface(xx,z,kind)
            drop=.012+.013*max(0,(-z-.025)/.10)+.007*max(0,(z-.045)/.07)
            top.append([xx,yy,z]);bottom.append([xx*1.007,yy-drop,z])
        verts=[];uv=[];tris=[]
        for k,(t,b) in enumerate(zip(top,bottom)):
            verts.extend((t,b));uv.extend(((.24,.06+.85*k/(len(top)-1)),(.28,.06+.85*k/(len(top)-1))))
        for k in range(len(top)-1):
            a=k*2;tris.extend(((a,a+2,a+1),(a+1,a+2,a+3)))
        g.add(verts,uv,tris)
    return g, zs

def add_swept_bands(g,kind):
    """Raised broad hair sections that flow back from forehead to rear crown."""
    centers=[-.077,-.047,-.015,.019,.053,.083] if kind=='swept-back' else [-.075,-.041,-.004,.036,.071]
    zs=[.096,.087,.070,.047,.018,-.011,-.040,-.066,-.090,-.110]
    for lane,center in enumerate(centers):
        rows=[]
        for i,z in enumerate(zs):
            shift=.018*(1-z/.110)*(.25+.75*(lane+1)/len(centers))
            x=center+shift
            ext=.117*math.sqrt(max(.13,1-(z/.142)**2))
            x=max(-ext*.82,min(ext*.82,x))
            half=.0125 if kind=='swept-back' else .014
            half*=.82+ .18*math.sin(math.pi*i/(len(zs)-1))
            peak=.0105 if kind=='swept-back' else .0063
            peak*=.08+.92*math.sin(math.pi*i/(len(zs)-1))
            left=x-half;right=x+half
            rows.append([[left,head_surface(left,z,kind)+.002,z],
                        [x,head_surface(x,z,kind)+peak,z-.0018],
                        [right,head_surface(right,z,kind)+.002,z]])
        g.ribbon(rows)
    if kind=='swept-back':
        for sign in [-1,1]:
            g.wedge([[sign*.096,1.629,-.044],[sign*.086,1.646,-.072],
                     [sign*.105,1.578,-.078],[sign*.067,1.589,-.112],
                     [sign*.077,1.556,-.101]])
        g.wedge([[-.036,1.627,-.103],[.026,1.635,-.108],
                 [-.026,1.580,-.124],[.032,1.581,-.126],[.009,1.560,-.131]])

def ponytail(g):
    def ring(z,y,rx,ry):
        return [[rx*math.cos(2*math.pi*i/8),y+ry*math.sin(2*math.pi*i/8),z]
                for i in range(8)]
    rings=[ring(-.110,1.626,.025,.025),ring(-.127,1.614,.025,.025),
           ring(-.147,1.604,.028,.027),ring(-.166,1.590,.024,.025),
           ring(-.181,1.582,.017,.018),ring(-.187,1.579,.003,.003)]
    g.tube(rings)
    g.tube([ring(-.128,1.614,.026,.026),ring(-.137,1.608,.026,.027)],uv_v=(.91,.99))

def make_atlas(style):
    """Painted strands are image pixels (no polygons to indicate color)."""
    base=(49,35,27) if style=='swept-back' else (43,31,25)
    w=h=256
    out=Image.new('RGB',(w,h));pix=out.load()
    for y in range(h):
        for x in range(w):
            waved=3.5*math.sin(x*.41+y*.047)+2.2*math.cos(x*.12-y*.095)
            tangent=1.5*math.sin((x+y*.21)*.18)
            n=int(waved+tangent)
            pix[x,y]=tuple(max(0,min(255,a+n)) for a in base)
    draw=ImageDraw.Draw(out)
    for i in range(7,256,17):
        draw.line([(i,0),(i-19,225)],fill=tuple(min(255,a+8) for a in base),width=2)
    if style=='short-ponytail':
        draw.rectangle((0,0,256,26),fill=(24,22,21))
        draw.rectangle((0,230,256,256),fill=(24,22,21))
    return out

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--base',type=Path,default=ROOT/'base'/'hunter-masculino-1000v'/'hunter_masculino_1000v.glb')
    p.add_argument('--output-root',type=Path,default=ROOT)
    args=p.parse_args()
    if args.base.is_file():
        assert np.allclose(read_head_matrix(args.base),HEAD_REST_WORLD,atol=2e-6)
    inv=np.linalg.inv(HEAD_REST_WORLD)
    all_manifest=[]
    for style,label in [('swept-back','Médio penteado para trás'),('short-ponytail','Rabo de cavalo curto')]:
        g,_=build_cap(style)
        add_swept_bands(g,style)
        if style=='short-ponytail':ponytail(g)
        v=np.asarray(g.vertices,dtype=np.float64)
        local=(np.column_stack((v,np.ones(len(v))))@inv.T)[:,:3]
        mesh=trimesh.Trimesh(vertices=local,faces=np.asarray(g.faces,dtype=np.int32),process=False,validate=False)
        img=make_atlas(style)
        mesh.visual=trimesh.visual.TextureVisuals(uv=np.asarray(g.uv),material=trimesh.visual.material.PBRMaterial(
            name='HunterHair_'+style+'_UV',baseColorTexture=img,metallicFactor=0.0,roughnessFactor=.94,doubleSided=True))
        key='hair_'+style.replace('-','_')+'_v01'
        mesh.metadata['name']=key
        folder=args.output_root/'hair'/(style+'-v01')
        folder.mkdir(exist_ok=True,parents=True)
        glb=trimesh.exchange.gltf.export_glb(mesh,include_normals=True)
        (folder/(key+'.glb')).write_bytes(glb)
        img.save(folder/(key+'_atlas.png'),optimize=True)
        desc={
          'id':key,'displayName':label,'category':'hair','occupiedSlots':['hair'],
          'attachmentMode':'bone','attachmentBone':'Head','rigVersion':'hunter-masculino-1000v-v01',
          'coordinateSpace':'Head-local (rest pose)','meshByLod':{'lod0':f'hair/{style}-v01/{key}.glb'},
          'materialSet':'hunter-hair-'+style+'-v01','colorOptions':['dark-brown'],
          'hiddenBodyRegions':[], 'compatibilityTags':['rig-head','hunter-male-base'],
          'conflictingTags':['helmet-full-no-hair'], 'fallbackVariant':None,
          'triangles':len(g.faces),'verticesExported':len(g.vertices),
          'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),
          'textureSize':[256,256],'animationClips':[],
          'status':'blockout-review','approvedByUser':False,'integratedInAlpha':False,
          'geometryNotes':'Real 3D volumes, UV-only painted hair strands. One mesh/material; rigid head attachment.'
        }
        (folder/'manifest.json').write_text(json.dumps(desc,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
        all_manifest.append(desc)
        print(key,len(g.vertices),'vertices',len(g.faces),'triangles',len(glb),'bytes')
    catalog=args.output_root/'catalog'
    catalog.mkdir(exist_ok=True,parents=True)
    (catalog/'hair-v03.json').write_text(json.dumps(all_manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')

if __name__=='__main__':main()
