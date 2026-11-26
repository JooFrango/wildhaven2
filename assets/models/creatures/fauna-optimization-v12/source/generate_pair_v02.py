#!/usr/bin/env python3
"""Wildhaven — Cervalume + Lobrapedra v02.\nWorkflow trigger registered.
Official creature guide compliance:
- defined low/mid-poly planes
- silhouette-first construction
- no ball/capsule/tube-glued body language
- face normals / selective hard planes
- species-specific quadruped animation
Y-up, metres, animals face -Z.
"""
from __future__ import annotations
import importlib.util, json, math, struct, hashlib
from pathlib import Path
from collections import defaultdict
import numpy as np

ROOT=Path(__file__).resolve().parents[5]
OLD_PATH=ROOT/"assets/models/creatures/fauna-optimization-v11/source/generate_pair.py"
sp=importlib.util.spec_from_file_location("oldfauna",OLD_PATH)
old=importlib.util.module_from_spec(sp); sp.loader.exec_module(old)
V=old.V
rx,ry,rz=old.rx,old.ry,old.rz

OUT_C=ROOT/"assets/models/creatures/cervalume/v02"
OUT_L=ROOT/"assets/models/creatures/lobrapedra/v02"
OUT_C.mkdir(parents=True,exist_ok=True); OUT_L.mkdir(parents=True,exist_ok=True)

class Creature(old.Creature):
    def prism_path(self,bone,mat,points,radii,sides=8,flatten=1.0):
        ps=[V(*p) for p in points]; verts=[]; faces=[]
        for k,p in enumerate(ps):
            tang=ps[min(k+1,len(ps)-1)]-ps[max(k-1,0)]
            tang/=max(1e-9,np.linalg.norm(tang))
            u=np.cross(tang,V(1,0,0))
            if np.linalg.norm(u)<.08:u=np.cross(tang,V(0,0,1))
            u/=max(1e-9,np.linalg.norm(u)); w=np.cross(tang,u)
            for j in range(sides):
                a=2*math.pi*j/sides
                verts.append(p+radii[k]*(u*math.cos(a)*flatten+w*math.sin(a)))
        for k in range(len(ps)-1):
            for j in range(sides):
                a=k*sides+j;b=k*sides+(j+1)%sides;c=(k+1)*sides+j;d=(k+1)*sides+(j+1)%sides
                faces.extend([(a,c,b),(b,c,d)])
        # caps
        c0=len(verts); verts.append(ps[0]); c1=len(verts); verts.append(ps[-1])
        for j in range(sides):
            faces.append((c0,j,(j+1)%sides))
            a=(len(ps)-1)*sides+j; b=(len(ps)-1)*sides+(j+1)%sides
            faces.append((c1,b,a))
        self.add(bone,mat,verts,faces)

    def loft_z_faceted(self,bone,mat,rings,sides=14):
        verts=[];faces=[]
        for z,rx0,ry0,cy,cx in rings:
            for k in range(sides):
                a=2*math.pi*k/sides
                verts.append((cx+rx0*math.cos(a),cy+ry0*math.sin(a),z))
        for r in range(len(rings)-1):
            for k in range(sides):
                a=r*sides+k;b=r*sides+(k+1)%sides;c=(r+1)*sides+k;d=(r+1)*sides+(k+1)%sides
                faces.extend([(a,c,b),(b,c,d)])
        self.add(bone,mat,verts,faces)

    def loft_y_faceted(self,bone,mat,rings,sides=10):
        verts=[];faces=[]
        for y,rx0,rz0,cz,cx in rings:
            for k in range(sides):
                a=2*math.pi*k/sides
                verts.append((cx+rx0*math.cos(a),y,cz+rz0*math.sin(a)))
        for r in range(len(rings)-1):
            for k in range(sides):
                a=r*sides+k;b=r*sides+(k+1)%sides;c=(r+1)*sides+k;d=(r+1)*sides+(k+1)%sides
                faces.extend([(a,b,c),(b,d,c)])
        self.add(bone,mat,verts,faces)

    def head_loft(self,bone,mat,rings,sides=12):
        self.loft_z_faceted(bone,mat,rings,sides)

    def wedge_box(self,bone,mat,center,size,front_scale=.72,top_slope=0.0):
        cx,cy,cz=center; sx,sy,sz=size
        # back z+, front z-, intentionally planar
        xb=sx/2; yb=sy/2; xf=xb*front_scale; yf=yb*front_scale
        verts=[
          (cx-xb,cy-yb,cz+sz/2),(cx+xb,cy-yb,cz+sz/2),(cx+xb,cy+yb,cz+sz/2),(cx-xb,cy+yb,cz+sz/2),
          (cx-xf,cy-yf,cz-sz/2),(cx+xf,cy-yf,cz-sz/2),(cx+xf,cy+yf+top_slope,cz-sz/2),(cx-xf,cy+yf+top_slope,cz-sz/2)
        ]
        faces=[(0,1,2),(0,2,3),(4,6,5),(4,7,6),(0,4,5),(0,5,1),(1,5,6),(1,6,2),(2,6,7),(2,7,3),(3,7,4),(3,4,0)]
        self.add(bone,mat,verts,faces)

    def ear_prism(self,bone,mat,side=1,scale=1.0):
        s=side
        verts=[
          (0,0,0),(s*.085*scale,.02,0),(s*.045*scale,.25*scale,-.02),
          (0,0,.045*scale),(s*.085*scale,.02,.045*scale),(s*.045*scale,.25*scale,.02)
        ]
        faces=[(0,1,2),(3,5,4),(0,3,4),(0,4,1),(1,4,5),(1,5,2),(2,5,3),(2,3,0)]
        self.add(bone,mat,verts,faces)

    def hoof_pair(self,bone,mat,y=-.04,z=-.08,scale=1.0):
        for x in (-.043,.043):
            self.wedge_box(bone,mat,(x,y,z),(.075*scale,.07*scale,.18*scale),front_scale=.58,top_slope=-.005)

    def eye_disc(self,bone,mat,side,z=-.11,y=.055):
        # small faceted lens; not a glued sphere
        x=side*.158
        verts=[(x,y+.024,z),(x,y-.024,z),(x,y,z-.030),(x,y,z+.030),(x+side*.014,y,z)]
        faces=[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(0,3,2),(2,3,1)]
        self.add(bone,mat,verts,faces)

