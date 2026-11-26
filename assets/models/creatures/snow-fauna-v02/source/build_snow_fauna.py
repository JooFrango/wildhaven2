#!/usr/bin/env python3
"""Wildhaven snow fauna v01. Three refined mid-poly UV-textured blockouts.

Builds true glTF 2.0 binary assets, not generated artwork. Only aesthetic
silhouette details are meshes; pigmentation and markings are atlas textures.
Each authored component is independently closed and has outward face winding.
This source implements no rig, animation, collision or gameplay integration.
"""
import argparse
import hashlib
import json
import math
import random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
ASSETS.mkdir(parents=True,exist_ok=True)

C=math.cos; S=math.sin; PI=math.pi
TILES=['BODY','LIGHT','DARK','LIMB','PLATE','FUR','HORN','HOOF','EYE','FEATHER','RUST','BLUE','PINK','TIP','SNOUT','TAIL']
TILE_ID={k:i for i,k in enumerate(TILES)}
PALETTES={
 'casquim':dict(BODY='#85766e',LIGHT='#ded4c0',DARK='#64564e',LIMB='#8d776f',PLATE='#64544c',FUR='#a79a8a',HORN='#e5d9bd',HOOF='#564b47',EYE='#261e20',FEATHER='#b8a590',RUST='#7d5c54',BLUE='#7f8b95',PINK='#aa8483',TIP='#544b43',SNOUT='#9a8275',TAIL='#827369'),
 'gelfaro':dict(BODY='#7e7c7f',LIGHT='#d7d1c8',DARK='#424348',LIMB='#68666d',PLATE='#504953',FUR='#d0c8bc',HORN='#d3b99e',HOOF='#3b373e',EYE='#d7a64a',FEATHER='#d5c8c1',RUST='#a46d57',BLUE='#75879d',PINK='#b78579',TIP='#423d41',SNOUT='#5f5559',TAIL='#986a5e'),
 'tufrino':dict(BODY='#c0c1c5',LIGHT='#f2eee4',DARK='#585f6f',LIMB='#777984',PLATE='#949daa',FUR='#dedad3',HORN='#3b4251',HOOF='#444753',EYE='#3b2c27',FEATHER='#afb7be',RUST='#ac9584',BLUE='#82aeca',PINK='#b8a6a0',TIP='#5d6273',SNOUT='#504e54',TAIL='#a0a9b4'),
 'branquelope':dict(BODY='#cbbab5',LIGHT='#f4eae1',DARK='#917c7b',LIMB='#d6c7bf',PLATE='#b5a3a0',FUR='#f0e8de',HORN='#89736b',HOOF='#524749',EYE='#3c2f2d',FEATHER='#f5e4df',RUST='#b99b95',BLUE='#9fa9ba',PINK='#d6a8a9',TIP='#85706f',SNOUT='#e3cec3',TAIL='#e1d3ca'),
 'nevisco':dict(BODY='#e5e2df',LIGHT='#fcf6ef',DARK='#a3a3ae',LIMB='#d4d1d5',PLATE='#c7c8d1',FUR='#f9f3ee',HORN='#80787b',HOOF='#625e65',EYE='#7e6d62',FEATHER='#f5eff0',RUST='#c3a6a1',BLUE='#95a7c7',PINK='#d0a8ad',TIP='#a5a1aa',SNOUT='#e6d5cc',TAIL='#eae7e9')
}

def rgb(h):return tuple(int(h[i:i+2],16) for i in (1,3,5))

