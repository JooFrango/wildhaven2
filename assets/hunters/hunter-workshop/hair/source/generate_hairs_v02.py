#!/usr/bin/env python3
"""Wildhaven: generate two genuine UV-textured rigid GLB hairstyles, Head-local."""
import argparse, hashlib, json, math, struct
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
DEFAULT_BASE=HERE/'..'/'..'/'base'/'hunter-masculino-1000v'/'hunter_masculino_1000v.glb'
EXPECTED_SHA='90f7cf659aa4243e07f6bef0ff28e0d616815f344095ad57e81dca817cbc5cf8'
HEAD_REST_WORLD=np.array([
 [0.99961029,-0.01925480, 0.02021769, 0.00335001],
 [0.02021762, 0.99861601,-0.04855112, 1.43341295],
 [-0.01925487,0.04894093, 0.99861588,-0.01570758],
 [0,0,0,1]],dtype=np.float64)

def read_head_matrix(path):
    b=path.read_bytes()
    assert hashlib.sha256(b).hexdigest()==EXPECTED_SHA, 'GLB difere da referencia'
    jlen=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+jlen]);ns=g['nodes'];parents={}
    for i,n in enumerate(ns):
        for c in n.get('children',[]):parents[c]=i
    idx=next(i for i,n in enumerate(ns) if n.get('name')=='Head')
    chain=[]
    while True:
        chain.insert(0,idx)
        if idx not in parents:break
        idx=parents[idx]
    def local(n):
        if 'matrix' in n:return np.array(n['matrix']).reshape(4,4,order='F')
        x,y,z,w=n.get('rotation',[0,0,0,1]);s=n.get('scale',[1,1,1]);t=n.get('translation',[0,0,0])
        m=np.array([[1-2*y*y-2*z*z,2*x*y-2*w*z,2*x*z+2*w*y,0],
                    [2*x*y+2*w*z,1-2*x*x-2*z*z,2*y*z-2*w*x,0],
                    [2*x*z-2*w*y,2*y*z+2*w*x,1-2*x*x-2*y*y,0],
                    [0,0,0,1]],float)
        m[:3,:3]*=np.asarray(s);m[:3,3]=t;return m
    m=np.eye(4)
    for i in chain:m=m@local(ns[i])
    assert np.allclose(m,HEAD_REST_WORLD,atol=2e-6), 'Head rest incompatível'
    return m

class Mesh:
    def __init__(self):self.verts=[];self.uv=[];self.faces=[]
    def add(self,pts,uvs,fs):
        i=len(self.verts);self.verts.extend(pts);self.uv.extend(uvs)
        self.faces.extend([(i+a,i+b,i+c) for a,b,c in fs])
    def loft(self,rings):
        n=len(rings[0]);pts=[];uv=[];fs=[]
        for k,ring in enumerate(rings):
            for i,p in enumerate(ring):
                pts.append(p);uv.append((i/n,.02+.92*k/(len(rings)-1)))
        for k in range(len(rings)-1):
            for i in range(n):
                a=k*n+i;b=k*n+(i+1)%n;c=(k+1)*n+i;d=(k+1)*n+(i+1)%n
                fs.extend([(a,b,c),(b,d,c)])
        self.add(pts,uv,fs)
    def triangle_volume(self,p1,p2,p3,tip):
        self.add([p1,p2,p3,tip],[(.08,.1),(.16,.12),(.21,.15),(.5,.8)],
                 [(0,1,2),(0,3,1),(1,3,2),(2,3,0)])


# v02 reuses only helper and bind matrix from frozen v01 source.
# Original v01 meshes are left untouched.
ROOT = HERE.parents[1]

def _wedge(self,root_a,root_b,edge_l,edge_r,ridge):
    self.add([root_a,root_b,edge_l,edge_r,ridge],
             [(.2,.07),(.42,.07),(.23,.4),(.43,.4),(.33,.82)],
             [(0,1,4),(1,3,4),(3,2,4),(2,0,4),(0,2,1),(1,2,3)])
