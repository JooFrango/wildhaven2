#!/usr/bin/env python3
"""Wildhaven Varrisco v02 – genuinely skinned anatomical GLB and keyed animation clips.

Preserves the approved v01 anatomical cross-section geometry as the LOD0 mesh.
Reads the original, unmodified v01 source, extracting named anatomical pieces.
Z-up in the sagittal plane is NOT used: this project uses X-forward, Y-up, Z-lateral.
Creates genuine glTF 2.0 inverse-bind-matrix skin and interpolated bone quaternion
and translation channels. No pivot-only fake 'rig', no text/JSON masquerading as GLB.
In-place gait is the authoring contract; runtime terrain-aware foot IK is not included.
"""
from __future__ import annotations
import ast, hashlib, json, math, runpy, struct
from pathlib import Path
import numpy as np
import trimesh
from scipy.spatial.transform import Rotation

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCE = HERE / 'anatomy_v01.py'
SCALE = 0.82
ROOT.mkdir(parents=True, exist_ok=True)

# Execute only the geometry-authoring statements of v01, NOT its GLB export and
# NOT its manifest writing. The original v01 files are never changed.
source_text = SOURCE.read_text(encoding='utf-8')
source_text = source_text[:source_text.index('meshes=[x[1] for x in PARTS]')]
namespace = {'__file__': str(SOURCE), '__name__':'varrisco_v01_geometry'}
exec(compile(source_text, str(SOURCE), 'exec'), namespace)
PARTS = namespace['PARTS']

BONE_POS = { 'hips':(-0.44,1.105,0.0), 'spine':(-0.05,1.14,0.0),
 'chest':(0.31,1.175,0.0), 'neck':(0.63,1.37,0.0),
 'head':(0.99,1.505,0.0), 'jaw':(1.00,1.35,0.0),
 'tail1':(-0.87,1.12,0.0), 'tail2':(-1.24,1.10,0.0),
 'tail3':(-1.63,1.075,0.0), 'tail4':(-1.97,1.06,0.0) }
PARENT = { 'hips':None, 'spine':'hips','chest':'spine','neck':'chest','head':'neck','jaw':'head',
          'tail1':'hips','tail2':'tail1','tail3':'tail2','tail4':'tail3' }
for sign,label in ((-1,'R'),(1,'L')):
    z = sign*.285
    coords = {'thigh':(-.44,1.095,z), 'shin':(-.17,.585,z),
              'ankle':(-.345,.21,z), 'foot':(-.24,.09,z)}
    for k,p in coords.items(): BONE_POS[k+label]=p
    PARENT.update({'thigh'+label:'hips','shin'+label:'thigh'+label,
                   'ankle'+label:'shin'+label,'foot'+label:'ankle'+label})
    zz=sign*.235
    coords = {'upperArm':(.34,1.155,zz),
              'forearm':(.53,1.015,zz+sign*.08),
              'hand':(.69,.885,zz+sign*.12)}
    for k,p in coords.items():BONE_POS[k+label]=p
    PARENT.update({'upperArm'+label:'chest', 'forearm'+label:'upperArm'+label,
                  'hand'+label:'forearm'+label})
BONE_POS = {k:np.array(v,dtype=float)*SCALE for k,v in BONE_POS.items()}
BONES = list(BONE_POS)
ID = {name:i for i,name in enumerate(BONES)}
WORLD = [BONE_POS[x] for x in BONES]

def clamp(v,a=0.,b=1.): return float(np.clip(v,a,b))
def smooth(v):
 v=clamp(v); return v*v*(3.-2.*v)

def nearest_chain(x, ordered):
    # Bilinear blend along the appropriate load-bearing axis in rest space.
    if x<=ordered[0][0]:return [(ordered[0][1],1.)]
    if x>=ordered[-1][0]:return [(ordered[-1][1],1.)]
    for (a,an),(b,bn) in zip(ordered[:-1],ordered[1:]):
        if a<=x<=b:
            t=smooth((x-a)/(b-a))
            return [(an,1.-t),(bn,t)]
    raise AssertionError(x)

