#!/usr/bin/env python3
"""Gravarto v02 — skinned glTF animation preserving the complete UV-painted v01 geometry.

Source geometry / texture are read from the already exported v01 GLB; no simulated
screenshot or colored-geometry substitutions. X = forward, Y = up, Z = lateral.
One true glTF skin (JOINTS_0, WEIGHTS_0, inverseBindMatrices) with 27 joints.
Authoring uses weighted 4-joint linear blending; this is an in-place animation
asset, NOT terrain IK, collision or in-game ecological behavior.
"""
from __future__ import annotations
from pathlib import Path
import hashlib, io, json, math, struct
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation
import trimesh

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
ORIG=ROOT.parent/'gravarto_v01'
if not ORIG.exists():ORIG=ROOT.parent/'v01'
ORIG_GLB=ORIG/'gravarto-v01-anatomy-blockout.glb'
ORIG_MANIFEST=ORIG/'manifest.json'
OUT=ROOT/'gravarto-v02-animated-LOD0.glb'
assert ORIG_GLB.exists(),f'Missing original {ORIG_GLB}'

# Parent-relative nodes; bind position is in WORLD model coordinates (metres).
PIVOTS=[
 ('root',None,(0,0,0)),
 ('pelvis','root',(-.50,.96,0)),
 ('spine','pelvis',(-.10,.98,0)),
 ('chest','spine',(.67,1.02,0)),
 ('neck','chest',(1.32,1.14,0)),
 ('head','neck',(1.93,1.23,0)),
 ('jaw','head',(1.88,1.045,0)),
 ('tail01','pelvis',(-1.40,.90,0)),
 ('tail02','tail01',(-1.95,.75,0)),
 ('tail03','tail02',(-2.65,.58,0)),
 ('tail04','tail03',(-3.25,.45,0)),
]
for label,side in (('R',-1),('L',1)):
 for where,x,z in (('fore',.73,.47),('hind',-1.03,.54)):
  base='chest' if where=='fore' else 'pelvis'
  # Sprawling but load-bearing monitor-lizard limbs, not mammal straight legs.
  k=f'{where}{label}'
  PIVOTS += [
   (f'{k}_upper',base,(x,1.06,side*z)),
   (f'{k}_elbow',f'{k}_upper',(x+(.15 if where=='fore' else -.13),.66,side*(z+.29))),
   (f'{k}_wrist',f'{k}_elbow',(x+(.25 if where=='fore' else .05),.32,side*(z+.43))),
   (f'{k}_paw',f'{k}_wrist',(x+(.35 if where=='fore' else .10),.12,side*(z+.47))),
  ]
BONES=[p[0] for p in PIVOTS]
PARENT={n:p for n,p,_ in PIVOTS}
POS={n:np.array(x,float) for n,_,x in PIVOTS}
ID={n:i for i,n in enumerate(BONES)}
assert len(BONES)==27

CLIPS={
 'idle':(3.2,True), 'walk':(1.85,True), 'trot':(1.16,True),
 'short_sprint':(.81,True), 'stalk':(2.65,True),
 'turn_left':(1.4,False), 'turn_right':(1.4,False),
 'alert':(1.4,False), 'sniff':(2.4,True), 'bite':(.95,False),
 'tail_sweep':(1.3,False), 'threaten':(1.9,False),
 'feed':(3.0,True), 'drink':(3.1,True), 'rest':(3.0,False),
 'hurt':(1.05,False), 'death':(2.5,False),
}
def clamp(x):return min(1.,max(0.,float(x)))
def smooth(t): t=clamp(t); return t*t*(3.-2.*t)
def pulse(t,center,width):return math.exp(-((t-center)/width)**2)
def fade(t,d):return smooth(t/.25)*smooth((d-t)/.25)
def blend(x,seq):
 """Smooth weighted joint interpolation along X or Y sectional anatomy."""
 if x<=seq[0][0]:return [(seq[0][1],1.)]
 if x>=seq[-1][0]:return [(seq[-1][1],1.)]
 for (lo,a),(hi,b) in zip(seq[:-1],seq[1:]):
  if lo<=x<=hi:
   t=smooth((x-lo)/(hi-lo));return [(a,1-t),(b,t)]
 raise AssertionError(x)

