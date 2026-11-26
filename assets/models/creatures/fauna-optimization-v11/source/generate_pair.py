#!/usr/bin/env python3
"""Wildhaven — Cervalume + Lobrapedra real procedural mid-poly source models.\nBuild trigger registered.
Naturalistic anatomy first. No gameplay integration. Y-up, metres, animals face -Z.
"""
from __future__ import annotations
import json, math, struct, hashlib, random
from pathlib import Path
from collections import defaultdict
import numpy as np

ROOT=Path(__file__).resolve().parents[5]
OUT_C=ROOT/"assets/models/creatures/cervalume"
OUT_L=ROOT/"assets/models/creatures/lobrapedra"
OUT_C.mkdir(parents=True,exist_ok=True);OUT_L.mkdir(parents=True,exist_ok=True)
V=lambda *x: np.array(x,dtype=np.float64)

def quat(axis,deg):
    a=math.radians(deg)/2;u=V(*axis);u/=max(1e-12,np.linalg.norm(u))
    return [float(u[0]*math.sin(a)),float(u[1]*math.sin(a)),float(u[2]*math.sin(a)),float(math.cos(a))]
def rx(x):return quat((1,0,0),x)
def ry(x):return quat((0,1,0),x)
def rz(x):return quat((0,0,1),x)