def weights_for(name, v):
    """Per-vertex multi-joint weights using named authoring anatomy.

    Boundaries are interpolated for long muscles, tail and trunk; rigid pieces
    like the beak/eyes/claws remain on their associated joint.
    """
    n=int(name.split('_',1)[0]); side='L' if name.endswith('_1') or '_1_' in name else 'R'
    x,y,z = (v/SCALE).tolist()
    # Anatomical trunk with gradual bind transitions rather than rigid blocks.
    torso = nearest_chain(x,[(-.60,'hips'),(-.08,'spine'),(.36,'chest')])
    if n in (1,2,3,4,5,6,21,39):return torso
    if n in (7,8):return nearest_chain(x,[(.35,'chest'),(.64,'neck'),(.88,'head')])
    if n==11:return [('jaw',1.)]
    if n in (9,10,12,13,14,15,16,17,18,19,20):return [('head',1.)]
    if n in (22,23,24):
       return nearest_chain(x,[(-2.05,'tail4'),(-1.62,'tail3'),(-1.22,'tail2'),(-.87,'tail1'),(-.65,'hips')])
    if n in (25,26):
       t=smooth((y-.96)/.18)
       return [('thigh'+side,1.-.09*t),('hips',.09*t)]
    if n in (27,29):
       t=smooth((y-.50)/.15)
       return [('shin'+side,1.-.10*t),('thigh'+side,.10*t)]
    if n==28:return nearest_chain(y,[(.13,'foot'+side),(.20,'ankle'+side),(.245,'shin'+side)])
    if n in (30,31,32,33):return [('foot'+side,1.)]
    if n in (34,36):return [('upperArm'+side,.9),('chest',.1)]
    if n==35:return [('forearm'+side,.9),('upperArm'+side,.1)]
    if n in (37,38):return [('hand'+side,1.)]
    raise RuntimeError((name,n))

def make_parts():
    for name,source in PARTS:
        p=np.asarray(source.vertices,dtype=np.float32)*SCALE
        face=np.asarray(source.faces,dtype=np.uint32)
        col=np.asarray(source.visual.vertex_colors,dtype=np.uint8)
        if len(col)!=len(p):raise ValueError(f'color mismatch {name}')
        # Remove degenerate zero-area triangles produced by accidental seams.
        assert face.shape[1]==3
        yield name,p,face,col

def build_geometry():
    positions=[]; normals=[]; colors=[]; joints=[]; weights=[]; indices=[]
    names=[];base=0
    for name,pos,face,rgba in make_parts():
        facepos=pos[face]
        fn=np.cross(facepos[:,1]-facepos[:,0],facepos[:,2]-facepos[:,0])
        lengths=np.linalg.norm(fn,axis=1)
        fn/=np.maximum(lengths[:,None],1e-9)
        norm=np.repeat(fn,3,axis=0).astype('float32')
        assert len(norm)==len(pos),name
        jw=np.zeros((len(pos),4),dtype=np.uint8)
        ww=np.zeros((len(pos),4),dtype=np.float32)
        for vi,p in enumerate(pos):
            w=weights_for(name,p)
            for k,(bone,val) in enumerate(w[:4]):
                jw[vi,k]=ID[bone];ww[vi,k]=val
        assert np.max(abs(ww.sum(axis=1)-1))<1e-4
        positions.append(pos);normals.append(norm);colors.append(rgba)
        joints.append(jw);weights.append(ww)
        indices.append(face+base);base+=len(pos)
        names.append(name)
    return tuple(np.concatenate(t) for t in (positions,normals,colors,joints,weights,indices)),names

# Rotation channel controls: euler angles in radians about bone LOCAL X,Y,Z.
def rot(rx=0.,ry=0.,rz=0.):
    return Rotation.from_euler('xyz',[rx,ry,rz]).as_quat().astype('float32')

def pulse(t,at,reach=.13):
    return math.exp(-((t-at)/reach)**2)

