#!/usr/bin/env python3
"""Cinematic animation layer on EXACT Claude v04 animated GLB, CPU only.

Source: ../v04/fulgaronte_v04_animado.glb on PR #38.
The source GLB, 36-joint rig, weights, UVs, material, geometry and nine original
animations are preserved byte-for-byte as a prefix of its BIN, with glTF JSON
structures unchanged except for appended new animation/accessor/bufferView entries.
No changes to Alpha. This is animation choreography, not implemented electricity/physics/IK.
"""
import hashlib
import json
import math
import pathlib
import struct

ROOT=pathlib.Path(__file__).resolve().parents[1]
INPUT=ROOT.parent/"v04"/"fulgaronte_v04_animado.glb"
OUT=ROOT/"fulgaronte_v07_cinematic_claude36.glb"
FPS=30
PI=math.pi
TAU=2*PI

SPEC={
 "cin_breathing_look":(5.6,True),
 "cin_heavy_walk":(3.3,True),
 "cin_stalk_ambush":(4.2,True),
 "cin_charging_stride":(2.1,True),
 "cin_bite_lunge":(2.9,False),
 "cin_tail_whip":(3.2,False),
 "cin_territorial_roar":(4.4,False),
 "cin_predatory_swim":(3.6,True),
 "cin_electric_warning":(5.4,False),
 "cin_electric_burst":(2.7,False),
 "cin_overload_exhausted":(4.4,False),
 "cin_hit_recoil":(2.8,False),
 "cin_death_collapse":(5.0,False),
 "cin_feed_carcass":(4.1,False),
 "cin_track_target":(3.7,False),
}
def c01(v): return min(1.,max(0.,v))
def S(v):
 v=c01(v)
 return v*v*(3.-2.*v)
def curve(t,points):
 if t<=points[0][0]:return points[0][1]
 if t>=points[-1][0]:return points[-1][1]
 for (a,x),(b,y) in zip(points,points[1:]):
  if a<=t<=b:return x+(y-x)*S((t-a)/(b-a))
 return 0.
def pulse(t,center,half):
 x=1-abs(t-center)/half
 return S(x) if x>0 else 0.
def attack_ripple(t,delay=0):
 return curve(t-delay,[(0,0),(.12,0),(.28,.40),(.39,-.55),(.52,1),(.60,-.16),(.79,0),(1,0)])
def gauss(t,c,w):
 return math.exp(-((t-c)/w)**2)
def qmul(a,b):
 ax,ay,az,aw=a;bx,by,bz,bw=b
 return (aw*bx+ax*bw+ay*bz-az*by,
         aw*by-ax*bz+ay*bw+az*bx,
         aw*bz+ax*by-ay*bx+az*bw,
         aw*bw-ax*bx-ay*by-az*bz)
def qc(a):return (-a[0],-a[1],-a[2],a[3])
def qnormalize(a):
 n=math.sqrt(sum(x*x for x in a))
 return tuple(x/n for x in a)
def qaxis(axis,ang):
 s=math.sin(ang*.5)
 return (axis[0]*s,axis[1]*s,axis[2]*s,math.cos(ang*.5))
def qworld(pitch=0,yaw=0,roll=0):
 # glTF Y-up: X front, Y up, Z side. Pitch about world Z,
 # yaw about world Y, axial roll about X; no local rest-bone guesswork.
 return qnormalize(qmul(qmul(qaxis((0,1,0),yaw),qaxis((0,0,1),pitch)),qaxis((1,0,0),roll)))
def get_gltf(p):
 data=p.read_bytes()
 if data[:4]!=b"glTF" or struct.unpack_from("<I",data,4)[0]!=2 or struct.unpack_from("<I",data,8)[0]!=len(data):
  raise AssertionError("invalid GLB: "+str(p))
 length,kind=struct.unpack_from("<II",data,12)
 if kind!=0x4E4F534A:raise AssertionError("missing JSON chunk")
 j=json.loads(data[20:20+length])
 offset=20+length
 binary_len,binary_kind=struct.unpack_from("<II",data,offset)
 if binary_kind!=0x004E4942:raise AssertionError("missing BIN chunk")
 binary=data[offset+8:offset+8+binary_len]
 return data,j,bytearray(binary)
