from pathlib import Path
import struct,json,hashlib,sys,math
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=Path(__file__).resolve().parents[1]
BASE=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent/'papagaio-v02'
OUT=ROOT/'lagarto-papagaio-v03-animado.glb'
raw=(BASE/'lagarto-papagaio-v02.glb').read_bytes(); jl=struct.unpack_from('<I',raw,12)[0]; g=json.loads(raw[20:20+jl]); bin0=raw[28+jl:]; buf=bytearray(bin0)
# Recover original anatomical labels from the exact final source, without regenerating texture or geometry.
src=BASE/'iterations/04/source/build.py'; code=src.read_text().split('# merge into one primitive')[0]; env={'__file__':str(src)};exec(compile(code,str(src),'exec'),env);parts=env['parts']; vertices=np.concatenate([v[f].reshape(-1,3) for v,f,uv,n in parts]);ground=vertices[:,2].min();vertices[:,2]-=ground;vertices=vertices[:,[0,2,1]];vertices[:,2]*=-1
prim=g['meshes'][0]['primitives'][0]; posacc=g['accessors'][prim['attributes']['POSITION']]; pv=g['bufferViews'][posacc['bufferView']];pos=np.frombuffer(bin0,dtype='<f4',count=posacc['count']*3,offset=pv['byteOffset']).reshape(-1,3).copy();assert np.allclose(vertices,pos,atol=1e-6)
# Anatomical skeleton, all rest local frames aligned with GLB axes.
names=[];parents=[];P=[]
def bone(n,p,xyz):
 names.append(n);parents.append(names.index(p) if p else -1);P.append(np.array([xyz[0],xyz[2]-ground,-xyz[1]]) if p else np.zeros(3));return n
bone('root',None,(0,0,0));bone('pelvis','root',(-.92,0,.91));bone('spine','pelvis',(-.27,0,.94));bone('chest','spine',(.48,0,.93));bone('neck','chest',(.94,0,1.08));bone('head','neck',(1.40,0,1.34));bone('jaw','head',(1.36,0,1.21))
for i,(x,y,z) in enumerate([(-1.31,.001,.82),(-1.93,.081,.57),(-2.49,.24,.43),(-3.08,.50,.40),(-3.48,.66,.42)]):bone(f'tail{i+1}','pelvis' if i==0 else f'tail{i}',(x,y,z))
legs=[]
for s in (-1,1):
 for front in (True,False):
  k=('fore' if front else 'hind')+str(s); parent='chest' if front else 'pelvis'
  a,b,c=(((.57,s*.30,1.07),(.32,s*.73,.62),(.68,s*.85,.17)) if front else ((-.94,s*.32,1),(-.55,s*.77,.62),(-.94,s*.93,.19)))
  bone(k+'_upper',parent,a);bone(k+'_lower',k+'_upper',b);bone(k+'_foot',k+'_lower',c);legs.append((k,s,front))
P=np.array(P);I={n:i for i,n in enumerate(names)};J=len(names);trans=np.array([p-(P[pa] if pa>=0 else 0) for p,pa in zip(P,parents)])
# Skinning uses original named parts rather than coordinate-only classification.
joints=np.zeros((len(pos),4),np.uint8);weights=np.zeros((len(pos),4),np.float32)
def mix(i,ns,ws):
 for k,(n,w) in enumerate(zip(ns,ws)):joints[i,k]=I[n];weights[i,k]=w

def axial(x):
 knots=[(-3.48,'tail5'),(-3.08,'tail4'),(-2.49,'tail3'),(-1.93,'tail2'),(-1.31,'tail1'),(-.92,'pelvis'),(-.27,'spine'),(.48,'chest'),(.94,'neck'),(1.4,'head')]
 if x<=knots[0][0]:return [knots[0][1]],[1.]
 for (a,n),(b,m) in zip(knots,knots[1:]):
  if x<=b:
   t=np.clip((x-a)/(b-a),0,1);return [n,m],[1-t,t]
 return ['head'],[1.]
