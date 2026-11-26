#!/usr/bin/env python3
"""Wildhaven savanna megafauna V02 — actually articulated angular low-poly creatures.

Procedurally authored polygonal body sections, head wedges, segmented legs,
flat scutes, tails, horns, ears and tusks, with the tested weighted 17/19-joint
animated glTF 2.0 exporter. No plastic-looking SDF organic spheres are used.
"""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np
import legacy_species as legacy
import base_v02 as b

ROOT=Path(__file__).resolve().parents[1]
SPECS={k:v for k,v in legacy.SPECS.items()}
SPEC=SPECS
SPECS['garruva'].L=3.65
SPECS['garruva'].w=.58
SPECS['garruva'].h=.48
SPECS['garruva'].neck=.30
SPECS['garruva'].base=(.355,.32,.255)
SPECS['garruva'].dark=(.14,.125,.105)


def tube(points,radii,sides=8):
    points=np.asarray(points,float)
    out=[];faces=[]
    for i,p in enumerate(points):
        vec=points[min(i+1,len(points)-1)]-points[max(i-1,0)]
        vec/=max(np.linalg.norm(vec),1e-9)
        ref=np.array([0.,0.,1.])
        if abs(np.dot(vec,ref))>.9:ref=np.array([0.,1.,0.])
        u=np.cross(vec,ref);u/=max(np.linalg.norm(u),1e-9)
        v=np.cross(vec,u)
        ry,rz=radii[i] if isinstance(radii[i],tuple) else (radii[i],radii[i])
        for j in range(sides):
            a=2*math.pi*j/sides
            out.append(p+u*(ry*math.cos(a))+v*(rz*math.sin(a)))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            faces.extend(((a,b,c),(b,d,c)))
    for j in range(1,sides-1):
        faces.append((0,j+1,j))
        n=(len(points)-1)*sides
        faces.append((n,n+j,n+j+1))
    return np.asarray(out,np.float32),np.asarray(faces,np.uint32)


def ring_torso(rings,sides=10):
    # ring=(x, vertical-center, vertical-radius, lateral-radius)
    vv=[];ff=[]
    for x,cy,ry,rz in rings:
        for j in range(sides):
            t=2*math.pi*j/sides
            vv.append((x,cy+ry*math.cos(t),rz*math.sin(t)))
    for i in range(len(rings)-1):
        for j in range(sides):
            a=i*sides+j;bb=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            ff.extend(((a,c,bb),(bb,c,d)))
    for k in range(1,sides-1):ff.append((0,k,k+1))
    off=(len(rings)-1)*sides
    for k in range(1,sides-1):ff.append((off,off+k+1,off+k))
    return np.asarray(vv,np.float32),np.asarray(ff,np.uint32)


def polygon_plate(points,thickness=.045):
    pts=np.asarray(points,float)
    low=pts.copy();low[:,1]-=thickness
    top=pts.copy();top[:,1]+=.01
    ctr=top.mean(axis=0);ctr[1]+=.04
    v=np.concatenate((top,low,ctr.reshape(1,3))).astype(np.float32)
    ff=[];n=len(pts)
    for j in range(n):
        q=(j+1)%n
        ff.extend(((j,q,2*n),(j,n+j,q),(q,n+j,n+q)))
    return v,np.asarray(ff,np.uint32)


