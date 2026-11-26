#!/usr/bin/env python3
"""Wildhaven: savanna herbivore anatomy v03, original 3D skeletal sculpting.

Fidelity to approved concepts is prioritized over generic primitive assembly.
One connected skinned main body, geometric anatomical details, weighted joints,
11 independent embedded glTF clips. LOD reduction occurs AFTER source export.
"""
from __future__ import annotations
import json, math, numpy as np
from pathlib import Path
import base_v02 as b
from scipy.spatial import cKDTree
import trimesh

ROOT=Path(__file__).resolve().parents[1]
BUILD=ROOT/'build'/'source'
SPECS={
 'rambrel': b.Spec('rambrel','Rambrél',2.39,1.69,.38,.36,1.48,1.17,
                 (.60,.33,.153),(.245,.137,.088),(.82,.66,.45),(.80,.64,.39),'browser'),
 'rambrel_chapadas': b.Spec('rambrel_chapadas','Rambrél-das-Chapadas',3.65,2.32,.67,.61,2.04,1.87,
                 (.46,.245,.124),(.185,.112,.075),(.77,.60,.40),(.77,.53,.32),'giant'),
 'turvagal': b.Spec('turvagal','Turvagal',2.86,1.16,.74,.58,.79,.25,
                 (.36,.39,.24),(.205,.25,.152),(.70,.66,.46),(.58,.56,.42),'wetland'),
}

# Move left/right as a pair, avoiding visual duplication from simple sphere parts.
def blend(a,c,t):return np.asarray(a)*(1-t)+np.asarray(c)*t

