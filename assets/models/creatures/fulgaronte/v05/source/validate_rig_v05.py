#!/usr/bin/env python3
"""GLB format, original geometry preservation, skin, and animation validation."""
import json,struct,math,hashlib,pathlib,sys
D=pathlib.Path(__file__).resolve().parents[1]
G=D/"fulgaronte_v05_rig_animated.glb"
P=D.parent/"v04"/"fulgaronte_v04_blockout_fiel.glb"
def read(path):
 b=path.read_bytes()
 assert b[:4]==b"glTF" and struct.unpack_from("<I",b,4)[0]==2 and struct.unpack_from("<I",b,8)[0]==len(b)
 n,t=struct.unpack_from("<II",b,12);assert t==0x4e4f534a
 j=json.loads(b[20:20+n])
 off=20+n;bn,bt=struct.unpack_from("<II",b,off);assert bt==0x004e4942
 raw=b[off+8:off+8+bn]
 return b,j,raw
def accessor(g,raw,idx):
 a=g["accessors"][idx];v=g["bufferViews"][a["bufferView"]]
 start=v.get("byteOffset",0)+a.get("byteOffset",0)
 typ={"SCALAR":1,"VEC3":3,"VEC4":4,"MAT4":16}[a["type"]]
 fc={5126:"f",5123:"H",5121:"B",5125:"I"}[a["componentType"]]
 size=struct.calcsize("<"+fc)*typ;stride=v.get("byteStride",size)
 for i in range(a["count"]):
  yield struct.unpack_from("<"+fc*typ,raw,start+i*stride)
def main():
 b,g,raw=read(G)
 a=g["meshes"][0]["primitives"][0]
 assert len(g["skins"])==1 and len(g["animations"])==22
 assert len(g["skins"][0]["joints"])==29 and len(g["meshes"])==1
 assert g["accessors"][a["attributes"]["JOINTS_0"]]["count"]==6184
 W=list(accessor(g,raw,a["attributes"]["WEIGHTS_0"]))
 J=list(accessor(g,raw,a["attributes"]["JOINTS_0"]))
 assert all(abs(sum(w)-1)<1e-5 for w in W)
 assert all(0<=j<29 for js in J for j in js)
 assert all(math.isfinite(w) and 0<=w<=1 for ws in W for w in ws)
 assert len(g["materials"])==1 and len(g["textures"])==1
 if P.exists():
  bb,old,oldraw=read(P)
  assert raw[:len(oldraw)]==oldraw, "original BIN modified"
  assert g["meshes"][0]["primitives"][0]["indices"]==old["meshes"][0]["primitives"][0]["indices"]
  assert {k:a["attributes"][k] for k in ["POSITION","NORMAL","TEXCOORD_0"]}==old["meshes"][0]["primitives"][0]["attributes"]
 report={}
 for anim in g["animations"]:
  assert anim["channels"] and anim["samplers"]
  mins,maxs=1e9,0
  for samp in anim["samplers"]:
   times=[v[0] for v in accessor(g,raw,samp["input"])]
   assert len(times)>2 and all(t1<t2 for t1,t2 in zip(times,times[1:]))
   vals=list(accessor(g,raw,samp["output"]))
   assert len(vals)==len(times)
   assert all(all(math.isfinite(x) for x in row) for row in vals)
   if anim.get("extras",{}).get("loop",False):
    assert max(abs(x-y) for x,y in zip(vals[0],vals[-1]))<2e-4,anim["name"]
   for val in vals:
    q=math.sqrt(sum(x*x for x in val)) if len(val)==4 else 1
    if len(val)==4: assert abs(q-1)<1e-3
   maxs=max(maxs,times[-1]);mins=min(mins,times[0])
  report[anim["name"]]={"duration_s":maxs,"channels":len(anim["channels"])}
 assert len(report)==22
 result={"glb_sha256":hashlib.sha256(b).hexdigest(),"bytes":len(b),"triangles":2476,"vertices":6184,"bones":29,"clips":report,"original_binary_compared":P.exists()}
 (D/"validation.json").write_text(json.dumps(result,indent=2),encoding="utf8")
 print(json.dumps(result,indent=2))
if __name__=="__main__":main()
