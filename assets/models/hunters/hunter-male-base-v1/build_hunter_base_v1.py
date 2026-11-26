#!/usr/bin/env python3
"""Wildhaven Hunter Masculino Base v1.0 — reproducible glTF 2.0 skinned asset.
Stdlib-only generator. glTF geometry, inverse bind matrices and keyframed clips.
No changes to the playable game. Run: python build_hunter_base_v1.py
"""
import hashlib, json, math, os, struct, sys
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent / 'output'
OUT.mkdir(parents=True, exist_ok=True)
HEIGHT = 1.72
# Approximate proportions from approved concept, deliberately understated anatomy.
# Body is faceted, no procedural image planes, height 1.72m, front faces +Z.
BONES = [
    ('Root',None,(0,0,0)),
    ('Pelvis',0,(0,.95,0)),
    ('Spine',1,(0,.13,0)),
    ('Chest',2,(0,.24,0)),
    ('Neck',3,(0,.145,0)),
    ('Head',4,(0,.115,0)),
    ('UpperArm_L',3,(-.275,.075,0)),
    ('LowerArm_L',6,(-.255,0,0)),
    ('Hand_L',7,(-.205,0,0)),
    ('UpperArm_R',3,(.275,.075,0)),
    ('LowerArm_R',9,(.255,0,0)),
    ('Hand_R',10,(.205,0,0)),
    ('Thigh_L',1,(-.135,-.055,0)),
    ('Shin_L',12,(0,-.40,0)),
    ('Foot_L',13,(0,-.37,0)),
    ('Thigh_R',1,(.135,-.055,0)),
    ('Shin_R',15,(0,-.40,0)),
    ('Foot_R',16,(0,-.37,0)),
]
INDEX={b[0]:i for i,b in enumerate(BONES)}
PARENTS=[b[1] for b in BONES]
ABS=[]
for _,pa,loc in BONES:
    if pa is None: ABS.append(loc)
    else: ABS.append(tuple(ABS[pa][i]+loc[i] for i in range(3)))

MAT={
 'skin':([.65,.39,.265,1.0],.91),
 'skin_light':([.74,.47,.315,1.0],.92),
 'skin_dark':([.55,.30,.20,1.0],.92),
 'briefs':([.20,.19,.20,1.0],1.0),
 'briefs_band':([.14,.13,.15,1.0],1.0),
 'eye_white':([.88,.81,.70,1.0],1.0),
 'iris':([.12,.11,.10,1.0],1.0),
 'brows':([.22,.16,.14,1.0],1.0),
}

def dot(a,b):return sum(x*y for x,y in zip(a,b))
def sub(a,b):return tuple(a[i]-b[i] for i in range(3))
def add(a,b):return tuple(a[i]+b[i] for i in range(3))
def mul(a,s):return tuple(x*s for x in a)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def length(a):return math.sqrt(dot(a,a))
def normalize(a):return mul(a,1/max(1e-10,length(a)))

class Geometry:
 def __init__(self):
  self.polys=defaultdict(list)
 def face(self,material,bone,a,b,c):
  normal=normalize(cross(sub(b,a),sub(c,a)))
  if length(normal)<.5:return
  self.polys[material].append((bone,[a,b,c],normal))
 def cylinder(self,material,bone,a,b,rings=(),n=9):
  """Faceted elliptical tube between ring centers, surfaces are true triangles."""
  axis=normalize(sub(b,a))
  ref=(0,0,1) if abs(dot(axis,(0,0,1)))<.95 else (0,1,0)
  u=normalize(cross(ref,axis)); v=normalize(cross(axis,u))
  if not rings: raise ValueError('rings required')
  ringverts=[]
  for t,rx,rz in rings:
   center=add(a,mul(sub(b,a),t))
   ringverts.append([add(center, add(mul(u,rx*math.cos(2*math.pi*j/n)),mul(v,rz*math.sin(2*math.pi*j/n)))) for j in range(n)])
  for r in range(len(ringverts)-1):
   for j in range(n):
    j2=(j+1)%n
    for p,q,w in [(ringverts[r][j],ringverts[r+1][j],ringverts[r+1][j2]),(ringverts[r][j],ringverts[r+1][j2],ringverts[r][j2])]:
     nrm=cross(sub(q,p),sub(w,p))
     cen=mul(add(add(p,q),w),1/3)
     stem=add(a,mul(sub(b,a),(rings[r][0]+rings[r+1][0])*.5))
     radial=sub(cen,stem)
     if dot(nrm,radial)<0:q,w=w,q
     self.face(material,bone,p,q,w)
  # Caps
  for j in range(n):
   self.face(material,bone,a,ringverts[0][(j+1)%n],ringverts[0][j])
   self.face(material,bone,b,ringverts[-1][j],ringverts[-1][(j+1)%n])
 def box(self,material,bone,center,size):
  x,y,z=center; sx,sy,sz=(s/2 for s in size)
  vv=[(x+dx*sx,y+dy*sy,z+dz*sz) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
  for inds in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(1,2,6,5),(0,4,7,3)]:
   a,b,c,d=[vv[i] for i in inds]
   self.face(material,bone,a,b,c);self.face(material,bone,a,c,d)
 def tetra(self,material,bone,vs):
  for tri in [(0,1,2),(0,3,1),(1,3,2),(2,3,0)]:self.face(material,bone,*(vs[i] for i in tri))

