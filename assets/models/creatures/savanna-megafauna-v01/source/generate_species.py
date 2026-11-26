#!/usr/bin/env python3
"""Wildhaven | Torvardo, Raizauro, Mastélio and Garruva terrestrial.

Anatomical continuous SDF skinned torso with explicit head/crest/armor/claw geometry;
17-19 weighted rig joints and bespoke glTF clips. Source GLBs are reduced for LODs
in build_all.py. Purely assets — no world or gameplay changes.
"""
from __future__ import annotations
import argparse, json, math, hashlib, random
from pathlib import Path
import numpy as np
import trimesh
from skimage.measure import marching_cubes
import base_v02 as b

ROOT=Path(__file__).resolve().parents[1]
TAU=math.tau
SPECS={
 'torvardo':b.Spec('torvardo','Torvardo',3.6,1.76,.93,.78,1.38,.20,(.35,.185,.105),(.11,.074,.050),(.60,.43,.275),(.62,.39,.22),'bison'),
 'raizauro':b.Spec('raizauro','Raizauro',3.45,1.03,.80,.66,.88,.31,(.42,.34,.205),(.185,.18,.133),(.71,.59,.36),(.60,.34,.15),'root_reptile'),
 'mastelio':b.Spec('mastelio','Mastélio',3.45,1.71,.87,.72,1.36,.36,(.48,.29,.19),(.25,.155,.10),(.79,.63,.47),(.78,.67,.51),'proboscid'),
 'garruva':b.Spec('garruva','Garruva',3.04,1.12,.68,.56,.96,.38,(.31,.28,.235),(.13,.13,.13),(.56,.42,.31),(.46,.19,.13),'scavenger_reptile')
}