class AnatomicalHerbivore(b.Creature):
 def make_rig(self):
   super().make_rig()
   s=self.s
   if s.role in ('browser','giant'):
    # A functional long-necked grazer: neck axis rises toward the canopy, not vertical cylinder.
    self.neckbase[:]=[s.L*.305,s.y+.095,0]
    self.neckend[:]=[s.L*.50+(.14 if s.role=='browser' else .23),s.y+s.neck+.03,0]
    self.bones[self.neckidx]['world']=self.neckbase.copy()
    self.bones[self.headidx]['world']=self.neckend.copy()
    self.bones[self.jawidx]['world']=self.neckend+np.array((.20,-.13,0))
    # Strong, backward-sloping hocks and splayed hard ground hoof contacts.
    for leg in self.legs:
      x=leg['hip'][0];z=leg['hip'][2]
      if leg['front']:
        leg['knee'][:]=[x-.12 if s.role=='browser' else x-.15,s.leg*.60,z*1.03]
        leg['ankle'][:]=[x+.08,.15*s.leg,z*1.04]
      else:
        leg['knee'][:]=[x+.21 if s.role=='browser' else x+.31,s.leg*.60,z*1.04]
        leg['ankle'][:]=[x-.10,.15*s.leg,z*1.03]
      self.bones[leg['lower']]['world']=leg['knee'].copy()
      self.bones[leg['fetlock']]['world']=leg['ankle'].copy()
   else:
    for leg in self.legs:
      x=leg['hip'][0];z=leg['hip'][2]
      leg['knee'][:]=[x+(.045 if leg['front'] else .065),.43*s.leg,z*1.03]
      leg['ankle'][:]=[x+(.11 if leg['front'] else -.09),.16*s.leg,z*1.05]
      self.bones[leg['lower']]['world']=leg['knee'].copy()
      self.bones[leg['fetlock']]['world']=leg['ankle'].copy()

 def make_body(self):
   super().make_body()
   # Body is a continuous SDF-derived surface, not 3D balls/cylinders joined in display space.
   s=self.s;v=self.skin_data['vertices'].copy()
   x=v[:,0];y=v[:,1];z=v[:,2]
   h=self.neckend
   # Differentiate shoulders, crest, abdominal tuck, pelvic width, and head profile.
   shoulder=np.exp(-((x-s.L*.29)/(.24*s.L))**4)
   rump=np.exp(-((x+s.L*.36)/(.25*s.L))**4)
   if s.role in ('browser','giant'):
       # Sinew-heavy anterior shoulder, deep chest and thin abdomen of a natural browser.
       v[:,2]*=1+.045*shoulder-.065*np.exp(-((x+.03*s.L)/(.22*s.L))**4)
       v[:,1]+=.034*rump*np.clip((y-s.y+.06)/.35,0,1)
       # Narrower upward neck vs thicker shoulders, separate giant anatomy.
       above=np.clip((y-(s.y+.38))/(s.neck+.16),0,1)
       v[:,2]*=1-(.09 if s.role=='browser' else .13)*above
       # Narrow facial bridge into muzzle, cheek mass rising behind eye.
       forward=np.clip((x-h[0]-.16)/(.64 if s.role=='browser' else .89),0,1)
       face=np.clip((y-h[1]+.22)/.38,0,1)
       v[:,1]-=.040*forward*face
       v[:,2]*=1-.105*forward*face
       # A flatter muzzle is real geometry, not fake texture.
       v[:,0]+=.087*forward*face
       # Contrasting high-acacia browsing vs bigger giant proportions.
       if s.role=='giant':
          # Giant is not simply enlarged: deeper chest, thick cervical origin, robust hip ridge.
          neckcore=np.exp(-((x-s.L*.38)/(.31*s.L))**2)*np.clip((y-s.y)/1.30,0,1)
          v[:,2]*=1+.115*neckcore
          v[:,1]+=.040*np.exp(-((x+s.L*.26)/.53)**2)
   else:
       # Wetland grazer has a long low hull; heavier shoulder than rump, broad muzzle.
       barrel=np.exp(-((x+.03*s.L)/(.36*s.L))**4)
       v[:,2]*=1+.085*barrel+.065*shoulder
       v[:,1]-=.075*barrel*np.clip((s.y-y)/.57,0,1)
       forward=np.clip((x-h[0]-.16)/.57,0,1)
       lower=np.clip((h[1]+.25-y)/.34,0,1)
       # Broad drooping muzzle: near the tip it becomes heavier, not an equine pipe.
       facezone=np.clip((y-h[1]+.37)/.52,0,1)
       v[:,2]*=1+.92*forward*facezone
       v[:,1]-=.105*forward*lower
       v[:,1]+=.055*forward*(1-lower)*facezone
       v[:,0]+=.060*forward
   self.skin_data['vertices']=v.astype(np.float32)
   f=self.skin_data['faces']
   tri=trimesh.Trimesh(vertices=v,faces=f,process=False)
   self.skin_data['normals']=np.asarray(tri.vertex_normals,np.float32)
   self.skin_data['colors']=self.vertex_colors(v)
   self.skin_data['joints'],self.skin_data['weights']=self.compute_skin(v)

 def vertex_colors(self,V):
   color=super().vertex_colors(V).astype(np.float32)/255
   s=self.s
   x,y,z=V[:,0],V[:,1],V[:,2]
   if s.role in ('browser','giant'):
       # Irregular organic patches instead of floating diamonds.
       stripe=np.sin(x*(5.8 if s.role=='browser' else 4.9) + y*2.4+np.sign(z)*.4)
       flank=np.exp(-((x+.14*s.L)/(.38*s.L))**4)
       creamy=np.clip((stripe+.03)*1.9,0,1)*flank*np.clip((s.y+.24-y)/(.72*s.h),0,1)*.33
       color=blend(color,np.array(s.cream),creamy[:,None])
       # Neck dorsal angular mottling darker from crest down scapula.
       crest=np.clip((y-s.y)/max(s.neck,1),0,1)*np.clip((x-s.L*.13)/(.36*s.L),0,1)
       patch=np.clip(np.sin(13*x+4*y+3*z)-.10,0,1)*.14*crest
       color=blend(color,np.array(s.dark),patch[:,None])
       # The concept's characteristic jagged, high-contrast dark neck patches.
       neckt=np.clip((y-(s.y+.17))/(s.neck+.09),0,1)
       neckline=self.neckbase[0]+neckt*(self.neckend[0]-self.neckbase[0])
       zoneneck=np.exp(-((x-neckline)/(.24 if s.role=='browser' else .38))**4)
       sideview=np.clip((np.abs(z)-(.05 if s.role=='browser' else .09))/.20,0,1)
       zigzag=np.sin(y*(12.5 if s.role=='browser' else 8.2)+x*5.1+2.2*np.sin(y*7.1))
       jag=np.clip((zigzag-.08)*2.3,0,1)*zoneneck*sideview*neckt*.68
       color=blend(color,np.array((.22,.12,.075)),jag[:,None])
       # Cream brush stripes near the rump and across lower flank, not extra geometry.
       fzone=np.exp(-((x+.20*s.L)/(.36*s.L))**4)
       band=np.clip(np.sin(x*8.5+y*4.2+.85*np.sin(y*5.1))-.25,0,1)*fzone
       side=np.clip((np.abs(z)-.08)/.17,0,1)
       color=blend(color,np.array(s.cream),(band*.37*side)[:,None])
   else:
       # Wetland mud-mottled green upper hide, pale broad flanks and dark snout.
       belly=np.clip((s.y-.13-y)/(.45+s.h),0,1)
       flank=np.exp(-((np.abs(z)-s.w*.83)/(.19+s.w*.20))**2)
       color=blend(color,np.array(s.cream),(.28*belly*flank)[:,None])
       wave=np.sin(x*18+y*11+z*9)*np.sin(x*8-y*5)
       color*=1+(.045*wave)[:,None]
       nose=np.clip((x-(self.neckend[0]+.26))/.50,0,1)*np.clip((y-self.neckend[1]+.1)/.23,0,1)
       color=blend(color,np.array((.27,.23,.18)),(.3*nose)[:,None])
       # Pale sweeping lateral markings around shoulder and flank.
       waveband=np.clip(np.sin(x*5.1+y*4.5+np.sign(z)*.8)-.42,0,1)
       flankzone=np.exp(-((x+.04*s.L)/(.45*s.L))**4)*np.clip((np.abs(z)-.18)/.36,0,1)
       color=blend(color,np.array(s.cream),(waveband*flankzone*.34)[:,None])
   return (np.clip(color,0,1)*255).astype(np.uint8)

 def solid(self,name,center,radius,color,parent,res=11):
   vert,faces=self.ellmesh(np.array(center,float),radius,nu=res,nv=max(6,res//2))
   self.add_part(name,vert,faces,color,parent)
 def ribbon(self,name,pts,rads,color,parent,sides=8):
   vert,faces=self.tube(pts,rads,ns=sides);self.add_part(name,vert,faces,color,parent)
 def connected_plate(self,center,length,width,height,color,parent):
   """Leaf-like overlapping scute with its base recessed into organic hide."""
   x,y,z=center
   pts=[[x-length*.63,y-.035,z],[x-length*.18,y+height*.71,z],
        [x+length*.31,y+height,z],[x+length*.62,y+height*.36,z]]
   self.ribbon('dorsal_scutum',pts,[width*.72,width,width*.65,.002],color,parent,9)

 def add_details(self):
   s=self.s;h=self.neckend;nb=self.neckbase;rng=np.random.default_rng(730017+len(s.id)*101)
   wet=s.role=='wetland';giant=s.role=='giant'
   ratio=1.43 if giant else 1.
   dark=np.array(s.dark)
   for sign in (-1,1):
      # Cranium: recessed warm orbit with true upper/lower eyelids and corneal glint.
      eye=h+np.array((.14 if not wet else .05,.11 if not wet else .14,sign*(.18 if not giant else .25)))
      for name,delta,rad,color in (
        ('orbital_shadow',(0,0,0),(.070,.054,.023),(.28,.17,.10) if not wet else (.22,.24,.15)),
        ('eyeball',(.006,.003,sign*.018),(.043,.035,.021),(.07,.057,.035)),
        ('iris',(.023,.003,sign*.034),(.025,.025,.010),(.69,.49,.24)),
        ('pupil',(.030,.002,sign*.044),(.012,.016,.006),(.042,.04,.025)),
        ('eye_glint',(.034,.012,sign*.048),(.007,.007,.005),(.98,.95,.82))):
         self.solid(name,eye+np.array(delta),np.array(rad)*ratio,color,self.headidx,12)
      self.ribbon('upper_lid',[eye+[-.074,.012,sign*.018],eye+[0,.054,sign*.025],eye+[.072,.010,sign*.010]],
                  [.019,.021,.008],s.dark,self.headidx)
      self.ribbon('lower_lid',[eye+[-.066,-.019,sign*.016],eye+[0,-.048,sign*.028],eye+[.068,-.020,sign*.010]],
                  [.013,.013,.006],s.base,self.headidx)
      # Real triangular ears with dark inner fur and rounded base.
      ear=h+np.array((-.17 if not wet else -.14,.20 if not wet else .105,sign*(.16 if not wet else .20)))
      if giant:ear+=np.array((-.03,.025,sign*.06))
      outer=[ear,ear+[-.08,.12 if not wet else .065,sign*.055],ear+[-.17,.245 if not wet else .13,sign*.09],ear+[-.23,.31 if not wet else .17,sign*.13]]
      self.ribbon('ear_outer',outer,[.092*ratio,.074*ratio,.041*ratio,.001],s.base,self.headidx,10)
      inner=[ear+[0,.025,sign*.035],ear+[-.08,.12 if not wet else .060,sign*.076],ear+[-.16,.225 if not wet else .115,sign*.111]]
      self.ribbon('ear_inner',inner,[.031*ratio,.038*ratio,.001],s.dark,self.headidx,7)
      # Nostrils anchored onto the connected snout: no free black ball at nose tip.
      nose=h+np.array((.65 if not giant else .79,-.142,sign*(.12 if not wet else .18)))
      if wet:nose=h+np.array((.54,-.145,sign*.23))
      body=self.skin_data['vertices']; candidates=body[(body[:,0]>h[0]+.28)&(body[:,1]>h[1]-.38)&(body[:,1]<h[1]+.12)]
      if len(candidates):
         idx=np.argmin(np.sum((candidates-nose)**2,axis=1));nose=candidates[idx].astype(float)
      self.solid('nostril_rim',nose,[.058*ratio,.036*ratio,.012*ratio],s.base,self.headidx,12)
      self.solid('nostril_depth',nose+np.array((.012,0,.009*sign)),[.037*ratio,.021*ratio,.009*ratio],(.075,.063,.049),self.headidx,12)
      if wet:
         # Broad muzzle with two side nostrils and folded lip, no elongated tapir trunk.
         self.ribbon('lip_fold',[h+[.35,-.235,sign*.17],h+[.47,-.245,sign*.19],h+[.58,-.225,sign*.16]],
               [.019,.017,.006],s.dark,self.headidx,9)
      else:
         # Raised zygomatic cheekbone connected to cheek, jaw muscle and long lip seam.
         # Cheek already sculpted into the main skinned head surface; no glued-on oval.
         self.ribbon('jaw_lip_seam',[h+[.37,-.201,sign*.139*ratio],h+[.54,-.221,sign*.115*ratio],h+[.67,-.201,sign*.078*ratio]],
                     [.013,.013,.002],s.dark,self.headidx,8)
         hornheight=.31 if s.role=='browser' else .51
         hornroot=h+np.array((.095,.185,sign*.135*ratio))
         # Curving rearward bony horns; different scale and thickness on giant.
         points=[hornroot,
             hornroot+np.array((-.082,hornheight*.34,sign*.035)),
             hornroot+np.array((-.245,hornheight*.79,sign*.055)),
             hornroot+np.array((-.52 if giant else -.40,hornheight,sign*.06))]
         self.ribbon('paired_swept_horn',points,
             ([.122,.099,.054,.001] if giant else [.069,.054,.033,.001]),
             (.16,.15,.13),self.headidx,12)
         # Brow ridge visually continues neck line, not glued-on solid eye balls.
         self.ribbon('brow_fascia',[h+[-.02,.11,sign*.145*ratio],h+[.17,.20,sign*.16*ratio],h+[.28,.17,sign*.14*ratio]],
                     [.037,.027,.002],(.38,.21,.125),self.headidx,8)
   # Skin fold of cervical extensor and connected withers, modeled with narrow ribbons.
   for sign in (-1,1):
     if wet:
       for k in range(3):
         x=nb[0]-.28+k*.115
         self.ribbon('cervical_fold',[[x,s.y+.13,sign*s.w*.88],[x+.14,s.y-.14,sign*s.w*.88],[x+.22,s.y-.36,sign*s.w*.70]],
                    [.045,.040,.003],(.27,.33,.21),self.neckidx,9)
     else:
       self.ribbon('neck_tendon',[nb+[-.18,-.10,sign*.205],(nb+h)*.5+[.0,-.13,sign*.16],h+[-.13,-.06,sign*.12]],
                   [.027,.034,.001],blend(s.base,s.dark,.16),self.neckidx,10)
   # Layered organic neck crest: dense short leaf-shaped fur rather than upright detached bars.
   if not wet:
     N=63 if giant else 57
     for row in range(3):
      for j in range(N):
       t=(j+.25*rng.random())/(N-1)
       start=nb+(h-nb)*t
       length=(.15+.12*math.sin(math.pi*t))*(1.28 if giant else 1.)*(.74+.35*rng.random())
       root=start+np.array((-.13-.035*row,.14,(-1+row)*(.08 if giant else .055)))
       side=(row-1)
       pts=[root,root+[-length*.32,length*.14,.007*side],
            root+[-length*.76,length*.23,.017*side],
            root+[-length*1.14,length*.37,.02*side]]
       wide=.034 if giant else .025
       colors=tuple(dark*(.79+.35*rng.random()))
       self.ribbon('organic_nape_fur',pts,[wide*1.1,wide,wide*.51,.001],colors,self.neckidx,7)
     for j in range(30 if giant else 27):
       t=j/29 if giant else j/26
       x=(-.38+.66*t)*s.L
       y=s.y+s.h*(.92+.04*math.sin(math.pi*t))
       self.ribbon('spinal_crest',[[x,y,0],[x-.07,y+.09,0],[x-.17,y+.12,0]],
                   [.046,.038,.001],s.dark,self.root,7)
   else:
     # Narrow reed-like layered scutes, embedded into hide; low poly overlapping ridges.
     body_v=self.skin_data['vertices']
     top_tree=cKDTree(body_v[:,[0,2]])
     for row in range(3):
       for j in range(20):
         t=(j+.5*(row%2))/20
         x=(-.41+.85*t)*s.L
         z=(row-1)*s.w*.42
         # Set each scute against the actual nonlinear 3D surface rather than
         # forming a flat solid shelf on the creature's back.
         near=top_tree.query([x,z],k=45)[1]
         surface=float(np.percentile(body_v[near,1],90))
         col=blend(s.dark,np.array((.52,.43,.285)),.39+.23*rng.random())
         self.connected_plate((x,surface-.07,z),.30,.13,.13,tuple(col),self.root)
     # Small ridged crown plates along cheeks, not complete armor shell.
     for i in range(6):
       x=h[0]-.2+i*.13
       self.connected_plate((x,h[1]+.19,.015),.19,.075,.10,s.dark,self.headidx)
   # Two-toed keratin hooves, tapered toes, no unsupported dark spheres.
   for leg in self.legs:
      ankle=leg['ankle']
      if wet:
        width=.18;forward=.13
      elif giant:
        width=.15;forward=.135
      else:
        width=.12;forward=.12
      for sign in (-1,1):
         offset=sign*(width*.53)
         self.solid('cloven_keratin_hoof',ankle+[forward,-.066,offset],[width*.82,.093,width*.48],
                    (.22,.20,.16) if wet else (.21,.18,.16),leg['fetlock'],10)
         self.ribbon('hoof_rim',[ankle+[.03,-.029,offset],ankle+[.115,-.075,offset],ankle+[.20,-.076,offset]],
                     [.02,.025,.003],s.dark,leg['fetlock'],7)
      # Tendons sit along cannon, avoiding big isolated collar-cylinders.
      if False:  # V05: tendons are part of continuous skinned muscle, not dark sticks.
       k=leg['knee']
       self.ribbon('tendon_crest',[k+[.004,-.05,leg['side']*.085],
            blend(k,ankle,.54)+[.02,0,leg['side']*.085],ankle+[.02,.05,leg['side']*.05]],
            [.018,.021,.001],blend(s.base,s.dark,.24),leg['lower'],7)
   # Natural tail, volume taper into coarse tuft (no floating crescent).
   tb=self.tailbase
   tip=tb+np.array((-.58,-.52,0))
   self.ribbon('tail_flexible',[tb,tb+[-.22,-.12,0],tb+[-.46,-.38,0],tip],
               [.11,.079,.053,.011],s.base,self.tailidx,9)
   for row in range(3):
      for i in range(9):
         a=.15*i/9;z=(row-1)*.045
         root=tip+np.array((a*.18,a*.10,z))
         self.ribbon('tail_tuft',[root,root+[-.11,-.13,z*.4],root+[-.28,-.23,z*.3]],
                     [.035,.028,.001],s.dark,self.tailidx,6)
   self.batch_parts()

 def batch_parts(self):
   """Merge parts only when they share joint attachment and material color."""
   grouped={}
   for name,v,f,color,parent in self.parts:
      key=(parent,tuple(np.round(color,3)))
      grouped.setdefault(key,[]).append((name,v,f,color,parent))
   parts=[]
   for (parent,col),group in grouped.items():
      verts=[];faces=[];count=0
      for name,v,f,c,p in group:
         verts.append(v);faces.append(f+count);count+=len(v)
      parts.append((group[0][0]+'__batched',np.concatenate(verts).astype(np.float32),
                  np.concatenate(faces).astype(np.uint32),np.array(col,np.float32),parent))
   self.parts=parts


def generate(id,output_dir):
    s=SPECS[id];animal=AnatomicalHerbivore(s)
    out=Path(output_dir);out.mkdir(parents=True,exist_ok=True)
    path=out/(id+'-savanna-sculpted-skinned-source-v03.glb')
    info=animal.glb(path)
    (out/(id+'-source-manifest-v03.json')).write_text(json.dumps({'id':id,'sourceModel':info,'generation':'organic-SDF-with-weighted-skin','approvability':'artistic-review-pending'},indent=2)+'\n')
    print('SOURCE',id,info['triangles'],'triangles',info['skinJoints'],'joints',info['animationCount'],'clips',info['bytes'],'bytes',flush=True)
    return path,info

if __name__=='__main__':
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('--only',choices=list(SPECS));ap.add_argument('--out',default=str(BUILD));arg=ap.parse_args()
 for sid in ([arg.only] if arg.only else SPECS):generate(sid,Path(arg.out)/sid)