Mesh.wedge=_wedge

def short_hair():
    m=Mesh();n=24;rings=[]
    dimensions=[(1.601,.105,.106,.012),(1.630,.116,.110,.008),
                (1.664,.112,.108,.007),(1.687,.098,.097,.010),
                (1.709,.067,.073,.008),(1.722,.021,.024,.002)]
    for j,(y,rx,rz,ripple) in enumerate(dimensions):
        ring=[]
        for i in range(n):
            a=2*math.pi*i/n
            front=max(0,math.sin(a));back=max(0,-math.sin(a))
            scalp_line=.014*abs(math.cos(a))**3-.017*front+.002*back
            asym=.004*math.cos(a)+.006*math.sin(2*a+.48)
            rib=(.35+.65*(1-j/5))*ripple*math.sin(5*a+.72)
            y_here=y+(scalp_line if j==0 else .22*scalp_line if j==1 else 0)+asym+rib
            x=rx*(1+.035*math.sin(3*a+.4))*math.cos(a)+max(0,j-2)/3*.008
            z=rz*(1+.026*math.cos(4*a+.4))*math.sin(a)
            ring.append([x,y_here,z])
        rings.append(ring)
    m.loft(rings)
    m.add([[.009,1.724,-.008]]+rings[-1],
          [(.5,.975)]+[(i/n,.95) for i in range(n)],
          [(0,i+1,(i+1)%n+1) for i in range(n)])
    locks=[(-.084,-.045,1.608,1.614),(-.041,-.006,1.605,1.603),
           (.006,.043,1.602,1.606),(.049,.091,1.609,1.621)]
    for k,(x0,x1,y0,y1) in enumerate(locks):
        xr=(x0+x1)*.5;z=.105-.007*abs(xr)/.08
        m.wedge([x0,1.624,z-.014],[x1,1.626,z-.014],
                [x0+.004,y0,z+.002],[x1+.004,y1,z+.006],
                [xr+[.005,.011,.013,.005][k],[1.578,1.571,1.579,1.592][k],z+.022])
    for sign in (-1,1):
        x=sign*.111
        m.wedge([x,1.637,.035],[x,1.628,-.009],
                [x+sign*.003,1.602,.026],[x+sign*.005,1.598,-.008],
                [x+sign*.007,1.580,.003])
    return m

def mohawk_hair():
    m=Mesh()
    zlist=[.115,.104,.088,.064,.039,.012,-.015,-.040,-.064,-.085,-.103,-.116]
    base=[1.597,1.620,1.645,1.669,1.685,1.698,1.699,1.689,1.667,1.640,1.615,1.597]
    rise=[.010,.026,.045,.060,.066,.066,.062,.057,.045,.028,.012,.004]
    width=[.020,.028,.033,.039,.042,.044,.044,.041,.037,.032,.026,.017]
    pts=[];uv=[];faces=[];N=len(zlist)
    for i,(z,y,r,w) in enumerate(zip(zlist,base,rise,width)):
        off=.0018*math.sin(i*1.21)
        section=[[-w,y-.014,z],[-w*.87,y+r*.34,z],[-w*.54,y+r*.84,z],
                 [-w*.20+off,y+r*.98,z],[w*.24+off,y+r*.98,z],
                 [w*.56,y+r*.84,z],[w*.87,y+r*.34,z],[w,y-.014,z]]
        for k,v in enumerate(section):
            pts.append(v);uv.append((k/7,.04+.91*i/(N-1)))
    stride=8
    for i in range(N-1):
        for j in range(stride-1):
            a=i*stride+j;b=a+1;c=a+stride;d=c+1
            faces.extend(((a,b,c),(b,d,c)))
        a=i*stride;c=(i+1)*stride
        faces.extend(((a,c,a+7),(c,c+7,a+7)))
    for row in (0,N-1):
        s=row*stride
        for j in range(1,7):
            faces.append((s,s+j,s+j+1) if row==0 else (s,s+j+1,s+j))
    m.add(pts,uv,faces)
    return m

