#!/usr/bin/env python3
"""Wildhaven / Sirocauro — v01: static real GLB blockout with integrated UV texture.
Heavy biped dinosaur predator with functional limbs, armored natural bony plates.
Model coordinate: X toward tail (+), Y lateral, Z upward. Units: meters.
No color-only meshes, no rig or animation in this checkpoint.
"""
from __future__ import annotations
from pathlib import Path
import math, json, random, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals, SimpleMaterial

ROOT=Path(__file__).resolve().parent.parent
ASSET=ROOT/'sirocauro-v01-anatomia-pesada-blockout.glb'
ATLAS=ROOT/'textures'/'sirocauro-v01-uv-atlas.png'
ATLAS.parent.mkdir(parents=True,exist_ok=True)
RNG=random.Random(114)
TILES={'skin':0,'muscle':1,'belly':2,'bone':3,'claw':4,'mouth':5,'eye':6,'scale':7}
W=2048; cell=512
img=Image.new('RGB',(W,W//2),(76,84,51));draw=ImageDraw.Draw(img)
base_colors=[(75,84,47),(64,71,40),(148,118,79),(197,170,114),(62,58,43),(75,35,29),(186,105,32),(101,104,65)]
for tid,c in enumerate(base_colors):
 x0=(tid%4)*cell;y0=(tid//4)*cell
 draw.rectangle((x0,y0,x0+cell-1,y0+cell-1),fill=c)
 # Large irregular, low-poly patterns painted into one atlas (NEVER extra geometry)
 for i in range(160 if tid in (0,1,7) else 85):
  x=x0+RNG.randint(6,cell-10);y=y0+RNG.randint(8,cell-10)
  radius=RNG.randint(14,65)
  pts=[(x+RNG.randint(-radius,radius),y+RNG.randint(-radius,radius)) for _ in range(RNG.randint(3,5))]
  d=RNG.randint(-23,22)
  co=tuple(max(0,min(255,t+d+(3 if j==0 else -2 if j==1 else 0))) for j,t in enumerate(c))
  draw.polygon(pts,fill=co)
  if i%6==0:
   draw.line(pts+[pts[0]],fill=tuple(max(0,q-12) for q in co),width=2)
 # skin's underside band is PAINT, not a separate face mesh
 if tid==0:
  ycenter=y0+int(cell*.50)
  pts=[(x0+8,ycenter-52),(x0+88,ycenter-64),(x0+170,ycenter-39),(x0+300,ycenter-52),(x0+448,ycenter-44),(x0+cell-8,ycenter-32),
       (x0+cell-8,ycenter+70),(x0+440,ycenter+84),(x0+302,ycenter+65),(x0+120,ycenter+83),(x0+8,ycenter+57)]
  draw.polygon(pts,fill=(134,105,72))
  for j in range(16):
   xx=x0+RNG.randint(20,490);yy=ycenter+RNG.randint(-38,42)
   draw.line((xx-20,yy+5,xx+22,yy-12),fill=(154,126,88),width=3)
 # tile inset outlines / bevel slight
 draw.rectangle((x0+1,y0+1,x0+cell-2,y0+cell-2),outline=tuple(max(0,k-12) for k in c),width=2)
img.save(ATLAS)

PARTS=[]
def uv_for_tile(v,tile,texmode='xyz',param=None):
    """Proper UV coordinates into atlas; local axes only; colors are painted in atlas."""
    c=TILES[tile];x0=c%4;y0=c//4
    xyz=np.array(v,dtype=float)
    if param is None:
        lo=xyz.min(axis=0);hi=xyz.max(axis=0);span=np.maximum(hi-lo,.001)
        if texmode=='xz':uu=(xyz[:,0]-lo[0])/span[0];vv=(xyz[:,2]-lo[2])/span[2]
        elif texmode=='yz':uu=(xyz[:,1]-lo[1])/span[1];vv=(xyz[:,2]-lo[2])/span[2]
        else:uu=(xyz[:,0]-lo[0])/span[0];vv=(xyz[:,1]-lo[1])/span[1]
    else:
        uu=np.asarray([p[0] for p in param]);vv=np.asarray([p[1] for p in param]);
    uu=np.clip(uu,.02,.98);vv=np.clip(vv,.02,.98)
    # TextureVisuals UV uses bottom-left origin; generated PIL atlas is top-left.
    u=(x0+12+uu*(cell-24))/W
    vtex=1-(y0+12+vv*(cell-24))/(W//2)
    return np.column_stack([u,vtex])

def add(name, v, f, tile='skin', texmode='xz', uv=None):
    v=np.asarray(v,dtype=float);f=np.asarray(f,dtype=np.int64)
    if not len(v) or not len(f):return
    # Shape correction against the approved concept: head sits HIGH above shoulders,
    # head and jaws remain anatomically substantial; preserve neck/body connection.
    prefix=int(name.split('_')[0])
    if prefix==2:
        v[:,2]+=.13
    elif 3<=prefix<=14:
        v[:,0]=-3.13+(v[:,0]+3.13)*1.17
        v[:,1]*=1.07
        if prefix in (3,4,7,8,9,10,12,14):v[:,2]+=.37
        elif prefix==5:v[:,2]+=.18
        # lower jaw and bony jaw tusks stay anchored in the mandible
        elif prefix in (6,11,13):v[:,2]+=.035
    if uv is None:uv=uv_for_tile(v,tile,texmode)
    else:uv=uv_for_tile(v,tile,texmode,uv)
    # split vertex normals for robust planar faceted facets and crisp triangular anatomy
    faces=np.arange(len(f)*3,dtype=np.int64).reshape(-1,3)
    PARTS.append((name,v[f].reshape(-1,3).astype('f4'),faces,uv[f].reshape(-1,2).astype('f4'),tile))

def ring_x(name,sect,tile='skin',sides=16):
    """cross-section: (x, ycenter, zcenter, y_radius, z_radius)"""
    v=[];f=[];uv=[];X0=sect[0][0];X1=sect[-1][0]
    for i,(x,yc,zc,ry,rz) in enumerate(sect):
        for j in range(sides):
            t=2*math.pi*j/sides
            yy=yc+ry*math.sin(t);zz=zc+rz*math.cos(t)
            v.append((x,yy,zz))
            uv.append((i/max(1,len(sect)-1),j/sides))
    for i in range(len(sect)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            f.extend([(a,b,c),(b,d,c)])
    for j in range(1,sides-1):f.append((0,j,j+1))
    off=(len(sect)-1)*sides
    for j in range(1,sides-1):f.append((off,off+j+1,off+j))
    add(name,v,f,tile,'xz',uv)

def ring_z(name,sect,tile='muscle',sides=12):
    """(x_center, y_center, z, radius_x, radius_y)"""
    v=[];f=[];uv=[]
    for i,(xc,yc,z,rx,ry) in enumerate(sect):
        for j in range(sides):
            a=2*math.pi*j/sides
            v.append((xc+rx*math.cos(a),yc+ry*math.sin(a),z))
            uv.append((i/max(len(sect)-1,1),j/sides))
    for i in range(len(sect)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            f.extend([(a,c,b),(b,c,d)])
    for j in range(1,sides-1):f.append((0,j,j+1))
    off=(len(sect)-1)*sides
    for j in range(1,sides-1):f.append((off,off+j,off+j+1))
    add(name,v,f,tile,'xz',uv)

def path_tube(name,pts,radii,tile='bone',sides=8):
    pp=np.asarray(pts,dtype=float);v=[];f=[];uv=[]
    for i,p in enumerate(pp):
        tangent=pp[min(len(pp)-1,i+1)]-pp[max(0,i-1)]
        tangent=tangent/max(np.linalg.norm(tangent),1.e-9)
        ref=np.array([0.,1.,0.]) if abs(tangent[1])<.85 else np.array([0.,0.,1.])
        right=np.cross(tangent,ref);right/=max(np.linalg.norm(right),1.e-9)
        up=np.cross(tangent,right)
        for j in range(sides):
            a=j*2*math.pi/sides
            v.append(p+float(radii[i])*(math.cos(a)*right+math.sin(a)*up))
            uv.append((i/max(1,len(pp)-1),j/sides))
    for i in range(len(pp)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            f.extend([(a,b,c),(b,d,c)])
    for j in range(1,sides-1):f.append((0,j+1,j))
    off=(len(pp)-1)*sides
    for j in range(1,sides-1):f.append((off,off+j,off+j+1))
    add(name,v,f,tile,'xz',uv)

def wedge(name,center_x,base_z,front,back,height,depth,tile='bone',lean=.15,offset_y=0):
    """Armor plate emerging FROM body, swept curved, thick and beveled; no color-only mesh."""
    x=center_x;y=offset_y
    # 12-vertex rock wedge, embedded root and faceted crest
    bottom=base_z-.24
    v=[(x-front,y-depth*.83,bottom),(x+back,y-depth*.83,bottom),
       (x+back*.75,y-depth*.90,base_z+.12),(x+lean,y-depth*.46,base_z+height*.79),
       (x+lean-.10,y,base_z+height),
       (x+lean,y+depth*.46,base_z+height*.79),(x+back*.75,y+depth*.9,base_z+.12),
       (x+back,y+depth*.83,bottom),(x-front,y+depth*.83,bottom),
       (x-front*.72,y+depth*.65,base_z+height*.25),(x-front*.72,y-depth*.65,base_z+height*.25)]
    # fan sides, ridgeline emphasizes intentional cuts
    f=[(0,1,2),(0,2,3),(0,3,4),(10,0,4),(10,4,9),(9,4,8),
       (1,7,6),(1,6,5),(1,5,4),(1,4,3),(7,8,9),(7,9,5),(9,4,5),(5,6,7),
       (8,0,10),(8,10,9),(0,8,7),(0,7,1), (2,1,3),(6,5,7)]
    add(name,v,f,tile,'xz')

def horn(name,points,radius=.24):
    path_tube(name,points,np.linspace(radius,0.017,len(points)),'bone',6)

# ------ HEAVY silhouette: 6m tall, 14m long, wider shoulders and hips than old design ------
ring_x('01_torso_massivo',[
 (-2.75,0,3.40,.35,.48),(-2.50,0,3.40,1.08,1.20),(-2.15,0,3.33,1.24,1.38),
 (-1.72,0,3.22,1.36,1.49),(-1.26,0,3.15,1.39,1.50),(-.75,0,3.12,1.35,1.51),
 (-.24,0,3.10,1.34,1.52),(.30,0,3.04,1.36,1.58),(.87,0,2.99,1.40,1.61),
 (1.40,0,2.94,1.44,1.59),(1.95,0,2.88,1.29,1.43),(2.43,0,2.84,1.10,1.24),
 (2.85,0,2.83,.93,.97),(3.20,0,2.81,.65,.70),(3.43,0,2.78,.45,.51)], 'skin',12)
# neck transition blends thick thorax to skull naturally
ring_x('02_pescoco_raiz',[
 (-3.75,0,3.82,.46,.46),(-3.47,0,3.72,.80,.82),(-3.12,0,3.63,.95,1.00),
 (-2.84,0,3.57,1.05,1.08),(-2.53,0,3.55,1.16,1.25)],'muscle',13)
# head: heavy cranial wedge, angular cheek and muzzle protrudes from neck; nostrils ridge
ring_x('03_cranio_blindado',[
 (-5.05,0,3.92,.36,.27),(-4.87,0,3.92,.59,.48),(-4.58,0,4.01,.76,.61),
 (-4.25,0,4.09,.85,.72),(-3.93,0,4.14,.89,.79),(-3.62,0,4.12,.90,.78),
 (-3.36,0,4.05,.83,.74),(-3.16,0,3.96,.74,.68)],'muscle',13)
# large muzzle lowered closer to bite, no eye bubbles
ring_x('04_maxilar_superior',[
 (-5.18,0,3.68,.34,.20),(-5.04,0,3.72,.55,.31),(-4.84,0,3.79,.66,.36),
 (-4.50,0,3.85,.70,.35),(-4.14,0,3.92,.74,.42),(-3.79,0,3.90,.78,.47)],'muscle',12)
# real mouth cavity between upper/lower jaws and underjaw bone, not a painted mouth slash
ring_x('05_cavidade_bucal',[
 (-5.11,0,3.23,.36,.07),(-4.92,0,3.27,.56,.14),(-4.51,0,3.29,.64,.21),
 (-4.14,0,3.32,.68,.22),(-3.77,0,3.35,.66,.17)],'mouth',12)
ring_x('06_mandibula_larga',[
 (-5.05,0,2.94,.36,.23),(-4.85,0,2.95,.57,.35),(-4.55,0,2.94,.69,.41),
 (-4.25,0,2.90,.77,.48),(-3.92,0,2.88,.83,.53),(-3.60,0,2.94,.83,.52),(-3.37,0,3.05,.73,.42)],'belly',14)
# brow ridges, sockets and iris inset inside eye-socket geometry
for sign in [-1,1]:
   side='L' if sign<0 else 'R'
   # cheekbone folded into massive jaw / skull
   ring_x(f'07_jugal_escudo_{side}',[
      (-4.64,sign*.54,3.77,.25,.21),(-4.37,sign*.67,3.75,.29,.30),
      (-4.06,sign*.77,3.82,.22,.32),(-3.85,sign*.75,3.88,.16,.24)],'muscle',10)
   # eye cavity sunken, NOT protruding ball
   ring_x(f'08_cavidade_olho_{side}',[
      (-4.39,sign*.72,4.27,.17,.16),(-4.28,sign*.80,4.30,.20,.16),(-4.15,sign*.78,4.27,.12,.11)],'claw',10)
   ring_x(f'09_olho_ambar_{side}',[
      (-4.34,sign*.82,4.29,.06,.08),(-4.26,sign*.87,4.29,.085,.085),(-4.20,sign*.82,4.28,.06,.06)],'eye',10)
   ring_x(f'10_sobrancelha_{side}',[
      (-4.58,sign*.72,4.48,.13,.08),(-4.28,sign*.86,4.51,.17,.10),
      (-3.98,sign*.76,4.49,.12,.08)],'scale',10)
   # horn-like bone at lower jaw: giant jagged lateral tusks growing from cheekbone
   for j,(xx,hh) in enumerate([(-4.89,.40),(-4.51,.64),(-4.13,.76),(-3.76,.60),(-3.52,.40)]):
       path_tube(f'11_mandibula_placa_{side}_{j}',[
         (xx,sign*.65,2.92),(xx-.09,sign*(.80+hh*.09),3.13),
         (xx-.18,sign*(.87+hh*.08),3.20+hh*.52),(xx-.24,sign*(.78+hh*.05),3.22+hh)],
         [.19+.04*hh,.22+.04*hh,.115,.014],'bone',6)
   # teeth embedded along opposed jaw lines (anatomical mouth teeth)
   for j in range(9):
       xx=-5.03+j*.153
       width=.41+(.32*math.sin(math.pi*j/13))
       yy=sign*width
       horn(f'12_superior_dente_{side}_{j}',[(xx,yy,3.52),(xx-.06,yy*1.04,3.31),(xx-.09,yy*1.07,3.21)],.11 if j%3 else .14)
       horn(f'13_inferior_dente_{side}_{j}',[(xx,yy,3.19),(xx+.015,yy*1.04,3.38),(xx+.03,yy*1.04,3.47)],.086)
   # nostril upper snout with only slight topological indentation
   ring_x(f'14_narina_{side}',[
      (-4.98,sign*.28,3.95,.10,.05),(-4.91,sign*.35,3.96,.11,.06),(-4.86,sign*.32,3.96,.07,.045)],'claw',8)
# short massive arms; no extra huge forelegs: match art, 3 functional claws
for sign in [-1,1]:
    side='L' if sign<0 else 'R'
    path_tube(f'15_ombro_braco_{side}',[
     (-2.33,sign*1.02,3.22),(-2.54,sign*1.27,2.95),(-2.72,sign*1.36,2.62),(-2.84,sign*1.36,2.45)],
      [.43,.39,.31,.24],'muscle',7)
    path_tube(f'16_antebraco_{side}',[
     (-2.83,sign*1.36,2.49),(-2.92,sign*1.35,2.27),(-3.09,sign*1.34,2.05),(-3.19,sign*1.34,1.99)],
      [.25,.25,.21,.18],'muscle',7)
    for j in range(3):
     dy=(j-1)*.17
     horn(f'17_garra_mao_{side}_{j}',[
       (-3.15,sign*1.33+dy,2.00),(-3.30,sign*1.35+dy,1.90),(-3.44,sign*1.38+dy,1.74)],.10)
# giant legs: widest thighs, true knee and broad feet; 6m supported biped
for sign in [-1,1]:
    side='L' if sign<0 else 'R'
    ring_z(f'18_coxa_enorme_{side}',[
      (1.04,sign*.91,3.43,.47,.44),(.99,sign*1.10,3.13,.88,.66),
      (1.03,sign*1.27,2.80,1.01,.74),(1.11,sign*1.32,2.47,1.05,.76),
      (1.28,sign*1.30,2.14,1.04,.72),(1.50,sign*1.28,1.78,.87,.65),
      (1.64,sign*1.29,1.52,.65,.53)],'muscle',13)
    ring_z(f'19_canela_{side}',[
      (1.70,sign*1.28,1.61,.61,.54),(1.86,sign*1.28,1.36,.56,.48),
      (1.81,sign*1.30,1.03,.46,.45),(1.69,sign*1.30,.69,.49,.43),
      (1.52,sign*1.30,.35,.45,.40),(1.45,sign*1.30,.19,.46,.41)],'muscle',12)
    # massive metatarsal foot as its own anatomical volume
    ring_x(f'20_pe_amplo_{side}',[
      (.73,sign*1.30,.20,.26,.12),(.97,sign*1.31,.19,.51,.14),
      (1.30,sign*1.31,.22,.65,.22),(1.53,sign*1.33,.27,.60,.25),
      (1.75,sign*1.33,.32,.44,.23),(1.93,sign*1.33,.32,.24,.16)],'muscle',12)
    for j in range(3):
       dy=(j-1)*.37
       path_tube(f'21_dedo_largo_{side}_{j}',[
           (1.19,sign*1.30+dy,.17),(.72,sign*1.32+dy*1.20,.12),(.32,sign*1.33+dy*1.35,.11),(-.06,sign*1.33+dy*1.50,.13)],
           [.21,.23,.18,.11],'muscle',7)
       horn(f'22_garra_grande_{side}_{j}',[
          (-.08,sign*1.33+dy*1.5,.16),(-.31,sign*1.34+dy*1.6,.15),
          (-.53,sign*1.35+dy*1.65,.10),(-.66,sign*1.34+dy*1.65,.075)],.20)
# HEAVY counterbalance tail: thick taper in single flowing volume, upward bifurcated horns
ring_x('23_cauda_muscular',[
 (2.70,0,2.87,.94,1.01),(3.14,0,2.75,.89,.93),(3.58,0,2.61,.79,.78),
 (4.02,0,2.48,.69,.63),(4.48,0,2.36,.60,.54),(4.92,0,2.25,.53,.46),
 (5.36,0,2.20,.46,.40),(5.84,0,2.19,.41,.36),(6.30,0,2.23,.36,.32),
 (6.75,0,2.28,.32,.28),(7.19,0,2.36,.28,.25),(7.55,0,2.47,.24,.23),
 (7.85,0,2.57,.23,.20),(8.15,0,2.62,.20,.18)],'skin',12)
# split, upward hooked tail tips as pale keratin, actual silhouette geometry
for s in [-1,1]:
 horn('24_corona_dupla_cauda_'+str(s),[
  (7.98,s*.16,2.61),(8.23,s*.24,2.72),(8.50,s*.35,3.02),(8.73,s*.37,3.35),(8.83,s*.38,3.66)],.24)
# robust rock-cut osteoderms: geometry as in concept, rooted inside dorsum
for i,(x,base,h,fw,bw) in enumerate([
 (-2.70,4.50,.44,.28,.28),(-2.32,4.62,.80,.35,.42),(-1.66,4.66,1.04,.44,.57),
 (-.83,4.70,1.38,.56,.71),(.06,4.67,1.22,.62,.76),(.99,4.61,.98,.65,.72),
 (1.85,4.39,.81,.57,.66),(2.60,3.98,.60,.52,.64),
 (3.22,3.54,.52,.44,.50),(3.78,3.19,.49,.43,.45),(4.32,2.90,.40,.34,.40),
 (4.86,2.65,.33,.27,.32),(5.32,2.58,.30,.25,.27),(5.79,2.50,.28,.22,.25),
 (6.28,2.52,.24,.19,.22),(6.75,2.56,.20,.16,.19),(7.20,2.60,.20,.16,.19)
 ]):
    wedge(f'25_placa_osteodermica_{i:02d}',x,base,fw,bw,h,.20+(h*.12),'bone',lean=.12+.22*h)
# kinks of armored neck; small beige scutes over skull, all silhouette real
for i,(x,zz,hh) in enumerate([(-4.52,4.42,.18),(-4.16,4.66,.29),(-3.76,4.76,.28),(-3.42,4.70,.35),(-3.05,4.72,.38)]):
 wedge(f'26_escama_cranial_{i}',x,zz,.22,.27,hh,.15,'scale',lean=.08)
# A few substantial cervical ridges sculptural anatomy, not just patterned color
for sign in [-1,1]:
 for j,(xx,zz) in enumerate([(-2.70,4.24),(-1.85,4.41),(-.90,4.45),(0.15,4.53)]):
  wedge(f'27_ridge_lateral_{sign}_{j}',xx,zz,.19,.30,.16,.08,'scale',lean=.11,offset_y=sign*.90)

vertices=[];faces=[];uvs=[];components=[];ntri=0
for name,v,f,uv,tile in PARTS:
    at=len(vertices);vertices.extend(v.tolist());uvs.extend(uv.tolist());faces.extend((f+at).tolist());ntri+=len(f)
    components.append({'name':name,'triangles':len(f),'tile':tile})
verts=np.asarray(vertices,dtype='f4');faces=np.asarray(faces,dtype='i8');uvs=np.asarray(uvs,dtype='f4')
material=SimpleMaterial(image=img,ambient=[245,245,245,255],diffuse=[245,245,245,255],specular=[10,10,10,255],glossiness=1)
visual=TextureVisuals(uv=uvs,material=material)
mesh=trimesh.Trimesh(vertices=verts,faces=faces,visual=visual,process=False)
mesh.metadata={'name':'Sirocauro_v01_heavy_biped_blockout'}
scene=trimesh.Scene();scene.add_geometry(mesh,geom_name='sirocauro-v01-static-UV')
ASSET.write_bytes(scene.export(file_type='glb'))
# Validate reopen from disk. Any printed measurements refer to exported file only.
reimport=trimesh.load(ASSET,force='scene')
meshes=[g for g in reimport.geometry.values() if isinstance(g,trimesh.Trimesh)]
assert len(meshes)>=1
triangles=sum(len(g.faces) for g in meshes)
assert triangles==ntri,(triangles,ntri)
assert all(g.visual.kind=='texture' for g in meshes)
assert all(g.visual.uv is not None for g in meshes)
assert all(len(g.faces)>0 and np.isfinite(g.vertices).all() for g in meshes)
assert not reimport.animation if hasattr(reimport,'animation') else True
sha=hashlib.sha256(ASSET.read_bytes()).hexdigest()
bounds=np.vstack([min((g.bounds[0] for g in meshes),key=lambda x:x[0]),max((g.bounds[1] for g in meshes),key=lambda x:x[0])])
# scene graph rotations from trimesh glTF export must be respected in render
f=trimesh.util.concatenate(tuple(reimport.dump()))
manifest={'species':'sirocauro','version':'v01','stage':'shape_blockout','concept_approved':True,'shape_approved':False,
 'repository':'carioca1111/wildhaven-new','target_path':'assets/models/creatures/sirocauro/v01/'+ASSET.name,
 'asset_file':ASSET.name,'bytes':ASSET.stat().st_size,'sha256':sha,'triangles':triangles,'vertices':sum(len(g.vertices) for g in meshes),
 'meshes':len(meshes),'components_authored':len(PARTS),'skins':0,'joints':0,'animations':0,'uv_atlas_embedded':True,
 'design_height_m':6.0,'design_mass_t_proposal':[16,22],'body_length_m':round(float(f.bounds[1][0]-f.bounds[0][0]),3),
 'scene_bounds_m':f.bounds.tolist(),'visual_basis':'user-approved biped heavy armored crocodilian concept; Torvardo v03 style',
 'note':'NO storm or fire VFX are included in the GLB blockout; no rig/animation/LOD at this stage.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
(ROOT/'validation.json').write_text(json.dumps({'readback':True,'triangle_count_ok':True,'uvs_verified':True,'size_bytes':ASSET.stat().st_size,
 'sha256':sha,'animations':0,'skins':0,'unapproved_shape':True},indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))