def body_mesh(lod):
 g=Geometry(); n=10 if lod==0 else 7
 bn=INDEX
 # Briefs/pelvis, broad hips but no over-defined anatomy.
 g.cylinder('briefs',bn['Pelvis'],(0,.875,0),(0,1.065,0),[(0,.204,.115),(.33,.224,.138),(.73,.218,.132),(1,.205,.119)],n)
 g.cylinder('briefs_band',bn['Pelvis'],(0,1.055,0),(0,1.082,0),[(0,.207,.120),(1,.201,.117)],n)
 # Slight trapezoid chest and smooth/flat stomach, no sculpted abs.
 g.cylinder('skin',bn['Spine'],(0,1.07,0),(0,1.303,0),[(0,.197,.115),(.55,.213,.126),(1,.255,.139)],n)
 g.cylinder('skin',bn['Chest'],(0,1.299,0),(0,1.468,0),[(0,.256,.140),(.45,.297,.143),(.84,.264,.127),(1,.176,.102)],n)
 g.cylinder('skin',bn['Neck'],(0,1.445,0),(0,1.585,0),[(0,.082,.077),(.4,.078,.072),(1,.083,.083)],8 if lod==0 else 7)
 # Bald head compact, jaw and cheeks integrated.
 g.cylinder('skin_light',bn['Head'],(0,1.536,0),(0,1.719,0),[(0,.078,.078),(.20,.105,.106),(.44,.111,.113),(.71,.112,.106),(.91,.092,.090),(1,.055,.055)],n)
 # ears, nose, eyes and brows as geometric mesh pieces, not texture decals.
 for sign in [-1,1]:
  g.box('skin',bn['Head'],(sign*.116,1.617,0),(.034,.070,.044))
  # face points outward +z. mesh at positive-z surface.
  xx=sign*.044
  g.box('eye_white',bn['Head'],(xx,1.644,.114),(.042,.018,.009))
  g.box('iris',bn['Head'],(xx,1.644,.121),(.016,.018,.006))
  g.box('brows',bn['Head'],(xx,1.666,.118),(.048,.010,.009))
 g.tetra('skin_light',bn['Head'],[(-.021,1.617,.105),(.021,1.617,.105),(0,1.585,.143),(0,1.639,.122)])
 # Arms — slender at rest despite broad upper body.
 for s,label in [(-1,'L'),(1,'R')]:
  shoulder=.278*s; elbow=.533*s; wrist=.739*s; fingertip=.866*s
  u=bn['UpperArm_'+label]; l=bn['LowerArm_'+label]; h=bn['Hand_'+label]
  g.cylinder('skin',u,(shoulder,1.397,0),(elbow,1.397,0),[(0,.084,.081),(.33,.085,.081),(.85,.069,.064),(1,.066,.061)],n)
  g.cylinder('skin_light',l,(elbow,1.397,0),(wrist,1.397,0),[(0,.068,.061),(.25,.073,.065),(.77,.051,.046),(1,.046,.043)],n)
  g.cylinder('skin_light',h,(wrist,1.397,0),(fingertip,1.397,0),[(0,.048,.040),(.42,.049,.034),(.85,.038,.023),(1,.030,.019)],n if lod==0 else 6)
  g.cylinder('skin',h,(s*.755,1.371,.045),(s*.799,1.351,.072),[(0,.026,.022),(1,.017,.017)],6)
 # Legs slightly chunky, short, understated.
 for s,label in [(-1,'L'),(1,'R')]:
  x=s*.138
  thigh=bn['Thigh_'+label]; shin=bn['Shin_'+label]; foot=bn['Foot_'+label]
  g.cylinder('skin',thigh,(x,.888,0),(x,.486,0),[(0,.119,.105),(.20,.121,.112),(.65,.099,.092),(.90,.079,.077),(1,.082,.075)],n)
  g.cylinder('skin_light',shin,(x,.495,0),(x,.120,0),[(0,.083,.076),(.20,.077,.072),(.48,.086,.079),(.81,.066,.063),(1,.063,.061)],n)
  g.cylinder('skin',foot,(x,.112,0),(x,.071,.128),[(0,.073,.065),(.30,.082,.088),(.88,.101,.087),(1,.094,.077)],n)
 return g

