#!/usr/bin/env python3
"""Render actual generated Wildhaven Hunter triangles; no concept-image compositing."""
import sys, math, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_hunter_base_v1 import body_mesh,MAT,OUT,normalize,cross,sub,dot
from matplotlib import patheffects

def render(ax, geo, eye, subtitle, is_wire=False):
 eye=np.array(eye,dtype=float);eye=eye/np.linalg.norm(eye)
 # viewer pointing at origin; horizontal world axis
 right=np.cross(np.array([0,1,0]),eye);right=right/np.linalg.norm(right)
 up=np.cross(eye,right);up=up/np.linalg.norm(up)
 polys=[];cols=[];depths=[]
 light1=np.array([-.35,.6,.74]);light1/=np.linalg.norm(light1)
 for material,faces in geo.polys.items():
  col=np.array(MAT[material][0][:3]);
  for bone,tri,norm in faces:
   p=np.array(tri)
   center=np.mean(p,axis=0)
   n=np.array(norm)
   # cull backface unless wireframe; line of sight based on face normals
   if dot(n,eye)<0 and not is_wire:continue
   proj=np.stack((p@right,p@up),axis=1)
   illum=.59+.30*max(0,dot(n,light1))+.11*max(0,dot(n,eye))
   clr=np.clip(col*illum,0,1)
   polys.append(proj);cols.append(clr);depths.append(float(center@eye))
 order=np.argsort(depths)
 if is_wire:
  collection=PolyCollection([polys[i] for i in order],facecolors=[(*cols[i],.70) for i in order],edgecolors='#cfccc6',linewidths=.18)
 else:
  collection=PolyCollection([polys[i] for i in order],facecolors=[cols[i] for i in order],edgecolors='none',antialiaseds=False)
 ax.add_collection(collection)
 ax.set_facecolor('#26262b');ax.set_xlim(-.97,.97);ax.set_ylim(-.13,1.95);ax.set_aspect('equal');ax.axis('off')
 ax.text(.5,.04,subtitle,transform=ax.transAxes,color='#bab7b4',ha='center',fontsize=12)

fig=plt.figure(figsize=(15,9),dpi=140,facecolor='#1e2025')
grid=fig.add_gridspec(1,3,wspace=.02,left=.02,right=.98,bottom=.04,top=.88)
geo=body_mesh(0)
for i,(eye,caption) in enumerate([((0,.15,5),'FRENTE · LOD0'),((2,.22,4),'¾ · LOD0'),((0,.15,-5),'COSTAS · LOD0')]):
 ax=fig.add_subplot(grid[i]);render(ax,geo,eye,caption)
fig.text(.5,.948,'WILDHAVEN    /    HUNTER MASCULINO BASE',color='#f1ece5',ha='center',fontsize=20,fontweight='medium')
fig.text(.5,.905,'MALHA 3D REAL  •  T-POSE  •  1,72 M  •  18 OSSOS  •  1.616 TRIÂNGULOS',color='#bab7b4',ha='center',fontsize=11)
p=OUT/'hunter_male_base_v1_real_preview.png';fig.savefig(p,dpi=140,facecolor=fig.get_facecolor())
print(p)