def make_cervalume():
    bones=[
      ('Root',None,(0,0,0)),('Body','Root',(0,1.18,0)),('Spine','Body',(0,.04,.12)),
      ('Neck','Body',(0,.12,-.72)),('Head','Neck',(0,.28,-.50)),('Jaw','Head',(0,-.10,-.21)),
      ('Ear_L','Head',(-.145,.15,-.02)),('Ear_R','Head',(.145,.15,-.02)),
      ('Tail_Base','Body',(0,.03,.79)),('Antler_L','Head',(-.10,.22,-.06)),('Antler_R','Head',(.10,.22,-.06)),
      ('ForeUpper_L','Body',(-.29,-.11,-.48)),('ForeLower_L','ForeUpper_L',(0,-.40,.04)),('ForePaw_L','ForeLower_L',(0,-.39,-.08)),
      ('ForeUpper_R','Body',(.29,-.11,-.48)),('ForeLower_R','ForeUpper_R',(0,-.40,.04)),('ForePaw_R','ForeLower_R',(0,-.39,-.08)),
      ('HindUpper_L','Body',(-.30,-.09,.49)),('HindLower_L','HindUpper_L',(0,-.39,.11)),('HindPaw_L','HindLower_L',(0,-.39,-.10)),
      ('HindUpper_R','Body',(.30,-.09,.49)),('HindLower_R','HindUpper_R',(0,-.39,.11)),('HindPaw_R','HindLower_R',(0,-.39,-.10))
    ]
    colors={
      'coat':(.43,.31,.22),'coat_dark':(.34,.24,.17),'chest':(.38,.27,.19),'belly':(.62,.52,.39),
      'muzzle':(.52,.43,.33),'nose':(.065,.052,.044),'eye':(.30,.18,.07),'ear':(.39,.28,.21),
      'ear_inner':(.56,.38,.34),'antler':(.42,.31,.22),'hoof':(.075,.067,.060),'tail':(.36,.27,.20)
    }
    c=Creature('Cervalume_v02',bones,colors)
    # One continuous torso mass: deeper rib cage, narrower waist, readable pelvis.
    c.loft_z_faceted('Body','coat',[
      (-.90,.08,.09,0,0),(-.78,.28,.27,.01,0),(-.62,.36,.34,.04,0),(-.43,.40,.38,.065,0),
      (-.20,.39,.39,.075,0),(.02,.35,.36,.060,0),(.24,.32,.33,.035,0),(.47,.34,.34,.030,0),
      (.65,.31,.30,.015,0),(.79,.20,.20,0,0),(.86,.08,.09,-.01,0)
    ],16)
    # Chest planes integrated at the front, not a ball.
    c.loft_z_faceted('Body','chest',[
      (-.70,.31,.31,.02,0),(-.58,.35,.33,.05,0),(-.45,.36,.34,.07,0),(-.32,.33,.30,.06,0)
    ],14)
    # Belly plane band, intentionally shallow.
    c.loft_z_faceted('Body','belly',[
      (-.46,.29,.12,-.22,0),(-.18,.29,.11,-.25,0),(.10,.27,.10,-.245,0),(.35,.26,.10,-.22,0)
    ],14)
    # Neck as angular tapered column with a clear cervid rise.
    c.prism_path('Neck','coat_dark',[(0,-.04,.18),(0,.00,.05),(0,.08,-.10),(0,.18,-.25),(0,.27,-.40)],[.22,.215,.195,.165,.125],8,flatten=.92)
    # Head is a single faceted longitudinal mass + muzzle wedge.
    c.head_loft('Head','coat',[
      (.10,.12,.12,.02,0),(.00,.18,.15,.03,0),(-.14,.17,.14,.01,0),(-.28,.145,.115,-.015,0),(-.39,.125,.09,-.035,0)
    ],12)
    c.wedge_box('Head','muzzle',(0,-.045,-.48),(.23,.15,.26),front_scale=.62,top_slope=-.006)
    c.wedge_box('Head','nose',(0,-.050,-.625),(.18,.09,.065),front_scale=.82)
    c.wedge_box('Jaw','muzzle',(0,-.005,-.16),(.18,.075,.25),front_scale=.70)
    for side,label in [(-1,'L'),(1,'R')]:
        c.eye_disc('Head','eye',side,-.105,.055)
        c.ear_prism('Ear_'+label,'ear',side,1.0)
        # inner ear as smaller inset prism
        c.ear_prism('Ear_'+label,'ear_inner',side,.68)
    # Compact antlers: faceted 6-sided beams and three tines.
    for side,label in [(-1,'L'),(1,'R')]:
        bone='Antler_'+label;s=side
        c.prism_path(bone,'antler',[(0,0,0),(s*.02,.15,-.01),(s*.035,.30,-.005),(s*.05,.43,.01),(s*.06,.52,.035)],[.030,.027,.023,.018,.010],6)
        for y,dx,dz in [(.17,.10,-.02),(.29,.125,-.01),(.40,.14,.01)]:
            c.prism_path(bone,'antler',[(s*.02,y,dz),(s*.06,y+.05,dz-.01),(s*dx,y+.10,dz-.025)],[.018,.011,.003],6)
    # Species-specific leg planes with visible knee/hock offsets.
    for front in (True,False):
        for side,label in [(-1,'L'),(1,'R')]:
            pre='Fore' if front else 'Hind';u=pre+'Upper_'+label;l=pre+'Lower_'+label;p=pre+'Paw_'+label
            if front:
                c.loft_y_faceted(u,'chest',[(.11,.12,.135,-.01,0),(-.02,.115,.12,-.005,0),(-.18,.090,.10,.035,0),(-.34,.068,.075,.075,0)],9)
                c.loft_y_faceted(l,'coat',[(.10,.067,.072,.02,0),(-.07,.058,.066,-.02,0),(-.22,.048,.058,-.07,0),(-.36,.043,.052,-.10,0)],8)
            else:
                c.loft_y_faceted(u,'coat',[(.11,.14,.16,.06,0),(-.02,.135,.16,.05,0),(-.18,.105,.13,-.02,0),(-.34,.072,.085,-.11,0)],9)
                c.loft_y_faceted(l,'coat',[(.10,.070,.078,.05,0),(-.07,.060,.070,.10,0),(-.22,.050,.060,.04,0),(-.36,.044,.052,-.08,0)],8)
            c.hoof_pair(p,'hoof')
    c.prism_path('Tail_Base','tail',[(0,0,0),(0,-.005,.10),(0,-.018,.20)],[.055,.045,.025],7)
    return c

