import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { create,clips,SPECIES,ANIMATIONS,DOSSIER } from "./fauna.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

// The GLTFExporter is a browser implementation; FileReader adapter for Node.
class NodeFileReader {
  result=null;onloadend=null;onerror=null;
  readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();}).catch(e=>this.onerror?.(e));}
  readAsDataURL(blob){blob.arrayBuffer().then(b=>{
    this.result="data:"+ (blob.type||"application/octet-stream")+";base64,"+Buffer.from(b).toString("base64");
    this.onloadend?.();
  }).catch(e=>this.onerror?.(e));}
}
globalThis.FileReader=NodeFileReader;
const out=path.resolve("dist-creatures");
fs.mkdirSync(out,{recursive:true});
const manifest={version:"0.1.0",gameIntegrated:false,productionQuality:"mid-poly prototype",geometry:"actual 3D polygonal meshes",animation:"hierarchical transform tracks, not weighted skin",assets:[]};
function inspect(bytes,id){
  const view=new DataView(bytes);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error(id+" invalid GLB magic");
  if(view.getUint32(8,true)!==bytes.byteLength)throw Error(id+" invalid GLB length");
  if(view.getUint32(16,true)!==0x4e4f534a)throw Error(id+" missing JSON chunk");
  const len=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,len)));
  const names=json.animations.map(c=>c.name);
  if(names.length!==ANIMATIONS[id].length||ANIMATIONS[id].some(x=>!names.includes(x)))
    throw Error(id+" missing animation "+JSON.stringify(names));
  const instances=json.nodes.filter(n=>n.mesh!==undefined).length;
  if(instances<(id==="cupinzeiro"?40:65))throw Error(id+" too few 3D mesh nodes "+instances);
  const tracks=json.animations.map(c=>c.channels.length);
  if(tracks.some(x=>x<12))throw Error(id+" empty animation pose");
  if((json.meshes||[]).length<3)throw Error(id+" no actual geometry");
  const primitives=json.meshes.reduce((n,m)=>n+m.primitives.length,0);
  return {meshes:json.meshes.length,meshInstances:instances,primitives,
    animationClips:names,channelsMin:Math.min(...tracks),nodes:json.nodes.length};
}
async function run(){
  for(const id of SPECIES){
    const model=create(id);
    const animationClips=clips(model);
    delete model.userData.rig;
    delete model.userData.previewAction;
    model.updateMatrixWorld(true);
    const bytes=await new Promise((resolve,reject)=>new GLTFExporter().parse(model,
      result=>result instanceof ArrayBuffer?resolve(result):reject(Error("Expected GLB ArrayBuffer")),
      reject,{binary:true,trs:true,onlyVisible:true,animations:animationClips}));
    const fileName=id+"-animated-v01.glb";
    const buffer=Buffer.from(bytes);
    const report=inspect(bytes,id);
    fs.writeFileSync(path.join(out,fileName),buffer);
    manifest.assets.push({speciesId:id,file:fileName,bytes:buffer.length,
      sha256:crypto.createHash("sha256").update(buffer).digest("hex"),
      ...report,dossier:DOSSIER[id]});
    console.log(id,JSON.stringify({file:fileName,size:buffer.length,clips:report.animationClips.length,meshes:report.meshInstances}));
  }
  fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
