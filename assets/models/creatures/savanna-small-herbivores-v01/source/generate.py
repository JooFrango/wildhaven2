#!/usr/bin/env python3
"""Wildhaven four small herbivores: original procedural mid-poly GLBs with real clips/LODs.

No game integration. Produces actual independently articulated mesh nodes, PBR
materials, vertex colour coats, animation channels, and PNGs of exported meshes.
Requires numpy and vtk for render. Tested with Python 3.11+.
"""
from __future__ import annotations
import argparse, json, math, struct, hashlib, random
from collections import defaultdict
from pathlib import Path
import numpy as np

TAU=2*math.pi
HERE=Path(__file__).resolve().parents[1]
PALETTES={
 'sevilho': {'coat':(0.59,.325,.15),'coat2':(.37,.195,.10),'cream':(.84,.71,.51),'dark':(.19,.105,.065),'pink':(.56,.31,.24),'eye':(.11,.066,.035),'glint':(.99,.89,.65),'claw':(.26,.205,.15),'mark':(.38,.205,.105)},
 'arbelio': {'coat':(.70,.43,.185),'coat2':(.36,.20,.10),'cream':(.84,.73,.54),'dark':(.185,.12,.07),'pink':(.58,.32,.24),'eye':(.072,.052,.034),'glint':(.99,.91,.75),'claw':(.22,.18,.14),'mark':(.30,.17,.085)},
 'frutavil': {'coat':(.63,.26,.115),'coat2':(.40,.155,.075),'cream':(.90,.78,.57),'dark':(.13,.17,.23),'pink':(.66,.33,.15),'eye':(.08,.054,.035),'glint':(.98,.88,.62),'claw':(.19,.145,.11),'mark':(.35,.43,.51), 'steel':(.27,.38,.49)},
 'cromatil': {'coat':(.34,.365,.205),'coat2':(.25,.29,.15),'cream':(.72,.63,.43),'dark':(.19,.23,.11),'pink':(.60,.30,.145),'eye':(.35,.23,.065),'glint':(.98,.86,.50),'claw':(.25,.24,.20),'mark':(.50,.42,.20),'rust':(.55,.28,.13)}
}


def norm(v):
    a=np.asarray(v,float); s=np.linalg.norm(a); return a/max(s,1e-10)

def normals(v,f):
    a=v[f[:,1]]-v[f[:,0]]; b=v[f[:,2]]-v[f[:,0]]; t=np.cross(a,b)
    n=np.zeros_like(v,dtype=np.float64)
    np.add.at(n,f[:,0],t);np.add.at(n,f[:,1],t);np.add.at(n,f[:,2],t)
    leng=np.linalg.norm(n,axis=1);return (n/np.maximum(1e-10,leng[:,None])).astype('<f4')

def mesh(v,f,colors=None):
    v=np.asarray(v,dtype='<f4'); f=np.asarray(f,dtype='<u4').reshape(-1,3)
    n=normals(v,f)
    c=None if colors is None else np.asarray(colors,dtype='<f4')
    assert len(f)>0 and len(v)>0 and np.all(np.isfinite(v))
    return (v,f,n,c)

def sphere(center,radii,rings=9,sides=15,colors=None):
    cx,cy,cz=center;rx,ry,rz=radii
    verts=[]
    for i in range(rings+1):
        theta=math.pi*i/rings
        for j in range(sides):
            phi=TAU*j/sides
            verts.append((cx+rx*math.cos(theta),cy+ry*math.sin(theta)*math.cos(phi),cz+rz*math.sin(theta)*math.sin(phi)))
    faces=[]
    for i in range(rings):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            if i:faces.append((a,b,c))
            if i<rings-1:faces.append((b,d,c))
    return mesh(verts,faces,colors)

def tube(points,radii,sides=11,colors=None,ellipse=None):
    points=np.asarray(points,dtype=float)
    assert len(points)>=2 and len(points)==len(radii)
    verts=[]
    for i,p in enumerate(points):
        t=norm(points[min(i+1,len(points)-1)]-points[max(0,i-1)])
        anchor=np.array([0.,1.,0.])
        if abs(np.dot(t,anchor))>.95:anchor=np.array([0.,0.,1.])
        a=norm(np.cross(t,anchor));b=norm(np.cross(t,a))
        for j in range(sides):
            ang=TAU*j/sides
            rx=radii[i] if ellipse is None else radii[i]*ellipse[0]
            ry=radii[i] if ellipse is None else radii[i]*ellipse[1]
            verts.append(p+rx*math.cos(ang)*a+ry*math.sin(ang)*b)
    faces=[]
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            faces.extend([(a,c,b),(b,c,d)])
    faces.extend((0,j+1,j) for j in range(1,sides-1))
    off=(len(points)-1)*sides
    faces.extend((off,off+j,off+j+1) for j in range(1,sides-1))
    return mesh(verts,faces,colors)