def make_lobrapedra():
    bones=[
      ('Root',None,(0,0,0)),('Body','Root',(0,.91,0)),('Spine','Body',(0,.04,.10)),
      ('Neck','Body',(0,.08,-.63)),('Head','Neck',(0,.06,-.38)),('Jaw','Head',(0,-.095,-.18)),
      ('Ear_L','Head',(-.13,.15,-.02)),('Ear_R','Head',(.13,.15,-.02)),
      ('Tail_Base','Body',(0,.04,.72)),('Tail_Mid','Tail_Base',(0,-.01,.30)),
      ('ForeUpper_L','Body',(-.27,-.11,-.43)),('ForeLower_L','ForeUpper_L',(0,-.30,.02)),('ForePaw_L','ForeLower_L',(0,-.28,-.075)),
      ('ForeUpper_R','Body',(.27,-.11,-.43)),('ForeLower_R','ForeUpper_R',(0,-.30,.02)),('ForePaw_R','ForeLower_R',(0,-.28,-.075)),
      ('HindUpper_L','Body',(-.27,-.09,.43)),('HindLower_L','HindUpper_L',(0,-.30,.09)),('HindPaw_L','HindLower_L',(0,-.28,-.09)),
      ('HindUpper_R','Body',(.27,-.09,.43)),('HindLower_R','HindUpper_R',(0,-.30,.09)),('HindPaw_R','HindLower_R',(0,-.28,-.09))
    ]
    colors={
      'coat':(.30,.27,.23),'coat_dark':(.19,.18,.17),'belly':(.43,.39,.34),'muzzle':(.36,.33,.29),
      'nose':(.050,.046,.042),'eye':(.56,.38,.13),'ear':(.28,.25,.22),'ear_inner':(.40,.30,.28),
      'paw':(.22,.20,.18),'claw':(.31,.29,.26),'callus':(.35,.34,.31),'tail':(.27,.25,.22)
    }
    c=Creature('Lobrapedra_v02',bones,colors)
    # Canid torso: deep chest -> tucked waist -> athletic pelvis. Single continuous surface.
    c.loft_z_faceted('Body','coat',[
      (-.80,.07,.08,0,0),(-.70,.27,.26,.01,0),(-.55,.36,.34,.045,0),(-.38,.40,.37,.065,0),
      (-.18,.37,.34,.055,0),(.02,.31,.29,.025,0),(.20,.29,.28,.00,0),(.40,.31,.30,.02,0),
      (.58,.29,.27,.015,0),(.71,.18,.18,0,0),(.77,.07,.08,-.01,0)
    ],16)
    c.loft_z_faceted('Body','belly',[
      (-.42,.27,.11,-.20,0),(-.16,.25,.10,-.24,0),(.08,.22,.09,-.235,0),(.28,.23,.09,-.20,0)
    ],14)
    # Integrated angular neck, carried forward.
    c.prism_path('Neck','coat_dark',[(0,-.02,.16),(0,.00,.04),(0,.04,-.10),(0,.08,-.24),(0,.11,-.35)],[.22,.215,.195,.165,.135],8,flatten=.92)
    # Broad wolf-like head, clearly tapered muzzle.
    c.head_loft('Head','coat',[
      (.09,.12,.11,.015,0),(.00,.18,.15,.015,0),(-.13,.17,.135,-.005,0),(-.27,.145,.105,-.025,0),(-.38,.125,.085,-.045,0)
    ],12)
    c.wedge_box('Head','muzzle',(0,-.055,-.48),(.22,.14,.26),front_scale=.56,top_slope=-.004)
    c.wedge_box('Head','nose',(0,-.060,-.625),(.17,.085,.060),front_scale=.82)
    c.wedge_box('Jaw','muzzle',(0,-.005,-.17),(.18,.070,.24),front_scale=.64)
    for side,label in [(-1,'L'),(1,'R')]:
        c.eye_disc('Head','eye',side,-.105,.050)
        c.ear_prism('Ear_'+label,'ear',side,.82)
        c.ear_prism('Ear_'+label,'ear_inner',side,.52)
    # One integrated low dorsal callus ridge, not separate "stone armor".
    c.loft_z_faceted('Body','callus',[
      (-.49,.17,.035,.36,0),(-.32,.20,.045,.39,0),(-.13,.18,.040,.37,0),(.04,.14,.032,.34,0)
    ],8)
    # Canid legs: compact upper masses, narrow lower limbs, angular paws.
    for front in (True,False):
        for side,label in [(-1,'L'),(1,'R')]:
            pre='Fore' if front else 'Hind';u=pre+'Upper_'+label;l=pre+'Lower_'+label;p=pre+'Paw_'+label
            if front:
                c.loft_y_faceted(u,'coat_dark',[(.11,.145,.16,-.02,0),(-.02,.15,.16,-.01,0),(-.14,.125,.14,.03,0),(-.27,.095,.105,.07,0)],9)
                c.loft_y_faceted(l,'coat',[(.09,.085,.09,.02,0),(-.06,.073,.08,-.01,0),(-.18,.063,.070,-.06,0),(-.28,.058,.065,-.10,0)],8)
            else:
                c.loft_y_faceted(u,'coat',[(.11,.15,.17,.06,0),(-.02,.16,.18,.05,0),(-.15,.13,.15,-.02,0),(-.28,.09,.105,-.10,0)],9)
                c.loft_y_faceted(l,'coat',[(.09,.082,.095,.04,0),(-.06,.071,.085,.08,0),(-.18,.061,.073,.03,0),(-.28,.056,.064,-.08,0)],8)
            c.wedge_box(p,'paw',(0,-.04,-.10),(.21,.10,.27),front_scale=.72,top_slope=-.006)
            # two integrated visible claw wedges, not floating tubes
            c.wedge_box(p,'claw',(-.045,-.085,-.235),(.035,.025,.07),front_scale=.30)
            c.wedge_box(p,'claw',(.045,-.085,-.235),(.035,.025,.07),front_scale=.30)
    # Bushy tail as two angular tapered masses.
    c.prism_path('Tail_Base','tail',[(0,0,0),(0,.00,.14),(0,-.02,.30)],[.10,.085,.065],8)
    c.prism_path('Tail_Mid','tail',[(0,0,0),(0,-.01,.16),(0,-.025,.31),(0,-.035,.40)],[.070,.060,.040,.015],8)
    return c

