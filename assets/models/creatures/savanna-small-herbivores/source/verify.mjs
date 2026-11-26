import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import {SPECIES,create,pose,bones,animationClips,meshStats} from "./fauna.mjs";

assert.deepEqual(Object.keys(SPECIES),["velsari","tarruco"]);
const results={};
for(const id of Object.keys(SPECIES)){
 const root=create(id),rig=root.userData.rig;
 assert.deepEqual(SPECIES[id].biome,["savanna"],"Must be savanna-only");
 assert.equal(SPECIES[id].category,"small_herbivore");
 const stats=meshStats(root);
 assert.ok(stats.meshInstances>=35,"3D mesh detail too low "+id);
 assert.ok(stats.triangles>5000,"3D polygon count too low "+id+": "+stats.triangles);
 const names=bones(root).map(x=>x.name);
 assert.equal(new Set(names).size,names.length,"Rig joint names not unique "+id);
 assert.ok(names.some(n=>n.endsWith("_Knee")||n.endsWith("_Elbow")));
 for(const action of SPECIES[id].clips){
  pose(root,action,.42);
  root.updateMatrixWorld(true);
  root.traverse(o=>{
   assert.ok(o.position.toArray().every(Number.isFinite),"invalid pose "+action);
   if(o.isMesh)assert.ok(o.geometry.attributes.position?.count>3,"fake geometry");
  });
 }
 const clips=animationClips(root);
 assert.equal(clips.length,10);
 assert.deepEqual(clips.map(c=>c.name),SPECIES[id].clips);
 for(const clip of clips){
  assert.ok(clip.tracks.length>=30,clip.name+" lacks rig channels");
  assert.ok(clip.tracks.every(t=>t.values.length>0 && [...t.values].every(Number.isFinite)));
 }
 if(id==="velsari"){
  pose(root,"walk",.14);
  const first=rig.legs.frontL.upper.rotation.x;
  pose(root,"walk",.40);
  assert.notEqual(first,rig.legs.frontL.upper.rotation.x);
  pose(root,"leap",.48);
  assert.ok(rig.body.position.y>.20,"Leaping pose missing");
  pose(root,"graze",.9);
  assert.ok(rig.neck.rotation.x>.5&&rig.head.rotation.x>.6,"Unable to graze");
  assert.equal(rig.ears.length,2);
 }else{
  assert.ok(!root.name.toLowerCase().includes("armadillo"));
  assert.ok(!root.children.some(x=>/shell|carapace|armor/i.test(x.name)),"No shell-like geometry allowed");
  pose(root,"dig",.57);
  const first=rig.legs.frontL.upper.rotation.x;
  pose(root,"dig",.74);
  assert.notEqual(first,rig.legs.frontL.upper.rotation.x,"Must alternate digging paws");
  assert.ok(rig.crest&&rig.ears.length===2,"Need crest and tall ears");
  pose(root,"forage",1.1);
  assert.ok(rig.head.rotation.x>.3,"Foraging motion missing");
 }
 pose(root,"death",0);
 const baseY=rig.body.position.y;
 pose(root,"death",1.45);
 assert.ok(baseY-rig.body.position.y>.15,"Death does not lower body");
 pose(root,"idle",0);
 assert.ok(Math.abs(rig.legs.frontL.knee.rotation.x)<.001,"Pose drift");
 const bounds=new THREE.Box3().setFromObject(root);
 assert.ok(bounds.max.y<2.0,"Not a small herbivore");
 assert.ok(bounds.max.z-bounds.min.z>.65,"Body length too small");
 assert.ok(bounds.min.y<.23,"Hooves / paws should approach terrain");
 results[id]={...stats,joints:bones(root).length,
   clips:clips.map(c=>c.name),
   bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
}
if(fs.existsSync("dist/savanna-small-herbivores-manifest-v01.json")){
 const m=JSON.parse(fs.readFileSync("dist/savanna-small-herbivores-manifest-v01.json","utf8"));
 for(const id of Object.keys(SPECIES)){
  assert.equal(m.species[id].clips,10);
  assert.ok(fs.existsSync("dist/"+id+"-savanna-animated-v01.glb"));
 }
}
console.log(JSON.stringify({status:"PASS",species:results},null,2));