start=0
for v,f,uv,n in parts:
 count=f.size; pp=pos[start:start+count]; matches=[(k,s,front) for k,s,front in legs if n.startswith(k)]
 for j,(x,y,z) in enumerate(pp):
  i=start+j
  if n=='core':ns,ws=axial(x)
  elif n.startswith('lower_jaw') or n.startswith('lower_tooth') or n=='mouth_interior':ns,ws=['jaw'],[1.]
  elif matches:
   k,s,front=matches[0]; base='chest' if front else 'pelvis'
   if n!=k:ns,ws=[k+'_foot'],[1.]
   else:
    # At root attach to shoulder/pelvis; at elbow/ankle blend smoothly between connected bones.
    a=P[I[k+'_upper'],1]; b=P[I[k+'_lower'],1]; c=P[I[k+'_foot'],1]
    if y>b+.17:
     t=np.clip((a+.04-y)/.30,0,1);ns,ws=[base,k+'_upper'],[1-t,t]
    elif y>b-.15:
     t=np.clip((b+.17-y)/.32,0,1);ns,ws=[k+'_upper',k+'_lower'],[1-t,t]
    else:
     t=np.clip((c+.16-y)/.21,0,1);ns,ws=[k+'_lower',k+'_foot'],[1-t,t]
  elif n.startswith(('crest','nape')):ns,ws=axial(float(pp[:,0].mean())+.035)
  else:ns,ws=['head'],[1.]
  mix(i,ns,ws)
 start+=count
assert start==len(pos) and np.allclose(weights.sum(axis=1),1)
# append glTF data, keep original geometry and UV byte-identical

def accessor(a,typ,ct,target=None,bounds=False):
 while len(buf)%4:buf.append(0)
 a=np.ascontiguousarray(a); off=len(buf);buf.extend(a.tobytes());v={'buffer':0,'byteOffset':off,'byteLength':a.nbytes}
 if target:v['target']=target
 g['bufferViews'].append(v);ac={'bufferView':len(g['bufferViews'])-1,'componentType':ct,'count':len(a),'type':typ}
 if bounds:ac.update(min=np.atleast_1d(a.min(axis=0)).tolist(),max=np.atleast_1d(a.max(axis=0)).tolist())
 g['accessors'].append(ac);return len(g['accessors'])-1
prim['attributes']['JOINTS_0']=accessor(joints,'VEC4',5121,34962);prim['attributes']['WEIGHTS_0']=accessor(weights.astype('<f4'),'VEC4',5126,34962)
nodebase=len(g['nodes']);g['nodes'][0]['children'].append(nodebase)
for i,n in enumerate(names):
 nd={'name':n,'translation':trans[i].tolist()};child=[nodebase+k for k,p in enumerate(parents) if p==i]
 if child:nd['children']=child
 g['nodes'].append(nd)
# Socket is a separate child, not a weighted joint. +X forward.
socket=np.array([2.23,1.12-ground,0]);socket_index=len(g['nodes']);g['nodes'].append({'name':'poison_mouth_socket','translation':(socket-P[I['head']]).tolist()});g['nodes'][nodebase+I['head']].setdefault('children',[]).append(socket_index)
ibm=np.tile(np.eye(4),(J,1,1));ibm[:,:3,3]=-P;ib=accessor(ibm.transpose(0,2,1).astype('<f4').reshape(J,16),'MAT4',5126);g['skins']=[{'name':'Papagaio_v03','joints':list(range(nodebase,nodebase+J)),'skeleton':nodebase,'inverseBindMatrices':ib}];g['nodes'][1]['skin']=0
# Clip pose generation. IK solves world foot targets over two limbs, with fixed rest lengths.
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
def envelope(s,a,b,c,d):return smooth((s-a)/(b-a))*(1-smooth((s-c)/(d-c)))
def arc(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);dot=np.clip(a@b,-1,1);cross=np.cross(a,b)
 if np.linalg.norm(cross)<1e-8:return R.identity() if dot>0 else R.from_rotvec(np.pi*np.cross(a,[0,1,0])/max(1e-8,np.linalg.norm(np.cross(a,[0,1,0]))))
 return R.from_rotvec(cross/np.linalg.norm(cross)*np.arccos(dot))

def fk(q,t):
 rr=[];pp=[]
 for i,p in enumerate(parents):
  r=R.from_quat(q[i]);rr.append(r if p<0 else rr[p]*r);pp.append(t[i] if p<0 else pp[p]+rr[p].apply(t[i]))
 return rr,np.array(pp)

