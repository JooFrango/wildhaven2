#!/usr/bin/env python3
"""Wildhaven: Dodarro/Dodo Gigante static anatomy blockout with UV texture atlases.
Original geometry, no sphere-primitives assembled as final shape. Anatomical
cross-sectional lofts, braced legs, cut planes, weighted beak, feather silhouettes.
X forward, Y up, Z left/right. User approved concepts; blockout still unapproved.
"""
from pathlib import Path
import io, math, hashlib, json, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
random.seed(23)
PALETTE={
 'body': '#8c7060','body_light':'#a88970','body_shadow':'#59463f','chest':'#e6ceaa',
 'ruff':'#bc6946','crest':'#c9683a','wing':'#5b6270','wing_light':'#7d8190',
 'tail':'#b87c4d','leg':'#615451','leg_light':'#84766f','claw':'#373439',
 'beak':'#424148','beak_top':'#71645e','face':'#c5905b','socket':'#422d25',
 'iris':'#e7a844','pupil':'#171a20','saddle':'#68412b','saddle_light':'#8d5a3b',
 'strap':'#956a45','brass':'#9b875b','cloth':'#9c4837','cream':'#d8b48b',
 'baggage':'#705846'
}
TILES=list(PALETTE.keys())
# 6 cols x 4 rows, 24 cells
COLS,ROWS=6,5


def rgba(hexcolor):
 v=hexcolor.lstrip('#');return tuple(int(v[i:i+2],16) for i in (0,2,4))

