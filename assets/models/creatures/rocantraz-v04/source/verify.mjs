import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import {VARIANTS,ANIMATIONS,ECOLOGY,createRocantraz,meshStats,
  bones,poseRocantraz,animationClips} from "./rocantraz.mjs";

assert.equal(ECOLOGY.locomotion,"strictly_bipedal");
assert.equal(ECOLOGY.rarity,"very_rare");
assert.deepEqual(VARIANTS,["forest","desert"]);
for(const variant of VARIANTS){
 const obj=createRocantraz(variant),r=obj.userData.rig;
 const stat=meshStats(obj);
 assert.ok(stat.meshes>100,"Need detailed geometry "+variant);
 assert.ok(stat.triangles>35000,"Need genuine 3D high-detail model "+variant);
 assert.ok(stat.joints>=20,"Insufficient articulated rig "+variant);
 // Only TWO load-bearing legs. Arms may hold claws but cannot be legs.
 assert.equal(Object.keys(r.legs).length,2,"Rocantraz must be a BIPED");
 assert.equal(Object.keys(r.arms).length,2,"Two shorter attack arms expected");
 assert.ok(r.tail.length>=6,"Heavy balance tail expected");
 const names=bones(obj).map(o=>o.name);
 assert.equal(new Set(names).size,names.length,"Duplicate glTF bone names");
 for(const name of ["Rocantraz04_LeftHip","Rocantraz04_RightHip",
  "Rocantraz04_LeftKnee","Rocantraz04_RightKnee",
  "Rocantraz04_LeftAnkle","Rocantraz04_RightAnkle",
  "Rocantraz04_LeftShoulder","Rocantraz04_RightElbow",
  "Rocantraz04_Neck","Rocantraz04_Head",
  "Rocantraz04_Jaw","Rocantraz04_Tail0"]){
   assert.ok(names.includes(name),"Missing real biped joint "+name);
 }
 const clips=animationClips(obj);
 assert.deepEqual(clips.map(x=>x.name),ANIMATIONS);
 for(const clip of clips){
  assert.ok(clip.tracks.length>50,"Too few channels "+clip.name);
  assert.ok(clip.tracks.every(t=>t.values.length>0&&[...t.values].every(Number.isFinite)),
   "Non-finite animated joint transform");
 }
 const t0=.12,t1=.26;
 poseRocantraz(obj,"walk",t0);
 const first=r.legs.left.hip.rotation.x;
 poseRocantraz(obj,"walk",t1);
 assert.notEqual(first,r.legs.left.hip.rotation.x,"Walk must step");
 poseRocantraz(obj,"walk",t0);
 assert.ok(r.legs.left.hip.rotation.x!==r.legs.right.hip.rotation.x,
   "Biped must use alternating legs");
 poseRocantraz(obj,"run",t0);
 const sway=r.body.position.y;
 poseRocantraz(obj,"run",t1);
 assert.notEqual(sway,r.body.position.y,"Heavy-biped body inertia required");
 poseRocantraz(obj,"bite",.18);
 const biteEarly=r.jaw.rotation.x;
 poseRocantraz(obj,"bite",.52);
 assert.notEqual(biteEarly,r.jaw.rotation.x,"Real jaw attack required");
 poseRocantraz(obj,"roar",1.05);
 assert.ok(r.jaw.rotation.x>.60,"Roaring jaw must open");
 poseRocantraz(obj,"swipe",.70);
 assert.ok(r.arms.left.shoulder.rotation.x<-.4,"Biped uses ARMS to attack");
 poseRocantraz(obj,"die",0);
 const standing=r.body.position.y;
 poseRocantraz(obj,"die",1.55);
 assert.ok(standing-r.body.position.y>.7,"True progressive death motion");
 poseRocantraz(obj,"idle",0);
 const neutral=r.legs.left.hip.rotation.x;
 poseRocantraz(obj,"idle",0);
 assert.ok(Math.abs(neutral-r.legs.left.hip.rotation.x)<1e-9,
   "Pose drift after a death-and-idle transition");
 // Real anatomical additions must exist in the exported mesh hierarchy.
 const tissue=[];
 obj.traverse(x=>{
  if(x.isMesh&&/Hamstring|SkinSleeve|Achilles|Latissimus|MetatarsalBridge/.test(x.name))
   tissue.push(x);
 });
 assert.ok(tissue.length>=8,"New tissue meshes are missing: "+tissue.length);
 assert.ok(names.includes("Rocantraz04_Breath"),"Animated intercostal rig absent");
 poseRocantraz(obj,"idle",.3);
 const breath0=r.breath.scale.x;
 poseRocantraz(obj,"idle",1.1);
 assert.notEqual(breath0,r.breath.scale.x,"Breathing geometry must deform");
 // Virtual ankle contact should stay near a consistent world-height plane
 // during stance even as the ribcage shifts across the supporting hip.
 const contactHeights=[];
 for(const t of [.80,.92,1.04,1.16,1.27]){
   poseRocantraz(obj,"walk",t);
   obj.updateMatrixWorld(true);
   const heel=r.legs.left.foot.getWorldPosition(new THREE.Vector3());
   contactHeights.push(heel.y);
   assert.ok(Number.isFinite(heel.y),"Nonfinite IK foot height");
   assert.ok(Math.abs(r.legs.left.knee.rotation.x)<1.6,
     "Hyperextended knee or invalid IK solution");
 }
 const heightRange=Math.max(...contactHeights)-Math.min(...contactHeights);
 assert.ok(heightRange<.16,
   "Ground support ankle height varies too much: "+contactHeights);
 poseRocantraz(obj,"walk",.18);
 const pelvisLeft=r.body.position.x;
 poseRocantraz(obj,"walk",.89);
 assert.ok(pelvisLeft*r.body.position.x<0,
   "Body must shift over the alternate supporting leg");
 poseRocantraz(obj,"swipe",.69);
 assert.ok(Math.abs(r.body.position.x)>.02,
   "Arm strike should rotate/shift body mass before impact");
 poseRocantraz(obj,"idle",0);
 const box=new THREE.Box3().setFromObject(obj);
 assert.ok(box.max.y>5.5&&box.max.y<7.5,
   "Biped vertical silhouette should be tall "+box.max.y);
 assert.ok(box.min.y<.40,"Feet should approach the ground "+box.min.y);
 assert.ok(box.max.z-box.min.z>6.0,"Needs long counterbalance tail");
 // Important: no static images or fake geometry masquerading as mesh.
 obj.traverse(x=>{
  if(x.isMesh)assert.ok(x.geometry.attributes.position?.count>=6,
   "Part missing polygon vertices "+x.name);
 });
 console.log(variant,JSON.stringify({stats:stat,
  bounds:{min:box.min.toArray(),max:box.max.toArray()},
  animations:clips.length}));
}
const mf="dist/rocantraz-biped-manifest-v04.json";
if(fs.existsSync(mf)){
 const data=JSON.parse(fs.readFileSync(mf,"utf8"));
 for(const variant of VARIANTS){
  assert.equal(data.variants[variant].clips.length,12);
  assert.ok(fs.existsSync("dist/rocantraz-"+variant+"-biped-animated-v04.glb"));
 }
}
console.log("PASS: Rocantraz is an original biped, both variants and 12 animated clips verified.");
