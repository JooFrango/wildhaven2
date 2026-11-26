import * as THREE from "three";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createArumbar,poseArumbar,arumbarClips,arumbarBones,ANIMATIONS,DESIGN} from "./arumbar.mjs";

const m=createArumbar(),rig=m.userData.rig;
assert.deepEqual(DESIGN.habitat,["savanna"],"Arumbar must live only in savanna");
assert.equal(DESIGN.rarity,"rare");
assert.equal(DESIGN.social,"predominantly solitary");
assert.ok(DESIGN.capPopulationPerSuitable5kmHex<=2);
let nodes=0,faces=0;
m.traverse(o=>{
  if(!o.isMesh)return;
  nodes++;
  const position=o.geometry.attributes.position;
  assert.ok(position?.count>=4,"Missing actual 3D vertices");
  faces+=(o.geometry.index?.count||position.count)/3;
  assert.ok(Number.isFinite(o.position.x));
});
assert.ok(nodes>=150,"Model too simplified: "+nodes+" meshes");
assert.ok(faces>5000,"Model lacks enough genuine polygonal geometry: "+faces);
const names=arumbarBones(m).map(j=>j.name);
assert.equal(new Set(names).size,names.length,"Duplicate rig joint names");
for(const name of ["Arumbar_Head","Arumbar_Neck","Arumbar_Jaw",
 "Arumbar_FrontLeft_Knee","Arumbar_FrontRight_Ankle",
 "Arumbar_BackLeft_Knee","Arumbar_Tail0","Arumbar_Tassel"])
  assert.ok(names.includes(name),"Missing articulated joint "+name);
const clips=arumbarClips(m);
assert.deepEqual(clips.map(a=>a.name),ANIMATIONS);
assert.equal(clips.length,8);
for(const c of clips){
  assert.ok(c.tracks.length>=28,c.name+" has too few animated tracks");
  for(const track of c.tracks){
    assert.ok(track.values.length>0&&track.values.every(Number.isFinite),
      "Nonfinite or missing keyframes "+track.name);
  }
}
poseArumbar(m,"walk",.10);
const swing=rig.legs.frontL.upper.rotation.x;
poseArumbar(m,"walk",.56);
assert.notEqual(swing,rig.legs.frontL.upper.rotation.x,"Gait not moving");
poseArumbar(m,"graze",.90);
assert.ok(rig.neck.rotation.x>.40,"Must bend neck to graze");
poseArumbar(m,"drink",.90);
assert.ok(rig.head.rotation.x>.60,"Must tilt head to drink");
poseArumbar(m,"alert",1);
assert.ok(rig.neck.rotation.x<-.10,"Must raise head for alert");
poseArumbar(m,"charge",.10);
const charge=rig.body.rotation.x;
poseArumbar(m,"charge",.25);
assert.notEqual(charge,rig.body.rotation.x,"Charge not moving");
poseArumbar(m,"death",0);
const standing=rig.body.position.y;
poseArumbar(m,"death",1.65);
assert.ok(standing-rig.body.position.y>.8,"Death is not progressive");
poseArumbar(m,"idle",0);
assert.ok(Math.abs(rig.legs.frontL.knee.rotation.x)<.01,
  "Joint rotation drift after death");
const box=new THREE.Box3().setFromObject(m);
assert.ok(box.max.y>3&&box.min.y<.25,"Incorrect model ground/height "+JSON.stringify({min:box.min.toArray(),max:box.max.toArray()}));
assert.ok(box.max.z-box.min.z>4.5,"Not a large 3D herbivore");
const manifest=path.resolve("dist/arumbar-manifest-v01.json");
if(fs.existsSync(manifest)){
 const data=JSON.parse(fs.readFileSync(manifest,"utf8"));
 assert.equal(data.animationNames.length,8);
 assert.ok(fs.existsSync(path.resolve("dist/arumbar-savanna-animated-v01.glb")));
}
console.log(JSON.stringify({result:"PASS",meshes:nodes,triangles:Math.round(faces),
 joints:names.length,animations:ANIMATIONS,habitat:DESIGN.habitat,
 ecology:"rare predominantly solitary",bounds:{min:box.min.toArray(),max:box.max.toArray()}},null,2));