def q_axis(axis,rad):
 s=math.sin(rad/2);return [axis[0]*s,axis[1]*s,axis[2]*s,math.cos(rad/2)]
def qmul(a,b):
 x,y,z,w=a;u,v,t,p=b
 return [w*u+x*p+y*t-z*v,w*v-x*t+y*p+z*u,w*t+x*v-y*u+z*p,w*p-x*u-y*v-z*t]
def qrot_x(v):return q_axis((1,0,0),v)
def qrot_y(v):return q_axis((0,1,0),v)
def qrot_z(v):return q_axis((0,0,1),v)

# Locomotion starts with T-pose as bind pose but lowers arms when animating.
# 8 separate glTF keyframed clips, each evaluated independently.
CLIPS={
 'idle':2.0, 'walk':1.1, 'run':.70, 'attack':1.05,
 'guard':1.30,'dodge':.85,'hit':.70,'death':1.55,
}
def sample_pose(clip,t,duration):
 u=t/duration; phase=u*2*math.pi
 rot={}; trans={}; sway=math.sin(phase)
 for side,label in [(-1,'L'),(1,'R')]:
  base=-side*math.pi/2
  if clip in ('idle','walk','run'):
   amp={'idle':.045,'walk':.38,'run':.74}[clip]
   legamp={'idle':.02,'walk':.49,'run':.83}[clip]
   sign=1 if label=='L' else -1
   rot['UpperArm_'+label]=qmul(qrot_x(sign*amp*sway),qrot_z(base*.96))
   rot['Thigh_'+label]=qrot_x(-sign*legamp*sway)
   rot['Shin_'+label]=qrot_x(max(0,sign*legamp*sway)*.5)
  else:
   rot['UpperArm_'+label]=qrot_z(base*.94)
 if clip=='idle':
  rot['Chest']=qrot_z(.018*sway);rot['Head']=qrot_y(.055*sway)
 elif clip=='walk':
  rot['Chest']=qrot_y(.040*sway);trans['Pelvis']=[0,.004+.010*abs(sway),0]
 elif clip=='run':
  rot['Chest']=qrot_x(-.17);trans['Pelvis']=[0,-.013+.030*abs(sway),0]
 elif clip=='attack':
  # Right fist swings from shoulder through frontal plane and returns.
  punch=math.sin(math.pi*min(1,max(0,(u-.12)/.72)))**2
  rot['UpperArm_R']=qmul(qrot_y(-.45*punch),qrot_z(-1.25+1.14*punch))
  rot['LowerArm_R']=qrot_y(.82*punch)
  rot['Chest']=qrot_y(-.26*punch)
 elif clip=='guard':
  p=min(1,u*5,(1-u)*5)
  rot['UpperArm_L']=qmul(qrot_x(-.60*p),qrot_z(1.27-.48*p))
  rot['UpperArm_R']=qmul(qrot_x(-.60*p),qrot_z(-1.27+.48*p))
  rot['LowerArm_L']=qrot_y(-.50*p);rot['LowerArm_R']=qrot_y(.50*p)
 elif clip=='dodge':
  p=math.sin(math.pi*u)**2
  trans['Root']=[.31*p,0,-.16*p];rot['Chest']=qrot_z(-.27*p)
  rot['Thigh_L']=qrot_x(.21*p);rot['Thigh_R']=qrot_x(-.24*p)
 elif clip=='hit':
  p=math.sin(math.pi*u)
  rot['Chest']=qrot_x(.36*p);rot['Head']=qrot_x(-.23*p)
  trans['Root']=[0,0,-.08*p]
 elif clip=='death':
  # Forward collapse to floor, permanent final frame is held at t=duration.
  p=u*u*(3-2*u)
  rot['Root']=qrot_x(1.42*p)
  trans['Root']=[0,-.66*p,.16*p]
  rot['Chest']=qrot_x(.19*p)
  rot['UpperArm_L']=qrot_z((math.pi/2)*(.94-.63*p))
  rot['UpperArm_R']=qrot_z(-(math.pi/2)*(.94-.63*p))
 return rot,trans

