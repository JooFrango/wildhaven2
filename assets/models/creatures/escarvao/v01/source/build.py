#!/usr/bin/env python3
"""Wildhaven Escarvão v01 — articulated-looking STATIC concept blockout.
Built from original anatomical polygonal sections, not AI pictures.
Trimesh exports a real GLB with a painted atlas UV texture; no rig in v01.
Axes: X forward, Y up, Z side. Design length ~3.8m (including claws).
Usage: python build.py
"""
from pathlib import Path
import math, hashlib, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

OUT=Path(__file__).resolve().parent.parent
(OUT/'previews').mkdir(parents=True,exist_ok=True)
(OUT/'textures').mkdir(parents=True,exist_ok=True)
RNG=np.random.default_rng(101)
PARTS=[]

# UV category slots: each tile of the 4 x 4 painted atlas corresponds to an anatomical material.
KINDS=['shell','carapace_ridge','shell_dark','underside',
       'limb','limb_dark','palm','pincer',
       'tail','tail_shield','sting','spike',
       'mandible','eye','joint','sand_wear']
SLOT={x:i for i,x in enumerate(KINDS)}
COLORS={
 'cobre': {'shell':'#97653c','carapace_ridge':'#c59960','shell_dark':'#69452e','underside':'#624635','limb':'#846047','limb_dark':'#342f2a','palm':'#a87848','pincer':'#b7a27f','tail':'#805435','tail_shield':'#bd9158','sting':'#d9c5a2','spike':'#9c704b','mandible':'#6c4032','eye':'#18201e','joint':'#342922','sand_wear':'#ccb085'},
 'rubro': {'shell':'#743a3b','carapace_ridge':'#a04d40','shell_dark':'#352d33','underside':'#4c3437','limb':'#634242','limb_dark':'#25232a','palm':'#813b35','pincer':'#a18c7c','tail':'#64343a','tail_shield':'#963d32','sting':'#c3aa97','spike':'#613338','mandible':'#5d2d31','eye':'#201f21','joint':'#2a252a','sand_wear':'#aa7460'},
 'oliva': {'shell':'#777655','carapace_ridge':'#a3a07a','shell_dark':'#464838','underside':'#514f3d','limb':'#68664e','limb_dark':'#2e302b','palm':'#777657','pincer':'#b6ad8b','tail':'#5b6145','tail_shield':'#989774','sting':'#d8ccac','spike':'#787154','mandible':'#5c533e','eye':'#1e241f','joint':'#34362e','sand_wear':'#c7b99a'},
}

def colorhex(h):
 h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)],float)