def pose(n,s):
 q=np.tile([0.,0.,0.,1.],(J,1));t=trans.copy()
 def setr(k,x=0,y=0,z=0):q[I[k]]=R.from_euler('xyz',[x,y,z],degrees=True).as_quat()
 phase=2*np.pi*s; gait=n in ('walk','run','stalk','backstep','turn_left','turn_right');amp={'walk':.21,'run':.36,'stalk':.16,'backstep':.17,'turn_left':.15,'turn_right':.15}.get(n,0); targets={k:P[I[k+'_foot']].copy() for k,_,_ in legs}
 setr('jaw',z=13) # original blockout is open; relax to near-closed jaw.
 if n=='idle':
  setr('spine',x=1.0*np.sin(phase),z=1.5*np.sin(phase));setr('neck',z=1.4*np.sin(phase+.5));setr('head',y=2.0*np.sin(phase-.4));t[0,1]=.008*np.sin(phase)
 if gait:
  t[0,1]=(-.085 if n=='stalk' else 0)+(.018 if n!='run' else .038)*(1-np.cos(2*phase));setr('pelvis',y=3*np.sin(phase),x=2*np.sin(phase));setr('chest',y=-4*np.sin(phase),x=-2*np.sin(phase));setr('neck',z=-5 if n=='stalk' else 1.8*np.cos(2*phase));
  for k,side,front in legs:
   ph=(s+(0 if (side==-1)==front else .5)+(0 if n=='run' else (.13 if front else 0)))%1; stance=.57 if n=='run' else .70
   if ph<stance:dx=amp*(1-2*ph/stance);lift=0
   else:
    u=(ph-stance)/(1-stance);dx=amp*(-1+2*smooth(u));lift=(.18 if n=='run' else .085)*np.sin(np.pi*u)
   if n=='backstep':dx=-dx
   if n.startswith('turn'):dx*=side*(1 if n=='turn_left' else -1)
   targets[k]+=np.array([dx,lift,0])
 for j in range(1,6):setr('tail'+str(j),y=(4 if gait else 2)*np.sin(phase-j*.6))
 if n in ('alert','roar','bite','bite_heavy','poison_gas','feed','drink','threaten'):
  a=envelope(s,.05,.32,.68,.95);hit=envelope(s,.35,.48,.60,.88)
  if n=='alert':setr('neck',z=9*a);setr('head',y=9*np.sin(phase)*a)
  if n in ('roar','threaten'):setr('chest',z=6*a);setr('neck',z=10*a);setr('head',z=4*a);setr('jaw',z=13-31*a);t[0,1]=.045*a
  if n in ('bite','bite_heavy'):
   p=envelope(s,.08,.32,.39,.54);h=envelope(s,.37,.52,.61,.90);setr('neck',z=7*p-13*h);setr('head',z=6*p-8*h);setr('jaw',z=13-37*p+6*h);setr('chest',z=-5*h);t[0,0]=(.13 if n=='bite' else .22)*h
  if n=='poison_gas':
   prep=envelope(s,0,.27,.31,.44);spray=envelope(s,.30,.43,.73,.94);setr('chest',z=5*prep-3*spray);setr('neck',z=14*prep+1*spray);setr('head',z=7*prep-4*spray,y=4*np.sin(phase*1.5)*spray);setr('jaw',z=13-43*spray-8*prep);t[0,0]=-.07*prep+.07*spray;t[0,1]=.045*prep-.022*spray
  if n in ('feed','drink'):setr('chest',z=-6*a);setr('neck',z=-25*a);setr('head',z=-14*a);setr('jaw',z=13-(15+7*np.sin(phase*4))*a)
 if n.startswith('claw_'):
  side=-1 if n.endswith('left') else 1; k='fore'+str(side); a=envelope(s,.08,.32,.65,.93);h=envelope(s,.25,.49,.57,.86);targets[k]+=np.array([-.08*a+.48*h,.27*a, -.08*side*a]);setr('chest',x=6*side*a,y=9*side*h);setr('neck',y=-7*side*h)
 if n.startswith('tail_sweep'):
  side=1 if n.endswith('left') else -1;pre=envelope(s,.02,.24,.34,.51);hit=envelope(s,.34,.57,.67,.96);setr('pelvis',y=side*(-9*pre+10*hit));setr('chest',y=-side*10*hit)
  for j in range(1,6):setr('tail'+str(j),y=side*(-(12+j*3)*pre+(17+j*4)*hit))
 if n in ('hurt','stagger'):a=envelope(s,0,.16,.30,.95);setr('head',z=12*a,y=13*a);setr('neck',z=5*a);setr('chest',x=6*a,z=4*a);t[0,0]=-.13*a
 if n in ('rest','rise','death'):
  a=(smooth(s) if n=='death' else 1-smooth(s) if n=='rise' else 1);t[0,1]=-.30*a;setr('neck',z=-15*a);setr('head',z=-8*a);setr('chest',z=-4*a);setr('jaw',z=13-6*a)
  if n=='death':setr('pelvis',x=10*a);setr('spine',x=7*a)
 # solve per-leg IK with preferred outward knee bend from rest, avoiding abrupt flip
 for k,side,front in legs:
  ui,li,fi=[I[k+'_'+a] for a in ('upper','lower','foot')];rr,pp=fk(q,t);A=pp[ui];C=targets[k];restu=P[li]-P[ui];restl=P[fi]-P[li];l1=np.linalg.norm(restu);l2=np.linalg.norm(restl);direction=C-A;dist=np.linalg.norm(direction);d=direction/max(dist,1e-8);dist=np.clip(dist,abs(l1-l2)+.001,l1+l2-.001);along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=np.sqrt(max(0,l1*l1-along*along));pref=restu-d*np.dot(restu,d);pref/=max(np.linalg.norm(pref),1e-8);B=A+d*along+pref*height;C=A+d*dist
  world_u=arc(restu,B-A);world_l=arc(restl,C-B);q[ui]=(rr[parents[ui]].inv()*world_u).as_quat();q[li]=(world_u.inv()*world_l).as_quat();q[fi]=world_l.inv().as_quat()
 return q,t