class Buffer:
 def __init__(self):self.raw=bytearray();self.views=[];self.accessors=[]
 def pack(self,data,fmt,ctype,typ,ncomp,target=None,normal=False):
  while len(self.raw)%4:self.raw.append(0)
  off=len(self.raw)
  vals=[x for row in data for x in (row if isinstance(row,(list,tuple)) else [row])]
  self.raw.extend(struct.pack('<'+fmt*len(vals),*vals))
  v={'buffer':0,'byteOffset':off,'byteLength':len(self.raw)-off}
  if target is not None:v['target']=target
  vi=len(self.views);self.views.append(v)
  a={'bufferView':vi,'componentType':ctype,'count':len(data),'type':typ}
  if normal:a['normalized']=True
  if typ in ('VEC3','SCALAR') and ctype==5126 and data:
   a['min']=[min(x[i] if isinstance(x,(list,tuple)) else x for x in data) for i in range(ncomp)]
   a['max']=[max(x[i] if isinstance(x,(list,tuple)) else x for x in data) for i in range(ncomp)]
  ai=len(self.accessors);self.accessors.append(a);return ai

def write_glb(lod):
 geo=body_mesh(lod);buf=Buffer(); meshes=[];prims=[]
 for name in MAT:
  faces=geo.polys.get(name,[])
  if not faces:continue
  vertices=[];normals=[];bones=[];weights=[];indices=[]
  for bone,tri,normal in faces:
   base=len(vertices)
   for p in tri:
    vertices.append(p);normals.append(normal);bones.append([bone,0,0,0]);weights.append([1,0,0,0])
   indices.extend([base,base+1,base+2])
  pos=buf.pack(vertices,'f',5126,'VEC3',3,target=34962)
  no=buf.pack(normals,'f',5126,'VEC3',3,target=34962)
  joints=buf.pack(bones,'H',5123,'VEC4',4,target=34962)
  weight=buf.pack(weights,'f',5126,'VEC4',4,target=34962)
  idx=buf.pack(indices,'I',5125,'SCALAR',1,target=34963)
  prims.append({'attributes':{'POSITION':pos,'NORMAL':no,'JOINTS_0':joints,'WEIGHTS_0':weight},'indices':idx,'material':list(MAT).index(name),'mode':4})
 mesh={'name':f'HunterMasculinoBase_LOD{lod}','primitives':prims}
 nodes=[]
 for i,(name,parent,loc) in enumerate(BONES):
  nodes.append({'name':name,'translation':list(loc)})
 for i,pa in enumerate(PARENTS):
  if pa is not None:nodes[pa].setdefault('children',[]).append(i)
 mesh_node=len(nodes)
 nodes.append({'name':'SkinnedMesh','mesh':0,'skin':0})
 ibms=[]
 for p in ABS:
  ibms.append([1,0,0,0,0,1,0,0,0,0,1,0,-p[0],-p[1],-p[2],1])
 ibmacc=buf.pack(ibms,'f',5126,'MAT4',16)
 animations=[]
 for clip,duration in CLIPS.items():
  times=[round(duration*i/12,5) for i in range(13)]
  ta=buf.pack(times,'f',5126,'SCALAR',1)
  channels=[];samplers=[]
  poses=[sample_pose(clip,t,duration) for t in times]
  for i,(name,_,loc) in enumerate(BONES):
   if any(name in p[0] for p in poses):
    values=[p[0].get(name,[0,0,0,1]) for p in poses]
    # Quaternions remain on the same hemisphere for linear interpolation.
    for k in range(1,len(values)):
     if dot(values[k],values[k-1])<0:values[k]=[-v for v in values[k]]
    acc=buf.pack(values,'f',5126,'VEC4',4)
    si=len(samplers);samplers.append({'input':ta,'output':acc,'interpolation':'LINEAR'})
    channels.append({'sampler':si,'target':{'node':i,'path':'rotation'}})
   if any(name in p[1] for p in poses):
    values=[add(loc,p[1].get(name,[0,0,0])) for p in poses]
    acc=buf.pack(values,'f',5126,'VEC3',3)
    si=len(samplers);samplers.append({'input':ta,'output':acc,'interpolation':'LINEAR'})
    channels.append({'sampler':si,'target':{'node':i,'path':'translation'}})
  animations.append({'name':clip,'channels':channels,'samplers':samplers,'extras':{'duration_seconds':duration}})
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Hunter Base v1 — Python stdlib'},
       'scene':0,'scenes':[{'nodes':[0,mesh_node]}],'nodes':nodes,'meshes':[mesh],
       'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':col,'metallicFactor':0,'roughnessFactor':rough},'doubleSided':True} for name,(col,rough) in MAT.items()],
       'skins':[{'name':'HunterSkeleton','joints':list(range(len(BONES))),'skeleton':0,'inverseBindMatrices':ibmacc}],
       'animations':animations,'accessors':buf.accessors,'bufferViews':buf.views,'buffers':[{'byteLength':len(buf.raw)}],
       'extras':{'wildhavenAsset':'hunter-male-base','version':'1.0','heightMeters':HEIGHT,'restPose':'T-pose','frontAxis':'+Z','units':'meters','geometryIsReal':True}}
 txt=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
 txt+=b' ' *((-len(txt))%4);bb=bytes(buf.raw)+b'\0' *((-len(buf.raw))%4)
 out=struct.pack('<4sII',b'glTF',2,12+8+len(txt)+8+len(bb))+struct.pack('<I4s',len(txt),b'JSON')+txt+struct.pack('<I4s',len(bb),b'BIN\0')+bb
 path=OUT/f'hunter_male_base_v1_lod{lod}_animated.glb';path.write_bytes(out)
 return {'file':str(path.relative_to(OUT.parent)),'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest(),
         'triangles':sum(len(x) for x in geo.polys.values()),'bones':len(BONES),'clips':list(CLIPS),'primitive_count':len(prims),'vertices':sum(len(v) for v in geo.polys.values())*3},geo

def validate(path):
 raw=Path(path).read_bytes()
 assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
 assert struct.unpack_from('<I',raw,8)[0]==len(raw)
 jlen=struct.unpack_from('<I',raw,12)[0]
 j=json.loads(raw[20:20+jlen]);assert len(j['skins'][0]['joints'])==18
 assert set(a['name'] for a in j['animations'])==set(CLIPS)
 assert all(len(a['channels'])>0 for a in j['animations'])
 assert j['buffers'][0]['byteLength']>0
 for p in j['meshes'][0]['primitives']:
  assert 'JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes']
 return j

if __name__=='__main__':
 result=[]
 for level in (0,1):
  item,geo=write_glb(level);validate(OUT/item['file'].split('/')[-1]);result.append(item)
 manifest={'id':'hunter-male-base','version':'1.0','designStatus':'prototype-awaiting-real-model-review',
           'heightMeters':HEIGHT,'defaultPose':'T','coordinateSystem':'glTF Y-up, forward +Z',
           'contentNote':'Actual geometry, joint skinning and keyframe animations. No Blender project or hand-painted textures.',
           'assets':result,'generator':'build_hunter_base_v1.py'}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(manifest,indent=2,ensure_ascii=False))
