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
                pts.append(p);uv.append((i/n,k/(len(rings)-1)))
        for k in range(len(rings)-1):
            for i in range(n):
                a=k*n+i;b=k*n+(i+1)%n;c=(k+1)*n+i;d=(k+1)*n+(i+1)%n
                fs.extend([(a,b,c),(b,d,c)])
        self.add(pts,uv,fs)
    def triangle_volume(self,p1,p2,p3,tip):
        self.add([p1,p2,p3,tip],[(.08,.1),(.16,.12),(.21,.15),(.5,.8)],
                 [(0,1,2),(0,3,1),(1,3,2),(2,3,0)])

def short_hair():
    m=Mesh();n=20;rings=[]
    for rx,rz,y,wiggle in [(0.110,0.109,1.604,.019),(.111,.107,1.661,.004),(.076,.082,1.706,.003),(.024,.027,1.732,0)]:
        arr=[]
        for i in range(n):
            theta=2*math.pi*i/n;x=rx*math.cos(theta);z=rz*math.sin(theta)
            h=y+wiggle*(math.sin(theta)-.3)
            if y==1.604:h+=0.006*math.sin(theta*5)
            arr.append([x,h,z])
        rings.append(arr)
    m.loft(rings)
    m.add([[0,1.737,0]]+rings[-1],[(.5,1)]+[(i/n,1) for i in range(n)],
          [(0,i+1,(i+1)%n+1) for i in range(n)])
    for x in [-.065,-.025,.025,.065]:
        z=.112-.012*abs(x)/.065
        m.triangle_volume([x-.021,1.619,z-.009],[x+.017,1.620,z-.006],
                          [x,1.581+abs(x)*.11,z+.012],[x-.001,1.635,z+.016])
    return m

def mohawk_hair():
    m=Mesh()
    zlist=[.112,.091,.061,.027,-.010,-.047,-.081,-.111]
    ybase=[1.602,1.643,1.684,1.712,1.710,1.688,1.645,1.603]
    heights=[.035,.073,.106,.117,.122,.112,.079,.037]
    widths=[.032,.043,.052,.057,.057,.052,.040,.031]
    pts=[];uv=[];fs=[]
    for i,(z,base,rise,width) in enumerate(zip(zlist,ybase,heights,widths)):
        sec=[[-width,base-.004,z],[-width*.43,base+rise*.67,z],
             [-.005,base+rise,z],[width*.38,base+rise*.76,z],[width,base-.004,z]]
        for j,v in enumerate(sec):pts.append(v);uv.append((j/4,i/(len(zlist)-1)))
    for i in range(len(zlist)-1):
        for j in range(4):
            a=i*5+j;b=a+1;c=a+5;d=b+5
            fs.extend([(a,b,c),(b,d,c)])
    for i in range(len(zlist)-1):
        a=i*5;b=(i+1)*5;fs.extend([(a,b,a+4),(b,b+4,a+4)])
    fs.extend([(0,4,2),(5*(len(zlist)-1),5*(len(zlist)-1)+2,5*(len(zlist)-1)+4)])
    m.add(pts,uv,fs);return m

def atlas(kind):
    im=Image.new('RGB',(128,128),(34,25,20) if kind=='short' else (25,23,22))
    base=(43,31,23) if kind=='short' else (31,28,27)
    for x in range(128):
        for y in range(128):
            wave=math.sin(x*.43+y*.15)*2.5+math.cos(x*.14-y*.33)*3
            v=max(0,min(12,int(6+wave)))
            im.putpixel((x,y),tuple(min(255,c+v) for c in base))
    dr=ImageDraw.Draw(im,'RGB')
    for i in range(8,128,15):
        dr.line((i,0,i-5,127),fill=(50,37,28) if kind=='short' else (41,37,35),width=2)
    return im

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--base',type=Path,default=DEFAULT_BASE)
    ap.add_argument('--output-root',type=Path,default=HERE.parents[1])
    args=ap.parse_args()
    mtx=read_head_matrix(args.base) if args.base.exists() else HEAD_REST_WORLD
    inv=np.linalg.inv(mtx);catalog=[]
    for key,make,title,modelid in [('short',short_hair,'Curto','hair_short_v01'),('mohawk',mohawk_hair,'Moicano','hair_mohawk_v01')]:
        m=make();global_verts=np.asarray(m.verts,dtype=np.float64)
        verts=(np.c_[global_verts,np.ones(len(global_verts))]@inv.T)[:,:3]
        faces=np.asarray(m.faces,dtype=np.int32)
        tm=trimesh.Trimesh(vertices=verts,faces=faces,process=False,validate=False)
        tex=trimesh.visual.material.PBRMaterial(name=f'Wildhaven_Hair_{key}_UV',
            baseColorTexture=atlas(key),metallicFactor=0.0,roughnessFactor=0.96)
        tm.visual=trimesh.visual.TextureVisuals(uv=np.asarray(m.uv,dtype=float),material=tex)
        tm.metadata['name']=modelid
        out=args.output_root/'hair'/f'{key}-v01';out.mkdir(parents=True,exist_ok=True)
        glb_path=out/(modelid+'.glb')
        glb=trimesh.exchange.gltf.export_glb(tm,include_normals=True);glb_path.write_bytes(glb)
        atlas(key).save(out/(modelid+'_atlas.png'),optimize=True)
        dg=hashlib.sha256(glb).hexdigest()
        manifest={'id':modelid,'displayName':title,'category':'hair',
            'occupiedSlots':['hair'],'attachmentMode':'bone','attachmentBone':'Head',
            'rigVersion':'hunter-masculino-1000v-v01','coordinateSpace':'Head-local (rest pose)',
            'geometry':'rigid low poly','meshByLod':{'lod0':f'hair/{key}-v01/{modelid}.glb'},
            'materialSet':'UV-painted PBR opaque, texture embedded','colorOptions':['dark-brown'],
            'hiddenBodyRegions':[],
            'compatibilityTags':['hair-short-under-helmet' if key=='short' else 'hair-tall-needs-helmet-clearance'],
            'conflictingTags':['helmet-full' if key=='mohawk' else 'helmet-no-hair'],
            'fallbackVariant':None,'triangles':len(faces),'verticesExported':len(verts),
            'bytes':len(glb),'sha256':dg,'animationClips':[],
            'publishedToGitHub':False,'approvedByUser':False,'integratedInAlpha':False}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
        catalog.append(manifest)
        print(modelid,len(verts),'vertices',len(faces),'tris',len(glb),'bytes',dg)
    (args.output_root/'catalog').mkdir(exist_ok=True,parents=True)
    (args.output_root/'catalog'/'hair-v01.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n')

if __name__=='__main__':main()
