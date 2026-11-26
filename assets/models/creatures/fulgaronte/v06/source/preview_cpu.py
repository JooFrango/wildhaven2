#!/usr/bin/env python3
"""Render actual deformed glTF skin vertices to animated GIFs, CPU-only.
No AI-generated render or simulated placeholder. This is a preview, not game playback.
"""
import bisect, io, json, math, pathlib, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parents[1]
GLB = ROOT / "fulgaronte_v06_motion_review.glb"
b = GLB.read_bytes()
n = struct.unpack_from("<I", b, 12)[0]
g = json.loads(b[20:20+n])
raw = b[20+n+8:20+n+8+g["buffers"][0]["byteLength"]]
def arr(ai):
 a=g["accessors"][ai]; v=g["bufferViews"][a["bufferView"]]
 m={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}[a["type"]]
 fmt={5126:"f",5121:"B",5123:"H",5125:"I"}[a["componentType"]]
 width=struct.calcsize("<"+fmt)*m
 stride=v.get("byteStride",width)
 off=v.get("byteOffset",0)+a.get("byteOffset",0)
 return np.array([struct.unpack_from("<"+fmt*m,raw,off+i*stride) for i in range(a["count"])],dtype=np.float64)
P=g["meshes"][0]["primitives"][0]
verts=arr(P["attributes"]["POSITION"])
uv=arr(P["attributes"]["TEXCOORD_0"])
tri=arr(P["indices"]).astype(np.int32).ravel().reshape((-1,3))
joint_idx=arr(P["attributes"]["JOINTS_0"]).astype(np.int32)
weights=arr(P["attributes"]["WEIGHTS_0"])
skin=g["skins"][0]
joints=skin["joints"]
inverse=np.array([a.reshape((4,4),order="F") for a in arr(skin["inverseBindMatrices"])])
parents={}
for i,node in enumerate(g["nodes"]):
 for ch in node.get("children",[]):parents[ch]=i
tex=None
try:
 image=g["images"][0]
 if "bufferView" in image:
  bv=g["bufferViews"][image["bufferView"]]
  tex=Image.open(io.BytesIO(raw[bv.get("byteOffset",0):bv.get("byteOffset",0)+bv["byteLength"]])).convert("RGB")
except Exception as ex:
 print("WARNING: texture sampling fallback",repr(ex))
quats={}
def sample(a,t):
 sam=a["samplers"]; poses={}
 for ch in a["channels"]:
  sp=sam[ch["sampler"]];tt=arr(sp["input"]).ravel(); vv=arr(sp["output"])
  j=min(max(0,bisect.bisect_right(tt,t)-1),len(tt)-2)
  k=float(np.clip((t-tt[j])/(tt[j+1]-tt[j]),0,1))
  val=(1-k)*vv[j]+k*vv[j+1]
  if ch["target"]["path"]=="rotation":
   val/=np.linalg.norm(val)
  poses[(ch["target"]["node"],ch["target"]["path"])]=val
 return poses
def qmatrix(q):
 x,y,z,w=q; return np.array([
 [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],
 [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],
 [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],
 [0,0,0,1]],dtype=float)
def bake(anim,t):
 pose=sample(anim,t); cache={}
 def world(i):
  if i in cache:return cache[i]
  nd=g["nodes"][i]
  tr=pose.get((i,"translation"),nd.get("translation",[0,0,0]))
  rot=pose.get((i,"rotation"),nd.get("rotation",[0,0,0,1]))
  M=qmatrix(rot);M[:3,3]=tr
  if i in parents:M=world(parents[i])@M
  cache[i]=M
  return M
 mats=np.stack([world(i)@inverse[k] for k,i in enumerate(joints)])
 vecs=np.column_stack((verts,np.ones(len(verts))))
 res=np.zeros((len(verts),4))
 for k in range(4):
  res+=weights[:,k,None]*np.einsum("nij,nj->ni",mats[joint_idx[:,k]],vecs)
 return res[:,:3]
# Fixed orthographic cameras matched across all frames.
W,H=880,510
bg=(220,229,233);light=np.array([-.2,.72,.9]);light/=np.linalg.norm(light)
def render(pose,name,frame_idx):
 result=Image.new("RGB",(W,H),bg);draw=ImageDraw.Draw(result)
 # side camera (+z), image horizontal = world +x
 sx=(pose[:,0]+9.5)/18.0*(W-90)+38
 sy=(7.2-pose[:,1])/7.6*(H-85)+30
 zz=pose[:,2]
 depth=np.mean(zz[tri],axis=1)
 order=np.argsort(depth)
 polys=np.stack((sx,sy),axis=1)
 for ti in order:
  ix=tri[ti];p0,p1,p2=pose[ix];normal=np.cross(p1-p0,p2-p0)
  norm=np.linalg.norm(normal)
  if norm<1e-7:continue
  normal/=norm
  intensity=.66+.34*max(0,np.dot(normal,light))
  if tex:
   t=np.mean(uv[ix],axis=0);cx=int((t[0]%1)*(tex.width-1));cy=int((1-(t[1]%1))*(tex.height-1))
   color=tex.getpixel((cx,cy))
  else:color=(136,128,111)
  c=tuple(max(0,min(255,int(v*intensity))) for v in color)
  xy=[tuple(polys[k]) for k in ix]
  draw.polygon(xy,fill=c)
 draw.rectangle((12,8,W-12,31),fill=(36,42,49))
 draw.text((20,14),"FULGARONTE V06 / "+name+" / GLB REAL - CPU SKIN",fill=(243,246,245))
 draw.text((20,H-28),"Previas tecnicas, sem IK, colisao ou VFX de eletricidade.",fill=(46,55,64))
 return result
OUT=ROOT/"previews";OUT.mkdir(exist_ok=True)
names=["heavy_walk","charge","swim","bite_heavy","tail_sweep","overload_warning","overload_burst","overload_recovery"]
for name in names:
 a=next(a for a in g["animations"] if a["name"]==name)
 duration=float(arr(a["samplers"][0]["input"])[-1][0])
 frames=[]
 for i in range(14):
  t=(i/14)*duration if a.get("extras",{}).get("loop") else (i/13)*duration
  frames.append(render(bake(a,t),name,i))
 out=OUT/(name+".gif")
 frames[0].save(out,save_all=True,append_images=frames[1:],duration=165,loop=0,optimize=True)
 print("PREVIEW",out.name,out.stat().st_size)
# Static study of three samples, all from the real exported GLB
a=next(a for a in g["animations"] if a["name"]=="overload_burst")
samples=[render(bake(a,float(arr(a["samplers"][0]["input"])[-1][0])*t),"overload_burst",0) for t in (0,.43,.78)]
sheet=Image.new("RGB",(W*3,H),bg)
for i,im in enumerate(samples):sheet.paste(im,(i*W,0))
sheet.save(OUT/"overload_real_3_poses.png")
print("RENDERED",len(names),"gifs + pose sheet",sheet.size)
