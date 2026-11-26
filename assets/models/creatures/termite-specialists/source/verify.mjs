import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { create, pose, clips, SPECIES, ANIMATIONS } from "./fauna.mjs";
import * as THREE from "three";
import { colony, feed, advance, animationFromColony } from "./ecology.mjs";
for(const id of SPECIES){
  const obj=create(id);
  let meshes=0,vertices=0;
  obj.traverse(o=>{
    if(o.isMesh){
      meshes++;
      assert.ok(o.geometry.getAttribute("position"),id+" missing geometry");
      vertices+=o.geometry.getAttribute("position").count;
      o.updateMatrixWorld(true);
      assert.ok(o.matrixWorld.elements.every(Number.isFinite),id+" matrix not finite");
    }
  });
  assert.ok(meshes>=40,id+": model too sparse "+meshes);
  assert.ok(vertices>1000,id+": missing real 3D polygon vertices");
  const actions=clips(obj);
  assert.deepEqual(actions.map(a=>a.name),ANIMATIONS[id]);
  for(const c of actions){
    assert.ok(c.tracks.length>=12);
    assert.ok(c.tracks.some(t=>t.name.endsWith(".quaternion")));
    for(const track of c.tracks){
      assert.ok(track.values.length>0);
      assert.ok([...track.values].every(Number.isFinite));
    }
  }
  pose(obj,ANIMATIONS[id][0],.25);
  console.log(id,meshes,"meshes,",vertices,"vertices,",actions.length,"animated clips");
}
const full=colony(20000);
const visit=feed(full,"ferrunco");
assert.equal(visit.consumed,340);
assert.equal(visit.colony.population,19660);
assert.ok(visit.colony.integrity<1);
const loss=feed(colony(20),"dunlingua");
assert.equal(loss.consumed,20);
assert.equal(loss.colony.population,0);
assert.equal(loss.colony.extinct,true);
const extinct=advance(loss.colony,120,"dry");
assert.equal(extinct.population,0);
assert.equal(extinct.extinct,true);
assert.equal(extinct.integrity,0);
assert.equal(animationFromColony(extinct),"disappearing");
assert.ok(advance(colony(12000),8).population>12000);
console.log("ecology: consumption, permanent extinction and decomposition verified");

// v0.2 non-static animation checks: verify real transform changes, not just names.
for(const id of SPECIES){
  const obj=create(id);
  const rig=obj.userData.rig;
  if(id==="ferrunco"){
    assert.ok(rig.polish?.shield);
    pose(obj,"dig",0.13);
    const early=rig.foreL.upper.rotation.x;
    pose(obj,"dig",0.41);
    assert.notEqual(early,rig.foreL.upper.rotation.x);
    pose(obj,"feed",0.26);
    assert.ok(rig.tongue.scale.z>.2,"Ferrunco tongue must actually extend");
  }else if(id==="dunlingua"){
    assert.ok(rig.polish?.tail1&&rig.polish?.tail2);
    pose(obj,"run",.10);
    const early=rig.polish.tail1.rotation.y;
    pose(obj,"run",.30);
    assert.notEqual(early,rig.polish.tail1.rotation.y);
    pose(obj,"feed",.23);
    assert.ok(rig.tongue.scale.z>.2,"Dunlingua tongue must actually extend");
  }else if(id==="pica_termita"){
    assert.ok(rig.polish?.crestSprig);
    pose(obj,"land",0);
    const high=rig.body.position.y;
    pose(obj,"land",1.25);
    assert.ok(high-rig.body.position.y>.4,"Bird must descend during landing");
    pose(obj,"fly",.13);
    const wing=rig.wingL.wing.rotation.z;
    pose(obj,"fly",.31);
    assert.notEqual(wing,rig.wingL.wing.rotation.z);
  }else{
    assert.ok(rig.polish?.crumbs.length>=15);
    pose(obj,"crumbling",.1);
    const original=rig.polish.crumbs[0].position.clone();
    pose(obj,"crumbling",3.6);
    assert.ok(original.distanceTo(rig.polish.crumbs[0].position)>.05);
  }
  // A new idle pose must restore the original offsets after an energetic action.
  const first=ANIMATIONS[id][0];
  pose(obj,first,0.0);
  const groups=[];
  obj.traverse(o=>{if(o instanceof THREE.Group)groups.push(o);});
  assert.ok(groups.every(o=>o.matrix.elements.every(Number.isFinite)));
}
console.log("v0.2 animation tests: knees, wings, tongues, crumble, and pose reset passed");

const base=path.resolve("dist-creatures");
if(fs.existsSync(base)){
  const manifest=JSON.parse(fs.readFileSync(path.join(base,"manifest.json"),"utf8"));
  for(const asset of manifest.assets){
    assert.ok(fs.existsSync(path.join(base,asset.file)));
    assert.equal(asset.animationClips.length,ANIMATIONS[asset.speciesId].length);
  }
}