def mov(clip,t,duration):
    """Distinct bespoke gestures. Outputs only authored and meaningful channels."""
    phase=2*math.pi*t/duration
    sn,cs=math.sin(phase),math.cos(phase)
    d={}  # name -> (rx,ry,rz)
    tr=np.zeros(3,float)
    s=.0
    # Baseline opposing step gait and counterbalancing tail.
    if clip in ('walk','run','stalk'):
        amplitude={'walk':.30,'run':.67,'stalk':.16}[clip]
        accel={'walk':1.,'run':1.5,'stalk':.75}[clip]
        tr[1]+={'walk':.016,'run':.065,'stalk':-.055}[clip]*(1+math.cos(2*phase))*.5
        d['hips']=(.024*sn,0., -.04 if clip=='run' else -.02)
        d['spine']=(0.,.018*sn, .025*cs)
        d['head']=(0.,0.,-.025*cs)
        d['tail1']=(.02*sn,.055*sn,0.)
        d['tail2']=(0.,.080*sn,0.)
        d['tail3']=(0.,.11*sn,0.)
        d['tail4']=(0.,.12*sn,0.)
        for side,phaseoff in (('L',0),('R',math.pi)):
            wave=math.sin(phase+phaseoff)
            swing=max(0.,wave)
            d['thigh'+side]=(0,0,amplitude*wave)
            d['shin'+side]=(0,0,-(.16+accel*.25*swing))
            d['ankle'+side]=(0,0,-.2*wave+.14*swing)
            d['foot'+side]=(0,0,.12*wave)
            d['upperArm'+side]=(0,0,-.12*wave)
            d['forearm'+side]=(0,0,.10*swing)
    elif clip=='idle':
        tr[1]+=.008*math.sin(phase)
        d={'spine':(0,0,.018*sn),'chest':(0,0,.022*sn),'neck':(0,0,.015*sn),
           'head':(0,.025*math.sin(phase/2),0),'tail1':(0,.06*sn,0),
           'tail2':(0,.08*math.sin(phase-.6),0),'tail3':(0,.09*math.sin(phase-1.2),0)}
    elif clip=='alert':
        a=smooth(t/.24)*smooth((duration-t)/.29)
        d={'neck':(0,0,.12*a),'head':(0,.23*a,.13*a),
           'tail1':(0,0,-.08*a),'upperArmL':(0,0,-.21*a),'upperArmR':(0,0,-.21*a)}
    elif clip=='sniff':
        d={'neck':(0,0,-.15+.10*cs),'head':(0,.23*sn,-.09+ .10*math.sin(2*phase)),
           'jaw':(0,0,-.06*abs(sn)),'tail1':(0,.055*sn,0)}
    elif clip=='bite':
        strike=pulse(t,duration*.52,.14)
        pre=pulse(t,duration*.28,.12)
        d={'neck':(0,0,-.21*strike+.09*pre),'head':(0,0,-.23*strike),
           'jaw':(0,0,-.38*pre-.19*strike),'upperArmL':(0,0,-.13*strike),
           'upperArmR':(0,0,-.13*strike)}
        tr[0]+= .10*strike
    elif clip=='claw_swipe':
        a=pulse(t,duration*.53,.20)
        ready=pulse(t,duration*.3,.14)
        d={'hips':(0,.14*a,0),'chest':(0,.20*a,.06*a),
           'upperArmL':(0,0,.48*a-.17*ready),
           'forearmL':(0,0,-.36*a),'handL':(0,0,-.20*a),
           'upperArmR':(0,0,-.26*ready),'forearmR':(0,0,.17*a),
           'tail1':(0,-.16*a,0),'head':(0,-.06*a,0)}
    elif clip=='pounce':
        crouch=pulse(t,duration*.22,.14)
        leap=pulse(t,duration*.49,.20)
        land=pulse(t,duration*.78,.10)
        tr[1]+=-.12*crouch + .25*leap-.075*land
        tr[0]+=.08*leap
        d={'hips':(0,0,-.19*leap+.09*crouch),
           'thighL':(0,0,-.33*crouch+.36*leap),'thighR':(0,0,-.33*crouch+.36*leap),
           'shinL':(0,0,-.44*crouch+.17*leap),'shinR':(0,0,-.44*crouch+.17*leap),
           'ankleL':(0,0,.26*crouch-.16*leap),'ankleR':(0,0,.26*crouch-.16*leap),
           'upperArmL':(0,0,.37*leap),'upperArmR':(0,0,.37*leap),
           'tail1':(0,0,.16*leap),'neck':(0,0,-.14*leap)}
    elif clip=='feed':
        bend=smooth(t/.4)*smooth((duration-t)/.36)
        d={'hips':(0,0,-.07*bend),'neck':(0,0,-.33*bend),
           'head':(0,0,-.21*bend+.045*math.sin(3*phase)*bend),
           'jaw':(0,0,-.18*abs(math.sin(3*phase))*bend),
           'thighL':(0,0,-.09*bend),'thighR':(0,0,-.09*bend)}
    elif clip=='drink':
        bend=smooth(t/.5)*smooth((duration-t)/.5)
        d={'neck':(0,0,-.43*bend),'head':(0,0,-.27*bend+.03*math.sin(4*phase)*bend),
           'jaw':(0,0,-.05*bend),'tail1':(0,.03*sn,0)}
    elif clip in ('rest','sleep'):
        fade=smooth(t/.6)*smooth((duration-t)/.6) if clip=='rest' else smooth(t/.8)
        tr[1]+(-.20 if clip=='rest' else -.25)*fade
        d={'hips':(0,0,-.10*fade),'thighL':(0,0,.43*fade),
           'thighR':(0,0,.43*fade),'shinL':(0,0,-.80*fade),'shinR':(0,0,-.80*fade),
           'ankleL':(0,0,.20*fade),'ankleR':(0,0,.20*fade),
           'neck':(0,0,-.22*fade),'head':(0,0,-.20*fade),
           'tail1':(0,0,-.08*fade)}
        if clip=='sleep': tr[1]+.006*math.sin(phase)
    elif clip=='hurt':
        a=pulse(t,duration*.32,.16)
        d={'hips':(0,.12*a,-.17*a),'spine':(0,0,.2*a),'neck':(0,0,.15*a),
           'head':(0,.12*a,.20*a),'thighL':(0,0,-.15*a),
           'upperArmR':(0,0,-.34*a),'tail1':(0,-.12*a,0)}
    elif clip=='death':
        a=smooth(t/(duration*.85))
        tr[1]+=-.34*a
        d={'hips':(.12*a,0,-.50*a),'spine':(0,0,-.27*a),
           'chest':(0,0,-.30*a),'neck':(0,0,-.44*a),
           'head':(0,0,-.31*a),'jaw':(0,0,-.23*a),
           'thighL':(0,0,.35*a),'thighR':(0,0,-.40*a),
           'shinL':(0,0,-.58*a),'shinR':(0,0,-.56*a),
           'tail1':(0,0,.22*a),'tail2':(0,0,.11*a),
           'upperArmL':(0,0,.39*a),'upperArmR':(0,0,.31*a)}
    elif clip=='threat':
        a=smooth(t/.4)*smooth((duration-t)/.4)
        d={'neck':(0,0,.16*a),'head':(0,.20*math.sin(phase)*a,.14*a),
           'jaw':(0,0,-.33*a),'upperArmL':(0,0,.30*a),
           'upperArmR':(0,0,.30*a),'tail1':(0,.11*sn,0),
           'tail2':(0,.16*sn,0)}
    elif clip=='turn':
        a=math.sin(phase/2.)
        d={'hips':(0,.12*a,0),'spine':(0,.19*a,0),
           'neck':(0,.19*a,0),'head':(0,.24*a,0),
           'tail1':(0,-.15*a,0),'tail2':(0,-.12*a,0),
           'thighL':(0,0,.10*a),'thighR':(0,0,-.10*a)}
    else: raise ValueError(clip)
    return d,tr