class Megafauna(b.Creature):
 def make_rig(self):
  super().make_rig()
  s=self.s;r=s.role
  if r=='bison':
   self.neckbase[:]=[s.L*.35,s.y+.14,0];self.neckend[:]=[s.L*.52,s.y+.19,0]
  elif r=='root_reptile':
   self.neckbase[:]=[s.L*.35,s.y+.05,0];self.neckend[:]=[s.L*.55,s.y+.22,0]
  elif r=='proboscid':
   self.neckbase[:]=[s.L*.35,s.y+.03,0];self.neckend[:]=[s.L*.55,s.y+.14,0]
  else:
   self.neckbase[:]=[s.L*.34,s.y+.06,0];self.neckend[:]=[s.L*.58,s.y+.28,0]
  self.bones[self.neckidx]['world']=self.neckbase.copy()
  self.bones[self.headidx]['world']=self.neckend.copy()
  self.bones[self.jawidx]['world']=self.neckend+np.array((.32,-.25,0))
  self.tailbase[:]=[-.49*s.L,s.y+.11,0];self.bones[self.tailidx]['world']=self.tailbase.copy()
  for leg in self.legs:
   x=leg['hip'][0];z=leg['hip'][2];fore=leg['front']
   if r=='bison':
    leg['hip'][:]=[x,s.leg+.20,z];leg['knee'][:]=[x+(.015 if fore else .08),s.leg*.55,z*1.02];leg['ankle'][:]=[x+.09 if fore else x-.05,.17,z*1.02]
   elif r=='proboscid':
    leg['hip'][:]=[x,s.leg+.15,z];leg['knee'][:]=[x+.08 if fore else x+.04,s.leg*.53,z*1.02];leg['ankle'][:]=[x+.095 if fore else x-.05,.17,z*1.03]
   else:
    leg['hip'][:]=[x,s.leg+.10,z*1.08];leg['knee'][:]=[x+(.19 if fore else -.10),s.leg*.60,z*1.16];leg['ankle'][:]=[x+(.29 if fore else -.13),.15,z*1.23]
   for joint,position in [('upper',leg['hip']),('lower',leg['knee']),('fetlock',leg['ankle'])]:self.bones[leg[joint]]['world']=position.copy()
  if r=='proboscid':
   start=self.neckend+np.array((.54,-.12,0));tip=start+np.array((.31,-.43,0))
   self.trunk_upper=self.bone('trunk_upper',start,self.headidx)
   self.trunk_tip=self.bone('trunk_tip',tip,self.trunk_upper)

 def make_body(self):
  s=self.s;L=s.L;r=s.role
  step=max(.029,L/111)
  xmin=-.74*L;xmax=.76*L+1.05;ymin=-.10;ymax=s.y+s.h+.78
  zmax=s.w+.53
  xa=np.arange(xmin,xmax+step,step,dtype=np.float32)
  ya=np.arange(ymin,ymax+step,step,dtype=np.float32)
  za=np.arange(-zmax,zmax+step,step,dtype=np.float32)
  X=xa[:,None,None];Y=ya[None,:,None];Z=za[None,None,:]
  sdf=None
  def ell(p,rr,k=.22):
   nonlocal sdf
   sdf=self.smooth(sdf,self.sd_ellipsoid(X,Y,Z,np.asarray(p),np.asarray(rr)),k)
  def seg(p,q,rad1,rad2,k=.13):
   nonlocal sdf
   sdf=self.smooth(sdf,self.sd_segment(X,Y,Z,np.asarray(p),np.asarray(q),rad1,rad2),k)
  # One connected skin; anatomically distinct mass distribution per taxon.
  if r=='bison':
   ell((-.06*L,s.y,0),(.45*L,s.h*.92,s.w*.93),.31)
   ell((.25*L,s.y+.20,0),(.285*L,s.h*1.18,s.w*1.06),.30)
   ell((-.39*L,s.y-.035,0),(.26*L,s.h*.85,s.w*.85),.23)
   ell((.34*L,s.y-.15,0),(.23*L,s.h*.92,s.w*.96),.24)
   # High wither mass silhouette, not an arbitrary floating hump.
   ell((.22*L,s.y+.51,0),(.24*L,.48,s.w*.76),.20)
  elif r=='root_reptile':
   ell((-.06*L,s.y-.02,0),(.49*L,s.h,s.w),.30)
   ell((.26*L,s.y-.05,0),(.29*L,s.h*.92,s.w*.91),.23)
   ell((-.37*L,s.y-.09,0),(.25*L,s.h*.91,s.w*.90),.20)
   ell((.31*L,s.y-.21,0),(.29*L,s.h*.69,s.w*.82),.18)
  elif r=='proboscid':
   ell((-.08*L,s.y,0),(.47*L,s.h*.98,s.w),.32)
   ell((-.34*L,s.y+.08,0),(.26*L,s.h*.94,s.w*.91),.26)
   ell((.26*L,s.y+.05,0),(.31*L,s.h*1.09,s.w*.97),.31)
   ell((.26*L,s.y-.22,0),(.26*L,s.h*.72,s.w*.83),.24)
  else:
   ell((-.10*L,s.y,0),(.45*L,s.h*.96,s.w*.94),.25)
   ell((.25*L,s.y+.03,0),(.28*L,s.h*1.03,s.w*.98),.24)
   ell((-.37*L,s.y-.02,0),(.28*L,s.h*.88,s.w*.88),.22)
   ell((.28*L,s.y-.16,0),(.22*L,s.h*.70,s.w*.75),.18)
  # Hip/scapula tendons and muscular volume join the torso, not pasted cylinders.
  for leg in self.legs:
   hip=leg['hip'];knee=leg['knee'];ankle=leg['ankle'];fore=leg['front']
   mag=(.41 if r in ('bison','proboscid') else .31 if r=='root_reptile' else .245)
   ell(hip+np.array((0,.09,0)),(mag*1.17,mag*1.43,mag*.99),.23)
   seg(hip,knee,mag,mag*.61,.20)
   ell(knee,(mag*.71,mag*.76,mag*.70),.11)
   seg(knee,ankle,mag*.59,mag*.45,.10)
   ell(ankle+np.array((.07,-.035,0)),(mag*.82,.10,mag*.70),.08)
  neck0=self.neckbase;head=self.neckend
  if r=='bison':
   seg(neck0+[-.30,.02,0],head+[-.08,-.13,0],.59,.43,.25)
   ell(neck0+[-.11,.12,0],(.59,.50,.56),.22)
   ell(head+[-.04,-.11,0],(.49,.34,.42),.22)
   seg(head+[.16,-.15,0],head+[.53,-.30,0],.29,.23,.12)
   ell(head+[.54,-.28,0],(.24,.19,.29),.14)
  elif r=='root_reptile':
   seg(neck0+[-.28,-.03,0],head+[-.08,-.09,0],.45,.30,.21)
   ell(head+[.02,0,0],(.39,.26,.34),.14)
   seg(head+[.19,-.085,0],head+[.75,-.15,0],.25,.16,.085)
   ell(head+[.73,-.16,0],(.21,.14,.22),.08)
   ell(head+[.35,-.22,0],(.33,.095,.235),.10)
  elif r=='proboscid':
   seg(neck0+[-.16,-.12,0],head+[-.10,-.17,0],.50,.36,.22)
   ell(head+[.05,-.05,0],(.50,.43,.43),.19)
   ell(head+[.32,-.13,0],(.30,.29,.31),.17)
   seg(head+[.37,-.20,0],head+[.66,-.30,0],.24,.22,.12)
  else:
   seg(neck0+[-.20,-.13,0],head+[-.12,-.08,0],.36,.25,.18)
   ell(head+[.08,.01,0],(.39,.29,.30),.16)
   seg(head+[.25,-.075,0],head+[.87,-.16,0],.23,.14,.095)
   ell(head+[.81,-.16,0],(.21,.14,.19),.07)
   ell(head+[.45,-.23,0],(.41,.115,.23),.10)
  # Actual SDF extraction: one connected organic body / appendages / cranial surface.
  verts,faces,normals,_=marching_cubes(sdf,0,spacing=(step,step,step),allow_degenerate=False)
  verts+=np.array((xa[0],ya[0],za[0]),np.float32)
  f=faces.astype(np.uint32);verts=verts.astype(np.float32)
  self.skin_data={'vertices':verts,'faces':f,'normals':np.asarray(normals,np.float32),
                  'colors':self.vertex_colors(verts),'joints':None,'weights':None}
  j,w=self.compute_skin(verts);self.skin_data['joints']=j;self.skin_data['weights']=w

 def vertex_colors(self,V):
  s=self.s;r=s.role;x,y,z=V[:,0],V[:,1],V[:,2]
  base=np.asarray(s.base,np.float32);dark=np.asarray(s.dark,np.float32);pale=np.asarray(s.cream,np.float32)
  col=np.tile(base,(len(V),1))
  shade=np.clip((s.y-.20-y)/(.75*s.h),0,1)*.40
  col=col*(1-shade[:,None])+pale*shade[:,None]
  noise=np.sin(x*11.5+z*16.5)*np.cos(y*13.3+x*9)
  col*=1+.055*noise[:,None]
  if r=='bison':
   chest=np.exp(-((x-.25*s.L)/(.36*s.L))**4)*np.clip((y-s.y)/.80+.25,0,1)
   col=col*(1-chest[:,None]*.35)+dark*chest[:,None]*.35
   # Rough cream lines in flanks: skin pigmentation not fake overlapping meshes.
   patch=np.clip(np.sin(x*3.6+y*1.9+1.2*np.sin(y*3.7+np.sign(z)))-.31,0,1)
   flank=np.exp(-((x+.19*s.L)/(.36*s.L))**4)*np.clip((np.abs(z)-.37)/.25,0,1)
   col=col*(1-(patch*flank*.34)[:,None])+np.asarray(s.pattern)*(patch*flank*.34)[:,None]
  elif r=='root_reptile':
   cells=(np.sin(x*28+3*np.sin(z*12))*np.cos(y*25+7*z))
   sc=np.clip((cells-.15)*1.1,0,1)*np.clip((y-s.y+.2)/.75,0,1)
   col=col*(1-sc[:,None]*.54)+dark*sc[:,None]*.54
   blotch=np.clip(np.sin(x*5.4+z*7.2+y*2.4)-.23,0,1)*.24
   col=col*(1-blotch[:,None])+np.array([.63,.31,.16])*blotch[:,None]
  elif r=='proboscid':
   mark=np.sin(x*6.5+y*2.5+1.1*np.sin(z*7)) * np.cos(y*5.3+z*4.9)
   mask=np.clip((mark-.12)*1.9,0,1)*np.clip((np.abs(z)-.25)/.30,0,1)*.68
   col=col*(1-mask[:,None])+pale*mask[:,None]
   forehead=np.clip((x-self.neckend[0]+.2)/.75,0,1)*np.clip((y-self.neckend[1]+.2)/.50,0,1)
   col=col*(1-forehead[:,None]*.16)+dark*forehead[:,None]*.16
  else:
   rust=np.clip(np.sin(x*6.2+y*8+3*z)-.10,0,1)*.52
   neckzone=np.exp(-((x-self.neckend[0]+.1)/1.0)**2)
   col=col*(1-(rust*neckzone)[:,None])+np.array([.58,.22,.13])*(rust*neckzone)[:,None]
   scales=np.clip(np.sin(x*36+z*25)*np.cos(y*31-x*12),0,1)*.19
   col=col*(1-scales[:,None])+dark*scales[:,None]
   headzone=np.clip((x-.38*s.L)/(.85*s.L),0,1)
   col=col*(1-headzone[:,None]*.25)+dark*headzone[:,None]*.25
  return np.rint(np.clip(col,0,1)*255).astype(np.uint8)

 def compute_skin(self,V):
  # Preserve 4 weighted influences and accurate 17+ joint hierarchy from approved pipeline.
  result=super().compute_skin(V)
  return result

 def solid(self,name,point,radii,color,parent,detail=12):
  v,f=self.ellmesh(np.asarray(point,float),radii,nu=detail,nv=max(6,detail//2))
  self.add_part(name,v,f,color,parent)
 def ribbon(self,name,points,radii,color,parent,sides=9):
  v,f=self.tube(points,radii,ns=sides)
  self.add_part(name,v,f,color,parent)
 def triangular_plate(self,name,xyz,length,width,rise,col,parent):
  x,y,z=xyz
  # A flattened shield/scute embedded in the hide, organic staggered shape.
  self.ribbon(name,[[x-length*.55,y-.04,z],[x-length*.20,y+rise*.80,z],
                    [x+length*.20,y+rise,z],[x+length*.55,y+.015,z]],
              [width*.46,width*.55,width*.39,.003],col,parent,7)
 def batch_parts(self):
  # Convert hundreds of minute scales/tufts to fewer draw calls, grouped by joint and colour.
  groups={}
  for name,v,f,color,parent in self.parts:
   key=(parent,tuple(np.round(color,4)))
   groups.setdefault(key,[]).append((name,v,f,color,parent))
  compact=[]
  for (par,color),items in groups.items():
   vv=[];ff=[];n=0
   for name,v,f,co,p in items:
    vv.append(v);ff.append(f+n);n+=len(v)
   compact.append((items[0][0]+'__group',np.concatenate(vv).astype(np.float32),np.concatenate(ff).astype(np.uint32),np.asarray(color,dtype=np.float32),par))
  self.parts=compact

 def add_details(self):
  s=self.s;r=s.role;H=self.neckend;L=s.L
  rng=np.random.default_rng(20261108+sum(map(ord,s.id)))
  # Eyes with eyelids, iris and tiny corneal highlight.
  for sign in (-1,1):
   if r=='bison': E=H+np.array((.17,.045,sign*.33))
   elif r=='proboscid': E=H+np.array((.24,.16,sign*.34))
   elif r=='root_reptile': E=H+np.array((.24,.115,sign*.29))
   else: E=H+np.array((.34,.12,sign*.245))
   self.solid('orbital_ridge',E,(.094,.066,.026),s.dark,self.headidx)
   self.solid('eye',E+[.012,.004,sign*.022],(.059,.041,.022),(.075,.058,.04),self.headidx)
   self.solid('iris',E+[.030,.005,sign*.040],(.028,.026,.011),(.72,.47,.20),self.headidx,12)
   self.solid('pupil',E+[.036,.004,sign*.048],(.014,.021,.008),(.05,.045,.035),self.headidx,10)
   self.solid('glint',E+[.036,.016,sign*.056],(.009,.009,.005),(.96,.91,.76),self.headidx,9)
   self.ribbon('upper_eyelid',[E+[-.085,.003,sign*.02],E+[0,.066,sign*.02],E+[.095,.008,sign*.01]],
     [.020,.023,.006],s.base,self.headidx,8)
   nose=H+np.array((.55 if r=='bison' else .76 if r=='root_reptile' else .57 if r=='proboscid' else .88,-.25 if r=='bison' else -.16,sign*(.24 if r=='bison' else .18)))
   self.solid('nostril',nose,(.057,.032,.019),(.09,.075,.063),self.headidx)
   if r=='bison':
    # Forehead shield bounded by a true ceramic-like keratin ridge.
    self.solid('keratin_forehead',H+[-.06,.31,0],(.48,.21,.47),(.52,.40,.27),self.headidx,18)
    horn_root=H+[-.02,.30,sign*.38]
    points=[horn_root,horn_root+[.11,.15,sign*.22],horn_root+[.03,.44,sign*.43],horn_root+[-.22,.68,sign*.50],horn_root+[-.34,.78,sign*.53]]
    self.ribbon('curved_side_horn',points,[.165,.148,.109,.054,.002],(.33,.29,.235),self.headidx,14)
    self.solid('ear',H+[-.25,.11,sign*.41],(.20,.11,.115),(.30,.185,.13),self.headidx)
   elif r=='proboscid':
    root=H+[-.20,.21,sign*.41]
    self.solid('outer_ear',root, (.17,.30,.23),(.49,.32,.21),self.headidx,15)
    self.solid('inner_ear',root+[.04,-.02,sign*.10],(.11,.235,.14),(.36,.18,.12),self.headidx,13)
    self.ribbon('temple_fur',[H+[-.23,.34,sign*.1],H+[-.30,.44,sign*.09],H+[-.39,.53,sign*.08]],[.07,.052,.002],s.dark,self.headidx)
   elif r=='root_reptile':
    self.solid('ear_opening',H+[-.12,.035,sign*.33],(.060,.058,.011),(.13,.12,.09),self.headidx)
    for j in range(3):
     x=H[0]+.27+j*.13
     self.solid('beak_keratin_ridge',[x,H[1]-.105,sign*(.24-j*.02)],(.10,.043,.04),(.51,.43,.30),self.headidx,11)
   else:
    self.solid('ear_slit',H+[-.17,.075,sign*.27],(.073,.052,.012),(.13,.10,.08),self.headidx)
    # Subtle skin folds round jaw and raised nostril pads, scavenger identity.
    self.ribbon('jawline',[H+[.22,-.25,sign*.25],H+[.52,-.29,sign*.19],H+[.82,-.23,sign*.14]],
      [.027,.021,.006],s.dark,self.headidx)
  if r=='bison':
   # Thick wavy back and shoulder mane, no porcupine spikes.
   for row in range(4):
    for j in range(37):
     t=(j+.20*rng.random())/37
     x=(.045+.40*t)*L
     y=s.y+s.h*(.58+.50*math.sin((t*.83+.15)*math.pi))+.22
     z=(row-1.5)*.155
     length=.22+.16*(.5+.5*math.sin(t*math.pi))*rng.uniform(.8,1.15)
     self.ribbon('mane_layer',[[x,y,z],[x-.11,y-length*.25,z*.96],
                  [x-.20,y-length*.75,z*1.02],[x-.27,y-length,z*1.04]],
           [.09,.071,.036,.003],s.dark if row%2 else (.19,.11,.075),self.root,7)
   # Side curtain of thick mane around trapezius/shoulder; coat is layered 3D geometry.
   for side in (-1,1):
    for level in range(4):
     for j in range(20):
      t=(j+.35*(level%2))/20
      x=(.09+.31*t)*L
      y=s.y+.43-level*.22+.05*math.sin(t*math.pi)
      z=side*(s.w*(.80-.035*level))
      self.ribbon('side_shoulder_mane',[[x,y,z],[x-.07,y-.11,z+sign*.012] if False else [x-.07,y-.11,z+side*.014],
        [x-.14,y-.24,z+side*.022]], [.077,.060,.003],
        s.dark if level%2==0 else (.20,.12,.078),self.root,7)
   for j in range(24):
    x=-.1+j/23*.93
    self.ribbon('sternum_hair',[[x,1.42,.54],[x-.09,1.26,.60],[x-.12,1.11,.61]],
                [.078,.059,.002],s.dark,self.root,7)
   for leg in self.legs:
    for side in (-1,1):
     a=leg['ankle']
     self.solid('two_keratin_hooves',a+[.12,-.076,side*.115],(.21,.11,.135),(.21,.175,.12),leg['fetlock'])
   self.ribbon('short_tail',[self.tailbase,self.tailbase+[-.21,-.19,0],self.tailbase+[-.38,-.43,0]],
         [.105,.07,.025],s.base,self.tailidx,9)
   for k in range(8):
    x=self.tailbase[0]-.38
    self.ribbon('tail_brush',[[x,self.tailbase[1]-.43,(k-3.5)*.025],
      [x-.12,self.tailbase[1]-.60,(k-3.5)*.02]], [.05,.002],s.dark,self.tailidx,6)
  elif r in ('root_reptile','scavenger_reptile'):
   tail0=self.tailbase
   bends=[[tail0[0],tail0[1],0],[tail0[0]-.46,tail0[1]-.05,0],[tail0[0]-.91,tail0[1]-.20,0],[tail0[0]-1.52,tail0[1]-.40,0]]
   self.ribbon('muscular_lizard_tail',bends,[.34 if r=='root_reptile' else .26,.25,.13,.003],s.base,self.tailidx,15)
   # Two kinds of organic scales: Raizauro heavy bony carapace, Garruva lighter tough ridge.
   rows=4 if r=='root_reptile' else 2
   for row in range(rows):
    for j in range(24 if r=='root_reptile' else 18):
     t=(j+.4*(row%2))/ (24 if r=='root_reptile' else 18)
     x=(-.45+.84*t)*L
     z=(row-(rows-1)/2)*(.31 if r=='root_reptile' else .33)
     yy=s.y+s.h*math.sqrt(max(.13,1-(z/s.w)**2))*.97
     self.triangular_plate('overlapping_keratin_scute',[x,yy,z],.36 if r=='root_reptile' else .20,
       .20 if r=='root_reptile' else .125,.12 if r=='root_reptile' else .07,
       (.37,.27,.17) if r=='root_reptile' else (.24,.235,.19),self.root)
   for side in (-1,1):
    for j in range(7):
     x=tail0[0]-.18-j*.18;y=tail0[1]-.04-j*.056
     self.triangular_plate('tail_scute',[x,y,side*.10],.24,.09,.06,s.dark,self.tailidx)
   for leg in self.legs:
    for toe in range(4):
     ankle=leg['ankle']; z=ankle[2]+(toe-1.5)*(.098 if r=='root_reptile' else .078)
     lead=.32 if leg['front'] and r=='root_reptile' else .19
     self.ribbon('curved_digging_claw',[[ankle[0]+.07,ankle[1]-.06,z],
       [ankle[0]+lead*.72,ankle[1]-.12,z*1.01],[ankle[0]+lead,ankle[1]-.16,z*1.01]],
       [.055,.034,.001],(.30,.25,.18),leg['fetlock'],9)
   if r=='root_reptile':
    # Distinct hooked herbivore beak, no predatory pointed teeth.
    self.ribbon('keratin_beak_tip',[H+[.63,-.11,0],H+[.88,-.13,0],H+[.92,-.30,0]],
      [.185,.13,.004],(.48,.40,.30),self.headidx,12)
    for i in range(6):
     self.ribbon('shoulder_scutum',[self.neckbase+[-.15+i*.06,.32,0],
       self.neckbase+[-.22+i*.06,.46,0],self.neckbase+[-.29+i*.06,.48,0]],
       [.11,.075,.002],(.34,.26,.18),self.root,7)
   else:
    # Hooked teeth, jaw hinges and leathery reddened nape: exclusively necrófago.
    for side in (-1,1):
     for j in range(9):
      x=H[0]+.24+j*.071
      self.ribbon('interlocking_teeth',[[x,H[1]-.24,side*.17],
        [x+.015,H[1]-.285,side*.18],[x+.025,H[1]-.34,side*.17]],
        [.026,.019,.002],(.83,.73,.58),self.jawidx,7)
     self.solid('masseter',H+[.18,-.19,side*.29],(.22,.13,.11),(.32,.24,.18),self.headidx,12)
    for j in range(27):
     t=j/27;pos=self.neckbase+(self.neckend-self.neckbase)*t
     self.ribbon('red_nape_crest',[pos+[-.08,.16,0],pos+[-.12,.24,0],pos+[-.20,.31,0]],
       [.07,.051,.001],(.40,.155,.095),self.neckidx,7)
  else: # Mastélio — distinguish using drooping flexible trunk and asymmetric cream patches.
   base=H+np.array((.54,-.13,0))
   self.ribbon('prehensile_trunk_top',[base,base+[.19,-.13,0],base+[.27,-.36,0]],
     [.235,.20,.15],s.base,self.trunk_upper,17)
   self.ribbon('prehensile_trunk_tip',[base+[.27,-.36,0],base+[.33,-.60,0],base+[.50,-.71,0],base+[.62,-.52,0]],
     [.153,.125,.077,.008],s.base,self.trunk_tip,14)
   for j in range(9):
    x=base[0]+j*.040;y=base[1]-.08-j*.055
    self.ribbon('trunk_fold',[[x,y,.16],[x+.045,y-.045,.18]], [.013,.003],s.dark,self.trunk_upper,7)
   self.solid('trunk_nostril',base+[.64,-.50,0],(.031,.034,.043),(.25,.17,.13),self.trunk_tip,12)
   for leg in self.legs:
    ankle=leg['ankle']
    for toe in range(4):
     z=ankle[2]+(toe-1.5)*.105
     self.solid('rounded_foot_nail',ankle+[.16,-.08,z-ankle[2]],(.10,.052,.059),(.31,.26,.21),leg['fetlock'],9)
   self.ribbon('slender_tail',[self.tailbase,self.tailbase+[-.33,-.15,0],self.tailbase+[-.59,-.40,0]],
     [.13,.085,.014],s.base,self.tailidx,8)
  self.batch_parts()

 def clips(self):
  result=[];s=self.s;r=s.role
  durations={'idle':3.4,'walk':1.7,'trot':1.0,'charge':.90,'graze':3.7,
    'stomp':1.4,'headbutt':1.3,'alert':2.5,'threat':2.2,'rest':3.5,'death':2.5,'drink':3.4,
    'crawl':2.5,'dig':2.6,'root_pull':2.8,'chew':2.3,'bask':4.2,'tail_sweep':1.5,
    'forage':3.1,'pluck_fruit':2.8,'curl_trunk':2.7,'defend':1.7,'prowl':1.9,'run':.95,
    'sniff':2.3,'carcass_feed':3.1,'tear_flesh':2.1,'jaw_snap':.9}
  for name in b.CLIPS[s.id]:
   duration=durations[name];times=np.linspace(0,duration,25,dtype=np.float32)
   channels={}
   for joint,info in enumerate(self.bones):
    bn=info['name'];rots=[];trans=[]
    for t in times:
     u=float(t/duration);angle=TAU*u;pitch=0.
     move=name in ('walk','trot','charge','crawl','prowl','run')
     amplitude={'walk':.19,'trot':.32,'charge':.45,'crawl':.12,'prowl':.17,'run':.48}.get(name,0)
     if bn=='root':
      if name=='death':pitch=-.65*(.5-.5*math.cos(math.pi*u))
      y=-.28*(.5-.5*math.cos(math.pi*u)) if name=='death' else (.022*math.sin(angle*2) if move else .009*math.sin(angle))
      trans.append([0.,y,0.])
     elif bn.endswith('_upper') and bn not in ('trunk_upper',):
      side=bn.endswith('_L');hind=bn.startswith('hind');phase=.5 if hind^side else 0
      if move:pitch=amplitude*math.sin(angle+TAU*phase)
      elif name in ('rest','death'):pitch=.35*(.5-.5*math.cos(math.pi*u))
      elif name=='stomp' and not hind:pitch=-.38*math.sin(math.pi*u)
      elif name=='dig' and not hind:pitch=.54*math.sin(angle*2+TAU*phase)
     elif bn.endswith('_lower'):
      side=bn.endswith('_L');hind=bn.startswith('hind');phase=.5 if hind^side else 0
      if move:pitch=.14+.25*max(0,math.sin(angle+TAU*phase))
      elif name in ('rest','death'):pitch=-.35*(.5-.5*math.cos(math.pi*u))
      elif name=='dig' and not hind:pitch=-.30*math.sin(angle*2+TAU*phase)
     elif bn.endswith('_fetlock'):
      if move:pitch=-.10*math.sin(angle)
     elif bn=='neck':
      if name in ('graze','forage','carcass_feed','drink'):pitch=-.25*(.5-.5*math.cos(math.pi*min(1,u*2)))
      elif name=='root_pull':pitch=-.18*math.sin(math.pi*u)
      elif name in ('headbutt','threat','defend','tear_flesh'):pitch=-.35*math.sin(math.pi*u)
      elif name=='alert':pitch=.13*math.sin(angle*.5)
     elif bn=='head':
      if name in ('graze','forage','carcass_feed'):pitch=-.19
      elif name in ('root_pull','tear_flesh','headbutt','jaw_snap'):pitch=-.25*math.sin(math.pi*u)
      elif name in ('alert','sniff'):pitch=.10*math.sin(angle)
     elif bn=='jaw':
      if name in ('chew','graze','forage','pluck_fruit','carcass_feed'):pitch=.11*(.5+.5*math.sin(angle*3))
      elif name=='tear_flesh':pitch=.19*math.sin(angle*2)
      elif name=='jaw_snap':pitch=.42*math.sin(math.pi*u)**2
     elif bn=='tail':
      pitch=.13*math.sin(angle-.2)
      if name=='tail_sweep':pitch=.40*math.sin(math.pi*u)
     elif bn=='trunk_upper':
      if name in ('pluck_fruit','curl_trunk','forage','drink'):pitch=.38*math.sin(angle)
     elif bn=='trunk_tip':
      if name in ('pluck_fruit','curl_trunk','forage','drink'):pitch=-.52*math.sin(angle+.4)
     rots.append([0.,0.,math.sin(pitch*.5),math.cos(pitch*.5)])
    channels[joint]=np.asarray(rots,dtype=np.float32)
    if trans:channels[str(joint)+'_translation']=np.asarray(trans,dtype=np.float32)
   result.append((name,times,channels))
  return result

 def glb(self,path):
  return super().glb(path)


def generate(id,out):
 s=SPECS[id];print('BUILD SOURCE',id,flush=True)
 model=Megafauna(s);out=Path(out);out.mkdir(parents=True,exist_ok=True)
 path=out/f'{id}-sculpted-source-v01.glb'
 info=model.glb(path)
 assert info['animationCount']==len(b.CLIPS[id])
 assert info['skinJoints']>=17
 print('SOURCE',id,info['triangles'],'triangles',info['skinJoints'],'joints',info['animationCount'],'clips',flush=True)
 return path,info

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--only',choices=list(SPECS));ap.add_argument('--out',type=Path,default=ROOT/'sources');args=ap.parse_args()
 for sid in ([args.only] if args.only else SPECS):generate(sid,args.out/sid)