/**
 * WILDHAVEN / Hunter PvP — revision v06 (experimental, no Alpha integration).
 * Append ten independent skeletal clips to the v05 GLB without editing its original
 * meshes, UVs, textures, weights, 19-joint skin, materials, or existing animations.
 *
 * Run from project root: node labs/hunters/scripts/animate-hunter-pvp-v06.mjs
 * Source: labs/hunters/assets/hunter-v05/hunter_combat_v05.glb
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from '../../hunters-codex/node_modules/three/build/three.module.js';

const source = new URL('../assets/hunter-v05/hunter_combat_v05.glb', import.meta.url);
const outDir = new URL('../assets/hunter-pvp-v06/', import.meta.url);
const raw = await readFile(source);
if (raw.toString('utf8', 0, 4) !== 'glTF' || raw.readUInt32LE(4) !== 2) throw Error('v05 GLB inválido');
const length = raw.readUInt32LE(12);
const gltf = JSON.parse(raw.toString('utf8', 20, 20 + length));
const original = structuredClone(gltf);
const originalBin = raw.subarray(28 + length);
if (gltf.skins?.[0]?.joints?.length !== 19) throw Error('O Hunter esperado tem 19 juntas');
if (!gltf.animations?.some(x => x.name === 'combat_guard')) throw Error('A origem deve ser o GLB v05 com clipes');
const nodes = gltf.nodes.map(n => {
  const o = new T.Object3D();
  o.name = n.name;
  if (n.matrix) {
    o.matrix.fromArray(n.matrix);
    o.matrix.decompose(o.position, o.quaternion, o.scale);
  } else {
    o.position.fromArray(n.translation ?? [0,0,0]);
    o.quaternion.fromArray(n.rotation ?? [0,0,0,1]);
    o.scale.fromArray(n.scale ?? [1,1,1]);
  }
  return o;
});
gltf.nodes.forEach((n, i) => (n.children ?? []).forEach(c => nodes[i].add(nodes[c])));
const scene = new T.Scene();
for (const i of gltf.scenes[gltf.scene ?? 0].nodes) scene.add(nodes[i]);
scene.updateMatrixWorld(true);
const bones = Object.fromEntries(nodes.map(o => [o.name, o]));
const rest = nodes.map(o => ({ position:o.position.clone(), quaternion:o.quaternion.clone(), scale:o.scale.clone() }));
const origins = Object.fromEntries(nodes.map(o => [o.name, o.getWorldPosition(new T.Vector3())]));
const joints = gltf.skins[0].joints;
const V = (x,y,z) => new T.Vector3(x,y,z);
const clamp = (v,a=0,b=1) => Math.max(a, Math.min(b,v));
const ease = v => { v=clamp(v); return v*v*(3-2*v); };
const mix=(a,b,u)=>a+(b-a)*u;
function reset(){nodes.forEach((o,i)=>{o.position.copy(rest[i].position);o.quaternion.copy(rest[i].quaternion);o.scale.copy(rest[i].scale);});scene.updateMatrixWorld(true);}
function worldRotate(parent, child, target){
  const s=parent.getWorldPosition(new T.Vector3());
  const from=child.getWorldPosition(new T.Vector3()).sub(s).normalize();
  const desired=target.clone().sub(s).normalize();
  if (desired.lengthSq() < .00001 || from.lengthSq() < .00001) return;
  const q=new T.Quaternion().setFromUnitVectors(from,desired).multiply(parent.getWorldQuaternion(new T.Quaternion()));
  parent.quaternion.copy(parent.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));
  scene.updateMatrixWorld(true);
}
function twoBone(aName,bName,cName,target,bend){
  const a=bones[aName],b=bones[bName],c=bones[cName];
  if(!a||!b||!c) throw Error('Junta ausente: '+[aName,bName,cName].join('/'));
  const root=a.getWorldPosition(new T.Vector3()), mid=b.getWorldPosition(new T.Vector3()),end=c.getWorldPosition(new T.Vector3());
  const l1=root.distanceTo(mid),l2=mid.distanceTo(end),ax=target.clone().sub(root);
  const dist=clamp(ax.length(),Math.abs(l1-l2)+.0003,l1+l2-.0003);
  ax.normalize();
  const along=(l1*l1-l2*l2+dist*dist)/(2*dist);
  const pole=bend.clone().sub(root);pole.addScaledVector(ax,-pole.dot(ax)).normalize();
  const elbow=root.clone().addScaledVector(ax,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
  worldRotate(a,b,elbow);worldRotate(b,c,target);
}
function arms(right,left){
  twoBone('RightArm','RightForeArm','RightHand',V(...right),V(-.44,1.0,.12));
  twoBone('LeftArm','LeftForeArm','LeftHand',V(...left),V(.44,1.0,.12));
}
function pelvis(dx,dy,dz){
  const b=bones.Hips,p=b.getWorldPosition(new T.Vector3()).add(V(dx,dy,dz));
  b.position.copy(b.parent.worldToLocal(p));scene.updateMatrixWorld(true);
}
function upperBody(turn=0,lean=0,tilt=0){
  const b=bones.Spine ?? bones.Spine02;
  b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(lean,turn,tilt)));
  scene.updateMatrixWorld(true);
}
function feet(wide=.19,offsetX=0,offsetZ=0,crouch=0){
  const hip=bones.Hips.getWorldPosition(new T.Vector3());
  for(const side of ['Left','Right']){
    const sign=side==='Left'?1:-1;
    const p=origins[side+'Foot'].clone().add(V(sign*wide*.45+offsetX,0,sign*wide+offsetZ));
    if(crouch) p.z += sign*crouch*.12;
    twoBone(side+'UpLeg',side+'Leg',side+'Foot',p,V(p.x,.46,p.z+.40));
  }
}
const poses=[
  {name:'pvp_sword_01_ready',duration:1.15,impact:null,label:'01 Guarda inicial'},
  {name:'pvp_sword_02_slash_right',duration:.9,impact:.47,label:'02 Corte horizontal de direita'},
  {name:'pvp_sword_03_slash_left',duration:.9,impact:.47,label:'03 Corte horizontal reverso'},
  {name:'pvp_sword_04_overhead',duration:1.25,impact:.76,label:'04 Golpe vertical'},
  {name:'pvp_sword_05_thrust',duration:.87,impact:.48,label:'05 Estocada'},
  {name:'pvp_sword_06_guard_high',duration:1.0,impact:null,label:'06 Defesa alta'},
  {name:'pvp_sword_07_parry',duration:.72,impact:.35,label:'07 Aparo com espada'},
  {name:'pvp_sword_08_dodge',duration:.85,impact:null,label:'08 Esquiva lateral'},
  {name:'pvp_sword_09_take_hit',duration:.74,impact:.20,label:'09 Reação ao dano'},
  {name:'pvp_sword_10_kneel_injured',duration:1.42,impact:.86,label:'10 Cai de joelho'}
];
function pose(spec,t){
  reset();const u=t/spec.duration,breath=Math.sin(u*2*Math.PI)*.003;
  const charging=spec.impact==null?0:ease(t/Math.max(.1,spec.impact*.7));
  const striking=spec.impact==null?0:ease((t-spec.impact*.7)/Math.max(.1,spec.impact*.3));
  const recovering=spec.impact==null?0:ease((t-spec.impact)/Math.max(.1,spec.duration-spec.impact));
  const active=spec.impact==null?0:t<=spec.impact?charging:(1-recovering);
  let right=[-.18,1.14+breath,.23],left=[.23,1.22,.24];
  let hip=[0,-.06,0],turn=0,lean=.045,tilt=0,widen=.17,lead=0;
  switch(spec.name){
    case 'pvp_sword_01_ready':
      right=[-.17,1.14+breath,.27];left=[.22,1.23,.27];turn=.07;break;
    case 'pvp_sword_02_slash_right': {
      const w=ease(t/(spec.impact*.72)), s=ease((t-spec.impact*.72)/(spec.impact*.28)), r=recovering;
      right=[mix(-.42,.33,s)*(1-r)+(-.18*r),mix(1.37,1.17,s),mix(-.04,.53,s)*(1-r)+.25*r];
      left=[.23,1.24,.20];turn=mix(-.35,.37,s)*(1-r);hip=[.025*active,-.085,.055*s*(1-r)];widen=.23;break;
    }
    case 'pvp_sword_03_slash_left': {
      const s=ease((t-spec.impact*.72)/(spec.impact*.28)),r=recovering;
      right=[mix(.33,-.36,s)*(1-r)-.17*r,mix(1.33,1.14,s),mix(-.02,.53,s)*(1-r)+.25*r];
      turn=mix(.35,-.34,s)*(1-r);hip=[-.03*active,-.084,.06*s*(1-r)];widen=.23;break;
    }
    case 'pvp_sword_04_overhead': {
      const s=ease((t-spec.impact*.63)/(spec.impact*.37)),r=recovering;
      right=[-.10,mix(1.53,.86,s)*(1-r)+1.14*r,mix(.05,.51,s)*(1-r)+.25*r];
      left=[.05,mix(1.44,.88,s)*(1-r)+1.23*r,mix(.03,.46,s)*(1-r)+.23*r];
      hip=[0,-.11-.07*s*(1-r),.04*s*(1-r)];lean=.03+.28*s*(1-r);widen=.27;break;
    }
    case 'pvp_sword_05_thrust': {
      const s=ease((t-spec.impact*.62)/(spec.impact*.38)),r=recovering;
      right=[-.13,1.19,mix(.15,.65,s)*(1-r)+.23*r];
      left=[.23,1.19,mix(.23,.12,s)*(1-r)+.24*r];
      hip=[.01,-.085,.12*s*(1-r)];lean=.08+.10*s*(1-r);widen=.23;lead=.04*s;break;
    }
    case 'pvp_sword_06_guard_high':
      right=[-.10,1.38+breath,.24];left=[.12,1.33,.24];hip=[0,-.085,0];turn=-.06;widen=.24;break;
    case 'pvp_sword_07_parry': {
      const s=ease(t/(spec.impact*.85)),r=recovering;
      right=[mix(-.18,.09,s)*(1-r)-.16*r,mix(1.15,1.39,s)*(1-r)+1.14*r,mix(.23,.36,s)*(1-r)+.23*r];
      left=[.12,1.30,.26];hip=[0,-.075,-.035*s];turn=.10*s*(1-r);tilt=.045*s;widen=.21;break;
    }
    case 'pvp_sword_08_dodge': {
      const d=Math.sin(Math.PI*u);hip=[-.17*d,-.055-.13*d,-.055*d];turn=-.16*d;lean=.04;tilt=-.12*d;
      right=[-.26-d*.05,1.13-d*.08,.18];left=[.25,1.2-d*.07,.27];widen=.27;lead=-.075*d;break;
    }
    case 'pvp_sword_09_take_hit': {
      const j=Math.sin(Math.PI*ease(u));hip=[0,-.05-.03*j,-.07*j];lean=-.22*j;turn=.16*j;
      right=[-.25,1.05-j*.11,.08];left=[.36,1.29+j*.06,.05];widen=.21;break;
    }
    case 'pvp_sword_10_kneel_injured': {
      const fall=ease(u/.64),rise=0;hip=[-.06*fall,-.06-.50*fall,-.06*fall];lean=.12+.26*fall;tilt=-.09*fall;
      right=[-.23,1.12-.45*fall,.24+.05*fall];left=[.35,1.23-.70*fall,.31+.15*fall];widen=.28;lead=-.10*fall;break;
    }
  }
  pelvis(...hip);upperBody(turn,lean,tilt);feet(widen,0,lead,spec.name.endsWith('injured')?.9:0);arms(right,left);
  // Preserve smooth, normalized bone rotations. Sword is a separate attachment
  // mounted on RightHand in the preview/runtime, not baked into the skin.
  scene.updateMatrixWorld(true);
}
const blocks=[originalBin];let cursor=originalBin.length;
function accessor(data,type){
  const b=Buffer.from(new Float32Array(data).buffer);
  const view=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:cursor,byteLength:b.length});
  blocks.push(b);cursor+=b.length;
  const item={bufferView:view,componentType:5126,count:data.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type};
  if(type==='SCALAR'){item.min=[Math.min(...data)];item.max=[Math.max(...data)];}
  gltf.accessors.push(item);return gltf.accessors.length-1;
}
for(const spec of poses){
  if(gltf.animations.some(a=>a.name===spec.name)) throw Error('Clipe já existe: '+spec.name);
  const steps=Math.ceil(spec.duration*24);
  const times=Array.from({length:steps+1},(_,i)=>Math.fround(i*spec.duration/steps));
  const rotations=new Map(joints.map(i=>[i,[]]));const hip=[];
  for(const t of times){
    pose(spec,t);
    for(const i of joints){
      const q=nodes[i].quaternion.clone().normalize(), track=rotations.get(i);
      if(track.length&&q.dot(new T.Quaternion().fromArray(track,track.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);
      track.push(...q.toArray());
    }
    hip.push(...bones.Hips.position.toArray());
  }
  const input=accessor(times,'SCALAR');
  const animation={name:spec.name,extras:{kind:'pvp-review',label:spec.label,impact:spec.impact,artRef:'10 imagens conceituais Hunter espada',source:'skeletal-authoring-v06'},samplers:[],channels:[]};
  for(const [index,values] of rotations){
    const sampler=animation.samplers.length;
    animation.samplers.push({input,output:accessor(values,'VEC4'),interpolation:'LINEAR'});
    animation.channels.push({sampler,target:{node:index,path:'rotation'}});
  }
  const sampler=animation.samplers.length;
  animation.samplers.push({input,output:accessor(hip,'VEC3'),interpolation:'LINEAR'});
  animation.channels.push({sampler,target:{node:nodes.indexOf(bones.Hips),path:'translation'}});
  gltf.animations.push(animation);
}
const same=['nodes','meshes','skins','materials','textures','images'].every(k=>JSON.stringify(gltf[k])===JSON.stringify(original[k]));
if(!same)throw Error('Contrato de malha/rig/textura original foi modificado');
gltf.buffers[0].byteLength=cursor;
const bin=Buffer.concat(blocks);
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
binHeader.writeUInt32LE(bin.length);binHeader.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,json,binHeader,bin]);
const sha=x=>createHash('sha256').update(x).digest('hex');
await mkdir(outDir,{recursive:true});
await writeFile(new URL('hunter_pvp_v06.glb',outDir),result);
const manifest={version:'pvp-v06',status:'experimental-awaiting-director-approval',source:'labs/hunters/assets/hunter-v05/hunter_combat_v05.glb',sourceSha256:sha(raw),file:'hunter_pvp_v06.glb',bytes:result.length,sha256:sha(result),triangles:1000,joints:19,originalClips:gltf.animations.length-poses.length,newClips:poses.map(p=>({...p,samples:Math.ceil(p.duration*24)+1})),originalContractsUnchanged:same,originalBinaryPrefixUnchanged:bin.subarray(0,originalBin.length).equals(originalBin),generator:'labs/hunters/scripts/animate-hunter-pvp-v06.mjs',limitations:'Provisional authored body poses: blade is a separate visual attachment. Artistic and game/terrain IK review pending. No Alpha integration.'};
await writeFile(new URL('manifest.json',outDir),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({file:new URL('hunter_pvp_v06.glb',outDir).pathname,bytes:result.length,sha256:manifest.sha256,originalClips:manifest.originalClips,newClips:poses.length}));