def pack_glb(g,b):
 while len(b)%4:b.append(0)
 g["buffers"][0]["byteLength"]=len(b)
 text=json.dumps(g,ensure_ascii=False,separators=(",",":")).encode("utf8")
 text+=b" "*((-len(text))%4)
 size=12+8+len(text)+8+len(b)
 return b"glTF"+struct.pack("<II",2,size)+struct.pack("<II",len(text),0x4e4f534a)+text+struct.pack("<II",len(b),0x004e4942)+bytes(b)
def attach_accessor(g,b,rows,type_,mini=None,maxi=None):
 components={"SCALAR":1,"VEC3":3,"VEC4":4}[type_]
 if any(len(row)!=components for row in rows):raise AssertionError("bad output components")
 while len(b)%4:b.append(0)
 start=len(b)
 for row in rows:
  b.extend(struct.pack("<"+"f"*components,*row))
 view=len(g["bufferViews"])
 g["bufferViews"].append({"buffer":0,"byteOffset":start,"byteLength":len(rows)*components*4})
 access=len(g["accessors"])
 a={"bufferView":view,"componentType":5126,"count":len(rows),"type":type_}
 if mini is not None:a["min"]=mini
 if maxi is not None:a["max"]=maxi
 g["accessors"].append(a)
 return access

def gait(u,phase,stance=.69):
 p=(u+phase)%1
 if p<stance:
  # foot supports body for 69% of the cycle; drag reduced by slow ankle follow-through.
  d=.5-p/stance
  k=0
 else:
  s=(p-stance)/(1-stance)
  d=-.5+S(s)
  k=math.sin(PI*s)**1.6
 return d,k