def atlas(style):
    dark=(47,35,28) if style=='short' else (37,32,30)
    im=Image.new('RGB',(256,256));px=im.load()
    for y in range(256):
        for x in range(256):
            flow=math.sin((x*1.06+y*.17)*.23)*2.2+math.sin((x*.28-y*.21)*.17)*2.8
            streak=math.sin(x*.43+y*.085)*1.1
            v=int(flow+streak)
            px[x,y]=tuple(max(0,min(255,c+v)) for c in dark)
    draw=ImageDraw.Draw(im)
    for i in range(4,256,18):
        draw.line((i,0,i-15,256),fill=tuple(min(255,c+8) for c in dark),width=2)
    return im

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--base',type=Path,default=ROOT/'base'/'hunter-masculino-1000v'/'hunter_masculino_1000v.glb')
    ap.add_argument('--output-root',type=Path,default=ROOT)
    args=ap.parse_args()
    head=read_head_matrix(args.base) if args.base.is_file() else HEAD_REST_WORLD
    inv=np.linalg.inv(head);catalog=[]
    for style,build,name in [('short',short_hair,'Curto facetado'),('mohawk',mohawk_hair,'Moicano baixo')]:
        mesh=build();world_pts=np.asarray(mesh.verts)
        local_pts=(np.c_[world_pts,np.ones(len(world_pts))]@inv.T)[:,:3]
        tm=trimesh.Trimesh(vertices=local_pts,faces=np.asarray(mesh.faces),process=False,validate=False)
        image=atlas(style)
        mat=trimesh.visual.material.PBRMaterial(name=f'Hunter_{style}_v02_UV',
                      baseColorTexture=image,metallicFactor=0.0,roughnessFactor=.94)
        tm.visual=trimesh.visual.TextureVisuals(uv=np.asarray(mesh.uv),material=mat)
        asset_id=f'hair_{style}_v02';tm.metadata['name']=asset_id
        output=args.output_root/'hair'/f'{style}-v02'
        output.mkdir(parents=True,exist_ok=True)
        glb=trimesh.exchange.gltf.export_glb(tm,include_normals=True)
        (output/f'{asset_id}.glb').write_bytes(glb)
        image.save(output/f'{asset_id}_atlas.png',optimize=True)
        manifest={
          'id':asset_id,'displayName':name,'category':'hair','occupiedSlots':['hair'],
          'attachmentMode':'bone','attachmentBone':'Head','rigVersion':'hunter-masculino-1000v-v01',
          'coordinateSpace':'Head-local (rest pose)',
          'meshByLod':{'lod0':f'hair/{style}-v02/{asset_id}.glb'},
          'materialSet':f'hunter-{style}-v02-uv','colorOptions':['dark-brown'],
          'hiddenBodyRegions':[],
          'compatibilityTags':['short-hair-helmet-clearance' if style=='short' else 'mohawk-low-crest'],
          'conflictingTags':['helmet-no-hair' if style=='short' else 'helmet-full'],
          'fallbackVariant':None,'revisionOf':f'hair_{style}_v01',
          'triangles':len(mesh.faces),'verticesExported':len(mesh.verts),'bytes':len(glb),
          'sha256':hashlib.sha256(glb).hexdigest(),'animationClips':[],
          'textureSize':[256,256],'publishedToGitHub':False,'approvedByUser':False,
          'integratedInAlpha':False,
          'modelingNotes':'v02 new silhouette; colors only UV texture'
        }
        (output/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
        catalog.append(manifest)
        print(asset_id,len(mesh.verts),'verts',len(mesh.faces),'triangles',len(glb),'bytes',manifest['sha256'])
    (args.output_root/'catalog').mkdir(parents=True,exist_ok=True)
    (args.output_root/'catalog'/'hair-v02.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n')

if __name__=='__main__':
    main()