def texture_atlas():
 size=(1536,1280); im=Image.new('RGB',size,(90,90,90)); d=ImageDraw.Draw(im)
 cell=256
 for idx,key in enumerate(TILES):
  cx=(idx%COLS)*cell;cy=(idx//COLS)*cell
  base=np.array(rgba(PALETTE[key]),dtype=np.int16)
  # Painterly but controlled texture patches; actual feather/keratin/wood surface detail in UV.
  patch=Image.new('RGB',(cell,cell),rgba(PALETTE[key]));q=ImageDraw.Draw(patch)
  rng=random.Random(100+idx)
  for j in range(190):
   x=rng.randrange(6,250);y=rng.randrange(6,250);wid=rng.randint(2,19)
   dd=rng.randint(-15,16)
   col=tuple(int(np.clip(c+dd,0,255)) for c in base)
   if key in ('body','body_light','body_shadow','chest','ruff','crest','wing','wing_light','tail'):
    # Delicate chevron feather edges, tonal shading, not polygons for recoloring
    q.line([(x-wid//2,y-4),(x,y+8),(x+wid//2,y-4)],fill=col,width=rng.randint(1,2))
   elif key in ('saddle','saddle_light','strap','cloth','baggage','brass'):
    q.line([(x,y),(x+rng.randint(3,27),y+rng.randint(-3,3))],fill=col,width=rng.randint(1,3))
   else:
    q.line([(x,y),(x+rng.randint(-4,4),y+rng.randint(3,16))],fill=col,width=1)
  im.paste(patch,(cx,cy))
 return im
ATLAS=texture_atlas()

def uv_tile(name,u,v):
 idx=TILES.index(name);row=idx//COLS;col=idx%COLS
 # inset prevents bleed; texture v=0 is bottom row of atlas
 return ((col+0.04+0.92*u)/COLS, 1.0-(row+0.04+0.92*v)/ROWS)

class Build:
 def __init__(self):
  self.vertices=[];self.faces=[];self.uv=[];self.tags={};self.count=0
 def part(self,name, v, f, uv, tile):
  v=np.asarray(v,dtype=float);f=np.asarray(f,dtype=np.int32);uv=np.asarray(uv,dtype=float)
  assert len(v)==len(uv),name
  before=len(self.faces)
  # intentional hard normals for facet cuts. split at every triangle; UV stays attached to surface
  for ids in f:
   start=len(self.vertices)
   for a in ids:
    self.vertices.append(v[a].tolist());self.uv.append(uv_tile(tile,*uv[a]))
   self.faces.append([start,start+1,start+2])
  self.tags[name]=len(self.faces)-before
 def loft_x(self,name,sections,tile,n=12):
  # sections = x,y,verticalRadius,lateralRadius ; custom anatomy in a continuous loft
  v=[];f=[];u=[]
  for i,(x,y,rv,rz) in enumerate(sections):
   for j in range(n+1):
    a=2*math.pi*j/n
    # deliberately squared flank / breast planes, phase aligned
    v.append((x,y+rv*math.cos(a),rz*math.sin(a)))
    u.append((i/max(1,len(sections)-1),j/n))
  for i in range(len(sections)-1):
   for j in range(n):
    a=i*(n+1)+j;b=a+1;c=(i+1)*(n+1)+j;dd=c+1
    f.extend([(a,c,b),(b,c,dd)])
  # cap fan to stable closed surface
  for j in range(1,n-1):
   f.append((0,j+1,j));s=(len(sections)-1)*(n+1);f.append((s,s+j,s+j+1))
  self.part(name,v,f,u,tile)
 def loft_y(self,name,sections,tile,n=10):
  # sections = cx,cy,cz,rx,rz, central x/radii for structurally tapered legs/neck
  v=[];f=[];u=[]
  for i,(cx,cy,cz,rx,rz) in enumerate(sections):
   for j in range(n+1):
    a=2*math.pi*j/n
    v.append((cx+rx*math.cos(a),cy,cz+rz*math.sin(a)))
    u.append((i/max(1,len(sections)-1),j/n))
  for i in range(len(sections)-1):
   for j in range(n):
    a=i*(n+1)+j;b=a+1;c=(i+1)*(n+1)+j;dd=c+1
    f.extend([(a,b,c),(b,dd,c)])
  for j in range(1,n-1):
   f.append((0,j,j+1));s=(len(sections)-1)*(n+1);f.append((s,s+j+1,s+j))
  self.part(name,v,f,u,tile)
 def tube(self,name,points,radius,tile,n=7):
  # radius scalar or radii list, segmented path frame, no ballooned spheres
  pts=np.asarray(points,float);radii=np.full(len(pts),radius) if np.isscalar(radius) else np.asarray(radius,float)
  v=[];uv=[];f=[]
  for i,pt in enumerate(pts):
   forward=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]
   forward/=max(np.linalg.norm(forward),1e-6)
   v1=np.array((0.,0.,1.))
   if abs(np.dot(v1,forward))>.86:v1=np.array((1.,0.,0.))
   a=np.cross(forward,v1);a/=np.linalg.norm(a);b=np.cross(forward,a)
   for j in range(n+1):
    ang=2*math.pi*j/n
    p=pt+radii[i]*(a*math.cos(ang)+b*math.sin(ang))
    v.append(p);uv.append((i/max(1,len(pts)-1),j/n))
  for i in range(len(pts)-1):
   for j in range(n):
    a=i*(n+1)+j;b=a+1;c=(i+1)*(n+1)+j;dd=c+1
    f.extend([(a,c,b),(b,c,dd)])
  for j in range(1,n-1):
   f.append((0,j+1,j));s=(len(pts)-1)*(n+1);f.append((s,s+j,s+j+1))
  self.part(name,v,f,uv,tile)
 def feather(self,name,root,shoulder,tip,tile,width=.10,thickness=.026):
  # faceted spearhead feather, with a single prominent angular ridge; colored in texture
  p=np.array(root,float);q=np.array(shoulder,float);t=np.array(tip,float)
  v=np.array([p+[0,0,-width/2],p+[0,0,width/2],q+[0,0,-width],q+[0,0,width],t,p+[0,thickness,0]],float)
  f=[(0,2,5),(0,5,1),(1,5,3),(2,4,5),(3,5,4),(2,0,4),(1,3,4)]
  uv=[(.0,.0),(1,.0),(.0,.65),(1,.65),(.5,1),(.5,.55)]
  self.part(name,v,f,uv,tile)
 def feather_side(self,name,base,tip,tile,width=.10):
  """A tapered feather BLENDING into body/wing: planar XY silhouette, ridge in Z.
  This is structural geometry to preserve layered wing outline, not color patches.
  """
  p=np.asarray(base,float);t=np.asarray(tip,float)
  d=t[:2]-p[:2];d=d/max(np.linalg.norm(d),1e-6)
  normal=np.array([-d[1],d[0]])
  m=p*.47+t*.53
  a=p.copy();bb=p.copy();c=m.copy();dd=m.copy();e=t.copy();ridge=m.copy()
  a[:2]+=normal*width*.36;bb[:2]-=normal*width*.36
  c[:2]+=normal*width;dd[:2]-=normal*width
  ridge[2]+=np.sign(p[2])*.022
  v=[a,bb,c,dd,e,ridge]
  f=[(0,2,5),(0,5,1),(1,5,3),(2,4,5),(3,5,4)]
  self.part(name,v,f,[(.18,.05),(.82,.05),(.05,.50),(.95,.50),(.50,.97),(.5,.5)],tile)
 def plate_side(self,name,pts,tile,depth=.009):
  """Extrude plate along outward lateral normal, e.g. inset eyes/saddle flaps."""
  pts=np.asarray(pts,float);n=len(pts);sgn=1 if np.mean(pts[:,2])>0 else -1
  v=pts.tolist();v.extend((pts+np.array([0,0,sgn*depth])).tolist())
  xx=pts[:,0];yy=pts[:,1]
  uv=[]
  for _ in (0,1):
   for p in pts:uv.append(((p[0]-min(xx))/max(np.ptp(xx),1e-5),(p[1]-min(yy))/max(np.ptp(yy),1e-5)))
  f=[]
  for i in range(1,n-1):f.extend([(0,i,i+1),(n,n+i+1,n+i)])
  for i in range(n):
   j=(i+1)%n;f.extend([(i,j,n+j),(i,n+j,n+i)])
  self.part(name,v,f,uv,tile)
 def plate(self,name,pts,tile,depth=.014):
  # large geometric saddle/face plates, not decorative texture-color masses
  pts=np.asarray(pts,float);n=len(pts);v=pts.tolist();v.extend((pts-np.array([0,depth,0])).tolist());uv=[]
  xx=pts[:,0];zz=pts[:,2]
  for i in range(2):
   for p in pts:uv.append(((p[0]-min(xx))/max(np.ptp(xx),1e-5),(p[2]-min(zz))/max(np.ptp(zz),1e-5)))
  f=[]
  for i in range(1,n-1):f.extend([(0,i,i+1),(n,n+i+1,n+i)])
  for i in range(n):
   j=(i+1)%n;f.extend([(i,j,n+j),(i,n+j,n+i)])
  self.part(name,v,f,uv,tile)
 def mesh(self):
  m=trimesh.Trimesh(vertices=np.asarray(self.vertices,dtype=np.float32),faces=np.asarray(self.faces,dtype=np.int32),process=False)
  mat=PBRMaterial(baseColorTexture=ATLAS,metallicFactor=0.0,roughnessFactor=0.94,doubleSided=True)
  m.visual=trimesh.visual.TextureVisuals(uv=np.asarray(self.uv,dtype=np.float32),material=mat)
  assert m.faces.shape[0]==len(self.faces)
  return m

def make(saddle=False):
 b=Build()
 # Torso: exaggerated hip/thorax mass with intentionally distributed radial sections, not a sphere primitive.
 b.loft_x('01_tronco_quadril_torax',[
  (-1.12,1.28,.13,.16),(-1.06,1.31,.34,.35),(-.89,1.37,.49,.50),
  (-.68,1.38,.54,.57),(-.43,1.39,.55,.59),(-.12,1.42,.53,.57),
  (.16,1.43,.47,.50),(.42,1.48,.36,.40),(.58,1.52,.23,.29),
  (.67,1.55,.10,.15)],'body',14)
 # Continuous throat and ruffed upright neck (a separate linked anatomical loft embedded in thorax).
 b.loft_y('02_pescoco_base_pescoito',[
  (.37,1.35,0,.31,.33),(.40,1.55,0,.28,.29),(.48,1.74,0,.22,.22),
  (.55,1.91,0,.17,.17),(.65,2.12,0,.17,.16),(.68,2.26,0,.20,.18)],'chest',12)
 b.loft_x('03_cranio_plano_frontal',[
  (.57,2.27,.17,.16),(.69,2.33,.20,.23),(.82,2.34,.22,.23),
  (.99,2.30,.19,.20),(1.10,2.28,.13,.17)],'face',12)
 b.loft_x('04_bico_superior_curvo',[
  (1.02,2.24,.11,.17),(1.17,2.24,.15,.20),(1.34,2.25,.14,.19),
  (1.49,2.24,.15,.15),(1.56,2.17,.15,.11),(1.58,2.07,.07,.06),
  (1.56,2.03,.018,.025)],'beak',10)
 b.loft_x('05_mandibula_subjacente',[
  (1.04,2.17,.04,.14),(1.22,2.16,.06,.15),(1.39,2.12,.04,.12),(1.48,2.10,.02,.065)],'beak_top',10)
 # Mouth crease on each side and shallow raised rim at eye socket, same common atlas, no color-specific geometry.
 for s in (-1,1):
  b.plate_side('06_arcada_olho_'+str(s),[(.72,2.43,s*.241),(.91,2.45,s*.245),(.98,2.37,s*.240),(.92,2.30,s*.247),(.74,2.31,s*.243)],'socket',.015)
  # small inset iris mounted in eye cavity rather than a protruding sphere
  z=s*.252
  b.plate_side('07_iris_'+str(s),[(.82,2.392,z),(.87,2.374,z+s*.006),(.875,2.335,z+s*.006),(.825,2.331,z),(.797,2.362,z)],'iris',.002)
  b.plate_side('08_pupila_'+str(s),[(.844,2.374,z+s*.018),(.859,2.358,z+s*.020),(.844,2.340,z+s*.018),(.831,2.356,z+s*.018)],'pupil',.001)
  b.tube('09_boca_risco_'+str(s),[(1.16,2.135,s*.169),(1.31,2.128,s*.142),(1.47,2.119,s*.077)],(.010,.012,.005),'beak_top',5)
 # Ruffed neck crest and chest feathers: layered sharp plates, roughly symmetric with silhouette spurs.
 for s in (-1,1):
  for k in range(6):
   yy=1.56+k*.131
   root=(.40-(k*.023),yy,s*(.24-.011*k))
   q=(.28-k*.019,yy-.055,s*(.24-.008*k))
   tip=(.34-k*.009,yy-.085,s*(.29-.009*k))
   b.feather_side(f'10_ruff_s{s}_{k}',root,tip,'ruff' if k>2 else 'chest',.09)
 # Head crown swept backward, shaped quills rather than spike-cones.
 for s in (-1,1):
  for k in range(5):
   b.feather(f'11_crista_s{s}_{k}',(.70-k*.035,2.49-k*.027,s*(.07+.026*k)),(.58-k*.039,2.51-k*.018,s*(.07+.030*k)),(.42-k*.057,2.50-k*.035,s*(.08+.026*k)),'crest',.05,.012)
 # Trunk chest feather apron, few triangular feather tips integrated into breast.
 for k in range(6):
  for s in (-1,1):
   x=.44-k*.115;y=1.49-k*.040;z=s*(.31+.04*(k>1))
   b.feather_side(f'12_peito_frente_{s}_{k}',(x,y,z),(x-.20,y-.19,z),'chest',.10)
 # Two anatomical leg systems (hip -> knee -> hock -> ankle), overlapping structural volumes.
 for side in [-1,1]:
  z=side*.37
  b.loft_y(f'13_coxa_poderosa_{side}',[
    (-.50,1.13,z,.19,.17),(-.49,.94,z,.19,.16),(-.36,.71,z,.15,.13),
    (-.22,.57,z,.13,.11)],'body_shadow',10)
  b.loft_y(f'14_joelho_tornozelo_{side}',[
    (-.22,.61,z,.12,.115),(-.17,.45,z,.112,.11),(-.20,.27,z,.105,.103),
    (-.22,.12,z,.135,.128)],'leg',10)
  b.tube(f'15_metatarsos_{side}',[(-.22,.19,z),(-.11,.115,z),(.08,.07,z)],(.137,.145,.168),'leg_light',8)
  # three grounded separate toes fan from metatarsal, forward and laterally spread
  for toe in range(3):
   dz=(toe-1)*.15
   b.tube(f'16_dedo_{side}_{toe}',[(.04,.083,z+dz*.25),(.22,.064,z+dz*.69),(.43+(toe==1)*.055,.049,z+dz)],(.096,.090,.060),'leg',7)
   b.tube(f'17_unha_{side}_{toe}',[(.39+(toe==1)*.055,.053,z+dz),(.49+(toe==1)*.06,.048,z+dz*1.07),(.55+(toe==1)*.065,.011,z+dz*1.12)],(.069,.044,.005),'claw',6)
  # heel spur points back (not a 4th enormous toe)
  b.tube(f'18_esporão_{side}',[(-.26,.11,z),(-.36,.09,z+side*.045),(-.40,.056,z+side*.055)],(.065,.053,.015),'claw',6)
 # Wings are built as functional folded wing volumes; feather plates sculpt their rear edge not color plates.
 for side in [-1,1]:
  z=side*.505
  b.loft_x(f'19_asa_cobertura_{side}',[
   (-.73,1.48,.11,.075),(-.65,1.59,.20,.105),(-.48,1.61,.24,.13),
   (-.23,1.61,.20,.14),(.02,1.55,.13,.10),(.22,1.49,.055,.045)],'wing',12)
  # Reinforce visible lateral outline with feather blades pointing downward and rearwards
  for row in range(2):
   for i in range(8):
    x=.10-i*.108-row*.03
    y=1.69-row*.12-0.04*(i>3)
    outer=z+side*(.09+row*.11)
    b.feather_side(f'20_remiges_{side}_{row}_{i}',(x,y,outer),(x-.21,y-.25-row*.026,outer+side*.05),
              'wing' if (row==0) else 'wing_light',.085)
 # Tail: 7 fan lobes with slight upraised fan, essential silhouette.
 for i in range(9):
  dz=(i-4)*.085
  b.feather(f'21_leque_cauda_{i}',(-1.01,1.52,dz*.4),(-1.18,1.66,dz*.9),(-1.46-0.025*(i%3),1.74+0.05*(i%2),dz*1.65),'tail',.078,.024)
 if saddle:
  # Stylized wearable rig: construction overlays the SAME anatomical body;
  # leather/cloth remains UV textured. No geometry solely for changing plumage color.
  b.plate('22_manta_anatomica',[
    (-.85,1.83,-.48),(-.49,2.00,-.54),(-.06,1.98,-.44),
    (-.07,1.98,.44),(-.49,2.00,.54),(-.85,1.83,.48)],'cloth',.021)
  b.plate('23_assento_couro',[
    (-.77,2.005,-.37),(-.57,2.06,-.38),(-.19,2.055,-.36),(-.15,1.985,-.27),
    (-.15,1.985,.27),(-.19,2.055,.36),(-.57,2.06,.38),(-.77,2.005,.37)],'saddle',.04)
  b.tube('24_pomo_dianteiro',[(-.17,2.00,-.31),(-.18,2.17,0),(-.17,2.00,.31)],(.06,.07,.06),'saddle_light',7)
  b.tube('25_encosto_traseiro',[(-.76,2.02,-.32),(-.83,2.17,0),(-.76,2.02,.32)],(.060,.074,.060),'saddle',7)
  # chest band in front of wings, a utilitarian harness, not ornamental armor
  for side in (-1,1):
   b.tube(f'26_correia_peitoral_{side}',[(.03,1.87,side*.38),(.26,1.60,side*.48),(.29,1.37,side*.43)],(.038,.036,.029),'strap',6)
   b.tube(f'27_correia_central_{side}',[(-.52,1.96,side*.42),(-.52,1.60,side*.60),(-.55,1.18,side*.44)],(.039,.042,.033),'strap',6)
   # short single stirrup away from knees
   b.tube(f'28_estrivo_{side}',[(-.49,1.40,side*.57),(-.45,1.16,side*.59),(-.44,1.10,side*.59),(-.35,1.10,side*.59),(-.34,1.16,side*.59)],(.018,.018,.024,.024,.018),'brass',5)
   b.plate_side(f'29_aba_sela_{side}',[(-.67,1.76,side*.60),(-.28,1.72,side*.63),(-.30,1.40,side*.62),(-.64,1.44,side*.62)],'saddle_light',.015)
  # Packs mounted aft of rider, small for fast exploration
  for side in (-1,1):
   z=side*.49
   b.loft_x('30_alforge_'+str(side),[(-.97,1.59,.10,.095),(-.82,1.62,.14,.12),(-.67,1.62,.13,.10),(-.60,1.58,.055,.05)],'baggage',6)
  b.tube('31_rolo_forracao',[(-.94,1.89,-.28),(-.94,1.89,0),(-.94,1.89,.28)],(.09,.09,.09),'cream',8)
 return b

def export_one(saddle):
 code='montaria' if saddle else 'selvagem'
 b=make(saddle);mesh=b.mesh()
 # strict export/reload, use GLB embedded PNG and buffers
 path=ROOT/f'dodarro_{code}_v01_blockout.glb'
 sc=trimesh.Scene();sc.add_geometry(mesh,geom_name='dodarro_'+code)
 sc.export(file_obj=str(path),file_type='glb')
 got=trimesh.load(str(path),force='scene')
 total=sum(len(g.faces) for g in got.geometry.values())
 assert total==len(mesh.faces),(total,len(mesh.faces))
 tex=len([g for g in got.geometry.values() if isinstance(g.visual,trimesh.visual.TextureVisuals)])
 assert tex>0,'GLB lost texture UVs'
 import io
 # ensure GLB contains image, texture, UV
 from trimesh.exchange.gltf import load_glb
 raw=path.read_bytes()
 assert raw[:4]==b'glTF'
 manifest={'species':'Dodarro (Dodo Gigante)','version':'v01 anatomy UV blockout',
  'variant':code,'concept_user_approved':True,'form_user_approved':False,'stage':'3D blockout for form review',
  'glb':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
  'triangles':total,'uv_textured_meshes':tex,'materials':1,'texture_atlases':1,
  'skins':0,'joints':0,'animation_clips':0,'lods':0,'coordinate_system':'X-forward, Y-up, Z-side',
  'source':'source/build_dodarro.py','texture':'textures/dodarro_atlas_v01.png',
  'references':['Torvardo v03 (PR39)','Mastélio v03 (PR42)','Garruva v03 (PR44)'],
  'geometry_parts':b.tags,
  'note':'Static 3D blockout, no rig or clips; still needs visual approval before refinement.'}
 (ROOT/f'manifest_{code}_v01.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 print(code,total,len(raw),hashlib.sha256(raw).hexdigest(),tex)
 return manifest

if __name__=='__main__':
 ROOT.mkdir(exist_ok=True,parents=True)
 (ROOT/'textures').mkdir(exist_ok=True)
 ATLAS.save(ROOT/'textures'/'dodarro_atlas_v01.png',optimize=True)
 out=[export_one(False),export_one(True)]
 (ROOT/'manifest_v01.json').write_text(json.dumps({'variants':out},ensure_ascii=False,indent=2),encoding='utf-8')