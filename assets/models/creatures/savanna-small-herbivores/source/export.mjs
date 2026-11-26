import * as THREE from "three";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {SPECIES,create,animationClips,meshStats,bones} from "./fauna.mjs";

class NodeFileReader{
  result=null;onloadend=null;onerror=null;
  readAsArrayBuffer(blob){
    blob.arrayBuffer().then(buf=>{this.result=buf;this.onloadend?.()})
      .catch(e=>this.onerror?.(e));
  }
  readAsDataURL(blob){
    blob.arrayBuffer().then(buf=>{
      this.result="data:"+(blob.type||"application/octet-stream")+
        ";base64,"+Buffer.from(buf).toString("base64");
      this.onloadend?.();
    }).catch(e=>this.onerror?.(e));
  }
}
globalThis.FileReader=NodeFileReader;
const dest=path.resolve("dist");
fs.mkdirSync(dest,{recursive:true});
const manifest={version:"v01",species:{},gameplayIntegrated:false,
  note:"Model assets and animations only. No edits to game/alpha01."};
for(const id of Object.keys(SPECIES)){
 const root=create(id),clips=animationClips(root),stats=meshStats(root);
 const names=bones(root).map(x=>x.name);
 delete root.userData.rig;
 delete root.userData.species;
 const data=await new Promise((resolve,reject)=>{
  new GLTFExporter().parse(root,
    output=>output instanceof ArrayBuffer?resolve(output):
      reject(Error("Expected binary .glb result")),reject,
    {binary:true,trs:true,onlyVisible:true,animations:clips});
 });
 const bytes=Buffer.from(data),view=new DataView(data);
 if(view.getUint32(0,true)!==0x46546c67||
    view.getUint32(8,true)!==data.byteLength||
    view.getUint32(16,true)!==0x4e4f534a)throw Error("Invalid GLB header");
 const length=view.getUint32(12,true);
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,length)));
 const actual=(json.animations??[]).map(a=>a.name);
 if(actual.length!==10||SPECIES[id].clips.some(n=>!actual.includes(n)))
   throw Error("Missing 10 actual clips in "+id+": "+actual);
 const meshNodes=json.nodes.filter(n=>n.mesh!==undefined).length;
 if(meshNodes<35)throw Error("Too few actual polygonal mesh nodes for "+id);
 if(json.animations.some(a=>a.channels.length<30))
   throw Error("Animations lacking joint channels for "+id);
 const filename=id+"-savanna-animated-v01.glb";
 fs.writeFileSync(path.join(dest,filename),bytes);
 manifest.species[id]={
   id,glb:filename,byteSize:bytes.length,
   sha256:crypto.createHash("sha256").update(bytes).digest("hex"),
   ...stats,meshNodesInGLB:meshNodes,
   meshDefinitions:json.meshes.length,
   clipNames:actual,clips:actual.length,jointNames:names,
   channelsPerClip:json.animations.map(a=>a.channels.length),
   ecology:SPECIES[id],rig:"hierarchical keyframed pivot tracks, no skinning",
 };
 console.log(id,JSON.stringify({bytes:bytes.length,...stats,clips:actual}));
}
fs.writeFileSync(path.join(dest,"savanna-small-herbivores-manifest-v01.json"),
  JSON.stringify(manifest,null,2)+"\n");