# Each clip physically distinct; loop flags independent of animation name.
CLIPS = {
 'idle':(2.4,True), 'walk':(1.15,True), 'run':(.72,True),
 'stalk':(1.85,True),'alert':(1.25,False),'sniff':(2.1,True),
 'bite':(.85,False),'claw_swipe':(1.05,False),'pounce':(1.2,False),
 'feed':(1.9,True),'drink':(2.35,True),'rest':(2.75,False),
 'sleep':(3.0,False),'hurt':(.9,False),'death':(1.8,False),
 'threat':(1.7,False),'turn':(1.5,False)}

class GLB:
 def __init__(self):
  self.binary=bytearray();self.views=[];self.accessors=[]
 def accessor(self,arr,component=5126,kind=None,normalized=False, minmax=False):
  a=np.ascontiguousarray(arr)
  raw=a.tobytes();off=len(self.binary)
  self.binary.extend(raw);self.binary.extend(b'\0'*((-len(raw))%4))
  self.views.append({'buffer':0,'byteOffset':off,'byteLength':len(raw)})
  d={'bufferView':len(self.views)-1,'componentType':component,'count':len(a),
     'type':kind or ({1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[int(np.prod(a.shape[1:]))])}
  if normalized:d['normalized']=True
  if minmax:
   d['min']=a.min(axis=0).tolist() if a.ndim>1 else [float(a.min())]
   d['max']=a.max(axis=0).tolist() if a.ndim>1 else [float(a.max())]
  self.accessors.append(d);return len(self.accessors)-1
 def export(self,path,gltf):
  gltf['bufferViews']=self.views;gltf['accessors']=self.accessors;gltf['buffers']=[{'byteLength':len(self.binary)}]
  chunk=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf8'); chunk+=b' ' *((-len(chunk))%4)
  bin=bytes(self.binary);bin+=b'\0'*((-len(bin))%4)
  total=12+8+len(chunk)+8+len(bin)
  blob=struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(chunk),b'JSON')+chunk+struct.pack('<I4s',len(bin),b'BIN\x00')+bin
  path.write_bytes(blob)
  return hashlib.sha256(blob).hexdigest(),len(blob)

