#!/usr/bin/env python3
"""Independent audit of cinematic GLB vs source Claude v04."""
import hashlib,json,math,pathlib,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
OLD=ROOT.parent/"v04"/"fulgaronte_v04_animado.glb"
NEW=ROOT/"fulgaronte_v07_cinematic_claude36.glb"
def read(p):
 b=p.read_bytes()
 assert b[:4]==b"glTF" and struct.unpack_from("<II",b,4)==(2,len(b))
 n,t=struct.unpack_from("<II",b,12); assert t==0x4e4f534a
 g=json.loads(b[20:20+n]);off=20+n
 bl,bt=struct.unpack_from("<II",b,off);assert bt==0x004e4942
 return b,g,b[off+8:off+8+bl]
def rows(g,b,i):
 a=g["accessors"][i];v=g["bufferViews"][a["bufferView"]]
 pos=v.get("byteOffset",0)+a.get("byteOffset",0)
 n={"SCALAR":1,"VEC3":3,"VEC4":4,"MAT4":16}[a["type"]]
 fmt={5126:"f",5123:"H",5125:"I",5121:"B"}[a["componentType"]]
 w=struct.calcsize("<"+fmt)*n;step=v.get("byteStride",w)
 return [struct.unpack_from("<"+fmt*n,b,pos+k*step) for k in range(a["count"])]
def main():
 a,g,ab=read(OLD);n,h,nb=read(NEW)
 assert hashlib.sha256(a).hexdigest()=="59a9eb8d456fcfd2ea031c3ec8aae0409e64445638ef2b62849c3371eb6274b1"
 assert len(h["skins"])==len(g["skins"])==1
 assert len(h["skins"][0]["joints"])==36
 assert ab==nb[:len(ab)]
 assert len(h["animations"])==24
 assert h["animations"][:9]==g["animations"]
 for key in ("meshes","nodes","skins","materials","textures","images","samplers","scenes"):
  assert h.get(key)==g.get(key),key
 assert h["meshes"][0]["primitives"]==g["meshes"][0]["primitives"]
 report=[]
 for anim in h["animations"][9:]:
  assert anim["name"].startswith("cin_")
  assert len(anim["channels"])>=9,(anim["name"],len(anim["channels"]))
  frames=0;duration=0
  for s in anim["samplers"]:
   times=[x[0] for x in rows(h,nb,s["input"])]
   vals=rows(h,nb,s["output"])
   assert len(times)==len(vals) and len(times)>20
   assert all(times[i+1]>times[i] for i in range(len(times)-1))
   assert all(all(math.isfinite(v) for v in row) for row in vals)
   if len(vals[0])==4:
    assert all(abs(sum(v*v for v in row)-1)<2e-3 for row in vals)
   if anim.get("extras",{}).get("loop"):
    assert max(abs(x-y) for x,y in zip(vals[0],vals[-1]))<2e-3,anim["name"]
   frames=max(frames,len(vals));duration=max(duration,times[-1])
  report.append({"name":anim["name"],"channels":len(anim["channels"]),"frames":frames,"seconds":round(duration,3)})
 result={"source_sha256":hashlib.sha256(a).hexdigest(),
         "glb_sha256":hashlib.sha256(n).hexdigest(),"bytes":len(n),
         "original_clips":9,"cinematic_clips":len(report),
         "total_animations":len(h["animations"]),"bones":36,
         "original_mesh_uv_texture_skin_bin_preserved":True,
         "new_clips":report,"review_status":"awaiting_director_qa"}
 (ROOT/"validation.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
 print("CINEMATIC_GLTF_AUDIT_PASS",json.dumps(result),flush=True)
if __name__=="__main__":main()