clips={'idle':(3.6,True),'walk':(2.0,True),'run':(.95,True),'stalk':(2.6,True),'backstep':(1.8,True),'turn_left':(1.7,True),'turn_right':(1.7,True),'alert':(1.7,False),'roar':(2.1,False),'threaten':(2.3,False),'bite':(.88,False),'bite_heavy':(1.35,False),'claw_left':(1.15,False),'claw_right':(1.15,False),'tail_sweep_left':(1.65,False),'tail_sweep_right':(1.65,False),'poison_gas':(3.4,False),'feed':(2.2,True),'drink':(2.4,True),'hurt':(.65,False),'stagger':(1.05,False),'rest':(2.8,True),'rise':(1.8,False),'death':(2.6,False)}
g['animations']=[]
for n,(dur,loop) in clips.items():
 times=np.linspace(0,dur,round(dur*24)+1,dtype='<f4');poses=[pose(n,float(s/dur)) for s in times];qs=np.array([x[0] for x in poses]);ts=np.array([x[1] for x in poses]);
 if loop:qs[-1]=qs[0];ts[-1]=ts[0]
 for k in range(1,len(qs)):
  mask=(qs[k]*qs[k-1]).sum(axis=1)<0;qs[k,mask]*=-1
 ta=accessor(times,'SCALAR',5126,bounds=True);anim={'name':n,'samplers':[],'channels':[],'extras':{'loop':loop,'layer':1,'bakedFootIK':True,'damageAuthority':False}}
 def channel(i,path,data,typ):
  oi=accessor(data.astype('<f4'),typ,5126);s=len(anim['samplers']);anim['samplers'].append({'input':ta,'output':oi,'interpolation':'LINEAR'});anim['channels'].append({'sampler':s,'target':{'node':nodebase+i,'path':path}})
 for i in range(J):channel(i,'rotation',qs[:,i],'VEC4')
 channel(0,'translation',ts[:,0],'VEC3')
 if n=='poison_gas':anim['extras']['events']=[{'time':1.12,'event':'poison_vfx_start','socket':'poison_mouth_socket'},{'time':2.48,'event':'poison_vfx_stop','socket':'poison_mouth_socket'}]
 g['animations'].append(anim)
g['asset']['extras']={'wildhaven':{'version':'v03','base':'v02','bakedFootIK':True,'runtimeTerrainIK':False,'gasVFX':'separate preview only','aiCombat':False}};g['buffers'][0]['byteLength']=len(buf)
def write_glb(g,b,path):
 s=json.dumps(g,separators=(',',':'),ensure_ascii=True).encode();s+=b' '*(-len(s)%4);b=bytes(b)+b'\0'*(-len(b)%4);path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(s)+len(b))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(b),0x004e4942)+b)
write_glb(g,buf,OUT)
manifest={'species':'lagarto-papagaio','version':'v03','base_sha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,'triangles':4946,'joints':J,'skins':1,'clips':[{ 'name':n,'duration':d,'loop':l} for n,(d,l) in clips.items()],'socket':'poison_mouth_socket','gas_events_seconds':[1.12,2.48],'geometry_uv_texture_binary_preserved':bytes(buf[:len(bin0)])==bin0,'alpha_changed':False,'artistic_qa':'pending','runtime_terrain_ik':'not integrated','runtime_poison_damage':'not implemented','notes':'85 overlapping closed shells retained; visual articulation review required.'};(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