def anim_angles(clip,b,u):
 """return pitch-yaw-roll in world-related axes, plus root x/y/z translation."""
 s=math.sin;cos=math.cos
 yaw=pitch=roll=0.0
 tr=(0.,0.,0.)
 p=TAU*u
 tail_index=(int(b[-1]) if b.startswith("tail") and b[-1].isdigit() else -1)
 is_leg=b.startswith(("upperarm_","forearm_","hand_","thigh_","shin_","foot_"))
 side=1 if b.endswith("_L") else -1
 is_front=b.startswith(("upperarm_","forearm_","hand_"))
 phases={"upperarm_L":0,"forearm_L":0,"hand_L":0,
         "thigh_R":.25,"shin_R":.25,"foot_R":.25,
         "upperarm_R":.50,"forearm_R":.50,"hand_R":.50,
         "thigh_L":.75,"shin_L":.75,"foot_L":.75}
 phase=phases.get(b,0)
 def body_sway(amount=1):
  nonlocal pitch,yaw,roll
  if b in ("hips","spine1","spine2","chest"):
   i={"hips":0,"spine1":1,"spine2":2,"chest":3}[b]
   yaw+=amount*.026*s(p-i*.30)
   roll+=amount*.014*s(2*p-i*.23)
  elif b in ("neck1","neck2","head"):
   i={"neck1":0,"neck2":1,"head":2}[b]
   pitch+=amount*.023*s(2*p-i*.35)
   yaw+=amount*.032*s(p-i*.38)
  elif tail_index>0:
   yaw+=amount*(.05+.019*tail_index)*s(p-tail_index*.40)
 if clip=="cin_breathing_look":
  breath=(s(p)+.28*s(2*p+.3))*.5
  if b=="chest":pitch=.031*breath
  if b=="spine2":pitch=.02*breath
  if b=="hips":roll=.012*breath
  if b=="neck1":pitch=-.023*breath
  if b=="neck2":pitch=-.012*breath
  if b=="head":yaw=.10*s(p);pitch=-.045*s(p+.3)
  if b=="jaw":pitch=.031*max(0,s(p-.6))
  if tail_index>0:yaw=(.035+.012*tail_index)*s(p-.22*tail_index)
  if b.startswith("armfin_"):roll=.035*side*s(p+.8)
  if b.startswith("sail"):roll=.014*s(p+({"sail1":0,"sail2":1,"sail3":2}[b])*.7)
  if b=="root":tr=(0,.018*(breath+.3),0)
 if clip in ("cin_heavy_walk","cin_stalk_ambush","cin_charging_stride"):
  stalking=clip=="cin_stalk_ambush"
  charging=clip=="cin_charging_stride"
  intensity=1.75 if charging else (.55 if stalking else 1)
  if is_leg:
   d,k=gait(u,phase,.57 if charging else (.75 if stalking else .69))
   if b.startswith(("upperarm_","thigh_")):pitch=intensity*(.28*d-.045*k)
   if b.startswith(("forearm_","shin_")):pitch=intensity*(.18*d+.36*k)
   if b.startswith(("hand_","foot_")):pitch=intensity*(-.19*d-.14*k)
  body_sway(intensity*(.55 if stalking else 1))
  if b=="root":
   drop=-.15 if stalking else (-.04 if charging else -.02)
   tr=(.012*s(2*p),drop+(0.085 if charging else .035)*(.5+.5*cos(4*p+.2)),0)
  if stalking:
   if b in ("chest","neck1"):pitch+=.055
   if b=="head":pitch+=.075
   if b=="jaw":pitch=.018*max(0,s(p))
  if charging:
   if b=="chest":pitch-=.050
   if b=="head":pitch-=.075
   if b in ("sail1","sail2","sail3"):roll+=.045*s(p)
  if b.startswith("armfin_"):roll=side*(.018+.035*s(p+.6))
 if clip=="cin_bite_lunge":
  pre=curve(u,[(0,0),(.12,.05),(.25,1),(.34,1),(.43,0),(.76,0),(1,0)])
  launch=curve(u,[(0,0),(.34,0),(.45,.45),(.55,1),(.61,.58),(.78,.1),(1,0)])
  gape=curve(u,[(0,0),(.17,.15),(.28,.90),(.46,1),(.55,.96),(.61,0),(.70,0),(.79,.24),(1,0)])
  shake=curve(u,[(0,0),(.62,0),(.68,.7),(.74,-1),(.8,.6),(.91,0),(1,0)])
  if b=="root":tr=(-.18*pre+.25*launch,-.065*launch,0)
  if b=="hips":pitch=-.034*pre+.052*launch
  if b in ("spine1","spine2"):pitch=.03*pre-.045*launch
  if b=="chest":pitch=.10*pre-.14*launch
  if b=="neck1":pitch=.10*pre-.19*launch
  if b=="neck2":pitch=.15*pre-.23*launch
  if b=="head":pitch=.14*pre-.27*launch;yaw=.13*shake
  if b=="jaw":pitch=-.62*gape
  if b.startswith(("upperarm_","thigh_")):pitch=-.04*pre+.06*launch
  if tail_index>0:yaw=(.06+.015*tail_index)*(launch-pre)*s(.5*tail_index)
  if b.startswith("sail"):roll=.045*launch
 if clip=="cin_tail_whip":
  brace=curve(u,[(0,0),(.17,.25),(.33,1),(.41,1),(.48,.15),(.7,0),(1,0)])
  twist=curve(u,[(0,0),(.35,0),(.44,.2),(.57,1),(.63,-.28),(.76,.19),(.93,0),(1,0)])
  if b=="root":tr=(0,-.065*twist,0)
  if b=="hips":yaw=.16*brace-.20*twist;roll=.06*brace
  if b in ("spine1","spine2","chest"):yaw=-.08*brace+.08*twist
  if b in ("neck1","neck2","head"):yaw=-.12*brace+.09*twist
  if tail_index>0:
   t=max(0,u-.028*tail_index)
   tip=curve(t,[(0,0),(.30,-.35),(.43,-.68),(.55,.95),(.64,-.3),(.79,.15),(.98,0),(1,0)])
   yaw=(.1+.16*tail_index)*tip
   pitch=(.02+.02*tail_index)*s(PI*u)**2
  if b.startswith(("upperarm_","thigh_")):roll=.04*side*brace
  if b.startswith("armfin_"):roll=.07*side*twist
 if clip=="cin_territorial_roar":
  inhale=curve(u,[(0,0),(.14,.15),(.30,1),(.40,.8),(.50,.4),(.71,0),(1,0)])
  roar=curve(u,[(0,0),(.28,.1),(.41,.95),(.57,1),(.69,.8),(.81,.1),(1,0)])
  flap=s(PI*2*u*3)*roar
  if b=="root":tr=(0,.09*roar-.06*inhale,0)
  if b=="hips":pitch=-.05*inhale
  if b=="spine2":pitch=-.08*roar
  if b=="chest":pitch=-.13*roar-.055*inhale
  if b=="neck1":pitch=-.14*roar
  if b=="neck2":pitch=-.17*roar
  if b=="head":pitch=-.24*roar+.02*flap;yaw=.025*flap
  if b=="jaw":pitch=-.58*roar
  if tail_index>0:yaw=(.024+.007*tail_index)*flap
  if b.startswith("sail"):roll=.06*roar+.016*flap
  if b.startswith("armfin_"):roll=.10*side*roar
 if clip=="cin_predatory_swim":
  if b in ("hips","spine1","spine2","chest","neck1","neck2","head"):
   i={"hips":0,"spine1":1,"spine2":2,"chest":3,"neck1":4,"neck2":5,"head":6}[b]
   yaw=(.045+.011*(6-i))*s(p+i*.35)
   pitch=.018*s(p+i*.42+.2)
  if tail_index>0:yaw=(.09+.056*tail_index)*s(p-tail_index*.50)
  if b.startswith(("upperarm_","thigh_")):pitch=.16*s(p+(0 if side==1 else PI))
  if b.startswith(("forearm_","shin_")):pitch=.11*s(p+1.1+(0 if side==1 else PI))
  if b.startswith("armfin_"):roll=side*(.14+.12*s(p+.9))
  if b.startswith("sail"):roll=.032*s(p+.6)
  if b=="root":tr=(0,.065*s(p),0)
 if clip=="cin_electric_warning":
  charge=curve(u,[(0,0),(.20,.12),(.42,.36),(.70,.82),(.92,1),(1,0)])
  beats=.38*gauss(u,.26,.05)+.58*gauss(u,.50,.06)+.94*gauss(u,.72,.045)+1.2*gauss(u,.88,.034)
  tremor=beats*s(36*PI*u)
  if b=="root":tr=(0,-.11*charge+.042*beats,0)
  if b=="hips":roll=.028*tremor
  if b=="spine2":pitch=-.07*charge+.034*tremor
  if b=="chest":pitch=-.09*charge+.05*beats
  if b in ("neck1","neck2"):pitch=-.12*charge+.038*beats
  if b=="head":pitch=-.09*charge+.056*tremor;yaw=.038*tremor
  if b=="jaw":pitch=-.17*charge
  if tail_index>0:yaw=(.035+.032*tail_index)*s(8*PI*u-tail_index*.27)*charge
  if b.startswith("sail"):pitch=-.16*charge+.03*beats;roll=.036*tremor
  if b.startswith("armfin_"):roll=.18*side*charge+.045*tremor
  if b.startswith(("upperarm_","thigh_")):pitch=-.055*charge
 if clip=="cin_electric_burst":
  crouch=curve(u,[(0,0),(.14,.25),(.30,1),(.43,1),(.52,0),(.75,0),(1,0)])
  blast=curve(u,[(0,0),(.42,0),(.51,.15),(.56,1),(.65,.35),(.77,0),(1,0)])
  after=curve(u,[(0,0),(.60,0),(.69,1),(.82,.54),(1,0)])
  if b=="root":tr=(-.17*blast,-.20*crouch+.24*blast-.14*after,0)
  if b=="hips":pitch=.06*crouch-.14*blast
  if b=="spine2":pitch=.08*crouch-.16*blast
  if b=="chest":pitch=.13*crouch-.25*blast+.08*after
  if b in ("neck1","neck2"):pitch=.09*crouch-.26*blast+.13*after
  if b=="head":pitch=.06*crouch-.33*blast+.18*after
  if b=="jaw":pitch=-.49*blast-.1*after
  if tail_index>0:yaw=(.055+.038*tail_index)*s(PI*u*2-tail_index*.3)*blast
  if b.startswith(("upperarm_","thigh_")):pitch=-.075*crouch+.16*blast
  if b.startswith(("forearm_","shin_")):pitch=.09*crouch-.13*blast
  if b.startswith("sail"):pitch=-.28*blast;roll=.09*blast
  if b.startswith("armfin_"):roll=.39*side*blast
 if clip=="cin_overload_exhausted":
  collapse=curve(u,[(0,1),(.24,1),(.46,.80),(.75,.28),(1,0)])
  after=s(2*PI*u*4.1)*math.exp(-u*2.8)
  if b=="root":tr=(0,-.25*collapse,0)
  if b=="hips":roll=.025*after
  if b=="spine2":pitch=.09*collapse
  if b=="chest":pitch=.15*collapse
  if b in ("neck1","neck2"):pitch=.19*collapse
  if b=="head":pitch=.21*collapse+.06*after
  if b=="jaw":pitch=-.07*collapse
  if tail_index>0:yaw=(.03+.018*tail_index)*after
  if b.startswith("sail"):pitch=.07*collapse
  if b.startswith(("upperarm_","thigh_")):pitch=.045*collapse
 if clip=="cin_hit_recoil":
  hit=pulse(u,.27,.17)
  bounce=curve(u,[(0,0),(.25,0),(.32,-.70),(.46,1),(.61,-.22),(.8,0),(1,0)])
  if b=="root":tr=(-.13*hit,-.045*hit,0)
  if b=="hips":yaw=-.17*hit+.08*bounce;roll=.09*hit
  if b in ("spine1","spine2","chest"):pitch=.07*hit-.03*bounce;yaw=.10*hit
  if b in ("neck1","neck2"):pitch=.17*hit-.09*bounce;yaw=.16*hit
  if b=="head":pitch=.25*hit-.14*bounce;yaw=.26*hit-.09*bounce
  if b=="jaw":pitch=-.18*hit
  if tail_index>0:yaw=(.03+.032*tail_index)*bounce
 if clip=="cin_death_collapse":
  stagger=curve(u,[(0,0),(.12,.2),(.32,.65),(.44,1),(.64,.5),(1,0)])
  fall=curve(u,[(0,0),(.33,0),(.58,.35),(.70,1),(.88,1),(1,1)])
  if b=="root":tr=(-.07*stagger,-.66*fall,0);roll=.52*fall
  if b=="hips":pitch=.15*fall;yaw=.04*stagger
  if b=="chest":pitch=.20*fall
  if b in ("neck1","neck2"):pitch=.20*fall-.09*stagger
  if b=="head":pitch=.23*fall-.12*stagger
  if b=="jaw":pitch=-.10*fall
  if tail_index>0:yaw=(.04+.022*tail_index)*s(2*PI*u)*fall
  if b.startswith(("upperarm_","thigh_")):pitch=-.30*fall
  if b.startswith(("forearm_","shin_")):pitch=.37*fall
 if clip=="cin_feed_carcass":
  down=curve(u,[(0,0),(.18,.35),(.32,1),(.76,1),(.94,.25),(1,0)])
  chew=gauss(u,.40,.08)+.82*gauss(u,.65,.09)
  if b=="root":tr=(0,-.06*down,0)
  if b=="chest":pitch=.11*down
  if b in ("neck1","neck2"):pitch=.18*down
  if b=="head":pitch=.15*down+.025*s(PI*12*u)*chew
  if b=="jaw":pitch=-.23*chew
  if tail_index>0:yaw=(.025+.011*tail_index)*s(PI*4*u)*down
 if clip=="cin_track_target":
  focus=curve(u,[(0,0),(.18,.22),(.43,.7),(.65,1),(.83,.5),(1,0)])
  look=curve(u,[(0,0),(.22,.45),(.45,1),(.68,-.35),(.87,0),(1,0)])
  if b=="head":yaw=.28*look;pitch=-.09*focus
  if b=="neck1":yaw=.07*look
  if b=="neck2":yaw=.14*look
  if b=="chest":yaw=.06*look
  if b=="jaw":pitch=-.055*focus
  if tail_index>0:yaw=-.045*focus*s(tail_index*.4)
  if b.startswith("sail"):pitch=-.06*focus
 # Return euler angles in radians
 return pitch,yaw,roll,tr

