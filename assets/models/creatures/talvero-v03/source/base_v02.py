#!/usr/bin/env python3
"""Wildhaven savanna v02 — organic skinned models, 3D renders and animation.
Original stylized anatomy, no external textures or copied models.
"""
from __future__ import annotations
import json, math, hashlib, struct, argparse
from dataclasses import dataclass
from pathlib import Path
import numpy as np
from skimage.measure import marching_cubes

OUT=Path(__file__).resolve().parents[0]/'output'
TAU=math.tau

@dataclass
class Spec:
    id:str; name:str; L:float; y:float; w:float; h:float; leg:float; neck:float
    base:tuple; dark:tuple; cream:tuple; pattern:tuple; role:str

SPEC={
 'talvero':Spec('talvero','Talvero',2.55,1.54,.42,.43,1.33,.62,(.50,.24,.11),(.17,.105,.065),(.86,.71,.49),(.73,.51,.30),'runner'),
 'rambrel':Spec('rambrel','Rambrél',2.24,1.63,.36,.35,1.46,1.13,(.57,.31,.14),(.25,.13,.075),(.86,.69,.43),(.79,.58,.33),'browser'),
 'rambrel_chapadas':Spec('rambrel_chapadas','Rambrél-das-Chapadas',3.48,2.29,.53,.53,2.02,1.76,(.46,.23,.105),(.19,.105,.064),(.73,.57,.37),(.74,.46,.22),'giant'),
 'turvagal':Spec('turvagal','Turvagal',2.90,1.16,.65,.58,.80,.23,(.30,.34,.19),(.17,.215,.115),(.63,.59,.43),(.48,.46,.31),'wetland'),
}
CLIPS={
 'talvero':['idle','walk','trot','gallop','graze','alert','flee','kick','rest','death'],
 'rambrel':['idle','walk','trot','run','browse','chew','alert','headbutt','defend','rest','death'],
 'rambrel_chapadas':['idle','walk','trot','charge','browse','chew','alert','headbutt','defend','rest','death'],
 'turvagal':['idle','walk','trot','graze','drink','wade','swim','emerge','threat','rest','death'],
}

