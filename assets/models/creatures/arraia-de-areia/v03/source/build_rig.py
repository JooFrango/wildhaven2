#!/usr/bin/env python3
"""Wildhaven Arraia-de-Areia v03: 23-joint weighted skin, 22 original clips.

Uses the V02 approved anatomical refinement as the *binary* source, retaining
POSITION, NORMAL (if any), TEXCOORD_0, topology, material, embedded texture.
Colored markings remain raster UV pixels, NEVER decorative mesh additions.
Fin waves are a continuous many-bone deformation via skinning (not separate wings).
No LOD generation, no Alpha integration; v01/v02 are untouched.
"""
from __future__ import annotations
import json, math, struct, hashlib, importlib.util
from pathlib import Path
import numpy as np
THIS=Path(__file__).resolve()
V03=THIS.parent.parent
V02=V03.parent/'v02'
BASE_GLB=V02/'arraia-de-areia-v02-anatomia-refinada.glb'
SOURCE=V02/'source'/'build_refined.py'
OUTPUT=V03/'arraia-de-areia-v03-rig-animated-LOD0.glb'
MANIFEST=V03/'manifest.json'
# All positions are in world bind space (X forward, Y up, Z wingspan).
JOINTS=[
 ('root',None,(0,0,0)),
 ('mantle_center','root',(0.0,2.6,0)),
 ('mantle_rear','mantle_center',(-3.15,2.55,0)),
 ('mantle_front','mantle_center',(3.10,2.58,0)),
 ('head','mantle_front',(5.25,2.55,0)),
 ('lower_jaw','head',(5.85,1.18,0)),
 ('filter_rake','head',(6.36,1.67,0)),
 ('tusk_L','head',(6.10,1.9,2.52)),
 ('tusk_R','head',(6.10,1.9,-2.52)),
 ('tail_root','mantle_rear',(-4.20,2.45,0)),
 ('tail_mid','tail_root',(-7.0,2.55,0)),
 ('tail_distal','tail_mid',(-9.75,2.8,0)),
 ('tail_tip','tail_distal',(-12.25,3.65,0)),
]
for sg,sign in [('L',1),('R',-1)]:
    JOINTS += [
        (f'wing_{sg}_root','mantle_center',(.28,2.72,1.40*sign)),
        (f'wing_{sg}_inner',f'wing_{sg}_root',(.07,2.75,3.15*sign)),
        (f'wing_{sg}_mid',f'wing_{sg}_inner',(-.55,2.78,4.88*sign)),
        (f'wing_{sg}_outer',f'wing_{sg}_mid',(-1.35,3.18,6.75*sign)),
        (f'wing_{sg}_tip',f'wing_{sg}_outer',(-2.36,3.85,8.98*sign))]
JNAMES=[x[0] for x in JOINTS]
NAMES={name:i for i,name in enumerate(JNAMES)}
REST={name:np.array(p,float) for name,parent,p in JOINTS}
PARENT={name:parent for name,parent,p in JOINTS}
CHILDREN={name:[] for name in JNAMES}
for name,parent,p in JOINTS:
    if parent is not None:CHILDREN[parent].append(name)
# Number of joints: 13 torso/head/tail + 10 fin = 23
assert len(JOINTS)==23

def glb_import(path):
    data=path.read_bytes();assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
    length,typ=struct.unpack_from('<I4s',data,12);assert typ==b'JSON'
    j=json.loads(data[20:20+length]);ofs=20+length
    binlen,typ=struct.unpack_from('<I4s',data,ofs);assert typ==b'BIN\x00'
    raw=bytearray(data[ofs+8:ofs+8+binlen]);return j,raw,hashlib.sha256(data).hexdigest()

def accessor(j,raw,idx):
    a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']]
    dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    d={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    return np.frombuffer(raw,dtype=d,count=a['count']*dim,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim).copy()

def recreate_tags():
    sp=importlib.util.spec_from_file_location('arraia_v02_refined',SOURCE)
    module=importlib.util.module_from_spec(sp);sp.loader.exec_module(module)
    class Tagged(module.Refined):
        def __init__(self):super().__init__();self.tags=[]
        def tri(self,p,q,r,tp,tq,tr,name):
            super().tri(p,q,r,tp,tq,tr,name);self.tags.extend([name]*3)
    s=Tagged().create()
    return np.asarray(s.vertices,dtype=np.float32),np.asarray(s.uv,dtype=np.float32),s.tags,s.parts

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0.0,1.0)
    return t*t*(3-2*t)