def atlas(variant):
 size=1024; tile=size//4
 data=np.zeros((size,size,3),dtype=np.uint8)
 rng=np.random.default_rng(77)
 yy,xx=np.mgrid[:tile,:tile]
 fine=rng.normal(0,3.3,(tile,tile)); grain=rng.normal(0,4.5,(tile,tile))
 for k,kind in enumerate(KINDS):
  x0=(k%4)*tile;y0=(k//4)*tile
  base=colorhex(COLORS[variant][kind]);
  # Worn, brushed chitin, natural layering; all color detail exists in UV texture.
  grooves=7*np.sin((xx*0.115+yy*0.036)+k*2.1)
  finebands=3.0*np.cos((xx*0.245-yy*0.031)+k)
  relief=(xx/tile*8-yy/tile*7)+grooves+finebands+fine+grain
  if kind in ('pincer','sting','carapace_ridge','tail_shield'):relief+=8*(xx/tile)
  for c in range(3):
   channel=np.clip(base[c]+relief*(0.65 if c==2 else 1.0),0,255).astype(np.uint8)
   data[y0:y0+tile,x0:x0+tile,c]=channel
 im=Image.fromarray(data,'RGB')
 # Subtle cracked keratin striae, entirely within each tile, no geometry for colors.
 draw=ImageDraw.Draw(im,'RGBA')
 for k,kind in enumerate(KINDS):
  x0=(k%4)*tile; y0=(k//4)*tile
  if kind in ('eye','joint','limb_dark'): continue
  r=np.random.default_rng(k+10)
  for _ in range(14):
   sx=int(x0+r.integers(18,220)); sy=int(y0+r.integers(18,220));
   ex=min(x0+248,sx+int(r.integers(12,45))); ey=max(y0+8,sy-int(r.integers(16,52)))
   draw.line([(sx,sy),(ex,ey)],fill=(17,12,9,48),width=int(r.integers(1,3)))
 im.save(OUT/'textures'/f'escarvao_{variant}_uv_v01.png',optimize=True)
 return im

def uv_for_piece(v,kind):
 """Map geometry to painted UV tile. Projection is per anatomical piece, never extra meshes for color."""
 v=np.asarray(v,float)
 mins=np.min(v,axis=0); mx=np.max(v,axis=0); spans=np.maximum(mx-mins,0.000001)
 # natural longitudinal streaking on claws/plates/tail: dominant axes
 if kind in ('shell','carapace_ridge','shell_dark','palm','pincer','tail','tail_shield','sting','spike','eye'):
  a,b=0,2
 else:a,b=0,1
 # fallback for cross-sectional pieces with narrow projected axes
 if spans[a]<.07: a=int(np.argmax(spans))
 if spans[b]<.07 or b==a:
  b=int(np.argsort(spans)[-2])
  if a==b:b=(a+1)%3
 u=(v[:,a]-mins[a])/spans[a]
 w=(v[:,b]-mins[b])/spans[b]
 slot=SLOT[kind];sx=slot%4;sy=slot//4
 pad=0.023
 # PIL image starts upper left but GLTF UV y starts bottom left
 uu=(sx+pad+(1-2*pad)*u)/4
 vv=1-(sy+pad+(1-2*pad)*w)/4
 return np.column_stack([uu,vv])

def add(name,points,triangles,kind):
 pts=np.asarray(points,float); faces=np.asarray(triangles,np.int64)
 if not len(faces):return
 # Flat normals: duplicate each face's vertices to create explicit hard facets.
 p=pts[faces.reshape(-1)]
 f=np.arange(len(p),dtype=np.int32).reshape(-1,3)
 uv=uv_for_piece(pts,kind)[faces.reshape(-1)]
 PARTS.append((name,p,f,uv,kind))

def loft_x(name,sections,kind,sides=10,phase=0.0):
 # sections: x,cy,vertical_radius,lateral_radius ; controlled anatomical rings
 vv=[];ff=[]
 for x,y,ry,rz in sections:
  for j in range(sides):
   a=2*math.pi*j/sides+phase
   vv.append([x,y+ry*math.cos(a),rz*math.sin(a)])
 for i in range(len(sections)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   ff.extend([[a,b,c],[b,d,c]])
 for j in range(1,sides-1):ff.append([0,j,j+1])
 off=(len(sections)-1)*sides
 for j in range(1,sides-1):ff.append([off,off+j+1,off+j])
 add(name,vv,ff,kind)

def tube(name,pts,rr,kind,sides=8,ellipticity=1.0):
 """Cross-sectioned tapered organic segment with finite capped ends."""
 pts=np.asarray(pts,float)
 if isinstance(rr,(float,int)):rr=[rr]*len(pts)
 vs=[];fs=[]
 for i,c in enumerate(pts):
  f=pts[min(len(pts)-1,i+1)]-pts[max(i-1,0)]
  f/=np.linalg.norm(f)
  h=np.array([0.,1.,0.])
  if abs(float(f@h))>0.92:h=np.array([0.,0.,1.])
  u=np.cross(f,h);u/=np.linalg.norm(u)
  w=np.cross(f,u)
  for j in range(sides):
   a=2*math.pi*j/sides
   vs.append(c+rr[i]*(math.cos(a)*u*ellipticity+math.sin(a)*w))
 for i in range(len(pts)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   fs.extend([[a,c,b],[b,c,d]])
 for j in range(1,sides-1):fs.append([0,j+1,j])
 off=(len(pts)-1)*sides
 for j in range(1,sides-1):fs.append([off,off+j,off+j+1])
 add(name,vs,fs,kind)

def armor(name,poly,thickness,raise_by,kind):
 """Folded polygon plate, beveled shell with raised ridge; no paint geometry."""
 p=np.asarray(poly,float); n=len(p)
 center=np.mean(p,axis=0);top=center.copy();top[1]+=raise_by
 inner=p.copy();inner[:,1]-=thickness
 verts=np.vstack([p,inner,top]);faces=[]
 for i in range(n):
  j=(i+1)%n
  faces.extend([[i,j,2*n],[i,n+j,j],[i,n+i,n+j]])
 add(name,verts,faces,kind)

def wedge(name,base,tip,kind,width=0.1):
 p=np.array(base,float); tip=np.array(tip,float)
 d=tip-p;d/=np.linalg.norm(d)
 side=np.cross(d,[0,1,0]);
 if np.linalg.norm(side)<0.02:side=np.array([1,0,0]);
 side/=np.linalg.norm(side)
 v=[p+side*width,p-side*width,p+np.array([0,width*.75,0]),tip]
 f=[[0,1,2],[0,3,1],[1,3,2],[2,3,0]]
 add(name,v,f,kind)

# 1) Continuous volumetric abdomen, head and adjoining ventral shelf.
loft_x('abdomen_core',[
 (-1.54,.75,.14,.26),(-1.34,.76,.27,.49),(-1.10,.78,.32,.63),
 (-.77,.79,.34,.73),(-.44,.79,.35,.77),(-.08,.79,.33,.72),(.25,.82,.30,.64),
 (.57,.83,.28,.57)],'shell_dark',sides=12,phase=.0)
loft_x('cephalothorax_shield',[ (.25,.84,.29,.65),(.55,.89,.38,.68),(.88,.86,.35,.60),
 (1.12,.80,.27,.46),(1.38,.71,.15,.29),(1.49,.67,.06,.12)],'shell',sides=12)
loft_x('sternum',[(-1.06,.57,.10,.33),(-.56,.50,.17,.45),(.24,.49,.16,.48),(.96,.47,.11,.34)],'underside',sides=10)

# 2) Back armor arranged in biomechanical overlapping plates.
for i,x in enumerate([-1.35,-1.04,-.70,-.33,.05,.38]):
 w=[.40,.58,.65,.67,.61,.47][i]
 y=[1.10,1.19,1.21,1.22,1.20,1.18][i]
 polygon=[[x-.19,y-.09,0],[x-.13,y+.035,w*.64],[x+.07,y+.035,w],
          [x+.24,y-.10,w*.79],[x+.29,y-.04,0],[x+.24,y-.10,-w*.79],
          [x+.07,y+.035,-w],[x-.13,y+.035,-w*.64]]
 armor('tergite_%02d'%i,polygon,.060,.11,'tail_shield' if i%2==0 else 'shell')
 # point-shaped protrusions to break up silhouette with biomechanical purpose
 for sign in [-1,1]:
  wedge(f'lateral_carapace_tooth_{i}_{sign}',[x-.08,y-.01,sign*w*.82],[x+.03,y+.08,sign*(w+0.23)],'spike',.08)
# Strong brow shield on head, no eye pasted to front
armor('cranial_brow',[[.74,1.16,-.49],[1.10,1.16,-.43],[1.41,.79,-.16],[1.46,.74,0],
                      [1.41,.79,.16],[1.10,1.16,.43],[.74,1.16,.49]],.10,.11,'carapace_ridge')
# Inset eyes: raised orbital small enclosed faceted sockets
for s in [-1,1]:
 tube('orbital_socket_'+str(s),[[1.17,1.00,s*.37],[1.27,.988,s*.386],[1.33,.98,s*.36]], [.111,.105,.038],'shell_dark',8)
 tube('recessed_eye_'+str(s),[[1.26,1.012,s*.411],[1.275,1.016,s*.425],[1.286,1.016,s*.427]],[.073,.064,.035],'eye',8)
 tube('mandible_'+str(s),[[1.36,.63,s*.20],[1.47,.49,s*.17],[1.55,.42,s*.09]],[.12,.095,0.012],'mandible',8)

# 3) Eight genuine locomotor limbs (4 per side) and natural foot contact.
for side in [-1,1]:
 for idx,x in enumerate([.55,.05,-.48,-1.03]):
  l=[1.36,1.57,1.70,1.63][idx]
  shift=[.32,.13,-.10,-.33][idx]
  p0=[x,.72,side*.55]
  p1=[x+shift*.25,1.05,side*.98]
  p2=[x+shift*.60,.92,side*l]
  p3=[x+shift*.93,.31,side*(l+.12)]
  p4=[x+shift+.14,.095,side*(l+.22)]
  p5=[x+shift+.27,.062,side*(l+.32)]
  # The leg uses changing faceted cross-sections instead of round capsules
  tube(f'leg_{side}_{idx}_coxa',[p0,[x+.01,.81,side*.76],p1],[.205,.172,.132],'limb_dark',8,ellipticity=.82)
  tube(f'leg_{side}_{idx}_femur',[p1,[(p1[0]+p2[0])*.5,1.20,side*(.98+l)*.5],p2],[.17,.178,.13],'limb',8,ellipticity=.87)
  tube(f'leg_{side}_{idx}_tibia',[p2,[(p2[0]+p3[0])*.5,.61,side*(l+.08)],p3],[.132,.106,.09],'limb_dark',7)
  tube(f'leg_{side}_{idx}_tarsus',[p3,p4,p5],[.10,.063,.008],'pincer',7)
  # hard crest piece changes silhouette, not solely painting
  wedge(f'leg_{side}_{idx}_crest',[p2[0],p2[1]+.08,p2[2]],[p2[0]-.14,p2[1]+.20,p2[2]+side*.1],'spike',.070)

# 4) Pedipalps — outward shoulders, powerful tapering forearms, huge open sickles.
for s in [-1,1]:
 root=[.83,.64,s*.55]; elbow=[1.25,.83,s*.92];forearm=[1.66,.63,s*1.27];palm=[2.01,.46,s*1.34]
 tube('pedipalp_'+str(s),[root,[1.03,.73,s*.78],elbow],[.24,.24,.21],'limb_dark',10)
 tube('forearm_'+str(s),[elbow,[1.45,.76,s*1.12],forearm],[.21,.23,.30],'limb',10)
 loftsections=[(1.55,.54,.23,.24),(1.80,.48,.30,.35),(2.08,.47,.30,.36),(2.29,.48,.22,.30)]
 # palm translated in Z, a complete armored pincer base
 loft_x('palm_'+str(s),[(x,y,ry,rz) for x,y,ry,rz in loftsections],'palm',sides=10,phase=.10)
 # Issue: loft_x above centers Z at 0; add correction in postprocess below by modifying last part
 name,p,f,uv,k=PARTS[-1];p[:,2]+=s*1.34;PARTS[-1]=(name,p,f,uv,k)
 # Upper and lower curved gripping fingers form open gap (functional silhouette).
 top_pts=[[2.20,.68,s*1.50],[2.46,.84,s*1.54],[2.70,.83,s*1.45],[2.87,.64,s*1.33]]
 bot_pts=[[2.20,.27,s*1.20],[2.48,.15,s*1.16],[2.70,.22,s*1.23],[2.89,.52,s*1.31]]
 tube('upper_chela_'+str(s),top_pts,[.23,.18,.115,.012],'pincer',10,ellipticity=.94)
 tube('lower_chela_'+str(s),bot_pts,[.225,.20,.12,.012],'pincer',10,ellipticity=.92)
 # denticles face inside gripping gap; true anatomy, not decoration for color.
 for n,t in enumerate([2.40,2.56]):
  wedge(f'upper_chela_tooth_{s}_{n}',[t,.76,s*(1.53-.06*n)],[t+.03,.64,s*(1.50-.07*n)],'sting',.035)
  wedge(f'lower_chela_tooth_{s}_{n}',[t,.25,s*(1.20+.04*n)],[t+.07,.39,s*(1.25+.04*n)],'sting',.032)
 # dorsal armor over palm
 armor('palm_plate_'+str(s),[[1.76,.72,s*1.13],[2.12,.76,s*1.12],[2.30,.69,s*1.29],
     [2.25,.74,s*1.54],[1.88,.78,s*1.61]],.06,.07,'tail_shield')

# 5) Metasoma/cauda: six tapered, kinked axial sections and curved sharp aculeus.
tail_center=[[-1.50,.80,0],[-1.79,1.02,0],[-2.05,1.31,0],[-2.11,1.68,0],[-2.01,2.05,0],[-1.79,2.34,0],[-1.49,2.47,0],[-1.28,2.29,0]]
for i in range(6):
 p0=np.array(tail_center[i]);p1=np.array(tail_center[i+1]);mid=(p0+p1)*.5
 r0=[.28,.28,.255,.225,.185,.15][i]
 r1=[.29,.27,.23,.185,.15,.11][i]
 tube('metasoma_segment_'+str(i),[p0,mid,p1],[r0,r0*.96,r1],'tail',10,ellipticity=.86)
 # curved armor on top of each section, shape is expressed by broad trapezoid
 tan=p1-p0;tan=tan/np.linalg.norm(tan);normal=np.array([tan[1],-tan[0],0]);
 if normal[1]<0:normal=-normal
 start=p0*.35+p1*.65
 w=.13 if i>3 else .19
 armor(f'tail_dorsal_{i}',[start+np.array([0,0,-w]),start+normal*.10+np.array([0,0,-w*.82]),
                              start+normal*.14+np.array([0,0,w*.82]),start+np.array([0,0,w])],.04,.06,'tail_shield')
# Stinger and hooked apical tooth
stinger=[tail_center[6],[-1.30,2.48,0],[-1.12,2.39,0],[-1.07,2.17,0],[-1.18,2.05,0]]
tube('poison_bulb', [tail_center[6],[-1.37,2.45,0]],[.18,.15],'pincer',10)
tube('scimitar_stinger',stinger[1:],[.15,.16,.091,.009],'sting',10)

# Build one anatomical mesh + one textured material. Geometry identical for all variants.
VV=[];FF=[];UV=[];part_report=[]
for name,p,f,uv,kind in PARTS:
 off=len(VV);VV.extend(p.tolist());UV.extend(uv.tolist());FF.extend((f+off).tolist())
 part_report.append({'name':name,'faces':len(f),'anatomical_material':kind})
VV=np.array(VV,dtype=np.float32);FF=np.array(FF,dtype=np.int32);UV=np.array(UV,dtype=np.float32)
assert len(VV)==len(UV)
all_outputs=[]
for variant in COLORS:
 img=atlas(variant)
 mesh=trimesh.Trimesh(vertices=VV,faces=FF,process=False,validate=False)
 mesh.visual=TextureVisuals(uv=UV,material=PBRMaterial(name=f'escarvao_{variant}_atlas',baseColorTexture=img,metallicFactor=0.0,roughnessFactor=.92,doubleSided=True))
 scene=trimesh.Scene()
 scene.add_geometry(mesh,geom_name=f'escarvao_v01_{variant}')
 raw=scene.export(file_type='glb')
 path=OUT/f'escarvao_{variant}_blockout_v01.glb'
 path.write_bytes(raw)
 reopened=trimesh.load(path,force='scene',process=False)
 g=list(reopened.geometry.values())
 assert sum(len(m.faces) for m in g)==len(FF), (variant,len(FF))
 assert all(np.isfinite(m.vertices).all() for m in g)
 all_outputs.append({'variant':variant,'glb':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                     'tris':len(FF),'vertices':len(VV),'meshes':len(g), 'textures':1,'skins':0,'joints':0,'animations':0,
                     'texture_filename':f'textures/escarvao_{variant}_uv_v01.png',
                     'texture_sha256':hashlib.sha256((OUT/'textures'/f'escarvao_{variant}_uv_v01.png').read_bytes()).hexdigest()})
print(json.dumps(all_outputs,indent=2,ensure_ascii=False))
manifest={'species':'escarvao','label':'Escarvão','version':'v01','stage':'static_anatomical_blockout',
          'reference':'Wildhaven Torvardo v03; approved Escarvao concept','coordinate_system':'X forward, Y up, Z lateral',
          'scale':'metres; bounds measured from geometry below; candidate scale pending art review',
          'bounding_box_m':{'x_length':round(float(np.ptp(VV[:,0])),3),'y_height':round(float(np.ptp(VV[:,1])),3),'z_width':round(float(np.ptp(VV[:,2])),3)},
          'variants':all_outputs,'anatomical_parts':len(PARTS),'part_triangles':part_report,
          'approval':{'concept':'approved_to_blockout','form':'awaiting_user_review','refinement':'not_started'},
          'publication':{'github':'not_yet_verified','integration':'none'},
          'note':'All color/pattern variations are UV painted textures; 100% identical geometry across 3 GLBs. No rig/clips/LODs at blockout stage.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