class Creature:
 def __init__(self,s):
    self.s=s;self.parts=[];self.bones=[];self.bone_ids={};self.skin_data=None
    self.make_rig();self.make_body();self.add_details()
 def bone(self,name,xyz,parent=None):
    idx=len(self.bones); p=np.array(xyz,float)
    self.bones.append(dict(name=name,world=p,parent=parent));self.bone_ids[name]=idx;return idx
 def make_rig(self):
    s=self.s;L=s.L
    self.root=self.bone('root',(0,0,0));self.legs=[]
    for front in (True,False):
      for side in (-1,1):
       x=(.30 if front else -.35)*L
       z=side*s.w*.82
       hip=np.array((x,s.leg+.12,z))
       # hips and knees are deliberately not a perfectly straight column.
       if s.role=='runner': knee=np.array((x+(.10 if front else .27),s.leg*.56,z*1.06))
       elif s.role=='wetland':knee=np.array((x+(.04 if front else -.07),s.leg*.48,z*1.03))
       else: knee=np.array((x+(.07 if front else .17),s.leg*.56,z*1.02))
       ankle=np.array((x+(.13 if front else .04),.16*s.leg,z))
       label=('fore' if front else 'hind')+('_L' if side<0 else '_R')
       u=self.bone(label+'_upper',hip,self.root)
       k=self.bone(label+'_lower',knee,u)
       a=self.bone(label+'_fetlock',ankle,k)
       self.legs.append(dict(label=label,front=front,side=side,hip=hip,knee=knee,ankle=ankle,upper=u,lower=k,fetlock=a))
    neckbase=np.array((.34*L,s.y+.12,0))
    neckend=np.array((.51*L + (.30 if s.role=='wetland' else .20),s.y+s.neck,0))
    self.neckbase=neckbase;self.neckend=neckend
    self.neckidx=self.bone('neck',neckbase,self.root)
    self.headidx=self.bone('head',neckend,self.neckidx)
    self.jawidx=self.bone('jaw',neckend+np.array((.20,-.13,0)),self.headidx)
    self.tailbase=np.array((-.48*L,s.y+.11,0))
    self.tailidx=self.bone('tail',self.tailbase,self.root)

 def sd_ellipsoid(self,X,Y,Z,center,r):
    a=(X-center[0])/r[0];b=(Y-center[1])/r[1];c=(Z-center[2])/r[2]
    return (np.sqrt(a*a+b*b+c*c)-1.)*min(r)
 def sd_segment(self,X,Y,Z,a,b,ra,rb):
    vx=b[0]-a[0];vy=b[1]-a[1];vz=b[2]-a[2]
    t=np.clip(((X-a[0])*vx+(Y-a[1])*vy+(Z-a[2])*vz)/(vx*vx+vy*vy+vz*vz),0,1)
    rx=X-(a[0]+t*vx);ry=Y-(a[1]+t*vy);rz=Z-(a[2]+t*vz)
    return np.sqrt(rx*rx+ry*ry+rz*rz)-(ra+(rb-ra)*t)
 def smooth(self,old,new,k=.14):
    if old is None: return new
    delta=np.maximum(k-np.abs(old-new),0)
    return np.minimum(old,new)-delta*delta/(4*k)
 def make_body(self):
    s=self.s;L=s.L
    # Voxel size scales with the animal, so giant models do not become absurdly expensive.
    step=max(.025,L/115)
    xmin=-.72*L;xmax=.64*L+.90
    ymin=-.12;ymax=s.y+s.neck+.82
    zmax=s.w+ .44
    axes=[np.arange(xmin,xmax+step,step,dtype=np.float32),
          np.arange(ymin,ymax+step,step,dtype=np.float32),
          np.arange(-zmax,zmax+step,step,dtype=np.float32)]
    X=axes[0][:,None,None];Y=axes[1][None,:,None];Z=axes[2][None,None,:]
    fields=[]
    def ell(c,r,k=.15):
       fields.append(('ell',np.array(c),np.array(r),k))
    def seg(a,b,ra,rb,k=.12):
       fields.append(('seg',np.array(a),np.array(b),ra,rb,k))
    # A ribcage, croup, shoulder and abdomen are united as ONE continuous skin.
    ell((-.10*L,s.y,0),(.46*L,s.h,s.w),.29)
    ell((-.34*L,s.y+.05,0),(.25*L,s.h*.92,s.w*.95),.27)
    ell((.27*L,s.y+.06,0),(.27*L,s.h*1.05,s.w*.96),.25)
    ell((-.065*L,s.y-.27*s.h,0),(.36*L,s.h*.66,s.w*.84),.2)
    # Pectoral muscles and rump flank, connected into the torso.
    for x in (.30*L,-.34*L):
       for z in (-s.w*.56,s.w*.56):
          ell((x,s.y-.23*s.h,z),(.23*L,.60*s.h,.52*s.w),.19)
    # Solid, tapering cervicals and anatomy-specific neck musculature.
    base=self.neckbase;end=self.neckend
    if s.role=='wetland':
       seg(base+[-.18,-.12,0],end+[0,-.11,0],.42,.29,.17)
    else:
       seg(base+[-.20,-.15,0],base+[.07,.23,0],.37 if s.role!='giant' else .51,.27 if s.role!='giant' else .40,.26)
       seg(base+[.07,.23,0],end+[-.13,-.17,0],.27 if s.role!='giant' else .40,.18 if s.role!='giant' else .30,.20)
       seg(base+[.04,-.11,0],end+[-.03,-.14,0],.22 if s.role!='giant' else .34,.16 if s.role!='giant' else .25,.16)
    # Distinct cranium, jaw planes and long muzzle with believable nasal taper.
    hs=.93 if s.role=='wetland' else 1.
    ell(end+[.10,.015,0],((.38 if s.role=='giant' else .29)*hs,.218*hs,(.21 if s.role=='wetland' else .18)*hs),.115)
    muzzle=(.56 if s.role=='wetland' else (.74 if s.role=='giant' else .66))
    seg(end+[.19,-.09,0],end+[muzzle,-.15,0],.135*hs,.10*hs,.06)
    ell(end+[muzzle,-.15,0],(.15 if s.role=='wetland' else .095,.10*hs,.18*hs if s.role=='wetland' else .115*hs),.05)
    ell(end+[.29,-.16,0],(.26,.075,.135),.05)
    # Four anatomical legs with musculature, cannon, heel and fetlock merging into upper surfaces.
    for leg in self.legs:
       h=leg['hip'];k=leg['knee'];a=leg['ankle']
       if s.role=='wetland': upper=.285;lower=.15;foot=.18
       elif s.role=='giant': upper=.26;lower=.135;foot=.13
       elif s.role=='runner': upper=.205;lower=.085;foot=.11
       else:upper=.16;lower=.075;foot=.095
       ell(h+np.array((0,.10,0)),(upper*1.18,upper*1.80,upper*1.12),.19)
       seg(h,k,upper,lower*1.25,.16)
       ell(k,(lower*1.17,lower*1.38,lower*1.14),.10)
       seg(k,a,lower,foot*.69,.09)
       ell(a+np.array((.06,-.04,0)),(foot,.065*s.leg+ .02,foot*.82),.07)
    sdf=None
    for obj in fields:
       if obj[0]=='ell':_,c,r,blend=obj;d=self.sd_ellipsoid(X,Y,Z,c,r)
       else:_,a,b,ra,rb,blend=obj;d=self.sd_segment(X,Y,Z,a,b,ra,rb)
       sdf=self.smooth(sdf,d,blend)
    verts,faces,normals,_=marching_cubes(sdf,level=0,spacing=(step,step,step),allow_degenerate=False)
    verts+=np.array((axes[0][0],axes[1][0],axes[2][0]),np.float32)
    faces=faces.astype(np.uint32)
    # marching_cubes returns normals in grid-frame; respect outward orientation for proper shading.
    normals=np.asarray(normals,np.float32)
    colors=self.vertex_colors(verts)
    joints,weights=self.compute_skin(verts)
    self.skin_data=dict(vertices=verts.astype(np.float32),faces=faces,normals=normals,
                        colors=colors,joints=joints,weights=weights)

 def vertex_colors(self,V):
    s=self.s;x=V[:,0];y=V[:,1];z=V[:,2]
    base=np.array(s.base,np.float32);dark=np.array(s.dark,np.float32)
    cream=np.array(s.cream,np.float32);pattern=np.array(s.pattern,np.float32)
    col=np.tile(base,(len(V),1))
    # Underbelly gradation and pale chin/throat rather than sticker-like spots.
    belly=np.clip((s.y-.18-y)/(.52*s.h),0,1)*.73
    col=col*(1-belly[:,None])+cream*belly[:,None]
    # back sun-bleached hairline and lighter haunches
    toplight=np.clip((y-s.y-.14)/(.58*s.h),0,1)*.11
    col=col+toplight[:,None]*np.array([.22,.14,.07])
    # Unique, asymmetric organic coat markings without overlapping geometry.
    if s.role in ('browser','giant'):
      stripe=np.sin((x+.14*s.L)*18/s.L + 2.1*y + .44*np.sin(4.3*x)+1.4*np.sign(z))
      shoulder=(np.clip((y-s.y)/(.55+s.neck),0,1)+np.exp(-((x+.15*s.L)/(.45*s.L))**2))*0.5
      mask=np.clip((stripe-.18)*2.4,0,1)*np.clip(shoulder,0,1)*.50
      col=col*(1-mask[:,None])+dark*mask[:,None]
    elif s.role=='runner':
      slant=(x+.5*y*.45+.4*z)
      mark=np.sin(slant*10.0+np.sin(2.0*x)*.8)
      region=np.exp(-((x+.18*s.L)/(.55*s.L))**4)*np.clip((s.y-y)/(.9*s.h)+.42,0,1)
      mask=np.clip((mark-.37)*2.1,0,1)*region*.57
      col=col*(1-mask[:,None])+pattern*mask[:,None]
    else:
      dorsal=np.clip((y-s.y)/(.59*s.h),0,1)*.42
      col=col*(1-dorsal[:,None])+dark*dorsal[:,None]
      b=np.sin(13*x+3*y+4*z)*np.cos(7*y+3*x)
      mottled=np.clip((b-.16)*1.5,0,1)*.20
      col=col*(1-mottled[:,None])+pattern*mottled[:,None]
    # Foot darkening is limited to the true bottom of each leg.
    hoof=np.clip((.22*s.leg-y)/(.16*s.leg),0,1)
    col=col*(1-hoof[:,None]*.80)+dark*hoof[:,None]*.80
    # Subtle seeded freckle field avoids a toy's perfectly flat color.
    noise=np.sin(22.31*x+8.6*z)*np.sin(19.4*y-4.3*z)
    col=np.clip(col*(1+noise[:,None]*.052),0,1)
    return np.rint(col*255).astype(np.uint8)

 def compute_skin(self,V):
    s=self.s
    joints=np.zeros((len(V),4),np.uint16)
    weights=np.zeros((len(V),4),np.float32)
    for i,p in enumerate(V):
       vals={self.root:1.0}
       x,y,z=p
       # SDF skinning includes thighs, forelegs, hocks and flesh transitions.
       for leg in self.legs:
          hip=leg['hip'];knee=leg['knee'];dist=((x-hip[0])/.50)**2+((z-hip[2])/(s.w*.8+.07))**2
          influence=np.exp(-dist*.98)*np.clip((hip[1]+.14-y)/(.44 if s.role!='giant' else .66),0,1)
          if influence>.015:
             upper_fraction=np.clip((y-knee[1]+.06)/(.24 if s.role!='giant' else .38),0,1)
             vals[leg['upper']]=max(vals.get(leg['upper'],0),influence*(.34+.66*upper_fraction))
             vals[leg['lower']]=max(vals.get(leg['lower'],0),influence*(1-.74*upper_fraction))
             if y<leg['ankle'][1]+.11:
                 vals[leg['fetlock']]=max(vals.get(leg['fetlock'],0),influence*.70)
       n=self.neckbase;h=self.neckend
       xn=(x-n[0]);yn=(y-n[1])
       align=np.clip(((xn*(h[0]-n[0])+yn*(h[1]-n[1]))/(np.sum((h-n)**2)+1e-6)),0,1)
       neck_dist=np.sqrt((x-n[0]-align*(h[0]-n[0]))**2+(y-n[1]-align*(h[1]-n[1]))**2+z*z)
       ninf=np.exp(-(neck_dist/(.46 if s.role!='giant' else .70))**2)*np.clip(align*2.3+.08,0,1)
       hdist=np.linalg.norm(p-(h+np.array((.20,-.04,0))))
       hinf=np.clip(1.3-hdist/(.40 if s.role!='giant' else .60),0,1)
       if ninf>.01:
          vals[self.neckidx]=max(vals.get(self.neckidx,0),ninf*(1-hinf*.70))
       if hinf>.01:
          vals[self.headidx]=max(vals.get(self.headidx,0),hinf)
       top=sorted(vals.items(),key=lambda x:-x[1])[:4]
       q=np.array([v for _,v in top],float)
       # Root contribution must diminish where the limb or neck skin is strongly influenced.
       if len(top)>1 and top[0][0]==self.root:
          q[0]=max(.05,1-sum(q[1:])*.92)
       q=q/q.sum()
       for j,(joint,_) in enumerate(top):joints[i,j]=joint;weights[i,j]=q[j]
    return joints,weights

 def add_part(self,name,v,f,color,attach):
    # Attach rigid small features to their respective animated joints in local space.
    world=self.bones[attach]['world']
    self.parts.append((name,np.asarray(v,np.float32)-world,np.asarray(f,np.uint32),np.array(color,np.float32),attach))
 def ellmesh(self,center,rad,nu=20,nv=12):
    vertices=[];faces=[]
    for i in range(nv+1):
      t=math.pi*i/nv
      for j in range(nu):
        a=TAU*j/nu
        vertices.append(np.array(center)+np.array([rad[0]*math.cos(t),rad[1]*math.sin(t)*math.cos(a),rad[2]*math.sin(t)*math.sin(a)]))
    for i in range(nv):
      for j in range(nu):
        a=i*nu+j;b=i*nu+(j+1)%nu;c=(i+1)*nu+j;d=(i+1)*nu+(j+1)%nu
        faces.extend(((a,c,b),(b,c,d)))
    return np.asarray(vertices,np.float32),np.asarray(faces,np.uint32)
 def tube(self,points,rads,ns=12):
    vertices=[];faces=[]
    P=np.asarray(points,float)
    for i,p in enumerate(P):
      direction=P[min(i+1,len(P)-1)]-P[max(0,i-1)]
      direction/=np.linalg.norm(direction)+1e-8
      ref=np.array([0.,0.,1.])
      if abs(np.dot(direction,ref))>.95:ref=np.array([0.,1.,0.])
      right=np.cross(direction,ref);right/=np.linalg.norm(right)
      up=np.cross(right,direction)
      for j in range(ns):
        t=TAU*j/ns
        vertices.append(p+rads[i]*(right*math.cos(t)+up*math.sin(t)))
    for i in range(len(P)-1):
      for j in range(ns):
        a=i*ns+j;b=i*ns+(j+1)%ns;c=(i+1)*ns+j;d=(i+1)*ns+(j+1)%ns
        faces.extend(((a,c,b),(b,c,d)))
    return np.asarray(vertices,np.float32),np.asarray(faces,np.uint32)
 def add_details(self):
    s=self.s;h=self.neckend
    for side in (-1,1):
      # Almond-shaped orbit, iris and high specular glint.
      eye=h+np.array((.145,.12,side*.184))
      for name,center,radius,col in [
       ('eyelid',eye,(.066,.055,.028),s.dark),
       ('eyeball',eye+np.array((.014,.004,side*.024)),(.037,.035,.014),(.10,.075,.045)),
       ('eye_glint',eye+np.array((.031,.019,side*.038)),(.012,.010,.006),(.96,.88,.67))]:
         v,f=self.ellmesh(center,radius);self.add_part(name,v,f,col,self.headidx)
      # Long pinnae, supported by real tapered geometry, laid backward.
      ear=[h+np.array((-.16,.13,side*.15)),h+np.array((-.25,.33,side*.29)),h+np.array((-.30,.46,side*.31))]
      v,f=self.tube(ear,[.078,.056,.004]);self.add_part('ear',v,f,s.base,self.headidx)
      # True nose holes on sides of the muzzle.
      nose=h+np.array((.56 if s.role=='wetland' else (.70 if s.role=='giant' else .62),-.13,side*.11))
      v,f=self.ellmesh(nose,(.045,.026,.014));self.add_part('nostril',v,f,s.dark,self.headidx)
      if s.role in ('browser','giant'):
        horn=s.neck*(.24 if s.role=='browser' else .27)
        start=h+np.array((-.04,.19,side*.16))
        v,f=self.tube([start,start+[-.09,horn*.35,side*.02],start+[-.18,horn*.78,side*.03],
                       start+[-.25,horn,side*.01]], [.073 if s.role=='browser' else .102,
                       .062 if s.role=='browser' else .086,.035 if s.role=='browser' else .047,.003],14)
        self.add_part('swept_horn',v,f,(.25,.19,.12),self.headidx)
    if s.role in ('runner','browser','giant'):
       # Hundreds of separate hair vertices form an *organic layered crest*, not a row of cubes.
       N=34 if s.role=='runner' else (30 if s.role=='browser' else 38)
       for i in range(N):
          t=i/(N-1)
          origin=self.neckbase+(self.neckend-self.neckbase)*t
          origin+=np.array((-.10,.20 if s.role=='runner' else .15,0))
          length=.14 + (.10 if s.role=='runner' else .15)*math.sin(t*math.pi)
          origin=origin+np.array((-.02,.0,0))
          for side in (-1,1):
             offset=origin+np.array((0,0,side*(.10 if s.role!='giant' else .15)))
             v,f=self.tube([offset,offset+[-length*.42,length*.49,side*.025],
                            offset+[-length*.93,length*.93,side*.02]],
                           [.061 if s.role!='giant' else .083,.042 if s.role!='giant' else .058,.002],7)
             self.add_part('neck_mane',v,f,s.dark,self.neckidx)
       # Silhouette tufts along body crest from croup to withers.
       N=25
       for i in range(N):
          t=i/(N-1);x=(-.43+.81*t)*s.L
          y=s.y+s.h*(.86+.11*np.sin(t*math.pi))
          z=(.02 if i%2 else -.02)
          length=.12 if s.role!='giant' else .19
          v,f=self.tube([(x,y,z),(x-length*.55,y+length*.60,z),(x-length,y+length,z)],
                        [.075 if s.role!='giant' else .105,.042 if s.role!='giant' else .066,.002],7)
          self.add_part('dorsal_mane',v,f,s.dark,self.root)
    if s.role=='wetland':
      # Turvagal: small overlapping bony dorsal scutes, offset in staggered rows.
      for k in range(15):
        x=(-.41+.061*k)*s.L
        center_y=s.y+s.h*(.90+.10*math.sin((k/14)*math.pi))
        for side in (-1,0,1):
          z=side*s.w*.52
          y=center_y-(abs(side)*.15)
          c=(x,y,z)
          r=(.17,.065,.20 if side==0 else .16)
          v,f=self.ellmesh(c,r,16,7)
          self.add_part('dorsal_scute',v,f,tuple(np.array(s.dark)*.9+np.array(s.base)*.10),self.root)
    # Long swinging tail with plume, attached to its animated bone.
    t=self.tailbase
    v,f=self.tube([t,t+[-.23,-.11,0],t+[-.42,-.28,0],t+[-.58,-.48,0]],
                 [.10,.083,.057,.02],10)
    self.add_part('tail',v,f,s.base,self.tailidx)
    for side in (-1,1):
       v,f=self.tube([t+[-.47,-.29,side*.015],t+[-.60,-.48,side*.06],t+[-.78,-.55,side*.10]],
                  [.095,.085,.002],9)
       self.add_part('tail_plume',v,f,s.dark,self.tailidx)
    for leg in self.legs:
      a=leg['ankle']
      for side in (-1,1):
        if s.role=='runner' and side==1:continue
        z=a[2]+(.075*side)
        # Split hoof pair for browsers/wetland; single broad hoof for runner.
        hoof=(.16 if s.role!='giant' else .20)
        v,f=self.ellmesh(a+np.array((.09,-.09,z-a[2])),(hoof,.105,.075 if s.role!='giant' else .11))
        self.add_part('keratin_hoof',v,f,s.dark,leg['fetlock'])

 def clips(self):
    result=[]
    s=self.s
    for name in CLIPS[s.id]:
      n=32; times=np.linspace(0,1.,n+1,dtype=np.float32)
      duration={'idle':3.2,'walk':1.55,'trot':1.05,'run':.75,'gallop':.75,'flee':.78,
        'charge':.91,'wade':2.1,'swim':1.6,'graze':3.6,'browse':4.2,'drink':3.5,
        'chew':2.2,'alert':2.2,'threat':1.8,'defend':1.8,'headbutt':1.25,
        'kick':1.45,'emerge':2.4,'rest':3.0,'death':2.6}[name]
      times*=duration
      transforms={}
      for idx,b in enumerate(self.bones):
        bn=b['name']; quats=[];translations=[]
        for ts in times:
          u=float(ts/duration);theta=TAU*u;pitch=0.
          moving=name in ('walk','trot','run','gallop','flee','charge','wade','swim')
          speed={'walk':.25,'trot':.43,'run':.57,'gallop':.63,'flee':.68,'charge':.42,'wade':.17,'swim':.34}.get(name,0)
          if bn=='root':
            pitch=.024*math.sin(theta) if moving else .008*math.sin(theta)
            if name=='death':pitch=-.90*(.5-.5*math.cos(math.pi*u))
            y= -.10*s.y*(.5-.5*math.cos(math.pi*u)) if name=='death' else (.04*math.sin(theta*2) if moving else .012*math.sin(theta))
            translations.append([0.,y,0.])
          elif '_upper' in bn:
            side=bn.endswith('_L');hind=bn.startswith('hind')
            phase=(.5 if (hind ^ side) else 0.)
            if name=='gallop':phase=([.0,.12,.50,.63][['fore_L','fore_R','hind_L','hind_R'].index(bn.removesuffix('_upper'))])
            pitch=speed*math.sin(theta+TAU*phase) if moving else 0
            if name in ('rest','death'):pitch=.42*(.5-.5*math.cos(math.pi*u))
            if name=='kick' and hind:pitch=-.72*math.sin(math.pi*u)
          elif '_lower' in bn:
            side=bn.endswith('_L');hind=bn.startswith('hind'); phase=(.5 if (hind ^ side) else 0.)
            pitch=(.16+ .39*max(0,math.sin(theta+TAU*phase))) if moving else 0
            if name in ('rest','death'):pitch=-.46*(.5-.5*math.cos(math.pi*u))
            if name=='kick' and hind:pitch=.52*math.sin(math.pi*u)
          elif '_fetlock' in bn:
            pitch=-.11*math.sin(theta) if moving else 0
          elif bn=='neck':
            if name in ('graze','drink'):pitch=-.68*(.5-.5*math.cos(math.pi*min(1,u*2)))
            elif name=='browse':pitch=.26+.09*math.sin(theta)
            elif name=='alert':pitch=.20*math.sin(theta*.5)
            elif name in ('headbutt','threat','defend'):pitch=-.38*math.sin(math.pi*u)
            elif name=='death':pitch=-.32*u
            elif name=='chew':pitch=.025*math.sin(theta)
          elif bn=='head':
            if name=='browse':pitch=.14*math.sin(theta)
            elif name in ('headbutt','threat'):pitch=-.35*math.sin(math.pi*u)
            elif name=='chew':pitch=.06*math.sin(theta*2)
            elif name=='alert':pitch=.09*math.sin(theta)
          elif bn=='jaw':
            if name in ('chew','browse','graze','drink'):pitch=.09*(.5+.5*math.sin(theta*3))
          elif bn=='tail':pitch=.14*math.sin(theta-.2)
          q=(0.,0.,math.sin(pitch/2),math.cos(pitch/2))
          quats.append(q)
        transforms[idx]=np.asarray(quats,np.float32)
        if translations:transforms[str(idx)+'_translation']=np.asarray(translations,np.float32)
      result.append((name,times,transforms))
    return result

 def glb(self,path):
    s=self.s;path.parent.mkdir(parents=True,exist_ok=True)
    doc={'asset':{'version':'2.0','generator':'Wildhaven sculpted fauna v02'},'scene':0,'scenes':[{'nodes':[]}],
         'nodes':[],'skins':[],'meshes':[],'materials':[],'buffers':[],
         'bufferViews':[],'accessors':[],'animations':[]}
    binary=bytearray()
    def accessor(data,ctype,typ,target=None,bounds=False):
       a=np.asarray(data)
       while len(binary)%4:binary.append(0)
       offset=len(binary); binary.extend(a.tobytes());length=len(binary)-offset
       bv={'buffer':0,'byteOffset':offset,'byteLength':length}
       if target:bv['target']=target
       vi=len(doc['bufferViews']);doc['bufferViews'].append(bv)
       info={'bufferView':vi,'componentType':ctype,'count':int(len(a)),'type':typ}
       if bounds:
           info['min']=np.min(a,axis=0).reshape(-1).tolist()
           info['max']=np.max(a,axis=0).reshape(-1).tolist()
       ai=len(doc['accessors']);doc['accessors'].append(info);return ai
    def mat(name,col,vertex=False):
       doc['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*([1.,1.,1.] if vertex else [float(x) for x in col]),1.],
             'metallicFactor':0.,'roughnessFactor':.92},'doubleSided':True})
       return len(doc['materials'])-1
    skinmat=mat('procedural_vertex_fur',(.9,.7,.4),True)
    colors={}
    def othermat(col):
       key=tuple(np.round(col,4))
       if key not in colors:colors[key]=mat('anatomical_detail',key)
       return colors[key]
    for idx,b in enumerate(self.bones):
       par=b['parent'];xyz=b['world']-(self.bones[par]['world'] if par is not None else np.zeros(3))
       doc['nodes'].append({'name':b['name'],'translation':xyz.tolist()})
       if par is not None:doc['nodes'][par].setdefault('children',[]).append(idx)
    doc['scenes'][0]['nodes'].append(self.root)
    inv=[]
    for b in self.bones:
       m=np.eye(4,dtype=np.float32);m[:3,3]=-b['world']
       inv.append(m.T.reshape(-1))
    inv_acc=accessor(np.array(inv,dtype='<f4'),5126,'MAT4')
    doc['skins'].append({'joints':list(range(len(self.bones))),'inverseBindMatrices':inv_acc,'skeleton':self.root})
    body=self.skin_data
    def mesh(v,f,normal=None,col=None,joints=None,weights=None,material=0):
       inds=accessor(np.asarray(f.reshape(-1),dtype='<u4'),5125,'SCALAR',34963)
       pos=accessor(np.asarray(v,dtype='<f4'),5126,'VEC3',34962,True)
       attrs={'POSITION':pos}
       if normal is not None:attrs['NORMAL']=accessor(np.asarray(normal,dtype='<f4'),5126,'VEC3',34962)
       if col is not None:
          ca=accessor(np.asarray(col,dtype=np.uint8),5121,'VEC3',34962)
          doc['accessors'][ca]['normalized']=True
          attrs['COLOR_0']=ca
       if joints is not None:
         attrs['JOINTS_0']=accessor(np.asarray(joints,dtype='<u2'),5123,'VEC4',34962)
         attrs['WEIGHTS_0']=accessor(np.asarray(weights,dtype='<f4'),5126,'VEC4',34962)
       doc['meshes'].append({'primitives':[{'attributes':attrs,'indices':inds,'material':material,'mode':4}]})
       return len(doc['meshes'])-1
    # marching_cubes normals are estimated in scalar-grid convention. recompute via faces.
    v=body['vertices'];f=body['faces']
    fn=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
    n=np.zeros_like(v)
    for j in range(3):np.add.at(n,f[:,j],fn)
    n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
    bodymesh=mesh(v,f,n,body['colors'],body['joints'],body['weights'],skinmat)
    bodynode=len(doc['nodes']);doc['nodes'].append({'name':'continuous_organic_skinned_body','mesh':bodymesh,'skin':0})
    doc['scenes'][0]['nodes'].append(bodynode)
    for name,verts,faces,col,parent in self.parts:
       mid=othermat(col)
       mi=mesh(verts,faces,material=mid)
       node=len(doc['nodes']);doc['nodes'].append({'name':name,'mesh':mi})
       doc['nodes'][parent].setdefault('children',[]).append(node)
    for name,times,transforms in self.clips():
       tacc=accessor(times.astype('<f4'),5126,'SCALAR',bounds=True)
       a={'name':name,'samplers':[],'channels':[]}
       for idx in range(len(self.bones)):
          qacc=accessor(transforms[idx].astype('<f4'),5126,'VEC4')
          sampler=len(a['samplers'])
          a['samplers'].append({'input':tacc,'output':qacc,'interpolation':'LINEAR'})
          a['channels'].append({'sampler':sampler,'target':{'node':idx,'path':'rotation'}})
          if idx==self.root:
             yacc=accessor(transforms[str(idx)+'_translation'].astype('<f4'),5126,'VEC3')
             sm=len(a['samplers']);a['samplers'].append({'input':tacc,'output':yacc,'interpolation':'LINEAR'})
             a['channels'].append({'sampler':sm,'target':{'node':idx,'path':'translation'}})
       doc['animations'].append(a)
    while len(binary)%4:binary.append(0)
    doc['buffers']=[{'byteLength':len(binary)}]
    chunk=json.dumps(doc,separators=(',',':')).encode('utf-8')
    chunk+=b' '*(-len(chunk)%4)
    raw=struct.pack('<4sII',b'glTF',2,12+8+len(chunk)+8+len(binary))
    raw+=struct.pack('<I4s',len(chunk),b'JSON')+chunk
    raw+=struct.pack('<I4s',len(binary),b'BIN\x00')+binary
    path.write_bytes(raw)
    out={'file':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
         'triangles':int(len(f)+sum(len(p[2]) for p in self.parts)),'bodyVertices':len(v),
         'bodyTriangles':len(f),'bodyConnectedMesh':True,'skinJoints':len(self.bones),
         'skinnedBody':True,'accessors':len(doc['accessors']),'animations':CLIPS[s.id],
         'animationCount':len(CLIPS[s.id]),'clipChannels':{a['name']:len(a['channels']) for a in doc['animations']},
         'physicalIntegration':False,'note':'Skinned mesh with weighted joints; 3D anatomically sculpted body. v02 concept review.'}
    return out

 def render(self,path,angle='three_quarter'):
    import vtk
    from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
    s=self.s
    ren=vtk.vtkRenderer();ren.SetBackground(.70,.79,.82);ren.SetBackground2(.93,.91,.81);ren.GradientBackgroundOn()
    win=vtk.vtkRenderWindow();win.SetSize(1280,960);win.SetOffScreenRendering(1);win.AddRenderer(ren)
    def draw(vertices,faces,colors):
       poly=vtk.vtkPolyData();points=vtk.vtkPoints()
       points.SetData(numpy_to_vtk(np.asarray(vertices,dtype=np.float32),deep=True))
       poly.SetPoints(points)
       arr=np.empty((len(faces),4),np.int64);arr[:,0]=3;arr[:,1:]=faces
       cells=vtk.vtkCellArray();cells.SetCells(len(faces),numpy_to_vtkIdTypeArray(arr.reshape(-1),deep=True));poly.SetPolys(cells)
       colorarr=numpy_to_vtk(np.asarray(colors,dtype=np.uint8),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR)
       colorarr.SetNumberOfComponents(3);poly.GetPointData().SetScalars(colorarr)
       norms=vtk.vtkPolyDataNormals();norms.SetInputData(poly);norms.SplittingOff();norms.ConsistencyOn()
       mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(norms.GetOutputPort());mapper.ScalarVisibilityOn()
       actor=vtk.vtkActor();actor.SetMapper(mapper);actor.GetProperty().SetAmbient(.22);actor.GetProperty().SetDiffuse(.83);actor.GetProperty().SetSpecular(.06)
       ren.AddActor(actor)
    body=self.skin_data
    draw(body['vertices'],body['faces'],body['colors'])
    for name,v,f,col,parent in self.parts:
      world=self.bones[parent]['world']
      draw(v+world,f,np.tile(np.rint(col*255).astype(np.uint8),(len(v),1)))
    plane=vtk.vtkPlaneSource()
    plane.SetOrigin(-8,-.11,-8);plane.SetPoint1(8,-.11,-8);plane.SetPoint2(-8,-.11,8)
    pmap=vtk.vtkPolyDataMapper();pmap.SetInputConnection(plane.GetOutputPort())
    pa=vtk.vtkActor();pa.SetMapper(pmap);pa.GetProperty().SetColor(.59,.52,.38);pa.GetProperty().SetAmbient(.32)
    ren.AddActor(pa)
    key=vtk.vtkLight();key.SetPosition(3,8,8);key.SetFocalPoint(0,1,0);key.SetIntensity(.96);ren.AddLight(key)
    fill=vtk.vtkLight();fill.SetPosition(-6,6,-7);fill.SetFocalPoint(0,1,0);fill.SetIntensity(.43);ren.AddLight(fill)
    cam=ren.GetActiveCamera();height=s.y+s.neck+.5;extent=max(2.6,height,s.L)
    target=(.15,height*.48,0);d=extent*2.6
    if angle=='side':cam.SetPosition(.1,target[1]+d*.15,d)
    elif angle=='front':cam.SetPosition(target[0]+d,target[1]+d*.16,0)
    else:cam.SetPosition(target[0]+d*.68,target[1]+d*.38,d*.82)
    cam.SetFocalPoint(*target);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(extent*.81)
    ren.ResetCameraClippingRange();win.Render()
    filt=vtk.vtkWindowToImageFilter();filt.SetInput(win);filt.ReadFrontBufferOff();filt.Update()
    writer=vtk.vtkPNGWriter();writer.SetFileName(str(path));writer.SetInputConnection(filt.GetOutputPort());writer.Write()
    win.Finalize()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',choices=list(SPEC));parser.add_argument('--render',action='store_true');a=parser.parse_args()
    for key,s in SPEC.items():
       if a.only and a.only!=key:continue
       m=Creature(s);dest=OUT/key;dest.mkdir(parents=True,exist_ok=True)
       info=m.glb(dest/(key+'-savanna-sculpted-skinned-v02.glb'))
       if a.render:
          for angle in ['three_quarter','side','front']:
            m.render(dest/(key+'-real-3d-'+angle+'-v02.png'),angle)
       (dest/(key+'-manifest-v02.json')).write_text(json.dumps({'id':key,'model':info,'source':'assets/models/creatures/savanna-medium-herbivores-v02/source/generate.py'},indent=2,ensure_ascii=False)+'\n')
       print('GENERATED',key,json.dumps(info),flush=True)
if __name__=='__main__':main()