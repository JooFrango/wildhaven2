import * as THREE from "three";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {createRocantraz,animationClips,bones,meshStats,ECOLOGY,VARIANTS,ANIMATIONS}
  from "./rocantraz.mjs";

class NodeFileReader {
 result=null;onloadend=null;onerror=null;
 readAsArrayBuffer(blob){
  blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.()})
  .catch(e=>this.onerror?.(e));
 }
 readAsDataURL(blob){
  blob.arrayBuffer().then(b=>{
   this.result="data:"+(blob.type||"application/octet-stream")+";base64,"+
    Buffer.from(b).toString("base64");
   this.onloadend?.();
  }).catch(e=>this.onerror?.(e));
 }
}
globalThis.FileReader=NodeFileReader;
const out=path.resolve("dist");fs.mkdirSync(out,{recursive:true});
const all={revision:"v03",species:"rocantraz",locomotion:"strictly_bipedal",
 variants:{},ecology:ECOLOGY,gameplayIntegration:false};
for(const variant of VARIANTS){
 const model=createRocantraz(variant),stats=meshStats(model),
  clips=animationClips(model),joints=bones(model).map(x=>x.name);
 delete model.userData.rig;delete model.userData.species;delete model.userData.variant;
 const bytes=await new Promise((resolve,reject)=>{
  new GLTFExporter().parse(model,
   b=>b instanceof ArrayBuffer?resolve(b):reject(Error("Exporter did not return a binary GLB")),
   reject,{binary:true,trs:true,animations:clips,onlyVisible:true});
 });
 const dv=new DataView(bytes);
 if(dv.getUint32(0,true)!==0x46546c67||
    dv.getUint32(4,true)!==2||
    dv.getUint32(8,true)!==bytes.byteLength||
    dv.getUint32(16,true)!==0x4e4f534a)
   throw Error("Invalid glTF 2.0 header for "+variant);
 const gltf=JSON.parse(new TextDecoder().decode(
   new Uint8Array(bytes,20,dv.getUint32(12,true))));
 const anims=gltf.animations.map(x=>x.name);
 if(anims.length!==12||ANIMATIONS.some(x=>!anims.includes(x)))
   throw Error("Missing real 3D animation channels for "+variant);
 if(gltf.animations.some(x=>x.channels.length<45))
   throw Error("Missing articulated joint animation channels");
 const nodes=gltf.nodes.filter(x=>x.mesh!==undefined).length;
 if(nodes<100||stats.triangles<35000||joints.length<20)
   throw Error("Geometry / rig insufficient: "+JSON.stringify({stats,nodes}));
 const name="rocantraz-"+variant+"-biped-animated-v03.glb",buf=Buffer.from(bytes);
 fs.writeFileSync(path.join(out,name),buf);
 all.variants[variant]={
  ...stats,model:name,byteSize:buf.byteLength,glbMeshNodes:nodes,
  glbMeshDefinitions:gltf.meshes.length,
  sha256:crypto.createHash("sha256").update(buf).digest("hex"),
  clips:anims,channelsPerClip:gltf.animations.map(x=>x.channels.length),
  namedJoints:joints,
  rig:"hierarchical transform pivots; not skinned/weighted deformation",
  preview:"true WebGL geometry screenshots of same model"
 };
 console.log("REAL ANIMATED ROCANTRAZ GLB",variant,
  JSON.stringify({stats,bytes:buf.length,anims}));
}
fs.writeFileSync(path.join(out,"rocantraz-biped-manifest-v03.json"),
 JSON.stringify(all,null,2)+"\n");
