import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {createArumbarV02} from "./arumbar-highpoly-v02.mjs";
import {createArumbarV03,poseArumbarV03,arumbarV03Clips,
  arumbarV03Bones,arumbarV03Stats,ANIMATIONS,DESIGN_V03}
  from "./arumbar-anatomy-v03.mjs";

function count(obj){
  let faces=0,meshes=0,colors=0;
  obj.traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    meshes++;
    const g=o.geometry;
    assert.ok(g.getAttribute("position")?.count>4, "No real vertices for "+o.name);
    assert.ok(g.getAttribute("normal")?.count, "Missing normals "+o.name);
    faces+=(g.index?.count??g.getAttribute("position").count)/3;
    if(g.getAttribute("color"))colors++;
  });
  return {faces:Math.round(faces),meshes,vertexColoredMaterials:colors};
}
const before=count(createArumbarV02());
const v03=createArumbarV03(),stats=arumbarV03Stats(v03),after=count(v03);
assert.deepEqual(DESIGN_V03.habitat,["savanna"]);
assert.equal(DESIGN_V03.social,"predominantly solitary");
assert.equal(DESIGN_V03.rarity,"rare");
assert.ok(stats.hiddenEarlierMeshInstances>180);
assert.ok(after.faces>40000,"Too few real triangles: "+after.faces);
assert.ok(after.meshes>180,"Too few real meshes: "+after.meshes);
assert.ok(after.vertexColoredMaterials>=2,"Real vertex-color gradients missing");
assert.ok(stats.details.armorScutes>=25,"Insufficient fitted articulated shoulder scutes");
assert.ok(stats.details.ruffJoints>=2&&stats.details.independentlyAnimatedEars===2);
const rig=v03.userData.rig;
const b=arumbarV03Bones(v03);
const names=b.map(x=>x.name);
assert.equal(new Set(names).size,names.length,"Rig has duplicate joint names");
for(const name of [
  "Arumbar_Neck","Arumbar_Head","Arumbar_Jaw",
  "Arumbar_FrontLeft_Knee","Arumbar_BackRight_Knee",
  "Arumbar_Tail0","ArumbarV03_EarJoint_-1",
  "ArumbarV03_ManeRuff_1","ArumbarV03_ScuteHinge_0"
])assert.ok(names.includes(name),"Missing bone "+name);
const clips=arumbarV03Clips(v03);
assert.deepEqual(clips.map(x=>x.name),ANIMATIONS);
for(const clip of clips){
  assert.ok(clip.tracks.length>70,"Too few articulated channels: "+clip.name);
  const values=clip.tracks.reduce((acc,t)=>acc+t.values.length,0);
  assert.ok(values>2000,"Empty clip: "+clip.name);
  for(const track of clip.tracks){
    assert.ok(track.values.length>0&&[...track.values].every(Number.isFinite),
      "Nonfinite animation channel: "+track.name);
  }
}
poseArumbarV03(v03,"walk",.12);
const first=rig.legs.frontL.upper.rotation.x;
poseArumbarV03(v03,"walk",.59);
assert.notEqual(first,rig.legs.frontL.upper.rotation.x,"Four-beat walk inactive");
poseArumbarV03(v03,"run",.12);
const runStart=rig.body.position.y;
poseArumbarV03(v03,"run",.35);
assert.notEqual(runStart,rig.body.position.y,"Heavy-body running inertia absent");
poseArumbarV03(v03,"graze",1.1);
assert.ok(rig.neck.rotation.x>.5&&rig.head.rotation.x>.6,"Cannot graze");
poseArumbarV03(v03,"drink",1.1);
assert.ok(rig.head.rotation.x>.8,"Cannot lower head to water");
poseArumbarV03(v03,"alert",1.05);
assert.ok(rig.neck.rotation.x<-.1,"Alert missing head elevation");
poseArumbarV03(v03,"charge",.11);
const chargeStart=rig.head.rotation.x;
poseArumbarV03(v03,"charge",.30);
assert.notEqual(chargeStart,rig.head.rotation.x,"Charging inertial head pose static");
poseArumbarV03(v03,"death",0);
const start=rig.body.position.y;
poseArumbarV03(v03,"death",1.65);
assert.ok(start-rig.body.position.y>.85,"Death must physically lower body");
poseArumbarV03(v03,"idle",0);
assert.ok(Math.abs(rig.legs.frontL.knee.rotation.x)<1e-8,
  "Animation pose drifts after death");
const box=new THREE.Box3().setFromObject(v03);
assert.ok(box.max.y>3.2&&box.max.y<5,"Incorrect megaherbivore vertical size "+box.max.y);
assert.ok(box.min.y<.26,"Hooves must touch ground");
assert.ok(box.max.z-box.min.z>4.6,"Must be long bison-like creature");
const manifest="dist-v03/arumbar-manifest-v03.json";
if(fs.existsSync(manifest)){
  const m=JSON.parse(fs.readFileSync(path.resolve(manifest),"utf8"));
  assert.equal(m.glb.animations.length,8);
  assert.ok(m.geometry.triangles>40000);
  assert.ok(fs.existsSync("dist-v03/arumbar-savanna-anatomy-animated-v03.glb"));
}
console.log(JSON.stringify({
  status:"PASS",version:"v03",v02:before,v03:after,
  newAnimatedJoints:stats.secondaryJointCount,joints:b.length,
  artifacts:"actual geometry; 8 clips",ecology:DESIGN_V03.habitat,
  box:{min:box.min.toArray(),max:box.max.toArray()}
},null,2));