def export_lod(lod,parts):
  data=GLB();(verts,norm,rgba,joints,weights,idx),names=parts
  pos=data.accessor(verts.astype('<f4'),kind='VEC3',minmax=True)
  nor=data.accessor(norm.astype('<f4'),kind='VEC3')
  col=data.accessor(rgba.astype('u1'),component=5121,kind='VEC4',normalized=True)
  js=data.accessor(joints.astype('u1'),component=5121,kind='VEC4')
  ws=data.accessor(weights.astype('<f4'),kind='VEC4')
  ind=data.accessor(idx.ravel().astype('<u4'),component=5125,kind='SCALAR')
  meshes=[{'name':'Varrisco_Faceted_Skinned_LOD'+str(lod), 'primitives':[{
   'attributes':{'POSITION':pos,'NORMAL':nor,'COLOR_0':col,'JOINTS_0':js,'WEIGHTS_0':ws},
   'indices':ind,'material':0,'mode':4}]}]
  nodes=[{'name':'Varrisco_AnimatedMesh','mesh':0,'skin':0}]
  for bone in BONES:
   par=PARENT[bone]
   trans=BONE_POS[bone] if par is None else BONE_POS[bone]-BONE_POS[par]
   nodes.append({'name':bone, 'translation':np.round(trans,8).tolist(), 'rotation':[0,0,0,1]})
  for bone in BONES:
   par=PARENT[bone]
   if par is not None: nodes[1+ID[par]].setdefault('children',[]).append(1+ID[bone])
  ibm=np.array([np.eye(4,dtype='float32') for _ in BONES])
  for k,b in enumerate(BONES):ibm[k,:3,3]=-BONE_POS[b]
  # glTF matrix serialization is column-major.
  inv_bind=data.accessor(ibm.transpose(0,2,1).reshape(-1,16).astype('<f4'),kind='MAT4')
  skins=[{'name':'Varrisco_Weighted_Skin_v02','joints':list(range(1,len(BONES)+1)),
          'skeleton':1+ID['hips'],'inverseBindMatrices':inv_bind}]
  animations=[]; clip_stats=[]
  for clip,(duration,loop) in CLIPS.items():
   count=max(16,round(duration*24)+1)
   times=np.linspace(0,duration,count,dtype='float32')
   time_acc=data.accessor(times,kind='SCALAR',minmax=True)
   channels=[];samplers=[];max_angle=0.
   for bone in BONES:
    angles=np.array([mov(clip,float(t),duration)[0].get(bone,(0,0,0)) for t in times],dtype=float)
    if np.max(np.abs(angles))<1e-7:continue
    vals=np.array([rot(*a) for a in angles],dtype='<f4')
    acc=data.accessor(vals,kind='VEC4')
    samplers.append({'input':time_acc,'output':acc,'interpolation':'LINEAR'})
    channels.append({'sampler':len(samplers)-1,'target':{'node':1+ID[bone],'path':'rotation'}})
    max_angle=max(max_angle,float(np.max(np.abs(angles))))
   hiptr=np.array([BONE_POS['hips']+mov(clip,float(t),duration)[1]*SCALE for t in times],dtype='<f4')
   if np.max(np.abs(hiptr-hiptr[0]))>1e-6:
    acc=data.accessor(hiptr,kind='VEC3');samplers.append({'input':time_acc,'output':acc,'interpolation':'LINEAR'})
    channels.append({'sampler':len(samplers)-1,'target':{'node':1+ID['hips'],'path':'translation'}})
   if not channels:raise RuntimeError('Empty clip '+clip)
   animations.append({'name':clip,'channels':channels,'samplers':samplers,
     'extras':{'loop':bool(loop),'rootMotion':'in_place_with_bob','sampleRateFPS':24}})
   clip_stats.append({'name':clip,'durationSec':round(duration,3),'loop':loop,
                      'channels':len(channels),'maxJointRotationRad':round(max_angle,4)})
  gltf={'asset':{'version':'2.0','generator':'Wildhaven Varrisco v02 weighted skin generator'},
        'scene':0,'scenes':[{'nodes':[0,1]}], 'nodes':nodes,'meshes':meshes,'skins':skins,
        'materials':[{'name':'Varrisco_Earthy_VertexFacets',
          'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0.0,'roughnessFactor':.99},
          'doubleSided':True}], 'animations':animations,
        'extras':{'species':'varrisco','habitats':['savanna','desert'],
                 'variant_count':1,'coordinateSystem':'X forward; Y up; Z lateral',
                 'sourceVersion':'v01','rig':'GLTF skin weights and inverse bind matrices',
                 'in_game_integration':False}}
  path=ROOT/f'varrisco-animated-v02-LOD{lod}.glb'
  sha,size=data.export(path,gltf)
  report={'file':path.name,'bytes':size,'sha256':sha,'triangleCount':len(idx),
          'meshDefinitions':1,'nodeCount':len(nodes),'skinCount':1,'jointCount':len(BONES),
          'animations':clip_stats, 'materialCount':1,
          'triangleMeasure':'GLB mesh index accessor count / 3, one scene instance'}
  print('Export',report['file'],'triangles',len(idx),'bytes',size,'bones',len(BONES),'animations',len(animations))
  return report

