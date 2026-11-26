import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {createArumbar} from "./arumbar.mjs";
import {ANIMATIONS,DESIGN_V02,createArumbarV02,poseArumbarV02,
  arumbarClipsV02,arumbarBonesV02,arumbarV02Stats} from "./arumbar-highpoly-v02.mjs";
function count(root){
 let triangles=0,mesh=0;
 root.traverse(o=>{
  if(o.isMesh&&o.visible){
    mesh++;
    const g=o.geometry;
    triangles+=(g.index?.count??g.getAttribute("position").count)/3;
    assert.ok(g.getAttribute("normal")?.count>0,"Missing calculated normals");
  }
 });
 return {triangles,meshes:mesh};
}
const v1=count(createArumbar()),root=createArumbarV02(),v2=arumbarV02Stats(root);
const rig=root.userData.rig;
assert.deepEqual(DESIGN_V02.habitat,["savanna"]);
assert.equal(DESIGN_V02.rarity,"rare");
assert.equal(DESIGN_V02.social,"predominantly solitary");
assert.ok(DESIGN_V02.capPopulationPerSuitable5kmHex<=2);
assert.ok(v2.geometry.triangles>55000,
  "High-poly v02 must exceed 55k triangles: "+v2.geometry.triangles);
assert.ok(v2.geometry.triangles>v1.triangles*2,
  "Revision must genuinely increase 3D face count by over 2x");
assert.ok(v2.geometry.meshes>v1.meshes,
  "More complex layered 3D anatomy expected");
assert.ok(v2.hiddenOriginalMeshes>180,
  "The old low-poly skeleton primitives must not be rendered over v02");
const bones=arumbarBonesV02(root),names=bones.map(o=>o.name);
assert.equal(new Set(names).size,names.length,"Duplicate joint names break GLB animation channels");
assert.ok(v2.secondaryJoints>=8);
const required=[
 "Arumbar_Head","Arumbar_Neck","Arumbar_Jaw",
 "Arumbar_FrontLeft_Knee","Arumbar_FrontRight_Ankle",
 "Arumbar_BackLeft_Knee","Arumbar_Tail0","Arumbar_Tassel",
 "ArumbarV02_Ear_-1","ArumbarV02_Ruff_1"
];
for(const n of required)assert.ok(names.includes(n),"Absent joint "+n);
const clips=arumbarClipsV02(root);
assert.deepEqual(clips.map(c=>c.name),ANIMATIONS);
for(const clip of clips){
 assert.ok(clip.tracks.length>=80,"Not enough tracks in "+clip.name);
 for(const track of clip.tracks){
   assert.ok(track.values.length>0,"Track empty "+track.name);
   assert.ok([...track.values].every(Number.isFinite),"Invalid track "+track.name);
 }
}
poseArumbarV02(root,"walk",.1);
const legEarly=rig.legs.frontL.upper.rotation.x;
poseArumbarV02(root,"walk",.6);
assert.notEqual(legEarly,rig.legs.frontL.upper.rotation.x);
poseArumbarV02(root,"graze",.9);
assert.ok(rig.neck.rotation.x>.3&&rig.head.rotation.x>.3,"Must realistically graze");
poseArumbarV02(root,"drink",.9);
assert.ok(rig.head.rotation.x>.65);
poseArumbarV02(root,"alert",1.0);
assert.ok(rig.neck.rotation.x<-.1);
poseArumbarV02(root,"charge",.18);
const chargeStart=rig.body.rotation.x;
poseArumbarV02(root,"charge",.34);
assert.notEqual(chargeStart,rig.body.rotation.x);
poseArumbarV02(root,"death",0);
const standing=rig.body.position.y;
poseArumbarV02(root,"death",1.65);
assert.ok(standing-rig.body.position.y>.85);
poseArumbarV02(root,"idle",0);
assert.ok(Math.abs(rig.legs.frontL.knee.rotation.x)<.001);
const bounds=new THREE.Box3().setFromObject(root);
assert.ok(bounds.max.y>3.1&&bounds.max.y<6.5,
  "Reasonable savanna megaherbivore height: "+bounds.max.y);
assert.ok(bounds.min.y<.2,"Feet must reach floor "+bounds.min.y);
assert.ok(bounds.max.z-bounds.min.z>3.8);
const out=path.resolve("dist-v02/arumbar-manifest-v02.json");
if(fs.existsSync(out)){
 const manifest=JSON.parse(fs.readFileSync(out,"utf8"));
 assert.equal(manifest.glb.animations.length,8);
 assert.ok(manifest.glb.trianglesInMeshDefinitions>55000);
 assert.ok(fs.existsSync(path.resolve("dist-v02/arumbar-savanna-highpoly-animated-v02.glb")));
}
console.log(JSON.stringify({status:"PASS",oldGeometry:v1,newGeometry:v2.geometry,
  highPolyMultiplier:Number((v2.geometry.triangles/v1.triangles).toFixed(2)),
  bones:bones.length,secondaryJointCount:v2.secondaryJoints,
  animations:ANIMATIONS,ecology:{habitat:DESIGN_V02.habitat,
    solitary:DESIGN_V02.social,rare:DESIGN_V02.rarity},
  bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}},null,2));