def loft(rings,sides=20,palette=None,pattern=None,sidew=1.0):
    # Continuous organic body: x, center y, vertical radius, horizontal radius
    verts=[];colors=[]
    fine=[]
    steps=5 if sides>=17 else 3 if sides>=15 else 2
    for k in range(len(rings)-1):
        for u in range(steps):
            t=u/steps;fine.append(tuple(rings[k][j]*(1-t)+rings[k+1][j]*t for j in range(4)))
    fine.append(tuple(rings[-1]))
    rings=fine
    for x,cy,rh,rw in rings:
        for j in range(sides):
            a=TAU*j/sides; y=cy+rh*math.cos(a);z=rw*math.sin(a)*sidew
            verts.append((x,y,z))
            if palette:
                base=np.array(palette[0]);alt=np.array(palette[1]);belly=np.array(palette[2]);
                dark=np.clip((math.cos(a)-.32)*1.4,0,1)
                under=np.clip((-math.cos(a)-.28)*1.5,0,1)
                noise=.5+.5*math.sin(x*34+math.sin(a*3)*4)*math.cos(a*11+x*12)
                stripe=(.35+.65*noise)*dark
                if pattern=='bars':stripe=max(stripe,.86*max(0.,math.sin(x*35+3*math.sin(a))))*max(.12,math.sin(a)**2)*(.5+.5*max(0.,math.cos(a)))
                if pattern=='dots':stripe=max(stripe, float(math.sin(x*21+math.sin(a)*16)*math.cos(a*15)>.68)*(.8 if abs(math.sin(a))>.5 else .2))
                if pattern=='scales':stripe*=.25
                c=base*(1-stripe*.55)+alt*(stripe*.55)
                c=c*(1-under)+belly*under
                c=np.clip(c,0,1);colors.append([*c,1.])
    faces=[]
    for i in range(len(rings)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            faces.extend([(a,c,b),(b,c,d)])
    faces.extend((0,j+1,j) for j in range(1,sides-1))
    off=(len(rings)-1)*sides
    faces.extend((off,off+j,off+j+1) for j in range(1,sides-1))
    return mesh(verts,faces,colors)

def scute(x,y,z,length,width,rise):
    """Flat overlapping organic scute following the back, instead of blocks."""
    v=[(x+.030,y-.012,z-width*.50),(x-.035,y+rise*.70,z-width*.54),
       (x-length*.69,y+rise*.66,z-width*.34),(x-length,y+.008,z),
       (x-length*.69,y+rise*.66,z+width*.34),(x-.035,y+rise*.70,z+width*.54),
       (x+.030,y-.012,z+width*.50),(x-.035,y+rise*.16,z)]
    f=[(0,1,7),(1,2,7),(2,3,7),(3,4,7),(4,5,7),(5,6,7),(6,0,7)]
    return mesh(v,f)

def feather(origin,direction,width=.08,camber=.04,rings=6,levels=3):
    org=np.asarray(origin,float);dir=norm(direction);length=np.linalg.norm(direction)
    a=np.array([0.,0.,1.]);
    if abs(np.dot(dir,a))>.94:a=np.array([1.,0.,0.])
    side=norm(np.cross(dir,a));b=norm(np.cross(dir,side))
    vs=[]
    for i in range(rings+1):
        t=i/rings; p=org+dir*length*t + b*(camber*math.sin(math.pi*t))
        w=width*max(.03,math.sin(math.pi*t)**.75)
        for j in range(levels):
            v=(j/(levels-1)*2-1)
            vs.append(p+side*w*v+b*(.018*(1-v*v)*math.sin(math.pi*t)))
    fs=[]
    for i in range(rings):
        for j in range(levels-1):
            a=i*levels+j;b=a+1;c=(i+1)*levels+j;d=c+1
            fs.extend([(a,c,b),(b,c,d)])
    return mesh(vs,fs)

def quat(axis,angle):
    a=norm(axis);ss=math.sin(angle/2);return [float(a[0]*ss),float(a[1]*ss),float(a[2]*ss),float(math.cos(angle/2))]

def combine(items):
    vs=[];fs=[];ns=[];cs=[];off=0;has_colors=all(x[3] is not None for x in items)
    for v,f,n,c in items:
        vs.append(v);fs.append(f+off);ns.append(n);off+=len(v)
        if has_colors:cs.append(c)
    return (np.concatenate(vs),np.concatenate(fs),np.concatenate(ns),np.concatenate(cs) if has_colors else None)

class Figure:
    def __init__(self, species, lod):
        self.id=species;self.lod=lod;self.p=PALETTES[species];self.nodes=[];self.meshes=defaultdict(lambda:defaultdict(list))
        self.matnames=list(self.p)+['coat_vertex'];self.mat={k:i for i,k in enumerate(self.matnames)}
        self.defpos={};self.anims=[];self.c=12 if lod==0 else 9 if lod==1 else 7
        self.seg=12 if lod==0 else 8 if lod==1 else 6
        self.root=self.node('root');self.body=self.node('body',self.root,[0,0,0]);self.head=None
        self.legs=[];self.tail=[];self.wings=[];self.cheeks=[]
        getattr(self,'build_'+species)()
        self.make_clips()
    def node(self,name,parent=None,at=None):
        at=list(at or [0,0,0]);index=len(self.nodes)
        self.nodes.append({'name':name,'translation':[float(n) for n in at]});self.defpos[name]=np.asarray(at,float)
        if parent is not None:self.nodes[parent].setdefault('children',[]).append(index)
        return index
    def add(self,node,material,geom):
        self.meshes[node][self.mat[material]].append(geom)
    def ell(self,node,mat,pos,scale,quality=1):
        return self.add(node,mat,sphere(pos,scale,max(5,int(quality*(7 if self.lod==0 else 5))),max(8,int(quality*self.c))))
    def path(self,node,mat,pts,rr,side=1):
        return self.add(node,mat,tube(pts,rr,max(6,int(self.seg*side))))
    def bodyloft(self,rings,pattern):
        palette=(self.p['coat'],self.p['coat2'],self.p['cream'])
        self.add(self.body,'coat_vertex',loft(rings,max(10,self.c+8),palette,pattern))
    def berry_eye(self,node,xyz,r=.035):
        x,y,z=xyz
        self.ell(node,'cream',(x+.004,y+.011,z*.98),(r*1.28,r*1.12,r*.35))
        self.ell(node,'eye',(x+.006,y+.011,z*1.065),(r*.78,r*.79,r*.28))
        self.ell(node,'glint',(x+.012,y+.025,z*1.1),(r*.24,r*.22,r*.14))
    def make_quad_leg(self,index,hip,upper,lower,thick=1,mat='coat',claws=True,grip=False):
        x,y,z=hip
        hipnode=self.node(f'leg{index}_hip',self.body,[x,y,z])
        kneenode=self.node(f'leg{index}_knee',hipnode,[upper[0],upper[1],0])
        ankle=self.node(f'leg{index}_foot',kneenode,[lower[0],lower[1],0])
        self.legs.append((hipnode,kneenode,ankle))
        uv=max(.07,.10*thick)
        self.path(hipnode,mat,[(0,.055,0),(-.025,-.07,0),(upper[0]*.7,upper[1]*.72,0),(upper[0],upper[1],0)],
                    [uv*1.6,uv*1.65,uv*.98,uv*.66])
        self.path(kneenode,mat,[(0,.03,0),(.03,-.065,0),(lower[0]*.7,lower[1]*.76,0),(lower[0],lower[1],0)],
                    [uv*.92,uv*.95,uv*.66,uv*.45])
        self.ell(ankle,mat,(.045,-.018,0),(.105*thick,.046*thick,.08*thick))
        if claws:
            for j in range(3 if grip else 4):
                zz=(j-(1 if grip else 1.5))*(.035 if grip else .03)*thick
                self.path(ankle,'claw',[(.085,-.008,zz),(.128,-.020,zz*1.2),(.14,-.040,zz*1.2)],
                          [.019*thick,.013*thick,.002])
        return hipnode,kneenode,ankle
    def add_tail(self,base,points,radii,nodes=3,materials=None):
        # Split contiguous long tail over movable joints, curved to preserve species silhouette.
        parent=self.body; pos=np.asarray(base,float)
        for i in range(nodes):
            p=self.node(f'tail{i}',parent,list(pos));self.tail.append(p)
            subpts=np.asarray(points[i],float)
            self.path(p,(materials[i] if materials else 'coat2'),subpts,radii[i],.87)
            parent=p
            pos=np.asarray(subpts[-1])
    def build_sevilho(self):
        self.bodyloft([(-.43,.36,.07,.09),(-.36,.37,.20,.18),(-.20,.37,.23,.20),(.03,.35,.22,.18),(.22,.36,.17,.15),(.37,.37,.09,.11),(.40,.39,.015,.025)],'bars')
        # Continuous cheek/neck silhouette through overlapping organic forms.
        self.ell(self.body,'cream',(.10,.225,0),(.31,.083,.13))
        for side in (-1,1):
            self.ell(self.body,'coat2',(-.29,.28,side*.145),(.17,.17,.11))
        self.head=self.node('head',self.body,[.315,.44,0])
        self.ell(self.head,'coat',(.075,.04,0),(.185,.136,.135))
        self.path(self.head,'coat',[(.14,.065,0),(.23,.01,0),(.34,-.035,0)], [.115,.075,.026])
        self.ell(self.head,'dark',(.336,-.029,0),(.035,.025,.046))
        for side in (-1,1):
            pouch=self.node('cheek'+str(len(self.cheeks)),self.head,[0,0,0]);self.cheeks.append(pouch)
            self.ell(pouch,'cream',(.13,-.071,side*.105),(.078,.054,.038))
            # large rounded upright ear, hollow inner shell and visible canal
            self.ell(self.head,'coat2',(-.005,.175,side*.12),(.071,.132,.055))
            self.ell(self.head,'pink',(.008,.183,side*.153),(.043,.098,.020))
            self.berry_eye(self.head,(.148,.096,side*.132),.044)
            # whiskers: few true 3D filaments, not textures
            if self.lod<2:
                for k in range(3):
                    self.path(self.head,'cream',[(.245,-.027,side*.055),(.31,-.027+(k-1)*.024,side*.175),(.355,-.015+(k-1)*.04,side*.26)],[.006,.003,.0008],.55)
        for i,(x,side) in enumerate([(.20,-1),(.20,1),(-.26,-1),(-.26,1)]):
            up=(-.045,-.14) if i<2 else (.085,-.15)
            lower=(.09,-.12) if i<2 else (-.055,-.095)
            self.make_quad_leg(i,(x,.30,side*.13),up,lower,.75 if i<2 else 1.05,grip=False)
        self.add_tail((-.43,.43,0),
          [[(0,0,0),(-.10,.04,0),(-.23,.12,0)],[ (0,0,0),(-.15,.11,0),(-.33,.17,0)],[(0,0,0),(-.15,.13,0),(-.33,.10,0)]],
          [[.063,.060,.055],[.054,.052,.064],[.061,.100,.021]],materials=['coat','coat2','dark'])
        # Dark flowing brush tuft, tips tapered and asymmetrical.
        if self.lod<2:
            for j in range(12):
                a=(j/12)*TAU
                self.path(self.tail[-1],'dark',[(-.29,.10,0),(-.38,.18,0),(-.43+.06*math.cos(a),.29+.045*math.sin(a),.085*math.sin(a))],[.020,.015,.001],.6)
        if self.lod==0:
            for x in np.arange(-.28,.20,.11):
                self.path(self.body,'coat2',[(x,.566,0),(x-.06,.61,0),(x-.11,.625,0)],[.036,.027,.002],.6)
    def build_arbelio(self):
        self.bodyloft([(-.42,.43,.09,.12),(-.35,.43,.17,.16),(-.16,.43,.18,.175),(.08,.43,.17,.16),(.29,.42,.15,.135),(.39,.43,.08,.095),(.41,.44,.012,.020)],'dots')
        self.ell(self.body,'cream',(.08,.342,0),(.28,.045,.095))
        self.head=self.node('head',self.body,[.36,.49,0])
        self.ell(self.head,'coat',(.06,.05,0),(.14,.112,.122))
        self.path(self.head,'coat',[(.11,.04,0),(.215,-.006,0),(.255,-.02,0)],[.091,.066,.038])
        self.ell(self.head,'dark',(.26,-.018,0),(.027,.020,.04))
        for side in (-1,1):
            self.ell(self.head,'cream',(.12,-.063,side*.095),(.068,.040,.032))
            self.ell(self.head,'coat2',(.00,.17,side*.085),(.053,.08,.04))
            self.ell(self.head,'pink',(.005,.17,side*.11),(.034,.056,.012))
            self.berry_eye(self.head,(.125,.072,side*.123),.045)
        for i,(x,side) in enumerate([(.25,-1),(.25,1),(-.28,-1),(-.28,1)]):
            up=(.08,-.17) if i<2 else (.06,-.18)
            lower=(.14,-.10) if i<2 else (-.055,-.105)
            self.make_quad_leg(i,(x,.33,side*.145),up,lower,.88 if i<2 else 1.04,grip=True)
        # Prehensile curved ringed tail with a flowing terminal brush and movable sections.
        self.add_tail((-.405,.49,0),
          [[(0,0,0),(-.17,.03,0),(-.35,.11,0)],[(0,0,0),(-.17,.20,0),(-.30,.40,0)],[(0,0,0),(-.03,.22,0),(.13,.38,0),(.30,.36,0)]],
          [[.08,.09,.10],[.10,.125,.145],[.145,.205,.20,.07]],materials=['coat2','coat','coat2'])
        for index,node in enumerate(self.tail):
            segments=[[( -.08,.05,0),(-.12,.085,0)], [(-.09,.08,0),(-.14,.14,0)], [(-.10,.13,0),(-.15,.21,0)]]
            aa,bb=segments[index]
            self.path(node,'dark',[aa,bb],[.105 if index>0 else .076,.106 if index>0 else .081],.7)
        # Separate, broad, tapered hairs form the tip brush.
        if self.lod<2:
            for q in range(14):
                az=TAU*q/14
                self.path(self.tail[-1],'coat2',[(.10,.34,0),(.23+.09*math.cos(az),.40,.085*math.sin(az)),(.36+.07*math.cos(az),.42+.06*math.sin(az),.11*math.sin(az))],[.033,.028,.002],.65)
        if self.lod==0:
            for k in range(4):
                x=-.25+k*.11
                self.path(self.body,'coat2',[(x,.59,0),(x-.04,.64,0),(x-.07,.685,0)],[.043,.034,.003],.8)
        # fur patches on the hips read as coat pattern, not thick independent spheres.
        for side in (-1,1):
            for x in (-.27,-.08,.13):
                self.ell(self.body,'mark',(x,.48,side*.173),(.038,.022,.010),.85)
    def build_frutavil(self):
        # Bird morphology: upright chest, tapered rump, neck, wing joints, fan tail.
        self.bodyloft([(-.34,.49,.07,.08),(-.27,.48,.19,.17),(-.08,.50,.245,.215),(.115,.54,.23,.195),(.27,.58,.17,.14),(.37,.62,.07,.08),(.39,.63,.015,.025)],'bars')
        self.ell(self.body,'cream',(.21,.485,0),(.15,.105,.128))
        neck=self.node('neck',self.body,[.20,.68,0])
        self.path(neck,'coat',[(0,-.09,0),(.03,.08,0),(.04,.22,0),(.03,.35,0)],[.145,.146,.105,.077])
        self.path(neck,'cream',[(.08,-.05,0),(.11,.10,0),(.10,.24,0)],[.075,.071,.045])
        self.head=self.node('head',neck,[.03,.35,0])
        self.ell(self.head,'coat2',(.045,.04,0),(.137,.13,.12))
        # Heavy hooked seed-cracking beak, upper keratin and mandibular blade.
        self.path(self.head,'claw',[(.125,.04,0),(.24,.013,0),(.29,-.023,0),(.263,-.10,0)], [.078,.070,.040,.012])
        self.ell(self.head,'dark',(.218,-.086,0),(.092,.033,.056))
        for side in (-1,1):
            self.berry_eye(self.head,(.099,.095,side*.114),.044)
        if self.lod<2:
            for k in range(13):
                az=(k-6)/6
                self.add(self.head,'coat2' if k%3==0 else 'coat',feather((-.015,.105,(k-6)*.009),(-.16-.13*math.cos(az*1.25),.22+.11*math.sin((k+1)*.45),.048*az),.045,.028,7,3))
        # Layered folded wings in resting pose, flapping from real rotating wing roots.
        for side in (-1,1):
            wing=self.node('wing_left' if side>0 else 'wing_right',self.body,[.06,.60,side*.165]);self.wings.append((wing,side))
            self.ell(wing,'steel',(-.06,.014,side*.035),(.255,.095,.11))
            count=21 if self.lod==0 else 12 if self.lod==1 else 7
            for j in range(count):
                t=j/max(1,count-1)
                origin=(.10-.24*t,.075-.035*t,side*(.05+.025*t))
                end=(-.44-.16*t,-.11-.11*math.sin(t*math.pi),side*(.13+.045*t))
                self.add(wing,'mark' if j%5==0 else 'steel' if j%3 else 'cream',
                         feather(origin,np.array(end)-np.array(origin),.042+.022*math.sin(t*math.pi),.026,5 if self.lod==0 else 4))
        # Long layered broad tail feathers grow from rump, fanned out behind.
        tail=self.node('tail0',self.body,[-.33,.52,0]);self.tail.append(tail)
        n=17 if self.lod==0 else 11 if self.lod==1 else 6
        for j in range(n):
            t=(j-(n-1)/2)/max(1,(n-1)/2)
            a=(-.02,0,t*.035)
            b=(-1.08+.12*abs(t),-.12-.10*abs(t),t*.34)
            self.add(tail,'coat2' if j%3==0 else 'cream' if j%3==1 else 'steel',
                     feather(a,np.array(b)-a,.088,.075,10 if self.lod==0 else 6))
        for k,side in enumerate((-1,1)):
            hp=self.node(f'leg{k}_hip',self.body,[-.08,.35,side*.105]);kp=self.node(f'leg{k}_knee',hp,[-.05,-.20,0]);fp=self.node(f'leg{k}_foot',kp,[.075,-.21,0]);self.legs.append((hp,kp,fp))
            self.path(hp,'coat2',[(0,.05,0),(-.035,-.11,0),(-.05,-.20,0)],[.085,.073,.035])
            self.path(kp,'claw',[(0,.025,0),(-.02,-.08,0),(.075,-.21,0)],[.041,.031,.024])
            for digit in range(3):
                z=(digit-1)*.052
                self.path(fp,'claw',[(0,0,0),(.09,-.01,z),(.14,-.027,z*1.25)],[.016,.012,.001])
            self.path(fp,'claw',[(-.015,0,0),(-.09,-.03,0)],[.015,.002])
    def build_cromatil(self):
        # Herbivore reptile: low, broad trunk; distinct scapula/haunch and triangular jaw.
        self.bodyloft([(-.43,.29,.07,.10),(-.33,.30,.19,.22),(-.15,.30,.23,.275),(.05,.29,.235,.28),(.26,.30,.22,.245),(.43,.31,.14,.16),(.49,.32,.04,.07)],'scales')
        self.ell(self.body,'cream',(.03,.16,0),(.38,.065,.22))
        neck=self.node('neck',self.body,[.37,.33,0]);self.path(neck,'coat',[(0,0,0),(.18,.04,0),(.24,.10,0)],[.17,.14,.09])
        self.head=self.node('head',neck,[.22,.085,0])
        self.path(self.head,'coat',[(0,.01,0),(.14,.07,0),(.26,.04,0),(.38,-.015,0)],[.14,.17,.145,.10])
        self.ell(self.head,'cream',(.22,-.075,0),(.20,.055,.125))
        self.ell(self.head,'claw',(.40,-.026,0),(.057,.047,.079))
        for side in (-1,1):
            self.berry_eye(self.head,(.15,.15,side*.139),.045)
            self.ell(self.head,'dark',(.31,.065,side*.085),(.025,.017,.015))
            self.add(self.head,'rust',scute(.10,.202,side*.09,.135,.083,.025))
        for i,(x,side) in enumerate([(.29,-1),(.29,1),(-.30,-1),(-.30,1)]):
            up=(-.07,-.13) if i<2 else (.03,-.13)
            lower=(.13,-.08) if i<2 else (-.01,-.065)
            self.make_quad_leg(i,(x,.255,side*.225),up,lower,.92,claws=True)
        # Dorsal scutes are overlapping scales integrated with dorsal body; LOD aware.
        cols=3 if self.lod==0 else 2 if self.lod==1 else 1
        rows=17 if self.lod==0 else 12 if self.lod==1 else 8
        for i in range(rows):
            x=-.38+i*.77/max(1,rows-1)
            for j in range(cols):
                z=(j-(cols-1)/2)*(.17 if cols>1 else 0)
                y=.30+.235*math.sqrt(max(.25,1-(z/.29)**2))
                self.add(self.body, 'rust' if (i+j)%3==0 else 'coat2',
                         scute(x,y-.016,z,.118 if self.lod==0 else .148,
                               .118 if cols>1 else .24,.055 if self.lod==0 else .035))
        # Serrated muscular tail with segmented animateable sweep and sparse sharp scutes.
        self.add_tail((-.43,.32,0),[
            [(0,0,0),(-.16,.00,0),(-.32,-.02,0)],
            [(0,0,0),(-.18,-.015,0),(-.38,-.035,0)],
            [(0,0,0),(-.15,-.02,0),(-.30,-.04,0)]],
            [[.16,.12,.10],[.10,.078,.065],[.063,.037,.002]],materials=['coat','coat','coat2'])
        if self.lod<2:
            for seg in self.tail:
                for j in range(4):
                    x=-.06-.075*j
                    self.add(seg,'rust',scute(x,.047,0,.060,.064,.029))
        # scale pebble microrelief, limited to near LOD0 for clarity and efficiency.
        if self.lod==0:
            for side in (-1,1):
                for i in range(10):
                    x=-.30+i*.065
                    self.ell(self.body,'coat2',(x,.35,side*.262),(.027,.017,.014),.65)

    def make_clips(self):
        s=self.id
        clips={
          'sevilho':['idle','walk','scurry','hop','forage','store_seed','sniff','alert','flee','rest','death'],
          'arbelio':['idle','walk','climb','leap','grip','forage','balance','alert','flee','rest','death'],
          'frutavil':['idle','walk','hop','perch','peck','eat_fruit','wing_flap','short_flight','alert','rest','death'],
          'cromatil':['idle','walk','scurry','bask','forage','head_tilt','tail_whip','threat','retreat','rest','death']}
        locom={'walk','scurry','flee','climb','short_flight','hop','leap','retreat'}
        for name in clips[s]:
            duration= {'idle':3,'walk':1.2,'scurry':.75,'hop':1,'leap':1.2,'flee':.72,'climb':1.7,'short_flight':1.1,
                'wing_flap':.78,'rest':3.2,'death':2,'perch':2,'alert':1.8,'bask':3.3,'threat':1.4,'retreat':1.35,'forage':2.8,
                'store_seed':2.6,'eat_fruit':2.4,'grip':2.4,'peck':1.15,'tail_whip':1.3}.get(name,2.4)
            times=np.linspace(0,duration,13,dtype=np.float32)
            curves={};phase=np.linspace(0,TAU,13)
            def rot(node,angles,axis=(0,0,1)):
                curves[(node,'rotation')]=[quat(axis,float(v)) for v in angles]
            def trs(node,ys):
                base=self.defpos[self.nodes[node]['name']]
                curves[(node,'translation')]=[[float(base[0]),float(base[1]+a),float(base[2])] for a in ys]
            trs(self.body,np.zeros(13) if name not in locom else .023*np.sin(phase*2))
            if name=='leap': trs(self.body,.34*np.sin(np.pi*np.linspace(0,1,13)))
            if name=='hop': trs(self.body,.085*np.maximum(0,np.sin(phase*2)))
            for pouch in self.cheeks:
                if name=='store_seed':
                    swell=1.+.35*(.5-.5*np.cos(phase))
                    curves[(pouch,'scale')]=[[float(v),float(v),float(v)] for v in swell]
                else:
                    curves[(pouch,'scale')]=[[1.,1.,1.] for _ in phase]
            br=.015*np.sin(phase)
            if name in ('rest','bask'):br-=.03
            if name=='death':br=-.12*(.5-.5*np.cos(phase/2))
            if name=='climb':br+=.30+.12*np.sin(phase)
            if name=='leap':br+=.12*np.sin(phase)
            if name=='threat':br+=.13*np.sin(phase*.5)
            rot(self.body,br)
            if self.head:
                hd=.06*np.sin(phase)
                if name in ('forage','peck','eat_fruit','store_seed'):hd=-.20-.17*np.sin(phase)
                if name=='bask':hd=.15+.07*np.sin(phase)
                if name=='grip':hd=.14*np.sin(phase)
                if name in ('alert','head_tilt'):hd=.18*np.sin(phase*.5)
                if name=='death':hd=-.53*(.5-.5*np.cos(phase/2))
                rot(self.head,hd)
            for j,(hip,knee,foot) in enumerate(self.legs):
                if name in locom:
                    shift=[0,.5,.5,0][j] if s!='frutavil' else [0,.5][j]
                    stride=.38 if name in ('flee','scurry','leap') else .20
                    a=stride*np.sin(phase+TAU*shift)
                    rot(hip,a)
                    rot(knee,-.30* np.maximum(0,np.sin(phase+TAU*shift)))
                    rot(foot,.16*np.sin(phase+TAU*shift+.7))
                else:
                    a=np.zeros(13)
                    if name in ('forage','peck','store_seed'):a=.07*np.sin(phase)
                    if name=='store_seed' and j<2:a=.25+.12*np.sin(phase*2)
                    if name=='grip':a=.09+.09*np.sin(phase)
                    if name in ('rest','bask'):a=np.full(13,.16)
                    if name=='death':a=.30*(.5-.5*np.cos(phase/2))
                    rot(hip,a);rot(knee,np.zeros(13));rot(foot,np.zeros(13))
            for j,n in enumerate(self.tail):
                a=(.10+.05*j)*np.sin(phase-j*.55)
                if name in ('tail_whip','balance','threat'):a=.4*np.sin(phase*1.5-j*.65)
                if name=='rest':a=.02*np.sin(phase)
                rot(n,a,axis=(0,1,0) if s=='cromatil' else (0,0,1))
            if s=='frutavil':
                for wing,side in self.wings:
                    a=np.zeros(13)
                    if name in ('short_flight','wing_flap'):a=side*(.65+.65*np.sin(phase*2))
                    if name=='alert':a=side*(.16+.08*np.sin(phase))
                    rot(wing,a,axis=(1,0,0))
                if name in ('short_flight','wing_flap'):
                    trs(self.body,.035*np.sin(phase*2)+(.08 if name=='short_flight' else 0))
            self.anims.append((name,times,curves))

    def worldnodes(self):
        parent={}
        for i,n in enumerate(self.nodes):
            for child in n.get('children',[]):parent[child]=i
        world={}
        def at(i):
            if i not in world:
                t=np.array(self.nodes[i].get('translation',[0,0,0]),float)
                world[i]=t+(at(parent[i]) if i in parent else np.zeros(3))
            return world[i]
        return {i:at(i) for i in range(len(self.nodes))}

    def export(self,out):
        data=bytearray();g={'asset':{'version':'2.0','generator':'Wildhaven Small Savanna Fauna v01'},
             'scene':0,'scenes':[{'nodes':[self.root]}], 'nodes':self.nodes,'materials':[],
             'meshes':[],'bufferViews':[],'accessors':[],'animations':[]}
        for name in self.matnames:
            col=self.p.get(name,(1,1,1))
            g['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*(col if name!='coat_vertex' else (1.,1.,1.)),1.], 'metallicFactor':0.,'roughnessFactor':.94},'doubleSided':True})
        def view(raw,target=None):
            while len(data)%4:data.append(0)
            off=len(data);data.extend(raw)
            o={'buffer':0,'byteOffset':off,'byteLength':len(raw)}
            if target is not None:o['target']=target
            g['bufferViews'].append(o)
            return len(g['bufferViews'])-1
        def acc(vals,dtype,typename,target=None,limits=False):
            a=np.asarray(vals,dtype=dtype);idx=view(a.tobytes(),target)
            o={'bufferView':idx,'componentType':5126 if np.dtype(dtype)==np.dtype('<f4') else 5125,
               'count':len(a),'type':typename}
            if limits:
                if a.ndim==1:o.update(min=[float(a.min())],max=[float(a.max())])
                else:o.update(min=a.min(axis=0).astype(float).tolist(),max=a.max(axis=0).astype(float).tolist())
            g['accessors'].append(o);return len(g['accessors'])-1
        totaltri=0
        for node,materials in sorted(self.meshes.items()):
            prim=[]
            for mid,parts in sorted(materials.items()):
                verts,faces,norms,cols=combine(parts)
                attrs={'POSITION':acc(verts,'<f4','VEC3',34962,True), 'NORMAL':acc(norms,'<f4','VEC3',34962)}
                if cols is not None:attrs['COLOR_0']=acc(cols,'<f4','VEC4',34962)
                ia=acc(faces.astype('<u4').reshape(-1),'<u4','SCALAR',34963)
                totaltri+=len(faces)
                prim.append({'attributes':attrs,'indices':ia,'material':mid,'mode':4})
            self.nodes[node]['mesh']=len(g['meshes']);g['meshes'].append({'name':self.nodes[node]['name']+'_geometry','primitives':prim})
        for name,times,curves in self.anims:
            idx=acc(times,'<f4','SCALAR',limits=True)
            anim={'name':name,'samplers':[],'channels':[]}
            for (node,path),values in curves.items():
                typ='VEC4' if path=='rotation' else 'VEC3'
                val=acc(np.asarray(values,dtype='<f4'),'<f4',typ)
                sam=len(anim['samplers']);anim['samplers'].append({'input':idx,'output':val,'interpolation':'LINEAR'})
                anim['channels'].append({'sampler':sam,'target':{'node':node,'path':path}})
            g['animations'].append(anim)
        while len(data)%4:data.append(0)
        g['buffers']=[{'byteLength':len(data)}]
        js=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode('utf-8')
        js+=b' '*(-len(js)%4)
        raw=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(data))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(data),b'BIN\x00')+data
        out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(raw)
        return {'path':out.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangleCount':totaltri,'nodes':len(self.nodes),'meshNodes':len(self.meshes),'animationNames':[c[0] for c in self.anims],'animationCount':len(self.anims),'rig':'articulated rigid hierarchical nodes (no skin weights)','lod':self.lod}

    def render(self,path,angle='three_quarter'):
        import vtk
        p=self.p
        renderer=vtk.vtkRenderer();renderer.SetBackground(.94,.94,.90);renderer.SetBackground2(.71,.79,.80);renderer.GradientBackgroundOn()
        world=self.worldnodes()
        for node,materials in self.meshes.items():
            for mid,parts in materials.items():
                v,f,n,c=combine(parts);v=v+world[node][None,:]
                points=vtk.vtkPoints();points.SetDataTypeToFloat()
                for xyz in v:points.InsertNextPoint(float(xyz[0]),float(xyz[1]),float(xyz[2]))
                polys=vtk.vtkCellArray()
                for a,b,d in f:
                    tri=vtk.vtkTriangle();tri.GetPointIds().SetId(0,int(a));tri.GetPointIds().SetId(1,int(b));tri.GetPointIds().SetId(2,int(d));polys.InsertNextCell(tri)
                poly=vtk.vtkPolyData();poly.SetPoints(points);poly.SetPolys(polys)
                if c is not None:
                    arr=vtk.vtkUnsignedCharArray();arr.SetName('color');arr.SetNumberOfComponents(4)
                    for rgb in c:arr.InsertNextTuple([int(max(0,min(255,round(x*255)))) for x in rgb])
                    poly.GetPointData().SetScalars(arr)
                vnorm=vtk.vtkPolyDataNormals();vnorm.SetInputData(poly);vnorm.ConsistencyOn();vnorm.SplittingOff();vnorm.Update()
                mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(vnorm.GetOutputPort())
                mapper.SetScalarVisibility(c is not None)
                if c is not None:mapper.SetColorModeToDirectScalars()
                actor=vtk.vtkActor();actor.SetMapper(mapper)
                if c is None:actor.GetProperty().SetColor(*p[self.matnames[mid]])
                actor.GetProperty().SetAmbient(.25);actor.GetProperty().SetDiffuse(.75);actor.GetProperty().SetSpecular(.10)
                actor.GetProperty().SetSpecularPower(20.)
                renderer.AddActor(actor)
        floor=vtk.vtkPlaneSource();floor.SetOrigin(-10,-.07,-10);floor.SetPoint1(10,-.07,-10);floor.SetPoint2(-10,-.07,10)
        floor.Update();mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(floor.GetOutputPort())
        actor=vtk.vtkActor();actor.SetMapper(mapper);actor.GetProperty().SetColor(.74,.69,.54);actor.GetProperty().SetAmbient(.43)
        renderer.AddActor(actor)
        lamp=vtk.vtkLight();lamp.SetPosition(3,6,4);lamp.SetFocalPoint(0,.4,0);lamp.SetIntensity(1.0);renderer.AddLight(lamp)
        win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(1180,840);win.AddRenderer(renderer)
        allp=np.concatenate([np.concatenate([combine(parts)[0]+world[node][None,:] for parts in mats.values()]) for node,mats in self.meshes.items()])
        low=allp.min(axis=0);high=allp.max(axis=0)
        center=(low+high)/2
        center[1]=max(center[1],.30)
        extent=max(high[0]-low[0],high[1]-low[1],(high[2]-low[2])*1.5)
        c=renderer.GetActiveCamera();target=tuple(map(float,center))
        if angle=='side':c.SetPosition(target[0],target[1]+.62,8)
        elif angle=='front':c.SetPosition(target[0]+8,target[1]+.58,target[2]+.01)
        else:c.SetPosition(target[0]+4,target[1]+1.9,target[2]+6.5)
        c.SetFocalPoint(*target);c.SetViewUp(0,1,0);c.ParallelProjectionOn()
        c.SetParallelScale(max(.84,extent*.44))
        renderer.ResetCameraClippingRange();win.Render()
        filt=vtk.vtkWindowToImageFilter();filt.SetInput(win);filt.ReadFrontBufferOff();filt.Update()
        writer=vtk.vtkPNGWriter();writer.SetFileName(str(path));writer.SetInputConnection(filt.GetOutputPort());writer.Write();win.Finalize()


def main():
    par=argparse.ArgumentParser();par.add_argument('--id',choices=list(PALETTES));par.add_argument('--render',action='store_true');par.add_argument('--lod',type=int,choices=[0,1,2]);par.add_argument('--root',type=Path,default=HERE);a=par.parse_args()
    root=a.root
    for id in ([a.id] if a.id else list(PALETTES)):
        manifest={'id':id,'version':'v01','status':'asset_for_art_review','gameplayIntegrated':False,'LODs':[]}
        for lod in ([a.lod] if a.lod is not None else [0,1,2]):
            fig=Figure(id,lod);path=root/'models'/id/f'{id}-savanna-animated-v01-LOD{lod}.glb'
            info=fig.export(path);manifest['LODs'].append(info)
            print(id,'LOD'+str(lod),info['triangleCount'],'triangles',info['animationCount'],'animations',flush=True)
            if a.render and lod==0:
                for angle in ['side','three_quarter','front']:
                    output=root/'previews'/f'{id}-real-3d-{angle}-v01.png'
                    fig.render(output,angle)
        (root/'models'/id/f'{id}-manifest-v01.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
if __name__=='__main__':main()