def make_animations(c,species,b):
    clips=[]
    def add(name,d,curves,loop=True):
        samplers=[];channels=[]
        for joint,attrs in curves.items():
            for path,vals in attrs.items():
                ts=np.asarray([t for t,_ in vals],np.float32); out=np.asarray([x for _,x in vals],np.float32)
                i=b.accessor(ts,5126,'SCALAR',minmax=True); o=b.accessor(out,5126,'VEC4' if path=='rotation' else 'VEC3')
                k=len(samplers);samplers.append({'input':i,'output':o,'interpolation':'LINEAR'})
                channels.append({'sampler':k,'target':{'node':c.bid[joint],'path':path}})
        clips.append({'name':name,'samplers':samplers,'channels':channels,'extras':{'durationSeconds':d,'loop':loop,'speciesSpecific':True}})
    def R(seq,axis='x'):
        fn={'x':rx,'y':ry,'z':rz}[axis]; return {'rotation':[(t,fn(a)) for t,a in seq]}
    def T(joint,seq):
        return {'translation':[(t,(c.off[joint]+V(*v)).tolist()) for t,v in seq]}

    if species=='cervalume':
        # 4-beat walk: FL -> HR -> FR -> HL; subtle neck counterbalance.
        d=1.60
        walk={
          'Body':T('Body',[(0,(0,0,0)),(.4,(0,.012,0)),(.8,(0,0,0)),(1.2,(0,.012,0)),(d,(0,0,0))]),
          'Neck':R([(0,1),(.4,-2),(.8,2),(1.2,-2),(d,1)]),
          'Head':R([(0,-1),(.4,2),(.8,-2),(1.2,2),(d,-1)]),
          'ForeUpper_L':R([(0,-18),(.4,4),(.8,14),(1.2,0),(d,-18)]),
          'HindUpper_R':R([(0,14),(.4,0),(.8,-18),(1.2,4),(d,14)]),
          'ForeUpper_R':R([(0,14),(.4,0),(.8,-18),(1.2,4),(d,14)]),
          'HindUpper_L':R([(0,-18),(.4,4),(.8,14),(1.2,0),(d,-18)]),
          'ForeLower_L':R([(0,18),(.4,8),(.8,0),(1.2,14),(d,18)]),
          'ForeLower_R':R([(0,0),(.4,14),(.8,18),(1.2,8),(d,0)]),
          'HindLower_L':R([(0,20),(.4,9),(.8,0),(1.2,15),(d,20)]),
          'HindLower_R':R([(0,0),(.4,15),(.8,20),(1.2,9),(d,0)])
        }
        add('walk',d,walk)
        # Trot: diagonal pairs, firmer torso.
        d=.92
        add('trot',d,{
          'Body':T('Body',[(0,(0,0,0)),(.23,(0,.035,0)),(.46,(0,0,0)),(.69,(0,.035,0)),(d,(0,0,0))]),
          'Neck':R([(0,0),(.23,-4),(.46,1),(.69,-4),(d,0)]),
          'ForeUpper_L':R([(0,-26),(.23,0),(.46,26),(.69,0),(d,-26)]),'HindUpper_R':R([(0,-26),(.23,0),(.46,26),(.69,0),(d,-26)]),
          'ForeUpper_R':R([(0,26),(.23,0),(.46,-26),(.69,0),(d,26)]),'HindUpper_L':R([(0,26),(.23,0),(.46,-26),(.69,0),(d,26)]),
          'ForeLower_L':R([(0,24),(.23,8),(.46,0),(.69,16),(d,24)]),'ForeLower_R':R([(0,0),(.23,16),(.46,24),(.69,8),(d,0)]),
          'HindLower_L':R([(0,0),(.23,18),(.46,26),(.69,8),(d,0)]),'HindLower_R':R([(0,26),(.23,8),(.46,0),(.69,18),(d,26)])
        })
        # Run/flee uses cervid bounding with suspension and hind thrust.
        d=.66
        add('run',d,{
          'Body':T('Body',[(0,(0,0,0)),(.16,(0,.09,-.03)),(.31,(0,.13,-.08)),(.46,(0,.04,-.02)),(d,(0,0,0))]),
          'Neck':R([(0,4),(.18,-7),(.36,-2),(.52,5),(d,4)]),'Head':R([(0,-2),(.18,4),(.36,2),(.52,-3),(d,-2)]),
          'ForeUpper_L':R([(0,-34),(.22,-44),(.38,30),(.55,8),(d,-34)]),'ForeUpper_R':R([(0,-30),(.22,-42),(.38,32),(.55,10),(d,-30)]),
          'HindUpper_L':R([(0,32),(.18,42),(.36,-34),(.52,-8),(d,32)]),'HindUpper_R':R([(0,30),(.18,40),(.36,-36),(.52,-10),(d,30)]),
          'ForeLower_L':R([(0,28),(.22,34),(.38,4),(.55,18),(d,28)]),'ForeLower_R':R([(0,26),(.22,32),(.38,5),(.55,17),(d,26)]),
          'HindLower_L':R([(0,5),(.18,2),(.36,34),(.52,20),(d,5)]),'HindLower_R':R([(0,5),(.18,2),(.36,34),(.52,20),(d,5)])
        })
        add('idle',3.0,{'Body':T('Body',[(0,(0,0,0)),(1.5,(0,.010,0)),(3,(0,0,0))]),'Head':R([(0,0),(1,-6),(2,5),(3,0)],'y'),'Ear_L':R([(0,0),(1.2,-8),(3,0)],'z'),'Ear_R':R([(0,0),(1.7,8),(3,0)],'z')})
        add('graze',3.2,{'Neck':R([(0,0),(.75,38),(2.45,38),(3.2,0)]),'Head':R([(0,0),(.75,18),(1.45,10),(2.15,19),(2.45,14),(3.2,0)]),'ForeUpper_L':R([(0,0),(.75,-5),(2.45,-5),(3.2,0)])})
        add('alert',1.45,{'Neck':R([(0,0),(.24,-18),(1.05,-18),(1.45,0)]),'Head':R([(0,0),(.30,-14),(.72,14),(1.1,0),(1.45,0)],'y'),'Ear_L':R([(0,0),(.30,-16),(1.45,0)],'z'),'Ear_R':R([(0,0),(.30,16),(1.45,0)],'z')},False)
        add('flee',d,{
          'Body':T('Body',[(0,(0,0,0)),(.16,(0,.11,-.04)),(.31,(0,.16,-.10)),(.46,(0,.05,-.03)),(d,(0,0,0))]),
          'ForeUpper_L':R([(0,-38),(.22,-48),(.38,34),(.55,10),(d,-38)]),'ForeUpper_R':R([(0,-34),(.22,-46),(.38,36),(.55,12),(d,-34)]),
          'HindUpper_L':R([(0,36),(.18,46),(.36,-38),(.52,-10),(d,36)]),'HindUpper_R':R([(0,34),(.18,44),(.36,-40),(.52,-12),(d,34)]),
          'Neck':R([(0,5),(.18,-9),(.36,-3),(.52,6),(d,5)])
        })
        add('defend',1.8,{'Body':T('Body',[(0,(0,0,0)),(.35,(0,-.025,-.05)),(1.25,(0,-.025,-.05)),(1.8,(0,0,0))]),'Neck':R([(0,0),(.35,18),(.75,-20),(1.25,-12),(1.8,0)]),'Head':R([(0,0),(.35,8),(.75,-10),(1.8,0)])},False)
        add('antler_push',1.5,{'Body':T('Body',[(0,(0,0,0)),(.35,(0,-.02,-.04)),(.72,(0,-.04,-.12)),(1.05,(0,-.03,-.12)),(1.5,(0,0,0))]),'Neck':R([(0,0),(.32,16),(.72,-28),(1.05,-22),(1.5,0)]),'Head':R([(0,0),(.32,6),(.72,-12),(1.5,0)]),'ForeUpper_L':R([(0,0),(.72,-10),(1.5,0)]),'ForeUpper_R':R([(0,0),(.72,-10),(1.5,0)])},False)
        add('follow_herd',1.35,{'Body':T('Body',[(0,(0,0,0)),(.34,(0,.015,0)),(.68,(0,0,0)),(1.02,(0,.015,0)),(1.35,(0,0,0))]),'Head':R([(0,0),(.65,-5),(1.35,0)],'y')})
        add('drink',2.8,{'Neck':R([(0,0),(.7,32),(2.1,32),(2.8,0)]),'Head':R([(0,0),(.7,13),(2.1,13),(2.8,0)])})
        add('rest',3.0,{'Body':T('Body',[(0,(0,0,0)),(.8,(0,-.24,0)),(2.4,(0,-.24,0)),(3,(0,0,0))]),'ForeLower_L':R([(0,0),(.8,30),(2.4,30),(3,0)]),'ForeLower_R':R([(0,0),(.8,30),(2.4,30),(3,0)]),'HindLower_L':R([(0,0),(.8,34),(2.4,34),(3,0)]),'HindLower_R':R([(0,0),(.8,34),(2.4,34),(3,0)])},False)
        add('hurt',.9,{'Body':R([(0,0),(.25,-8),(.55,7),(.9,0)],'z'),'Head':R([(0,0),(.25,12),(.6,-7),(.9,0)],'y')},False)
        add('death',2.8,{'Body':{'rotation':[(0,rz(0)),(.8,rz(-12)),(1.7,rz(-68)),(2.8,rz(-88))],'translation':[(0,c.off['Body'].tolist()),(.9,(c.off['Body']+V(0,-.12,0)).tolist()),(1.8,(c.off['Body']+V(0,-.36,0)).tolist()),(2.8,(c.off['Body']+V(0,-.40,0)).tolist())]},'Neck':R([(0,0),(1.4,18),(2.8,30)])},False)
    else:
        # Canid four-beat walk with lower body carriage.
        d=1.45
        add('walk',d,{
          'Body':T('Body',[(0,(0,-.02,0)),(.36,(0,-.01,0)),(.72,(0,-.02,0)),(1.08,(0,-.01,0)),(d,(0,-.02,0))]),
          'Neck':R([(0,1),(.36,-2),(.72,2),(1.08,-2),(d,1)]),'Tail_Base':R([(0,-6),(.72,6),(d,-6)],'y'),
          'ForeUpper_L':R([(0,-16),(.36,4),(.72,14),(1.08,0),(d,-16)]),'HindUpper_R':R([(0,14),(.36,0),(.72,-16),(1.08,4),(d,14)]),
          'ForeUpper_R':R([(0,14),(.36,0),(.72,-16),(1.08,4),(d,14)]),'HindUpper_L':R([(0,-16),(.36,4),(.72,14),(1.08,0),(d,-16)]),
          'ForeLower_L':R([(0,18),(.36,7),(.72,0),(1.08,14),(d,18)]),'ForeLower_R':R([(0,0),(.36,14),(.72,18),(1.08,7),(d,0)]),
          'HindLower_L':R([(0,20),(.36,8),(.72,0),(1.08,15),(d,20)]),'HindLower_R':R([(0,0),(.36,15),(.72,20),(1.08,8),(d,0)])
        })
        d=.82
        add('trot',d,{
          'Body':T('Body',[(0,(0,-.02,0)),(.205,(0,.02,0)),(.41,(0,-.02,0)),(.615,(0,.02,0)),(d,(0,-.02,0))]),
          'ForeUpper_L':R([(0,-25),(.205,0),(.41,25),(.615,0),(d,-25)]),'HindUpper_R':R([(0,-25),(.205,0),(.41,25),(.615,0),(d,-25)]),
          'ForeUpper_R':R([(0,25),(.205,0),(.41,-25),(.615,0),(d,25)]),'HindUpper_L':R([(0,25),(.205,0),(.41,-25),(.615,0),(d,25)]),
          'Neck':R([(0,0),(.205,-3),(.41,1),(.615,-3),(d,0)])
        })
        d=.60
        add('run',d,{
          'Body':T('Body',[(0,(0,-.01,0)),(.15,(0,.07,-.04)),(.30,(0,.11,-.09)),(.45,(0,.03,-.03)),(d,(0,-.01,0))]),
          'ForeUpper_L':R([(0,-34),(.20,-42),(.35,30),(.50,8),(d,-34)]),'ForeUpper_R':R([(0,-32),(.20,-40),(.35,32),(.50,10),(d,-32)]),
          'HindUpper_L':R([(0,30),(.16,42),(.33,-34),(.49,-8),(d,30)]),'HindUpper_R':R([(0,28),(.16,40),(.33,-36),(.49,-10),(d,28)]),
          'Neck':R([(0,4),(.17,-7),(.34,-2),(.50,5),(d,4)]),'Tail_Base':R([(0,-5),(.3,3),(d,-5)],'y')
        })
        add('idle',3.0,{'Body':T('Body',[(0,(0,-.02,0)),(1.5,(0,-.01,0)),(3,(0,-.02,0))]),'Head':R([(0,0),(1,-8),(2,6),(3,0)],'y'),'Tail_Base':R([(0,-5),(1.5,4),(3,-5)],'y')})
        add('stalk',2.4,{'Body':T('Body',[(0,(0,-.08,0)),(.6,(0,-.10,0)),(1.2,(0,-.08,0)),(1.8,(0,-.10,0)),(2.4,(0,-.08,0))]),'Neck':R([(0,8),(1.2,10),(2.4,8)]),'Head':R([(0,5),(1.2,-5),(2.4,5)],'y'),'ForeUpper_L':R([(0,10),(1.2,-10),(2.4,10)]),'HindUpper_R':R([(0,10),(1.2,-10),(2.4,10)])})
        add('chase',d,{
          'Body':T('Body',[(0,(0,-.01,0)),(.15,(0,.09,-.05)),(.30,(0,.13,-.11)),(.45,(0,.04,-.04)),(d,(0,-.01,0))]),
          'ForeUpper_L':R([(0,-38),(.20,-46),(.35,34),(.50,10),(d,-38)]),'ForeUpper_R':R([(0,-36),(.20,-44),(.35,36),(.50,12),(d,-36)]),
          'HindUpper_L':R([(0,34),(.16,46),(.33,-38),(.49,-10),(d,34)]),'HindUpper_R':R([(0,32),(.16,44),(.33,-40),(.49,-12),(d,32)])
        })
        add('pounce',1.25,{
          'Body':T('Body',[(0,(0,-.08,0)),(.25,(0,-.12,0)),(.48,(0,.20,-.13)),(.70,(0,.31,-.23)),(.96,(0,.08,-.06)),(1.25,(0,-.02,0))]),
          'HindUpper_L':R([(0,22),(.25,38),(.48,-30),(.70,-18),(1.25,0)]),'HindUpper_R':R([(0,22),(.25,38),(.48,-30),(.70,-18),(1.25,0)]),
          'ForeUpper_L':R([(0,8),(.25,18),(.48,-52),(.70,-38),(1.25,0)]),'ForeUpper_R':R([(0,8),(.25,18),(.48,-52),(.70,-38),(1.25,0)]),
          'Neck':R([(0,8),(.25,12),(.48,-12),(.70,-8),(1.25,0)])
        },False)
        add('bite',1.10,{'Neck':R([(0,0),(.25,16),(.50,-24),(.78,-18),(1.1,0)]),'Jaw':R([(0,0),(.28,30),(.58,4),(.85,18),(1.1,0)])},False)
        add('growl',2.0,{'Neck':R([(0,0),(.4,-8),(1.6,-8),(2,0)]),'Jaw':R([(0,0),(.4,10),(.8,16),(1.2,10),(1.6,18),(2,0)]),'Head':R([(0,0),(1,5),(2,0)],'y')})
        add('feed',2.6,{'Neck':R([(0,0),(.5,20),(2.1,20),(2.6,0)]),'Head':R([(0,0),(.6,10),(1.3,4),(2.0,11),(2.6,0)]),'Jaw':R([(0,0),(.7,18),(1.0,0),(1.35,15),(1.7,0),(2.1,16),(2.6,0)])})
        add('alert',1.4,{'Neck':R([(0,0),(.25,-14),(1.0,-14),(1.4,0)]),'Head':R([(0,0),(.3,-14),(.95,12),(1.4,0)],'y'),'Ear_L':R([(0,0),(.35,-10),(1.4,0)],'z'),'Ear_R':R([(0,0),(.35,10),(1.4,0)],'z')},False)
        add('retreat',1.1,{'Body':T('Body',[(0,(0,-.02,0)),(.35,(0,-.02,.08)),(.7,(0,-.02,.14)),(1.1,(0,-.02,0))]),'Head':R([(0,0),(.5,12),(1.1,0)],'y')},False)
        add('drink',2.7,{'Neck':R([(0,0),(.65,28),(2.0,28),(2.7,0)]),'Head':R([(0,0),(.65,11),(2.0,11),(2.7,0)])})
        add('rest',3.0,{'Body':T('Body',[(0,(0,-.02,0)),(.8,(0,-.22,0)),(2.4,(0,-.22,0)),(3,(0,-.02,0))]),'ForeLower_L':R([(0,0),(.8,28),(2.4,28),(3,0)]),'ForeLower_R':R([(0,0),(.8,28),(2.4,28),(3,0)]),'HindLower_L':R([(0,0),(.8,32),(2.4,32),(3,0)]),'HindLower_R':R([(0,0),(.8,32),(2.4,32),(3,0)])},False)
        add('hurt',.9,{'Body':R([(0,0),(.25,-8),(.55,7),(.9,0)],'z'),'Head':R([(0,0),(.25,12),(.6,-7),(.9,0)],'y')},False)
        add('death',2.8,{'Body':{'rotation':[(0,rz(0)),(.8,rz(-12)),(1.7,rz(-66)),(2.8,rz(-88))],'translation':[(0,c.off['Body'].tolist()),(.9,(c.off['Body']+V(0,-.10,0)).tolist()),(1.8,(c.off['Body']+V(0,-.33,0)).tolist()),(2.8,(c.off['Body']+V(0,-.37,0)).tolist())]},'Neck':R([(0,0),(1.4,18),(2.8,28)])},False)
    return clips

