/**
 * WILDHAVEN — Hunter PvP v07, SINGLE-SLASH experimental authoring.
 * Creates one motion on the real Hunter v05 rig and one sword mesh on a bone socket.
 * No Alpha or previous asset modification. Source file remains the approved v05.
 * Written for Node 22 and three@0.181 from the existing hunters-codex lab.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../hunters-codex/node_modules/three/build/three.module.js';

const SOURCE=new URL('../assets/hunter-v05/hunter_combat_v05.glb',import.meta.url);
const OUT=new URL('../assets/hunter-pvp-v07/',import.meta.url);
const raw=await readFile(SOURCE);
if(raw.toString('ascii',0,4)!=='glTF'||raw.readUInt32LE(4)!==2||raw.readUInt32LE(8)!==raw.length)throw Error('Source v05 is not valid GLB 2.0');
const jlen=raw.readUInt32LE(12);
const doc=JSON.parse(raw.toString('utf8',20,20+jlen));
const original=structuredClone(doc);
const originalBin=raw.subarray(28+jlen);
if(doc.skins.length!==1||doc.skins[0].joints.length!==19)throw Error('Expected original 19-bone Hunter skin');
if(doc.animations.length<80||!doc.animations.find(c=>c.name==='combat_guard'))throw Error('Expected the existing Hunter v05 combat clips');

const nodes=doc.nodes.map(n=>{const o=new T.Object3D();o.name=n.name;
 if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}
 else{o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);}
 return o;});
doc.nodes.forEach((n,i)=>(n.children??[]).forEach(child=>nodes[i].add(nodes[child])));
const scene=new T.Scene();for(const i of doc.scenes[doc.scene??0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);
const B=Object.fromEntries(nodes.map(o=>[o.name,o]));
const names=['Hips','Spine','Spine02','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
for(const n of names)if(!B[n])throw Error('Missing rig node '+n);
const originalTransforms=nodes.map(o=>({p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
const restWorld=Object.fromEntries(nodes.map(o=>[o.name,{pos:o.getWorldPosition(new T.Vector3()),q:o.getWorldQuaternion(new T.Quaternion())}]));
const V=(x,y,z)=>new T.Vector3(x,y,z), Q=()=>new T.Quaternion();
const xClamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=xClamp(x);return x*x*(3-2*x);};
function mix(a,b,w){return a+(b-a)*w;}
function reset(){nodes.forEach((o,i)=>{o.position.copy(originalTransforms[i].p);o.quaternion.copy(originalTransforms[i].q);o.scale.copy(originalTransforms[i].s);});scene.updateMatrixWorld(true);}
function segmentPose(keys,t){
 if(t<=keys[0].t)return structuredClone(keys[0]);
 for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1];if(t<=b.t){const r=ease((t-a.t)/(b.t-a.t));const p={t};for(const key of Object.keys(a)){if(key==='t')continue;p[key]=Array.isArray(a[key])?a[key].map((v,j)=>mix(v,b[key][j],r)):mix(a[key],b[key],r);}return p;}}
 return structuredClone(keys.at(-1));
}
function setWorldPos(bone,p){bone.position.copy(bone.parent.worldToLocal(p));scene.updateMatrixWorld(true);}
function aim(parent,child,target){const a=parent.getWorldPosition(V()),v=child.getWorldPosition(V()).sub(a).normalize(),desired=target.clone().sub(a).normalize();if(v.lengthSq()<1e-9||desired.lengthSq()<1e-9)return;
 const applied=Q().setFromUnitVectors(v,desired).multiply(parent.getWorldQuaternion(Q()));parent.quaternion.copy(parent.parent.getWorldQuaternion(Q()).invert().multiply(applied));scene.updateMatrixWorld(true);}
const diag={maxHandError:0,maxFootError:0,minArmExtension:999,maxArmExtension:0,sampleCount:0};
function ik(boneName,midName,endName,target,pole){
 const a=B[boneName],b=B[midName],c=B[endName],start=a.getWorldPosition(V()),mid=b.getWorldPosition(V()),end=c.getWorldPosition(V());
 const l1=start.distanceTo(mid),l2=mid.distanceTo(end),delta=target.clone().sub(start);const req=delta.length();
 const dist=xClamp(req,Math.abs(l1-l2)+.0005,l1+l2-.001),dir=delta.normalize();
 const p=pole.clone().sub(start).addScaledVector(dir,-pole.clone().sub(start).dot(dir));
 if(p.lengthSq()<1e-7)p.set(0,0,1);p.normalize();
 const along=(l1*l1-l2*l2+dist*dist)/(2*dist);
 const bend=start.clone().addScaledVector(dir,along).addScaledVector(p,Math.sqrt(Math.max(0,l1*l1-along*along)));
 aim(a,b,bend);aim(b,c,target);
 const error=c.getWorldPosition(V()).distanceTo(target);
 if(boneName==='RightArm'){diag.maxHandError=Math.max(diag.maxHandError,error);diag.minArmExtension=Math.min(diag.minArmExtension,req);diag.maxArmExtension=Math.max(diag.maxArmExtension,req);}else{diag.maxFootError=Math.max(diag.maxFootError,error);}
 return error;
}
function applyRestRotation(bone,rx,ry,rz){bone.quaternion.copy(originalTransforms[nodes.indexOf(bone)].q).multiply(Q().setFromEuler(new T.Euler(rx,ry,rz,'YXZ')));scene.updateMatrixWorld(true);}
// Finger direction follows original RightForeArm -> RightHand axis in the reference bind pose.
// By calibrating this once, the socket always stays aligned with the visible hand.
const originalHandAxis=restWorld.RightHand.pos.clone().sub(restWorld.RightForeArm.pos).normalize();
const restRightHandWorldQ=restWorld.RightHand.q.clone();
const socketGlobalQ=Q().setFromUnitVectors(V(0,0,1),originalHandAxis);
const socketLocalQ=restRightHandWorldQ.clone().invert().multiply(socketGlobalQ);
const socketLocalPos=originalHandAxis.clone().multiplyScalar(.09).applyQuaternion(restRightHandWorldQ.clone().invert());
function pointSword(tipDirection){
 scene.updateMatrixWorld(true);
 const hand=B.RightHand,parent=B.RightForeArm;
 const desired=V(...tipDirection).normalize();
 const q=Q().setFromUnitVectors(originalHandAxis,desired).multiply(restRightHandWorldQ);
 hand.quaternion.copy(parent.getWorldQuaternion(Q()).invert().multiply(q));scene.updateMatrixWorld(true);
 const swordAxis=V(0,0,1).applyQuaternion(hand.getWorldQuaternion(Q()).multiply(socketLocalQ));
 if(swordAxis.distanceTo(desired)>1e-4)throw Error('Grip socket axis deviates from weapon direction');
}
// One deliberate, full-body sword swing; 2.25 seconds to allow readable telegraph and follow-through.
const clip={name:'pvp07_sword_horizontal_review',duration:2.25,impact:1.16,
 phases:{ready:0,anticipation:.26,load:.64,windup:.88,strike:1.16,follow:1.40,recover:1.87,guard:2.25}};
// keyframes: time, pelvis XYZ, pelvis yaw, spine yaw, spine pitch/roll, wrist world XYZ,
// free hand XYZ, blade pointing XYZ, lead-foot step, body crouch, neck counterrotation.
// The free hand stays at or below chest height and moves naturally, NOT in a permanent high guard.
const keys=[
 {t:0,    hip:[0,-.045,0],   hipYaw:-.05,spineYaw:.08,spinePitch:.04,spineRoll:0, wrist:[-.24,1.12,.23],free:[.39,.85,.06],dir:[-.27,.65,.70],step:0,crouch:0,neck:0},
 {t:.26,  hip:[-.04,-.060,-.035],hipYaw:-.13,spineYaw:-.18,spinePitch:.08,spineRoll:-.03,wrist:[-.32,1.09,.05],free:[.39,.83,.05],dir:[-.79,.22,-.54],step:0,crouch:.15,neck:.06},
 {t:.64,  hip:[-.065,-.098,-.080],hipYaw:-.27,spineYaw:-.47,spinePitch:.08,spineRoll:-.06,wrist:[-.38,1.16,-.07],free:[.37,.82,.08],dir:[-.94,.12,-.33],step:0,crouch:.42,neck:.16},
 {t:.88,  hip:[-.06,-.110,-.09],hipYaw:-.34,spineYaw:-.57,spinePitch:.09,spineRoll:-.07,wrist:[-.40,1.21,-.08],free:[.37,.81,.07],dir:[-.95,.05,.03],step:0,crouch:.48,neck:.23},
 {t:1.03, hip:[.00,-.111,.04],hipYaw:-.08,spineYaw:-.16,spinePitch:.09,spineRoll:.02,wrist:[-.22,1.18,.34],free:[.39,.86,.12],dir:[-.48,-.05,.87],step:.10,crouch:.35,neck:.12},
 {t:1.16, hip:[.07,-.118,.13],hipYaw:.17,spineYaw:.40,spinePitch:.13,spineRoll:.07,wrist:[-.19,1.17,.44],free:[.42,.91,.12],dir:[.87,.01,.49],step:.22,crouch:.40,neck:-.15},
 {t:1.40, hip:[.085,-.097,.16],hipYaw:.19,spineYaw:.42,spinePitch:.10,spineRoll:.09,wrist:[-.24,1.09,.43],free:[.40,.90,.12],dir:[.96,-.03,.28],step:.22,crouch:.24,neck:-.20},
 {t:1.87, hip:[.035,-.065,.075],hipYaw:.10,spineYaw:.20,spinePitch:.05,spineRoll:.02,wrist:[-.20,1.09,.27],free:[.39,.85,.08],dir:[-.06,.72,.69],step:.15,crouch:.06,neck:-.02},
 {t:2.25, hip:[0,-.045,0],hipYaw:-.05,spineYaw:.08,spinePitch:.04,spineRoll:0,wrist:[-.24,1.12,.23],free:[.39,.85,.06],dir:[-.27,.65,.70],step:0,crouch:0,neck:0}
];
function pose(time){reset();const k=segmentPose(keys,time);if(k.free[1]>1.05)throw Error('Unarmed wrist raised in v07: '+k.free[1]);const hip=B.Hips;const hp=restWorld.Hips.pos.clone().add(V(...k.hip));setWorldPos(hip,hp);
 // Rotate pelvis for weight-transfer and lower-body facing; layered torso provides follow-through.
 applyRestRotation(hip,0,k.hipYaw,0);applyRestRotation(B.Spine02,k.spinePitch*.34,k.spineYaw*.38,k.spineRoll*.35);
 applyRestRotation(B.Spine,k.spinePitch*.66,k.spineYaw*.62,k.spineRoll*.65);
 if(B.neck)applyRestRotation(B.neck,-.015,k.neck,0);
 const frontFoot=restWorld.LeftFoot.pos.clone().add(V(.125,0,.12+k.step));
 const backFoot=restWorld.RightFoot.pos.clone().add(V(-.105,0,-.10));
 // Lead foot lifts and re-plants only within the step interval; planted otherwise.
 const st=xClamp((time-.88)/.27);if(time>=.88&&time<=1.15)frontFoot.y+=.085*Math.sin(Math.PI*st);
 const resetStep=xClamp((time-1.40)/.85);if(time>1.40)frontFoot.y+=.075*Math.sin(Math.PI*resetStep);
 ik('LeftUpLeg','LeftLeg','LeftFoot',frontFoot,V(frontFoot.x,.38,frontFoot.z+.34));
 ik('RightUpLeg','RightLeg','RightFoot',backFoot,V(backFoot.x,.40,backFoot.z+.35));
 const wr=V(...k.wrist),free=V(...k.free);
 ik('RightArm','RightForeArm','RightHand',wr,V(-.50,1.11,.19));
 ik('LeftArm','LeftForeArm','LeftHand',free,V(.45,.68,-.16));
 pointSword(k.dir);
 scene.updateMatrixWorld(true);diag.sampleCount++;
}

// Appending typed data to original GLB buffer, with accessor byte alignment.
let chunks=[originalBin],cursor=originalBin.length;
function append(data){const buf=Buffer.isBuffer(data)?data:Buffer.from(data.buffer,data.byteOffset,data.byteLength);const pad=(4-cursor%4)%4;if(pad){chunks.push(Buffer.alloc(pad));cursor+=pad;}const start=cursor;chunks.push(buf);cursor+=buf.length;return{start,length:buf.length};}
function bufferAccessor(data,type,componentType=5126,min,max){const {start,length}=append(data);const index=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:start,byteLength:length});const dimensions={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};const accessor={bufferView:index,componentType,count:data.length/dimensions[type],type};if(min)accessor.min=min;if(max)accessor.max=max;doc.accessors.push(accessor);return doc.accessors.length-1;}
// Bake the ONE clip at 45 fps with additional exact event timestamps.
const times=Array.from({length:Math.ceil(clip.duration*45)+1},(_,i)=>Math.fround(i*clip.duration/Math.ceil(clip.duration*45)));
for(const k of keys)times.push(Math.fround(k.t));times.sort((a,b)=>a-b);
const uniqueTimes=[...new Set(times)];
const rotations=new Map(doc.skins[0].joints.map(i=>[i,[]]));const hips=[];
for(const t of uniqueTimes){pose(t);for(const [i,v] of rotations){const q=nodes[i].quaternion.clone().normalize();if(v.length&&q.dot(Q().fromArray(v,v.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);v.push(...q.toArray());}hips.push(...B.Hips.position.toArray());}
const inp=bufferAccessor(new Float32Array(uniqueTimes),'SCALAR',5126,[0],[clip.duration]);
const anim={name:clip.name,extras:{kind:'pvp-sword-artistic-review',impact:clip.impact,phases:clip.phases,weaponSocket:'WeaponSocket_Right_PvP07',sourceGlb:'hunter_combat_v05.glb',hand: 'right',freeHand:'contextual-relaxed'},samplers:[],channels:[]};
for(const [id,values] of rotations){const s=anim.samplers.length;anim.samplers.push({input:inp,output:bufferAccessor(new Float32Array(values),'VEC4'),interpolation:'LINEAR'});anim.channels.push({sampler:s,target:{node:id,path:'rotation'}});}
const s=anim.samplers.length;anim.samplers.push({input:inp,output:bufferAccessor(new Float32Array(hips),'VEC3'),interpolation:'LINEAR'});anim.channels.push({sampler:s,target:{node:nodes.indexOf(B.Hips),path:'translation'}});
doc.animations.push(anim);

// Sword is a REAL glTF mesh (NOT a floating viewer proxy). Mounted to RightHand
// through a calibrated transform, so the entire grip moves as one rigid system.
const materialStart=doc.materials.length;
for(const [name,color,metallic,rough] of [
 ['PvP07_SteelBlade',[.72,.77,.80,1],.72,.35],
 ['PvP07_DarkGrip',[.19,.115,.07,1],.05,.91],
 ['PvP07_BronzeGuard',[.40,.36,.32,1],.65,.42]
])doc.materials.push({name,pbrMetallicRoughness:{baseColorFactor:color,metallicFactor:metallic,roughnessFactor:rough},doubleSided:false});
function prism(width,height,z0,z1){
 // rectangular cross-section along local +Z
 const x=width/2,y=height/2,p=[[-x,-y,z0],[x,-y,z0],[x,y,z0],[-x,y,z0],[-x,-y,z1],[x,-y,z1],[x,y,z1],[-x,y,z1]];
 const faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
 const verts=[],normals=[],indices=[];
 for(const f of faces){const a=V(...p[f[0]]),b=V(...p[f[1]]),c=V(...p[f[2]]),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const k=verts.length/3;for(const ix of f){verts.push(...p[ix]);normals.push(...n.toArray());}indices.push(k,k+1,k+2,k,k+2,k+3);}
 return {verts,normals,indices};
}
function shapePrimitives(list){return list.map(({width,height,z0,z1,material})=>{const geom=prism(width,height,z0,z1);return {attributes:{POSITION:bufferAccessor(new Float32Array(geom.verts),'VEC3'),NORMAL:bufferAccessor(new Float32Array(geom.normals),'VEC3')},indices:bufferAccessor(new Uint16Array(geom.indices),'SCALAR',5123),mode:4,material:materialStart+material};});}
const swordMeshId=doc.meshes.length;
doc.meshes.push({name:'PvP07_OneHanded_Sword_Real_Mesh',primitives:shapePrimitives([
 {width:.052,height:.030,z0:.14,z1:.86,material:0},
 {width:.038,height:.024,z0:.86,z1:.98,material:0},
 {width:.055,height:.060,z0:-.14,z1:.15,material:1},
 {width:.23,height:.062,z0:.10,z1:.17,material:2},
 {width:.07,height:.070,z0:-.19,z1:-.14,material:2}
])});
const rightIdx=nodes.indexOf(B.RightHand);
const socketId=doc.nodes.length;
doc.nodes.push({name:'WeaponSocket_Right_PvP07',translation:socketLocalPos.toArray(),rotation:socketLocalQ.toArray(),children:[socketId+1]});
doc.nodes.push({name:'PvP07_SwordAttachedToRightHand',mesh:swordMeshId});
doc.nodes[rightIdx].children=[...(doc.nodes[rightIdx].children??[]),socketId];
// The new mesh is not skinned; inherited socket transform follows the animated right palm.
for(const field of ['skins','textures','images'])if(JSON.stringify(doc[field])!==JSON.stringify(original[field]))throw Error('Original '+field+' modified');
for(let i=0;i<original.meshes.length;i++)if(JSON.stringify(doc.meshes[i])!==JSON.stringify(original.meshes[i]))throw Error('Original Hunter mesh altered');
for(let i=0;i<original.materials.length;i++)if(JSON.stringify(doc.materials[i])!==JSON.stringify(original.materials[i]))throw Error('Original Hunter material altered');
for(let i=0;i<original.animations.length;i++)if(JSON.stringify(doc.animations[i])!==JSON.stringify(original.animations[i]))throw Error('Original Hunter clip altered');
if(diag.maxHandError>.075||diag.maxFootError>.065)throw Error('IK target error exceeds tolerance: '+JSON.stringify(diag));
const bin=Buffer.concat(chunks);doc.buffers[0].byteLength=bin.length;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,json,bh,bin]);
const sha=x=>createHash('sha256').update(x).digest('hex');
await mkdir(OUT,{recursive:true});await writeFile(new URL('hunter_pvp_v07.glb',OUT),result);
const manifest={version:'pvp-v07-single-swing-review',status:'pending-art-director-approval',source:'labs/hunters/assets/hunter-v05/hunter_combat_v05.glb',sourceSha256:sha(raw),file:'hunter_pvp_v07.glb',sha256:sha(result),bytes:result.length,characterTriangles:1000,skinJoints:19,oldClips:original.animations.length,newClips:[clip],frames:uniqueTimes.length,integratedSword:true,weaponSocket:'WeaponSocket_Right_PvP07',socketTranslation:socketLocalPos.toArray(),socketRotation:socketLocalQ.toArray(),originalBinaryPrefixUnchanged:bin.subarray(0,originalBin.length).equals(originalBin),originalModelsAndSkinUntouched:true,ikDiagnostics:diag,limitations:'Only horizontal sword swing, experimental. No Alpha integration or director approval.'};
await writeFile(new URL('manifest.json',OUT),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({file:manifest.file,sha256:manifest.sha256,bytes:manifest.bytes,oldClips:manifest.oldClips,newClips:1,ik:diag,socket:manifest.socketTranslation}));