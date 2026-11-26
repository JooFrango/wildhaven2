#!/usr/bin/env python3
"""Wildhaven Talvero v03: independent anatomy rebuild + weighted GLB rig.

Retains only the verified skinned-glTF writer from the previous v02 source;
rebuilds the animal form, coat, anatomical details and hoof construction.
All screenshots are rendered from the actual exported mesh geometry using VTK.
"""
from __future__ import annotations
import json, math, hashlib, sys
from pathlib import Path
import numpy as np
from skimage.measure import marching_cubes
import base_v02 as b

HERE=Path(__file__).resolve().parents[1]
OUT=HERE/'output'
S=b.Spec('talvero','Talvero',2.38,1.46,.415,.405,1.22,.62,
         (.58,.287,.135),(.155,.10,.075),(.86,.72,.53),(.85,.70,.49),'runner')

class Talvero(b.Creature):
 def make_rig(self):
    super().make_rig()
    s=self.s
    # Equine hind hock placement, more purposeful than a vertical hoofed stick.
    for leg in self.legs:
       x=leg['hip'][0]; z=leg['hip'][2]
       if leg['front']:
          leg['knee'][:]=[x-.10,.67,z*1.03]
          leg['ankle'][:]=[x+.08,.185,z*1.04]
       else:
          leg['knee'][:]=[x+.19,.79,z*1.02]
          leg['ankle'][:]=[x-.08,.19,z*1.03]
       self.bones[leg['lower']]['world']=leg['knee']
       self.bones[leg['fetlock']]['world']=leg['ankle']

 def make_body(self):
    s=self.s;L=s.L
    step=.0220
    axes=[np.arange(-.74*L,.73*L+.90+step,step,dtype=np.float32),
          np.arange(-.055,s.y+s.neck+.83+step,step,dtype=np.float32),
          np.arange(-s.w-.40,s.w+.40+step,step,dtype=np.float32)]
    X=axes[0][:,None,None];Y=axes[1][None,:,None];Z=axes[2][None,None,:]
    sdf=None
    def ell(c,r,k=.125):
       nonlocal sdf
       d=self.sd_ellipsoid(X,Y,Z,np.asarray(c),np.asarray(r))
       sdf=self.smooth(sdf,d,k)
    def seg(a,c,ra,rb,k=.10):
       nonlocal sdf
       d=self.sd_segment(X,Y,Z,np.asarray(a),np.asarray(c),ra,rb)
       sdf=self.smooth(sdf,d,k)
    # Three overlapping anatomical volumes form a connected thorax/abdomen/croup.
    ell((-.10*L,s.y+.01,0),(.43*L,.365,s.w*.88),.28)
    ell((-.37*L,s.y-.01,0),(.245*L,.385,s.w*.94),.19)
    ell((.29*L,s.y+.015,0),(.25*L,.43,s.w*.99),.21)
    # A sculpted rib cage and chest brisket, not the rectangular v02 barrel.
    ell((.215*L,s.y-.20,0),(.267*L,.28,.30),.16)
    ell((-.22*L,s.y-.15,0),(.25*L,.29,.30),.13)
    # Shoulder blades and upper limb muscles follow surface volumes, blend organically.
    for side in (-1,1):
       z=side*s.w*.64
       ell((.282*L,s.y-.045,z),(.235,.365,.221),.125)
       ell((.275*L,s.y-.23,side*s.w*.70),(.17,.26,.17),.10)
       ell((-.365*L,s.y+.01,z),(.295,.345,.22),.13)
       ell((-.335*L,s.y-.245,z),(.245,.305,.16),.13)
    # Arching neck has 4 muscular structures rather than a single extruded capsule.
    base=self.neckbase;end=self.neckend
    seg(base+[-.19,-.15,0],base+[.13,.19,0],.355,.29,.19)
    seg(base+[.11,.12,0],end+[-.18,-.08,0],.28,.195,.15)
    seg(base+[.12,-.10,0],end+[-.10,-.15,0],.23,.17,.13)
    seg(base+[-.01,-.09,0],end+[-.12,-.07,0],.155,.125,.08)
    # Cranium has brow, masseter, nasal bridge, cheek and tapering muzzle.
    ell(end+[.085,.050,0],(.315,.235,.198),.125)
    ell(end+[.21,-.048,0],(.242,.160,.165),.096)
    ell(end+[.315,-.01,0],(.235,.132,.140),.075)
    seg(end+[.28,-.064,0],end+[.64,-.153,0],.145,.108,.074)
    ell(end+[.659,-.166,0],(.125,.091,.134),.065)
    ell(end+[.447,-.182,0],(.229,.067,.124),.055)
    for side in (-1,1):
       ell(end+[.188,-.075,side*.130],(.16,.145,.091),.076)
       ell(end+[.021,.154,side*.130],(.15,.064,.092),.039)
    # Anatomical four-leg chain: thigh, shin/cannon, forearm, hock, tendon.
    for leg in self.legs:
       h=leg['hip']; k=leg['knee']; a=leg['ankle'];front=leg['front']
       upper=.190 if front else .251
       lower=.090 if front else .088
       ell(h+([.020,-.064,0] if front else [-.070,.00,0]),
           (.245 if front else .292,.330 if front else .362,.180 if front else .224),.145)
       seg(h,k,upper,lower*1.17,.128)
       ell(k, (.117 if front else .145,.150 if front else .161,.117 if front else .13),.09)
       # Shin follows posterior leg angle, distinct bulbous tendons near hock.
       seg(k,a,lower*.95,.071,.079)
       ell(k*.32+a*.68,(.088,.107,.087),.040)
       ell(a+np.array((.04,-.01,0)),(.106,.091,.103),.07)
       ell(a+np.array((.085,-.055,0)),(.15,.068,.123),.062)
    verts,faces,normals,_=marching_cubes(sdf,level=0,spacing=(step,step,step),allow_degenerate=False)
    verts+=np.array((axes[0][0],axes[1][0],axes[2][0]),np.float32)
    faces=np.asarray(faces,np.uint32)
    cols=self.vertex_colors(verts)
    joints,weights=self.compute_skin(verts)
    self.skin_data=dict(vertices=verts.astype(np.float32),faces=faces,
                        normals=normals.astype(np.float32),colors=cols,joints=joints,weights=weights)

 def vertex_colors(self,V):
    s=self.s;x=V[:,0];y=V[:,1];z=V[:,2]
    coat=np.array(s.base,np.float32);black=np.array(s.dark,np.float32)
    cream=np.array(s.cream,np.float32)
    col=np.broadcast_to(coat,(len(V),3)).copy()
    # Broad cream abdominal field and narrow neck throat with soft pigments.
    u=np.clip((s.y-.08-y)/.60,0,1)
    xfield=np.exp(-((x+.09*s.L)/(.44*s.L))**8)
    color_strength=.80*u*xfield
    col=col*(1-color_strength[:,None])+cream*color_strength[:,None]
    neckfield=np.exp(-((x-(self.neckbase[0]+self.neckend[0])*.5)/.48)**2)
    throat=np.clip((s.y+.25-y)/.66,0,1)*neckfield*.28
    col=col*(1-throat[:,None])+cream*throat[:,None]
    # Wide, diagonal ivory flank chevrons, repeating paired across the body.
    for sign in (-1,1):
       visible=np.clip((sign*z-.14)/.18,0,1)
       for center,offset in [(-.61,.10),(-.23,-.08),(.18,.015)]:
          local=x-center-.55*(y-s.y)-offset
          band=np.exp(-((local/.095)**4))*np.exp(-(((y-s.y)/.36)**6))
          mask=np.clip(band*visible*.84,0,.84)
          col=col*(1-mask[:,None])+np.array((.94,.81,.60))[None,:]*mask[:,None]
    # Darker stockings fade down from hock towards hooves.
    stockings=np.clip((.57-y)/.52,0,1)**1.55
    col=col*(1-stockings[:,None]*.80)+black*(stockings[:,None]*.80)
    # Stronger haunch, shoulder and cheek shade; no toy-flat color.
    shade=np.clip((np.abs(z)-.18)/.32,0,1)*np.clip((s.y+.28-y)/.9,0,1)*.12
    col=col*(1-shade[:,None])
    noise=(np.sin(47*x+17*y)*np.sin(32*z-13*y)+np.sin(89*y-31*x)*.22)
    col=np.clip(col*(1+.036*noise[:,None]),0,1)
    return np.rint(col*255).astype(np.uint8)

 def hoof(self,leg):
    # Multi-ring rounded split hoof, naturally tapering into the pastern.
    center=leg['ankle']
    color=(.17,.175,.178)
    for side in (-1,1):
       c=center+np.array((.062,-.102,.076*side))
       sections=[(.088,.084,.064,-.004), (.034,.134,.089,.034),
                 (-.060,.156,.094,.052),(-.103,.150,.090,.049)]
       sides=16;verts=[]
       for y,rx,rz,dx in sections:
         for j in range(sides):
           th=math.tau*j/sides
           front=math.cos(th)
           zz=math.sin(th)
           verts.append(c+np.array((front*rx+dx,y,zz*rz)))
       faces=[]
       for i in range(len(sections)-1):
         for j in range(sides):
           a=i*sides+j;b0=i*sides+(j+1)%sides
           cc=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
           faces.extend([(a,cc,b0),(b0,cc,d)])
       for j in range(1,sides-1):
         faces.extend([(0,j,j+1),((len(sections)-1)*sides,
                                (len(sections)-1)*sides+j+1,(len(sections)-1)*sides+j)])
       self.add_part('anatomical_cloven_hoof',np.asarray(verts,np.float32),
                     np.asarray(faces,np.uint32),color,leg['fetlock'])

 def leaf_mesh(self,points,widths,thick=.006):
    """Curved leaf-like hair lock: smooth broad root, curved tip, low-poly real volume."""
    P=np.asarray(points,np.float32)
    verts=[]
    for i,p in enumerate(P):
       tangent=P[min(i+1,len(P)-1)]-P[max(0,i-1)]
       tangent=tangent/(np.linalg.norm(tangent)+1e-9)
       right=np.cross(tangent,np.array([0.,0.,1.]));right/=np.linalg.norm(right)+1e-9
       normal=np.cross(tangent,right);normal/=np.linalg.norm(normal)+1e-9
       w=widths[i]
       verts.extend([p-right*w+normal*thick, p+right*w+normal*thick,
                     p-right*w-normal*thick,p+right*w-normal*thick])
    faces=[]
    for i in range(len(P)-1):
       for a,b0 in ((0,1),(2,3),(0,2),(1,3)):
        q=i*4+a;r=i*4+b0;t=(i+1)*4+a;u=(i+1)*4+b0
        faces.extend([(q,t,r),(r,t,u)])
    return np.asarray(verts,np.float32),np.asarray(faces,np.uint32)

 def add_details(self):
    s=self.s;h=self.neckend
    for side in (-1,1):
       # Built-up orbital rim and tear duct, with a small inward-set eye.
       eye=h+np.array((.19,.124,side*.179))
       for name,at,r,col in [
          ('orbital_rim',eye, (.074,.054,.032),(.24,.135,.09)),
          ('eyeball',eye+[.016,.00,side*.026],(.039,.030,.014),(.10,.067,.031)),
          ('iris_gold',eye+[.027,.002,side*.040],(.015,.016,.008),(.56,.38,.15)),
          ('pupil',eye+[.030,.002,side*.045],(.012,.018,.006),(.066,.046,.028)),
          ('eyelight',eye+[.032,.013,side*.05],(.009,.009,.005),(.94,.86,.69))]:
           v,f=self.ellmesh(at,r,22,14);self.add_part(name,v,f,col,self.headidx)
       # Pointed leafy ears, smoothly tapered with separate darker ear opening.
       origin=h+np.array((-.145,.185,side*.14))
       v,f=self.leaf_mesh([origin,origin+[-.075,.105,side*.03],
               origin+[-.18,.285,side*.085],origin+[-.23,.37,side*.09]],
                 [.072,.083,.048,.004],.019)
       self.add_part('mobile_ear',v,f,(.45,.245,.13),self.headidx)
       inner=origin+np.array((.0,.008,side*.018))
       v,f=self.leaf_mesh([inner,inner+[-.068,.105,side*.02],
               inner+[-.176,.27,side*.066]], [.040,.05,.005],.012)
       self.add_part('inner_ear',v,f,(.22,.11,.095),self.headidx)
       # Dark teardrop nostrils on both sides of the real muzzle.
       at=h+np.array((.680,-.120,side*.125))
       v,f=self.ellmesh(at,(.055,.034,.019),22,14)
       self.add_part('open_nostril',v,f,(.075,.055,.051),self.headidx)
       v,f=self.ellmesh(at+np.array((-.016,.036,side*.007)),(.062,.012,.012))
       self.add_part('nostril_rim',v,f,(.29,.165,.12),self.headidx)
       # Cream mask and long cheek slash highlight along lateral face.
       cv=[h+[.025,.07,side*.166],h+[.12,.027,side*.194],
          h+[.29,-.10,side*.172],h+[.38,-.19,side*.147]]
       v,f=self.tube(cv,[.034,.036,.031,.002],10)
       self.add_part('face_flash',v,f,(.89,.73,.50),self.headidx)
       # Slightly open lip seam (physical dark silhouette, not a decal).
       v,f=self.tube([h+[.47,-.224,side*.085],h+[.55,-.228,side*.107],
          h+[.662,-.209,side*.101]],[.013,.010,.003],8)
       self.add_part('mouth_line',v,f,(.11,.068,.053),self.headidx)
    # Neck mane: layered hair plates curved backward, no single giant spikes.
    rng=np.random.default_rng(54072)
    for layer in range(3):
      count=28 if layer<2 else 19
      for k in range(count):
       t=(k+.18*rng.random())/count
       start=self.neckbase+(self.neckend-self.neckbase)*t
       # Fur takes the nape ridge (toward back and sky, not on throat).
       root=start+np.array((-.13-.015*layer,.18+.03*math.sin(math.pi*t),
                             (layer-1)*.056))
       length=(.18+.18*math.sin(t*math.pi))*(.80+.35*rng.random())
       p=[root,root+[-length*.36,length*.18,0],
                root+[-length*.78,length*.38,.02*rng.normal()],
                root+[-length*1.08,length*.44,.014*rng.normal()]]
       v,f=self.leaf_mesh(p,[.059,.070,.048,.002],.009)
       color=(.14+.025*layer,.085+.01*layer,.063+.005*layer)
       self.add_part('sculpted_mane_lock',v,f,color,self.neckidx)
    # Raised mane line from withers along back; irregular shorter locks.
    for k in range(32):
       t=k/31
       x=(-.45+.74*t)*s.L
       top=s.y+s.h*(.85+.10*math.sin(math.pi*t))
       z=rng.uniform(-.08,.08)
       root=np.array((x,top,z))
       l=.095+.105*rng.random()
       v,f=self.leaf_mesh([root,root+[-l*.28,l*.33,0],root+[-l*.77,l*.82,0]],
                           [.065,.065,.002],.007)
       self.add_part('back_mane_lock',v,f,(.18,.109,.070),self.root)
    # Tail is a multi-layer organic plume rather than three pointy sticks.
    start=self.tailbase
    v,f=self.tube([start,start+[-.16,-.105,0],start+[-.34,-.26,0],
                   start+[-.52,-.40,0]], [.095,.076,.055,.040],12)
    self.add_part('tail_core',v,f,s.base,self.tailidx)
    for strand in range(25):
       a=2*math.pi*strand/25
       origin=start+np.array((-.38,-.28,.018*np.sin(a)))
       wiggle=rng.uniform(-.10,.10)
       l=.31+.25*rng.random()
       p=[origin,origin+[-l*.22,-l*.24,.07*np.cos(a)],
          origin+[-l*.6,-l*.75,wiggle],
          origin+[-l*.9,-l*1.10,.09*np.cos(a)]]
       # Avoid pinched hair: tapered lobes with varied chestnut/dark accents.
       v,f=self.leaf_mesh(p,[.025,.040,.021,.001],.007)
       shade=rng.uniform(.85,1.20)
       self.add_part('tail_fur_strand',v,f,tuple(np.array(s.dark)*shade),self.tailidx)
    for leg in self.legs:
      self.hoof(leg)
      # Short fetlock feathers interleaved around ankle bone.
      a=leg['ankle']
      for j in range(3):
        ang=math.tau*j/3
        offset=np.array((.083*math.cos(ang),.012,.075*math.sin(ang)))
        v,f=self.leaf_mesh([a+offset,
          a+offset+[-.027,-.055,.01],a+offset+[-.08,-.12,.01]],
          [.026,.022,.001],.004)
        self.add_part('fetlock_fur',v,f,(.20,.117,.07),leg['fetlock'])

 def clips(self):
    return super().clips()

def build():
    m=Talvero(S)
    dest=OUT/'talvero';dest.mkdir(parents=True,exist_ok=True)
    path=dest/'talvero-savanna-anatomy-skinned-v03.glb'
    manifest=m.glb(path)
    for name in ['three_quarter','side','front']:
        m.render(dest/('talvero-real-3d-'+name+'-v03.png'),name)
    record={'species':'talvero','version':'v03','artisticStatus':'in_review',
            'previousModelsPreserved':True,'gameplayIntegrated':False,
            'source':'assets/models/creatures/talvero-v03/source/generate.py','model':manifest}
    (dest/'talvero-manifest-v03.json').write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(record,indent=2),flush=True)
if __name__=='__main__':build()