def export(c,species,outpath):
    b=old.Bin()
    clips=make_animations(c,species,b)
    materials=[];mi={}
    for name,rgb in c.colors.items():
        mi[name]=len(materials)
        materials.append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':list(rgb)+[1],'metallicFactor':0.0,'roughnessFactor':.92}})
    prims=[]; tri_count=0
    for mat,data in c.G.items():
        verts=np.asarray(data['vertices'],np.float32)
        faces=np.asarray(data['faces'],np.int64)
        joints_src=np.asarray(data['joints'],np.uint16)
        # Split every triangle vertex -> true face normals / hard polygon planes.
        pos=[];norm=[];joints=[]
        for f in faces:
            p0,p1,p2=verts[f[0]],verts[f[1]],verts[f[2]]
            n=np.cross(p1-p0,p2-p0); ln=np.linalg.norm(n)
            if ln<1e-9:n=np.array([0,1,0],np.float32)
            else:n=n/ln
            for idx in f:
                pos.append(verts[idx]);norm.append(n);joints.append(joints_src[idx])
        pos=np.asarray(pos,np.float32);norm=np.asarray(norm,np.float32)
        js=np.zeros((len(pos),4),np.uint16);js[:,0]=np.asarray(joints,np.uint16)
        wt=np.zeros((len(pos),4),np.float32);wt[:,0]=1.0
        indices=np.arange(len(pos),dtype=np.uint32)
        prims.append({'attributes':{
          'POSITION':b.accessor(pos,5126,'VEC3',34962,True),
          'NORMAL':b.accessor(norm,5126,'VEC3',34962),
          'JOINTS_0':b.accessor(js,5123,'VEC4',34962),
          'WEIGHTS_0':b.accessor(wt,5126,'VEC4',34962)
        },'indices':b.accessor(indices,5125,'SCALAR',34963),'material':mi[mat],'mode':4,
          'extras':{'flatShaded':True,'guideCompliantPlanes':True}})
        tri_count+=len(faces)
    nodes=[]
    for name,parent,off in c.bones:nodes.append({'name':name,'translation':c.off[name].tolist(),'rotation':[0,0,0,1],'children':[]})
    for name,parent,_ in c.bones:
        if parent:nodes[c.bid[parent]]['children'].append(c.bid[name])
    nodes.append({'name':species+'_Mesh','mesh':0,'skin':0})
    container=len(nodes);nodes.append({'name':species+'_v02','children':[0,container-1]})
    inv=[]
    for name,_,_ in c.bones:
        m=np.eye(4,dtype=np.float32);m[:3,3]=-c.rest[name];inv.append(m.T.reshape(-1))
    invacc=b.accessor(np.asarray(inv,np.float32),5126,'MAT4')
    gltf={
      'asset':{'version':'2.0','generator':'Wildhaven Official Creature Guide v1.0 pipeline — v02','copyright':'Original Wildhaven creature'},
      'scene':0,'scenes':[{'name':species+'_v02','nodes':[container]}],'nodes':nodes,
      'meshes':[{'name':species+'_DefinedPlanes_v02','primitives':prims}],
      'skins':[{'name':species+'_QuadrupedRig_v02','joints':list(range(len(c.bones))),'inverseBindMatrices':invacc,'skeleton':0}],
      'materials':materials,'animations':clips,'bufferViews':b.views,'accessors':b.acc,'buffers':[{'byteLength':len(b.b)}],
      'extras':{
        'speciesId':species,'revision':'v02','unit':'metre','officialVisualGuide':'1.0',
        'style':'stylized low-mid-poly defined planes','flatFaceNormals':True,
        'artisticStatus':'revision_artistic','animationReviewRequired':True
      }
    }
    js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    binary=bytes(b.b)+b'\0'*((-len(b.b))%4)
    blob=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    outpath.write_bytes(blob)
    return {'file':str(outpath.relative_to(ROOT)),'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'triangles':tri_count,'joints':len(c.bones),'animations':[x['name'] for x in clips]}

if __name__=='__main__':
    cv=make_cervalume(); lb=make_lobrapedra()
    cr=export(cv,'cervalume',OUT_C/'cervalume-animated-v02.glb')
    lr=export(lb,'lobrapedra',OUT_L/'lobrapedra-animated-v02.glb')
    (OUT_C/'cervalume-source-manifest-v02.json').write_text(json.dumps(cr,ensure_ascii=False,indent=2)+'\n')
    (OUT_L/'lobrapedra-source-manifest-v02.json').write_text(json.dumps(lr,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cervalume':cr,'lobrapedra':lr},ensure_ascii=False,indent=2))
