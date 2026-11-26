#!/usr/bin/env python3
"""Fulgaronte v02: reconstruct rejected v01 with anatomically controlled lofts.
Real standalone static GLB blockout. +X head, Y up, Z lateral.
Strictly preserve approved concept identity; no rig, no gameplay, no VFX.
Paint color variation on UV texture, never through coloration-only geometry.
"""
from __future__ import annotations
import math, random, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
ROOT=Path(__file__).resolve().parent.parent
ROOT.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'fulgaronte_v02_blockout_reconstruido.glb'; ATLAS=ROOT/'fulgaronte_v02_uv_albedo.png'
R=random.Random(51274); W=2048
TEX=Image.new('RGB',(W,W),(104,95,81)); D=ImageDraw.Draw(TEX)
# Regions: xmin, xmax, ymin, ymax in U,V coordinates (V bottom up)
REG={
 'back':(.020,.49,.02,.375),'tail':(.02,.49,.405,.600),
 'head':(.51,.77,.02,.375),'limb':(.78,.985,.02,.38),
 'sail':(.51,.985,.415,.805),'bone':(.02,.25,.63,.91),
 'belly':(.275,.49,.64,.91),'mouth':(.52,.625,.83,.92),
 'teeth':(.645,.73,.83,.92),'eyes':(.744,.82,.83,.92),
 'talon':(.833,.908,.83,.92),'dark':(.92,.987,.83,.92),
}

def region_box(k):
 a,b,c,d=REG[k];return (int(a*W),int((1-d)*W),int(b*W),int((1-c)*W))