class AngularCreature(legacy.Megafauna):
    def make_body(self):
        s=self.s;L=s.L;r=s.role
        shoulder=.31*L;hip=-.34*L
        # Different thorax shoulder/hindquarter masses per species, built by
        # only 11 low-sided cross-sections. Broad, readable planes by design.
        if r=='bison':
            rings=[(-.57*L,s.y-.08,.16,.18),(-.51*L,s.y-.02,.57*s.h,.62*s.w),
             (-.40*L,s.y,.81*s.h,.89*s.w),(-.26*L,s.y,.90*s.h,.95*s.w),
             (-.10*L,s.y-.04,.92*s.h,1.00*s.w),(.10*L,s.y+.06,1.08*s.h,1.10*s.w),
             (.22*L,s.y+.19,1.24*s.h,1.13*s.w),(.33*L,s.y+.20,1.22*s.h,1.04*s.w),
             (.45*L,s.y+.07,.84*s.h,.79*s.w),(.50*L,s.y,.48*s.h,.50*s.w),
             (.52*L,s.y-.08,.10,.12)]
        elif r=='proboscid':
            rings=[(-.56*L,s.y,.12,.14),(-.50*L,s.y,.66*s.h,.72*s.w),
             (-.38*L,s.y,.95*s.h,.93*s.w),(-.20*L,s.y,.99*s.h,1.02*s.w),
             (.02*L,s.y,.98*s.h,1.04*s.w),(.23*L,s.y+.03,.95*s.h,1.04*s.w),
             (.34*L,s.y+.02,.98*s.h,1.00*s.w),(.44*L,s.y-.03,.82*s.h,.82*s.w),
             (.50*L,s.y-.09,.46*s.h,.49*s.w),(.53*L,s.y-.09,.11,.11)]
        elif r=='root_reptile':
            rings=[(-.55*L,s.y-.09,.13,.15),(-.48*L,s.y-.08,.68*s.h,.65*s.w),
             (-.35*L,s.y-.03,.91*s.h,.91*s.w),(-.18*L,s.y-.02,.99*s.h,1.01*s.w),
             (.03*L,s.y-.01,1.00*s.h,1.07*s.w),(.22*L,s.y-.04,.95*s.h,1.02*s.w),
             (.38*L,s.y-.04,.91*s.h,.87*s.w),(.48*L,s.y-.09,.70*s.h,.66*s.w),
             (.52*L,s.y-.11,.14,.16)]
        else:
            rings=[(-.54*L,s.y-.06,.10,.11),(-.49*L,s.y-.06,.60*s.h,.69*s.w),
             (-.33*L,s.y-.03,.80*s.h,.89*s.w),(-.14*L,s.y,.90*s.h,.99*s.w),
             (.05*L,s.y,.91*s.h,1.00*s.w),(.23*L,s.y+.025,.88*s.h,.96*s.w),
             (.38*L,s.y+.01,.81*s.h,.79*s.w),(.48*L,s.y-.04,.55*s.h,.52*s.w),
             (.51*L,s.y-.08,.12,.12)]
        v,f=ring_torso(rings,sides=10)
        # Face-wise muted value zones emphasize deliberate polygonal planes.
        yy=v[:,1];zz=v[:,2];xx=v[:,0]
        col=np.tile(np.asarray(s.base,float),(len(v),1))
        for i in range(len(v)):
            theta=math.atan2((yy[i]-s.y)/max(s.h,.15),zz[i]/max(s.w,.15))
            zone=int((theta+math.pi)/(2*math.pi)*10)%10
            col[i]*=[1.0,.96,.91,.91,.96,1,1.04,1.07,1.04,1.02][zone]
            if yy[i]<s.y-s.h*.35:col[i]=.68*col[i]+.32*np.asarray(s.cream)
            if r=='proboscid' and abs(zz[i])>.45*s.w:
                pattern=math.sin(xx[i]*6.6+yy[i]*2.7)
                if pattern>.18:col[i]=.56*col[i]+.44*np.asarray(s.cream)
        c=np.rint(np.clip(col,0,1)*255).astype(np.uint8)
        # This 180-triangle torso is the skinned anchor of the creature. All
        # the other volumes are intentionally articulated on their bone nodes.
        joints,weights=self.compute_skin(v)
        self.skin_data={'vertices':v,'faces':f,'normals':np.zeros_like(v),
                        'colors':c,'joints':joints,'weights':weights}

    def add(self,name,geom,color,parent):
        self.add_part(name,geom[0],geom[1],color,parent)
    def tub(self,name,points,radii,color,parent,sides=8):
        self.add(name,tube(points,radii,sides),color,parent)
    def plate(self,name,points,color,parent,thickness=.04):
        self.add(name,polygon_plate(points,thickness),color,parent)

    def add_details(self):
        s=self.s;r=s.role;L=s.L;H=self.neckend
        # Segmented limb anatomy: three visually articulated volumes per leg.
        for leg in self.legs:
            hip=leg['hip'];knee=leg['knee'];ankle=leg['ankle'];front=leg['front']
            if r=='bison':wide=.42 if front else .36
            elif r=='proboscid':wide=.37
            elif r=='root_reptile':wide=.315 if front else .255
            else:wide=.29
            self.tub('angular_upper_limb',[
                hip+[0,.12,0],hip+[.005,-.11,0],knee+[0,.04,0],knee+[0,-.04,0]],
                [(wide*1.12,wide*.98),(wide,wide*.91),(.73*wide,.70*wide),(.60*wide,.62*wide)],s.base,leg['upper'],8)
            self.tub('angular_lower_limb',[knee+[0,.11,0],knee+[0,-.06,0],ankle+[0,.045,0],ankle+[0,-.04,0]],
                [(wide*.73,wide*.76),(wide*.65,wide*.67),(wide*.57,wide*.59),(wide*.49,wide*.51)],
                s.base,leg['lower'],8)
            # Hooves and toes are proper wedges, not spheres beneath tubular legs.
            if r in ('bison','proboscid'):
                for side in (-1,1):
                    p=ankle+np.array([.095,-.075,side*.10])
                    self.tub('cloven_hoof', [p+[0,.045,0],p+[.12,-.015,0]],
                             [(.145,.120),(.12,.095)],(.25,.195,.135),leg['fetlock'],7)
            else:
                for toe in range(4):
                    z=ankle[2]+(toe-1.5)*(.080 if r=='scavenger_reptile' else .095)
                    p=np.array([ankle[0]+.02,ankle[1]-.06,z])
                    lead=.24 if front and r=='root_reptile' else .16
                    self.tub('reptile_hooked_digging_claw',[p,p+[lead*.72,-.035,0],p+[lead,-.075,0]],
                       [(.073,.061),(.049,.039),(.001,.001)],(.34,.29,.20),leg['fetlock'],6)
        # A powerful, low-sided neck connects torso to angular head. All
        # volumes are deliberately distinct for good silhouette in animation.
        nx=self.neckbase;h=H
        if r=='bison':nr=[(.52,.47),(.47,.43),(.39,.34)];
        elif r=='proboscid':nr=[(.41,.42),(.36,.38),(.29,.30)]
        elif r=='root_reptile':nr=[(.41,.35),(.34,.29),(.25,.23)]
        else:nr=[(.32,.28),(.26,.23),(.21,.18)]
        self.tub('neck_cervical_structure',[nx+[-.16,-.10,0],nx+[.14,.08,0],h+[-.09,-.06,0]],nr,s.base,self.neckidx,9)
        if r=='bison':
            # bison-like brow and strong shorter muzzle
            headrings=[(-.30,.02,.34,.37),(-.07,.03,.39,.41),(.25,-.03,.32,.34),(.51,-.14,.26,.27),(.72,-.20,.19,.23)]
        elif r=='proboscid':
            headrings=[(-.29,-.04,.30,.32),(0,.03,.37,.39),(.29,-.09,.30,.31),(.55,-.18,.20,.23),(.75,-.24,.15,.18)]
        elif r=='root_reptile':
            headrings=[(-.34,0,.23,.27),(-.09,.02,.26,.30),(.25,-.035,.20,.26),(.65,-.10,.15,.18),(.93,-.13,.14,.17)]
        else:
            headrings=[(-.31,0,.20,.26),(-.09,.06,.27,.30),(.26,.035,.22,.25),(.61,-.035,.16,.19),(1.05,-.11,.09,.12)]
        v,f=ring_torso([(H[0]+x,H[1]+cy,ry,rz) for x,cy,ry,rz in headrings],sides=10)
        self.add('angular_species_skull',(v,f),s.base,self.headidx)
        # Nose, eye sockets and brows positioned on the actual planar skull.
        for side in (-1,1):
            z=side*(.34 if r in ('proboscid','bison') else .26)
            E=H+np.array([.20,.13,z])
            self.tub('recessed_eye_socket',[E+[0,.00,0],E+[.016,.01,side*.03]],[(.080,.068),(.054,.05)],s.dark,self.headidx,8)
            self.tub('amber_eye_iris',[E+[.02,.01,side*.033],E+[.028,.01,side*.040]],[(.033,.028),(.025,.026)],(.75,.49,.24),self.headidx,8)
            self.tub('ridge_around_eye',[E+[-.11,.10,0],E+[.015,.14,0],E+[.12,.08,-side*.04]],
                     [(.035,.040),(.042,.043),(.015,.018)],s.dark,self.headidx,6)
        if r=='bison':self._bison()
        elif r=='root_reptile':self._root()
        elif r=='proboscid':self._proboscid()
        else:self._scavenger()
        # Tail structures and add-ons use meaningful rigid pivots, no IK claims.
        self.batch_parts()

    def _bison(self):
        s=self.s;H=self.neckend;L=s.L
        headplate=[H+[-.44,.20,-.40],H+[-.18,.39,-.48],H+[.34,.40,-.44],
                   H+[.49,.23,0],H+[.34,.40,.44],H+[-.18,.39,.48],H+[-.44,.20,.40]]
        self.plate('wide_keratin_frontal_shield',headplate,(.54,.40,.27),self.headidx,.07)
        for side in (-1,1):
            p=H+np.array([-.06,.31,side*.39])
            self.tub('crescent_side_horn',[p,p+[.05,.12,side*.23],p+[-.08,.42,side*.42],p+[-.31,.55,side*.46]],
                     [(.15,.13),(.12,.10),(.075,.07),(.001,.001)],(.43,.36,.25),self.headidx,7)
            ear=[H+np.array([-.24,.09,side*.42]),H+np.array([-.41,.22,side*.51]),
                 H+np.array([-.42,.02,side*.51])]
            self.plate('pointed_ear',ear,(.29,.17,.105),self.headidx,.02)
        # Bold pentagonal shoulder tufts, 3 rows of continuous wedges.
        for side in (-1,1):
            for j in range(10):
                x=.05*L+j*.12;y=s.y+1.01-.06*abs(j-5)
                z=side*(s.w*.79)
                pts=[[x-.075,y+.13,z],[x+.075,y+.12,z+side*.015],
                     [x+.04,y-.24,z+side*.08],[x-.08,y-.36,z+side*.09]]
                self.plate('shoulder_fur_pentagon',pts,(.19,.115,.066) if j%3 else (.275,.15,.09),self.root,.023)
        # Raised high-wither fur mane, shorter on neck and longer over shoulders.
        for j in range(11):
            x=-.10*L+j*.14
            y=s.y+.73+.29*math.sin(j/10*math.pi)
            self.tub('spiked_wither_mane',[[x,y,0],[x-.06,y+.24,0],[x-.16,y+.30,0]],
                     [(.14,.15),(.080,.085),(.001,.001)],(.23,.13,.08),self.root,5)
        self.tub('tapered_tail',[self.tailbase,self.tailbase+[-.24,-.18,0],self.tailbase+[-.46,-.42,0]],
                 [(.105,.10),(.071,.071),(.011,.009)],s.base,self.tailidx,7)
        for k in range(6):
            b=self.tailbase+[-.45,-.40,(k-2.5)*.024]
            self.tub('terminal_tail_brush',[b,b+[-.14,-.17,0]],[(.055,.04),(.001,.001)],s.dark,self.tailidx,5)

    def _root(self):
        s=self.s;L=s.L;H=self.neckend
        # Low, overlapping shield carapace; geometry follows flat top and slopes.
        for row,z in enumerate((-.55,0,.55)):
            for j in range(8):
                x=(-.37+j*.105)*L;ys=s.y+s.h*(.83 if row else .74)
                if row==2:ys=s.y+s.h*.74
                p=[[x-.22,ys-.10,z-.15],[x-.10,ys+.04,z-.18],
                   [x+.21,ys+.04,z+.06],[x+.22,ys-.10,z+.21],[x-.10,ys-.13,z+.15]]
                c=(.48,.345,.205) if (j+row)%2==0 else (.35,.275,.17)
                self.plate('low_polygon_shingle',p,c,self.root,.035)
        for side in (-1,1):
            for j in range(3):
                x=(.22+j*.13)*L;z=side*.65
                yy=s.y+.12
                plate=[[x-.19,yy+.08,z],[x-.06,yy+.17,z+side*.035],
                       [x+.19,yy+.14,z+side*.06],[x+.15,yy-.12,z],[x-.14,yy-.11,z]]
                self.plate('overlap_scapular_armor',plate,(.46,.33,.20),self.root,.038)
        # Angular beak: large tip, not a rounded mammal muzzle.
        self.tub('hard_root_pulling_beak',[H+[.60,-.13,0],H+[.80,-.15,0],H+[1.00,-.29,0]],
                 [(.21,.21),(.18,.19),(.003,.003)],(.46,.37,.255),self.headidx,7)
        for side in (-1,1):
            self.tub('nostril_lip',[H+[.73,-.07,side*.16],H+[.81,-.10,side*.14]],
                     [(.04,.038),(.008,.008)],(.14,.12,.10),self.headidx,6)
        self.tub('thick_tapered_tail',[self.tailbase,self.tailbase+[-.40,-.05,0],
                 self.tailbase+[-.87,-.17,0],self.tailbase+[-1.32,-.30,0]],
                 [(.30,.31),(.22,.23),(.14,.15),(.008,.009)],s.base,self.tailidx,8)
        for j in range(9):
            x=self.tailbase[0]-.19-j*.13;y=self.tailbase[1]+.20-j*.045
            self.plate('tail_osteoderm',[[x-.07,y,0],[x-.012,y+.085,0],[x+.08,y-.015,0]],
                       (.44,.31,.19),self.tailidx,.025)

    def _proboscid(self):
        s=self.s;H=self.neckend
        for side in (-1,1):
            z=side*.43
            self.plate('triangular_large_ear',[H+[-.18,.11,z],H+[-.48,.48,z+side*.07],
                    H+[-.81,.43,z+side*.12],H+[-.82,.10,z+side*.10],H+[-.44,-.15,z]],
                    (.57,.36,.24),self.headidx,.04)
            self.plate('inner_ear_fold',[H+[-.40,.13,z+side*.02],H+[-.54,.38,z+side*.07],
                    H+[-.72,.32,z+side*.08],H+[-.63,.04,z+side*.05]],
                    (.70,.50,.35),self.headidx,.015)
        base=H+[.54,-.17,0];mid=base+[.22,-.23,0];bend=mid+[.04,-.35,0];end=bend+[.39,.02,0]
        self.tub('angular_trunk_base',[base,base+[.15,-.10,0],mid,bend],
                 [(.24,.24),(.225,.22),(.16,.17),(.12,.135)],s.base,self.trunk_upper,9)
        self.tub('angular_trunk_mobile_tip',[bend,bend+[.19,-.13,0],end,end+[.07,.12,0]],
                 [(.13,.14),(.105,.12),(.076,.085),(.019,.02)],s.base,self.trunk_tip,8)
        self.tub('prehen_tip_nostrils',[end+[.07,.12,0],end+[.09,.115,0]],
                 [(.043,.054),(.044,.054)],(.27,.19,.16),self.trunk_tip,7)
        self.tub('thin_tail',[self.tailbase,self.tailbase+[-.28,-.12,0],self.tailbase+[-.50,-.38,0]],
                 [(.11,.11),(.071,.075),(.003,.003)],s.base,self.tailidx,7)
        # Distinctive pale diamond coat patterns are large flat polygons.
        for side in (-1,1):
            for i in range(5):
                x=(-.32+i*.14)*s.L;z=side*s.w*1.02;y=s.y+(.11 if i%2==0 else -.08)
                pts=[[x-.12,y+.19,z],[x+.05,y+.23,z+side*.012],
                     [x+.16,y-.08,z+side*.021],[x-.07,y-.18,z+side*.02]]
                self.plate('geometric_cream_flank_patches',pts,(.72,.58,.41),self.root,.013)

    def _scavenger(self):
        s=self.s;H=self.neckend;L=s.L
        for side in (-1,1):
            # Angular jaw: adult terrestrial scavenger, not a generic armored tank.
            z=side*.21
            self.tub('long_cutting_jawline',[H+[.10,-.25,z],H+[.53,-.25,z*.80],H+[.97,-.16,z*.53]],
                     [(.055,.055),(.052,.049),(.005,.005)],(.15,.13,.11),self.jawidx,7)
            for j in range(9):
                x=H[0]+.27+j*.078;y=H[1]-.24
                self.tub('interlocked_cutting_teeth',[[x,y,z*.76],[x+.016,y-.10,z*.76]],
                         [(.034,.029),(.001,.001)],(.83,.73,.58),self.jawidx,5)
            # Red gular stripe reads at side view and sets it apart from herbivores.
            for k in range(5):
                x=.88+k*.17;z=side*.58;yy=s.y+.08
                self.plate('rust_gular_angular_scales',[[x-.08,yy+.16,z],[x+.09,yy+.14,z+side*.025],
                           [x+.11,yy-.10,z+side*.03],[x-.06,yy-.16,z]],
                           (.51,.215,.135),self.root,.020)
        # Sparse firm dorsal keel only, never Raizauro's heavy shell.
        for j in range(13):
            x=(-.40+.078*j)*L;y=s.y+s.h*.88
            self.plate('low_keeled_scales',[[x-.12,y-.01,0],[x-.035,y+.11,0],[x+.13,y-.02,0]],
                       (.26,.215,.175),self.root,.025)
        self.tub('long_tapered_counterweight_tail',[self.tailbase,
                  self.tailbase+[-.37,-.05,0],self.tailbase+[-.88,-.18,0],
                  self.tailbase+[-1.38,-.33,0],self.tailbase+[-1.89,-.42,0]],
                 [(.25,.255),(.22,.225),(.14,.15),(.072,.075),(.003,.003)],s.base,self.tailidx,8)


def generate(sid,out):
    creature=AngularCreature(SPECS[sid])
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    path=out/f'{sid}-angular-source-v02.glb'
    result=creature.glb(path)
    assert result['skinJoints']>=17 and result['animationCount']==len(b.CLIPS[sid])
    print('SOURCE',sid,result['triangles'],'tris',result['skinJoints'],'joints',flush=True)
    return path,result

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument('--only',choices=list(SPECS));ap.add_argument('--out',type=Path,default=ROOT/'sources');a=ap.parse_args()
    for sid in ([a.only] if a.only else SPECS):generate(sid,a.out/sid)