def atlas(spec, dest):
    """Hand-authored procedural painted UV colors, mottling and belly patches.
    This is texture art, never a second mesh for color variation.
    """
    seed={'casquim':311,'gelfaro':519,'tufrino':753,'branquelope':899,'nevisco':1009}[spec]
    r=np.random.default_rng(seed)
    size=1024; tile=size//4
    im=Image.new('RGB',(size,size),'#fffdfa')
    cdict=PALETTES[spec]
    for item,tile_index in TILE_ID.items():
        c=rgb(cdict[item]);x0=(tile_index%4)*tile;y0=(tile_index//4)*tile
        h,w=tile,tile
        noise=r.normal(0,7,(h,w,1));speck=r.normal(0,5,(h,w,1))
        u=np.arange(w,dtype=float)[None,:,None];v=np.arange(h,dtype=float)[:,None,None]
        arr=np.zeros((h,w,3),dtype=float)
        arr[:]=np.asarray(c,dtype=float)[None,None,:]
        arr+=noise+speck
        if item in ['BODY','TAIL']:
            # Dorsal shadow and pale belly are painted on the same UV surface.
            dorsal=np.exp(-.5*((v/h-.24)/.19)**2)*-10
            belly=np.exp(-.5*((v/h-.76)/.14)**2)*18
            arr+=dorsal+belly
        if item in ['FUR','FEATHER','PLATE','TIP']:
            arr+=8*np.sin(u/11+v/18)
        if item=='PINK' and spec in ('nevisco','branquelope'):
            # Pale ear edges, soft inner pink by UV paint, never geometry.
            border=np.clip((np.abs(v/h-.5)-.18)*5,0,1)
            arr=arr*(1-border)+np.array(rgb(cdict['LIGHT']),dtype=float)[None,None,:]*border
        arr=np.uint8(np.clip(arr,0,255))
        tile_img=Image.fromarray(arr,'RGB');dr=ImageDraw.Draw(tile_img,'RGBA')
        blotches=170 if item in ('BODY','LIMB','TAIL','PLATE','FUR','FEATHER') else 36
        for _ in range(blotches):
            x=int(r.integers(1,w-1));y=int(r.integers(1,h-1));a=int(r.integers(1,13));b=int(r.integers(1,5))
            shade=('#3a3230' if item!='LIGHT' else '#776a5f')
            dr.ellipse((x-a,y-b,x+a,y+b),fill=(*rgb(shade),int(r.integers(10,60))))
        # Small angular brush-strokes read as fur/feathers without extra triangles.
        if item in ('FUR','FEATHER','BODY','LIMB'):
            for _ in range(210):
                x=int(r.integers(6,249));y=int(r.integers(6,249));length=int(r.integers(2,12));
                dr.line((x,y,x+length,y-2),fill=(255,247,232,int(r.integers(12,39))),width=1)
        im.paste(tile_img,(x0,y0))
    im.save(dest,optimize=True)
    return im

class Geometry:
 def __init__(self, species, texture):
    self.species=species;self.texture=texture
    self.parts=[];self.part_counts={};self.raw_memo=[]
 def _uv(self,tile,u,v):
    n=TILE_ID[tile];col=n%4;row=n//4
    # Image coordinates: UV's 0 is bottom; keep 2px padding against bleeding.
    return [((col+.012)+.976*(u%1 if u<1 else .999))/4, 1-((row+.012)+.976*(v%1 if v<1 else .999))/4]
 def add(self,xyz,faces,st,tile,tag):
    v=np.asarray(xyz,dtype=float);f=np.asarray(faces,dtype=np.int64)
    if not (len(v)>3 and len(f)>3):return
    if not (np.isfinite(v).all() and (f>=0).all() and (f<len(v)).all()):raise ValueError('Bad vertices '+tag)
    t=trimesh.Trimesh(vertices=v,faces=f,process=False)
    # A signed volume identifies winding of the closed shell. Fix instead of doubleSided.
    if t.volume < -1e-10:f=f[:,[0,2,1]];t=trimesh.Trimesh(vertices=v,faces=f,process=False)
    if t.volume < -1e-10:raise ValueError('Inverted shell '+tag)
    self.parts.append((v,f,np.array([self._uv(tile,*p) for p in st],dtype=float),tag))
    self.part_counts[tag]=self.part_counts.get(tag,0)+len(f)
    self.raw_memo.append((tag,round(float(t.volume),7)))
 def tube(self,points,radii,tile,tag,ns=9,phase=0):
    """3D loft across joints, with closed watertight ends, planar cross sections."""
    p=np.asarray(points,dtype=float);ra=np.asarray(radii,dtype=float)
    if ra.ndim==1:ra=np.column_stack([ra,ra])
    xyz=[];uv=[];L=len(p)
    for j,c in enumerate(p):
      tangent=(p[min(j+1,L-1)]-p[max(0,j-1)])
      tangent/=max(np.linalg.norm(tangent),1e-10)
      ref=np.array([0.,0.,1.]) if abs(tangent[2])<.92 else np.array([0.,1.,0.])
      e1=np.cross(tangent,ref);e1/=np.linalg.norm(e1)
      e2=np.cross(tangent,e1)
      for k in range(ns+1):
        theta=phase+2*PI*k/ns
        xyz.append(c+ra[j,0]*C(theta)*e1+ra[j,1]*S(theta)*e2)
        uv.append([j/(L-1), k/ns])
    faces=[];stride=ns+1
    for j in range(L-1):
      for k in range(ns):
        a=j*stride+k;b=a+1;c=a+stride;d=c+1
        faces.extend([[a,b,c],[b,d,c]])
    base=len(xyz);xyz.append(p[0]);uv.append([.01,.5])
    end=len(xyz);xyz.append(p[-1]);uv.append([.99,.5])
    for k in range(ns):
      faces.append([base,k+1,k]);faces.append([end,(L-1)*stride+k,(L-1)*stride+k+1])
    self.add(xyz,faces,uv,tile,tag)
 def ellipsoid(self,center,radii,tile,tag,lat=5,lon=9):
    center=np.asarray(center,float);rz=np.asarray(radii,float)
    xyz=[];uv=[];faces=[]
    for j in range(lat+1):
       ph=PI*j/lat
       for i in range(lon+1):
          th=2*PI*i/lon
          xyz.append(center+rz*np.array([math.cos(th)*math.sin(ph),math.sin(th)*math.sin(ph),math.cos(ph)]))
          uv.append([i/lon,j/lat])
    for j in range(lat):
       for i in range(lon):
          a=j*(lon+1)+i;b=a+1;c=a+lon+1;d=c+1
          if j>0:faces.append([a,c,b])
          if j<lat-1:faces.append([b,c,d])
    self.add(xyz,faces,uv,tile,tag)
 def wedge(self,base,tip,wid,thickness,tile,tag):
    """Closed 8-triangle leaf with central ridge, useful only for silhouette-forming feathers/plates."""
    b=np.asarray(base,float);t=np.asarray(tip,float)
    axis=t-b;axis/=np.linalg.norm(axis)
    ref=np.array([0,0,1.])
    left=np.cross(axis,ref)
    if np.linalg.norm(left)<1e-6:left=np.cross(axis,np.array([0,1,0.]))
    left/=np.linalg.norm(left)
    up=np.cross(axis,left);up/=np.linalg.norm(up)
    middle=b*.48+t*.52
    v=np.array([b-left*wid*.52, b+left*wid*.52, middle-left*wid*.48, middle+left*wid*.48,
                middle+up*thickness,t, b-up*thickness*.5],float)
    f=[[0,1,4],[0,4,2],[2,4,5],[4,3,5],[1,3,4],[0,2,6],[2,5,6],[5,3,6],[3,1,6],[1,0,6]]
    u=[[.08,.95],[.92,.95],[.08,.45],[.92,.45],[.5,.48],[.5,.02],[.5,.98]]
    self.add(v,f,u,tile,tag)
 def build(self):
    verts=[];faces=[];tex=[];offset=0
    for v,f,u,t in self.parts:
      verts.append(v);faces.append(f+offset);tex.append(u);offset+=len(v)
    verts=np.concatenate(verts);faces=np.concatenate(faces);tex=np.concatenate(tex)
    # Crisp mid-poly, intentionally separate each face normal (UV is on existing surface).
    flat_v=verts[faces.ravel()];flat_uv=tex[faces.ravel()]
    flat_f=np.arange(len(flat_v),dtype=np.int64).reshape(-1,3)
    mat=PBRMaterial(name=f'{self.species}_uv_painted',baseColorTexture=self.texture,
                   roughnessFactor=.98,metallicFactor=0,doubleSided=False,
                   baseColorFactor=[255,255,255,255])
    mesh=trimesh.Trimesh(vertices=flat_v,faces=flat_f,process=False,validate=False,
      visual=TextureVisuals(uv=flat_uv,material=mat))
    mesh.metadata['species_id']=self.species
    scene=trimesh.Scene();scene.add_geometry(mesh,geom_name=self.species,node_name=self.species)
    data=scene.export(file_type='glb')
    return mesh,data

# ---- Anatomy helpers ----
def limb(g,p,thicks,tag,sides=8,region='LIMB'):
 g.tube(p,thicks,region,tag,ns=sides)

def foot(g,x,y,z,w=.11,L=.2,tag='foot',tile='LIMB',claws=3,hoof=False):
 # Single low-poly load-bearing paw + toe wedges/caps.
 g.tube([[x+.08,y,z+.07],[x,y,z+.055],[x-L*.7,y,z+.035],[x-L,y,z+.023]],
   [[w*.80,.075],[w,.066],[w*.83,.044],[w*.37,.024]],tile,tag,ns=7)
 if hoof:
  for s in (-1,1):
    yy=y+s*w*.45
    g.tube([[x-L*.72,yy,z+.043],[x-L*.98,yy+s*.015,z+.026]],[[w*.35,.042],[w*.19,.027]],'HOOF',tag+'_hoof'+str(s),ns=5)
 else:
  for k in range(claws):
    t=(k-(claws-1)/2)
    yy=y+t*w*.52
    g.tube([[x-L*.89,yy,z+.037],[x-L*1.07,yy+t*.011,z+.026]],[[w*.20,.026],[.003,.003]],'HOOF',tag+'_claw'+str(k),ns=5)

def eye(g,x,y,z,r=.044,tag='eye'):
 # Eye is placed in the skull surface rather than suspended on a stalk.
 g.ellipsoid([x,y,z],[r*.72,r*.38,r],'EYE',tag,lat=4,lon=8)

def ears(g,base,tip,ww,tag,tile='PINK'):
 g.wedge(base,tip,ww,.027,tile,tag)

def plates(g,x0,x1,y0,z0,rows,n_per_row,sc,tag,tile='PLATE'):
 for row in range(rows):
  for k in range(n_per_row):
   x=x0+(x1-x0)*(row+.25+(k%2)*.07)/rows
   y=y0+(k-(n_per_row-1)/2)*sc*.75
   z=z0-(abs(k-(n_per_row-1)/2)*.016)
   tip=[x+.110,y,z+sc*.16]
   g.wedge([x-.070,y,z-.025],tip,sc*.86,sc*.09,tile,tag+f'_{row}_{k}')

def casquim(g):
 # Snow-wetland low herbivore. Broad pelvis, incredibly strong plant-digging forelimbs.
 g.tube([[-.54,0,.43],[-.37,0,.47],[-.12,0,.49],[.15,0,.48],[.39,0,.43],[.57,0,.36]],
        [[.12,.16],[.23,.22],[.33,.275],[.32,.25],[.22,.20],[.07,.08]],'BODY','trunk',ns=12)
 g.tube([[-.77,0,.52],[-.63,0,.55],[-.47,0,.50],[-.31,0,.45]],
        [[.06,.12],[.19,.17],[.225,.17],[.11,.12]],'SNOUT','skull',ns=12)
 g.tube([[-.78,0,.43],[-.60,0,.41],[-.42,0,.43]],
        [[.09,.045],[.19,.10],[.12,.10]],'LIGHT','muzzle_chin',ns=10)
 g.tube([[.50,0,.37],[.68,0,.32],[.78,0,.29]],[[.16,.14],[.12,.11],[.012,.025]],'TAIL','tail',ns=8)
 for side in (-1,1):
  y=side*.19
  limb(g,[[-.40,y,.46],[-.50,y*1.25,.34],[-.56,y*1.29,.16],[-.59,y*1.25,.07]],
       [[.13,.15],[.16,.16],[.137,.14],[.13,.085]],'foreleg'+str(side),9)
  foot(g,-.61,y*1.27,.01,w=.14,L=.17,tag='forepaw'+str(side))
  limb(g,[[.36,y,.42],[.47,y*1.09,.31],[.46,y*1.12,.15],[.48,y*1.05,.07]],
       [[.18,.15],[.15,.13],[.11,.12],[.1,.09]],'backleg'+str(side),8)
  foot(g,.47,y*1.06,.014,w=.11,L=.15,tag='backpaw'+str(side))
  eye(g,-.65,side*.159,.592,r=.055,tag='eye'+str(side))
  g.wedge([-.56,side*.18,.515],[-.55,side*.36,.448],.13,.022,'HORN','cheek_plate'+str(side))
  g.ellipsoid([-.75,side*.08,.57],[.020,.025,.014],'HOOF','nostril'+str(side),lat=3,lon=6)
 # overlapping actual dorsal armoured scale silhouette, backed by painted UV patches.
 for i in range(9):
  x=-.50+i*.135;z=.66+.06*S(PI*i/9);w=.13+.022*S(PI*i/9)
  for j in (-1,0,1):
   yy=j*.16
   zz=z-(abs(j)*.055)
   g.wedge([x-.068,yy,zz-.024],[x+.115,yy,zz+.018],w,.021,'PLATE',f'scutes_{i}_{j}')

def gelfaro(g):
 # Long taiga ambush predator; digitigrade hindlegs and grasping arms.
 g.tube([[-.68,0,.84],[-.42,0,.82],[-.08,0,.80],[.22,0,.76],[.46,0,.72]],
        [[.105,.15],[.19,.22],[.24,.25],[.21,.23],[.095,.14]],'BODY','lean_trunk',ns=11)
 g.tube([[-1.04,0,.94],[-.89,0,.97],[-.72,0,.91],[-.57,0,.85]],
        [[.035,.06],[.125,.145],[.13,.145],[.11,.12]],'SNOUT','head',ns=11)
 g.tube([[-1.11,0,.89],[-.98,0,.87],[-.79,0,.875]],
        [[.018,.032],[.082,.065],[.085,.07]],'LIGHT','lower_jaw',ns=9)
 g.tube([[-.85,0,.87],[-.7,0,.87],[-.55,0,.79]],
        [[.09,.13],[.16,.19],[.19,.21]],'FUR','neck_mane',ns=10)
 for side in (-1,1):
  y=side*.15
  # Sharp cheek mane and ear silhouette, not color-only geometry.
  ears(g,[-.81,side*.105,1.015],[-.72,side*.19,1.16],.095,'ear'+str(side),tile='DARK')
  eye(g,-.92,side*.105,1.01,.042,'eye'+str(side))
  # Tall thighs, knees and raised hocks capture digitigrade anatomy.
  limb(g,[[.20,y,.76],[.13,y*1.18,.53],[-.01,y*1.23,.34],[.28,y*1.22,.20],[.18,y*1.20,.077]],
       [[.18,.18],[.15,.18],[.095,.10],[.075,.075],[.065,.061]],'hindleg'+str(side),9)
  foot(g,.18,y*1.2,.02,w=.087,L=.27,tag='hindpaw'+str(side),claws=3)
  limb(g,[[-.51,y,.81],[-.55,y*1.28,.64],[-.70,y*1.35,.49],[-.82,y*1.40,.42]],
       [[.12,.12],[.12,.13],[.07,.08],[.047,.05]],'forearm'+str(side),8)
  for k in (-1,0,1):
   yy=y*1.4+k*.038
   limb(g,[[-.82,yy,.43],[-.94,yy+k*.018,.30]],[[.031,.033],[.002,.004]],'hand_claw'+str(side)+str(k),5,'HOOF')
  # Two visible teeth, functional mouth silhouette.
  limb(g,[[-1.013,side*.068,.884],[-1.016,side*.068,.825]],[[.019,.02],[.002,.002]],'fang'+str(side),5,'HORN')
 # Long counterweight tail with raised feather fan.
 g.tube([[.39,0,.74],[.64,0,.72],[.88,0,.85],[1.12,0,1.12],[1.26,0,1.39],[1.27,0,1.55]],
       [[.13,.14],[.14,.12],[.14,.12],[.12,.11],[.09,.08],[.013,.02]],'TAIL','arched_tail',ns=9)
 for i in range(7):
  x=-.53+i*.15
  g.wedge([x,0,.99],[x+.11,0,1.10+.025*S(i)],.095,.018,'RUST',f'mane_spine_{i}')
 for i in range(7):
  x=.65+i*.09
  z=.84+.055*i
  g.wedge([x,-.05,z],[x+.11,-.06,z+.17],.083,.014,'FUR',f'tail_feather_{i}')

def tufrino(g):
 # Flightless cold-adapted bird-reptile, oversized chest, high beak, no extra paint meshes.
 g.tube([[-.40,0,.66],[-.24,0,.76],[-.02,0,.75],[.24,0,.68],[.42,0,.60]],
        [[.08,.21],[.24,.29],[.32,.35],[.29,.29],[.10,.14]],'BODY','round_body',ns=12)
 g.tube([[-.52,0,1.06],[-.41,0,1.07],[-.27,0,.98],[-.23,0,.78]],
        [[.095,.10],[.16,.17],[.165,.18],[.17,.20]],'LIGHT','head_neck',ns=11)
 g.tube([[-.65,0,1.025],[-.56,0,1.055],[-.45,0,1.035]],
        [[.004,.01],[.07,.065],[.08,.08]],'HORN','beak',ns=7)
 for side in (-1,1):
  eye(g,-.49,side*.151,1.13,r=.05,tag='eye'+str(side))
  y=side*.175
  limb(g,[[.15,y,.58],[.25,y*1.15,.34],[.22,y*1.18,.11]],
       [[.11,.13],[.086,.09],[.08,.08]],'shank'+str(side),8,'LIMB')
  foot(g,.20,y*1.18,.012,w=.115,L=.22,tag='foot'+str(side),claws=3)
  # wing folded into flank, with distinct silhouette layers.
  g.tube([[-.21,side*.25,.75],[.05,side*.345,.72],[.32,side*.33,.66]],
         [[.13,.06],[.14,.08],[.026,.025]],'FEATHER','short_wing'+str(side),ns=7)
  for i in range(5):
    x=-.15+i*.085
    g.wedge([x,side*.32,.70],[x+.16,side*(.34+.025*i),.50],.085,.012,'BLUE',f'wing_feather_{side}_{i}')
 for i in range(6):
  x=-.43+i*.095
  g.wedge([x,0,1.185],[x+.090,0,1.255+.050*C(i*.95)],.11,.018,'BLUE',f'head_crest_{i}')
 for i in range(6):
  x=.27+i*.070;z=.72-.028*i
  g.wedge([x-.03,0,z],[x+.12,0,z+.036],.13,.012,'FEATHER',f'tail_plume_{i}')
 for k in range(6):
  x=-.39+k*.13
  g.wedge([x,0,.99],[x+.16,0,1.075],.13,.014,'FUR',f'back_plume_{k}')

def branquelope(g):
 # Four articulated slim legs, powerful hind haunch, elongated neck and two swept horns.
 g.tube([[-.62,0,.69],[-.40,0,.71],[-.15,0,.73],[.18,0,.73],[.42,0,.70]],
        [[.10,.10],[.18,.20],[.23,.23],[.22,.23],[.09,.13]],'BODY','trunk',ns=10)
 g.tube([[-.71,0,.96],[-.61,0,.87],[-.52,0,.77],[-.38,0,.7]],
        [[.083,.10],[.12,.14],[.13,.16],[.14,.17]],'FUR','neck',ns=9)
 g.tube([[-.98,0,1.02],[-.86,0,1.065],[-.72,0,1.045],[-.60,0,.96]],
        [[.015,.022],[.095,.10],[.14,.14],[.12,.12]],'SNOUT','skull',ns=10)
 g.tube([[-1.045,0,.99],[-.96,0,1.005],[-.84,0,1.01]],
        [[.013,.014],[.07,.062],[.076,.068]],'LIGHT','muzzle',ns=7)
 g.tube([[.39,0,.74],[.53,0,.66],[.60,0,.64]],[[.07,.07],[.068,.06],[.012,.023]],'TAIL','tail',ns=7)
 for side in (-1,1):
  y=side*.16
  eye(g,-.85,side*.124,1.109,.040,'eye'+str(side))
  ears(g,[-.75,side*.08,1.13],[-.56,side*.34,1.34],.17,'wide_ear'+str(side),tile='PINK')
  limb(g,[[-.68,side*.073,1.14],[-.60,side*.075,1.29],[-.42,side*.072,1.39],[-.30,side*.072,1.43]],
       [[.038,.039],[.030,.032],[.022,.023],[.002,.006]],'swept_horn'+str(side),6,'HORN')
  limb(g,[[-.45,y,.68],[-.45,y*1.07,.44],[-.43,y*1.12,.19],[-.46,y*1.12,.065]],
       [[.09,.10],[.062,.063],[.039,.041],[.041,.045]],'foreleg'+str(side),7,'LIMB')
  foot(g,-.45,y*1.13,.004,w=.059,L=.105,tag='forehoof'+str(side),hoof=True)
  limb(g,[[.30,y,.69],[.36,y*1.09,.45],[.23,y*1.17,.27],[.32,y*1.17,.09]],
       [[.13,.14],[.096,.095],[.047,.054],[.044,.045]],'hindleg'+str(side),8,'LIMB')
  foot(g,.30,y*1.17,.006,w=.061,L=.105,tag='hindhoof'+str(side),hoof=True)
 for i in range(8):
  x=-.64+i*.09
  g.wedge([x,0,.83],[x+.06,0,.93+.017*S(i)],.083,.01,'FUR',f'dorsal_fur_{i}')
 for side in (-1,1):
  for i in range(4):
   x=-.57+i*.076
   g.wedge([x,side*.10,.82],[x-.06,side*.10,.67],.09,.012,'LIGHT',f'chest_tuft_{side}_{i}')

def nevisco(g):
 # Hare-antelope snowy herbivore with oversized ears and short curved horns.
 g.tube([[-.58,0,.55],[-.35,0,.61],[-.06,0,.63],[.26,0,.55],[.44,0,.47]],
        [[.11,.17],[.21,.25],[.28,.29],[.25,.25],[.09,.11]],'BODY','body',ns=11)
 g.tube([[-.73,0,.72],[-.60,0,.76],[-.48,0,.70],[-.37,0,.58]],
        [[.055,.084],[.145,.145],[.16,.17],[.15,.175]],'LIGHT','head_neck',ns=10)
 g.tube([[-.85,0,.665],[-.77,0,.675],[-.65,0,.688]],
        [[.009,.02],[.065,.064],[.087,.074]],'SNOUT','rounded_snout',ns=8)
 g.tube([[.40,0,.50],[.51,0,.53],[.59,0,.58]],[[.085,.08],[.11,.12],[.01,.015]],'FUR','cotton_tail',ns=7)
 for side in (-1,1):
  y=side*.16
  eye(g,-.68,side*.135,.806,.049,'eye'+str(side))
  # Ear from side of skull to very tall tip, flattened leaf cross section.
  g.tube([[-.52,side*.105,.80],[-.50,side*.19,1.01],[-.42,side*.28,1.29],[-.35,side*.37,1.42]],
        [[.063,.039],[.10,.044],[.09,.027],[.002,.003]],'PINK','giant_ear'+str(side),ns=7)
  limb(g,[[-.54,side*.069,.93],[-.48,side*.073,1.055],[-.36,side*.072,1.12]],
       [[.036,.039],[.029,.026],[.002,.006]],'horn'+str(side),6,'HORN')
  limb(g,[[-.39,y,.59],[-.43,y*1.14,.40],[-.50,y*1.20,.19],[-.51,y*1.18,.057]],
       [[.10,.12],[.078,.086],[.052,.05],[.044,.042]],'foreleg'+str(side),8)
  foot(g,-.51,y*1.18,.001,w=.069,L=.105,tag='forehoof'+str(side),hoof=True)
  limb(g,[[.29,y,.53],[.37,y*1.2,.36],[.31,y*1.22,.19],[.36,y*1.13,.059]],
       [[.15,.17],[.13,.13],[.06,.069],[.052,.052]],'haunch'+str(side),8)
  foot(g,.36,y*1.14,.001,w=.076,L=.12,tag='hindhoof'+str(side),hoof=True)
  for k in range(4):
    x=-.43+k*.12
    g.wedge([x,side*.18,.74],[x+.06,side*.23,.86],.08,.018,'FUR',f'cheek_wisp_{side}_{k}')
 for k in range(9):
  x=-.47+k*.104
  g.wedge([x,0,.82],[x+.048,0,.91+.02*C(k)],.087,.016,'FUR',f'spine_fur_{k}')

# ---- v02 REWORK: anatomically re-sculpted forms, not extra decoration ----
# All markings live on the existing UV texture; geometry is reserved for
# changing silhouette or physical anatomy (muzzle, toes, plates, ruff, plumage).

base_atlas=atlas

def atlas(spec,dest):
    im=base_atlas(spec,dest)
    if spec not in ('casquim','tufrino','nevisco'):
        return im
    from PIL import ImageDraw
    overlay=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(overlay,'RGBA')
    seeds={'casquim':5021,'tufrino':8022,'nevisco':3091}
    rand=random.Random(seeds[spec])
    for tile in ('BODY','FUR','LIMB','TAIL','PLATE','FEATHER'):
        ox=(TILE_ID[tile]%4)*256;oy=(TILE_ID[tile]//4)*256
        qty=17 if tile=='BODY' else 13
        shades={'casquim':[(219,207,185,100),(100,81,74,69),(237,221,199,50)],
                'tufrino':[(76,85,104,86),(238,236,224,120),(123,162,183,65)],
                'nevisco':[(160,164,184,80),(247,238,224,105),(195,177,185,54)]}[spec]
        for k in range(qty):
            px=ox+rand.randint(16,240);py=oy+rand.randint(16,238)
            rx=rand.randint(10,33);ry=rand.randint(7,23)
            col=shades[rand.randrange(len(shades))]
            verts=[]
            for i in range(7):
                phi=2*PI*i/7
                jitter=rand.uniform(.84,1.14)
                verts.append((int(np.clip(px+C(phi)*rx*jitter,ox+5,ox+250)),int(np.clip(py+S(phi)*ry*jitter,oy+5,oy+250))))
            d.polygon(verts,fill=col)
    im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
    im.save(dest,optimize=True)
    return im

def anatomical_paw(g,x,y,z,tag,w=.14,length=.22,toes=4,hoof=False):
    """Compact weight-bearing forepaw, differentiated heel/palm/digits."""
    g.tube([[x+.115,y,z+.10],[x+.035,y,z+.07],[x-.08,y,z+.046],
            [x-length,y,z+.042]],
           [[w*.74,.085],[w*1.05,.071],[w*.93,.057],[w*.58,.029]],
           'LIMB',tag+'_metacarpal',ns=8)
    if hoof:
        for s in (-1,1):
            yy=y+s*w*.35
            g.tube([[x-length*.79,yy,z+.043],[x-length*1.16,yy+s*.014,z+.024]],
                [[w*.32,.035],[w*.18,.015]],'HOOF',tag+'_split'+str(s),ns=6)
    else:
        for i in range(toes):
            offset=(i-(toes-1)/2)
            yy=y+offset*w*.46
            g.tube([[x-length*.84,yy,z+.037],
                    [x-length*1.17,yy+offset*.010,z+.024]],
                    [[w*.22,.026],[w*.055,.015]],'LIMB',tag+'_digit'+str(i),ns=6)
            g.tube([[x-length*1.12,yy+offset*.009,z+.030],
                    [x-length*1.27,yy+offset*.012,z+.017]],
                    [[w*.10,.018],[.003,.004]],'HOOF',tag+'_nail'+str(i),ns=5)

def leaf_plate(g,anchor,tip,width,tag,tile='PLATE',thick=.018):
    # Shell/feather overlaps host surface, intentionally changes silhouette.
    # Entire wedge is closed and oriented, with UV colors in the same surface.
    g.wedge(anchor,tip,width,thick,tile,tag)

def casquim_v02(g):
    """Low snow-marsh forager, heavy forequarters and tucked hips.
    Scapular mound -> wide ribcage -> tapering pelvic mass forms one main loft.
    """
    g.tube([[-.60,0,.51],[-.47,0,.535],[-.33,0,.55],[-.13,0,.55],
            [.10,0,.53],[.30,0,.49],[.47,0,.44],[.60,0,.40]],
           [[.095,.16],[.18,.25],[.295,.32],[.355,.315],
            [.36,.30],[.31,.28],[.24,.21],[.11,.115]],'BODY','continuous_ribcage',ns=13)
    # Deep muscular throat and cream ventral ribcage, actual hanging volume.
    g.tube([[-.62,0,.365],[-.43,0,.335],[-.22,0,.325],[.06,0,.345],[.24,0,.37]],
           [[.08,.09],[.19,.15],[.25,.185],[.23,.16],[.07,.08]],
           'LIGHT','pale_ventral_body_volume',ns=11)
    # Broad cranial bowl, brow, paired masseter pads; low blunt plant muzzle.
    g.tube([[-.94,0,.64],[-.83,0,.66],[-.70,0,.665],[-.55,0,.62],[-.43,0,.535]],
           [[.072,.085],[.16,.16],[.205,.202],[.22,.19],[.11,.125]],'SNOUT','skull_cranial_bowl',ns=12)
    g.tube([[-1.025,0,.52],[-.89,0,.53],[-.73,0,.54],[-.60,0,.57]],
           [[.07,.045],[.145,.095],[.175,.11],[.12,.10]],'LIGHT','broad_muzzle',ns=12)
    g.tube([[-.96,0,.474],[-.83,0,.458],[-.67,0,.48]],
           [[.06,.038],[.14,.074],[.13,.06]],'FUR','lower_throat',ns=10)
    # Tail is a continuous stout, tapered appendage rather than disconnected spike.
    g.tube([[.47,0,.46],[.62,0,.46],[.76,0,.43],[.88,0,.385]],
           [[.14,.17],[.14,.15],[.095,.10],[.009,.014]],'TAIL','armored_stubby_tail',ns=9)
    for side in (-1,1):
        y=side*.25
        # Forelegs are major load-bearing digging muscles, starting deep under chest.
        g.tube([[-.40,side*.23,.54],[-.48,side*.32,.45],[-.54,side*.36,.33],
                [-.62,side*.37,.20],[-.63,side*.37,.087]],
               [[.145,.18],[.17,.185],[.18,.18],[.15,.15],[.12,.087]],
               'LIMB',f'forelimb_{side}',ns=10)
        anatomical_paw(g,-.64,side*.37,.012,f'digging_forepaw_{side}',w=.17,length=.22,toes=4)
        # Hindlegs tucked under rounded pelvis; articulate thigh -> ankle.
        g.tube([[.36,side*.23,.45],[.44,side*.29,.35],[.48,side*.33,.20],
                [.48,side*.32,.075]],
               [[.165,.16],[.155,.15],[.115,.11],[.097,.073]],
               'LIMB',f'hindlimb_{side}',ns=9)
        anatomical_paw(g,.47,side*.32,.012,f'rear_paw_{side}',w=.123,length=.16,toes=4)
        # Eyes actually meet the facial mass, brow undercuts are sculptural.
        eye(g,-.78,side*.185,.748,r=.055,tag=f'eye_{side}')
        g.tube([[-.805,side*.171,.778],[-.72,side*.199,.793]],
               [[.055,.018],[.06,.017]],'PLATE',f'eyebrow_arch_{side}',ns=8)
        g.tube([[-.76,side*.14,.56],[-.60,side*.19,.54]],
               [[.116,.082],[.124,.075]],'FUR',f'cheek_pad_{side}',ns=8)
        leaf_plate(g,[-.67,side*.16,.587],[-.45,side*.23,.535],.12,f'cheek_spur_{side}',tile='HORN')
        g.ellipsoid([-.982,side*.083,.573],[.016,.018,.014],'DARK',f'naris_{side}',lat=4,lon=7)
    # Low roof of overlapping scutes. Baselines anchored BELOW dorsal surface,
    # avoiding v01 spikes protruding above the body.
    for i in range(7):
        x=-.46+i*.161
        frac=i/6
        arch=[.780,.852,.852,.820,.785,.710,.597][i]
        for s in (-1,0,1):
            zz=arch-abs(s)*.059
            yy=s*.185
            g.ellipsoid([x+.025,yy,zz+.019],
                        [.103 if s==0 else .092,.105 if s==0 else .079,.037],
                        'PLATE',f'back_shingle_{i}_{s}',lat=3,lon=7)
    # Shoulder/hip edge scales: actual overhanging armor, not color layers.
    for side in (-1,1):
        for i in range(4):
            x=-.37+i*.22
            leaf_plate(g,[x-.065,side*.27,.65],
                       [x+.100,side*.31,.60],.119,
                       f'armor_flank_{side}_{i}',thick=.017)

def tufrino_v02(g):
    """Ground-dwelling chunky avian herbivore with real lifted breast, coupled
    neck/head, tucked wings and coherent snowshoe-like digit arrangement."""
    g.tube([[-.39,0,.69],[-.31,0,.72],[-.18,0,.72],[0,0,.69],
            [.21,0,.65],[.39,0,.605],[.51,0,.555]],
           [[.10,.20],[.245,.315],[.33,.365],[.35,.37],
            [.32,.335],[.235,.25],[.10,.15]],'BODY','continuous_round_body',ns=14)
    # Silhouette-changing ivory pectoral feather mass, not a color-only shell.
    g.tube([[-.39,0,.56],[-.25,0,.525],[-.06,0,.50],[.15,0,.50]],
           [[.065,.10],[.17,.162],[.19,.165],[.065,.09]],
           'LIGHT','dense_lower_breast_feathers',ns=12)
    # Chest feathers form a low bib that is part of the silhouette, not detached.
    g.tube([[-.57,0,.91],[-.47,0,.91],[-.35,0,.84],[-.27,0,.69]],
           [[.11,.145],[.20,.23],[.215,.25],[.18,.20]],'LIGHT','upright_chest_neck',ns=12)
    g.tube([[-.64,0,1.085],[-.545,0,1.111],[-.44,0,1.088],[-.355,0,.985]],
           [[.03,.05],[.108,.111],[.145,.15],[.10,.12]],'FUR','proud_head',ns=11)
    # Beak is blunt and downward hooked; small and readable from profile.
    g.tube([[-.77,0,1.046],[-.685,0,1.066],[-.565,0,1.064]],
           [[.004,.008],[.075,.068],[.09,.077]],'HORN','short_beak',ns=8)
    g.tube([[-.715,0,1.00],[-.615,0,1.004]],
           [[.018,.018],[.055,.031]],'LIGHT','beak_chin',ns=7)
    for side in (-1,1):
        # Short stout visible legs, broad toes that actually touch the ground.
        g.tube([[.12,side*.205,.52],[.18,side*.218,.39],[.20,side*.225,.22],
                [.18,side*.215,.086]],
               [[.12,.135],[.14,.135],[.10,.105],[.078,.076]],'LIMB',f'thick_leg_{side}',ns=9)
        anatomical_paw(g,.16,side*.215,.008,f'snowshoe_toes_{side}',w=.143,length=.255,toes=3)
        eye(g,-.55,side*.123,1.159,r=.048,tag=f'face_eye_{side}')
        # Wing roots embedded within flank; overlapping feather fan at rear edge.
        g.tube([[-.27,side*.268,.79],[-.10,side*.332,.80],[.15,side*.345,.72],
                [.39,side*.31,.64]],
               [[.116,.065],[.15,.071],[.126,.058],[.019,.018]],
               'FEATHER',f'folded_wing_{side}',ns=9)
        for i in range(5):
            x=-.22+i*.105
            leaf_plate(g,[x,side*.336,.71],[x+.105,side*.34,.58-.02*i],
                       .098,f'wing_edge_fan_{side}_{i}',tile='BLUE' if i in (1,3) else 'FEATHER',thick=.018)
        # Actual layered ruff on chest and shoulder edge, fixed to anatomy.
        for i in range(4):
            xx=-.49+i*.067
            leaf_plate(g,[xx,side*.16,.93],[xx+.09,side*.195,.77],
                       .088,f'collar_layers_{side}_{i}',tile='FUR',thick=.015)
    # Feather shingle banks along both rear flanks (surface has real thickness).
    for side in (-1,1):
        for i in range(6):
            x=-.12+i*.112
            z=.82-.040*i
            g.ellipsoid([x,side*.272,z],[.102,.050,.038],
                        'FEATHER' if i%3 else 'BLUE',
                        f'flank_feather_volume_{side}_{i}',lat=3,lon=6)
    # Single forward crest, bundled feather wedges, rooted inside scalp.
    for i in range(5):
        x=-.58+i*.065
        leaf_plate(g,[x,0,1.19],[x+.085,0,1.26+.070*S(i*.76)],
                   .089,f'crown_plume_{i}',tile='BLUE' if i in (0,3) else 'FEATHER',thick=.016)
    # Tail stump is short and fanned, not floating needle array.
    g.tube([[.41,0,.62],[.57,0,.61],[.65,0,.59]],
           [[.135,.12],[.105,.105],[.009,.015]],'TAIL','short_tail_root',ns=8)
    for i in range(5):
        y=(i-2)*.046
        leaf_plate(g,[.54,y,.64],[.76,y*1.22,.64+.055*(1-abs(i-2)/2)],
                   .080,f'fan_tail_feather_{i}',tile='FEATHER',thick=.017)
    # Low back transition, subtly irregular feather top silhouette.
    for i in range(7):
        x=-.24+i*.095
        leaf_plate(g,[x,0,.987],[x+.115,0,1.037-.025*i/6],
                   .105,f'back_feather_ruff_{i}',tile='FUR',thick=.016)

def sculpt_ear(g,side,tag):
    # Two-dimensional taper forms the same closed 3D ear surface; its pink
    # coloring is entirely the texture mapped onto it, no overlay mesh.
    g.tube([[-.565,side*.113,.823],[-.558,side*.18,.96],
            [-.525,side*.265,1.12],[-.482,side*.385,1.28],
            [-.46,side*.45,1.385]],
           [[.041,.038],[.103,.049],[.132,.042],[.094,.028],[.004,.005]],
           'PINK',tag,ns=9)

def nevisco_v02(g):
    """Snow-hare antelope, short limbs, large leaf ears and neck ruff.
    Old v01 had stiff straight forelegs, tall disconnected spikes and a black
    hollow underside; new volume is compact and grounded.
    """
    g.tube([[-.57,0,.56],[-.44,0,.58],[-.29,0,.61],[-.09,0,.615],
            [.12,0,.61],[.32,0,.56],[.47,0,.50]],
           [[.095,.14],[.19,.245],[.285,.30],[.335,.34],
            [.32,.325],[.28,.28],[.10,.15]],'BODY','short_pear_torso',ns=13)
    # Lofted breast / underside counteracts the v01 hollow wedge silhouette.
    g.tube([[-.47,0,.435],[-.30,0,.42],[-.09,0,.415],[.13,0,.44]],
           [[.09,.12],[.185,.17],[.24,.18],[.08,.11]],
           'LIGHT','white_ventral_fur_mass',ns=11)
    g.tube([[-.75,0,.76],[-.66,0,.795],[-.55,0,.785],[-.42,0,.69],[-.35,0,.585]],
           [[.064,.08],[.16,.18],[.197,.204],[.19,.205],[.12,.13]],
           'FUR','neck_and_cranium',ns=12)
    g.tube([[-.90,0,.697],[-.81,0,.705],[-.71,0,.718],[-.62,0,.73]],
           [[.010,.024],[.074,.073],[.11,.09],[.09,.082]],
           'SNOUT','small_muzzle',ns=9)
    g.tube([[-.85,0,.647],[-.71,0,.656]],
           [[.03,.022],[.105,.065]],'LIGHT','snout_chin',ns=9)
    g.tube([[.40,0,.57],[.55,0,.57],[.64,0,.60]],
           [[.105,.105],[.12,.12],[.008,.012]],'TAIL','compact_fur_tail',ns=9)
    for side in (-1,1):
        sculpt_ear(g,side,f'large_leaf_ear_{side}')
        # Recurved horns are shorter than ears; maintain visibility in profile.
        g.tube([[-.59,side*.077,.89],[-.58,side*.089,1.008],
                [-.52,side*.092,1.092],[-.42,side*.098,1.13]],
               [[.046,.043],[.041,.039],[.026,.023],[.002,.003]],
               'HORN',f'short_backward_horn_{side}',ns=7)
        eye(g,-.72,side*.164,.860,r=.050,tag=f'round_eye_{side}')
        g.tube([[-.76,side*.161,.88],[-.66,side*.194,.875]],
               [[.043,.016],[.048,.016]],'PLATE',f'eyebrow_{side}',ns=7)
        # Compact and bendable forelegs, attached to actual shoulder mass.
        g.tube([[-.39,side*.225,.60],[-.44,side*.29,.43],
                [-.47,side*.315,.23],[-.48,side*.30,.075]],
               [[.134,.145],[.12,.134],[.095,.101],[.075,.068]],
               'LIMB',f'front_leg_{side}',ns=9)
        anatomical_paw(g,-.50,side*.308,.006,f'front_snow_hoof_{side}',w=.094,length=.14,toes=2,hoof=True)
        # Heavy jumping thigh, flexed hock, then strong rear paw.
        g.tube([[.29,side*.23,.55],[.39,side*.31,.38],
                [.28,side*.34,.23],[.42,side*.315,.074]],
               [[.165,.17],[.17,.17],[.10,.113],[.083,.072]],
               'LIMB',f'hind_thigh_hock_{side}',ns=9)
        anatomical_paw(g,.41,side*.318,.008,f'hind_snow_hoof_{side}',w=.105,length=.155,toes=2,hoof=True)
        # Dense neck-fur = actual outer silhouette, not loose spikes.
        for j in range(6):
            x=-.61+j*.076
            y=side*(.16+j*.010)
            leaf_plate(g,[x-.035,y,.83-j*.02],[x+.065,y*1.14,.68-j*.018],
                       .09,f'cheek_collar_{side}_{j}',tile='FUR',thick=.014)
    for side in (-1,1):
        for i in range(3):
            g.ellipsoid([-.51+i*.12,side*(.18+i*.007),.735-.017*i],
                        [.099,.050,.067],'FUR',f'dense_cheek_volume_{side}_{i}',lat=4,lon=7)
    # Small tufts hugging the actual topline instead of airborne needles.
    for j in range(6):
        x=-.44+j*.145
        leaf_plate(g,[x-.045,0,.89],[x+.055,0,.944-.03*j/5],
                   .09,f'small_dorsal_tuft_{j}',tile='FUR',thick=.013)

# Overrides original blockout functions only for approved-to-rework species.
casquim=casquim_v02
tufrino=tufrino_v02
nevisco=nevisco_v02

BUILDERS={'casquim':casquim,'tufrino':tufrino,'nevisco':nevisco}
DISPLAY={'casquim':'Casquim','gelfaro':'Gélfaro','tufrino':'Tufrino de Gelo','branquelope':'Branquelópe','nevisco':'Nevisco'}
CATEGORY={'casquim':'herbivore','gelfaro':'carnivore','tufrino':'herbivore','branquelope':'herbivore','nevisco':'herbivore'}

def build(spec):
    path=ASSETS/spec;path.mkdir(exist_ok=True)
    art_path=path/f'{spec}_uv_v02.png';im=atlas(spec,art_path)
    b=Geometry(spec,im);BUILDERS[spec](b)
    mesh,data=b.build()
    glb=path/f'{spec}_blockout_v02.glb';glb.write_bytes(data)
    # Reimport exactly what was exported, require textured geometry and no rig.
    loaded=trimesh.load(glb,force='scene',process=False)
    tris=sum(len(m.faces) for m in loaded.geometry.values())
    vtx=sum(len(m.vertices) for m in loaded.geometry.values())
    assert tris==len(mesh.faces),f'GLB re-import triangle mismatch {spec}'
    assert tris<=3000,f'Budget exceeded: {spec} {tris}'
    assert any(hasattr(m.visual,'uv') and m.visual.uv is not None for m in loaded.geometry.values()),'Missing UVs'
    assert all(np.isfinite(m.vertices).all() for m in loaded.geometry.values()),'Invalid coordinates'
    assert b.parts and all(v>-1e-5 for _,v in b.raw_memo),'Inverted component'
    rep={'id':spec,'name':DISPLAY[spec], 'version':'v02', 'stage':'static_blockout_pending_shape_approval',
          'category':CATEGORY[spec], 'biome':'snow','file':glb.name,'texture':art_path.name,
          'file_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
          'texture_bytes':art_path.stat().st_size,'texture_sha256':hashlib.sha256(art_path.read_bytes()).hexdigest(),
          'triangles':tris,'vertex_instances':vtx,'mesh_count':len(loaded.geometry),
          'UV_texture_embedded':True,'skins':0,'animations':0,'is_real_glb':True,
          'closed_geometric_components':len(b.parts),'components_winding_oriented':True,
          'artistic_status':'concepts_approved__blockout_pending','qa_status':'structural_import_pass__visual_review_pending',
          'not_in_alpha':True,'no_pattern_only_meshes':True,
          'budget_triangles':3000,'per_part_triangles':b.part_counts}
    (path/'manifest.json').write_text(json.dumps(rep,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{spec}: triangles {tris}; meshes {len(loaded.geometry)}; {len(data):,} bytes;  UV embedded')
    return rep

if __name__=='__main__':
  args=argparse.ArgumentParser();args.add_argument('species',nargs='*',choices=sorted(BUILDERS))
  p=args.parse_args();names=p.species or list(BUILDERS)
  manifest=[build(k) for k in names]
  (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