def painted_skin_weights(points,tags):
    joints=np.zeros((len(points),4),dtype=np.uint16)
    weights=np.zeros((len(points),4),dtype=np.float32)
    mantle={'dorsal_mantle','ventral_mantle','leading_trailing_wing_edge',
            'wing_tip_edge','pectoral_fin_support','scapular_support'}
    jaw={'lower_jaw_lip','buccal_corner_fold'}
    head={'mouth_cavity','upper_jaw_brim','inset_orbital_rim','iris_inset',
          'pupil_recess','cephalic_sensory_ridge'}
    for k,(pt,tag) in enumerate(zip(points,tags)):
        x,y,z=map(float,pt); az=abs(z);sg='L' if z>=0 else 'R'
        vals={}
        def add(name,v):vals[name]=vals.get(name,0)+max(0,float(v))
        def torso(x,w):
            xc=np.array([-3.,.2,3.8]);g=np.exp(-((x-xc)/2.6)**2)
            g/=max(g.sum(),1.e-8)
            for name,v in zip(['mantle_rear','mantle_center','mantle_front'],g):add(name,w*v)
        if tag in mantle:
            wing=smooth(.75,2.15,az)
            torso(x,1-wing)
            centers=np.array([1.4,3.15,4.88,6.75,8.98])
            g=np.exp(-((az-centers)/1.06)**2)
            g/=max(g.sum(),1.e-8)
            for label,v in zip(['root','inner','mid','outer','tip'],g):add('wing_'+sg+'_'+label,wing*v)
        elif tag in ('flexible_muscular_tail','tail_defensive_spines','tail_fin'):
            centers=np.array([-4.25,-7.1,-9.9,-12.3]);g=np.exp(-((x-centers)/1.7)**2)
            g/=max(g.sum(),1e-8)
            for label,v in zip(['root','mid','distal','tip'],g):add('tail_'+label,v)
        elif tag=='front_sand_tusk':add('tusk_'+sg,.95);add('head',.05)
        elif tag in jaw:
            add('lower_jaw',.94);add('head',.06)
        elif tag=='filtering_keratin_barb':
            add('filter_rake',.83);add('head',.17)
        elif tag in head:
            add('head',.95);add('mantle_front',.05)
        else: # structural osteoderms on central back
            torso(x,1.0)
        chosen=sorted(vals.items(),key=lambda p:p[1],reverse=True)[:4]
        total=sum(v for _,v in chosen)
        assert total>0
        for i,(n,v) in enumerate(chosen):
            joints[k,i]=NAMES[n];weights[k,i]=v/total
    assert len(set(joints[:,0]))>=15
    assert np.max(abs(weights.sum(axis=1)-1))<1e-5
    assert ((weights>.1)&(weights<.9)).any()
    return joints,weights

def q_axis(axis,r):
    s=math.sin(r/2);return np.asarray([axis[0]*s,axis[1]*s,axis[2]*s,math.cos(r/2)],np.float32)

def qmul(a,b):
    x,y,z,w=a;X,Y,Z,W=b
    return np.asarray([w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z],np.float32)

def orient(yaw=0,pitch=0,roll=0):
    v=qmul(qmul(q_axis((0,1,0),yaw),q_axis((0,0,1),pitch)),q_axis((1,0,0),roll))
    return (v/np.linalg.norm(v)).astype('float32')

# Labels match the expected sand-swimming ecosystem, not ordinary aquatic swimming.
SPECS={
 'idle':(5.0,32,True),'swim_sand':(3.6,36,True),'swim_fast':(2.4,36,True),
 'glide_shallow':(4.8,32,True),'dive':(4.0,32,False),'surface':(3.8,32,False),
 'burrow':(4.5,36,False),'turn_left':(3.2,32,False),'turn_right':(3.2,32,False),
 'feed_roots':(5.2,36,True),'filter_feed':(4.5,36,True),'scavenge':(5.0,36,True),
 'alert':(2.9,28,False),'threat_display':(4.2,36,True),
 'fin_slap':(2.9,32,False),'tail_sweep':(3.2,36,False),
 'charge':(2.7,36,True),'evade':(3.4,32,False),'hurt':(2.2,28,False),
 'rest':(6.0,32,True),'death':(5.3,40,False),'breach':(4.8,40,False)
}

