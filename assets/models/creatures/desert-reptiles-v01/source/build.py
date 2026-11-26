#!/usr/bin/env python3
"""Wildhaven v01 — four original small desert herbivorous reptiles.

Genuine GLB export, UV-painted markings, and intentional flat-shaded anatomy.
X=forward, Y=up, Z=lateral. Static morphology checkpoint (no rigs).
Authoring: vertex/face geometry used only for actual form; all patches painted
on a 2048px texture. Build any species with `--species ...`.
"""
from __future__ import annotations
import argparse, json, math, hashlib, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh

BASE = Path(__file__).resolve().parent.parent
OUTROOT = Path(os.environ.get('WILDHAVEN_MODELS_ROOT', str(BASE)))
SPECIES={
 'caudraco': dict(name='Caudraco', length=.95, mass_kg=6.0, bio='rocky_desert', main=(176,122,76), shadow=(78,55,46), cream=(222,184,131),
   feature='Spiked muscular defensive tail; herbivore of shrubs, seeds and seedpods', defense='tail_sweep_and_burrow_block'),
 'lajurim': dict(name='Lajurim',length=.70,mass_kg=3.0,bio='rocky_desert',main=(108,100,82),shadow=(48,51,47),cream=(186,163,124),
   feature='Extremely dorsoventrally flattened body and bracing flanks for rock crevices',defense='wedge_brace_in_rock_crevice'),
 'cornevio': dict(name='Cornévio',length=.55,mass_kg=1.5,bio='desert',main=(189,121,76),shadow=(105,67,51),cream=(237,188,135),
   feature='Two short rearward brow horns, broad body, threatening rib expansion',defense='rib_expand_and_horns'),
 'fossario': dict(name='Fossário',length=.80,mass_kg=2.5,bio='dunes',main=(204,177,123),shadow=(104,78,60),cream=(238,213,164),
   feature='Streamlined wedge snout, shovel claws and bright decoy tail markings',defense='rapid_sand_burrow_and_tail_decoy'),
}


def atlas(spec: str, dest: Path):
    """Paint single 2048x2048 diffuse atlas; stripes/spots are real pixels."""
    n=2048; m=SPECIES[spec]; rng=np.random.default_rng(20261110 + list(SPECIES).index(spec)*109)
    x=np.linspace(0,1,n)[None,:]; y=np.linspace(0,1,n)[:,None]
    base=np.array(m['main'],float); dark=np.array(m['shadow'],float); light=np.array(m['cream'],float)
    # Torso/tail region: v from ring azimuth, belly at v=.50; top at 0/1.
    dorsal=np.clip((np.abs(y-.5)-.17)*3.5,0,1)
    belly=np.exp(-((y-.50)/.165)**2)
    waves=np.sin(x*38+np.sin(y*28)*1.8+np.sin(x*127)*.4)
    diffuse=(rng.standard_normal((n,n))*.032 +
             .07*np.sin(x*96+y*32)*np.sin(y*89-x*7))
    band=(np.sin(x*39+.8*np.sin(y*23))>.53).astype(float)
    # Wide painted markings over upper flanks, no geometric paint polygons.
    pattern=(0.30*np.maximum(0,waves)+0.48*band)*(dorsal**1.2)
    if spec=='lajurim': pattern=.24*np.maximum(0,np.sin(x*25+y*32))*(dorsal**1.4)+.44*band*dorsal
    if spec=='cornevio': pattern=.23*np.maximum(0,np.cos(x*31 + y*64))*dorsal+.29*band*dorsal
    if spec=='fossario': pattern=.31*np.maximum(0,np.sin(x*52 + y*32))*dorsal+.25*band*dorsal
    color=(base[None,None,:] * (1-pattern[:,:,None]) + dark[None,None,:] * pattern[:,:,None])
    color=color*(1-belly[:,:,None]*.16)+light[None,None,:]*belly[:,:,None]*.16
    color += diffuse[:,:,None]*58
    # Tiny dense painted skin scales; no polygons for individual scales.
    xx=np.arange(n)[None,:]; yy=np.arange(n)[:,None]
    stipple=(np.sin(xx*.24+np.sin(yy*.13)*.8)*np.sin(yy*.26+np.sin(xx*.13)))*3.0
    color += stipple[:,:,None]
    pixels=np.uint8(np.clip(color,0,255));
    # Separate constant paint swatches in narrow right side of the same atlas.
    patches=[(.80,.86,(217,185,129)),(.86,.92,(64,56,49)),(.92,.96,(29,27,23)),(.96,1,(178,134,76))]
    for u0,u1,col in patches: pixels[:,int(u0*n):int(u1*n),:] = np.array(col,np.uint8)
    im=Image.fromarray(pixels,'RGB'); dest.parent.mkdir(parents=True,exist_ok=True);im.save(dest,optimize=True)
    return im