def skin_for_part(name,p):
 x,y,z=map(float,p)
 # Torso flexes as continuous body mass with controlled transverse bend.
 if name.startswith('01_'):
  return blend(x,[(-1.33,'pelvis'),(-.49,'pelvis'),(-.07,'spine'),(.72,'chest'),(1.23,'neck')])
 if name.startswith('02_'):
  return blend(x,[(.90,'chest'),(1.15,'neck'),(1.7,'head')])
 if name.startswith('03_'):
  return [('head',1.)]
 if name.startswith('04_'):
  return [('jaw',1.)]
 if name.startswith('05_'):
  return blend(x,[(-3.72,'tail04'),(-3.25,'tail04'),(-2.65,'tail03'),(-1.95,'tail02'),(-1.40,'tail01'),(-1.10,'pelvis')])
 if name.startswith('06_'):
  # Shoulder and elbow axes are anatomical controls; gradual weights soften
  # shaft bending, while joints and feet remain readable and structural.
  parts=name.split('_'); k=parts[1]+('L' if parts[3]=='left' else 'R')
  return blend(y,[(.15,f'{k}_paw'),(.27,f'{k}_wrist'),(.62,f'{k}_elbow'),(1.05,f'{k}_upper'),(1.19,f'{k}_upper')])
 if name.startswith(('07_','08_')):
  parts=name.split('_');k=parts[1]+('L' if parts[2]=='left' else 'R')
  return [(f'{k}_paw',1.)]
 if name.startswith('09_'):
  if x< -1.16:return blend(x,[(-3.72,'tail04'),(-3.25,'tail04'),(-2.65,'tail03'),(-1.95,'tail02'),(-1.4,'tail01'),(-1.16,'pelvis')])
  return blend(x,[(-1.16,'pelvis'),(-.45,'pelvis'),(-.06,'spine'),(.7,'chest'),(1.3,'neck')])
 if name.startswith('10_') or name.startswith(('11_','12_','13_','14_','15_','16_')):
  return [('head',1.)]
 raise ValueError('Unrecognized part '+name)

class GLB:
 def __init__(self):self.binary=bytearray();self.views=[];self.accessors=[]
 def put(self,data,target=None):
  raw=data if isinstance(data,bytes) else np.ascontiguousarray(data).tobytes()
  start=len(self.binary);self.binary.extend(raw);self.binary.extend(b'\x00'*((-len(raw))%4))
  d={'buffer':0,'byteOffset':start,'byteLength':len(raw)}
  if target:d['target']=target
  self.views.append(d);return len(self.views)-1
 def attr(self,arr,component=5126,kind=None,normalized=False,minmax=False,target=None):
  a=np.ascontiguousarray(arr)
  ncomp=1 if a.ndim==1 else int(np.prod(a.shape[1:]))
  kind=kind or {1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[ncomp]
  d={'bufferView':self.put(a,target),'componentType':component,'count':len(a),'type':kind}
  if normalized:d['normalized']=True
  if minmax:
   d['min']=(np.min(a,axis=0) if a.ndim>1 else np.array([a.min()])).astype(float).tolist()
   d['max']=(np.max(a,axis=0) if a.ndim>1 else np.array([a.max()])).astype(float).tolist()
  self.accessors.append(d);return len(self.accessors)-1
 def export(self,path,gltf):
  gltf.update({'buffers':[{'byteLength':len(self.binary)}],'bufferViews':self.views,'accessors':self.accessors})
  js=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4)
  bb=bytes(self.binary);bb+=b'\x00'*((-len(bb))%4)
  result=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(bb))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(bb),b'BIN\x00')+bb
  path.write_bytes(result)
  return len(result),hashlib.sha256(result).hexdigest()