class Bin:
    def __init__(self): self.b=bytearray();self.views=[];self.acc=[]
    def accessor(self,arr,comp,typ,target=None,minmax=False):
        dt={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[comp]
        arr=np.ascontiguousarray(arr,dtype=dt)
        while len(self.b)%4:self.b.append(0)
        off=len(self.b);raw=arr.tobytes();self.b.extend(raw)
        bv={"buffer":0,"byteOffset":off,"byteLength":len(raw)}
        if target:bv["target"]=target
        vi=len(self.views);self.views.append(bv)
        a={"bufferView":vi,"componentType":comp,"count":len(arr),"type":typ}
        if minmax and arr.ndim==2:
            a["min"]=np.min(arr,axis=0).astype(float).tolist();a["max"]=np.max(arr,axis=0).astype(float).tolist()
        ai=len(self.acc);self.acc.append(a);return ai

class Creature:
    def __init__(self,name,bones,colors):
        self.name=name;self.bones=bones;self.colors=colors
        self.bid={n:i for i,(n,p,o) in enumerate(bones)}
        self.parent={n:p for n,p,o in bones}
        self.off={n:V(*o) for n,p,o in bones}
        self.rest={}
        for n,_,_ in bones:
            p=V(0,0,0);cur=n
            while cur is not None:
                p+=self.off[cur];cur=self.parent[cur]
            self.rest[n]=p
        self.G=defaultdict(lambda:dict(vertices=[],faces=[],joints=[]))
    def add(self,bone,mat,verts,faces):
        if not verts:return
        g=self.G[mat];base=len(g["vertices"])
        vv=np.asarray(verts,dtype=np.float64)+self.rest[bone]
        g["vertices"].extend(vv.tolist())
        g["faces"].extend([[base+a,base+b,base+c] for a,b,c in faces])
        g["joints"].extend([self.bid[bone]]*len(vv))
    def ellipsoid(self,bone,mat,c,rad,lat=10,lon=16,tilt=0):
        verts=[];faces=[];cz,sz=math.cos(tilt),math.sin(tilt);rx0,ry0,rz0=rad
        for i in range(lat+1):
            t=i*math.pi/lat
            for j in range(lon):
                ph=2*math.pi*j/lon
                x=rx0*math.sin(t)*math.cos(ph);y=ry0*math.cos(t);z=rz0*math.sin(t)*math.sin(ph)
                verts.append((c[0]+cz*x-sz*y,c[1]+sz*x+cz*y,c[2]+z))
        for i in range(lat):
            for j in range(lon):
                a=i*lon+j;b=i*lon+(j+1)%lon;c0=(i+1)*lon+j;d=(i+1)*lon+(j+1)%lon
                faces.extend([(a,b,c0),(b,d,c0)])
        self.add(bone,mat,verts,faces)
    def tube(self,bone,mat,points,radii,sides=8):
        ps=[V(*p) for p in points];verts=[];faces=[]
        for k,p in enumerate(ps):
            tang=ps[min(k+1,len(ps)-1)]-ps[max(k-1,0)]
            tang/=max(1e-12,np.linalg.norm(tang))
            u=np.cross(tang,V(1,0,0))
            if np.linalg.norm(u)<.05:u=np.cross(tang,V(0,0,1))
            u/=max(1e-12,np.linalg.norm(u));w=np.cross(tang,u)
            for j in range(sides):
                a=2*math.pi*j/sides
                verts.append(p+radii[k]*(u*math.cos(a)+w*math.sin(a)))
        for k in range(len(ps)-1):
            for j in range(sides):
                a=k*sides+j;b=k*sides+(j+1)%sides;c=(k+1)*sides+j;d=(k+1)*sides+(j+1)%sides
                faces.extend([(a,c,b),(b,c,d)])
        self.add(bone,mat,verts,faces)
    def loft_z(self,bone,mat,rings,sides=24):
        verts=[];faces=[]
        for z,rx0,ry0,cy in rings:
            for k in range(sides):
                a=2*math.pi*k/sides;verts.append((rx0*math.cos(a),cy+ry0*math.sin(a),z))
        for r in range(len(rings)-1):
            for k in range(sides):
                a=r*sides+k;b=r*sides+(k+1)%sides;c=(r+1)*sides+k;d=(r+1)*sides+(k+1)%sides
                faces.extend([(a,c,b),(b,c,d)])
        self.add(bone,mat,verts,faces)
    def loft_y(self,bone,mat,rings,sides=14):
        verts=[];faces=[]
        for y,rx0,rz0,cz,cx in rings:
            for k in range(sides):
                a=2*math.pi*k/sides;verts.append((cx+rx0*math.cos(a),y,cz+rz0*math.sin(a)))
        for r in range(len(rings)-1):
            for k in range(sides):
                a=r*sides+k;b=r*sides+(k+1)%sides;c=(r+1)*sides+k;d=(r+1)*sides+(k+1)%sides
                faces.extend([(a,b,c),(b,d,c)])
        self.add(bone,mat,verts,faces)
    def wedge(self,bone,mat,p0,p1,p2,w=.015):
        a=V(0,w,0);v0=V(*p0);v1=V(*p1);v2=V(*p2)
        self.add(bone,mat,[v0,v1-a,v1+a,v2],[(0,1,2),(2,1,3),(2,3,0)])
    def spur(self,bone,mat,p,d,ln=.12,width=.02):
        u=V(*d);u/=max(1e-12,np.linalg.norm(u));p=V(*p)
        self.tube(bone,mat,[p,p+u*ln*.5,p+u*ln],[width,width*.55,.001],6)

def animations_common(c,species):
    b=Bin()
    def rotations(seq,axis='x'):
        fn={'x':rx,'y':ry,'z':rz}[axis];return [(float(t),fn(v)) for t,v in seq]
    def translations(bone,seq):return [(float(t),(c.off[bone]+V(*p)).tolist()) for t,p in seq]
    clips=[]
    def add(name,d,curves,loop=True):
        samplers=[];channels=[]
        for joint,attrs in curves.items():
            for path,vals in attrs.items():
                ts=np.asarray([t for t,x in vals],np.float32);out=np.asarray([x for t,x in vals],np.float32)
                i=b.accessor(ts,5126,'SCALAR',minmax=True);o=b.accessor(out,5126,'VEC4' if path=='rotation' else 'VEC3')
                k=len(samplers);samplers.append({'input':i,'output':o,'interpolation':'LINEAR'});channels.append({'sampler':k,'target':{'node':c.bid[joint],'path':path}})
        clips.append({'name':name,'samplers':samplers,'channels':channels,'extras':{'durationSeconds':d,'loop':loop}})
    def rot(fr,ax='x'):return {'rotation':rotations(fr,ax)}
    def bob(fr):return {'translation':translations('Body',[(t,(0,h,z)) for t,h,z in fr])}
    legs=['ForeUpper_L','ForeUpper_R','HindUpper_L','HindUpper_R']
    knees=['ForeLower_L','ForeLower_R','HindLower_L','HindLower_R']
    paws=['ForePaw_L','ForePaw_R','HindPaw_L','HindPaw_R']
    def gait(name,d,ang,knee,bounce,gallop=False):
        cs={'Body':bob([(0,0,0),(d*.25,bounce,0),(d*.5,0,0),(d*.75,bounce,0),(d,0,0)]),
            'Neck':rot([(0,0),(d*.25,-3),(d*.5,3),(d*.75,-3),(d,0)]),
            'Head':rot([(0,0),(d*.25,2),(d*.5,-2),(d*.75,2),(d,0)]),
            'Tail_Base':rot([(0,-8),(d*.5,8),(d,-8)],'y')}
        for j,n in enumerate(legs):
            phase=(j in (0,3)) if not gallop else (j<2)
            vals=[-1,0,1,0,-1] if phase else [1,0,-1,0,1]
            cs[n]=rot([(k*d/4,ang*v) for k,v in enumerate(vals)])
            bends=[knee,knee*.35,0,knee*.6,knee] if phase else [0,knee*.65,knee,0,0]
            cs[knees[j]]=rot([(k*d/4,float(bends[k])) for k in range(5)])
            cs[paws[j]]=rot([(k*d/4,float(-.25*bends[k])) for k in range(5)])
        add(name,d,cs)
    gait('walk',1.55,16,17,.018);gait('trot',.92,25,25,.035);gait('run',.68,36,36,.075,True)
    add('idle',3.0,{'Body':bob([(0,0,0),(1.5,.012,0),(3,0,0)]),'Head':rot([(0,0),(1,-7),(2,7),(3,0)],'y'),'Tail_Base':rot([(0,-5),(1.5,6),(3,-5)],'y')})
    add('breathing',2.6,{'Body':bob([(0,0,0),(1.3,.015,0),(2.6,0,0)]),'Neck':rot([(0,0),(1.3,-2),(2.6,0)])})
    add('drink',2.8,{'Neck':rot([(0,0),(.7,28),(2.1,28),(2.8,0)]),'Head':rot([(0,0),(.7,14),(2.1,14),(2.8,0)])})
    add('rest',3.0,{'Body':bob([(0,0,0),(.8,-.25,0),(2.3,-.25,0),(3,0,0)]),**{p:rot([(0,0),(.8,28),(2.3,28),(3,0)]) for p in knees}},False)
    add('sleep',4.0,{'Body':bob([(0,-.25,0),(2,-.27,0),(4,-.25,0)]),'Neck':rot([(0,8),(2,11),(4,8)])})
    add('hurt',.9,{'Body':rot([(0,0),(.25,-9),(.55,8),(.9,0)],'z'),'Head':rot([(0,0),(.25,15),(.6,-8),(.9,0)],'y')},False)
    add('death',2.8,{'Body':{'rotation':rotations([(0,0),(.8,-15),(1.7,-68),(2.8,-88)],'z'),'translation':translations('Body',[(0,(0,0,0)),(.9,(0,-.12,0)),(1.8,(0,-.36,0)),(2.8,(0,-.40,0))])},'Neck':rot([(0,0),(1.4,20),(2.8,32)])},False)
    add('turn_left',1.1,{'Root':rot([(0,0),(.55,25),(1.1,45)],'y'),'Head':rot([(0,0),(.55,10),(1.1,0)],'y')},False)
    add('turn_right',1.1,{'Root':rot([(0,0),(.55,-25),(1.1,-45)],'y'),'Head':rot([(0,0),(.55,-10),(1.1,0)],'y')},False)
    if species=='cervalume':
        add('graze',3.0,{'Neck':rot([(0,0),(.7,34),(2.3,34),(3,0)]),'Head':rot([(0,0),(.7,18),(1.5,10),(2.3,18),(3,0)])})
        add('alert',1.5,{'Neck':rot([(0,0),(.25,-18),(1.1,-18),(1.5,0)]),'Head':rot([(0,0),(.35,-12),(1.05,12),(1.5,0)],'y'),'Ear_L':rot([(0,0),(.4,-12),(1.5,0)],'z'),'Ear_R':rot([(0,0),(.4,12),(1.5,0)],'z')},False)
        add('flee',.62,{'Body':bob([(0,0,0),(.15,.08,0),(.3,.02,0),(.45,.09,0),(.62,0,0)]),
                         'ForeUpper_L':rot([(0,-30),(.31,28),(.62,-30)]),'ForeUpper_R':rot([(0,-30),(.31,28),(.62,-30)]),
                         'HindUpper_L':rot([(0,28),(.31,-30),(.62,28)]),'HindUpper_R':rot([(0,28),(.31,-30),(.62,28)])})
        add('defend',1.7,{'Neck':rot([(0,0),(.35,-16),(1.2,-14),(1.7,0)]),'Head':rot([(0,0),(.45,12),(1.0,-10),(1.7,0)],'y'),'ForeUpper_L':rot([(0,0),(.5,-15),(1.7,0)]),'ForeUpper_R':rot([(0,0),(.5,-15),(1.7,0)])},False)
        add('antler_push',1.45,{'Neck':rot([(0,0),(.35,18),(.7,-24),(1.0,-20),(1.45,0)]),'Head':rot([(0,0),(.35,8),(.72,-12),(1.45,0)])},False)
        add('follow_herd',1.25,{'Body':bob([(0,0,0),(.3,.018,0),(.6,0,0),(.9,.018,0),(1.25,0,0)]),'Head':rot([(0,0),(.6,-5),(1.25,0)],'y')})
    else:
        add('stalk',2.3,{'Body':bob([(0,-.07,0),(.6,-.10,0),(1.2,-.07,0),(1.8,-.10,0),(2.3,-.07,0)]),'Head':rot([(0,5),(1.1,-5),(2.3,5)],'y'),'ForeUpper_L':rot([(0,10),(1.15,-10),(2.3,10)]),'HindUpper_R':rot([(0,10),(1.15,-10),(2.3,10)])})
        add('chase',.60,{'Body':bob([(0,0,0),(.15,.07,0),(.30,.01,0),(.45,.07,0),(.60,0,0)]),
                        'ForeUpper_L':rot([(0,-34),(.30,32),(.60,-34)]),'ForeUpper_R':rot([(0,-34),(.30,32),(.60,-34)]),
                        'HindUpper_L':rot([(0,32),(.30,-34),(.60,32)]),'HindUpper_R':rot([(0,32),(.30,-34),(.60,32)])})
        add('pounce',1.25,{'Body':bob([(0,-.06,0),(.28,-.10,0),(.52,.22,-.12),(.72,.29,-.21),(1.0,.04,0),(1.25,0,0)]),'Neck':rot([(0,8),(.45,-10),(.75,-8),(1.25,0)]),'ForeUpper_L':rot([(0,10),(.45,-48),(.75,-35),(1.25,0)]),'ForeUpper_R':rot([(0,10),(.45,-48),(.75,-35),(1.25,0)])},False)
        add('bite',1.10,{'Neck':rot([(0,0),(.25,16),(.50,-22),(.78,-18),(1.1,0)]),'Jaw':rot([(0,0),(.28,28),(.58,4),(.85,18),(1.1,0)])},False)
        add('growl',2.0,{'Neck':rot([(0,0),(.4,-8),(1.6,-8),(2,0)]),'Jaw':rot([(0,0),(.4,10),(.8,16),(1.2,10),(1.6,18),(2,0)]),'Head':rot([(0,0),(1,5),(2,0)],'y')})
        add('feed',2.6,{'Neck':rot([(0,0),(.5,20),(2.1,20),(2.6,0)]),'Head':rot([(0,0),(.6,10),(1.3,4),(2.0,11),(2.6,0)]),'Jaw':rot([(0,0),(.7,18),(1.0,0),(1.35,15),(1.7,0),(2.1,16),(2.6,0)])})
        add('alert',1.4,{'Neck':rot([(0,0),(.25,-16),(1.0,-16),(1.4,0)]),'Head':rot([(0,0),(.3,-14),(.95,12),(1.4,0)],'y'),'Ear_L':rot([(0,0),(.35,-10),(1.4,0)],'z'),'Ear_R':rot([(0,0),(.35,10),(1.4,0)],'z')},False)
        add('retreat',1.1,{'Body':bob([(0,0,0),(.35,0,.08),(.7,0,.14),(1.1,0,0)]),'Head':rot([(0,0),(.5,12),(1.1,0)],'y')},False)
    return b,clips

def make_cervalume():
    bones=[
      ('Root',None,(0,0,0)),('Body','Root',(0,1.16,0)),('Spine','Body',(0,.05,.14)),
      ('Neck','Body',(0,.17,-.69)),('Head','Neck',(0,.27,-.49)),('Jaw','Head',(0,-.10,-.18)),
      ('Ear_L','Head',(-.16,.15,-.01)),('Ear_R','Head',(.16,.15,-.01)),
      ('Tail_Base','Body',(0,.03,.80)),('Antler_L','Head',(-.10,.23,-.03)),('Antler_R','Head',(.10,.23,-.03)),
      ('ForeUpper_L','Body',(-.29,-.12,-.48)),('ForeLower_L','ForeUpper_L',(0,-.40,.02)),('ForePaw_L','ForeLower_L',(0,-.39,-.07)),
      ('ForeUpper_R','Body',(.29,-.12,-.48)),('ForeLower_R','ForeUpper_R',(0,-.40,.02)),('ForePaw_R','ForeLower_R',(0,-.39,-.07)),
      ('HindUpper_L','Body',(-.30,-.10,.50)),('HindLower_L','HindUpper_L',(0,-.40,.09)),('HindPaw_L','HindLower_L',(0,-.39,-.10)),
      ('HindUpper_R','Body',(.30,-.10,.50)),('HindLower_R','HindUpper_R',(0,-.40,.09)),('HindPaw_R','HindLower_R',(0,-.39,-.10))
    ]
    colors={'coat':(.46,.34,.24),'belly':(.67,.57,.45),'mane':(.33,.26,.20),'muzzle':(.57,.48,.38),'nose':(.072,.058,.048),
            'eye':(.34,.20,.08),'pupil':(.025,.02,.018),'ear':(.45,.32,.25),'ear_inner':(.60,.43,.39),'antler':(.45,.34,.25),
            'hoof':(.085,.075,.065),'spot':(.71,.65,.53),'tail':(.38,.30,.24),'jaw':(.52,.42,.34),'shoulder':(.42,.31,.22)}
    c=Creature('Cervalume',bones,colors)
    # Slender but powerful cervid torso with a deeper chest and narrower waist.
    c.loft_z('Body','coat',[(-.90,.07,.08,0),(-.80,.27,.27,.00),(-.64,.35,.34,.025),(-.48,.39,.38,.05),
                            (-.26,.38,.39,.06),(-.02,.35,.37,.055),(.25,.34,.35,.04),(.50,.35,.34,.025),(.70,.29,.28,.0),(.82,.08,.09,-.01)],30)
    c.ellipsoid('Body','shoulder',(0,.03,-.48),(.34,.32,.28),10,18)
    c.ellipsoid('Body','belly',(0,-.255,.04),(.27,.095,.55),9,17)
    c.ellipsoid('Body','coat',(0,.02,.48),(.31,.30,.28),9,17)
    # Neck rises forward in a continuous tapered column rather than a block.
    c.tube('Neck','mane',[(0,-.02,.17),(0,.04,.02),(0,.12,-.13),(0,.22,-.27),(0,.28,-.38)],[.21,.205,.19,.165,.135],14)
    c.ellipsoid('Neck','mane',(0,-.05,-.03),(.21,.26,.30),9,15)
    # Long deer-like skull, narrow nasal bridge and compact muzzle.
    c.ellipsoid('Head','coat',(0,.005,-.13),(.175,.15,.28),10,18)
    c.ellipsoid('Head','coat',(0,.015,-.31),(.135,.115,.22),9,17)
    c.ellipsoid('Head','muzzle',(0,-.045,-.49),(.115,.075,.17),8,15)
    c.ellipsoid('Head','nose',(0,-.048,-.615),(.092,.052,.068),7,13)
    c.ellipsoid('Jaw','jaw',(0,-.005,-.17),(.105,.050,.16),7,13)
    for side,label in [(-1,'L'),(1,'R')]:
        c.ellipsoid('Head','eye',(side*.157,.060,-.095),(.017,.027,.032),7,11)
        c.ellipsoid('Head','pupil',(side*.168,.062,-.108),(.006,.014,.016),6,9)
        # Ears: longer, thinner, angled outward.
        c.ellipsoid('Ear_'+label,'ear',(side*.025,.075,.015),(.075,.155,.042),9,12,tilt=-side*.22)
        c.ellipsoid('Ear_'+label,'ear_inner',(side*.030,.080,.002),(.043,.115,.017),7,10,tilt=-side*.22)
    # Compact biological antlers: beam + three tines, not a fantasy crown.
    for side,label in [(-1,'L'),(1,'R')]:
        bone='Antler_'+label;s=side
        c.tube(bone,'antler',[(0,0,0),(s*.018,.15,-.008),(s*.035,.30,-.010),(s*.050,.43,.0),(s*.065,.53,.025)],[.030,.028,.024,.019,.013],8)
        for y,z,dx in [(.17,-.01,.105),(.29,0,.13),(.40,.015,.14)]:
            c.tube(bone,'antler',[(s*.02,y,z),(s*(.02+dx*.45),y+.055,z-.012),(s*(.02+dx),y+.095,z-.025)],[.018,.012,.0025],7)
    # Natural dapple pattern, sparse and irregular.
    rng=random.Random(2411)
    for side in (-1,1):
        for _ in range(20):
            z=rng.uniform(-.56,.48);y=rng.uniform(-.04,.17);x=side*rng.uniform(.335,.372)
            c.ellipsoid('Body','spot',(x,y,z),(.024,.010,.038),5,8)
    # Long cervid legs with visible hock/knee offsets and split hooves.
    for front in (True,False):
        for side,label in [(-1,'L'),(1,'R')]:
            pre='Fore' if front else 'Hind';u=pre+'Upper_'+label;l=pre+'Lower_'+label;p=pre+'Paw_'+label
            if front:
                c.loft_y(u,'shoulder',[(.12,.115,.13,-.02,0),(-.02,.112,.12,-.01,0),(-.18,.090,.10,.03,0),(-.34,.068,.075,.06,0)],13)
                c.loft_y(l,'coat',[(.10,.067,.070,.02,0),(-.08,.058,.065,-.02,0),(-.23,.048,.058,-.07,0),(-.36,.043,.052,-.09,0)],11)
            else:
                c.loft_y(u,'coat',[(.12,.14,.16,.06,0),(-.02,.135,.16,.05,0),(-.18,.105,.13,-.02,0),(-.34,.072,.085,-.10,0)],13)
                c.loft_y(l,'coat',[(.10,.070,.078,.05,0),(-.08,.060,.070,.09,0),(-.23,.050,.060,.03,0),(-.36,.044,.052,-.07,0)],11)
            c.ellipsoid(p,'hoof',(-.043,-.045,-.075),(.045,.040,.095),7,10,tilt=-.08)
            c.ellipsoid(p,'hoof',(.043,-.045,-.075),(.045,.040,.095),7,10,tilt=.08)
    c.tube('Tail_Base','tail',[(0,0,0),(0,-.005,.10),(0,-.018,.18)],[.060,.052,.038],8)
    c.ellipsoid('Tail_Base','belly',(0,-.010,.235),(.070,.055,.095),8,12)
    return c

def make_lobrapedra():
    bones=[
      ('Root',None,(0,0,0)),('Body','Root',(0,.91,0)),('Spine','Body',(0,.05,.10)),
      ('Neck','Body',(0,.11,-.61)),('Head','Neck',(0,.07,-.36)),('Jaw','Head',(0,-.10,-.15)),
      ('Ear_L','Head',(-.13,.16,-.01)),('Ear_R','Head',(.13,.16,-.01)),('Tail_Base','Body',(0,.05,.72)),('Tail_Mid','Tail_Base',(0,.00,.29)),
      ('ForeUpper_L','Body',(-.27,-.12,-.43)),('ForeLower_L','ForeUpper_L',(0,-.30,.015)),('ForePaw_L','ForeLower_L',(0,-.28,-.075)),
      ('ForeUpper_R','Body',(.27,-.12,-.43)),('ForeLower_R','ForeUpper_R',(0,-.30,.015)),('ForePaw_R','ForeLower_R',(0,-.28,-.075)),
      ('HindUpper_L','Body',(-.27,-.10,.43)),('HindLower_L','HindUpper_L',(0,-.30,.08)),('HindPaw_L','HindLower_L',(0,-.28,-.09)),
      ('HindUpper_R','Body',(.27,-.10,.43)),('HindLower_R','HindUpper_R',(0,-.30,.08)),('HindPaw_R','HindLower_R',(0,-.28,-.09))
    ]
    colors={'coat':(.32,.29,.25),'belly':(.47,.43,.37),'dark':(.20,.19,.18),'muzzle':(.39,.35,.31),'nose':(.055,.05,.045),
            'eye':(.63,.43,.15),'pupil':(.025,.02,.015),'ear':(.30,.27,.24),'ear_inner':(.43,.33,.31),'tooth':(.78,.73,.62),
            'paw':(.24,.22,.20),'claw':(.35,.33,.29),'plate':(.36,.35,.32),'plate_edge':(.27,.27,.25),'tail':(.29,.27,.24),'shoulder':(.27,.25,.22)}
    c=Creature('Lobrapedra',bones,colors)
    # Lean, deep-chested canid silhouette: strong shoulders, tucked waist, athletic rump.
    c.loft_z('Body','coat',[(-.80,.07,.08,0),(-.70,.27,.26,.01),(-.54,.36,.34,.04),(-.38,.40,.37,.06),(-.20,.38,.35,.06),
                            (.02,.33,.31,.04),(.24,.31,.30,.02),(.44,.33,.32,.03),(.61,.29,.27,.01),(.72,.09,.10,-.01)],28)
    c.ellipsoid('Body','shoulder',(0,.02,-.43),(.36,.33,.30),10,18)
    c.ellipsoid('Body','coat',(0,-.01,.42),(.31,.29,.28),9,17)
    c.ellipsoid('Body','belly',(0,-.23,-.02),(.25,.085,.46),8,16)
    # Sloping muscular neck into a broad but clearly canid skull.
    c.tube('Neck','dark',[(0,-.01,.16),(0,.02,.04),(0,.06,-.10),(0,.10,-.23),(0,.12,-.34)],[.22,.215,.20,.17,.145],14)
    c.ellipsoid('Neck','dark',(0,-.02,-.02),(.22,.24,.29),9,15)
    c.ellipsoid('Head','coat',(0,.00,-.13),(.18,.15,.24),9,17)
    c.ellipsoid('Head','coat',(0,-.015,-.29),(.15,.12,.20),8,16)
    c.ellipsoid('Head','muzzle',(0,-.07,-.47),(.115,.075,.18),8,15)
    c.ellipsoid('Head','nose',(0,-.067,-.605),(.087,.050,.065),7,12)
    c.ellipsoid('Jaw','muzzle',(0,-.01,-.17),(.105,.048,.16),7,12)
    for side,label in [(-1,'L'),(1,'R')]:
        c.ellipsoid('Head','eye',(side*.158,.052,-.10),(.017,.027,.030),7,11)
        c.ellipsoid('Head','pupil',(side*.169,.054,-.112),(.006,.013,.015),6,9)
        # Small triangular-looking wolf ears using a flattened base plus tapered spur.
        c.ellipsoid('Ear_'+label,'ear',(side*.012,.030,.015),(.065,.090,.045),8,11,tilt=-side*.15)
        c.spur('Ear_'+label,'ear',(side*.005,.060,.010),(side*.18,.92,-.10),.13,.040)
        c.ellipsoid('Ear_'+label,'ear_inner',(side*.015,.036,.002),(.038,.060,.018),6,9,tilt=-side*.15)
        c.tube('Head','tooth',[(side*.055,-.145,-.39),(side*.055,-.185,-.40)],[.009,.001],5)
    # Only six low-profile protective calluses/scutes around shoulders and front back.
    for x,y,z in [(-.22,.255,-.43),(.22,.255,-.43),(-.24,.270,-.20),(.24,.270,-.20),(-.20,.255,.02),(.20,.255,.02)]:
        c.ellipsoid('Body','plate',(x,y,z),(.085,.020,.105),5,8,tilt=.10*math.copysign(1,x))
        c.ellipsoid('Body','plate_edge',(x,y+.006,z),(.060,.009,.075),5,7,tilt=.10*math.copysign(1,x))
    # Digitigrade-ish legs with narrower lower limbs and compact paws.
    for front in (True,False):
        for side,label in [(-1,'L'),(1,'R')]:
            pre='Fore' if front else 'Hind';u=pre+'Upper_'+label;l=pre+'Lower_'+label;p=pre+'Paw_'+label
            if front:
                c.loft_y(u,'shoulder',[(.12,.145,.16,-.02,0),(-.02,.15,.16,-.01,0),(-.14,.125,.14,.03,0),(-.27,.095,.105,.07,0)],13)
                c.loft_y(l,'coat',[(.09,.085,.09,.02,0),(-.06,.073,.08,-.01,0),(-.18,.063,.070,-.06,0),(-.28,.058,.065,-.10,0)],11)
            else:
                c.loft_y(u,'coat',[(.12,.15,.17,.06,0),(-.02,.16,.18,.05,0),(-.15,.13,.15,-.02,0),(-.28,.09,.105,-.10,0)],13)
                c.loft_y(l,'coat',[(.09,.082,.095,.04,0),(-.06,.071,.085,.08,0),(-.18,.061,.073,.03,0),(-.28,.056,.064,-.08,0)],11)
            c.ellipsoid(p,'paw',(0,-.04,-.105),(.105,.055,.145),7,11)
            for toe in range(4):
                x=(toe-1.5)*.042;c.tube(p,'claw',[(x,-.060,-.19),(x,-.072,-.225)],[.009,.001],5)
    # Full bushy tail with a visible taper, carried low and behind.
    c.tube('Tail_Base','tail',[(0,0,0),(0,.005,.14),(0,-.015,.30)],[.095,.088,.075],10)
    c.tube('Tail_Mid','tail',[(0,0,0),(0,-.005,.16),(0,-.020,.31)],[.075,.060,.035],9)
    c.ellipsoid('Tail_Mid','tail',(0,-.015,.38),(.095,.075,.15),8,13)
    return c

def export(c,species,outpath):
    b,clips=animations_common(c,species)
    materials=[];mi={}
    for name,rgb in c.colors.items():
        mi[name]=len(materials);materials.append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':list(rgb)+[1],'metallicFactor':0.0,'roughnessFactor':.88}})
    prims=[];tris=0;verts=0
    for mat,data in c.G.items():
        v=np.asarray(data['vertices'],np.float32);f=np.asarray(data['faces'],np.uint32)
        normals=np.zeros_like(v);cross=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
        for k in range(3):np.add.at(normals,f[:,k],cross)
        normals/=np.maximum(np.linalg.norm(normals,axis=1),1e-8)[:,None]
        joints=np.zeros((len(v),4),dtype=np.uint16);joints[:,0]=data['joints'];weights=np.zeros((len(v),4),dtype=np.float32);weights[:,0]=1
        prims.append({'attributes':{
            'POSITION':b.accessor(v,5126,'VEC3',34962,True),
            'NORMAL':b.accessor(normals,5126,'VEC3',34962),
            'JOINTS_0':b.accessor(joints,5123,'VEC4',34962),
            'WEIGHTS_0':b.accessor(weights,5126,'VEC4',34962)
        },'indices':b.accessor(f.reshape(-1),5125,'SCALAR',34963),'material':mi[mat],'mode':4})
        tris+=len(f);verts+=len(v)
    nodes=[]
    for name,parent,off in c.bones:nodes.append({'name':name,'translation':c.off[name].tolist(),'rotation':[0,0,0,1],'children':[]})
    for name,parent,_ in c.bones:
        if parent:nodes[c.bid[parent]]['children'].append(c.bid[name])
    nodes.append({'name':species+'_Mesh','mesh':0,'skin':0})
    container=len(nodes);nodes.append({'name':species,'children':[0,container-1]})
    inv=[]
    for name,_,_ in c.bones:
        m=np.eye(4,dtype=np.float32);m[:3,3]=-c.rest[name];inv.append(m.T.reshape(-1))
    invacc=b.accessor(np.asarray(inv,np.float32),5126,'MAT4')
    gltf={'asset':{'version':'2.0','generator':'Wildhaven naturalistic mid-poly procedural v01','copyright':'Original fictional creature Wildhaven'},
          'scene':0,'scenes':[{'name':species,'nodes':[container]}],'nodes':nodes,
          'meshes':[{'name':species+'_MidPoly','primitives':prims}],
          'skins':[{'name':species+'_Rig','joints':list(range(len(c.bones))),'inverseBindMatrices':invacc,'skeleton':0}],
          'materials':materials,'animations':clips,'bufferViews':b.views,'accessors':b.acc,'buffers':[{'byteLength':len(b.b)}],
          'extras':{'speciesId':species,'unit':'metre','artDirection':'naturalistic low/mid-poly; restrained fantasy elements','animationCount':len(clips)}}
    js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    binary=bytes(b.b)+b'\0'*((-len(b.b))%4)
    blob=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    outpath.write_bytes(blob)
    return {'file':str(outpath.relative_to(ROOT)),'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'triangles':tris,'vertices':verts,'joints':len(c.bones),'animations':[a['name'] for a in clips]}

if __name__=='__main__':
    cerv=make_cervalume();lob=make_lobrapedra()
    # geometry generation
    # cerv
    # functions add geometry inside make_*; return built creature
    # lob likewise
    cr=export(cerv,'cervalume',OUT_C/'cervalume-animated-v01.glb')
    lr=export(lob,'lobrapedra',OUT_L/'lobrapedra-animated-v01.glb')
    (OUT_C/'cervalume-source-manifest-v01.json').write_text(json.dumps(cr,ensure_ascii=False,indent=2)+'\n')
    (OUT_L/'lobrapedra-source-manifest-v01.json').write_text(json.dumps(lr,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'cervalume':cr,'lobrapedra':lr},ensure_ascii=False,indent=2))
