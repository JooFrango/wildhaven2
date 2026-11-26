import * as THREE from "three";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {ANIMATIONS,DESIGN_V02,createArumbarV02,arumbarClipsV02,
  arumbarBonesV02,arumbarV02Stats} from "./arumbar-highpoly-v02.mjs";

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
function validateGlb(data){
  const d=new DataView(data);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2)throw Error("Invalid binary glTF header");
  if(d.getUint32(8,true)!==data.byteLength||d.getUint32(16,true)!==0x4e4f534a)
    throw Error("GLB chunk header mismatch");
  const n=d.getUint32(12,true);
  const obj=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,n)));
  const actual=(obj.animations||[]).map(a=>a.name);
  if(actual.length!==8||ANIMATIONS.some(x=>!actual.includes(x)))
    throw Error("Missing v02 animation clips: "+actual);
  const inst=obj.nodes.filter(n=>n.mesh!==undefined).length;
  if(inst<250)throw Error("Expected detailed 3D mesh instancing, found "+inst);
  if(obj.animations.some(a=>a.channels.length<60))
    throw Error("Not enough articulated tracks in v02 clips");
  const faces=obj.meshes.reduce((sum,mesh)=>{
    for(const p of mesh.primitives){
      const acc=obj.accessors[p.indices];
      if(acc)sum+=acc.count/3;
    }
    return sum;
  },0);
  if(faces<55000)throw Error("Not a high-poly model: "+faces+" indexed triangles");
  return {meshInstances:inst,meshDefinitions:obj.meshes.length,
    trianglesInMeshDefinitions:Math.round(faces),
    joints:obj.nodes.filter(n=>n.name?.startsWith("Arumbar")).length,
    animations:actual,channelsPerClip:obj.animations.map(a=>a.channels.length)};
}
async function main(){
  const root=createArumbarV02();
  const built=arumbarV02Stats(root);
  const rig=arumbarBonesV02(root);
  const clipData=arumbarClipsV02(root);
  delete root.userData.rig;
  delete root.userData.selectedAnimation;
  delete root.userData.assetId;
  const buffer=await new Promise((resolve,reject)=>{
    new GLTFExporter().parse(root,
      value=>value instanceof ArrayBuffer?resolve(value):reject(Error("Expected .glb ArrayBuffer")),
      reject,{binary:true,onlyVisible:true,trs:true,animations:clipData});
  });
  const glb=validateGlb(buffer),data=Buffer.from(buffer);
  const out=path.resolve("dist-v02");
  fs.mkdirSync(out,{recursive:true});
  const fname="arumbar-savanna-highpoly-animated-v02.glb";
  fs.writeFileSync(path.join(out,fname),data);
  const manifest={
    name:"Arumbar",version:"v02",source:"original 3D surface lofts + high-poly sculpt",
    gameplayIntegrated:false,ecology:DESIGN_V02,
    geometry:built.geometry,hiddenLegacyMeshes:built.hiddenOriginalMeshes,
    jointCount:rig.length,secondaryJoints:built.secondaryJoints,
    glb:{...glb,bytes:data.length,
      sha256:crypto.createHash("sha256").update(data).digest("hex")},
    sourceFiles:["arumbar.mjs","arumbar-highpoly-v02.mjs","export-v02.mjs"],
    limitations:["rig is hierarchical rigid pivot animation, not a skinned/blended armature",
      "clips in place; no navigation / physical collision or terrain adaptation",
      "adult rarity and territory rules are metadata, not live spawn logic"],
  };
  fs.writeFileSync(path.join(out,"arumbar-manifest-v02.json"),
    JSON.stringify(manifest,null,2)+"\n");
  console.log(JSON.stringify({
    file:fname,bytes:data.length,
    triangles:built.geometry.triangles,
    meshInstances:glb.meshInstances,jointCount:rig.length,
    eightAnimationClips:glb.animations,output:out},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
