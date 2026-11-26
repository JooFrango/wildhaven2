#!/usr/bin/env python3
"""Wildhaven Talvero v04: facial anatomy, integrated muscular shading and fur crest.

Builds true skinned glTF 2.0 (not generated concept pictures). The sculpt is a
continuation of v03; previous published GLBs are never overwritten.
"""
from __future__ import annotations
import hashlib, json, math
from pathlib import Path
import numpy as np
import base_v03 as old
import base_v02 as legacy

HERE=Path(__file__).resolve().parents[1]
OUT=HERE/'output'/'talvero'
S=old.S

class TalveroV04(old.Talvero):
    def make_body(self):
        super().make_body()
        V=self.skin_data['vertices'].copy()
        s=self.s
        # A deliberate horse-like facial wedge: longer nose and narrowed snout.
        # Preserve the load-bearing neck and existing high quality limb skin weights.
        n=self.neckend
        factor=np.clip((V[:,0]-(n[0]+.09))/.59,0.,1.)
        upper=np.clip((V[:,1]-(n[1]-.26))/.34,0.,1.)
        head= factor*upper
        V[:,0] += .20*head
        V[:,2] *= (1.-.20*head)
        # Concave cranial plane, descending long facial bridge into a slim muzzle.
        nose=np.clip((V[:,0]-(n[0]+.20))/.66,0.,1.)
        V[:,1] -= .090*nose*upper
        V[:,1] += .010*head
        # Raised loin and narrower abdomen: robust rib cage but not a barrel.
        loin=np.exp(-((V[:,0]+.04)/.47)**4)
        abdomen=np.clip((s.y+.03-V[:,1])/.48,0,1)
        V[:,1] += .065*loin*abdomen
        V[:,2] *= (1.-.08*loin)
        # Subtle anatomy-specific tendon relief along the lower shoulders.
        for cx,cy,cz,radius,amount in [
            (.78,1.18,.34,.42,.021),(.81,1.32,-.34,.42,.021),
            (-.84,1.18,.30,.39,.021),(-.84,1.18,-.30,.39,.021)]:
            dx=(V[:,0]-cx)/radius;dy=(V[:,1]-cy)/radius;dz=(V[:,2]-cz)/radius
            bump=np.exp(-2.4*(dx*dx+dy*dy+dz*dz))*amount
            V[:,2]+=np.sign(V[:,2])*bump
        self.skin_data['vertices']=V.astype(np.float32)
        # Update normals and skin data after vertex warping.
        from trimesh import Trimesh
        tri=Trimesh(vertices=V,faces=self.skin_data['faces'],process=False)
        self.skin_data['normals']=np.asarray(tri.vertex_normals,np.float32)
        self.skin_data['colors']=self.vertex_colors(V)
        joints,weights=self.compute_skin(V)
        self.skin_data['joints']=joints
        self.skin_data['weights']=weights

    def vertex_colors(self,V):
        cols=super().vertex_colors(V).astype(np.float32)/255.
        s=self.s;x,y,z=V[:,0],V[:,1],V[:,2]
        base=np.array(s.base,np.float32)
        dark=np.array(s.dark,np.float32)
        # Dark eye-mask is a continuous coat marking rather than a floating object.
        n=self.neckend
        mask=np.exp(-((x-(n[0]+.08))/.26)**4-((y-(n[1]+.106))/.13)**4)
        sides=np.clip((abs(z)-.11)/.09,0,1)
        factor=(mask*sides*.36)[:,None]
        cols=cols*(1-factor)+np.array((.37,.21,.125))*factor
        # Slender face blaze down to the nasal bridge, visible on the front.
        blaze=np.exp(-((x-(n[0]+.36))/.27)**6)*np.exp(-((z)/.070)**2)
        blaze*=np.clip((y-(n[1]-.13))/.22,0,1)
        cols=cols*(1-.38*blaze[:,None])+np.array((.89,.77,.57))*(.38*blaze[:,None])
        # Cinnamon haunch shadow, warm muscular contour, dark stocking stripes.
        ham=np.exp(-((x+.82)/.42)**2-((y-1.29)/.25)**2)*np.clip((abs(z)-.20)/.23,0,1)
        cols=cols*(1-.13*ham[:,None])
        for leg in self.legs:
            x0=leg['ankle'][0]
            mask=np.exp(-((x-x0)/.17)**4)*np.clip((.68-y)/.40,0,1)*np.clip((abs(z)-.11)/.28,0,1)
            cols=cols*(1-.14*mask[:,None])+dark*(.14*mask[:,None])
        # Soft painterly high-frequency coat highlights without arbitrary spots.
        grain=np.sin(111*x+43*y+59*z)*np.sin(70*x-104*z+37*y)
        cols=np.clip(cols*(1+.025*grain[:,None]),0,1)
        return np.rint(cols*255).astype(np.uint8)

    def solid(self,name,c,rad,col,parent,nu=28,nv=18):
        v,f=self.ellmesh(np.asarray(c,float),rad,nu,nv)
        self.add_part(name,v,f,col,parent)

    def swept_fur(self,name,pts,radii,col,parent,segments=10):
        v,f=self.tube(pts,radii,segments)
        self.add_part(name,v,f,col,parent)

    def add_details(self):
        s=self.s;n=self.neckend
        rng=np.random.default_rng(41032026)
        # Masseter, recessed cheek, brow and nasal skin all attach to animated head.
        # Root mostly buried inside the contiguous head sculpt to avoid glued-on spheres.
        for sign in (-1,1):
            self.solid('zygomatic_arch', n+[.090,-.021,.155*sign],(.192,.114,.047),(.58,.29,.14),self.headidx)
            self.solid('masseter_slab',n+[.19,-.086,.161*sign],(.16,.096,.043),(.55,.275,.125),self.headidx)
            # Slim upper eyelid bridge and deep eye socket housing.
            eye=n+np.array((.156,.105,.182*sign))
            self.solid('orbital_shadow', eye,[.082,.061,.039],(.265,.133,.076),self.headidx)
            self.solid('eyeball',eye+[.018,-.002,.034*sign],[.041,.034,.023],(.107,.079,.057),self.headidx)
            self.solid('gold_iris',eye+[.033,.001,.055*sign],[.020,.020,.011],(.72,.45,.16),self.headidx)
            self.solid('deep_pupil',eye+[.04,.001,.064*sign],[.010,.013,.007],(.031,.025,.022),self.headidx)
            self.solid('eye_catchlight',eye+[.044,.012,.067*sign],[.008,.008,.005],(.98,.94,.82),self.headidx)
            # Sculpted eyelid: eyelid strips follow eye naturally and form the brow ridge.
            for path,rads,color in [
                ([eye+[-.08,.018,.026*sign],eye+[-.02,.058,.037*sign],eye+[.055,.042,.029*sign]], [.027,.029,.014],(.43,.21,.115)),
                ([eye+[-.074,-.018,.023*sign],eye+[.003,-.041,.041*sign],eye+[.073,-.014,.020*sign]],[.018,.021,.01],(.41,.22,.13))]:
                self.swept_fur('eyelid_organic',path,rads,color,self.headidx,10)
            # An equine cheek-to-throat transition, soft fold instead of another sphere.
            path=[n+[-.10,-.11,.15*sign],n+[.04,-.235,.16*sign],n+[.21,-.228,.141*sign]]
            self.swept_fur('cheek_fold',path,[.032,.026,.005],(.48,.247,.139),self.headidx)
            # Tapered, thick triangulated ears with warm outer rim and recessed inner face.
            earbase=n+np.array((-.115,.185,.14*sign))
            self.swept_fur('ear_outer',[earbase,earbase+[-.048,.105,.060*sign],
                earbase+[-.120,.215,.105*sign],earbase+[-.185,.29,.142*sign]],
                [.092,.087,.051,.002],(.54,.291,.162),self.headidx,14)
            # Inner layer is physically within the outer ear, not a free-floating plane.
            v,f=self.leaf_mesh([earbase+[.006,.035,.045*sign],earbase+[-.047,.105,.075*sign],
                earbase+[-.119,.211,.124*sign],earbase+[-.165,.27,.141*sign]],
                [.039,.051,.025,.003],.009)
            self.add_part('ear_inner_velvet',v,f,(.25,.12,.102),self.headidx)
            # Pointed sloped nasal rim and inset black nostril in snout, near tip.
            # Surface-conforming nostril (no free-floating round black plugs).
            candidates=self.skin_data['vertices']
            wish=n+np.array((.728,-.127,.129*sign))
            dist=(candidates[:,0]-wish[0])**2+(candidates[:,1]-wish[1])**2+                 (candidates[:,2]-wish[2])**2
            nost=candidates[np.argmin(dist)].astype(float)
            self.solid('nostril_subtle_rim',nost,[.056,.036,.014],(.37,.19,.115),self.headidx)
            self.solid('nostril_recess',nost+[.009,-.003,.009*sign],[.032,.021,.012],(.066,.046,.042),self.headidx)
            # Dark subtle smiling jaw seam along lateral muzzle.
            # Small corner of the jaw remains visible but is physically anchored.
            self.swept_fur('lip_seam',[n+[.41,-.195,.124*sign],n+[.53,-.201,.114*sign],
                n+[.66,-.183,.095*sign]],[.009,.011,.002],(.19,.112,.074),self.headidx,10)
            # Swept forelock just above the forehead, like coarse layered horse hair.
        for strand in range(19):
            th=(strand+.15*rng.random())/19
            root=n+np.array((-.12+.055*th,.228,.14*(2*th-1)))
            length=.12+.09*rng.random()
            self.swept_fur('forelock_strand',[root,root+[.052,.063,.008],root+[.145,.06,.006],
                root+[.145+length*.4,-.015,.003]], [.024,.035,.019,.001],
                tuple(np.array((.185,.107,.077))*(.77+.23*rng.random())),self.headidx,7)
        # Neck muscular fascia lines — gentle relief following neck, not random ornaments.
            nb=self.neckbase
            self.swept_fur('neck_muscular_transition',[
                nb+[-.19,-.23,.215*sign],nb+[.05,-.09,.247*sign],
                nb+[.29,.13,.208*sign],n+[-.18,-.085,.155*sign]],
                [.043,.045,.024,.003],(.49,.243,.114),self.neckidx,12)
        # A broader continuous nape ridge, flowing behind head and visually connecting the mane.
        nb=self.neckbase
        ridge=[nb+[-.19,.18,0],nb+[-.105,.28,0],(nb+n)/2+[-.17,.23,0],
               n+[-.23,.20,0],n+[-.19,.16,0]]
        self.swept_fur('undercoat_mane_base',ridge,[.13,.17,.16,.13,.08],(.18,.102,.071),self.neckidx,18)
        # Interleaved locks with tapered curved surfaces; density and individual lengths vary.
        # These are real 3D volumes instead of disconnected triangular spikes.
        for layer in range(5):
            count=29 if layer in (1,2,3) else 21
            for k in range(count):
                t=(k+.24*rng.random())/count
                start=nb+(n-nb)*t
                r=float(rng.random())
                root=start+np.array((-.20-.029*layer,.218+.015*math.sin(math.pi*t),
                                     (layer-2)*.053))
                length=(.22+.21*math.sin(math.pi*t))*(.73+.33*r)
                points=[root,
                  root+[-length*.30,length*.13, .004*rng.normal()],
                  root+[-length*.62,length*.29,.02*rng.normal()],
                  root+[-length*.93,length*.39,.025*rng.normal()],
                  root+[-length*1.17,length*.43,.02*rng.normal()]]
                w=.025+.016*r
                radii=[w*1.25,w*1.18,w*.95,w*.48,.0017]
                shade=.71+.22*rng.random()+.055*layer
                color=np.array((.19,.126,.09))*shade
                self.swept_fur('layered_nape_fur',points,radii,tuple(color),self.neckidx,7)
        # The crest transitions naturally from the nape to the lower withers and croup.
        # Dark undercoat follows the actual dorsal line, with many short, slanted hairs.
        for row in range(5):
            for j in range(45):
                t=(j+.23*rng.random())/29
                x=-1.00+1.69*t
                y=1.83+.062*t+ .014*math.sin(t*math.pi)
                z=(row-1.5)*.04
                start=np.array((x,y,z))
                length=(.055+.045*rng.random())*(.85+.19*math.sin(t*math.pi))
                end=start+np.array((-.10-length*.62,length*.5,.011*rng.normal()))
                self.swept_fur('fine_dorsal_guard_hair',[start,start+[-length*.29,length*.30,0],end],
                               [.012,.014,.0012],(.19,.118,.084),self.root,6)
        # Layered tail fur with tapered natural strands, in place of a single spike.
        start=self.tailbase
        self.swept_fur('tail_base',[start,start+[-.15,-.08,0],start+[-.32,-.22,0]],
                       [.10,.083,.046],s.base,self.tailidx,14)
        for i in range(45):
            az=i*math.tau/45
            offset=np.array((0,.030*math.sin(az),.047*math.cos(az)))
            t=rng.uniform(.0,1.)
            root=start+[-.32,-.21,0]+offset
            span=.30+.22*t
            points=[root,root+[-span*.25,-span*.22,.015*math.sin(az)],
                    root+[-span*.65,-span*.74,.043*math.cos(az)],
                    root+[-span,-span*1.05,.063*math.cos(az)]]
            self.swept_fur('tail_hair',points,[.026,.036,.020,.0012],
                           tuple(np.array(s.dark)*(.80+.27*rng.random())),self.tailidx,6)
        # Hooves retain v03 split-keratin geometry, anatomical pasterns remain skinned.
        for leg in self.legs:
            self.hoof(leg)
            a=leg['ankle']
            for j in range(5):
                th=math.tau*j/5
                p=a+np.array((.083*math.cos(th),.025,.070*math.sin(th)))
                self.swept_fur('fetlock_fringe',[p,p+[-.018,-.048,.008],p+[-.065,-.112,.012]],
                               [.016,.018,.001],(.29,.155,.09),leg['fetlock'],7)

    def consolidate_parts(self):
        """Batch hair into attached meshes to limit glTF draw calls in the browser.

        Every batch shares its driving skeletal node and an intentionally
        quantized shade. Geometry remains true 3D and the mane still follows
        the neck/head bones through real animation clips.
        """
        grouped={}
        new=[]
        hair={'layered_nape_fur','fine_dorsal_guard_hair',
              'tail_hair','forelock_strand','fetlock_fringe'}
        for name,v,f,col,parent in self.parts:
            if name not in hair:
                new.append((name,v,f,col,parent))
                continue
            shade=tuple(int(round(float(c)*24)) for c in col)
            grouped.setdefault((name,parent,shade),[]).append((v,f,col))
        for (name,parent,shade),parts in grouped.items():
            if len(parts)==1:
                v,f,col=parts[0];new.append((name,v,f,col,parent))
                continue
            verts=[];faces=[];offset=0
            for v,f,_ in parts:
                verts.append(v);faces.append(f+offset);offset+=len(v)
            rgb=np.mean([p[2] for p in parts],axis=0)
            new.append((name,np.concatenate(verts).astype(np.float32),
                        np.concatenate(faces).astype(np.uint32),
                        rgb.astype(np.float32),parent))
        self.parts=new

    def render(self,path,angle='three_quarter'):
        # Render the true animated GLB mesh at neutral rest pose using the inherited VTK renderer.
        return super().render(path,angle)


def build():
    model=TalveroV04(S)
    model.consolidate_parts()
    OUT.mkdir(parents=True,exist_ok=True)
    path=OUT/'talvero-savanna-anatomy-skinned-v04.glb'
    meta=model.glb(path)
    for angle in ('three_quarter','side','front'):
        model.render(OUT/f'talvero-real-3d-{angle}-v04.png',angle)
    record={'species':'talvero','version':'v04','artisticStatus':'in_review',
            'previousModelsPreserved':True,'gameplayIntegrated':False,
            'source':'assets/models/creatures/talvero-v04/source/generate.py',
            'notes':['Revised skull, narrow muzzle, nostrils, eyes, ears',
                     'Layered 3D mane and dorsal hair',
                     'Refined 3D shoulders/haunches/tendons and coat'],
            'model':meta}
    (OUT/'talvero-manifest-v04.json').write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(record,indent=2),flush=True)

if __name__=='__main__':build()