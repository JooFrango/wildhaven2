#!/usr/bin/env python3
"""Wildhaven / Gravarto v01: real textured faceted static anatomy blockout.
X forward, Y up, Z lateral. Intentional geometry only for form; markings are UV-painted
in the single 2048px atlas, NOT different-color geometric overlay patches.
Build deterministically: python source/build.py
"""
from __future__ import annotations
from pathlib import Path
import math, json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'gravarto-v01-anatomy-blockout.glb'
ATLAS=ROOT/'texture/gravarto-v01-albedo.png'
W,H=2048,2048
RNG=np.random.default_rng(11262005)
parts=[]
VERT=[]; UV=[]; FACES=[]
# normalized UV atlas areas: BODY / TAIL / HEAD / LIMBS / HARD PARTS
ZONE={
 'body':(10,10,2038,660),
 'tail':(10,672,2038,980),
 'head':(10,992,2038,1295),
 'limb':(10,1307,2038,1705),
 'accent':(10,1717,2038,2038),
}

def paint_atlas():
    canvas=np.zeros((H,W,3),dtype=np.uint8)
    yy,xx=np.mgrid[0:H,0:W]
    noise1=RNG.normal(0,1,(H,W)).astype(np.float32)
    small=Image.fromarray(RNG.integers(0,256,(64,64),dtype=np.uint8)).resize((W,H),Image.Resampling.BICUBIC)
    cloud=(np.asarray(small,dtype=np.float32)-127.5)/63.0
    for name,(x0,y0,x1,y1) in ZONE.items():
        w=x1-x0;h=y1-y0
        local_x=(xx[y0:y1,x0:x1]-x0)/w
        local_y=(yy[y0:y1,x0:x1]-y0)/h
        if name=='body':
            # y around circumference: top & back at t=0/1, belly t=.5.
            v=local_y
            upper=np.abs(v-.5)*2.0
            base=np.array([119.,82.,54.])[None,None,:]*np.ones((h,w,1))
            shade=(upper[...,None]-.5)*np.array([31.,26.,22.])[None,None,:]
            base=base-shade
            cream=np.clip((0.41-np.abs(v-.5))/0.15,0,1)[...,None]
            base=base*(1-cream)+cream*np.array([186.,147.,103.])
            bandphase=local_x*8.3+(v-.5)*2.7+0.10*np.sin(local_x*28)+.07*cloud[y0:y1,x0:x1]
            bands=np.clip((np.cos(2*math.pi*bandphase)-.24)*1.9,0,1)
            bands*=np.clip((upper-.32)*2.3,0,1)
            base=base*(1-bands[...,None]*.45)
        elif name=='tail':
            v=local_y; upper=np.abs(v-.5)*2
            base=np.ones((h,w,3))*np.array([107.,75.,51.])
            belly=np.clip((.32-np.abs(v-.5))/.20,0,1)[...,None]
            base=base*(1-belly)+belly*np.array([156.,118.,82.])
            band=np.clip((np.cos(local_x*math.tau*8.5+v*3.1)-.1)*2.1,0,1)
            base*=1-band[...,None]*.43
        elif name=='head':
            v=local_y
            base=np.ones((h,w,3))*np.array([108.,76.,53.])
            underside=np.clip((.34-np.abs(v-.5))/.22,0,1)[...,None]
            base=base*(1-underside)+underside*np.array([173.,136.,98.])
            brow=np.clip((np.cos(local_x*math.tau*3.9+v*2.8)-.35)*1.0,0,1)
            base*=1-brow[...,None]*.18
        elif name=='limb':
            v=local_y
            base=np.ones((h,w,3))*np.array([93.,67.,52.])
            mottled=np.cos(local_x*math.tau*4+v*math.tau*2)*np.sin(v*math.tau*5)
            base+=mottled[...,None]*9
        else:
            base=np.ones((h,w,3))*np.array([70.,60.,49.])
            # Accent atlas swatches for eye, claw, scutes, mouth, teeth.
            for start,end,rgb in [(.0,.18,(35,34,29)),(.18,.33,(168,126,51)),(.33,.45,(14,15,14)),(.45,.64,(132,112,81)),(.64,.82,(66,54,44)),(.82,1,(209,190,147))]:
                base[:,int(w*start):int(w*end),:]=rgb
        cloud_local=cloud[y0:y1,x0:x1]
        fine=noise1[y0:y1,x0:x1]
        base+=cloud_local[...,None]*4.5+fine[...,None]*3
        canvas[y0:y1,x0:x1,:]=np.clip(base,0,255).astype(np.uint8)
    img=Image.fromarray(canvas,'RGB')
    # Painted fine scale outlines: no overlay mesh geometry. Small enough for texture.
    layer=Image.new('RGBA',(W,H),(0,0,0,0));draw=ImageDraw.Draw(layer)
    for name in ('body','tail','head','limb'):
        x0,y0,x1,y1=ZONE[name]
        delta=19 if name!='head' else 11
        for row,y in enumerate(range(y0+delta,y1-delta,delta)):
            for x in range(x0+delta+(row%2)*delta//2,x1-delta,delta):
                jitter=int(RNG.integers(-3,4)); R=delta*.42
                draw.arc((x-R,y-R*.62+jitter,x+R,y+R*.62+jitter), 190,347, fill=(32,28,24,39),width=1)
    img=Image.alpha_composite(img.convert('RGBA'),layer).convert('RGB')
    ATLAS.parent.mkdir(parents=True,exist_ok=True)
    img.save(ATLAS,optimize=True)


def uv_of(zone,s,t):
    x0,y0,x1,y1=ZONE[zone]
    px=x0+4+np.clip(s,0,1)*(x1-x0-8)
    py=y0+4+np.clip(t,0,1)*(y1-y0-8)
    return (float(px/W), float(1-py/H))

def add(name, vertices, faces, uv, zone=None):
    v=np.asarray(vertices,dtype=float);f=np.asarray(faces,dtype=int);uv=np.asarray(uv,dtype=float)
    assert len(v)==len(uv), (name,len(v),len(uv))
    if not len(f):return
    if zone:
        uv=np.array([uv_of(zone,s,t) for s,t in uv],dtype=float)
    # Duplicate 3 vertices per triangle: deliberate faceted normals, no global smoothing
    vv=v[f.reshape(-1)]
    uu=uv[f.reshape(-1)]
    base=len(VERT)
    VERT.extend(vv.tolist());UV.extend(uu.tolist())
    FACES.extend((np.arange(len(vv),dtype=int).reshape(-1,3)+base).tolist())
    parts.append({'name':name,'triangles':len(f)})

def loft_x(name,sec,zone,sides=12,phase=None):
    """Each section x, y, z, vertical radius, lateral radius, with anatomical curve."""
    if phase is None: phase=math.pi/sides
    v=[];uv=[];f=[]
    for i,(x,y,z,ry,rz) in enumerate(sec):
        for k in range(sides+1):
            a=math.tau*k/sides+phase
            v.append((x,y+ry*math.cos(a),z+rz*math.sin(a)))
            uv.append((i/(len(sec)-1),k/sides))
    for i in range(len(sec)-1):
        for k in range(sides):
            a=i*(sides+1)+k;b=a+1;c=a+sides+1;d=c+1
            f.extend(((a,b,c),(b,d,c)))
    # Endcaps, using duplicated rings' points; flat shaded by add()
    for k in range(1,sides-1): f.append((0,k,k+1))
    en=(len(sec)-1)*(sides+1)
    for k in range(1,sides-1): f.append((en,en+k+1,en+k))
    add(name,v,f,uv,zone)

def loft_y(name,sec,zone,sides=10):
    """Each section x center, y, z center, width radius in X, in Z. For fore/hind legs."""
    v=[];uv=[];f=[]
    for i,(x,y,z,rx,rz) in enumerate(sec):
        for k in range(sides+1):
            a=math.tau*k/sides + math.pi/sides
            v.append((x+rx*math.cos(a),y,z+rz*math.sin(a)))
            uv.append((i/(len(sec)-1),k/sides))
    for i in range(len(sec)-1):
        for k in range(sides):
            a=i*(sides+1)+k;b=a+1;c=a+sides+1;d=c+1
            f.extend(((a,b,c),(b,d,c)))
    for k in range(1,sides-1): f.append((0,k,k+1))
    en=(len(sec)-1)*(sides+1)
    for k in range(1,sides-1):f.append((en,en+k+1,en+k))
    add(name,v,f,uv,zone)

def wedge(name, pts, depth=.04, target='scute'):
    """Faceted integrated keratin wedge. Physical feature; not a colored spot."""
    pts=np.asarray(pts,float)
    low=pts.copy();low[:,1]-=depth
    v=np.concatenate((pts,low),axis=0)
    n=len(pts)
    f=[]
    for i in range(1,n-1):f.extend(((0,i,i+1),(n,n+i+1,n+i)))
    for i in range(n):j=(i+1)%n;f.extend(((i,j,n+i),(j,n+j,n+i)))
    palette={'scute':.49,'claw':.10,'eye_dark':.07,'iris':.25,'pupil':.39,'tooth':.91,'mouth':.71}
    s=palette.get(target,.5)
    uv=[(s+0.007*math.sin(i*1.6),.5+0.12*math.cos(i*1.8)) for i in range(2*n)]
    add(name,v,f,uv,'accent')

def orb(name,center,radii,swatch='iris',subdiv=1):
    m=trimesh.creation.icosphere(subdivisions=subdiv,radius=1)
    v=m.vertices*np.asarray(radii)[None,:]+np.asarray(center)[None,:]
    palette={'iris':.26,'eye_dark':.055,'pupil':.388,'claw':.075,'tooth':.9}
    uv=np.array([(palette.get(swatch,.05)+.008*x,.5+.05*y) for x,y,z in m.vertices])
    add(name,v,m.faces,uv,'accent')

def build():
    paint_atlas()
    # central torso: compact head at positive X, enormous pectoral and coxal girdles
    loft_x('01_massive_torso',[
      (-1.43,.93,0,.18,.25),(-1.30,.91,0,.40,.48),(-1.12,.91,0,.47,.57),
      (-.83,.94,0,.51,.62),(-.48,.95,0,.55,.65),(-.10,.96,0,.57,.66),
      (.28,.97,0,.55,.64),(.61,.99,0,.53,.59),(.90,1.01,0,.44,.50),
      (1.12,1.04,0,.30,.37),(1.23,1.07,0,.16,.23)],'body',16)
    # neck rises continuously into a broad flat wedge skull
    loft_x('02_heavy_neck',[
      (.91,1.05,0,.36,.44),(1.15,1.10,0,.39,.42),(1.39,1.15,0,.34,.38),
      (1.59,1.18,0,.26,.31),(1.73,1.21,0,.20,.28)],'head',12)
    loft_x('03_angular_skull',[
      (1.55,1.22,0,.20,.27),(1.72,1.24,0,.24,.31),(1.91,1.23,0,.23,.34),
      (2.10,1.19,0,.21,.35),(2.29,1.16,0,.17,.31),(2.46,1.13,0,.13,.26),
      (2.53,1.10,0,.09,.22)],'head',12)
    loft_x('04_lower_jaw',[
      (1.68,1.02,0,.09,.26),(1.85,1.00,0,.12,.33),
      (2.12,1.00,0,.11,.31),(2.39,1.02,0,.09,.27),(2.54,1.045,0,.065,.21)],'head',10)
    # Tail with a genuinely changing cross section; x decreases, mass tapered
    loft_x('05_tail_counterbalance',[
      (-1.13,.96,0,.42,.48),(-1.42,.90,0,.39,.46),(-1.70,.81,0,.32,.40),
      (-2.00,.72,0,.27,.32),(-2.32,.64,0,.22,.25),(-2.67,.57,0,.17,.20),
      (-3.04,.50,0,.12,.15),(-3.43,.43,0,.075,.095),(-3.72,.37,0,.02,.026)],'tail',12)
    # Lower limbs: angular, joint-rich, sprawling stance with planted feet.
    for side in [-1,1]:
      st='left' if side>0 else 'right'
      for fore in (True,False):
        cx=.73 if fore else -1.03
        z=side*(.53 if fore else .56)
        tag='fore' if fore else 'hind'
        if fore:
          sections=[(cx,1.10,z-side*.33,.34,.26),(cx+.08,.86,z+side*.04,.35,.32),
                    (cx+.17,.64,z+side*.28,.28,.27),(cx+.22,.43,z+side*.33,.245,.22),
                    (cx+.30,.28,z+side*.37,.22,.19),(cx+.35,.16,z+side*.40,.20,.19)]
        else:
          sections=[(cx,1.11,z-side*.34,.40,.29),(cx-.11,.85,z+side*.07,.38,.33),
                    (cx-.14,.58,z+side*.29,.29,.27),(cx-.06,.40,z+side*.38,.25,.24),
                    (cx+.05,.26,z+side*.43,.24,.22),(cx+.11,.15,z+side*.45,.22,.20)]
        loft_y('06_'+tag+'_leg_'+st,sections,'limb',12)
        fx,fy,fz,*_=sections[-1]
        # Broad toes embed into lower leg and rest on soil (Y >=0).
        for toe in range(5):
          offset=(toe-2)*.112
          spread=side*.02*abs(toe-2)
          lx=fx+.03+(.024 if toe==2 else 0)
          tz=fz+offset+spread
          loft_x(f'07_{tag}_{st}_toe_{toe}',[
              (lx-.08,.125,tz,.092,.065),(lx+.04,.104,tz,.083,.076),
              (lx+.19,.075,tz,.067,.061),(lx+.30,.063,tz,.043,.041)],'limb',7)
          # five individual sharp claws; keratin physical geometry
          wedge(f'08_{tag}_{st}_claw_{toe}',[
              (lx+.24,.102,tz-.036),(lx+.31,.112,tz-.031),
              (lx+.46,.040,tz),(lx+.31,.09,tz+.030),(lx+.24,.102,tz+.036)],.07,'claw')
    # Dorsal scutes: compact triangular profiles rooted INTO the real spine.
    # The stripes and mottling remain exclusively UV texture.
    dorsal=[(-3.72,.39),(-3.43,.505),(-3.04,.62),(-2.67,.74),(-2.32,.86),
      (-2.,.99),(-1.70,1.13),(-1.42,1.29),(-1.13,1.38),(-.83,1.45),
      (-.48,1.50),(-.10,1.53),(.28,1.52),(.61,1.52),(.9,1.45),(1.12,1.34),(1.39,1.50)]
    for idx,x in enumerate(np.linspace(-3.3,1.13,24)):
      y=float(np.interp(x,[q[0] for q in dorsal],[q[1] for q in dorsal]))
      scale=min(1.,max(.3,(x+3.7)/1.0))
      root=y-.037
      tip=y+(.045+.030*scale)
      vv=[(x-.085,root,-.075),(x-.085,root,.075),
          (x+.018,tip,0),(x+.08,root,-.065),(x+.08,root,.065)]
      ff=[(0,1,2),(0,2,3),(1,4,2),(3,2,4),(0,3,4),(0,4,1)]
      uv=[(.51+.008*a,.50+.05*b) for a,b in [(-1,-1),(-1,1),(0,0),(1,-1),(1,1)]]
      add(f'09_dorsal_scute_{idx:02d}',vv,ff,uv,'accent')
    # Lateral brow ridges and recessed eyes, both sides. Facial marks live in atlas.
    for side in (-1,1):
      st='L' if side>0 else 'R'
      wedge('10_brow_'+st,[(1.80,1.416,side*.25),(2.02,1.403,side*.30),
                        (2.18,1.33,side*.265),(1.99,1.35,side*.324)],.038,'scute')
      orb('11_eye_socket_'+st,(1.96,1.355,side*.296),(.112,.065,.028),'eye_dark',2)
      orb('12_iris_'+st,(1.987,1.356,side*.316),(.045,.045,.013),'iris',2)
      orb('13_pupil_'+st,(2.002,1.359,side*.326),(.016,.027,.008),'pupil',1)
      orb('14_nostril_'+st,(2.44,1.158,side*.252),(.045,.028,.014),'eye_dark',1)
      # Flattened cheek ridge and ear opening, geometric details (no colored patches).
      wedge('15_angular_cheek_'+st,[(1.71,1.13,side*.31),
           (1.92,1.17,side*.357),(2.18,1.115,side*.317),
           (2.07,1.08,side*.327)],.024,'scute')
    # Individual teeth just visible in jaw gap; geometry only for teeth.
    for side in (-1,1):
      for i in range(10):
        x=1.79+i*.078
        z=side*(.25 if x<2.27 else .20)
        wedge(f'16_tooth_{side}_{i}',[(x-.016,1.062,z-.012),(x+.015,1.061,z-.012),
            (x+0.007,1.008,z),(x-.014,1.061,z+.011)],.016,'tooth')
    allv=np.asarray(VERT,dtype=np.float32)
    alluv=np.asarray(UV,dtype=np.float32)
    allfaces=np.asarray(FACES,dtype=np.int64)
    mat=PBRMaterial(name='Gravarto_v01_painted_uv_albedo',baseColorTexture=Image.open(ATLAS).convert('RGBA'),
      metallicFactor=0,roughnessFactor=.96,baseColorFactor=[255,255,255,255],doubleSided=True)
    mesh=trimesh.Trimesh(vertices=allv,faces=allfaces,process=False,validate=False)
    mesh.visual=TextureVisuals(uv=alluv,material=mat)
    scene=trimesh.Scene();scene.add_geometry(mesh,node_name='Gravarto_v01_static_anatomy',geom_name='Gravarto_v01_LOD0_blockout')
    OUT.write_bytes(scene.export(file_type='glb'))
    data=OUT.read_bytes()
    stats={'id':'gravarto','name':'Gravarto','version':'v01','stage':'anatomical_static_uv_textured_blockout',
      'approval':{'concept':'approved_by_user','blockout':'pending_user_review','refinement':'not_started','rig':'not_started','animations':'not_started'},
      'habitat':['savanna'],'diet':'large_carnivore','model_path':'assets/models/creatures/gravarto/v01/'+OUT.name,
      'source_path':'assets/models/creatures/gravarto/v01/source/build.py',
      'texture_path':'assets/models/creatures/gravarto/v01/texture/'+ATLAS.name,
      'concept_reference':'concept/gravarto-v01-approved-concept.png',
      'geometry':{'triangles_drawn':int(len(allfaces)),'meshes':1,'materials':1,'vertex_instances':len(allv),
        'parts':len(parts),'skin_count':0,'joint_count':0,'clips':[],'axis':'X-forward,Y-up,Z-lateral','unit':'meter'},
      'paint':{'uv_unwrap':'custom procedural atlas; painted marks on body, head, tail and limbs',
        'base_color_texture_pixels':[W,H],'textured_albedo':True,
        'markings_via_extra_polygons':False,'geometry_extra_polygons':'only structural anatomy, teeth, claws, dorsal scutes, brow and eyes'},
      'glb':{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},
      'parts':parts,'preview_status':'render must be generated by GLB importer',
      'integration':'not_integrated_in_game','publication':'local_generated_pending_github'}
    (ROOT/'manifest.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('GLB built',len(data),'bytes',len(allfaces),'triangles',len(parts),'parts',stats['glb']['sha256'])
if __name__=='__main__':build()