class Model:
    def __init__(self,spec):
        self.spec=spec;self.m=SPECIES[spec]
        self.v=[];self.f=[];self.uv=[];self.parts=[]
        self.marks=[]
    def _add(self,name,verts,faces,uv=None,paint='skin'):
        verts=np.asarray(verts,float);faces=np.asarray(faces,int)
        if not len(verts) or not len(faces): return
        if uv is None:
            x=verts[:,0]
            u=np.clip(.06+.64*(x+.65)/1.35,.015,.745)
            # planes/appendages should sample the main skin map too
            v=np.mod(.47 + verts[:,2]*1.45,1)
            uv=np.column_stack([u,v])
        uv=np.asarray(uv,float)
        if paint!='skin':
            swatches={'ivory':.825,'claw':.88,'eye':.938,'amber':.982}
            uv=np.tile([swatches[paint],.45],(len(verts),1))
        assert len(uv)==len(verts)
        i=len(self.v);self.v.extend(verts.tolist());self.f.extend((faces+i).tolist());self.uv.extend(uv.tolist());self.parts.append({'name':name,'triangles':len(faces)})
    def loft_x(self,name,sections,sides=14,paint='skin'):
        verts=[];f=[];uv=[]
        for j,(x,y,z,ry,rz) in enumerate(sections):
            for k in range(sides):
                t=2*np.pi*k/sides
                verts.append((x,y+ry*math.cos(t),z+rz*math.sin(t)))
                uv.append((np.clip(.06+.64*(x+.65)/1.35,.015,.745),k/sides))
        for j in range(len(sections)-1):
            for k in range(sides):
                a=j*sides+k;b=j*sides+(k+1)%sides
                c=(j+1)*sides+k;d=(j+1)*sides+(k+1)%sides
                f.extend(((a,b,c),(b,d,c)))
        for k in range(1,sides-1):f.append((0,k+1,k))
        end=(len(sections)-1)*sides
        for k in range(1,sides-1):f.append((end,end+k,end+k+1))
        self._add(name,verts,f,uv,paint)
    def limb(self,name,points,radii,sides=10,paint='skin'):
        """Connected tapered polyhedral limb with joint-aware side sections."""
        p=np.array(points,float); v=[];f=[];uv=[]
        for j,c in enumerate(p):
            direction=p[min(j+1,len(p)-1)]-p[max(0,j-1)]
            direction/=max(np.linalg.norm(direction),1e-9)
            helper=np.array([1.,0,0]) if abs(direction[0])<.9 else np.array([0,0,1.])
            a=np.cross(direction,helper);a/=max(np.linalg.norm(a),1e-9);b=np.cross(direction,a)
            r=radii[j]
            for k in range(sides):
                t=k*2*np.pi/sides
                q=c+r*(math.cos(t)*a+math.sin(t)*b)
                v.append(q.tolist());uv.append((np.clip(.06+.64*(q[0]+.65)/1.35,.015,.745),k/sides))
        for j in range(len(points)-1):
            for k in range(sides):
                a=j*sides+k;b=j*sides+(k+1)%sides;c=(j+1)*sides+k;d=(j+1)*sides+(k+1)%sides
                f.extend(((a,c,b),(b,c,d)))
        for k in range(1,sides-1):f.append((0,k,k+1))
        e=(len(points)-1)*sides
        for k in range(1,sides-1):f.append((e,e+k+1,e+k))
        self._add(name,v,f,uv,paint)
    def spike(self,name,root,tip,radius=.015,sides=5,paint='ivory'):
        # Actual keratin geometry changes silhouette; marks remain in atlas.
        a=np.array(root,float);b=np.array(tip,float)
        normal=(b-a)/max(np.linalg.norm(b-a),1e-8)
        h=np.array([0,1,0]) if abs(normal[1])<.90 else np.array([1,0,0])
        r=np.cross(normal,h);r/=max(np.linalg.norm(r),1e-8);w=np.cross(normal,r)
        v=[(a+radius*(math.cos(t*2*math.pi/sides)*r+math.sin(t*2*math.pi/sides)*w)).tolist() for t in range(sides)];v.append(b.tolist())
        f=[(i,(i+1)%sides,sides) for i in range(sides)];f.extend([(0,i+1,i) for i in range(1,sides-1)])
        self._add(name,v,f,paint=paint)
    def eye(self,name,x,y,z,rx=.016,ry=.012,rz=.004):
        # Recessed eye embedded in side of an anatomically tapering cranium.
        v=[];f=[];num=9;levels=5
        for j in range(levels):
            a=(j+1)*math.pi/(levels+1)
            for k in range(num):
                t=k*2*math.pi/num
                v.append([x+rx*math.cos(t)*math.sin(a),y+ry*math.cos(a),.91*z+rz*math.sin(t)*math.sin(a)])
        for j in range(levels-1):
            for k in range(num):
                a=j*num+k;b=j*num+(k+1)%num;c=(j+1)*num+k;d=(j+1)*num+(k+1)%num
                f.extend([(a,b,c),(b,d,c)])
        self._add(name,v,f,paint='eye')

    def foot(self,x,side,span,front,claw_scale=1.0,shovel=False):
        z=side*span
        cx=x+(.035 if front else -.035)
        self.limb(f'foot_{x:.2f}_{side}',[(cx,.060,z),(cx+.028,.038,z+side*.015),(cx+.050,.024,z+side*.036)],(.024,.022,.017),7)
        for toe in range(4):
            zz=z+side*.035 + (toe-1.5)*.015
            tipx=cx+.064 + (.006 if toe in (1,2) else 0)
            self.limb(f'toe_digit_{x:.2f}_{side}_{toe}',[(cx+.038,.028,zz*.97),(tipx,.021,zz)],(.008,.005),5,'skin')
            self.spike(f'toe_claw_{x:.2f}_{side}_{toe}',(tipx,.023,zz),(tipx+(.024 if shovel else .017)*claw_scale,.009,zz),.010 if shovel else .006,5,'claw')
    def legs(self,front_x,back_x,y,span,thick,short=False,shovel=False):
        for front,x in [(True,front_x),(False,back_x)]:
            for side in (-1,1):
                z=span*side
                # Shoulder root lies buried into the torso; elbow projects sideways.
                points=[(x,y,z*.79),(x+(.002 if front else -.028),y*.66,z*1.20),(x+(.014 if front else -.024),.068,z*1.32),(x+(.028 if front else -.030),.044,z*1.36)]
                rad=[thick*.91,thick,thick*.66,thick*.43]
                if short: rad=[v*.90 for v in rad]
                self.limb(('front' if front else 'back')+f'_leg_{side}',points,rad,10)
                self.foot(x,side,span*1.36,front,shovel=shovel)

    def common_head(self,sections,eye_x,eye_y,eye_z,belly=False):
        self.loft_x('faceted_skull',sections,12)
        self.loft_x('actual_lower_jaw',[(sections[0][0]+.017,sections[0][1]-.045,0,.027,sections[0][4]*.78),
                     (sections[-1][0]-.025,sections[-1][1]-.039,0,.028,sections[-1][4]*.93),
                     (sections[-1][0]+.004,sections[-1][1]-.032,0,.012,sections[-1][4]*.68)],10)
        for side in (-1,1):
            self.eye('recessed_eye_'+str(side),eye_x,eye_y,side*eye_z)
            self.spike('nostril_'+str(side),(sections[-1][0]-.010,sections[-1][1]+.012,side*sections[-1][4]*.6),
                         (sections[-1][0]-.006,sections[-1][1]+.013,side*sections[-1][4]*.64),.006,5,'eye')

    def build_caudraco(self):
        self.loft_x('barrel_trunk',[
            (-.18,.166,0,.045,.074),(-.14,.18,0,.09,.12),(-.07,.189,0,.112,.145),
            (.02,.193,0,.115,.151),(.11,.190,0,.108,.144),(.18,.179,0,.08,.114),(.22,.17,0,.046,.07)],16)
        self.loft_x('neck_transition',[(.16,.170,0,.052,.075),(.23,.173,0,.065,.076),(.30,.181,0,.053,.07)],12)
        self.common_head([(.275,.179,0,.059,.071),(.33,.177,0,.058,.082),(.40,.165,0,.046,.073),(.445,.156,0,.035,.058),(.470,.154,0,.024,.05)],.345,.191,.082)
        self.loft_x('heavy_spined_tail',[(-.57,.102,0,.012,.013),(-.52,.112,0,.044,.045),(-.46,.115,0,.058,.063),(-.39,.122,0,.073,.074),(-.32,.137,0,.085,.086),(-.24,.154,0,.093,.092),(-.17,.166,0,.069,.072)],12)
        self.legs(.17,-.13,.174,.135,.046)
        # Defensive rings of horn spikes, integrated into tail as actual silhouette.
        for i,x in enumerate(np.linspace(-.49,-.245,7)):
            proportion=(x+.50)/.26
            y=.116+.045*proportion;rad=.053+.043*proportion
            for j in range(6):
                a=(j+0.2)*math.pi/5; s=math.sin(a);c=math.cos(a)
                root=[x,y+rad*c,rad*s]
                tip=[x-.006,y+(rad+.028+.007*proportion)*c,(rad+.038)*s]
                self.spike(f'tail_defensive_ring_{i}_{j}',root,tip,.012,4)
        # Brow wedges act as facial identity rather than random decoration.
        for s in (-1,1):self.spike(f'brow_hook_{s}',(.339,.22,s*.066),(.356,.232,s*.070),.014,4)

    def build_lajurim(self):
        self.loft_x('extremely_flat_slab_body',[(-.17,.085,0,.023,.099),(-.11,.092,0,.045,.195),
         (-.05,.097,0,.057,.225),(.04,.095,0,.060,.238),(.125,.093,0,.053,.218),(.21,.087,0,.039,.135),(.25,.088,0,.026,.091)],16)
        self.loft_x('broad_slab_neck',[(.18,.085,0,.027,.132),(.244,.090,0,.032,.127),(.30,.09,0,.034,.12)],12)
        self.common_head([(.28,.094,0,.036,.127),(.32,.092,0,.039,.132),(.39,.082,0,.033,.125),(.425,.072,0,.024,.100)],.34,.102,.135)
        self.loft_x('short_flat_tail',[(-.31,.068,0,.006,.012),(-.28,.075,0,.027,.035),(-.235,.078,0,.038,.068),(-.17,.085,0,.033,.09)],12)
        self.legs(.18,-.12,.086,.193,.037,short=True)
        # Sculpted angular flank ribs/trusses with real wedge silhouettes, not color marks.
        for s in (-1,1):
            for i,x in enumerate(np.linspace(-.097,.14,5)):
                z=(.19+.017*math.sin((i+1)*math.pi/6))*s
                self.spike(f'flank_wedged_brace_{s}_{i}',(x,.088,z),(x-.014,.084,z+s*.018),.022,4,'claw')

    def build_cornevio(self):
        self.loft_x('short_rhombus_trunk',[(-.125,.105,0,.026,.07),(-.092,.118,0,.064,.117),
         (-.018,.127,0,.081,.162),(.065,.126,0,.082,.166),(.125,.116,0,.063,.117),(.173,.11,0,.039,.08)],14)
        self.loft_x('neck',[(.138,.11,0,.039,.075),(.188,.112,0,.049,.077),(.234,.12,0,.036,.076)],12)
        self.common_head([(.22,.125,0,.045,.088),(.265,.126,0,.049,.092),(.318,.118,0,.037,.078),(.355,.109,0,.022,.060)],.273,.142,.091)
        self.loft_x('compact_tail',[(-.20,.082,0,.012,.014),(-.183,.086,0,.029,.036),(-.13,.10,0,.041,.070)],10)
        self.legs(.135,-.10,.107,.14,.034,short=True)
        for s in (-1,1):
            self.spike(f'backward_brow_horn_{s}',(.27,.160,s*.074),(.207,.211,s*.101),.027,6,'ivory')
            self.spike(f'rigid_cheek_flange_{s}',(.258,.121,s*.084),(.242,.110,s*.139),.025,5)
        # Thoracic lateral keel is real projected morphology for inflated defensive stance.
        for s in (-1,1):
            for i,x in enumerate([-.07,-.01,.05,.11]):
                self.spike(f'lateral_rib_keel_{s}_{i}',(x,.107,s*.151),(x+.007,.112,s*.171),.025,5)

    def build_fossario(self):
        self.loft_x('streamlined_skink_torso',[(-.17,.106,0,.026,.051),(-.12,.112,0,.057,.079),
         (-.045,.119,0,.075,.100),(.06,.118,0,.077,.102),(.15,.114,0,.070,.089),(.22,.109,0,.045,.07)],16)
        self.loft_x('elongated_neck',[(.175,.107,0,.048,.066),(.25,.112,0,.048,.062),(.32,.109,0,.031,.051)],12)
        self.common_head([(.30,.111,0,.043,.060),(.346,.11,0,.039,.065),(.405,.105,0,.029,.067),(.46,.088,0,.012,.064)],.345,.122,.065)
        # Soil displacing broad nasal scoop, real wedge nose crest.
        self.spike('nasal_sand_shovel_crest',(.416,.092,0),(.476,.072,0),.036,6,'ivory')
        self.loft_x('flexible_attention_tail',[(-.55,.08,0,.004,.004),(-.50,.079,0,.029,.031),
         (-.43,.091,0,.042,.041),(-.35,.10,0,.053,.055),(-.26,.105,0,.060,.069),(-.17,.106,0,.055,.058)],12)
        self.legs(.165,-.12,.103,.096,.033,short=True,shovel=True)
        # Enlarged shovel keratin tips of forelimbs are articulated geometry.
        for s in (-1,1):
            for i in range(3):
                z=s*(.14+i*.019)
                self.spike(f'sand_scrape_digging_claw_{s}_{i}',(.205,.043,z),(.240,.013,z),.013,5,'ivory')

    def finalize(self,outdir):
        v=np.array(self.v,dtype=np.float32);f=np.array(self.f,dtype=np.int64);uv=np.array(self.uv,dtype=np.float32)
        assert np.isfinite(v).all() and np.isfinite(uv).all() and f.max()<len(v)
        image=atlas(self.spec,outdir/'texture'/f'{self.spec}-v01-painted-albedo.png')
        # trimesh exports this texture inside GLB as a regular glTF base color map.
        material=trimesh.visual.material.PBRMaterial(baseColorTexture=image,metallicFactor=0,roughnessFactor=.95,
                                                   doubleSided=True,alphaMode='OPAQUE',name=f'{self.spec}_painted_albedo')
        mesh=trimesh.Trimesh(vertices=v,faces=f,process=False)
        mesh.visual=trimesh.visual.TextureVisuals(uv=uv,material=material)
        scene=trimesh.Scene();scene.add_geometry(mesh,node_name=f'{self.spec}_root',geom_name=f'{self.spec}_body')
        dest=outdir/f'{self.spec}-v01-textured-blockout.glb';blob=scene.export(file_type='glb');dest.write_bytes(blob)
        imported=trimesh.load(dest,force='scene',process=False)
        geoms=[g for g in imported.geometry.values() if isinstance(g,trimesh.Trimesh)]
        assert len(geoms)==1 and sum(len(g.faces) for g in geoms)==len(f)
        imported_image=geoms[0].visual.material.baseColorTexture
        assert imported_image is not None and imported_image.size==(2048,2048)
        # Re-imported atlas from the actual GLB must be pixel-perfect.
        assert np.array_equal(np.asarray(imported_image.convert('RGB')), np.asarray(image.convert('RGB')))
        sha=hashlib.sha256(blob).hexdigest()
        report={'species_id':self.spec,'name':self.m['name'],'version':'v01',
                'base':'main:9e84c8b8750a041a9f41c10dc192ee05ee9f339d',
                'approved_concept':'user approved four reptile concepts and asked to build GLBs; individual designs remain under review',
                'stage':'static_textured_blockout_for_form_approval','habitat':self.m['bio'],'diet':'herbivore',
                'description':self.m['feature'],'defense':self.m['defense'],
                'length_design_m':self.m['length'],'mass_design_kg':self.m['mass_kg'],
                'glb':dest.name,'bytes':len(blob),'sha256':sha,
                'triangle_count':int(len(f)),'triangle_count_method':'sum mesh primitive triangles after actual GLB reimport',
                'glb_meshes':len(geoms),'materials':1,'uv_atlas_px':[2048,2048],
                'painted_markings_not_extra_polygons':True,'paint_map':f'texture/{self.spec}-v01-painted-albedo.png',
                'skins':0,'joints':0,'animations':0,'lods':1,'skeleton':'not requested until form approval',
                'components_authoring':len(self.parts),'components':self.parts,
                'render_evidence_source_sha256':sha,'previews':{},'integrated_game':False,'art_status':'pending_form_approval',
                'publication':'not_published_yet'}
        (outdir/'manifest.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
        return report

def build(spec):
    m=Model(spec);getattr(m,'build_'+spec)();out=(OUTROOT/spec/'v01') if os.environ.get('WILDHAVEN_MODELS_ROOT') else BASE/spec;out.mkdir(parents=True,exist_ok=True)
    report=m.finalize(out);print(spec,report['triangle_count'],'triangles',report['bytes'],'bytes',report['sha256']);return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--species',nargs='+',choices=list(SPECIES),default=list(SPECIES));a=p.parse_args()
    for spec in a.species:build(spec)
