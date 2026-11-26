// Baked skeletal animation authoring on the original 19-joint rig. No mesh, weights or rig modifications.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../hunters-codex/node_modules/three/build/three.module.js';
const source=new URL('../../hunters-codex/assets/hunter_masculino_1000tri_v02.glb',import.meta.url),out=new URL('../assets/hunter-v04/',import.meta.url);
const raw=await readFile(source),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.toString('utf8',20,20+jl)),originalBin=raw.subarray(28+jl),original=structuredClone(doc);
const objects=doc.nodes.map(n=>{const o=new T.Object3D();o.name=n.name;if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}else{o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);}return o;});
doc.nodes.forEach((n,i)=>(n.children??[]).forEach(k=>objects[i].add(objects[k])));const scene=new T.Scene();doc.scenes[doc.scene??0].nodes.forEach(i=>scene.add(objects[i]));scene.updateMatrixWorld(true);
const byName=Object.fromEntries(objects.map(o=>[o.name,o])),joints=doc.skins[0].joints,base=objects.map(o=>({p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()})),worldBase=Object.fromEntries(objects.map(o=>[o.name,o.getWorldPosition(new T.Vector3())]));
const restFootRot=Object.fromEntries(['Left','Right'].map(side=>[side,byName[side+'Foot'].getWorldQuaternion(new T.Quaternion())]));
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
function reset(){objects.forEach((o,i)=>{o.position.copy(base[i].p);o.quaternion.copy(base[i].q);o.scale.copy(base[i].s);});scene.updateMatrixWorld(true);}
function rotateToward(bone,child,target){const p=bone.getWorldPosition(new T.Vector3()),v=child.getWorldPosition(new T.Vector3()).sub(p).normalize(),want=target.clone().sub(p).normalize();const q=new T.Quaternion().setFromUnitVectors(v,want).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));scene.updateMatrixWorld(true);}
function ik(upper,middle,end,target,bend){const a=byName[upper],b=byName[middle],c=byName[end],start=a.getWorldPosition(new T.Vector3()),bp=b.getWorldPosition(new T.Vector3()),cp=c.getWorldPosition(new T.Vector3()),l1=start.distanceTo(bp),l2=bp.distanceTo(cp),axis=target.clone().sub(start);const d=Math.min(l1+l2-.0001,Math.max(Math.abs(l1-l2)+.0001,axis.length()));axis.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),up=bend.clone().sub(start);up.addScaledVector(axis,-up.dot(axis)).normalize();const elbow=start.clone().addScaledVector(axis,along).addScaledVector(up,Math.sqrt(Math.max(0,l1*l1-along*along)));rotateToward(a,b,elbow);rotateToward(b,c,target);}
function arms(right,left){ik('RightArm','RightForeArm','RightHand',new T.Vector3(...right),new T.Vector3(-.43,1.04,.03));ik('LeftArm','LeftForeArm','LeftHand',new T.Vector3(...left),new T.Vector3(.43,1.08,.11));}
function hipOffset(y){const hip=byName.Hips,p=worldBase.Hips.clone();p.y+=y;hip.position.copy(hip.parent.worldToLocal(p));scene.updateMatrixWorld(true);}
function feet(phase,vector=[0,0],amount=.32){for(const side of ['Left','Right']){const p=worldBase[side+'Foot'].clone(),s=side==='Left'?1:-1,wave=Math.sin(phase+s*Math.PI/2);p.x+=vector[0]*wave*amount;p.z+=vector[1]*wave*amount;p.y+=Math.max(0,Math.cos(phase+s*Math.PI/2))*.07;ik(side+'UpLeg',side+'Leg',side+'Foot',p,new T.Vector3(p.x,.45,p.z+.3));}}
function gait(u,stride,lift,stance){
 for(const side of ['Left','Right']){const phase=(u+(side==='Left'?0:.5))%1,p=worldBase[side+'Foot'].clone();
 if(phase<stance){p.z+=stride*(.5-phase/stance)*stance;}else{const v=(phase-stance)/(1-stance);p.z+=stride*(-.5+smooth(v))*stance;p.y+=Math.sin(v*Math.PI)*lift;}
 ik(side+'UpLeg',side+'Leg',side+'Foot',p,new T.Vector3(p.x,.45,p.z+.45));
 const foot=byName[side+'Foot'];foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(restFootRot[side]));
 }
}
function torso(yaw,lean=0){const b=byName.Spine??byName.Hips;b.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(lean,yaw,0)));scene.updateMatrixWorld(true);}
function groundPose(progress){const hip=byName.Hips,q=hip.getWorldQuaternion(new T.Quaternion()),rot=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2*progress).multiply(q);hip.quaternion.copy(hip.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rot));const p=worldBase.Hips.clone();p.y=mix(p.y,.20,progress);hip.position.copy(hip.parent.worldToLocal(p));scene.updateMatrixWorld(true);}
const specs=[
 {name:'combat_guard',duration:1.2,kind:'guard'},
 ...[['forward',[0,1]],['back',[0,-1]],['left',[1,0]],['right',[-1,0]]].map(([n,v])=>({name:'combat_step_'+n,duration:.85,kind:'step',vector:v})),
 {name:'combat_turn_left',duration:.7,kind:'step',vector:[1,.15]}, {name:'combat_turn_right',duration:.7,kind:'step',vector:[-1,.15]},
 ...['spear','sword'].flatMap(weapon=>[false,true].map(heavy=>{const prep=(weapon==='spear'?.48:.32)*(heavy?1.7:1),recover=(weapon==='spear'?.85:.65)*(heavy?1.4:1);return{name:weapon+'_'+(heavy?'heavy':'light'),kind:'attack',weapon,heavy,impact:prep,duration:prep+recover};})),
 {name:'combat_block',duration:.7,kind:'block'}, {name:'combat_dodge',duration:.65,kind:'dodge'},
 {name:'combat_hit',duration:.5,kind:'hit'},{name:'combat_stagger',duration:.8,kind:'hit'},
 {name:'combat_knockdown',duration:1.2,kind:'fall'},{name:'combat_get_up',duration:1.2,kind:'rise'},
 {name:'combat_death',duration:1.5,kind:'fall'}, {name:'combat_surrender',duration:1.1,kind:'surrender'},
 {name:'combat_recover',duration:.8,kind:'recover'}
];
specs.push(...['','_high','_low'].map(variant=>({name:'spear_counter'+variant,kind:'attack',weapon:'spear',move:'counter',variant,heavy:false,impact:.26,duration:.76})),
 {name:'hunter_walk',kind:'gait',duration:1.05,stride:1.20,lift:.09,stance:.62},
 {name:'hunter_jog',kind:'gait',duration:.80,stride:1.85,lift:.14,stance:.48},
 {name:'hunter_run',kind:'gait',duration:.70,stride:2.60,lift:.20,stance:.35},
 ...['spear','sword','greatsword','unarmed'].flatMap(weapon=>{
 const profile={spear:[.40,.58,.78,1.05],sword:[.29,.38,.62,.80],greatsword:[.65,.78,1.15,1.25],unarmed:[.28,.40,.52,.65]}[weapon];
 return ['light','follow','finish','heavy'].flatMap(move=>{
 const heavy=move==='heavy',impact=heavy?profile[2]:profile[0]*(move==='follow'||move==='finish'?.88:1),duration=impact+(heavy?profile[3]:profile[1]);
 return ['', '_high','_low'].map(variant=>({name:weapon+'_'+move+variant,kind:'attack',weapon,heavy,move,variant,impact,duration}));
 });
 })
);
// Revised versions of the v03 light/heavy clips replace same-name generated clips in this new asset only.
const unique=new Map(specs.map(s=>[s.name,s]));specs.splice(0,specs.length,...unique.values());
const chunks=[originalBin];let offset=originalBin.length;
function accessor(array,type){const buffer=Buffer.from(new Float32Array(array).buffer),bv=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:buffer.length});chunks.push(buffer);offset+=buffer.length;const count=array.length/(type==='SCALAR'?1:type==='VEC3'?3:4),a={bufferView:bv,componentType:5126,count,type};if(type==='SCALAR'){a.min=[Math.min(...array)];a.max=[Math.max(...array)];}doc.accessors.push(a);return doc.accessors.length-1;}
const evidence=[];
for(const spec of specs){const steps=Math.ceil(spec.duration*24),times=Array.from({length:steps+1},(_,i)=>i/steps*spec.duration),rotations=new Map(joints.map(i=>[i,[]])),hipPositions=[],handSamples=[];
 for(const t of times){reset();const u=t/spec.duration,phase=u*Math.PI*2;hipOffset(-.018+Math.sin(phase)*.004);arms([-.20,1.17,.24],[.23,1.25,.32]);
  if(spec.kind==='step'){hipOffset(-.025+Math.cos(phase*2)*.012);feet(phase,spec.vector,.25);}
  if(spec.kind==='gait'){const run=spec.name==='hunter_run',jog=spec.name==='hunter_jog';hipOffset((run?-.12:jog?-.11:-.06)+Math.cos(phase*2)*.010);torso(Math.sin(phase)*.065,run?.13:jog?.08:.025);gait(u,spec.stride,spec.lift,spec.stance);arms([-.20,1.14+Math.sin(phase)*.06,.14+Math.sin(phase)*(run?.23:.13)],[.23,1.19-Math.sin(phase)*.06,.19-Math.sin(phase)*(run?.23:.13)]);}
  if(spec.kind==='attack'){const peak=spec.impact,wind=smooth(t/Math.max(.1,peak*.65)),strike=smooth((t-peak*.65)/(peak*.35)),recover=smooth((t-peak)/(spec.duration-peak));
   const swing=t<peak?strike:1-recover,finish=spec.move==='finish',follow=spec.move==='follow',height=spec.variant==='_high'?1.40:spec.variant==='_low'?.88:1.16;
   const sword=spec.weapon==='sword'||spec.weapon==='greatsword',big=spec.weapon==='greatsword',reverse=follow?-1:1;
   torso((sword?reverse*(mix(-.28,.34,strike)):(-.10+.16*strike))*(1-recover),big?.08*Math.sin(u*Math.PI):0);
   let x=sword?reverse*mix(-.32,.16,strike)*(1-recover)-.20*recover:-.15;
   let z=t<peak?mix(.03,.47,strike):mix(.47,.24,recover),y=height;
   if(big){y=t<peak?mix(1.48,height,strike):mix(height,1.17,recover);z=t<peak?mix(-.12,.43,strike):mix(.43,.24,recover);}
   if(spec.weapon==='unarmed'){x=follow?.12:-.16;z=t<peak?mix(.12,.50,strike):mix(.50,.24,recover);}
   arms([x,y,z],big?[.06,y-.05,z-.06]:spec.weapon==='spear'?[.15,1.18,z*.80]:[.23,1.24,.29]);
   hipOffset(-.025-(big?.06:spec.heavy?.035:.015)*Math.sin(u*Math.PI));feet(0,[0,0],0);
  }
  if(spec.kind==='block')arms([-.12,1.30,.30],[.12,1.34,.39]);
  if(spec.kind==='dodge'){const dip=Math.sin(u*Math.PI);hipOffset(-.11*dip);feet(phase,[1,0],.20);arms([-.16,1.13-.08*dip,.25],[.18,1.20-.08*dip,.30]);}
  if(spec.kind==='hit'){hipOffset(-Math.sin(u*Math.PI)*.05);arms([-.27,1.16,.16],[.28,1.22,.24]);}
  if(spec.kind==='recover'){hipOffset(-.04*Math.sin(u*Math.PI));arms([-.2,1.13,.18],[.23,1.22,.25]);}
  if(spec.kind==='surrender'){const k=smooth(u);arms([mix(-.2,-.28,k),mix(1.17,1.62,k),mix(.24,.08,k)],[mix(.23,.29,k),mix(1.25,1.62,k),mix(.32,.08,k)]);}
  if(spec.kind==='fall'||spec.kind==='rise')groundPose(spec.kind==='fall'?smooth(u):1-smooth(u));
  scene.updateMatrixWorld(true);for(const i of joints){let q=objects[i].quaternion.clone().normalize(),track=rotations.get(i);if(track.length&&q.dot(new T.Quaternion().fromArray(track,track.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);track.push(...q.toArray());}hipPositions.push(...byName.Hips.position.toArray());handSamples.push({t,right:byName.RightHand.getWorldPosition(new T.Vector3()).toArray()});
 }
 const input=accessor(times,'SCALAR'),animation={name:spec.name,extras:{impact:spec.impact??null,stride:spec.stride??(spec.kind==='step'?.50:null),kind:spec.kind,stance:spec.stance??.62},samplers:[],channels:[]};for(const[i,values]of rotations){const sampler=animation.samplers.length;animation.samplers.push({input,output:accessor(values,'VEC4'),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:i,path:'rotation'}});}const sampler=animation.samplers.length;animation.samplers.push({input,output:accessor(hipPositions,'VEC3'),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:objects.indexOf(byName.Hips),path:'translation'}});doc.animations.push(animation);evidence.push({...spec,samples:times.length,handSamples});
}
doc.buffers[0].byteLength=offset;const bin=Buffer.concat(chunks);let j=Buffer.from(JSON.stringify(doc));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+bin.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const result=Buffer.concat([header,j,bh,bin]);await writeFile(new URL('hunter_combat_v04.glb',out),result);
const hash=x=>createHash('sha256').update(x).digest('hex');const unchanged=['nodes','meshes','skins','materials','textures','images'].every(k=>JSON.stringify(original[k])===JSON.stringify(doc[k]));if(!unchanged)throw Error('Original asset contract changed');
await writeFile(new URL('manifest.json',out),JSON.stringify({source:'wildhaven PR81 Hunter v02',sourceSha256:hash(raw),file:'hunter_combat_v04.glb',sha256:hash(result),bytes:result.length,triangles:1000,joints:19,skins:1,originalContractsUnchanged:unchanged,originalBinaryPrefixUnchanged:bin.subarray(0,originalBin.length).equals(originalBin),originalClipsPreserved:['Walking','Running'],newClips:evidence.map(({handSamples,...s})=>s),sourceGenerator:'labs/hunters/scripts/animate-hunter-v04.mjs',status:'experimental-animation-review',limitations:'Original mesh/rig retained; authored skeletal clips and viewer terrain foot locks are experimental, requiring artistic review.'},null,2));await writeFile(new URL('../resultados/jogador/animation-authoring-v04.json',import.meta.url),JSON.stringify(evidence));console.log({clips:doc.animations.length,bytes:result.length,unchanged});