def pose(name,t,duration):
    u=np.clip(t/duration,0,1); a=2*math.pi*u
    rot={j:[0.,0.,0.] for j in JNAMES} # yaw,pitch,roll
    delta=np.zeros(3,np.float32)
    def turn(n,yaw=0.,pitch=0.,roll=0.):rot[n]=[float(yaw),float(pitch),float(roll)]
    sin=math.sin
    def mantle(rate=1.,intensity=1.):
        turn('mantle_center',roll=.023*intensity*sin(a*rate))
        turn('mantle_rear',yaw=.055*intensity*sin(a*rate-.7))
        turn('mantle_front',yaw=.038*intensity*sin(a*rate+.45))
        turn('head',pitch=.018*intensity*sin(a*rate+.65))
        for n,phase,size in [('tail_root',-.6,.09),('tail_mid',-1.2,.13),('tail_distal',-1.8,.16),('tail_tip',-2.3,.11)]:
            turn(n,yaw=size*intensity*sin(a*rate+phase))
    def wave(power=1.0,frequency=1.0,slow_phase=.0,asymmetric=0.):
        # True traveling wave, rising from central cartilage to thin wing tips.
        for sg,sign in [('L',1),('R',-1)]:
            side=1+asymmetric*sign
            for part,offset,amplitude in [('root',.10,.040),('inner',.52,.095),('mid',1.13,.140),
                                          ('outer',1.72,.175),('tip',2.30,.175)]:
                theta=a*frequency-offset+slow_phase
                # Roll about longitudinal X: up/down fin flapping is lateral-undulatory
                turn('wing_'+sg+'_'+part,roll=sign*power*side*amplitude*sin(theta),
                     pitch=power*side*.025*sin(theta-.3),yaw=sign*power*.014*sin(theta))
    if name=='idle':
        mantle(.6,.15);wave(.10,.7);delta[1]=.035*sin(a)
    elif name=='swim_sand':
        mantle(1.,.70);wave(.95,1);delta[1]=.14*sin(a*2)
    elif name=='swim_fast':
        mantle(1.6,1.15);wave(1.25,1.5);delta[1]=.19*sin(a*3)
    elif name=='glide_shallow':
        mantle(1,.18);wave(.35,1);delta[1]=.06*sin(a)
    elif name=='dive':
        h=smooth(.04,.95,u);delta[1]=-3.4*h
        turn('root',pitch=-.20*sin(math.pi*u));mantle(.6,.6);wave(.6,1)
    elif name=='surface':
        h=smooth(.04,.96,u);delta[1]=2.8*h
        turn('root',pitch=.18*sin(math.pi*u));mantle(.6,.6);wave(.7,1)
    elif name=='burrow':
        delta[1]=-4.0*smooth(.08,.98,u);turn('root',pitch=-.12*sin(math.pi*u))
        mantle(1,.8);wave(1,1.15)
    elif name in ('turn_left','turn_right'):
        direction=1 if name=='turn_left' else -1
        turn('root',yaw=direction*.54*smooth(0,.85,u))
        mantle(.5,.3);wave(.85,1,asymmetric=direction*.58)
    elif name=='feed_roots':
        mantle(1,.16);wave(.24,1);turn('lower_jaw',pitch=-.18*(.65+.35*sin(2*a)))
        turn('head',pitch=-.06*(.5+.5*sin(a)));delta[1]=-.10*(.5+.5*sin(a))
    elif name=='filter_feed':
        mantle(1,.12);wave(.30,1)
        turn('lower_jaw',pitch=-.36*(.5+.5*sin(a-.9)))
        turn('filter_rake',pitch=.14*sin(2*a+.35))
    elif name=='scavenge':
        mantle(1,.23);wave(.36,1)
        turn('lower_jaw',pitch=-.34*(.5+.5*sin(2*a)))
        turn('head',yaw=.10*sin(a),pitch=-.07*(.5+.5*sin(a)))
    elif name=='alert':
        h=sin(math.pi*u)
        turn('head',pitch=.11*h);wave(.18,1);turn('tail_root',yaw=.10*h)
    elif name=='threat_display':
        mantle(1,.3);wave(.82,1)
        turn('lower_jaw',pitch=-.35*(.5+.5*sin(a)))
        turn('mantle_front',pitch=.07*(.5+.5*sin(a)))
    elif name=='fin_slap':
        h=sin(math.pi*u)**3
        for sg,sign in [('L',1),('R',-1)]:
            for part,mult in [('inner',.17),('mid',.34),('outer',.48),('tip',.55)]:
                turn('wing_'+sg+'_'+part,roll=-sign*mult*h)
        delta[1]=.23*h
    elif name=='tail_sweep':
        h=sin(math.pi*u)**3
        turn('tail_root',yaw=.32*h);turn('tail_mid',yaw=-.55*h)
        turn('tail_distal',yaw=.66*h);turn('tail_tip',yaw=.35*h)
        wave(.25,1)
    elif name=='charge':
        mantle(1.5,1.1);wave(1.35,1.6);delta[1]=.21*sin(3*a)
    elif name=='evade':
        h=sin(math.pi*u)**2
        turn('root',yaw=.70*h,roll=.11*h)
        wave(1.15,1,asymmetric=.42);mantle(1,.56)
    elif name=='hurt':
        h=sin(math.pi*u)**3
        turn('root',roll=.17*h);turn('mantle_rear',yaw=-.12*h)
        wave(.37,1,asymmetric=.35);delta[1]=-.26*h
    elif name=='rest':
        delta[1]=-.5;mantle(1,.06);wave(.04,1)
    elif name=='death':
        h=smooth(.05,.94,u)
        delta[1]=-1.9*h;turn('root',roll=.32*h,pitch=-.15*h)
        turn('lower_jaw',pitch=-.20*h)
        turn('tail_mid',yaw=.16*h);turn('tail_tip',yaw=.32*h)
        for sg,sign in [('L',1),('R',-1)]:turn('wing_'+sg+'_outer',roll=sign*.15*h)
    elif name=='breach':
        h=math.sin(math.pi*u)**2
        delta[1]=5.5*h;turn('root',pitch=.23*sin(math.pi*u))
        mantle(1,.48);wave(.95,1)
        turn('lower_jaw',pitch=-.18*h)
    else:raise KeyError(name)
    return {j:orient(*rot[j]) for j in JNAMES},delta