def main():
 data,g,b=get_gltf(INPUT)
 input_bytes=bytes(b)
 if hashlib.sha256(data).hexdigest()!="59a9eb8d456fcfd2ea031c3ec8aae0409e64445638ef2b62849c3371eb6274b1":
  raise AssertionError("Source SHA changed; inspect the new Claude asset before adding motion")
 if len(g.get("skins",[]))!=1 or len(g["skins"][0]["joints"])!=36:
  raise AssertionError("Expected Claude 36 bone rig")
 originals=[a["name"] for a in g.get("animations",[])]
 if len(originals)!=9 or "walk" not in originals or "electric_charge" not in originals:
  raise AssertionError("Source animations have changed "+str(originals))
 parents={}
 for i,n in enumerate(g["nodes"]):
  for child in n.get("children",[]):parents[child]=i
 base_rot={i:qnormalize(n.get("rotation",[0,0,0,1])) for i,n in enumerate(g["nodes"])}
 cache={}
 def global_rest(i):
  if i in cache:return cache[i]
  p=parents.get(i)
  rot=base_rot[i] if p is None else qmul(global_rest(p),base_rot[i])
  cache[i]=qnormalize(rot)
  return cache[i]
 names={}
 for i in g["skins"][0]["joints"]:
  name=g["nodes"][i].get("name",str(i))
  if name in names:raise AssertionError("duplicate bone name "+name)
  names[name]=i
 must={"root","hips","spine1","spine2","chest","neck1","neck2","head","jaw",
       *(f"tail{i}" for i in range(1,7)), "sail1","sail2","sail3",
       *(f"{a}_{side}" for a in ("upperarm","forearm","hand","armfin","thigh","shin","foot") for side in ("L","R"))}
 missing=must-set(names)
 if missing:raise AssertionError("Claude rig missing bones "+str(sorted(missing))+", has "+str(sorted(names)))
 joint_index=set(g["skins"][0]["joints"])
 print("EXACT_CLAUDE_RIG_BONES",len(names),sorted(names),flush=True)
 metadata=[]
 for clip,(duration,loop) in SPEC.items():
  frames=int(round(duration*FPS))+1
  times=[(duration*i/(frames-1),) for i in range(frames)]
  tin=attach_accessor(g,b,times,"SCALAR",[0],[duration])
  samplers=[];channels=[]
  for name,idx in names.items():
   baseline=base_rot[idx]
   parent=parents.get(idx)
   parent_rest=global_rest(parent) if parent is not None else (0,0,0,1)
   pp_inv=qc(parent_rest)
   outs=[];used=False
   for frame in range(frames):
    u=frame/(frames-1)
    pitch,yaw,roll,translation=anim_angles(clip,name,u)
    A=qworld(pitch,yaw,roll)
    local_q=qmul(qmul(pp_inv,A),qmul(parent_rest,baseline))
    local_q=qnormalize(local_q)
    outs.append(local_q)
    if (abs(pitch)+abs(yaw)+abs(roll))>0.00001:used=True
   if not used:continue
   aid=attach_accessor(g,b,outs,"VEC4")
   samplers.append({"input":tin,"output":aid,"interpolation":"LINEAR"})
   channels.append({"sampler":len(samplers)-1,"target":{"node":idx,"path":"rotation"}})
  ridx=names["root"]
  trans=[tuple(g["nodes"][ridx].get("translation",[0,0,0])[i]+anim_angles(clip,"root",frame/(frames-1))[3][i] for i in range(3)) for frame in range(frames)]
  if any(sum(abs(x-y) for x,y in zip(row,trans[0]))>.00001 for row in trans):
   aid=attach_accessor(g,b,trans,"VEC3")
   samplers.append({"input":tin,"output":aid,"interpolation":"LINEAR"})
   channels.append({"sampler":len(samplers)-1,"target":{"node":ridx,"path":"translation"}})
  if not channels:raise AssertionError("No channels in cinematic clip "+clip)
  a={"name":clip,"samplers":samplers,"channels":channels,
     "extras":{"loop":loop,"fps":FPS,"layer":"cinematic_skeletal",
               "root_motion":"in_place","requires_ik_for_ground_contact":True}}
  g["animations"].append(a)
  metadata.append({"clip":clip,"seconds":duration,"frames":frames,"channels":len(channels),"loop":loop})
 payload=pack_glb(g,b)
 OUT.write_bytes(payload)
 outdata,h,bt=get_gltf(OUT)
 assert outdata==payload
 assert len(h["animations"])==len(originals)+len(SPEC)
 assert [a["name"] for a in h["animations"][:len(originals)]]==originals
 assert bytes(bt[:len(input_bytes)])==input_bytes
 for k in ("meshes","nodes","skins","materials","textures","images","samplers","scenes"):
  assert h.get(k)==get_gltf(INPUT)[1].get(k),k
 assert h["animations"][:9]==get_gltf(INPUT)[1]["animations"]
 report={"species":"fulgaronte","version":"v07-cinematic","source":"v04/fulgaronte_v04_animado.glb",
         "source_sha256":hashlib.sha256(data).hexdigest(),"glb":OUT.name,
         "glb_sha256":hashlib.sha256(payload).hexdigest(),"bytes":len(payload),
         "triangles":2688,"joints":36,"original_clips":originals,
         "new_clips":metadata,"total_animations":len(h["animations"]),
         "geometry_skin_uv_material_preserved":True,"original_clips_preserved":True,
         "electric_vfx_implemented":False,"true_ik_implemented":False,
         "alpha_modified":False,"quality_status":"director_review_required"}
 (ROOT/"manifest.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
 print("VALIDATED_CINEMATIC_GLTF",report["glb_sha256"],"bytes",len(payload),
       "animation_count",report["total_animations"],"new",len(metadata),flush=True)

if __name__=="__main__":main()
