#!/usr/bin/env python3
"""QUEDRAVO v02 — original authored geometry/UV procedural blockout.
Axes: X forward, Y up, Z lateral. Static: no bones/animations at this checkpoint.
All colors and painted plumage markings live on an embedded UV texture atlas.
Feather geometry changes silhouette or layered flight anatomy (not pure color).
"""
from __future__ import annotations
import json, math, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'quedravo_v02_blockout_2000.glb'; TEX=ROOT/'quedravo_v02_uv_atlas.png'
RNG=np.random.default_rng(715)
COLORS={
'body':(76,72,86),'wing':(61,49,77),'wing_lite':(99,82,116),
'collar':(204,197,184),'head':(151,138,141),'beak':(113,104,109),
'claw':(38,34,44),'leg':(151,135,119),'iris':(230,159,51),
'eye':(24,18,25),'mouth':(65,32,47),'plumage':(100,94,113),
'purple':(84,59,111)}
ORDER=list(COLORS);BANDS=len(ORDER)

def make_atlas():
 sz=1024
 a=np.zeros((sz,sz,3),dtype=np.uint8)
 for k,code in enumerate(ORDER):
  y0=k*sz//BANDS; y1=(k+1)*sz//BANDS
  base=np.array(COLORS[code],float)
  for y in range(y0,y1):
   v=(y-y0)/(y1-y0)
   yy=np.arange(sz); w=(.91+.10*np.sin(yy/47.+ k*3.3)+.025*np.sin(yy/9))*(.92+.12*v)
   rng=np.random.default_rng(y+130*k)
   noise=rng.normal(0,2.6,(sz,1))
   a[y,:,:]=np.clip(base[None,:]*w[:,None]+noise,0,255).astype('uint8')
  if code in ('body','wing','wing_lite','plumage','collar'):
   img=Image.fromarray(a);d=ImageDraw.Draw(img,'RGB')
   color=tuple(int(q*.84) for q in COLORS[code]); highlight=tuple(min(255,int(q*1.16)) for q in COLORS[code])
   for x in range(23,1024,43):
    for yy in range(y0+9,y1-2,37):
     xx=x + int(9*math.sin(yy*.1))
     d.line([(xx-15,yy),(xx,yy+10),(xx+13,yy)],fill=color,width=2)
     d.line([(xx,yy-11),(xx,yy+8)],fill=highlight,width=1)
   a=np.array(img)
 Image.fromarray(a,'RGB').save(TEX,optimize=True)
 return Image.open(TEX).convert('RGB')
ATLAS=make_atlas()
MATERIAL=PBRMaterial(baseColorFactor=[255,255,255,255], metallicFactor=0.0, roughnessFactor=.91, baseColorTexture=ATLAS,doubleSided=True)
SCENE=trimesh.Scene()
PARTS=[]

def uvmap(vx,vy,category,shift=0.0):
 """Map arbitrary local 0..1 UV onto category strip. glTF V is bottom up."""
 idx=ORDER.index(category)
 vmin=1-(idx+1)/BANDS+0.006; vmax=1-idx/BANDS-0.006
 return np.stack([np.clip(np.asarray(vx)+shift,0.001,0.999),vmin+np.clip(np.asarray(vy),0.001,0.999)*(vmax-vmin)],axis=-1)

def add(name,vert,faces,cat,uv=None):
 v=np.asarray(vert,dtype=np.float64); f=np.asarray(faces,dtype=np.int64)
 if len(v)<3 or len(f)==0: return
 if uv is None:
  mn=v.min(axis=0);mx=v.max(axis=0);rg=np.maximum(mx-mn,1e-4)
  uv=uvmap((v[:,0]-mn[0])/rg[0],(v[:,2]-mn[2])/rg[2],cat)
 # ensure faces smooth? Model use flat-shaded faces but vertex colors remain textures.
 # split face vertices so normals stay facet sharp, even on broad wing planes.
 vf=v[f.reshape(-1)]
 fnew=np.arange(len(vf)).reshape((-1,3))
 uvf=np.asarray(uv,dtype=float)[f.reshape(-1)]
 mesh=trimesh.Trimesh(vertices=vf,faces=fnew,process=False)
 mesh.visual=TextureVisuals(uv=uvf,material=MATERIAL)
 SCENE.add_geometry(mesh,geom_name=name,node_name=name)
 PARTS.append({'part':name,'tris':len(fnew),'vertices':len(vf),'material':cat})