def draw_region(k, colors, samples=340):
 x0,y0,x1,y1=region_box(k);D.rectangle((x0,y0,x1,y1),fill=colors[0]);h=y1-y0;w=x1-x0
 # large non-uniform angular patches (natural keratin/scutes) distributed in atlas
 for i in range(samples):
  x=R.randrange(x0+8,x1-8);y=R.randrange(y0+8,y1-8)
  r=R.randrange(8,35) if k in ('back','tail','head','limb') else R.randrange(7,23)
  col=R.choice(colors)
  if k in ('back','tail','limb'):
   # Dorsum is ochre mottled, underside lighter beige; on UV top=first section
   v=(y-y0)/h
   if .38<v<.64: col=R.choice([(177,161,132),(194,174,143),(181,165,137),(204,185,154)])
   elif (.14<v<.38 or .68<v<.84) and R.random()<.77: col=R.choice([(161,116,62),(186,136,67),(130,103,67),(207,153,78)])
  pts=[]
  for j in range(R.choice([4,5,6])):
   a=(j/5)*2*math.pi; rr=r*(.65+R.random()*.65)
   pts.append((x+rr*math.cos(a),y+rr*.58*math.sin(a)))
  D.polygon(pts,fill=col)
 # thin angular seams for plated texture depth, not extra colored mesh
 for i in range(samples//3):
  x=R.randrange(x0,x1); y=R.randrange(y0,y1)
  D.line([(x,y),(x+R.randrange(8,28),y-R.randrange(2,11))],fill=(65,65,58) if k!='sail' else (73,48,66),width=1)

for k,cs,n in [
 ('back',[(98,96,83),(126,109,77),(150,115,70),(171,128,73),(193,145,80)],360),
 ('tail',[(120,108,81),(146,113,76),(173,125,71),(190,147,84)],260),
 ('head',[(122,116,99),(147,128,105),(178,151,118),(196,167,133)],250),
 ('limb',[(120,111,91),(146,126,97),(165,139,97),(195,159,105)],230),
 ('sail',[(89,62,75),(114,75,91),(142,92,108),(173,117,128)],210),
 ('bone',[(120,113,98),(143,136,111),(161,152,126)],170),
 ('belly',[(171,158,131),(191,174,143),(197,179,153)],200),
 ]:draw_region(k,cs,n)
for k,co in [('mouth',(69,33,46)),('teeth',(237,216,166)),('eyes',(197,150,53)),('talon',(43,39,44)),('dark',(46,42,40))]:D.rectangle(region_box(k),fill=co)
TEX.save(ATLAS,optimize=True)

V=[];F=[];UV=[]; PARTS={}; FACE_GROUPS={}
def uv(k,u,v):
 a,b,c,d=REG[k];return (a+(b-a)*min(1,max(0,u)),c+(d-c)*min(1,max(0,v)))
def add(name,verts,faces,coords,region):
 first=len(F)
 for face in faces:
  nf=[]
  for idx in face:
   nf.append(len(V));V.append(tuple(verts[idx]));UV.append(uv(region,*coords[idx]))
  F.append(nf)
 PARTS[name]=PARTS.get(name,0)+len(faces)
 FACE_GROUPS[name]=(first,len(F))
def xloft(name,sections,sides,reg,angle=0.0,cap=True):
 # radius around YZ, cross-sections. Body geometry purposeful taper, not spheres.
 verts=[];coords=[];faces=[];n=len(sections)
 for i,(x,y,z,ry,rz) in enumerate(sections):
  for j in range(sides):
   t=2*math.pi*j/sides+angle
   verts.append((x,y+ry*math.cos(t),z+rz*math.sin(t)))
   coords.append((i/(n-1),j/sides))
 for i in range(n-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   faces.extend([(a,c,b),(b,c,d)])
 if cap:
  for j in range(1,sides-1):faces.append((0,j+1,j))
  off=(n-1)*sides
  for j in range(1,sides-1):faces.append((off,off+j,off+j+1))
 add(name,verts,faces,coords,reg)
def path(name,centers,xy_radii,reg,sides=9,cap=True):
 # arbitrary loft along bends; separate upper and lower limbs possible
 p=np.asarray(centers,float);vertices=[];coords=[];faces=[]
 for i,c in enumerate(p):
  tang=p[min(i+1,len(p)-1)]-p[max(0,i-1)]; tang/=np.linalg.norm(tang)+1e-9
  helper=np.array([0.,1.,0.])
  if abs(np.dot(helper,tang))>.92:helper=np.array([0.,0.,1.])
  u=np.cross(tang,helper);u/=np.linalg.norm(u)+1e-9
  w=np.cross(tang,u)
  rad=xy_radii[i];a,b=rad if isinstance(rad,(list,tuple)) else (rad,rad)
  for j in range(sides):
   t=2*math.pi*j/sides
   vertices.append(tuple(c+a*math.cos(t)*u+b*math.sin(t)*w))
   coords.append((i/(len(p)-1),j/sides))
 for i in range(len(p)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   faces.extend([(a,b,c),(b,d,c)])
 if cap:
  for j in range(1,sides-1):faces.append((0,j,j+1))
  off=(len(p)-1)*sides
  for j in range(1,sides-1):faces.append((off,off+j+1,off+j))
 add(name,vertices,faces,coords,reg)
def plate(name,poly,thick,region):
 # raised profile/fin keratin with thickness. use thin prism and triangulate
 vs=[tuple(p) for p in poly];n=len(vs)
 cen=np.mean(np.array(vs),axis=0)
 # outer facing +Z, inner facing -Z so it actually has thickness
 t=thick/2
 verts=[(x,y,z+t) for x,y,z in vs]+[(x,y,z-t) for x,y,z in vs]
 coords=[((i%4)/3,.8) for i in range(n)]+[((i%4)/3,.2) for i in range(n)]
 fs=[]
 for k in range(1,n-1):fs.extend([(0,k,k+1),(n,n+k+1,n+k)])
 for k in range(n):
  j=(k+1)%n;fs.extend([(k,j,n+j),(k,n+j,n+k)])
 add(name,verts,fs,coords,region)
def web(name,poly,region):
 # Actual thin sail contour, not an extra mesh for color only.
 vs=np.asarray(poly,float);lo=vs.min(axis=0);hi=vs.max(axis=0)
 coords=[((p[0]-lo[0])/(hi[0]-lo[0]+1e-5),(p[1]-lo[1])/(hi[1]-lo[1]+1e-5)) for p in vs]
 ff=[]
 for k in range(1,len(vs)-1):ff.extend([(0,k,k+1),(0,k+1,k)])
 add(name,vs,ff,coords,region)

# BODY: broad-shouldered but long, natural belly line, narrowing toward waist.
# Length -5.25 to 1.75 (7m), head +5.5; y ranges 0.98 to 4.2m.
xloft('body_long_taper',[
 (-5.30,2.05,0,.55,.59),(-4.92,2.18,0,.89,.92),(-4.36,2.35,0,1.19,1.23),
 (-3.45,2.42,0,1.30,1.43),(-2.4,2.50,0,1.37,1.50),(-1.25,2.56,0,1.47,1.58),
 (-.20,2.60,0,1.57,1.64),(.85,2.61,0,1.52,1.59),(1.48,2.62,0,1.32,1.32),(1.85,2.71,0,.93,1.00)
],14,'back',math.pi/14)
# Under-throat chest transits continuously to head, broad nape
xloft('muscular_neck',[
 (1.45,2.78,0,.95,1.10),(1.88,2.85,0,1.03,1.10),
 (2.30,2.98,0,.98,1.03),(2.67,3.04,0,.90,.95),(3.03,3.14,0,.84,.88)
],12,'head',math.pi/12)
# crocodilian skull, 2.7m long, long and wide jaw hinge; sculpted upper arch & wedge muzzle
xloft('upper_skull_elongated',[
 (2.48,3.19,0,.84,.86),(2.83,3.35,0,.93,1.02),(3.23,3.40,0,.88,1.11),
 (3.71,3.48,0,.80,1.10),(4.14,3.49,0,.71,1.02),
 (4.55,3.47,0,.63,.94),(4.94,3.42,0,.57,.87),(5.27,3.37,0,.49,.79),
 (5.46,3.27,0,.37,.64),(5.58,3.23,0,.24,.48)
],12,'head',math.pi/12)
# Visibly separated heavy lower mandible with V shaped jutting chin, deep mouth cavity
xloft('jaw_lower_fat',[
 (2.72,2.79,0,.31,.81),(3.14,2.69,0,.37,.93),(3.55,2.61,0,.29,.99),
 (4.08,2.26,0,.31,.96),(4.51,2.12,0,.28,.91),(4.92,2.00,0,.23,.83),
 (5.29,1.95,0,.20,.72),(5.54,2.00,0,.13,.54)
],12,'head',math.pi/12)
xloft('inner_mouth',[(3.02,2.87,0,.14,.72),(4.04,2.67,0,.12,.79),(5.22,2.57,0,.10,.61)],10,'mouth',math.pi/10)
path('tongue',[(3.42,2.62,0),(4.13,2.54,0),(4.98,2.39,0)],[(.16,.16),(.20,.17),(.05,.06)],'mouth',8)
# Eye sockets recessed under dorsal brow, three-tier cheek plates on each side.
for s in [-1,1]:
 path('amber_eye_'+str(s),[(3.42,3.89,s*.96),(3.65,3.88,s*.98)],[(.15,.12),(.14,.12)],'eyes',8)
 for i in range(3):
  x=3.00+i*.51
  poly=[(x,4.08,s*.82),(x+.22,4.24-i*.04,s*1.07),(x+.60,4.10-i*.06,s*.97),(x+.39,4.00-i*.06,s*.89)]
  plate('overlapping_brow_armor',poly,.1,'bone')
 # Real cheek angular plates, not floating color stickers
 for i in range(4):
  x=2.73+i*.5; z=s*(.97-.035*i)
  plate('mandible_cheek_scutes',[(x,3.07,z),(x+.19,3.25,z+s*.12),(x+.48,3.16,z),(x+.40,2.95,z-s*.04)],.07,'head')
 # zig-zag interlocking teeth, much denser around the mouth edge
 for j in range(7):
  xx=3.22+j*.345
  spread=.78-(.13*j/7)
  path('maxillary_tooth',[(xx,2.97,s*spread),(xx+.04,2.60,s*(spread-.03))],[(.092,.082),(.006,.004)],'teeth',4)
  if j<7:
   path('mandibular_tooth',[(xx+.11,2.53-.09*j/6,s*(spread-.01)),(xx+.16,2.88-.03*j/6,s*(spread-.05))],[(.073,.067),(.004,.004)],'teeth',4)
 # long fang at snout
 path('fang_large',[(5.20,2.97,s*.67),(5.23,2.50,s*.64)],[(.14,.085),(.006,.005)],'teeth',6)
 # spurs/frills behind eye, laid backward
 for i in range(4):
  x=2.6-i*.28; zh=s*(.76+i*.08); y=3.85+i*.06
  plate('cranial_horn_scutes',[(x+.26,y,zh),(x-.07,y+.28+i*.08,zh),(x-.35,y+.14+i*.05,zh),(x-.08,y-.10,zh)],.10,'bone')
# Muzzle horn and sculpted brow-piercing shields, structurally connected ridges
for sg in (-1,1):
 plate('nasal_hornridge',[(4.24,3.91,sg*.72),(4.52,4.08,sg*.73),(4.95,3.92,sg*.70),(5.23,3.69,sg*.59)],.09,'bone')
 plate('raked_brow',[(3.04,4.08,sg*.86),(3.46,4.48,sg*.90),(3.98,4.16,sg*.88),(3.71,3.98,sg*.92)],.1,'bone')
# armor plating across dorsal shoulders, real geometric overlapping scales
for i in range(11):
 x=1.56-i*.59
 # outline follows y=4.1 at shoulders, reduces at back
 core=3.99+.12*math.sin((x+4.8)*.45)
 body_width=1.32-0.3*max(0,(-x-3.4)/2)
 for s in [-1,1]:
  for band in [0]:
   z=s*(.43+band*.43)
   y=core-.16*band
   plate('dorsal_overlap_scute',[
     (x+.29,y-.12,z),(x+.10,y+.14,z+s*.09),(x-.23,y+.05,z+s*.05),(x-.34,y-.17,z),(x-.10,y-.22,z-s*.035)
   ],.045,'bone')
# sail fin in profile and rib geometry, 1 very large front + 3 smaller posterior
# dorsal first sail peaks above 5m, has coherent taper and hydrodynamic sweep
for i,(start,span,h) in enumerate([(.71,1.98,2.0),(-1.57,1.36,1.25),(-3.12,1.10,.86),(-4.42,.83,.55)]):
 y=4.05- .09*max(0,-start)
 fin=[(start+.42,y-.14,0),
      (start+.29,y+.45*h,0),
      (start-.26,y+h,0),
      (start-.42,y+.99*h,0),
      (start-.43,y+.74*h,0),
      (start-.67,y+.67*h,0),
      (start-.85,y+.72*h,0),
      (start-.62-.43*span,y+.29*h,0),
      (start-.53*span,y-.10,0)]
 plate('major_dorsal_membrane',fin,.11,'sail')
 path('dorsal_anterior_rib',[(start+.28,y-.14,.01),(start+.01,y+.55*h,.01),(start-.26,y+.99*h,.01)],[(.095,.065),(.075,.055),(.012,.013)],'bone',5)
# small midline spikes, physically protruding from armored back
for i in range(6):
 x=1.5-i*1.03
 y=4.03-.14*(i/8)
 plate('back_keratin_tooth',[(x+.15,y,0),(x-.04,y+.22,0),(x-.28,y,0)],.15,'bone')
# LIMBS: shoulder/haunch visibly muscular with elbows bent and giant spread toes.
# forearm fins are elongated and rising outward in side profile.
for s in [-1,1]:
 for front,x in [(True,1.22),(False,-3.84)]:
  hip=(x,2.55,s*(1.17 if front else 1.15))
  elbow=(x+(-.32 if front else .36),1.73,s*(1.66 if front else 1.66))
  wrist=(x+(.14 if front else -.35),.72,s*(1.88 if front else 1.85))
  ankle=(x+(.26 if front else -.23),.36,s*(1.92 if front else 1.87))
  path('long_forelimb' if front else 'muscular_hindlimb', [hip,elbow,wrist,ankle],
       [(.72,.70),(.59,.55),(.45,.42),(.37,.35)],'limb',9)
  # Forward spreading palm, each of 4 digits forms tapered phalanx with black claws
  for j in range(3):
   spread=(j-1.0)*.43
   atx=ankle[0]+(.17 if front else .06)
   pt1=(atx+.28,.19,ankle[2]+spread)
   pt2=(atx+.57,.10,ankle[2]+spread*1.20)
   path('toe_phalanx',[ankle,pt1,pt2],[(.21,.16),(.13,.12),(.065,.052)],'limb',5)
   path('toe_talon',[pt2,(pt2[0]+.27,.055,pt2[2]+s*.055)],[(.104,.074),(.008,.006)],'talon',4)
  if front:
   # reference has a swept-back fin erupting from forearms and ending above wrists
   z=s*2.31
   finpoly=[(x-.16,.80,z), (x+.03,1.94,z), (x+.24,2.50,z),
            (x-.10,2.50,z), (x-1.30,3.10,z), (x-1.47,3.18,z),
            (x-1.20,2.31,z), (x-1.38,1.30,z), (x-1.28,.72,z)]
   plate('large_forearm_sail',finpoly,.11,'sail')
   path('forearm_membrane_spine',[(x-.18,.92,z),(x-.27,2.20,z),(x-1.36,3.23,z)],[(.095,.085),(.069,.065),(.012,.01)],'bone',6)
  else:
   # short stabilising side fin near rear hips
   plate('pelvic_stabilizing_fin',[(x-.25,2.45,s*1.56),(x-.42,2.83,s*1.54),
                                (x-.95,2.43,s*1.55),(x-.66,1.91,s*1.61)],.07,'sail')

# CURVED TAIL: taper gradually 6m; broad fan paddle with lobes, not an arrow on a stick.
path('caudal_muscular',[
 (-4.98,2.18,0),(-5.48,2.12,.04),(-6.17,2.02,.18),(-6.92,1.86,.32),
 (-7.57,1.70,.46),(-8.19,1.56,.62),(-8.77,1.43,.73),(-9.36,1.27,.82),
 (-9.9,1.12,.86),(-10.44,1.07,.94)
],[(.90,.82),(.83,.72),(.70,.61),(.56,.52),(.49,.46),(.42,.4),(.34,.34),(.27,.26),(.22,.20),(.11,.12)],'tail',12)
# top and lower lobes taper into sweeping pointed tips; visually broad, anatomically attached
plate('caudal_upper_paddle',[(-8.35,1.58,.62),(-8.83,2.41,.72),(-9.56,3.00,.80),(-10.31,2.67,.88),(-10.94,1.89,.99),(-10.45,1.13,.94),(-9.5,1.24,.83)],.07,'sail')
plate('caudal_lower_paddle',[(-8.50,1.37,.69),(-8.88,.81,.75),(-9.54,.27,.83),(-10.51,.08,.88),(-10.94,.31,.95),(-10.40,1.10,.91),(-9.45,1.40,.82)],.07,'sail')
# Tail serration on top of thick section
for i in range(5):
 x=-5.55-i*.59; y=2.77-i*.23
 plate('caudal_serrated_fin',[(x+.22,y-.16,0),(x-.02,y+.39-i*.026,0),(x-.35,y-.12,0)],.08,'sail')

# Flat face normals and packed UVs retained, all color features in texture.
mesh=trimesh.Trimesh(vertices=np.asarray(V,np.float32),faces=np.asarray(F,np.int32),process=False)
mesh.visual=TextureVisuals(uv=np.asarray(UV,np.float32),material=PBRMaterial(name='Fulgaronte v02 UV',baseColorTexture=TEX,metallicFactor=0.0,roughnessFactor=.96,doubleSided=True))
s=trimesh.Scene();s.add_geometry(mesh,node_name='Fulgaronte_v02_anatomia',geom_name='Fulgaronte_v02_anatomia')
blob=trimesh.exchange.gltf.export_glb(s,include_normals=True)
OUT.write_bytes(blob)
check=trimesh.load(OUT,force='scene',process=False)
bounds=np.array(check.bounds);extent=bounds[1]-bounds[0]
tri=sum(len(m.faces) for m in check.geometry.values());nmeshes=len(check.geometry)
meta={'species':'Fulgaronte','id':'fulgaronte','revision':'v02','stage':'blockout_reconstructed_after_v01_visual_rejection',
 'concept_approved':True,'v01_rejected':True,'v02_form_approved':False,'triangles':tri,'meshes':nmeshes,
 'meters_height':round(float(extent[1]),3),'meters_length':round(float(extent[0]),3),'meters_width':round(float(extent[2]),3),
 'glb':OUT.name,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),
 'textures':1,'texture_file':ATLAS.name,'skins':0,'bones':0,'clips':0,'vfx_electricity':False,
 'render_provenance':'reimport exported GLB via VTK; no AI art','parts_triangles':PARTS,
 'previous_version':'v01 unchanged','no_alpha_changes':True,'publication':'local; GitHub publication pending validation'}
(ROOT/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:meta[k] for k in ('triangles','meshes','meters_height','meters_length','meters_width','bytes','sha256')},indent=2))