def load_v01():
 src=ORIG_GLB.read_bytes();static=json.loads(ORIG_MANIFEST.read_text())
 assert hashlib.sha256(src).hexdigest()==static['glb']['sha256']
 scene=trimesh.load(ORIG_GLB,force='scene')
 mesh=next(iter(scene.geometry.values()))
 vertices=np.asarray(mesh.vertices,dtype='<f4')
 faces=np.asarray(mesh.faces,dtype='<u2')
 uv=np.asarray(mesh.visual.uv,dtype='<f4')
 assert len(faces)==4888 and len(uv)==len(vertices)==14664
 # Important: use ORIGINAL atlas image. No color geometry or re-paint during rig.
 original_img=mesh.visual.material.baseColorTexture.convert('RGBA')
 orig_atlas=Image.open(ORIG/'texture/gravarto-v01-albedo.png').convert('RGBA')
 assert orig_atlas.size==(2048,2048) and original_img.size==orig_atlas.size
 assert np.array_equal(np.asarray(original_img),np.asarray(orig_atlas)), 'Textura embedded != source original'
 out=io.BytesIO();original_img.save(out,format='PNG',optimize=True)
 return vertices,faces,uv,out.getvalue(),static

def model_geometry(verts,face,uv,static):
 # Mesh vertices are split per face in v01. Split layout is PRESERVED to avoid
 # smoothing/facet loss, and to preserve the exact original UV painting.
 norm=np.zeros_like(verts)
 vface=verts[face];n=np.cross(vface[:,1]-vface[:,0],vface[:,2]-vface[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-10)
 norm[face]=n[:,None,:]
 jw=np.zeros((len(verts),4),dtype='u1')
 wt=np.zeros((len(verts),4),dtype='<f4')
 cursor=0
 for part in static['parts']:
  num=part['triangles']*3
  for i in range(cursor,cursor+num):
   pairs=skin_for_part(part['name'],verts[i]); assert pairs
   for j,(bone,w) in enumerate(pairs):
    jw[i,j]=ID[bone];wt[i,j]=w
  cursor+=num
 assert cursor==len(verts)
 assert np.max(np.abs(wt.sum(axis=1)-1))<1.e-6
 return norm,jw,wt

def quat(rx=0.,ry=0.,rz=0.):return Rotation.from_euler('xyz',[rx,ry,rz]).as_quat().astype('<f4')

def motion(clip,t,duration):
 u=t/duration; phase=2*math.pi*u;sn=math.sin(phase);cs=math.cos(phase)
 d={};root=np.zeros(3,float)
 def add(name,xyz):d[name]=np.array(xyz,float)
 def sway_tail(amp,base=0):
  for i,j in enumerate(('tail01','tail02','tail03','tail04')):
   add(j,(0,amp*(1+.2*i)*math.sin(phase-.35*i)+base, .025*sn/(i+1)))
 if clip in ('idle','walk','trot','short_sprint','stalk'):
  if clip=='idle':
   root[1]=.008*sn
   add('spine',(0,.012*sn,.012*sn));add('chest',(0,-.009*sn,.013*sn))
   add('head',(.016*sn,.037*math.sin(phase-.3),-.016*sn));sway_tail(.07)
  else:
   mag={'walk':.23,'trot':.35,'short_sprint':.48,'stalk':.10}[clip]
   headbob={'walk':.018,'trot':.034,'short_sprint':.055,'stalk':.01}[clip]
   root[1]=headbob*(1-math.cos(2*phase))/2 + (-.045 if clip=='stalk' else 0)
   root[0]=.015*sn
   add('pelvis',(0,.020*sn,-.012*cs))
   add('spine',(0,.027*sn,.012*cs))
   add('chest',(0,-.025*sn,-.018*cs))
   add('neck',(0,.015*sn,-.016*cs))
   add('head',(0,.013*sn,.023*cs))
   sway_tail(.09 if clip=='walk' else .14 if clip!='stalk' else .04)
   # Diagonal couplets for a plausible quadruped gait, with grounded body
   # mass. Joint angles deliberately moderate to limit foot-slide.
   for limb in ('fore','hind'):
    for side in ('L','R'):
     off=(math.pi if ((limb=='fore')==(side=='R')) else 0)
     if clip=='short_sprint' and limb=='hind':off+=.30
     v=math.sin(phase+off);sw=max(0.,v)
     k=limb+side
     add(k+'_upper',(0,0,mag*v))
     add(k+'_elbow',(0,0,-.13*v-.17*sw))
     add(k+'_wrist',(0,0,.10*v+.10*sw))
     add(k+'_paw',(0,0,-.10*v))
 elif clip in ('turn_left','turn_right'):
  sign=1 if clip=='turn_left' else -1
  a=smooth(t/.32)*smooth((duration-t)/.30)
  add('pelvis',(0,sign*.15*a,0));add('spine',(0,sign*.18*a,0));add('chest',(0,sign*.17*a,0));add('neck',(0,sign*.13*a,0));add('head',(0,sign*.12*a,0))
  add('tail01',(0,-sign*.12*a,0));add('tail02',(0,-sign*.13*a,0));add('tail03',(0,-sign*.14*a,0))
  add('foreL_upper',(0,0,sign*.11*a));add('foreR_upper',(0,0,-sign*.11*a))
 elif clip=='alert':
  a=smooth(t/.25)*smooth((duration-t)/.26)
  add('neck',(0,0,.09*a));add('head',(0,.16*a,.08*a));add('jaw',(0,0,-.04*a));add('tail01',(0,.08*a,0))
 elif clip=='sniff':
  a=fade(t,duration)
  add('neck',(0,0,-.08*a));add('head',(0,.15*sn*a,-.06*a+.04*math.sin(2*phase)*a));add('jaw',(0,0,-.055*abs(sn)*a));sway_tail(.025*a)
 elif clip=='bite':
  prep=pulse(u,.26,.12);hit=pulse(u,.54,.12);rec=pulse(u,.71,.10)
  add('neck',(0,0,.09*prep-.24*hit+.09*rec));add('head',(0,0,.09*prep-.23*hit));add('jaw',(0,0,-.37*prep-.23*hit));add('spine',(0,0,-.07*hit));root[0]=.10*hit
 elif clip=='tail_sweep':
  a=pulse(u,.52,.20)
  add('pelvis',(0,.15*a,0));add('spine',(0,-.12*a,0));add('head',(0,-.08*a,0))
  for i,n in enumerate(('tail01','tail02','tail03','tail04')):
   add(n,(0,(-.21-.12*i)*pulse(u,.43+.07*i,.24),.02*a))
  for side in ('L','R'):
   add('hind'+side+'_upper',(0,0,.13*a))
 elif clip=='threaten':
  a=smooth(t/.35)*smooth((duration-t)/.35)
  root[1]=.035*a;add('neck',(0,0,.10*a));add('head',(0,.06*sn*a,.12*a));add('jaw',(0,0,-.30*a))
  add('chest',(0,0,.09*a));add('spine',(0,0,.07*a));sway_tail(.12*a)
 elif clip=='feed':
  a=smooth(t/.3)*smooth((duration-t)/.3)
  add('neck',(0,0,-.21*a));add('head',(0,0,-.16*a+.04*math.sin(3*phase)*a));add('jaw',(0,0,-.21*abs(math.sin(3*phase))*a));sway_tail(.025*a)
 elif clip=='drink':
  a=smooth(t/.45)*smooth((duration-t)/.4)
  add('neck',(0,0,-.25*a));add('head',(0,0,-.22*a+.045*math.sin(4*phase)*a));add('jaw',(0,0,-.035*a))
 elif clip=='rest':
  a=smooth(t/.65)
  root[1]=-.23*a
  add('pelvis',(0,0,-.045*a));add('neck',(0,0,-.13*a));add('head',(0,0,-.13*a));
  for k in ('foreL','foreR','hindL','hindR'):
   add(k+'_upper',(0,0,.22*a));add(k+'_elbow',(0,0,-.48*a));add(k+'_wrist',(0,0,.20*a))
 elif clip=='hurt':
  a=pulse(u,.36,.16)
  add('pelvis',(0,.05*a,-.12*a));add('spine',(0,0,.15*a));add('head',(0,.08*a,.10*a));add('jaw',(0,0,-.15*a))
  add('foreR_upper',(0,0,-.20*a));root[1]=.05*a
 elif clip=='death':
  a=smooth(t/(duration*.83));root[1]=-.42*a
  add('root',(.30*a,0,-.10*a));add('pelvis',(0,0,-.20*a));add('spine',(0,0,-.23*a));add('chest',(0,0,-.20*a))
  add('neck',(0,0,-.34*a));add('head',(0,0,-.21*a));add('jaw',(0,0,-.14*a))
  for limb in ('fore','hind'):
   for side in ('L','R'):
    k=limb+side;add(k+'_upper',(0,0,.36*a));add(k+'_elbow',(0,0,-.43*a));add(k+'_wrist',(0,0,.18*a))
  for k in ('tail01','tail02','tail03','tail04'):add(k,(0,0,.09*a))
 else:raise RuntimeError(clip)
 return d,root

def main():
 v,faces,uv,tex,static=load_v01()
 normals,joints,weights=model_geometry(v,faces,uv,static)
 buf=GLB()
 attrs={'POSITION':buf.attr(v.astype('<f4'),kind='VEC3',minmax=True,target=34962),
  'NORMAL':buf.attr(normals.astype('<f4'),kind='VEC3',target=34962),
  'TEXCOORD_0':buf.attr(uv.astype('<f4'),kind='VEC2',target=34962),
  'JOINTS_0':buf.attr(joints,component=5121,kind='VEC4',target=34962),
  'WEIGHTS_0':buf.attr(weights.astype('<f4'),kind='VEC4',target=34962)}
 ind=buf.attr(faces.reshape(-1).astype('<u2'),component=5123,kind='SCALAR',target=34963)
 image_view=buf.put(tex)
 nodes=[{'name':'Gravarto_v02_TexturedSkin','mesh':0,'skin':0}]
 for name,parent,world in PIVOTS:
  local=POS[name] if parent is None else POS[name]-POS[parent]
  nodes.append({'name':name,'translation':np.round(local,9).tolist(),'rotation':[0,0,0,1]})
 for name,parent,world in PIVOTS:
  if parent:nodes[1+ID[parent]].setdefault('children',[]).append(1+ID[name])
 ibm=np.array([np.eye(4,dtype='<f4') for _ in BONES]);
 for i,name in enumerate(BONES):ibm[i,:3,3]=-POS[name]
 ibm_acc=buf.attr(ibm.transpose(0,2,1).reshape(-1,16),kind='MAT4')
 anim=[];stats=[]
 for clip,(duration,loop) in CLIPS.items():
  nsamples=max(24,int(round(duration*24))+1)
  times=np.linspace(0,duration,nsamples,dtype='<f4')
  timeidx=buf.attr(times,kind='SCALAR',minmax=True)
  ch=[];sam=[];magnitude=0
  for name in BONES:
   angles=np.array([motion(clip,float(t),duration)[0].get(name,(0,0,0)) for t in times],dtype=float)
   if not np.any(np.abs(angles)>1e-6):continue
   m=float(np.max(np.abs(angles)));magnitude=max(magnitude,m)
   quats=np.array([quat(*a) for a in angles],dtype='<f4')
   j=buf.attr(quats,kind='VEC4')
   sam.append({'input':timeidx,'output':j,'interpolation':'LINEAR'})
   ch.append({'sampler':len(sam)-1,'target':{'node':1+ID[name],'path':'rotation'}})
  translations=np.array([POS['root']+motion(clip,float(t),duration)[1] for t in times],dtype='<f4')
  if np.max(np.abs(translations-translations[0]))>1e-6:
   j=buf.attr(translations,kind='VEC3')
   sam.append({'input':timeidx,'output':j,'interpolation':'LINEAR'})
   ch.append({'sampler':len(sam)-1,'target':{'node':1+ID['root'],'path':'translation'}})
  assert len(ch)>0
  anim.append({'name':clip,'channels':ch,'samplers':sam,
               'extras':{'loop':loop,'durationSeconds':duration,'sampleFPS':24,'rootMotion':'in_place'}})
  stats.append({'name':clip,'duration_sec':duration,'loop':loop,'channels':len(ch),'samples':nsamples,
                'max_angle_rad':round(magnitude,4)})
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Gravarto v02 painted-UV weighted rig'},
       'scene':0,'scenes':[{'nodes':[0,1]}], 'nodes':nodes,
       'meshes':[{'name':'Gravarto_v01_anatomical_mesh_preserved','primitives':[{ 'attributes':attrs,'indices':ind,'material':0,'mode':4}]}],
       'skins':[{'name':'Gravarto_Monitor_Lizard_Weighted_Skin','joints':list(range(1,len(BONES)+1)),
                 'skeleton':1+ID['root'],'inverseBindMatrices':ibm_acc}],
       'images':[{'name':'Gravarto_UV_Painted_v01_preserved','bufferView':image_view,'mimeType':'image/png'}],
       'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
       'textures':[{'sampler':0,'source':0}],
       'materials':[{'name':'Gravarto_v02_Original_Painted_Albedo','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'baseColorFactor':[1,1,1,1], 'roughnessFactor':.96,'metallicFactor':0},'doubleSided':True}],
       'animations':anim,
       'extras':{'species':'gravarto','version':'v02','habitats':['savanna'], 'source':'Gravarto v01 preserved, no color geometry','units':'m','axis':'X-forward,Y-up,Z-lateral','integratedInGame':False,'rigMethod':'weighted glTF skin; no terrain IK'}}
 sz,sha=buf.export(OUT,gltf)
 manifest={'id':'gravarto','version':'v02','phase':'animated_skinned_texture_preserved','base':{'path':'../v01/gravarto-v01-anatomy-blockout.glb','sha256':static['glb']['sha256']},
           'version_previous_preserved':True, 'geometry':{'triangles':len(faces),'vertex_instances':len(v),'meshes':1,'materials':1,'texture_uv':[2048,2048], 'skin_count':1,'joint_count':len(BONES),'bone_names':BONES,'clip_count':len(CLIPS)},
           'paint':{'albedo_original_embedded':True,'painted_stripes_no_extra_color_geometry':True,'texture_type':'painted UV albedo PNG'},
           'file':OUT.name,'bytes':sz,'sha256':sha,
           'clips':stats,'rig':'glTF inverse-bind matrices with JOINTS_0+WEIGHTS_0, segmented weighted bending, in-place',
           'limitations':['no runtime terrain foot IK','in-place foot glide possible','no collisions/physics','not gameplay-integrated','visual motion remains under artistic review'],
           'approval':{'concept':'approved','v01_form':'user_requested_animations','v02_animation':'pending_artistic_review'},
           'publication':'locally_exported_not_yet_published','preview':'pending import and render validation','axis':'X-forward,Y-up,Z-lateral'}
 (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
 print('GRAVARTO V02',sz,'bytes',len(faces),'triangles',len(BONES),'real skin joints',len(CLIPS),'animations',sha)
if __name__=='__main__':main()