def loft(name,sections,cat,sides=12,axis='x',theta=0.0):
 """'x' sections (x,y,z,ry,rz). 'y' sections (x,y,z,rx,rz)."""
 sides=min(sides,7) # Lower circumferential tessellation, retain anatomical cross-sections.
 v=[];uv=[];f=[]
 for s,sec in enumerate(sections):
  p,r1,r2,r3,r4=sec
  for j in range(sides):
   ang=2*np.pi*j/sides+theta
   if axis=='x': v.append([p,r1+r3*math.cos(ang),r2+r4*math.sin(ang)])
   elif axis=='y':v.append([p+r3*math.cos(ang),r1,r2+r4*math.sin(ang)])
   else: raise ValueError(axis)
   uv.append(uvmap(s/max(1,len(sections)-1),j/sides,cat))
 for i in range(len(sections)-1):
  for j in range(sides):
   a=i*sides+j; b=i*sides+(j+1)%sides; c=(i+1)*sides+j; d=(i+1)*sides+(j+1)%sides
   f.extend([(a,c,b),(b,c,d)])
 for j in range(1,sides-1):f.append((0,j+1,j))
 off=(len(sections)-1)*sides
 for j in range(1,sides-1):f.append((off,off+j,off+j+1))
 add(name,v,f,cat,uv)