def align4(buf):
    while len(buf)%4:buf.append(0)

def append_accessor(j,raw,arr,type_,comp,limits=False,target=None):
    dtype={5126:'<f4',5123:'<u2'}[comp]
    a=np.asarray(arr,dtype=dtype)
    arity={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[type_]
    a=a.reshape(-1,arity)
    align4(raw);offset=len(raw);data=a.tobytes();raw.extend(data)
    view={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
    if target is not None:view['target']=target
    viewidx=len(j['bufferViews']);j['bufferViews'].append(view)
    acc={'bufferView':viewidx,'componentType':comp,'count':len(a),'type':type_}
    if limits:acc['min']=np.min(a,axis=0).tolist();acc['max']=np.max(a,axis=0).tolist()
    acidx=len(j['accessors']);j['accessors'].append(acc)
    return acidx

def main():
    V03.mkdir(parents=True,exist_ok=True)
    j,raw,base_hash=glb_import(BASE_GLB)
    mesh=j['meshes'][0]['primitives'][0]
    pos=accessor(j,raw,mesh['attributes']['POSITION']).astype(np.float32)
    uv=accessor(j,raw,mesh['attributes']['TEXCOORD_0']).astype(np.float32)
    src_pos,src_uv,tags,groups=recreate_tags()
    assert len(pos)==19728 and len(pos)==len(src_pos)==len(tags)
    assert np.array_equal(pos,src_pos), 'v02 source mesh mismatch'
    assert np.allclose(uv[:,0],src_uv[:,0],atol=1e-6)
    assert np.allclose(uv[:,1],1-src_uv[:,1],atol=1e-6)
    vj,vw=painted_skin_weights(pos,tags)
    mesh['attributes']['JOINTS_0']=append_accessor(j,raw,vj,'VEC4',5123)
    mesh['attributes']['WEIGHTS_0']=append_accessor(j,raw,vw,'VEC4',5126)
    node_start=len(j['nodes'])
    assert j['nodes'][0]['name']=='world' and j['nodes'][1]['mesh']==0
    j['nodes'][1]['skin']=0
    for name,parent,p in JOINTS:
        local=REST[name]-(REST[parent] if parent else np.zeros(3))
        n={'name':'arraia_'+name,'translation':local.tolist(),'rotation':[0,0,0,1]}
        if CHILDREN[name]:n['children']=[node_start+NAMES[ch] for ch in CHILDREN[name]]
        j['nodes'].append(n)
    j['nodes'][0]['children'].append(node_start)
    order=[node_start+i for i in range(len(JOINTS))]
    binds=[]
    for name,parent,p in JOINTS:
        m=np.eye(4,dtype='<f4');m[:3,3]=-REST[name]
        binds.append(m.T.reshape(16))
    ibm=append_accessor(j,raw,np.asarray(binds),'MAT4',5126)
    j['skins']=[{'name':'Arraia_de_Areia_v03_weighted','inverseBindMatrices':ibm,'joints':order,'skeleton':order[0]}]
    clips=[]
    for clip,(duration,frames,loop) in SPECS.items():
        times=np.linspace(0,duration,frames+1,dtype=np.float32)
        inputs=append_accessor(j,raw,times,'SCALAR',5126,limits=True)
        poses={n:[] for n in JNAMES};translations=[]
        for t in times:
            quats,trans=pose(clip,float(t),float(duration))
            for n in JNAMES:poses[n].append(quats[n])
            translations.append(trans)
        if loop:
            for n in JNAMES:poses[n][-1]=poses[n][0].copy()
            translations[-1]=translations[0].copy()
        anim={'name':clip,'samplers':[],'channels':[],
              'extras':{'loop':loop,'species':'arraia-de-areia','version':'v03','true_weighted_skin':True}}
        for n in JNAMES:
            q=np.asarray(poses[n],dtype=np.float32)
            for idx in range(1,len(q)):
                if np.dot(q[idx-1],q[idx])<0:q[idx]*=-1
            data=append_accessor(j,raw,q,'VEC4',5126)
            sampler=len(anim['samplers']);anim['samplers'].append({'input':inputs,'output':data,'interpolation':'LINEAR'})
            anim['channels'].append({'sampler':sampler,'target':{'node':node_start+NAMES[n],'path':'rotation'}})
        data=append_accessor(j,raw,translations,'VEC3',5126)
        sampler=len(anim['samplers']);anim['samplers'].append({'input':inputs,'output':data,'interpolation':'LINEAR'})
        anim['channels'].append({'sampler':sampler,'target':{'node':node_start,'path':'translation'}})
        clips.append(anim)
    j['animations']=clips
    j['asset']['generator']='Wildhaven Arraia-de-Areia v03 real UV preserved weighted skin + 22 ecosystem clips'
    j['buffers'][0]['byteLength']=len(raw)
    txt=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode('utf8')
    txt+=b' '*((-len(txt))%4);align4(raw)
    out=b'glTF'+struct.pack('<II',2,12+8+len(txt)+8+len(raw))+struct.pack('<I4s',len(txt),b'JSON')+txt+struct.pack('<I4s',len(raw),b'BIN\0')+raw
    OUTPUT.write_bytes(out)
    m={
      'species':'Arraia-de-Areia','version':'v03','stage':'rig_and_glTF_animations',
      'status':{'concept':'approved','v01_shape':'approved','v02_refinement':'proceeded_to_rig_on_user_request','v03_animations':'awaiting_visual_review','integration':'not_in_game'},
      'base_glb':str(BASE_GLB.name),'base_glb_sha256':base_hash,
      'glb':OUTPUT.name,'sha256':hashlib.sha256(out).hexdigest(),'bytes':len(out),
      'triangles':6576,'vertices':len(pos),'meshes':1,'materials':1,'texture_resolution':[2048,2048],
      'skins':1,'joint_count':len(JOINTS),'joint_names':JNAMES,
      'animation_count':len(SPECS),
      'clips':[{'name':name,'duration_s':dur,'keyframes':frames+1,'loop':loop,'channels':len(JOINTS)+1} for name,(dur,frames,loop) in SPECS.items()],
      'geometry_uv_topology_identical_to_v02':True,'embedded_albedo_byte_identical_to_v02':True,
      'color_patches_extra_meshes':0,'rig_type':'genuine glTF weighted skin (JOINTS_0/WEIGHTS_0 + inverse bind matrices)',
      'lods_created':0,'gameplay_integration':'not_started'
    }
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in m.items() if k not in ('clips','joint_names')},indent=2,ensure_ascii=False))

if __name__=='__main__':main()