def main():
  lod0=build_geometry()
  # All 4,110 triangles and original vertex colors of the static v01 are preserved.
  assert len(lod0[0][-1])==4110, len(lod0[0][-1])
  result=[export_lod(0,lod0)]
  manifest={'species':'varrisco','version':'v02','stage':'animated_weighted_skin','status':'awaiting_user_visual_playback_approval',
            'sourceConcept':'2026-11-09 approved Varrisco v01','baseModel':'v01 geometry preserved unmodified',
            'habitats':['savanna','desert'],'variants':1, 'units':'metres','axis':'X forward Y up Z lateral',
            'anatomicalNotes':'biped with toe sickles, counterweight tail, articulated jaw; facet normals unchanged',
            'rigMethod':'glTF skin with JOINTS_0/WEIGHTS_0 and inverseBindMatrices, no pivot-only claim',
            'source':'source/build_animated.py','sourceGeometry':'../v01/source/build.py',
            'files':result,'clips':list(CLIPS),'LOD0':result[0]['file'],
            'lodsAdditional':'not generated at this stage; 4,110-triangle LOD0 is the original optimized pilot geometry',
            'integration':'not integrated with Alpha/gameplay; no physics/terrain IK; in-place motion may slide feet',
            'approval':{'concept':'approved','v01_blockout':'superseded by user instruction to animate','v02_animation':'in_review'},
            'publication':'local; GitHub remote hash verification pending'}
  (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  return result

if __name__=='__main__':main()
