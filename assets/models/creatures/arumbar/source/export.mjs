import * as THREE from "three";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import {createArumbar,arumbarClips,ANIMATIONS,DESIGN,arumbarBones} from "./arumbar.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

class NodeFileReader{
  result=null;onloadend=null;onerror=null;
  readAsArrayBuffer(blob){
    blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.()})
      .catch(e=>this.onerror?.(e));
  }
  readAsDataURL(blob){
    blob.arrayBuffer().then(b=>{
      this.result="data:"+(blob.type||"application/octet-stream")+
        ";base64,"+Buffer.from(b).toString("base64");
      this.onloadend?.();
    }).catch(e=>this.onerror?.(e));
  }
}
globalThis.FileReader=NodeFileReader;
function glbInfo(data){
  const d=new DataView(data);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2)
    throw Error("Invalid GLB 2.0");
  if(d.getUint32(8,true)!==data.byteLength||d.getUint32(16,true)!==0x4e4f534a)
    throw Error("Invalid GLB header/chunks");
  const n=d.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,n)));
  const names=(json.animations||[]).map(a=>a.name);
  if(names.length!==8||ANIMATIONS.some(a=>!names.includes(a)))
    throw Error("Arumbar GLB missing clips: "+names);
  const meshNodes=json.nodes.filter(n=>n.mesh!==undefined).length;
  if(meshNodes<150)throw Error("Insufficient 3D detail: "+meshNodes+" mesh nodes");
  if(json.animations.some(a=>a.channels.length<28))
    throw Error("Arumbar GLB has a clip with too few joint tracks");
  return {meshInstances:meshNodes,meshDefinitions:json.meshes.length,
    nodes:json.nodes.length,animationNames:names,
    clips:json.animations.length,
    channelsPerClip:json.animations.map(a=>a.channels.length)};
}
async function main(){
  const root=createArumbar(),animations=arumbarClips(root);
  const joints=arumbarBones(root);
  root.updateMatrixWorld(true);
  delete root.userData.rig;
  delete root.userData.selectedAnimation;
  const bytes=await new Promise((ok,fail)=>{
    new GLTFExporter().parse(root,
      blob=>blob instanceof ArrayBuffer?ok(blob):fail(Error("Expected binary GLB")),
      fail,{binary:true,onlyVisible:true,trs:true,animations});
  });
  const info=glbInfo(bytes);
  const out=path.resolve("dist");
  fs.mkdirSync(out,{recursive:true});
  const file=path.join(out,"arumbar-savanna-animated-v01.glb");
  const buffer=Buffer.from(bytes);
  fs.writeFileSync(file,buffer);
  const stats={
    format:"glTF2-binary",version:"v0.1",creature:"arumbar",
    gameIntegrated:false,rig:"hierarchical transform pivots (no weighted skin)",
    source:"original Three.js procedural polygon meshes",
    bytes:buffer.length,sha256:crypto.createHash("sha256").update(buffer).digest("hex"),
    ...info,jointNames:joints.map(b=>b.name),ecology:DESIGN,
  };
  fs.writeFileSync(path.join(out,"arumbar-manifest-v01.json"),JSON.stringify(stats,null,2)+"\n");
  console.log(JSON.stringify({file,bytes:buffer.length,meshes:info.meshInstances,
    jointCount:joints.length,clips:info.animationNames},null,2));
}
main().catch(err=>{console.error(err);process.exitCode=1;});
