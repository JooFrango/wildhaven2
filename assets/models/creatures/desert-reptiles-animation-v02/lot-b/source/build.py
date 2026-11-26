#!/usr/bin/env python3
"""Wildhaven desert reptiles v02: weighted skinning on the REAL UV-painted v01 GLB.

No geometry redesign or repainted color faces. All original triangles & painted atlas
preserved. Original v01 remains immutable; glTF 2.0 weighted skins + procedural
keyframe clips are exported as NEW v02 files. Axis: +X forward, +Y up, +/-Z side.
All animations are in-place; not physics, terrain IK, gameplay, or AI.
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, os, struct
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation
import trimesh

ROOT=Path(os.getenv('WILDHAVEN_CREATURE_ROOT', str(Path(__file__).resolve().parents[2]/'desert_reptiles_v01')))
OUTROOT=Path(os.getenv('WILDHAVEN_V02_ROOT',str(Path(__file__).resolve().parents[1])))
SPECS={
 'caudraco':dict(name='Caudraco',y=.183,hipx=-.110,backx=-.130,frontx=.170,headx=.375,neckx=.255,span=.135,tail=[-.20,-.345,-.490],length=.95,special=['tail_sweep','burrow_block']),
 'lajurim':dict(name='Lajurim',y=.091,hipx=-.090,backx=-.120,frontx=.180,headx=.340,neckx=.255,span=.193,tail=[-.17,-.225,-.285],length=.70,special=['wedge_brace','flatten']),
 'cornevio':dict(name='Cornévio',y=.123,hipx=-.070,backx=-.100,frontx=.135,headx=.278,neckx=.210,span=.140,tail=[-.13,-.166,-.196],length=.55,special=['inflate','horn_threat']),
 'fossario':dict(name='Fossário',y=.114,hipx=-.110,backx=-.120,frontx=.165,headx=.353,neckx=.250,span=.096,tail=[-.20,-.35,-.485],length=.80,special=['dig','tail_decoy'])}
COMMON={
 'idle':(3.0,True), 'walk':(1.65,True), 'trot':(1.12,True), 'flee':(.74,True),
 'turn_left':(1.3,False),'turn_right':(1.3,False),'alert':(1.45,False),
 'sniff':(2.3,True),'forage':(3.0,True),'feed':(2.6,True),'drink':(2.7,True),
 'rest':(2.2,False),'hurt':(.95,False),'death':(2.4,False)}
SPECIFIC={
 'tail_sweep':(1.25,False),'burrow_block':(1.7,False),
 'wedge_brace':(1.5,False),'flatten':(1.7,False),
 'inflate':(2.2,False),'horn_threat':(1.9,False),
 'dig':(1.45,True),'tail_decoy':(1.8,True)}

def smooth(t): t=float(np.clip(t,0,1));return t*t*(3-2*t)
def puff(t,center=.5,width=.17):return math.exp(-((t-center)/width)**2)
def quat(ang):return Rotation.from_euler('xyz',ang).as_quat().astype('<f4')

class GLB:
 def __init__(self):self.b=bytearray();self.views=[];self.accs=[]
 def put(self,data,target=None):
  raw=data if isinstance(data,bytes) else np.ascontiguousarray(data).tobytes()
  a=len(self.b);self.b.extend(raw);self.b.extend(b'\0'*(-len(raw)%4))
  ent={'buffer':0,'byteOffset':a,'byteLength':len(raw)}
  if target:ent['target']=target
  self.views.append(ent);return len(self.views)-1
 def attr(self,array,ctype=5126,kind=None,extents=False,target=None):
  arr=np.ascontiguousarray(array);n=1 if arr.ndim==1 else int(np.prod(arr.shape[1:]));kind=kind or {1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[n]
  a={'bufferView':self.put(arr,target),'componentType':ctype,'count':len(arr),'type':kind}
  if extents:
   a['min']=np.min(arr,axis=0).reshape(-1).astype(float).tolist() if arr.ndim>1 else [float(arr.min())]
   a['max']=np.max(arr,axis=0).reshape(-1).astype(float).tolist() if arr.ndim>1 else [float(arr.max())]
  self.accs.append(a);return len(self.accs)-1
 def export(self,path,data):
  data['buffers']=[{'byteLength':len(self.b)}];data['bufferViews']=self.views;data['accessors']=self.accs
  j=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*(-len(j)%4)
  b=bytes(self.b);b+=b'\0'*(-len(b)%4)
  blob=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(b))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(blob)
  return len(blob),hashlib.sha256(blob).hexdigest()

def pivots(s):
 h=s['y'];tail=s['tail'];span=s['span']
 p=[('root',None,(0,0,0)),('pelvis','root',(s['hipx'],h,0)),('spine','pelvis',(.015,h+.005,0)),('chest','spine',(s['frontx']-.03,h,0)),('neck','chest',(s['neckx'],h*.98,0)),('head','neck',(s['headx'],h*.93,0)),('jaw','head',(s['headx']+.025,h*.70,0)),
    ('tail1','pelvis',(tail[0],h*.86,0)),('tail2','tail1',(tail[1],h*.72,0)),('tail3','tail2',(tail[2],h*.61,0))]
 for limb in ('fore','hind'):
  x=s['frontx'] if limb=='fore' else s['backx']
  for side in ('R','L'):
   sign=-1 if side=='R' else 1;k=limb+side;base='chest' if limb=='fore' else 'pelvis'
   p.extend([(k+'_upper',base,(x,h*.95,sign*span*.78)),
      (k+'_elbow',k+'_upper',(x+.014,.075,sign*span*1.22)),
      (k+'_wrist',k+'_elbow',(x+.023,.045,sign*span*1.37)),
      (k+'_paw',k+'_wrist',(x+.065,.020,sign*span*1.48))])
 assert len(p)==26
 return p

def bone_weights(spec,part,p,bones,pos):
 x,y,z=map(float,p);s=SPECS[spec]
 def choose(a):return [(a,1.)]
 def mix(anchors,value):
  if value<=anchors[0][0]:return choose(anchors[0][1])
  if value>=anchors[-1][0]:return choose(anchors[-1][1])
  for (a,na),(b,nb) in zip(anchors[:-1],anchors[1:]):
   if a<=value<=b:
    t=smooth((value-a)/(b-a));return [(na,1-t),(nb,t)] if na!=nb else choose(na)
  return choose(anchors[-1][1])
 tail=s['tail']
 def tail_weight():return mix([(tail[2],'tail3'),(tail[1],'tail2'),(tail[0],'tail1'),(s['hipx'],'pelvis')],x)
 if part in ('barrel_trunk','extremely_flat_slab_body','short_rhombus_trunk','streamlined_skink_torso'):
  return mix([(s['hipx']-.12,'pelvis'),(s['hipx']+.04,'spine'),(s['frontx']-.045,'chest')],x)
 if part in ('neck_transition','broad_slab_neck','neck','elongated_neck'):
  return mix([(s['frontx']-.015,'chest'),(s['neckx'],'neck'),(s['headx']-.038,'head')],x)
 if part=='actual_lower_jaw':return choose('jaw')
 if part in ('faceted_skull','nasal_sand_shovel_crest') or part.startswith(('recessed_eye_','nostril_','brow_hook_','backward_brow_horn_','rigid_cheek_flange_')):return choose('head')
 if part in ('heavy_spined_tail','short_flat_tail','compact_tail','flexible_attention_tail') or part.startswith('tail_defensive_ring_'):
  return tail_weight()
 if part.startswith('flank_wedged_brace_') or part.startswith('lateral_rib_keel_'):
  return mix([(s['hipx']-.1,'pelvis'),(.0,'spine'),(s['frontx'],'chest')],x)
 if part.startswith(('front_leg_','back_leg_')):
  front=part.startswith('front');side='R' if part.endswith('-1') else 'L';k=('fore' if front else 'hind')+side
  h=s['y']
  return mix([(.008,k+'_paw'),(.045,k+'_wrist'),(.070,k+'_elbow'),(h*.92,k+'_upper')],y)
 if part.startswith(('foot_','toe_digit_','toe_claw_','sand_scrape_digging_claw_')):
  if part.startswith('sand_scrape_digging_claw_'):
   side='R' if part.split('_')[4]=='-1' else 'L';return choose('fore'+side+'_paw')
  fields=part.split('_');front=float(fields[-2] if part.startswith('foot_') else fields[-3])>0
  side='R' if (fields[-1] if part.startswith('foot_') else fields[-2])=='-1' else 'L'
  return choose(('fore' if front else 'hind')+side+'_paw')
 raise RuntimeError(f'Unhandled part: {part}')

def motion(spec,clip,t,d):
 s=SPECS[spec];u=t/d;ph=2*math.pi*u;sn=math.sin(ph);cs=math.cos(ph)
 a={};rt=np.array([0.,0.,0.]);sc={}
 def add(n,x=0,y=0,z=0):a[n]=[x,y,z]
 def tail(amp,phase=ph):
  for j,n in enumerate(('tail1','tail2','tail3')):add(n,0,amp*(1+j*.27)*math.sin(phase-j*.37),.012*sn)
 def lower(amp=.22):add('neck',0,0,-amp*.64);add('head',0,0,-amp*.48)
 if clip in ('idle','walk','trot','flee'):
  if clip=='idle':
   rt[1]=.0022*sn;add('spine',0,.016*sn,.008*sn);add('head',0,.021*sn,.01*sn);tail(.055)
  else:
   strength={'walk':.22,'trot':.31,'flee':.42}[clip]
   rt[1]=(.003 if clip=='walk' else .009)*(1-math.cos(2*ph))*.5
   add('pelvis',0,.024*sn,0);add('spine',0,-.03*sn,.015*cs);add('chest',0,.016*sn,-.018*cs)
   add('head',0,-.012*sn,.011*cs);tail(.07 if clip=='walk' else .14)
   for limb in ('fore','hind'):
    for side in ('R','L'):
     shift=math.pi if ((limb=='fore')==(side=='R')) else 0
     v=math.sin(ph+shift);swing=max(0,v);k=limb+side
     add(k+'_upper',0,0,strength*v)
     add(k+'_elbow',0,0,-.26*strength*v-.19*swing)
     add(k+'_wrist',0,0,.16*strength*v+.12*swing)
     add(k+'_paw',0,0,-.11*strength*v)
 elif clip in ('turn_left','turn_right'):
  sign=1 if clip=='turn_left' else -1;b=smooth(t/.28)*smooth((d-t)/.25)
  for n,am in [('pelvis',.13),('spine',.17),('chest',.17),('neck',.18),('head',.15)]:add(n,0,sign*am*b,0)
  for n,am in [('tail1',-.12),('tail2',-.15),('tail3',-.17)]:add(n,0,sign*am*b,0)
  add('foreL_upper',0,0,sign*.12*b);add('foreR_upper',0,0,-sign*.12*b)
 elif clip in ('alert','sniff'):
  b=smooth(t/.28)*smooth((d-t)/.25) if clip=='alert' else .5+.5*sn
  add('head',0,.12*b,.05*b);add('neck',0,0,.08*b);tail(.024)
 elif clip in ('forage','feed','drink'):
  b=smooth(t/.3)*smooth((d-t)/.25)
  lower({'forage':.25,'feed':.31,'drink':.39}[clip]*b)
  add('head',0,.025*math.sin(ph*2)*b,-.14*b+.04*math.sin(2*ph)*b)
  add('jaw',0,0,-.07*abs(math.sin(ph*3))*b)
  if clip=='forage':
   for side in ('L','R'):add('fore'+side+'_upper',0,0,.04*sn)
  tail(.025)
 elif clip=='rest':
  b=smooth(t/.7);rt[1]=-.025*b;lower(.16*b)
  for k in ('foreL','foreR','hindL','hindR'):
   add(k+'_upper',0,0,.14*b);add(k+'_elbow',0,0,-.19*b);add(k+'_wrist',0,0,.13*b)
 elif clip=='hurt':
  b=puff(u,.30,.13);add('pelvis',0,.07*b,-.08*b);add('head',0,-.09*b,.12*b);rt[1]=.014*b
 elif clip=='death':
  b=smooth(t/(d*.85));rt[1]=-.066*b
  add('root',.30*b,0,-.16*b);add('spine',0,0,-.24*b);add('head',0,0,-.32*b)
  for k in ('foreL','foreR','hindL','hindR'):add(k+'_upper',0,0,.26*b);add(k+'_elbow',0,0,-.24*b)
  tail(.09)
 elif clip=='tail_sweep':
  b=puff(u,.53,.19);add('pelvis',0,.10*b,.014*b);add('spine',0,-.07*b,0)
  for j,n in enumerate(('tail1','tail2','tail3')):add(n,0,(-.33-j*.22)*puff(u,.40+j*.08,.21),.07*b)
  for k in ('hindL','hindR'):add(k+'_upper',0,0,.10*b)
 elif clip=='burrow_block':
  b=smooth(t/.36)*smooth((d-t)/.27);rt[1]=-.009*b
  add('pelvis',0,.19*b,0);add('tail1',0,-.30*b,.08*b);add('tail2',0,-.23*b,.10*b);add('tail3',0,-.21*b,.07*b)
 elif clip=='wedge_brace':
  b=smooth(t/.32)*smooth((d-t)/.32);rt[1]=-.016*b
  add('spine',0,0,-.07*b);add('head',0,0,-.06*b)
  # Actual body tension without an invented separate shell or extra polygons.
  sc['spine']=[1.,1.-.07*b,1.+.055*b];sc['chest']=[1.,1.-.06*b,1.+.045*b]
  for k in ('foreL','foreR','hindL','hindR'):add(k+'_upper',.08*b,0,-.12*b)
 elif clip=='flatten':
  b=smooth(t/.45)*smooth((d-t)/.35);rt[1]=-.017*b
  sc['spine']=[1.,1.-.11*b,1.+.085*b];sc['chest']=[1.,1.-.085*b,1.+.065*b]
  add('neck',0,0,-.11*b)
 elif clip=='inflate':
  b=smooth(t/.32)*smooth((d-t)/.40);rt[1]=.005*b
  sc['spine']=[1.02,1.+.075*b,1.+.16*b];sc['chest']=[1.,1.+.07*b,1.+.13*b]
  add('head',0,0,.14*b);add('neck',0,0,.10*b)
 elif clip=='horn_threat':
  b=puff(u,.55,.25);add('head',0,.10*b,.23*b);add('neck',0,0,.14*b);add('spine',0,0,.07*b)
  sc['chest']=[1.,1.+.045*b,1.+.11*b];rt[1]=.013*b
 elif clip=='dig':
  b=.5+.5*sn;lower(.15);rt[1]=-.009+ .004*math.sin(2*ph)
  for side,off in (('L',0.),('R',math.pi)):
   val=math.sin(ph*2+off)
   add('fore'+side+'_upper',0,0,.31*val)
   add('fore'+side+'_elbow',0,0,-.29*val-.10)
   add('fore'+side+'_wrist',0,0,.24*val)
   add('fore'+side+'_paw',0,0,-.19*val)
  tail(.055)
 elif clip=='tail_decoy':
  b=smooth(t/.35)*smooth((d-t)/.35)
  for j,n in enumerate(('tail1','tail2','tail3')):add(n,0,.23*b*math.sin(2.5*ph-.6*j)*(1+j*.48),.05*b)
  add('head',0,-.13*b,0)
 else:raise ValueError(clip)
 return a,rt,sc

def build(spec):
 s=SPECS[spec];srcdir=ROOT/spec;src=srcdir/f'{spec}-v01-textured-blockout.glb'
 assert src.is_file(),src
 old=json.loads((srcdir/'manifest.json').read_text());blob=src.read_bytes()
 assert hashlib.sha256(blob).hexdigest()==old['sha256'], 'v01 GLB changed'
 scene=trimesh.load(src,force='scene',process=False);mesh=next(iter(scene.geometry.values()))
 pos=np.asarray(mesh.vertices,dtype='<f4');uv=np.asarray(mesh.visual.uv,dtype='<f4');face=np.asarray(mesh.faces,dtype='<u2');assert len(face)==old['triangle_count']
 assert len(pos)==len(uv)
 # Unshare every triangle vertex to preserve intentionally flat anatomical planes.
 v=pos[face.reshape(-1)];texuv=uv[face.reshape(-1)];f=np.arange(len(v),dtype='<u2').reshape(-1,3)
 n=np.cross(v[1::3]-v[0::3],v[2::3]-v[0::3]);n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
 normals=np.repeat(n,3,axis=0).astype('<f4')
 source_img=mesh.visual.material.baseColorTexture.convert('RGBA')
 img=Image.open(srcdir/'texture'/f'{spec}-v01-painted-albedo.png').convert('RGBA')
 assert source_img.size==img.size==(2048,2048) and np.array_equal(np.asarray(source_img),np.asarray(img))
 png=io.BytesIO();img.save(png,format='PNG',optimize=True)
 p=pivots(s);bnames=[x[0] for x in p];bid={v:i for i,v in enumerate(bnames)};parent={n:pa for n,pa,_ in p};point={n:np.array(pt,dtype=float) for n,pa,pt in p}
 joint=np.zeros((len(v),4),dtype='u1');weight=np.zeros((len(v),4),dtype='<f4')
 cursor=0
 for part in old['components']:
  count=part['triangles']*3;name=part['name']
  for i in range(cursor,cursor+count):
   pairs=bone_weights(spec,name,v[i],bnames,point)
   for k,(bone,w) in enumerate(pairs):joint[i,k]=bid[bone];weight[i,k]=w
  cursor+=count
 assert cursor==len(v),(cursor,len(v));assert np.max(abs(weight.sum(axis=1)-1))<1e-6
 buf=GLB()
 attrs={'POSITION':buf.attr(v,target=34962,extents=True),'NORMAL':buf.attr(normals,target=34962), 'TEXCOORD_0':buf.attr(texuv,target=34962),
 'JOINTS_0':buf.attr(joint,ctype=5121,target=34962),'WEIGHTS_0':buf.attr(weight,target=34962)}
 ind=buf.attr(f.reshape(-1),ctype=5123,target=34963)
 img_view=buf.put(png.getvalue())
 nodes=[{'name':spec.upper()+'_V02_Textured_WeightedMesh','mesh':0,'skin':0}]
 for name,pa,wpt in p:
  local=point[name] if pa is None else point[name]-point[pa]
  nodes.append({'name':name,'translation':np.round(local,9).tolist(),'rotation':[0,0,0,1]})
 for name,pa,wpt in p:
  if pa is not None:nodes[1+bid[pa]].setdefault('children',[]).append(1+bid[name])
 ibm=np.stack([np.eye(4,dtype='<f4') for _ in p])
 for i,name in enumerate(bnames):ibm[i,:3,3]=-point[name]
 ibm_idx=buf.attr(ibm.transpose(0,2,1).reshape(-1,16),kind='MAT4')
 clips={**COMMON,**{k:SPECIFIC[k] for k in s['special']}}
 allanim=[];stats=[]
 for clip,(d,loop) in clips.items():
  count=max(25,int(round(d*24))+1);times=np.linspace(0,d,count,dtype='<f4');ti=buf.attr(times,extents=True)
  mcache=[motion(spec,clip,float(t),d) for t in times]
  sams=[];chs=[];maxangle=0
  for name in bnames:
   angles=np.array([state[0].get(name,[0,0,0]) for state in mcache])
   if np.max(abs(angles))>1e-7:
    maxangle=max(maxangle,float(np.max(abs(angles))));out=buf.attr(np.array([quat(x) for x in angles]))
    sams.append({'input':ti,'output':out,'interpolation':'LINEAR'});chs.append({'sampler':len(sams)-1,'target':{'node':1+bid[name],'path':'rotation'}})
   if name in ('spine','chest'):
    scales=np.array([state[2].get(name,[1,1,1]) for state in mcache],dtype='<f4')
    if np.max(abs(scales-1))>1e-7:
     out=buf.attr(scales);sams.append({'input':ti,'output':out,'interpolation':'LINEAR'});chs.append({'sampler':len(sams)-1,'target':{'node':1+bid[name],'path':'scale'}})
  translation=np.array([state[1] for state in mcache],dtype='<f4')
  if np.max(abs(translation))>1e-7:
   out=buf.attr(translation);sams.append({'input':ti,'output':out,'interpolation':'LINEAR'});chs.append({'sampler':len(sams)-1,'target':{'node':1+bid['root'],'path':'translation'}})
  assert chs,(spec,clip)
  allanim.append({'name':clip,'samplers':sams,'channels':chs,'extras':{'loop':loop,'durationSeconds':d,'rootMotion':'in_place'}})
  stats.append({'name':clip,'duration_seconds':d,'loop':loop,'channels':len(chs),'max_angle_rad':round(maxangle,4),'samples':count})
 model={'asset':{'version':'2.0','generator':'Wildhaven 4 desert herbivores v02, original painted UV, real weighted skin'},'scene':0,'scenes':[{'nodes':[0,1]}], 'nodes':nodes,
 'meshes':[{'name':spec+'_original_faceted_v01_geometry','primitives':[{'attributes':attrs,'indices':ind,'material':0,'mode':4}]}],
 'skins':[{'name':spec+'_weighted_skin','joints':list(range(1,len(bnames)+1)),'skeleton':1+bid['root'],'inverseBindMatrices':ibm_idx}],
 'images':[{'name':spec+'_original_v01_painted_atlas','bufferView':img_view,'mimeType':'image/png'}],
 'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
 'textures':[{'sampler':0,'source':0}],
 'materials':[{'name':spec+'_original_painted_uv_v01','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'baseColorFactor':[1,1,1,1],'roughnessFactor':.95,'metallicFactor':0},'doubleSided':True}],
 'animations':allanim,
 'extras':{'species':spec,'version':'v02','habitat':old['habitat'],'diet':'herbivore','source':'original v01 GLB original UV atlas','units':'m','axis':'X-forward,Y-up,Z-lateral','integratedInGame':False}}
 outdir=OUTROOT/spec/'v02';outdir.mkdir(parents=True,exist_ok=True)
 dst=outdir/f'{spec}-v02-animated-LOD0.glb';size,sha=buf.export(dst,model)
 manifest={'species_id':spec,'name':old['name'],'version':'v02','stage':'skinned_animated_for_artistic_review','previous_static_glb_preserved':True,
   'v01_base':{'relative_path':f'../v01/{src.name}','bytes':len(blob),'sha256':old['sha256']},
   'glb':{'path':dst.name,'bytes':size,'sha256':sha,'triangles':len(f),'triangle_count_method':'mesh primitive triangles indexed after reimport','vertices':len(v),
   'uv_texture_px':[2048,2048],'materials':1,'skins':1,'joints':len(bnames),'bone_names':bnames,'animation_count':len(clips)},
   'texture':{'source_v01_embedded_identical':True,'painted_markings_not_polygons':True},
   'clips':stats,'defense_specials':s['special'],'rig':'weighted glTF skin with JOINTS_0, WEIGHTS_0 and inverse-bind-matrices',
   'limitations':['in-place, possible foot sliding','no physics/IK ground adjustment','no terrain interaction, IA or gameplay','visual approval pending','LOD0 only in this stage'],
   'approval':{'concepts':'user approved 4 designs','v01_form':'user requested animations','animations_v02':'awaiting artistic review'},
   'publication':'local_only_pending_gitHub_ci','integrated_game':False,'previews':{}}
 (outdir/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
 print('EXPORTED',spec,len(f),'tris',len(v),'verts',len(bnames),'joints',len(clips),'clips',size,'bytes SHA256',sha,flush=True)
 return manifest

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--species',nargs='+',choices=list(SPECS),default=list(SPECS));args=ap.parse_args()
 for spec in args.species:build(spec)