def tapered_path(name,pts,radii,cat,sides=8):
 sides=min(sides,5) # Sparingly faceted anatomical tubes.
 p=np.asarray(pts,dtype=float);v=[];uv=[];f=[]
 for i,c in enumerate(p):
  dr=p[min(len(p)-1,i+1)]-p[max(i-1,0)];dr/=np.linalg.norm(dr)
  up=np.array([0.,1.,0.])
  if abs(np.dot(up,dr))>.96:up=np.array([0.,0.,1.])
  a=np.cross(dr,up);a/=np.linalg.norm(a);b=np.cross(dr,a)
  for j in range(sides):
   th=2*np.pi*j/sides
   v.append(c+radii[i]*(math.cos(th)*a+math.sin(th)*b))
   uv.append(uvmap(i/max(1,len(p)-1),j/sides,cat))
 for i in range(len(p)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   f.extend([(a,b,c),(b,d,c)])
 for j in range(1,sides-1):f.append((0,j,j+1))
 off=(len(p)-1)*sides
 for j in range(1,sides-1):f.append((off,off+j+1,off+j))
 add(name,v,f,cat,uv)

def leaf(name,origin,tip,halfwidth,cat,wing=False,twist=0.0):
 """Thin double-sided aerodynamic flight feather.

 Contour geometry rather than 3D feather boxes: 2–4 triangles, with painted
 barbs/overlapping vane pattern carried by the original UV atlas.
 Large flight feathers have subtle central lift; small coverts are two faces.
 """
 a=np.asarray(origin,float); b=np.asarray(tip,float); dr=b-a
 length=float(np.linalg.norm(dr))
 if length<1e-6:return
 direction=dr/length
 perp=np.cross(direction,[0.,1.,0.]); n=np.linalg.norm(perp)
 perp=perp/n if n>1e-5 else np.array([1.,0.,0.])
 large=(name.startswith('28_') or name.startswith('29_') or name.startswith('24_'))
 if large:
  # A 4-sided silhouette with raised medial feather plane (4 triangles).
  vx=[a+perp*.05*halfwidth, a+direction*length*.50+perp*halfwidth,
      b, a+direction*length*.50-perp*halfwidth,
      a+direction*length*.50+np.array([0,.035,0])]
  faces=[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]
 else:
  # Two triangles, preserving the vane's lateral width and pointed tip.
  vx=[a+perp*.05*halfwidth, a+direction*length*.48+perp*halfwidth,
      b, a+direction*length*.48-perp*halfwidth]
  faces=[(0,1,2),(0,2,3)]
 uv=[]
 for q in vx:
  u=np.dot(q-a,direction)/length
  v=np.dot(q-a,perp)/(halfwidth*2)+.5
  uv.append(uvmap(u,v,cat))
 add(name,vx,faces,cat,uv)

# Main barrel, strong chest and keel, no overlapping spheres
loft('01_corpo_torax',[
(-1.39,1.30,0,.14,.21),(-1.20,1.38,0,.43,.52),(-.86,1.54,0,.66,.67),
(-.43,1.59,0,.77,.72),(.02,1.57,0,.72,.67),(.36,1.54,0,.60,.58),
(.73,1.60,0,.38,.39),(1.02,1.68,0,.17,.22)],'body',18)
# keel & sternum underside functional flight musculature
loft('02_quilha_peitoral',[
(-.80,1.01,0,.12,.20),(-.36,.87,0,.29,.29),(.20,.97,0,.22,.27),(.66,1.19,0,.09,.12)],'plumage',12)
# Neck from chest toward forward tall head
loft('03_pescoco',[
(.57,1.69,0,.35,.36),(.66,1.89,0,.32,.29),(.77,2.13,0,.31,.30),(.92,2.34,0,.29,.29),
(1.02,2.48,0,.25,.265)],'collar',14,axis='y')
# skull crowned bony wedge
loft('04_cranio',[
(.72,2.53,0,.16,.18),(.90,2.60,0,.32,.33),(1.16,2.62,0,.30,.31),
(1.41,2.56,0,.245,.23),(1.60,2.50,0,.13,.14)],'head',12)
# upper beak hooked, distinct from jaw, with downward tip
loft('05_bico_superior',[
(1.48,2.52,0,.15,.20),(1.67,2.52,0,.17,.18),(1.85,2.47,0,.13,.13),
(1.94,2.34,0,.10,.09),(1.93,2.22,0,.035,.045)],'beak',12)
loft('06_mandibula_inferior',[
(1.37,2.38,0,.09,.16),(1.53,2.31,0,.10,.14),(1.69,2.23,0,.05,.115),
(1.80,2.20,0,.03,.045)],'beak',10)
# mouth cavity / tongue inside open bill
loft('07_cavidade_boca',[(1.38,2.39,0,.045,.12),(1.55,2.35,0,.047,.115),(1.65,2.32,0,.022,.04)],'mouth',9)
tapered_path('08_lingua',[[1.40,2.30,0],[1.55,2.25,0],[1.72,2.23,0]],[.07,.053,.007],'purple',7)
# recessed eyes placed as symmetrical dark cavities + amber iris with front-facing gaze
for sign in (-1,1):
 label='L' if sign>0 else 'R';z=sign
 tapered_path(f'09_anel_ocular_{label}',[[1.235,2.656,z*.275],[1.28,2.654,z*.290]],[.100,.108],'eye',9)
 tapered_path(f'10_iris_{label}',[[1.282,2.666,z*.292],[1.32,2.667,z*.297]],[.066,.058],'iris',10)
 tapered_path(f'11_pupila_{label}',[[1.322,2.666,z*.299],[1.34,2.664,z*.305]],[.024,.024],'eye',8)
 # ridged overbrow protects eye, anatomical ridge with pointed tip
 leaf(f'12_sobrancelha_{label}',[1.08,2.77,z*.23],[1.48,2.67,z*.28],.093,'head')
 # nostril near beak
 tapered_path(f'13_narina_{label}',[[1.755,2.558,z*.124],[1.765,2.558,z*.138]],[.034,.032],'eye',8)

# Pale neck ruff: feathers physically shaped and overlap for chest/nape silhouette
for ring in range(3):
 for j in range(16):
  if j in (3,11) or (ring==2 and j in (6,14)): continue  # occluded collar featherlets kept in painted UV
  t=j*2*math.pi/16+ring*.12
  y=2.25-ring*.17
  x0=.78+.36*math.cos(t);z0=.32*math.sin(t)
  start=[x0,y,z0]
  # collar downward/back overlapping, outward fanning, sharp spines not loose plates
  tip=[x0-.14-.07*ring, y-.30-.085*ring, z0+.14*math.sin(t)]
  leaf(f'14_gola_pluma_{ring:02d}_{j:02d}',start,tip,.078 if ring==0 else .098,'collar')

# crown crest receding in profile (doesn't copy hood on reference)
for j in range(9):
 z=(j-4)*.072
 leaf(f'15_crista_coroa_{j}',[.92,2.76,z],[.55,2.86+(4-abs(j-4))*.025,z*1.37],.060,'plumage')

# Legs: both functional stance and carrying load, ankle, articulate visible mid-poly toes
for side in (-1,1):
 S='L' if side>0 else 'R';z=.46*side
 # muscular thigh from lower torso down and toward rear
 tapered_path(f'16_coxa_{S}',[[-.57,1.26,z],[-.68,.99,z*1.20],[-.49,.76,z*1.13]],[.28,.265,.16],'body',11)
 tapered_path(f'17_tarso_{S}',[[-.49,.77,z*1.13],[-.43,.48,z*1.15],[-.38,.30,z*1.14]],[.105,.080,.080],'leg',9)
 tapered_path(f'18_metatarso_{S}',[[-.38,.32,z*1.13],[-.23,.26,z*1.21],[.02,.22,z*1.22]],[.13,.13,.10],'leg',10)
 # 3 front toes splay and rear hallux wraps backwards, hooks are true 3D curved cones
 for j,offset in enumerate((-.24,0,.24)):
  tz=z*1.16+offset; r=.080
  tapered_path(f'19_dedo_{S}_{j}',[[.00,.22,z*1.2],[.27,.14,tz],[.39,.12,tz+.035*side]],[r,.074,.05],'leg',8)
  tapered_path(f'20_garra_{S}_{j}',[[.37,.15,tz+.035*side],[.50,.12,tz+.045*side],[.55,.025,tz+.055*side]],[.080,.056,.008],'claw',9)
 tapered_path(f'21_hallux_{S}',[[-.32,.25,z*1.13],[-.59,.15,z*1.19],[-.68,.14,z*1.11]],[.080,.074,.050],'leg',8)
 tapered_path(f'22_garra_hallux_{S}',[[-.67,.15,z*1.11],[-.81,.10,z*1.14],[-.83,.035,z*1.15]],[.07,.05,.007],'claw',8)

# Tail bone + planar tapering steering feathers, anatomically behind rump
loft('23_base_cauda',[
(-1.20,1.39,0,.18,.24),(-1.45,1.32,0,.19,.25),(-1.80,1.24,0,.13,.20),(-2.14,1.18,0,.04,.09)],'body',12)
for i in range(13):
 z=(i-6)*.075
 root=[-1.64,1.22,z*.50]
 tip=[-2.56-(.20 if abs(i)<4 else -.09),1.10,z*2.15]
 leaf(f'24_retriz_{i:02d}',root,tip,.10,'wing_lite')

# Wings: structural bones + broad mid-span flight surfaces with fully articulated future joints.
# Posed stretched, both wings have upper-arm/humerus, ulna/forewing, primary hand and layered secondary/primary flight feathers.
for sign in (-1,1):
 S='L' if sign>0 else 'R';a=float(sign)
 shoulder=np.array([-.30,2.03,a*.51]);elbow=np.array([-.62,2.82,a*2.03]);wrist=np.array([-.90,3.43,a*3.83]);wingtip=np.array([-1.05,4.16,a*5.08])
 tapered_path(f'25_humero_{S}',[shoulder,(shoulder+elbow)*.5,elbow],[.25,.21,.14],'body',11)
 tapered_path(f'26_ulna_{S}',[elbow,(elbow+wrist)*.5,wrist],[.17,.14,.10],'wing_lite',10)
 tapered_path(f'27_manus_{S}',[wrist,(wrist+wingtip)*.5,wingtip],[.125,.092,.012],'wing_lite',9)
 # broad, tapered membraneless structural feather bed, note flight surfaces are plumes
 # Series of overlapping coverts, secondary and primary feathers.
 # Flight feathers project backwards from leading edge in -X, and outwards toward tips.
 for i in range(23):
  t=(i+.15)/23
  if t<.45:
   x,y,z=shoulder+(elbow-shoulder)*(t/.45)
  elif t<.82:
   x,y,z=elbow+(wrist-elbow)*((t-.45)/.37)
  else:x,y,z=wrist+(wingtip-wrist)*((t-.82)/.18)
  root=np.array([x,y,z]);
  # longest feathers on middle segment, taper toward ends
  depth=(.55+1.72*math.sin(math.pi*t)**.83) * (1-.10*max(0,t-.74))
  sweep= .10 + .38*t
  tip=root+np.array([-depth*.58,-depth*.74-.11,a*sweep])
  leaf(f'28_remige_{S}_{i:02d}',root,tip,.13+.07*math.sin(math.pi*t),'wing',wing=True)
 # outer long primaries sweep outward forming huge jagged tips
 for i in range(10):
  t=i/10
  root=wrist+(wingtip-wrist)*(t*.93)
  dr=1.30*(1-t*.30)
  tip=root+np.array([-.54-1.02*(1-t),-.63-.26*(1-t),a*(.30+.38*t)])
  leaf(f'29_primaria_{S}_{i:02d}',root,tip,.16*(1-t*.62),'wing',wing=True)
 # two rows of layered lesser coverts along wing, compressed scale shapes for depth
 for row in range(2):
  for i in range(19):
   if i in (3,8,13,17): continue  # covered by neighbors; decorative vane detail stays in UV
   t=(i+.3)/20
   if t<.46:
    root=shoulder+(elbow-shoulder)*(t/.46)
   elif t<.81:
    root=elbow+(wrist-elbow)*((t-.46)/.35)
   else:
    root=wrist+(wingtip-wrist)*((t-.81)/.19)
   root=root + np.array([-.12*(row+.5),.045*row,0])
   tip=root+np.array([-.32-.26*row,-.26-.24*row,a*.18])
   leaf(f'30_coberteira_{S}_{row}_{i:02d}',root,tip,.082,'wing_lite',wing=True)
 # near shoulder scalloped hidden upper wing mantle
 for i in range(11):
  t=i/11
  p=shoulder+(elbow-shoulder)*t*.89
  leaf(f'31_escapular_{S}_{i:02d}',p+np.array([.09,.12,0]),p+np.array([-.32,-.20,a*.15]),.084,'body')

# front torso feather silhouette, form follows shoulder and keel
for side in (-1,1):
 S='L' if side>0 else 'R'
 for j in range(13):
  if j in (2,5,8,11): continue  # secondary breast featherlets already represented by atlas
  t=j/13
  x=.39-.92*t; y=1.18+.11*math.sin(t*math.pi); z=side*(.38+.16*math.sin(t*math.pi))
  leaf(f'32_peito_pluma_{S}_{j}',[x,y,z],[x-.21,y-.20,z+side*.08],.07,'plumage')

if __name__=='__main__':
 # Combine tiny anatomically related meshes into efficient material-compatible batches.
 # All UV maps preserved; no merges across topology are claimed.
 groups={}
 for part in PARTS:
  name=part['part'];seq=int(name.split('_')[0])
  side=('L' if '_L' in name else 'R' if '_R' in name else '')
  if 25<=seq<=31:g=f'flight_{side}'
  elif 16<=seq<=22:g=f'legs_{side}'
  elif seq in (14,15):g='feather_collar_crest'
  elif seq in (3,4,5,6,7,8,9,10,11,12,13):g='head_face'
  elif seq in (24,):g='tail_feathers'
  elif seq in (32,):g='chest_feathers'
  else:g='torso'
  groups.setdefault(g,[]).append(SCENE.geometry[name])
 grouped=trimesh.Scene()
 for g,meshes in groups.items():
  combined=trimesh.util.concatenate(meshes)
  grouped.add_geometry(combined,geom_name=g,node_name=g)
 grouped.export(OUT)
 # Actual glb export checked externally; no fake rig or clips.
 h=hashlib.sha256(OUT.read_bytes()).hexdigest()
 data={"species":"Quedravo","version":"v02","stage":"blockout_static","concept_approved":True,
 "model_approved":False,"repository":"carioca1111/wildhaven-new","source":"source/build.py",
 "glb":OUT.name,"bytes":OUT.stat().st_size,"sha256":h,"texture":TEX.name,
 "triangles":sum(x['tris'] for x in PARTS),"meshes":len(groups),"authoring_parts":len(PARTS),"skins":0,"joints":0,"animations":0,
 "dimension_notes":"X forward,Y up,Z lateral; geometry follows v01 body/wing/hunter scale",
 "uv_painted":True,"optimized_from":"quedravo_v01_blockout.glb","geometry_for_color_only":False,"alpha_modified":False,
 "parts_breakdown":{prefix:sum(x['tris'] for x in PARTS if x['part'].split('_')[0]==prefix) for prefix in sorted(set(x['part'].split('_')[0] for x in PARTS))}}
 (ROOT/'manifest.json').write_text(json.dumps(data,indent=2,ensure_ascii=False))
 print(json.dumps({k:data[k] for k in ('bytes','triangles','meshes','sha256')},indent=2))
