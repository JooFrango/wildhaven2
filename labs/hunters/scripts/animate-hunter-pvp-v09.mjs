/**
 * WILDHAVEN — Hunter PvP v09, corte horizontal (direita -> esquerda), autoria experimental.
 * Fonte: Hunter v05 aprovado (19 ossos, 1000 tri, 83 clipes). Nada da v05..v08 é alterado:
 * o clipe novo e a espada são ANEXADOS ao JSON/BIN, prefixo binário original preservado.
 *
 * Diferenças estruturais em relação à v08 (reprovada):
 *  - Empunhadura: o cabo cruza a palma na diagonal (75° do eixo da mão),
 *    sob a palma — na v08 o cabo era o prolongamento do antebraço e atravessava a mão.
 *  - Punho: orientação da mão é resolvida a partir da direção da lâmina com restrição de
 *    empunhadura rígida; a pronação/supinação é dividida entre antebraço e mão.
 *  - Corpo: quadril conduz, ombros atrasam (separação quadril/ombro), clavícula protrai no
 *    contato, passo do pé da frente, pivô e calcanhar do pé de trás, pés planos no chão.
 *  - Braço estende de verdade no contato (~150°), dobra no follow-through.
 * Somente animação. Nenhuma lógica de combate/dano/IA.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../hunters-codex/node_modules/three/build/three.module.js';

const SOURCE=new URL('../assets/hunter-v05/hunter_combat_v05.glb',import.meta.url);
// --v10: same cut + finger curl rig (2 bones per hand) in a new GLB. Without the flag the v09 output is reproduced byte for byte.
// --v11: v10 (finger rig + approved cut) plus the reverse horizontal cut. V10 below means "finger rig on".
// --v12: biblioteca PvP NOVA (guarda fechada, corte horizontal e bloqueio autorados do zero sobre o rig v11
// com dedos). Os 83 clipes da v05 continuam no arquivo como histórico e NÃO são usados pelo PvP v12.
// --pve1: biblioteca PvE v01 (contrato hunter-pve-v01). Mesmo rig e mesmos clipes da v12, mais os clipes pve1_*,
// num GLB próprio. Sem a flag, a v12 é reproduzida byte a byte.
const PVE=process.argv.includes('--pve1');
const V12=process.argv.includes('--v12')||PVE,V11=process.argv.includes('--v11')||V12,V10=process.argv.includes('--v10')||V11,VER=V12?'v12':V11?'v11':V10?'v10':'v09',VN=VER.slice(1);
const OUT=new URL(PVE?'../assets/hunter-pve-v01/':`../assets/hunter-pvp-${VER}/`,import.meta.url),FILE=PVE?'hunter_pve_v01.glb':`hunter_pvp_${VER}.glb`;
const CLIP=`pvp${VN}_sword_horizontal_cut`,SOCKET=`WeaponSocket_Right_PvP${VN}`,SWORD=`PvP${VN}_OneHanded_Sword`;
const raw=await readFile(SOURCE);
if(raw.toString('ascii',0,4)!=='glTF'||raw.readUInt32LE(4)!==2||raw.readUInt32LE(8)!==raw.length)throw Error('Source v05 is not valid GLB 2.0');
const jlen=raw.readUInt32LE(12);
const doc=JSON.parse(raw.toString('utf8',20,20+jlen));
const original=structuredClone(doc);
const originalBin=raw.subarray(28+jlen);
if(doc.skins.length!==1||doc.skins[0].joints.length!==19)throw Error('Expected original 19-bone Hunter skin');
if(doc.animations.length!==83)throw Error('Expected the 83 Hunter v05 clips');

const nodes=doc.nodes.map(n=>{const o=new T.Object3D();o.name=n.name;
 if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}
 else{o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);}
 return o;});
doc.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));
const scene=new T.Scene();for(const i of doc.scenes[doc.scene??0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);
const B=Object.fromEntries(nodes.map(o=>[o.name,o]));
for(const n of ['Hips','Spine02','Spine','neck','Head','LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'])if(!B[n])throw Error('Missing rig node '+n);
const rest=nodes.map(o=>({p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()}));
const W=Object.fromEntries(nodes.map(o=>[o.name,{p:o.getWorldPosition(new T.Vector3()),q:o.getWorldQuaternion(new T.Quaternion())}]));
const V=(x,y,z)=>new T.Vector3(x,y,z),Q=()=>new T.Quaternion(),UP=V(0,1,0);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),deg=r=>r*180/Math.PI;
const qAxis=(axis,a)=>Q().setFromAxisAngle(axis,a);

// ---------- v10: finger curl rig. Old clips never animate these bones, so they skin exactly like the hand. ----------
const KNUCKLE=.100,MIDDLE=.152,CURL={Right:[1.30,1.55],Left:[.45,.55]};
const readAcc=i=>{const a=doc.accessors[i],bv=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],C={5126:Float32Array,5121:Uint8Array,5123:Uint16Array}[a.componentType];
 if(bv.byteStride)throw Error('Strided accessor not supported');const off=originalBin.byteOffset+(bv.byteOffset??0)+(a.byteOffset??0);return new C(originalBin.buffer.slice(off,off+a.count*n*C.BYTES_PER_ELEMENT));};
const FINGERS=[];let MESH_P,oldJ,oldW,oldIBM,newJoints,newWeights,newIBM,gripFit=null;
if(V10){
 const prim=doc.meshes[0].primitives[0];MESH_P=readAcc(prim.attributes.POSITION);
 oldJ=readAcc(prim.attributes.JOINTS_0);oldW=readAcc(prim.attributes.WEIGHTS_0);oldIBM=readAcc(doc.skins[0].inverseBindMatrices);
 if(!(oldJ instanceof Uint8Array))throw Error('Expected UNSIGNED_BYTE joints');
 newJoints=oldJ.slice();newWeights=oldW.slice();
 const skinJ=doc.skins[0].joints,extraIBM=[];
 const ramp=(x,a,b)=>clamp((x-a)/(b-a));
 for(const side of ['Right','Left']){
  const hand=B[side+'Hand'],hw=W[side+'Hand'],h=hw.p.clone().sub(W[side+'ForeArm'].p).normalize(),inv=hw.q.clone().invert(),toLocal=v=>v.clone().applyQuaternion(inv);
  const f1=new T.Object3D(),f2=new T.Object3D();f1.name=side+'Fingers1';f2.name=side+'Fingers2';
  f1.position.copy(toLocal(h.clone().multiplyScalar(KNUCKLE)));f2.position.copy(toLocal(h.clone().multiplyScalar(MIDDLE-KNUCKLE)));
  hand.add(f1);f1.add(f2);
  for(const o of [f1,f2]){nodes.push(o);rest.push({p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});B[o.name]=o;doc.nodes.push({name:o.name,translation:o.position.toArray()});}
  const hi=nodes.indexOf(hand),i1=nodes.indexOf(f1),i2=nodes.indexOf(f2);
  doc.nodes[hi].children=[...(doc.nodes[hi].children??[]),i1];doc.nodes[i1].children=[i2];
  // IBM_f = L^-1 · IBM_hand: at rest the finger skin matrix equals the hand's, whatever the bind pose.
  const hj=skinJ.indexOf(hi),IBMh=new T.Matrix4().fromArray(oldIBM,hj*16);
  const L1i=new T.Matrix4().makeTranslation(f1.position).invert(),L2i=new T.Matrix4().makeTranslation(f2.position).invert();
  extraIBM.push(L1i.clone().multiply(IBMh),L2i.clone().multiply(L1i).multiply(IBMh));
  const j1=skinJ.length+FINGERS.length*2,j2=j1+1;
  // Re-weight only vertices bound 100% to the hand: past the knuckles, thumb (front edge, proximal) excluded.
  for(let v=0;v<MESH_P.length/3;v++){
   if(oldJ[v*4]!==hj||oldW[v*4]<.999)continue;
   const p=V(MESH_P[v*3],MESH_P[v*3+1],MESH_P[v*3+2]),d=p.clone().sub(hw.p).dot(h);
   if(p.z-hw.p.z>.055&&d<.125)continue;
   const w2=ramp(d,.142,.162),w1=ramp(d,.092,.112)-w2;if(w1+w2<=0)continue;
   newJoints.set([hj,j1,j2,0],v*4);newWeights.set([1-w1-w2,w1,w2,0],v*4);
  }
  FINGERS.push({side,f1,f2,axis:toLocal(h.clone().cross(V(0,-1,0)).normalize())});   // curls toward the palm
 }
 doc.skins[0].joints=[...skinJ,...FINGERS.flatMap(f=>[nodes.indexOf(f.f1),nodes.indexOf(f.f2)])];
 newIBM=new Float32Array([...oldIBM,...extraIBM.flatMap(m=>m.toArray())]);
 scene.updateMatrixWorld(true);
}
function curlFingers(){for(const f of FINGERS){const [a,b]=CURL[f.side];f.f1.quaternion.copy(qAxis(f.axis,a));f.f2.quaternion.copy(qAxis(f.axis,b));}scene.updateMatrixWorld(true);}
// Linear blend skinning of the base mesh in the current pose (grip fitting and invariance checks).
function skin(J,Wt,IBM,filter=null){const mats=doc.skins[0].joints.slice(0,IBM.length/16).map((n,j)=>nodes[n].matrixWorld.clone().multiply(new T.Matrix4().fromArray(IBM,j*16)));
 const out=[];for(let v=0;v<MESH_P.length/3;v++){if(filter&&![0,1,2,3].some(k=>Wt[v*4+k]>0&&filter.has(J[v*4+k])))continue;
  const p=V(MESH_P[v*3],MESH_P[v*3+1],MESH_P[v*3+2]),acc=V();for(let k=0;k<4;k++){const w=Wt[v*4+k];if(w>0)acc.addScaledVector(p.clone().applyMatrix4(mats[J[v*4+k]]),w);}out.push(acc);}return out;}
function reset(){nodes.forEach((o,i)=>{o.position.copy(rest[i].p);o.quaternion.copy(rest[i].q);o.scale.copy(rest[i].s);});scene.updateMatrixWorld(true);}
function setWorldQ(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(q));scene.updateMatrixWorld(true);}
function rotWorld(bone,q){setWorldQ(bone,q.clone().multiply(bone.getWorldQuaternion(Q())));}
function localRot(bone,rx,ry,rz){bone.quaternion.copy(rest[nodes.indexOf(bone)].q).multiply(Q().setFromEuler(new T.Euler(rx,ry,rz,'YXZ')));scene.updateMatrixWorld(true);}
function aim(parent,child,target){const a=parent.getWorldPosition(V()),v=child.getWorldPosition(V()).sub(a).normalize(),d=target.clone().sub(a).normalize();
 rotWorld(parent,Q().setFromUnitVectors(v,d));}

// ---------- Catmull-Rom/Hermite over key poses (continuous velocity, no stop at each key) ----------
function sample(keys,t){
 t=clamp(t,keys[0].t,keys.at(-1).t);
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],p0=keys[Math.max(0,i-1)],p3=keys[Math.min(keys.length-1,i+2)];
 const dt=b.t-a.t,u=(t-a.t)/dt;
 const h00=2*u**3-3*u**2+1,h10=u**3-2*u**2+u,h01=-2*u**3+3*u**2,h11=u**3-u**2;
 // Keys flagged hold:true have zero tangent: the body "settles" there (charge/guard) instead of gliding through.
 let field;const tan=(k,prev,next,x,xp,xn)=>k.hold?0:(xn-xp)/Math.max(.001,next.t-prev.t);
 const out={t};
 for(const key of Object.keys(a)){if(key==='t'||key==='hold'||key==='label')continue;field=key;
  const f=(x0,x1,xm,xp)=>h00*x0+h10*dt*tan(a,p0,b,x0,xm,x1)+h01*x1+h11*dt*tan(b,a,p3,x1,x0,xp);
  out[key]=Array.isArray(a[key])?a[key].map((v,j)=>f(v,b[key][j],p0[key][j],p3[key][j])):f(a[key],b[key],p0[key],p3[key]);}
 return out;
}

// ---------- Two-bone IK with explicit pole (elbow/knee hint) ----------
const diag={maxHandError:0,maxFootError:0,maxFootSlideOnPlant:0,minElbowDeg:180,maxElbowDeg:0,maxWristDeviationDeg:0,maxForearmTwistDeg:0,twistRangeDeg:[999,-999],
 maxSwordBodyPenetration:0,minFreeHandHeight:9,maxFreeHandHeight:0,samples:0};
function ik(rootN,midN,endN,target,pole){
 const a=B[rootN],b=B[midN],c=B[endN],s=a.getWorldPosition(V()),m=b.getWorldPosition(V()),e=c.getWorldPosition(V());
 const l1=s.distanceTo(m),l2=m.distanceTo(e),delta=target.clone().sub(s),dist=clamp(delta.length(),Math.abs(l1-l2)+.001,l1+l2-.002),dir=delta.normalize();
 const p=pole.clone().sub(s);p.addScaledVector(dir,-p.dot(dir));if(p.lengthSq()<1e-8)p.set(0,-1,0);p.normalize();
 const along=(l1*l1-l2*l2+dist*dist)/(2*dist);
 aim(a,b,s.clone().addScaledVector(dir,along).addScaledVector(p,Math.sqrt(Math.max(0,l1*l1-along*along))));aim(b,c,target);
 return c.getWorldPosition(V()).distanceTo(target);
}

// ---------- Grip calibration in the REST pose (T-pose, faces +Z, right hand at -X, palm down) ----------
const h0=W.RightHand.p.clone().sub(W.RightForeArm.p).normalize();       // wrist -> knuckles
const t0=V(0,0,1).addScaledVector(h0,-h0.z).normalize();                 // thumb side (forward in T-pose)
const n0=h0.clone().cross(t0).normalize();                               // back-of-hand normal (right-handed basis; up in T-pose)
const GRIP=15*Math.PI/180;                                               // handle crosses the palm diagonally: blade 75° from hand axis, tip leaning distally
const b0=t0.clone().multiplyScalar(Math.cos(GRIP)).addScaledVector(h0,Math.sin(GRIP)).normalize();
const restHandQ=W.RightHand.q.clone();
const frameQ=(x,y,z)=>Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
const restFrame=frameQ(h0,t0,n0);
// Socket = fist centre under the palm (low-poly hand has no fingers: handle sits where the closed fingers would be).
const [G1,G0]=V10?[-.10,.115]:[-.075,.07];   // grip ends along the blade axis (pommel side, guard side)
const socketWorldPos=V10?fitGrip():W.RightHand.p.clone().addScaledVector(h0,.088).addScaledVector(n0,-.047);
// v10: place the handle where the curled fingers close on it: most vertices within 1.5 cm of its surface, none inside.
function fitGrip(){
 reset();curlFingers();const J=doc.skins[0].joints,ids=new Set(['RightHand','RightFingers1','RightFingers2'].map(n=>J.indexOf(nodes.indexOf(B[n]))));
 const verts=skin(newJoints,newWeights,newIBM,ids),R=.015;let best=null;
 for(let a=.04;a<=.18;a+=.004)for(let c=-.11;c<=-.01;c+=.004){
  const p=W.RightHand.p.clone().addScaledVector(h0,a).addScaledVector(n0,c);let min=9,touch=0;
  for(const v of verts){const w=v.clone().sub(p),dist=w.distanceTo(b0.clone().multiplyScalar(clamp(w.dot(b0),G1,G0)));min=Math.min(min,dist);if(dist<R+.015)touch++;}
  if(min<R-.002)continue;const score=touch-(min-R)*300;if(!best||score>best.score)best={score,p,min,touch,a,c};}
 reset();if(!best)throw Error('No grip position without finger penetration');gripFit={alongHandM:best.a,palmOffsetM:best.c,minVertexToHandleAxisM:best.min,handleRadiusM:R,vertsWithin15mm:best.touch};return best.p;}
const socketX=h0.clone().addScaledVector(b0,-h0.dot(b0)).normalize();    // edge in line with the knuckles
const socketWorldQ=frameQ(socketX,b0.clone().cross(socketX).normalize(),b0);
const socketLocalQ=restHandQ.clone().invert().multiply(socketWorldQ);
const socketLocalPos=socketWorldPos.clone().sub(W.RightHand.p).applyQuaternion(restHandQ.clone().invert());

// True edge sits on the knuckle side of the grip: the hand axis is fixed by blade + edge direction.
function handAxis(b,edge){const e=edge.clone().addScaledVector(b,-edge.dot(b));if(e.lengthSq()<1e-6)throw Error('Edge parallel to blade');
 return b.clone().multiplyScalar(Math.sin(GRIP)).addScaledVector(e.normalize(),Math.cos(GRIP)).normalize();}
let lastTwist=null;
function orientHand(b,h){
 const f=B.RightHand.getWorldPosition(V()).sub(B.RightForeArm.getWorldPosition(V())).normalize();
 const t=b.clone().addScaledVector(h,-Math.sin(GRIP)).divideScalar(Math.cos(GRIP)).normalize();
 const n=h.clone().cross(t).normalize();
 const handQ=frameQ(h,t,n).multiply(restFrame.clone().invert()).multiply(restHandQ);
 // Pronation/supination lives in the forearm: give it 60% of the hand's twist about the forearm axis.
 const fq=B.RightForeArm.getWorldQuaternion(Q());
 // Twist measured against the REST wrist relation (T-pose palm down), i.e. anatomical pronation/supination.
 const restLocal=rest[nodes.indexOf(B.RightHand)].q,rel=restLocal.clone().invert().multiply(fq.clone().invert().multiply(handQ));
 const axisL=B.RightHand.position.clone().normalize().applyQuaternion(restLocal.clone().invert());
 const proj=V(rel.x,rel.y,rel.z).projectOnVector(axisL);
 const twist=Q().set(proj.x,proj.y,proj.z,rel.w).normalize();
 // Unwrap against the previous frame: near full supination the ±180° wrap would make the forearm snap.
 let tw=2*Math.atan2(V(twist.x,twist.y,twist.z).dot(axisL),twist.w);while(lastTwist!==null&&tw-lastTwist>Math.PI)tw-=2*Math.PI;while(lastTwist!==null&&lastTwist-tw>Math.PI)tw+=2*Math.PI;lastTwist=tw;
 diag.twistRangeDeg=[Math.min(diag.twistRangeDeg[0],deg(tw)),Math.max(diag.twistRangeDeg[1],deg(tw))];
 diag.maxForearmTwistDeg=Math.max(diag.maxForearmTwistDeg,Math.abs(deg(tw)));
 rotWorld(B.RightForeArm,qAxis(f,tw*.6));
 setWorldQ(B.RightHand,handQ);
 diag.maxWristDeviationDeg=Math.max(diag.maxWristDeviationDeg,deg(f.angleTo(h)));
}

// ---------- Feet: planted, flat, yaw + heel pivot about the toe ----------
const TOE=V(0,-.13,.15);   // ankle -> toe-ball offset of the rest foot (world, measured from the mesh)
function foot(side,k,poleOut){
 const [x,z,yaw,heel,lift]=k;
 const toe=V(x,0,z).add(V(0,.01,0));
 const qYaw=qAxis(UP,yaw),pitchAxis=V(1,0,0).applyQuaternion(qYaw);
 const q=qAxis(pitchAxis,heel).multiply(qYaw);
 const ankle=toe.clone().sub(TOE.clone().applyQuaternion(q));ankle.y+=lift;
 const fwd=V(0,0,1).applyQuaternion(qYaw),pole=ankle.clone().add(V(0,.45,0)).addScaledVector(fwd,.6).add(V(poleOut,0,0));
 const err=ik(side+'UpLeg',side+'Leg',side+'Foot',ankle,pole);
 setWorldQ(B[side+'Foot'],q.clone().multiply(W[side+'Foot'].q));
 diag.maxFootError=Math.max(diag.maxFootError,err);
 return {toe,lift,heel};
}

// ---------- The cut: 6 phases, 1.90 s (Kenshi pace: readable wind-up, fast strike, weighty recovery) ----------
const FWD_CLIP={name:CLIP,duration:1.9,contact:.84,
 phases:{guard:0,preparation:.10,charge:.42,execution:.62,contact:.84,continuation:.86,recovery:1.18,guardReturn:1.9}};
// Space: +Z = toward the opponent, +X = Hunter's left. Yaw + turns the body to the left.
// hip:[x,dy,z] pelvis offset; hipYaw/chestYaw (chest relative to hips); pitch/roll of the spine;
// clav:[protraction,elevation] right clavicle; wrist: right wrist world; blade: sword tip direction;
// elbow: elbow pole hint; free: left wrist world; L/R foot:[toeX,toeZ,yaw,heelPitch,lift].
const ELBOW_FOLLOW=.7;
const G={edge:[0,-.85,.5],hip:[0,-.045,-.04],hipYaw:-.38,chestYaw:.22,pitch:.06,roll:0,clav:[0,0],
 wrist:[-.12,1.00,.15],blade:[.20,.55,.81],elbow:[-.40,.70,-.05],free:[.30,.88,.07]};
const FWD_KEYS=[
 {t:0,hold:true,...G},
 // Preparation: weight drifts to the back foot, sword rises to the right shoulder, eyes stay on target.
 {t:.22,hip:[-.02,-.06,-.07],hipYaw:-.48,chestYaw:-.05,pitch:.04,roll:-.03,clav:[-.08,-.05],
  wrist:[-.27,1.13,.12],blade:[-.25,.85,.10],edge:[-.7,-.5,.4],elbow:[-.55,.78,-.10],free:[.28,.93,.20]},
 {t:.42,hold:true,hip:[-.035,-.075,-.10],hipYaw:-.58,chestYaw:-.30,pitch:.02,roll:-.06,clav:[-.18,-.10],
  wrist:[-.32,1.24,.02],blade:[-.30,.38,-.87],elbow:[-.62,.88,-.14],free:[.26,.98,.30]},
 // Execution: hips fire first (already square) while shoulders and sword lag behind.
 {t:.70,hip:[0,-.085,.02],hipYaw:-.05,chestYaw:-.28,pitch:.08,roll:-.02,clav:[.02,-.04],
  wrist:[-.44,1.17,.20],blade:[-.97,.10,-.22],elbow:[-.58,.80,-.12],free:[.30,.94,.12]},
 // Contact: front foot planted, arm near-extended, blade level and square to the line of attack.
 {t:.84,hip:[.02,-.09,.10],hipYaw:.22,chestYaw:.06,pitch:.14,roll:.04,clav:[.24,0],
  wrist:[-.22,1.16,.60],blade:[-.50,.02,.87],elbow:[-.36,.80,.18],free:[.33,.90,-.10]},
 // Through the target: hand stays on the arc (arm long), torso unwinds, blade still trailing.
 {t:.93,hip:[.025,-.088,.11],hipYaw:.36,chestYaw:.24,pitch:.13,roll:.05,clav:[.30,.02],
  wrist:[.05,1.14,.63],blade:[-.17,0,.98],elbow:[-.22,.76,.18],free:[.33,.90,-.15]},
 // Continuation: inertia carries the sword across; elbow folds, torso keeps turning, back heel up.
 {t:1.02,hip:[.03,-.085,.12],hipYaw:.48,chestYaw:.42,pitch:.12,roll:.06,clav:[.34,.03],
  wrist:[.30,1.12,.50],blade:[.41,-.05,.91],elbow:[-.12,.72,.12],free:[.32,.90,-.20]},
 {t:1.18,hold:true,hip:[.02,-.075,.10],hipYaw:.56,chestYaw:.55,pitch:.10,roll:.04,clav:[.30,.02],
  wrist:[.38,1.08,.26],blade:[.87,-.10,.50],elbow:[-.04,.72,.02],free:[.31,.90,-.18]},
 // Recovery: sword comes back over the centre line, front foot returns, back heel drops.
 {t:1.50,hip:[0,-.06,.02],hipYaw:-.10,chestYaw:.26,pitch:.07,roll:0,clav:[.08,0],
  wrist:[-.04,1.04,.32],blade:[.55,.50,.67],edge:[-.4,-.8,-.2],elbow:[-.34,.72,-.02],free:[.30,.89,.04]},
 {t:1.9,hold:true,...G}
];
// Cutting keys: the true edge faces the direction of travel of the horizontal arc.
for(const k of FWD_KEYS)k.edge??=[k.blade[2],0,-k.blade[0]];
// Feet: own tracks. Toe [x,z,yaw,heelPitch]; front foot steps in (ease in/out + lift arc) and returns.
const ease=u=>u*u*(3-2*u);
const FWD={clip:FWD_CLIP,keys:FWD_KEYS,extras:{},
 LEFT:[[0,[.13,.16,.12,0]],[.58,[.13,.16,.12,0]],[.80,[.13,.31,.18,0]],[1.20,[.13,.31,.18,0]],[1.62,[.13,.16,.12,0]]],
 RIGHT:[[0,[-.16,-.10,-.62,0]],[.42,[-.16,-.10,-.62,0]],[.66,[-.16,-.10,-.45,.12]],[.84,[-.16,-.10,-.22,.30]],[1.02,[-.16,-.10,-.08,.40]],[1.20,[-.16,-.10,-.10,.36]],[1.55,[-.16,-.10,-.50,.06]],[1.9,[-.16,-.10,-.62,0]]],
 LIFT:{L:[[.58,.80,.07],[1.20,1.62,.05]],R:[]}};

// ---------- v11: reverse horizontal cut (backhand, left -> right). Same guard, same 6 phases. ----------
// Coil to the LEFT (yaw +), sword laid back over the left shoulder, palm down; hips fire to the right before
// the shoulders; the arm unfolds across the chest and extends at contact; follow-through to the right side.
const REV_KEYS=[
 {t:0,hold:true,...G},
 {t:.22,hip:[.01,-.055,-.06],hipYaw:-.20,chestYaw:.25,pitch:.04,roll:.03,clav:[.12,-.02],
  wrist:[.06,1.12,.20],blade:[.45,.75,.10],edge:[.6,-.5,.4],elbow:[-.10,.85,.30],free:[.30,.90,-.05]},
 {t:.42,hold:true,hip:[.03,-.075,-.08],hipYaw:.10,chestYaw:.40,pitch:.03,roll:.05,clav:[.25,-.06],
  wrist:[.22,1.20,.12],blade:[.50,.30,-.81],elbow:[0,.95,.35],free:[.32,.90,-.18]},
 {t:.70,hip:[0,-.085,.03],hipYaw:-.15,chestYaw:.35,pitch:.08,roll:.02,clav:[.15,-.03],
  wrist:[.16,1.18,.23],blade:[.95,.12,-.28],elbow:[.10,.85,.15],free:[.36,.93,-.20]},
 {t:.84,hip:[-.01,-.09,.12],hipYaw:-.35,chestYaw:-.05,pitch:.14,roll:-.04,clav:[.05,0],
  wrist:[-.02,1.16,.44],blade:[.55,.02,.83],elbow:[-.10,.82,.25],free:[.40,.95,-.15]},
 {t:.93,hip:[-.015,-.088,.12],hipYaw:-.48,chestYaw:-.15,pitch:.13,roll:-.05,clav:[.02,.01],
  wrist:[-.235,1.15,.38],blade:[.10,0,.99],elbow:[-.30,.80,.20],free:[.40,.95,-.12]},
 {t:1.02,hip:[-.02,-.085,.12],hipYaw:-.55,chestYaw:-.28,pitch:.12,roll:-.06,clav:[-.02,.02],
  wrist:[-.37,1.14,.24],blade:[-.45,-.05,.89],elbow:[-.50,.80,.05],free:[.38,.94,-.08]},
 {t:1.18,hold:true,hip:[-.02,-.075,.10],hipYaw:-.60,chestYaw:-.40,pitch:.10,roll:-.04,clav:[-.04,.02],
  wrist:[-.43,1.11,.02],blade:[-.88,-.10,.46],elbow:[-.55,.75,-.15],free:[.35,.92,-.05]},
 {t:1.50,hip:[0,-.06,.02],hipYaw:-.45,chestYaw:.05,pitch:.07,roll:0,clav:[0,0],
  wrist:[-.20,1.06,.25],blade:[.10,.62,.78],edge:[-.6,-.75,0],elbow:[-.45,.72,-.05],free:[.31,.89,.04]},
 {t:1.9,hold:true,...G}
];
// Backhand: the arc runs the other way, so the edge faces the opposite tangent.
for(const k of REV_KEYS)k.edge??=[-k.blade[2],0,k.blade[0]];
const REV={clip:{...FWD_CLIP,name:`pvp${VN}_sword_horizontal_reverse_cut`},keys:REV_KEYS,extras:{direction:'left-to-right (backhand)'},
 // Front foot steps in on the strike; back foot pivots open as the hips turn right, heel barely leaves the ground.
 LEFT:[[0,[.13,.16,.12,0]],[.58,[.13,.16,.12,0]],[.80,[.13,.29,0,0]],[1.20,[.13,.29,0,0]],[1.62,[.13,.16,.12,0]]],
 RIGHT:[[0,[-.16,-.10,-.62,0]],[.42,[-.16,-.10,-.62,0]],[.84,[-.16,-.10,-.80,.15]],[1.20,[-.16,-.10,-.85,.12]],[1.55,[-.16,-.10,-.70,.03]],[1.9,[-.16,-.10,-.62,0]]],
 LIFT:{L:[[.58,.80,.07],[1.20,1.62,.05]],R:[]}};
// ---------- v12: biblioteca PvP nova. Guarda fechada estilo Kenshi, e todo clipe começa e termina NELA. ----------
// Espada junto ao corpo (punho a 10 cm à frente do quadril direito), ponta alta cruzando para a esquerda —
// nunca apontada para o adversário —, joelhos flexionados (pelve 8,5 cm abaixo do repouso), base aberta e
// quadril ligeiramente de lado. É a mesma pose nos três clipes, então guarda->ataque->bloqueio->guarda não
// tem salto de pose: só a velocidade precisa ser costurada pelo motor de transição do renderizador.
const G12={edge:[.4,-.5,.6],hip:[0,-.085,-.03],hipYaw:-.42,chestYaw:.18,pitch:.10,roll:-.02,clav:[-.06,-.02],
 wrist:[-.16,.98,.10],blade:[.38,.80,.46],elbow:[-.42,.72,-.12],free:[.30,.84,.02]};
// Base de pés comum aos três clipes: mais aberta e mais atrás que a da v09, para caber o joelho flexionado.
const BASE_L=[.17,.20,.14,0],BASE_R=[-.19,-.14,-.58,0];

// --- 1) Guarda: idle de combate em laço, com respiração e microajuste de peso. Pés nunca saem do chão. ---
const GUARD_D=3.2;
const respirar=(dy,dpitch,dwy,dhz,g=G12)=>({...g,hip:[g.hip[0]+dhz,g.hip[1]+dy,g.hip[2]],pitch:g.pitch+dpitch,
 wrist:[g.wrist[0],g.wrist[1]+dwy,g.wrist[2]],free:[g.free[0],g.free[1]+dwy*.6,g.free[2]]});
const GUARD12={clip:{name:'pvp12_guard',duration:GUARD_D,contact:null,requiresExtension:false,
  phases:{guard:0,inspira:.8,expira:1.6,ajuste:2.4,guardReturn:GUARD_D}},
 keys:[
  {t:0,hold:true,...G12},
  {t:.8,...respirar(.012,-.015,.010,0)},                                     // inspira: peito e pelve sobem
  {t:1.6,...respirar(-.010,.012,-.008,.008)},                                // expira, peso escorrega para trás
  {t:2.4,...respirar(.008,-.008,.006,-.006),hipYaw:G12.hipYaw-.035,chestYaw:G12.chestYaw+.03},
  {t:GUARD_D,hold:true,...G12}],
 extras:{kind:'stance-idle',loop:true,note:'laço contínuo: t=0 e t=fim são a mesma pose com tangente zero'},
 LEFT:[[0,BASE_L],[GUARD_D,BASE_L]],RIGHT:[[0,BASE_R],[GUARD_D,BASE_R]],LIFT:{L:[],R:[]}};

// --- 2) Corte horizontal direita->esquerda, partindo e voltando à guarda fechada. ---
// Fases da v09 preservadas (preparo legível, golpe rápido, recuperação pesada); as poses de guarda, de
// entrada no coil e de volta foram reautoradas para a guarda nova.
const CUT12_KEYS=[
 {t:0,hold:true,...G12},
 // Preparo: a ponta desce da guarda e vai para trás do ombro direito; o peso recua.
 {t:.24,hip:[-.02,-.095,-.08],hipYaw:-.52,chestYaw:-.06,pitch:.08,roll:-.05,clav:[-.12,-.06],
  wrist:[-.28,1.10,.08],blade:[-.10,.88,-.46],edge:[-.75,-.35,.35],elbow:[-.56,.76,-.14],free:[.28,.95,.22]},
 // Coil completo: lâmina deitada atrás do ombro, ombros atrasados em relação ao quadril.
 {t:.44,hold:true,hip:[-.035,-.100,-.11],hipYaw:-.60,chestYaw:-.32,pitch:.05,roll:-.07,clav:[-.20,-.11],
  wrist:[-.33,1.22,-.01],blade:[-.30,.38,-.87],elbow:[-.63,.86,-.15],free:[.26,.99,.30]},
 // Execução: o quadril dispara primeiro, ombro e espada ficam para trás.
 {t:.70,hip:[0,-.090,.02],hipYaw:-.05,chestYaw:-.28,pitch:.10,roll:-.02,clav:[.02,-.04],
  wrist:[-.44,1.17,.20],blade:[-.97,.10,-.22],elbow:[-.58,.80,-.12],free:[.30,.94,.12]},
 // Contato: pé da frente plantado, braço estendido, lâmina na linha do golpe.
 {t:.84,hip:[.02,-.092,.10],hipYaw:.22,chestYaw:.06,pitch:.15,roll:.04,clav:[.24,0],
  wrist:[-.22,1.16,.60],blade:[-.50,.02,.87],elbow:[-.36,.80,.18],free:[.33,.90,-.10]},
 {t:.93,hip:[.025,-.090,.11],hipYaw:.36,chestYaw:.24,pitch:.14,roll:.05,clav:[.30,.02],
  wrist:[.05,1.14,.63],blade:[-.17,0,.98],elbow:[-.22,.76,.18],free:[.33,.90,-.15]},
 // Continuação: a inércia leva a espada para o lado esquerdo, cotovelo dobra, calcanhar de trás sobe.
 {t:1.02,hip:[.03,-.088,.12],hipYaw:.48,chestYaw:.42,pitch:.13,roll:.06,clav:[.34,.03],
  wrist:[.30,1.12,.50],blade:[.41,-.05,.91],elbow:[-.12,.72,.12],free:[.32,.90,-.20]},
 {t:1.18,hold:true,hip:[.02,-.082,.10],hipYaw:.56,chestYaw:.55,pitch:.11,roll:.04,clav:[.30,.02],
  wrist:[.38,1.08,.26],blade:[.87,-.10,.50],elbow:[-.04,.72,.02],free:[.31,.90,-.18]},
 // Meio da volta: a ponta sobe antes de a mão cruzar o corpo, senão o punho dobra demais.
 {t:1.33,hip:[.01,-.085,.05],hipYaw:.22,chestYaw:.42,pitch:.11,roll:.02,clav:[.18,.01],
  wrist:[.16,1.05,.28],blade:[.78,.26,.57],elbow:[-.18,.74,-.02],free:[.30,.91,-.05]},
 // Recuperação: a espada volta pela linha central e a ponta sobe de novo para a guarda.
 {t:1.52,hip:[0,-.088,0],hipYaw:-.16,chestYaw:.28,pitch:.10,roll:0,clav:[.04,-.01],
  wrist:[-.06,1.02,.26],blade:[.52,.60,.60],edge:[.1,-.6,.78],elbow:[-.40,.72,-.06],free:[.28,.92,.10]},
 {t:1.9,hold:true,...G12}];
for(const k of CUT12_KEYS)k.edge??=[k.blade[2],0,-k.blade[0]];
const CUT12={clip:{name:'pvp12_sword_horizontal_cut',duration:1.9,contact:.84,requiresExtension:true,
  phases:{guard:0,preparation:.24,charge:.44,execution:.70,contact:.84,continuation:1.02,recovery:1.52,guardReturn:1.9}},
 keys:CUT12_KEYS,extras:{kind:'attack',direction:'right-to-left (forehand)',pairsWith:'pvp12_sword_block'},
 LEFT:[[0,BASE_L],[.58,BASE_L],[.80,[.17,.35,.20,0]],[1.20,[.17,.35,.20,0]],[1.66,BASE_L]],
 RIGHT:[[0,BASE_R],[.44,BASE_R],[.66,[-.19,-.14,-.42,.12]],[.84,[-.19,-.14,-.20,.30]],[1.02,[-.19,-.14,-.06,.40]],[1.20,[-.19,-.14,-.08,.36]],[1.56,[-.19,-.14,-.46,.06]],[1.9,BASE_R]],
 LIFT:{L:[[.58,.80,.07],[1.20,1.66,.05]],R:[]}};

// --- 3) Bloqueio de espada: a lâmina sobe e CRUZA a linha do golpe, leva o impacto e volta à guarda. ---
// Contato em 0,30 s contra o contato do corte em 0,84 s: sincronizados pelo laboratório, a lâmina do
// defensor já está atravessada na linha bem antes de a do atacante chegar.
const BLOCK12={clip:{name:'pvp12_sword_block',duration:1.10,contact:.30,requiresExtension:false,
  phases:{guard:0,subida:.16,posto:.30,impacto:.38,absorcao:.52,recovery:.78,guardReturn:1.10}},
 keys:[
  {t:0,hold:true,...G12},
  // Subida: o punho sai do quadril e vai à frente do esterno, a ponta roda para fora.
  {t:.16,hip:[0,-.095,-.01],hipYaw:-.34,chestYaw:.10,pitch:.08,roll:-.01,clav:[.06,.04],
   wrist:[-.09,1.10,.26],blade:[.55,.79,.28],edge:[.30,-.35,.89],elbow:[-.34,.86,.02],free:[.28,1.00,.14]},
  // Posto: lâmina atravessada no plano frontal, cotovelo sob a mão, peso centrado para aguentar o choque.
  {t:.30,hold:true,hip:[0,-.100,.01],hipYaw:-.26,chestYaw:.04,pitch:.10,roll:0,clav:[.12,.06],
   wrist:[-.04,1.18,.34],blade:[.68,.70,.22],edge:[.22,-.28,.93],elbow:[-.28,.92,.08],free:[.30,1.02,.10]},
  // Impacto: o aço empurra a guarda para trás e para baixo; o tronco absorve, os pés não escorregam.
  {t:.38,hip:[-.02,-.108,-.05],hipYaw:-.33,chestYaw:-.04,pitch:.17,roll:-.04,clav:[.04,.02],
   wrist:[-.10,1.14,.25],blade:[.76,.62,.18],edge:[.18,-.33,.93],elbow:[-.36,.88,0],free:[.30,1.00,.06]},
  // Absorção: a guarda cede mais um pouco e já começa a recuperar a linha.
  {t:.52,hip:[-.015,-.104,-.03],hipYaw:-.36,chestYaw:0,pitch:.14,roll:-.03,clav:[.06,.03],
   wrist:[-.08,1.15,.28],blade:[.70,.67,.24],edge:[.20,-.30,.93],elbow:[-.33,.89,.02],free:[.29,1.00,.10]},
  // Recuperação: o punho desce de volta ao quadril e a ponta volta a cruzar alto.
  {t:.78,hip:[0,-.090,-.02],hipYaw:-.40,chestYaw:.12,pitch:.11,roll:-.02,clav:[-.02,0],
   wrist:[-.13,1.06,.17],blade:[.50,.78,.38],edge:[.32,-.42,.75],elbow:[-.39,.78,-.06],free:[.27,.97,.15]},
  {t:1.10,hold:true,...G12}],
 extras:{kind:'defense',line:'mid',pairsWith:'pvp12_sword_horizontal_cut'},
 LEFT:[[0,BASE_L],[1.10,BASE_L]],RIGHT:[[0,BASE_R],[1.10,BASE_R]],LIFT:{L:[],R:[]}};

// --- 4) Locomoção de combate: avançar, recuar e circular para os dois lados, sempre em guarda. ---
// Ciclo de 0,85 s em lugar: o pé plantado escorrega para trás sob o corpo (o laboratório é quem translada
// o Hunter) e o pé no ar volta à frente a mesma distância, então o ciclo fecha. É um arrasto de combate,
// não um passo de caminhada: os pés não se cruzam e a guarda não se desfaz.
const PASSO_T=.85,PASSO_D=.312,PH=PASSO_D/2,GUARDA_V12=G12,BASE_L12=BASE_L,BASE_R12=BASE_R;
function passo12(nome,dx,dz,avanco,lead,G12=GUARDA_V12,BASE_L=BASE_L12,BASE_R=BASE_R12){
 const mover=(base,f,heel)=>[base[0]+dx*f,base[1]+dz*f,base[2],heel??base[3]];
 // Pé que sai primeiro: plantado [0, 0,51] escorregando para trás, no ar [0,51, 0,85] voltando à frente.
 const trilhaA=b=>[[0,mover(b,PH)],[.51,mover(b,-PH,.16)],[.60,mover(b,-PH*.58)],[.72,mover(b,PH*.58)],[PASSO_T,mover(b,PH)]];
 // Pé de trás: meio ciclo depois. No ar [0,085, 0,425].
 const trilhaB=b=>[[0,mover(b,-PH*.666)],[.085,mover(b,-PH,.16)],[.19,mover(b,-PH*.58)],[.30,mover(b,PH*.58)],[.425,mover(b,PH)],[PASSO_T,mover(b,-PH*.666)]];
 const ehL=lead==='L';
 const LEFT=ehL?trilhaA(BASE_L):trilhaB(BASE_L),RIGHT=ehL?trilhaB(BASE_R):trilhaA(BASE_R);
 const janelaA=[.51,PASSO_T,.075],janelaB=[.085,.425,.075];
 // Em cima: só o balanço de peso do ciclo. A espada, o cotovelo e a mão livre ficam na guarda.
 const balanco=(dy,yaw,wy)=>({...G12,hip:[G12.hip[0],G12.hip[1]+dy,G12.hip[2]],hipYaw:G12.hipYaw+yaw,
  chestYaw:G12.chestYaw-yaw*.5,wrist:[G12.wrist[0],G12.wrist[1]+wy,G12.wrist[2]]});
 return{clip:{name:nome,duration:PASSO_T,contact:null,requiresExtension:false,pesLineares:true,pesPercorrem:true,
   phases:{guard:0,apoioA:.2125,troca:.425,apoioB:.6375,guardReturn:PASSO_T}},
  keys:[{t:0,hold:true,...G12},
   {t:.2125,...balanco(-.011,.030,.009)},
   {t:.425,...balanco(.008,-.018,-.006)},
   {t:.6375,...balanco(-.011,.022,.008)},
   {t:PASSO_T,hold:true,...G12}],
  extras:{kind:'step',vector:[dx,dz],stride:avanco,stance:.60,loop:true,
   note:'em lugar: o laboratório translada o Hunter e o IK de pés do renderizador planta o pé no chão'},
  LEFT,RIGHT,LIFT:{L:[ehL?janelaA:janelaB],R:[ehL?janelaB:janelaA]}};
}
const PASSOS=[
 passo12('pvp12_step_forward',0,1,.52,'L'),    // o pé da frente sai primeiro ao avançar
 passo12('pvp12_step_back',0,-1,.52,'R'),      // ao recuar quem sai primeiro é o pé de trás
 passo12('pvp12_step_left',1,0,.40,'L'),
 passo12('pvp12_step_right',-1,0,.40,'R')];

// --- 5) Corte horizontal REVERSO (esquerda->direita, de costas da mão). Continuação do corte. ---
// Da guarda fechada a ponta já cruza para a esquerda, então o coil vai direto ao ombro esquerdo. O miolo
// (execução, contato, continuação) é o da v11, validado; guarda, entrada no coil e volta foram reautorados.
// Mão livre à frente do quadril: atrás das costas ela torcia o braço num contrapeso que ninguém faz.
const REV12_KEYS=[
 {t:0,hold:true,...G12},
 {t:.22,hip:[.01,-.090,-.06],hipYaw:-.20,chestYaw:.30,pitch:.07,roll:.03,clav:[.12,-.02],
  wrist:[.04,1.10,.16],blade:[.50,.80,.10],edge:[.6,-.5,.35],elbow:[-.10,.85,.28],free:[.30,.88,-.02]},
 {t:.42,hold:true,hip:[.03,-.095,-.08],hipYaw:.10,chestYaw:.40,pitch:.05,roll:.05,clav:[.25,-.06],
  wrist:[.22,1.20,.12],blade:[.50,.30,-.81],elbow:[0,.95,.35],free:[.30,.92,.06]},
 {t:.70,hip:[0,-.095,.03],hipYaw:-.15,chestYaw:.35,pitch:.09,roll:.02,clav:[.15,-.03],
  wrist:[.16,1.18,.23],blade:[.95,.12,-.28],elbow:[.10,.85,.15],free:[.34,.93,0]},
 {t:.84,hip:[-.01,-.098,.12],hipYaw:-.35,chestYaw:-.05,pitch:.15,roll:-.04,clav:[.05,0],
  wrist:[-.02,1.16,.44],blade:[.55,.02,.83],elbow:[-.10,.82,.25],free:[.36,.94,-.04]},
 {t:.93,hip:[-.015,-.096,.12],hipYaw:-.48,chestYaw:-.15,pitch:.14,roll:-.05,clav:[.02,.01],
  wrist:[-.235,1.15,.38],blade:[.10,0,.99],elbow:[-.30,.80,.20],free:[.36,.94,-.04]},
 {t:1.02,hip:[-.02,-.094,.12],hipYaw:-.55,chestYaw:-.28,pitch:.13,roll:-.06,clav:[-.02,.02],
  wrist:[-.37,1.14,.24],blade:[-.45,-.05,.89],elbow:[-.50,.80,.05],free:[.34,.93,-.02]},
 {t:1.18,hold:true,hip:[-.02,-.088,.10],hipYaw:-.60,chestYaw:-.40,pitch:.11,roll:-.04,clav:[-.04,.02],
  wrist:[-.43,1.11,.02],blade:[-.88,-.10,.46],elbow:[-.55,.75,-.15],free:[.32,.92,0]},
 // Volta: a ponta sobe pela direita e cruza de novo para a esquerda alta da guarda.
 {rollLivre:true,t:1.40,hip:[-.01,-.088,.05],hipYaw:-.50,chestYaw:.05,pitch:.10,roll:-.02,clav:[-.03,0],
  wrist:[-.30,1.06,.14],blade:[-.45,.62,.64],edge:[-.75,-.35,-.20],elbow:[-.55,.74,-.12],free:[.31,.88,0]},
 {rollLivre:true,t:1.64,hip:[0,-.086,-.01],hipYaw:-.45,chestYaw:.14,pitch:.10,roll:-.02,clav:[-.05,-.01],
  wrist:[-.20,1.00,.14],blade:[.10,.85,.52],edge:[.5,-.45,.7],elbow:[-.47,.72,-.12],free:[.28,.86,.02]},
 {t:1.9,hold:true,...G12}];
for(const k of REV12_KEYS)k.edge??=[-k.blade[2],0,k.blade[0]];
const REV12={clip:{name:'pvp12_sword_horizontal_reverse_cut',duration:1.9,contact:.93,requiresExtension:true,
  phases:{guard:0,preparation:.22,charge:.42,execution:.70,contact:.93,continuation:1.02,recovery:1.40,guardReturn:1.9}},
 keys:REV12_KEYS,extras:{kind:'attack',direction:'left-to-right (backhand)',pairsWith:'pvp12_sword_block'},
 LEFT:[[0,BASE_L],[.58,BASE_L],[.80,[.17,.33,.02,0]],[1.20,[.17,.33,.02,0]],[1.66,BASE_L]],
 RIGHT:[[0,BASE_R],[.42,BASE_R],[.84,[-.19,-.14,-.78,.15]],[1.20,[-.19,-.14,-.82,.12]],[1.56,[-.19,-.14,-.66,.03]],[1.9,BASE_R]],
 LIFT:{L:[[.58,.80,.07],[1.20,1.66,.05]],R:[]}};

// --- 6) Diagonal DESCENDENTE pesado (ombro direito alto -> quadril esquerdo baixo). ---
// Preparo longo com a espada erguida sobre o ombro e o peso atrás; o quadril dispara, o tronco cai sobre a
// perna da frente e a lâmina desce cruzando o corpo do adversário; a inércia leva a ponta até embaixo à
// esquerda e o Hunter se reergue para a guarda.
const DIAG12_KEYS=[
 {t:0,hold:true,...G12},
 {t:.30,hip:[-.02,-.090,-.07],hipYaw:-.50,chestYaw:-.10,pitch:.02,roll:-.06,clav:[-.10,-.12],
  wrist:[-.22,1.30,.05],blade:[-.15,.95,-.25],edge:[-.45,.15,.88],elbow:[-.55,1.05,-.10],free:[.28,.98,.22]},
 {t:.55,hold:true,hip:[-.035,-.100,-.10],hipYaw:-.58,chestYaw:-.28,pitch:-.02,roll:-.08,clav:[-.18,-.16],
  wrist:[-.26,1.40,-.02],blade:[-.35,.55,-.76],edge:[0,.81,.59],elbow:[-.62,1.12,-.12],free:[.26,1.00,.30]},
 {t:.80,hip:[0,-.100,.03],hipYaw:-.10,chestYaw:-.30,pitch:.10,roll:-.02,clav:[.06,-.08],
  wrist:[-.30,1.36,.30],blade:[-.40,.75,.52],edge:[.35,-.62,.68],elbow:[-.55,1.00,0],free:[.30,.95,.12]},
 {t:.98,hip:[.025,-.110,.12],hipYaw:.25,chestYaw:.10,pitch:.22,roll:.06,clav:[.26,.02],
  wrist:[-.12,1.12,.60],blade:[.30,-.25,.92],edge:[.57,-.72,-.38],elbow:[-.30,.86,.20],free:[.33,.90,-.12]},
 {t:1.10,hip:[.03,-.115,.13],hipYaw:.40,chestYaw:.30,pitch:.26,roll:.08,clav:[.32,.03],
  wrist:[.10,.98,.55],blade:[.62,-.45,.64],edge:[.66,-.18,-.73],elbow:[-.12,.74,.14],free:[.32,.88,-.18]},
 {t:1.30,hold:true,hip:[.02,-.110,.11],hipYaw:.52,chestYaw:.45,pitch:.22,roll:.06,clav:[.28,.02],
  wrist:[.26,.90,.32],blade:[.86,-.40,.30],edge:[.20,-.20,-.95],elbow:[-.02,.70,.04],free:[.31,.88,-.16]},
 {rollLivre:true,t:1.46,hip:[.01,-.105,.08],hipYaw:.25,chestYaw:.40,pitch:.18,roll:.04,clav:[.20,.01],
  wrist:[.14,.93,.30],blade:[.80,.05,.55],edge:[.25,-.95,-.27],elbow:[-.18,.70,0],free:[.30,.88,-.06]},
 {rollLivre:true,t:1.62,hip:[0,-.095,.03],hipYaw:-.10,chestYaw:.30,pitch:.13,roll:.01,clav:[.08,0],
  wrist:[0,.99,.26],blade:[.62,.45,.64],edge:[.45,-.80,.05],elbow:[-.36,.72,-.04],free:[.29,.88,.06]},
 {t:1.86,hip:[0,-.088,-.02],hipYaw:-.35,chestYaw:.20,pitch:.11,roll:-.01,clav:[-.03,-.01],
  wrist:[-.13,.98,.14],blade:[.45,.75,.48],edge:[.4,-.5,.6],elbow:[-.42,.72,-.10],free:[.29,.85,.03]},
 {t:2.1,hold:true,...G12}];
const DIAG12={clip:{name:'pvp12_sword_diagonal_down',duration:2.1,contact:.98,requiresExtension:true,
  phases:{guard:0,preparation:.30,charge:.55,execution:.80,contact:.98,continuation:1.10,recovery:1.62,guardReturn:2.1}},
 keys:DIAG12_KEYS,extras:{kind:'attack',direction:'diagonal descending (right shoulder -> left hip)',weight:'heavy',pairsWith:'pvp12_sword_block'},
 LEFT:[[0,BASE_L],[.62,BASE_L],[.94,[.17,.40,.18,0]],[1.40,[.17,.40,.18,0]],[1.86,BASE_L]],
 RIGHT:[[0,BASE_R],[.55,BASE_R],[.80,[-.19,-.14,-.40,.14]],[.98,[-.19,-.14,-.18,.34]],[1.30,[-.19,-.14,-.10,.38]],[1.70,[-.19,-.14,-.48,.05]],[2.1,BASE_R]],
 LIFT:{L:[[.62,.94,.08],[1.40,1.86,.05]],R:[]}};

// --- 7) Estocada (contra-ataque). Recolhe o punho no quadril e dispara a ponta em linha reta. ---
const THR12_KEYS=[
 {t:0,hold:true,...G12},
 {t:.18,hip:[-.02,-.100,-.07],hipYaw:-.55,chestYaw:-.15,pitch:.06,roll:-.03,clav:[-.14,-.04],
  wrist:[-.20,1.02,-.02],blade:[.05,.20,.98],edge:[0,-.98,.2],elbow:[-.55,.80,-.25],free:[.30,.95,.20]},
 {t:.32,hold:true,hip:[-.03,-.105,-.10],hipYaw:-.62,chestYaw:-.22,pitch:.05,roll:-.04,clav:[-.18,-.05],
  wrist:[-.24,1.05,-.08],blade:[.04,.16,.99],edge:[0,-.99,.16],elbow:[-.58,.82,-.30],free:[.30,.98,.24]},
 {t:.52,hip:[.02,-.110,.12],hipYaw:.05,chestYaw:.10,pitch:.16,roll:.02,clav:[.28,.02],
  wrist:[-.10,1.07,.60],blade:[.05,.30,.95],edge:[0,-.95,.30],elbow:[-.32,.92,.16],free:[.32,.88,-.15]},
 {t:.62,hip:[.03,-.115,.16],hipYaw:.25,chestYaw:.15,pitch:.20,roll:.03,clav:[.36,.03],
  wrist:[-.10,1.05,.67],blade:[.04,.36,.93],edge:[0,-.93,.36],elbow:[-.24,.96,.26],free:[.34,.86,-.22]},
 {rollLivre:true,t:.84,hip:[.01,-.105,.08],hipYaw:-.10,chestYaw:.12,pitch:.14,roll:.01,clav:[.15,.01],
  wrist:[-.12,1.10,.40],blade:[.10,.20,.97],edge:[0,-.98,.2],elbow:[-.40,.85,.02],free:[.31,.90,-.05]},
 {rollLivre:true,t:.97,hip:[.005,-.098,.04],hipYaw:-.22,chestYaw:.15,pitch:.12,roll:0,clav:[.06,0],
  wrist:[-.14,1.05,.30],blade:[.20,.45,.87],edge:[.1,-.87,.41],elbow:[-.42,.80,-.04],free:[.30,.88,0]},
 {t:1.10,hip:[0,-.090,0],hipYaw:-.35,chestYaw:.18,pitch:.11,roll:-.01,clav:[-.02,0],
  wrist:[-.15,1.00,.18],blade:[.30,.70,.65],edge:[.3,-.6,.7],elbow:[-.44,.74,-.10],free:[.28,.87,.06]},
 {t:1.5,hold:true,...G12}];
const THR12={clip:{name:'pvp12_sword_thrust',duration:1.5,contact:.62,requiresExtension:true,
  phases:{guard:0,recolhe:.18,carga:.32,disparo:.52,contact:.62,retorno:.84,recovery:1.10,guardReturn:1.5}},
 keys:THR12_KEYS,extras:{kind:'attack',direction:'thrust (straight line)',role:'counter',pairsWith:'pvp12_sword_block'},
 LEFT:[[0,BASE_L],[.34,BASE_L],[.56,[.16,.46,.08,0]],[.90,[.16,.46,.08,0]],[1.28,BASE_L]],
 RIGHT:[[0,BASE_R],[.32,BASE_R],[.52,[-.19,-.14,-.42,.20]],[.66,[-.19,-.14,-.30,.36]],[.90,[-.19,-.14,-.34,.28]],[1.24,[-.19,-.14,-.52,.04]],[1.5,BASE_R]],
 LIFT:{L:[[.34,.58,.08],[.90,1.30,.05]],R:[]}};

// ================= PvE v01 — contrato hunter-pve-v01 (labs/hunters/docs/CONTRATO-ANIMACOES.md) =================
// Guarda de caçador (referência artística: Monster Hunter World), não a guarda fechada do duelo: tronco mais alto
// e inclinado para a frente, ponta da espada para a frente e para cima, mão livre à frente do peito. Todo clipe
// B/C parte dela e volta a ela; a recuperação e a corrida são estados em laço com pose própria.
const GP={edge:[0,-.89,.45],hip:[0,-.095,-.03],hipYaw:-.25,chestYaw:.12,pitch:.12,roll:0,clav:[0,0],
 wrist:[-.24,1.00,.22],blade:[-.10,.45,.89],elbow:[-.45,.80,-.10],free:[.24,1.02,.26]};
const PL=[.16,.15,.10,0],PR=[-.18,-.12,-.40,0];
// Campos do contrato (seção 5). Contatos de pé = complemento das janelas de elevação, amostrado a 60 fps.
function contrato(def,modulo,interrupts,{loop=false,root=null}={}){
 const T=def.clip.duration,noAr=(s,t)=>def.LIFT[s].some(([a,b])=>t>a&&t<b||b>T&&t<b-T);
 const contatos=s=>{const out=[];let ini=null;for(let n=0;n<=Math.round(T*60);n++){const t=n/60,ar=noAr(s,t);
  if(!ar&&ini===null)ini=t;if((ar||n===Math.round(T*60))&&ini!==null){out.push([+ini.toFixed(4),+t.toFixed(4)]);ini=null;}}return out;};
 def.root=root;
 def.extras={...def.extras,contract:'hunter-pve-v01',module:modulo,weapon:'sword',loop,fps:60,duration:T,interrupts,
  footContacts:{left:contatos('L'),right:contatos('R')},
  rootMotion:root?{mode:'curve',axis:'x',distanceM:+root(T).toFixed(4),units:'metros nativos (altura 1,70 m)',
   curve:Array.from({length:Math.round(T*60)+1},(_,n)=>+root(n/60).toFixed(5))}:{mode:'none'},
  motion:root?'in-place; deslocamento lateral na curva rootMotion (a simulação aplica)':'in-place',freeHand:'contextual'};
 return def;}
const LIVRE=T=>[{from:0,to:T,into:['any']}];

// --- B) Guarda PvE em laço: respiração e microajuste de peso; pés plantados. ---
const GUARD_P=contrato({clip:{name:'pve1_b_sword_guard',duration:2.4,contact:null,requiresExtension:false,
  phases:{guard:0,inspira:.6,expira:1.2,ajuste:1.8,guardReturn:2.4}},
 keys:[{t:0,hold:true,...GP},{t:.6,...respirar(.014,-.02,.012,0,GP)},{t:1.2,...respirar(-.010,.015,-.010,.010,GP)},
  {t:1.8,...respirar(.008,-.01,.006,-.008,GP),hipYaw:GP.hipYaw-.04,chestYaw:GP.chestYaw+.035},{t:2.4,hold:true,...GP}],
 extras:{kind:'stance-idle'},LEFT:[[0,PL],[2.4,PL]],RIGHT:[[0,PR],[2.4,PR]],LIFT:{L:[],R:[]}},'b',LIVRE(2.4),{loop:true});

// --- B) Passos em guarda: o mesmo ciclo validado da v12, sobre a guarda PvE. ---
const PASSOS_P=[['forward',0,1,.52,'L'],['back',0,-1,.52,'R'],['left',1,0,.40,'L'],['right',-1,0,.40,'R']]
 .map(([d,dx,dz,av,lead])=>contrato(passo12('pve1_b_sword_step_'+d,dx,dz,av,lead,GP,PL,PR),'b',LIVRE(PASSO_T),{loop:true}));

// --- A) Corrida com a espada sacada, 4,5 m/s: 0,64 s por ciclo, apoio de 0,16 s por pé e duas fases de voo. ---
// Em lugar: o pé de apoio percorre 0,72 m para trás sob o corpo (= 4,5 m/s), o pé no ar volta à frente.
// Braço da espada oposto à perna (direito à frente com o pé esquerdo), pelve gira com a passada, tronco contrário.
const RUN_T=.65,Q4=RUN_T/4,RZ=.32,RUN_V=2*RZ/Q4;   // 0,65 s = 39 quadros: o último quadro cai exatamente no fim do clipe
const RUN_KEYS=Array.from({length:17},(_,n)=>{const t=n*RUN_T/16,f=2*Math.PI*t/RUN_T,c=Math.cos(f),yaw=-.12*c;
 return{rollLivre:true,t,...GP,hip:[0,-.085-.035*Math.sin(2*f),0],hipYaw:yaw,chestYaw:-yaw*1.5,pitch:.24,roll:0,clav:[-yaw*.4,0],
  wrist:[-.24,1.00+.03*c,.05+.15*c],blade:[-.12,.30,.95],edge:[0,-.95,.30],elbow:[-.45,.70,-.20],free:[.22,.98-.04*c,.05-.17*c]};});
const RUN_P=contrato({clip:{name:'pve1_a_sword_run',duration:RUN_T,contact:null,requiresExtension:false,pesLineares:true,pesPercorrem:true,
  phases:{apoioE:0,vooA:Q4,apoioD:2*Q4,vooB:3*Q4,ciclo:RUN_T}},keys:RUN_KEYS,
 extras:{kind:'step',vector:[0,1],stride:+(RUN_V*RUN_T).toFixed(4),stance:.25,speedMs:RUN_V},
 LEFT:[[0,[.11,RZ,0,0]],[Q4,[.11,-RZ,0,.45]],[RUN_T,[.11,RZ,0,0]]],
 RIGHT:[[0,[-.11,-RZ/3,0,.30]],[2*Q4,[-.11,RZ,0,0]],[3*Q4,[-.11,-RZ,0,.45]],[RUN_T,[-.11,-RZ/3,0,.30]]],
 LIFT:{L:[[Q4,RUN_T,.24]],R:[[3*Q4,2*Q4+RUN_T,.24]]}},'a',LIVRE(RUN_T),{loop:true});

// --- B) Esquiva lateral em salto (s=+1 esquerda/+X, -1 direita). 1,20 m. ---
// Agacha, empurra (o corpo acelera a 4 m/s com o pé de trás ainda plantado na ponta), voa, aterrissa com os dois
// pés, o corpo continua sobre os pés plantados até parar (o quadril absorve 0,28 m) e os pés voltam para baixo
// do corpo em dois passos curtos. A curva de deslocamento é única: os pés autorados são essa curva vista do corpo.
function esquiva(nome,s){
 const T=1.0,u=t=>(t-.10)/.10,tau=t=>t-.38;
 const D=t=>s*(t<.10?0:t<.20?.20*u(t)**2:t<.38?.20+4*(t-.20):t<.52?.92+4*tau(t)-tau(t)**2/.07:1.20);
 const lead=s>0?'L':'R';
 const pe=(b,lado)=>{const tras=lado!==lead,tr=[[0,b]];
  for(let n=6;n<=12;n++){const t=n/60;tr.push([t,[b[0]-D(t),b[1],b[2],tras?.5*(n-6)/6:0]]);}
  tr.push([.33,[b[0]+.20*s,b[1],b[2],0]],[.38,b]);for(let n=23;n<=31;n++){const t=n/60;tr.push([t,[b[0]-(D(t)-D(.38)),b[1],b[2],0]]);}
  const atraso=b.slice();atraso[0]=b[0]-(D(.52)-D(.38));
  const [p0,p1]=lado===lead?[.56,.68]:[.64,.78];// Pé do passo de ajuste pousa devagar: os últimos 4 cm do trajeto levam 0,05 s, sem tocar o chão em velocidade.
  const quase=b.slice();quase[0]=b[0]-.004*s;tr.push([p0,atraso],[p1-.05,quase],[p1,b],[T,b]);return tr;};
 const solto={wrist:[-.18,.98,.14],blade:[.05,.82,.56],edge:[0,-.56,.83],elbow:[-.40,.72,-.10]},livre=s>0?[.40,.96,.10]:[.12,.96,.22];
 const k=(t,hip,pitch,roll)=>({t,...GP,...solto,hip,pitch,roll,free:livre});
 const janelas=lado=>lado===lead?[[.14,.38,.24],[.56,.68,.06]]:[[.20,.38,.20],[.64,.78,.05]];
 return contrato({clip:{name:nome,duration:T,contact:null,requiresExtension:false,pesLineares:true,
   phases:{guard:0,agacha:.10,impulso:.20,voo:.29,aterrissa:.38,absorve:.48,recovery:.60,guardReturn:T}},
  keys:[{t:0,hold:true,...GP},
   k(.10,[-.04*s,-.16,0],.22,-.06*s),k(.20,[-.03*s,-.12,0],.14,.05*s),{...k(.29,[.02*s,.10,0],.10,.08*s),wrist:[-.18,1.07,.14]},
   k(.38,[.02*s,-.16,0],.22,-.02*s),k(.48,[.08*s,-.20,0],.26,-.02*s),k(.60,[.04*s,-.15,0],.20,0),
   {t:.80,...GP,hip:[.01*s,-.11,0],pitch:.15,roll:0,wrist:[-.21,.99,.18],blade:[-.03,.62,.78],edge:[0,-.78,.62],elbow:[-.43,.76,-.10],free:[.26,1.0,.22]},
   {t:T,hold:true,...GP}],
  extras:{kind:'evade',direction:s>0?'left':'right'},LEFT:pe(PL,'L'),RIGHT:pe(PR,'R'),
  LIFT:{L:janelas('L'),R:janelas('R')}},'b',
  [{from:.80,to:T,into:['light','heavy','block','dodge']}],{root:D});}
const DODGE_P=[esquiva('pve1_b_sword_dodge_left',1),esquiva('pve1_b_sword_dodge_right',-1)];

// --- B) Bloqueio contra monstro: base baixa, lâmina atravessada, o impacto empurra o corpo e não só o braço. ---
const BLOCK_P=contrato({clip:{name:'pve1_b_sword_block',duration:1.0,contact:.30,requiresExtension:false,
  phases:{guard:0,subida:.18,posto:.30,impacto:.38,absorcao:.52,recovery:.72,guardReturn:1.0}},
 keys:[{t:0,hold:true,...GP},
  {t:.18,hip:[0,-.11,-.01],hipYaw:-.30,chestYaw:.06,pitch:.14,roll:-.01,clav:[.06,.04],
   wrist:[-.09,1.10,.28],blade:[.55,.79,.28],edge:[.30,-.35,.89],elbow:[-.34,.86,.02],free:[.26,1.00,.20]},
  {t:.30,hold:true,hip:[0,-.13,0],hipYaw:-.24,chestYaw:.02,pitch:.18,roll:0,clav:[.12,.06],
   wrist:[-.04,1.16,.34],blade:[.68,.70,.22],edge:[.22,-.28,.93],elbow:[-.28,.92,.08],free:[.26,1.02,.24]},
  {t:.38,hip:[-.03,-.15,-.07],hipYaw:-.30,chestYaw:-.06,pitch:.26,roll:-.04,clav:[.03,.02],
   wrist:[-.10,1.10,.24],blade:[.76,.62,.18],edge:[.18,-.33,.93],elbow:[-.36,.88,0],free:[.27,.99,.16]},
  {t:.52,hip:[-.02,-.14,-.05],hipYaw:-.30,chestYaw:-.02,pitch:.22,roll:-.03,clav:[.06,.03],
   wrist:[-.08,1.12,.28],blade:[.70,.67,.24],edge:[.20,-.30,.93],elbow:[-.33,.89,.02],free:[.26,1.00,.20]},
  {t:.72,hip:[0,-.10,-.01],hipYaw:-.27,chestYaw:.08,pitch:.15,roll:0,clav:[.02,0],
   wrist:[-.18,1.04,.24],blade:[.15,.62,.77],edge:[.1,-.78,.6],elbow:[-.42,.80,-.08],free:[.25,1.01,.25]},
  {t:1.0,hold:true,...GP}],
 extras:{kind:'defense',line:'mid',against:'monster'},LEFT:[[0,PL],[1.0,PL]],RIGHT:[[0,PR],[1.0,PR]],LIFT:{L:[],R:[]}},'b',
 [{from:.18,to:.36,into:['dodge']},{from:.62,to:1.0,into:['dodge','light','heavy']}]);

// --- C) Ataque leve: corte diagonal curto do ombro direito ao quadril esquerdo, com passo da perna da frente. ---
// Poses validadas da diagonal v12 (cotovelo 142° no contato), tempos de golpe leve: preparo 0,24 s.
const LIGHT_KEYS=[
 {t:0,hold:true,...GP},
 {rollLivre:true,t:.14,hip:[-.02,-.09,-.06],hipYaw:-.48,chestYaw:-.08,pitch:.06,roll:-.05,clav:[-.10,-.12],
  wrist:[-.22,1.30,.05],blade:[-.15,.95,-.25],edge:[-.45,.15,.88],elbow:[-.55,1.05,-.10],free:[.28,.98,.22]},
 {t:.24,hold:true,hip:[-.03,-.10,-.09],hipYaw:-.56,chestYaw:-.26,pitch:.02,roll:-.07,clav:[-.18,-.16],
  wrist:[-.26,1.40,-.02],blade:[-.35,.55,-.76],edge:[0,.81,.59],elbow:[-.62,1.12,-.12],free:[.26,1.00,.30]},
 {t:.34,hip:[0,-.10,.03],hipYaw:-.10,chestYaw:-.30,pitch:.12,roll:-.02,clav:[.06,-.08],
  wrist:[-.30,1.36,.30],blade:[-.40,.75,.52],edge:[.35,-.62,.68],elbow:[-.55,1.00,0],free:[.30,.95,.12]},
 {t:.42,hip:[.025,-.11,.12],hipYaw:.25,chestYaw:.10,pitch:.22,roll:.06,clav:[.26,.02],
  wrist:[-.12,1.12,.60],blade:[.30,-.25,.92],edge:[.57,-.72,-.38],elbow:[-.30,.86,.20],free:[.33,.90,-.12]},
 {t:.47,hip:[.03,-.115,.13],hipYaw:.40,chestYaw:.30,pitch:.26,roll:.08,clav:[.32,.03],
  wrist:[.10,.98,.55],blade:[.62,-.45,.64],edge:[.66,-.18,-.73],elbow:[-.12,.74,.14],free:[.32,.88,-.18]},
 {t:.56,hold:true,hip:[.02,-.11,.11],hipYaw:.52,chestYaw:.45,pitch:.22,roll:.06,clav:[.28,.02],
  wrist:[.26,.90,.32],blade:[.86,-.40,.30],edge:[.20,-.20,-.95],elbow:[-.02,.70,.04],free:[.31,.88,-.16]},
 {rollLivre:true,t:.68,hip:[.01,-.10,.08],hipYaw:.25,chestYaw:.40,pitch:.18,roll:.04,clav:[.20,.01],
  wrist:[.14,.93,.30],blade:[.80,.05,.55],edge:[.25,-.95,-.27],elbow:[-.18,.70,0],free:[.30,.88,-.06]},
 {rollLivre:true,t:.80,hip:[0,-.09,.03],hipYaw:-.05,chestYaw:.28,pitch:.14,roll:.01,clav:[.08,0],
  wrist:[-.04,.99,.26],blade:[.50,.45,.74],edge:[.45,-.80,.05],elbow:[-.38,.74,-.04],free:[.28,.94,.10]},
 {t:.95,hip:[0,-.075,.01],hipYaw:-.20,chestYaw:.15,pitch:.12,roll:0,clav:[.01,0],
  wrist:[-.20,1.00,.21],blade:[.05,.55,.83],edge:[0,-.83,.55],elbow:[-.44,.78,-.10],free:[.25,1.0,.24]},
 {t:1.15,hold:true,...GP}];
const LIGHT_P=contrato({clip:{name:'pve1_c_sword_light',duration:1.15,contact:.42,requiresExtension:true,
  phases:{guard:0,anticipation:.14,charge:.24,activeStart:.30,contact:.42,activeEnd:.50,recovery:.56,guardReturn:1.15}},
 keys:LIGHT_KEYS,extras:{kind:'attack',weight:'light',direction:'diagonal descending (right shoulder -> left hip)'},
 LEFT:[[0,PL],[.16,PL],[.36,[.16,.36,.16,0]],[.62,[.16,.36,.16,0]],[.95,PL]],
 RIGHT:[[0,PR],[.24,PR],[.34,[-.18,-.12,-.28,.14]],[.42,[-.18,-.12,-.16,.32]],[.56,[-.18,-.12,-.10,.36]],[.84,[-.18,-.12,-.30,.05]],[1.15,PR]],
 LIFT:{L:[[.16,.36,.07],[.62,.95,.05]],R:[]}},'c',
 [{from:0,to:.12,into:['dodge','block']},{from:.62,to:1.15,into:['dodge','block','light','heavy']}]);

// --- C) Ataque pesado: corte vertical por cima da cabeça com estocada da perna da frente. ---
// Preparo longo e legível (0,66 s até o fim da carga), descida rápida, o tronco cai sobre a perna e a lâmina
// assenta baixa à frente; recuperação pesada de 0,8 s.
const HEAVY_KEYS=[
 {t:0,hold:true,...GP},
 {rollLivre:true,t:.25,hip:[-.02,-.09,-.06],hipYaw:-.40,chestYaw:-.05,pitch:.02,roll:-.03,clav:[-.08,-.10],
  wrist:[-.32,1.28,.04],blade:[-.10,.95,-.20],elbow:[-.60,1.05,-.08],free:[.26,.98,.20]},
 {rollLivre:true,t:.50,hip:[-.04,-.11,-.10],hipYaw:-.48,chestYaw:-.12,pitch:-.04,roll:-.04,clav:[-.14,-.18],
  wrist:[-.34,1.34,-.08],blade:[-.08,.55,-.83],elbow:[-.64,1.18,-.14],free:[.27,1.00,.28]},
 {rollLivre:true,t:.66,hold:true,hip:[-.045,-.115,-.11],hipYaw:-.50,chestYaw:-.14,pitch:-.06,roll:-.04,clav:[-.15,-.19],
  wrist:[-.35,1.35,-.11],blade:[-.07,.45,-.89],elbow:[-.65,1.20,-.16],free:[.27,1.00,.29]},
 {t:.82,hip:[0,-.11,.04],hipYaw:-.20,chestYaw:-.10,pitch:.12,roll:0,clav:[.08,-.10],
  wrist:[-.27,1.30,.30],blade:[-.05,.90,.43],elbow:[-.58,1.10,0],free:[.30,.95,.10]},
 {t:.92,hip:[.02,-.13,.12],hipYaw:-.05,chestYaw:.02,pitch:.26,roll:.02,clav:[.26,-.02],
  wrist:[-.14,1.00,.55],blade:[-.04,-.05,1.0],elbow:[-.34,.95,.20],free:[.32,.90,-.10]},
 {t:1.02,hip:[.03,-.15,.14],hipYaw:0,chestYaw:.04,pitch:.32,roll:.02,clav:[.28,-.02],
  wrist:[-.13,.86,.48],blade:[-.04,-.40,.92],elbow:[-.30,.84,.20],free:[.32,.88,-.14]},
 {t:1.20,hold:true,hip:[.03,-.16,.14],hipYaw:0,chestYaw:.04,pitch:.34,roll:.02,clav:[.26,-.02],
  wrist:[-.13,.82,.43],blade:[-.04,-.55,.83],elbow:[-.28,.80,.18],free:[.31,.88,-.14]},
 {rollLivre:true,t:1.50,hip:[.01,-.11,.06],hipYaw:-.15,chestYaw:.08,pitch:.20,roll:.01,clav:[.10,0],
  wrist:[-.18,.98,.36],blade:[-.06,.05,.99],elbow:[-.40,.80,.02],free:[.28,.95,.10]},
 {rollLivre:true,t:1.75,hip:[0,-.08,.02],hipYaw:-.22,chestYaw:.11,pitch:.14,roll:0,clav:[.02,0],
  wrist:[-.22,1.00,.26],blade:[-.09,.38,.92],elbow:[-.44,.80,-.08],free:[.25,1.0,.22]},
 {t:2.0,hold:true,...GP}];
for(const k of HEAVY_KEYS)k.edge??=[0,-k.blade[2],k.blade[1]];   // corte vertical: o fio aponta para onde a lâmina desce
const HEAVY_P=contrato({clip:{name:'pve1_c_sword_heavy',duration:2.0,contact:.92,requiresExtension:true,
  phases:{guard:0,anticipation:.25,charge:.50,activeStart:.82,contact:.92,activeEnd:1.05,recovery:1.20,guardReturn:2.0}},
 keys:HEAVY_KEYS,extras:{kind:'attack',weight:'heavy',direction:'vertical overhead'},
 LEFT:[[0,PL],[.70,PL],[.90,[.16,.44,.18,0]],[1.50,[.16,.44,.18,0]],[1.85,PL]],
 RIGHT:[[0,PR],[.66,PR],[.82,[-.18,-.12,-.30,.16]],[.92,[-.18,-.12,-.18,.36]],[1.20,[-.18,-.12,-.12,.40]],[1.60,[-.18,-.12,-.32,.06]],[2.0,PR]],
 LIFT:{L:[[.70,.90,.08],[1.50,1.85,.05]],R:[]}},'c',
 [{from:0,to:.30,into:['dodge','block']},{from:1.50,to:2.0,into:['dodge','block','light']}]);

// --- B) Recuperação (estado 'recuperando'): laço ofegante com pose própria. Entra e sai por mistura. ---
const RP={...GP,hip:[0,-.11,-.02],hipYaw:-.22,chestYaw:.10,pitch:.30,roll:0,clav:[.04,-.06],
 wrist:[-.22,.90,.20],blade:[-.06,-.15,.99],edge:[0,-.99,-.15],elbow:[-.42,.70,-.10],free:[.22,.82,.24]};
const RECOVER_P=contrato({clip:{name:'pve1_b_sword_recover',duration:2.0,contact:null,requiresExtension:false,
  phases:{expira:0,inspira:.7,solta:1.4,ciclo:2.0}},
 keys:[{t:0,hold:true,...RP},{t:.7,...respirar(.02,-.06,.02,0,RP),clav:[.04,0]},{t:1.4,...respirar(-.015,.04,-.012,.005,RP)},{t:2.0,hold:true,...RP}],
 extras:{kind:'stance-idle',seam:'own-pose: mistura de entrada e saída pelo renderizador'},
 LEFT:[[0,PL],[2.0,PL]],RIGHT:[[0,PR],[2.0,PR]],LIFT:{L:[],R:[]}},'b',[{from:0,to:2.0,into:['dodge','block']}],{loop:true});

const PVE_CLIPS=[GUARD_P,...PASSOS_P,RUN_P,BLOCK_P,...DODGE_P,LIGHT_P,HEAVY_P,RECOVER_P];
const CLIPS=V12?[GUARD12,CUT12,BLOCK12,...PASSOS,REV12,DIAG12,THR12,...(PVE?PVE_CLIPS:[])]:V11?[FWD,REV]:[FWD];
let clip,keys,LEFT,RIGHT,LIFT,footWindows;
let clipDef;function useClip(d){clipDef=d;({clip,keys,LEFT,RIGHT,LIFT}=d);footWindows={L:LIFT.L.map(([a,b])=>[a,b]),R:LIFT.R.map(([a,b])=>[a,b])};}
const ci_=process.argv.indexOf('--clip');useClip(ci_>0?CLIPS.find(d=>d.clip.name===process.argv[ci_+1]):process.argv.includes('--rev12')?REV12:process.argv.includes('--diag12')?DIAG12:process.argv.includes('--thr12')?THR12:process.argv.includes('--forward')?PASSOS[0]:process.argv.includes('--back')?PASSOS[1]:process.argv.includes('--guard')?GUARD12:process.argv.includes('--block')?BLOCK12:process.argv.includes('--cut12')?CUT12:process.argv.includes('--reverse')?REV:FWD);   // --probe --reverse|--guard|--block|--cut12
function footAt(track,t,linear){let i=0;while(i<track.length-2&&t>track[i+1][0])i++;const [ta,a]=track[i],[tb,b]=track[i+1],x=clamp((t-ta)/(tb-ta)),u=linear?x:ease(x);return a.map((v,j)=>v+(b[j]-v)*u);}

let prevToe={};const perClipFistHead={};
function pose(time){
 reset();const k=sample(keys,time);
 // Pelvis
 const hp=W.Hips.p.clone().add(V(...k.hip));B.Hips.position.copy(B.Hips.parent.worldToLocal(hp));scene.updateMatrixWorld(true);
 rotWorld(B.Hips,qAxis(UP,k.hipYaw));
 // Spine shares chest yaw/pitch/roll; lower segment takes less (it carries the hips' torque).
 localRot(B.Spine02,k.pitch*.4,k.chestYaw*.45,k.roll*.4);localRot(B.Spine,k.pitch*.6,k.chestYaw*.55,k.roll*.6);
 // Head counter-rotates to keep the eyes on the opponent.
 const total=k.hipYaw+k.chestYaw;localRot(B.neck,-k.pitch*.5,-total*.45,-k.roll*.5);localRot(B.Head,-k.pitch*.3,-total*.35,0);
 // Clavicles: right protracts/elevates with the strike, left mirrors a little as counterweight.
 rotWorld(B.RightShoulder,qAxis(V(0,0,1).applyQuaternion(B.Spine.getWorldQuaternion(Q())),k.clav[1]).multiply(qAxis(UP,k.clav[0])));
 rotWorld(B.LeftShoulder,qAxis(UP,k.clav[0]*.35));
 // Legs (feet) after the pelvis so planted feet stay locked to the ground.
 // Janela com fim além da duração (b > T) dá a volta no laço: o pé que está no ar ao fechar o ciclo da corrida.
 const T_=clip.duration,naJanela=(a,b,t)=>t>=a&&t<=b||b>T_&&t+T_>=a&&t+T_<=b;
 // Clipe com curva de deslocamento: o pé plantado é medido no mundo (pé local + deslocamento do corpo).
 const raiz=clipDef.root?V(clipDef.root(time),0,0):V();
 for(const s of ['L','R']){const fk=footAt(s==='L'?LEFT:RIGHT,time,clip.pesLineares),lift=LIFT[s].reduce((h,[a,b,y])=>naJanela(a,b,time)?y*Math.sin(Math.PI*((time<a?time+T_:time)-a)/(b-a)):h,0);
  const r=foot(s==='L'?'Left':'Right',[...fk,lift],s==='L'?.08:-.08);r.toe.add(raiz);
  if(prevToe[s]&&!footWindows[s].some(([a,b])=>naJanela(a,b,time))){const d=prevToe[s].distanceTo(r.toe);
   if(clip.pesPercorrem)diag.maxFootTravelOnPlant=Math.max(diag.maxFootTravelOnPlant??0,d);
   else diag.maxFootSlideOnPlant=Math.max(diag.maxFootSlideOnPlant,d);}
  prevToe[s]=r.toe;}
 // PvE (clipes que não são laço): a antecipação do cotovelo cresce de 0 a 20 ms no começo, senão o quadro 0 já sai da guarda.
 // Arms: shoulder leads, elbow follows, wrist lags slightly behind -> whip through the contact.
 // Blade lags the hand a little (whip). The elbow is pulled toward where the forearm must be to hold
 // that blade with that edge, so the forearm follows the sword instead of the wrist breaking.
 // PvE (clipes que não são laço): o atraso de 25 ms da lâmina some nos últimos 25 ms, para o último quadro fechar na guarda.
 const bl=sample(keys,Math.max(0,time-(clipDef.extras?.contract&&!clipDef.extras.loop?Math.min(.025,clip.duration-time):.025))),blade=V(...bl.blade).normalize(),hAxis=handAxis(blade,V(...bl.edge).normalize());
 const wrist=V(...k.wrist),pole=V(...sample(keys,time+(clipDef.extras?.contract&&!clipDef.extras.loop?Math.min(.02,time):.02)).elbow).lerp(wrist.clone().addScaledVector(hAxis,-.221),ELBOW_FOLLOW);
 const err=ik('RightArm','RightForeArm','RightHand',wrist,pole);
 diag.maxHandError=Math.max(diag.maxHandError,err);
 orientHand(blade,hAxis);
 if(V10)curlFingers();
 const free=V(...k.free);ik('LeftArm','LeftForeArm','LeftHand',free,free.clone().add(V(.15,-.2,-.35)));
 diag.minFreeHandHeight=Math.min(diag.minFreeHandHeight,free.y);diag.maxFreeHandHeight=Math.max(diag.maxFreeHandHeight,free.y);
 // Elbow angle
 const s=B.RightArm.getWorldPosition(V()),e=B.RightForeArm.getWorldPosition(V()),w=B.RightHand.getWorldPosition(V());
 const ang=deg(s.sub(e).angleTo(w.sub(e)));diag.minElbowDeg=Math.min(diag.minElbowDeg,ang);diag.maxElbowDeg=Math.max(diag.maxElbowDeg,ang);
 // Blade vs torso: sample points along the blade and measure penetration into a torso capsule.
 const sq=B.RightHand.getWorldQuaternion(Q()).multiply(socketLocalQ),sp=socketLocalPos.clone().applyQuaternion(B.RightHand.getWorldQuaternion(Q())).add(B.RightHand.getWorldPosition(V()));
 const axis=V(0,0,1).applyQuaternion(sq),hipsP=B.Hips.getWorldPosition(V()),neckP=B.neck.getWorldPosition(V());
 for(let d=.12;d<=.98;d+=.04){const p=sp.clone().addScaledVector(axis,d);const seg=neckP.clone().sub(hipsP),u=clamp(p.clone().sub(hipsP).dot(seg)/seg.lengthSq());
  const dist=p.distanceTo(hipsP.clone().addScaledVector(seg,u));diag.maxSwordBodyPenetration=Math.max(diag.maxSwordBodyPenetration,.15-dist);}
 // PvE: o punho fechado não pode entrar na cabeça (no golpe por cima ele passa ao lado do rosto).
 if(PVE){const hd=sp.distanceTo(B.Head.getWorldPosition(V()));diag.minFistHeadM=Math.min(diag.minFistHeadM??9,hd);if(clipDef.extras?.contract)perClipFistHead[clip.name]=Math.min(perClipFistHead[clip.name]??9,hd);}
 diag.samples++;
}
function resolverRoll(){
 for(const k of keys){if(!k.rollLivre)continue;
  const b=V(...k.blade).normalize(),ref=Math.abs(b.y)<.9?V(0,1,0):V(1,0,0),p0=ref.addScaledVector(b,-ref.dot(b)).normalize();
  let melhor=null;
  for(let i=0;i<36;i++){k.edge=p0.clone().applyAxisAngle(b,i*Math.PI/18).toArray();
   const z=structuredClone(diag);diag.maxWristDeviationDeg=0;prevToe={};lastTwist=null;
   // A pose lê a lâmina 25 ms antes; amostrar a janela em volta da chave mede o efeito real do giro.
   for(const dt of [-.06,-.02,.02,.06])pose(clamp(k.t+dt,0,clip.duration));
   const d=diag.maxWristDeviationDeg;Object.assign(diag,z);if(!melhor||d<melhor.d)melhor={d,e:k.edge};}
  k.edge=melhor.e.map(x=>+x.toFixed(3));}
 prevToe={};lastTwist=null;}
{const atual=clipDef;for(const d of CLIPS){useClip(d);resolverRoll();}useClip(atual);}
if(process.argv.includes('--simgap')){
 const {armaLocal,usarGuardaFechada}=await import('../src/trajetoria-arma.js');usarGuardaFechada(true);
 const imp=clip.contact,dur=clip.duration,ix=+(process.argv[process.argv.indexOf('--simgap')+1]??0)||0;
 let pior={d:0},piorAng={a:0};const linhas=[];
 for(let n=0;n<=Math.round(dur*60);n++){const t=n/60;prevToe={};lastTwist=null;pose(t);
  const hq=B.RightHand.getWorldQuaternion(Q()),sock=socketLocalPos.clone().applyQuaternion(hq).add(B.RightHand.getWorldPosition(V()));
  const dirA=V(0,0,1).applyQuaternion(hq.clone().multiply(socketLocalQ));
  const fase=t<=imp?t/imp:1+(t-imp)/(dur-imp);
  const sim=armaLocal('espada',{fase,altura:1.75,alcance:1.05,indice:ix,pesado:process.argv.includes('--pesado')});
  const g=V(...sim.grip),dirS=V(...sim.tip).sub(g).normalize(),d=sock.distanceTo(g),ang=deg(dirA.angleTo(dirS));
  if(d>pior.d)pior={d,t};if(ang>piorAng.a)piorAng={a:ang,t};
  if(n%12===0||Math.abs(t-imp)<1/120)linhas.push(t.toFixed(2)+' fase '+fase.toFixed(2)+' gap '+d.toFixed(3)+' m ang '+ang.toFixed(0)+' graus');}
 console.log(linhas.join('\n'));console.log(clip.name,'pior gap',pior.d.toFixed(3),'m em',pior.t.toFixed(2),'s | pior angulo',piorAng.a.toFixed(0),'graus em',piorAng.t.toFixed(2),'s');process.exit(0);}
if(process.argv.includes('--sweep')){const z=structuredClone(diag);let worst=[];
 for(let n=0;n<=Math.round(clip.duration*120);n++){const t=n/120;Object.assign(diag,structuredClone(z));prevToe={};lastTwist=null;pose(t);worst.push([diag.maxWristDeviationDeg,t,diag.maxElbowDeg,diag.maxHandError,diag.maxFootSlideOnPlant]);}
 const mh=Math.max(...worst.map(w=>w[3])),mf=Math.max(...worst.map(w=>w[4]));console.log(clip.name,'maoMax',mh.toFixed(4),'em',worst.find(w=>w[3]===mh)[1].toFixed(2));worst.sort((x,y)=>y[0]-x[0]);console.log(clip.name,worst.slice(0,8).map(([d,t,e])=>t.toFixed(3)+'s='+d.toFixed(0)+'deg/elb'+e.toFixed(0)).join(' '));process.exit(0);}
if(process.argv.includes('--probe')){const z=structuredClone(diag),f=v=>v.toArray().map(x=>x.toFixed(2)).join(',');
 for(const t of [0,.2,.42,.56,.7,.78,.84,.93,1.02,1.18,1.35,1.5,1.7]){Object.assign(diag,structuredClone(z));prevToe={};pose(t);
  console.log(t.toFixed(2),'elbow',diag.maxElbowDeg.toFixed(0),'wristDev',diag.maxWristDeviationDeg.toFixed(0),'twist',diag.maxForearmTwistDeg.toFixed(0),'pen',diag.maxSwordBodyPenetration.toFixed(3),'sh',f(B.RightArm.getWorldPosition(V())),'wr',f(B.RightHand.getWorldPosition(V())),'sword',f(V(0,0,1).applyQuaternion(B.RightHand.getWorldQuaternion(Q()).multiply(socketLocalQ))),'want',f(V(...sample(keys,Math.max(0,t-.025)).blade).normalize()),'socket',f(socketLocalPos.clone().applyQuaternion(B.RightHand.getWorldQuaternion(Q())).add(B.RightHand.getWorldPosition(V()))));}
 process.exit(0);}

// ---------- Append-only GLB writing (accessor alignment, original BIN prefix untouched) ----------
let chunks=[originalBin],cursor=originalBin.length;
function append(data){const buf=Buffer.from(data.buffer,data.byteOffset,data.byteLength);const pad=(4-cursor%4)%4;if(pad){chunks.push(Buffer.alloc(pad));cursor+=pad;}const start=cursor;chunks.push(buf);cursor+=buf.length;return start;}
function accessor(data,type,componentType=5126,min,max){const start=append(data);doc.bufferViews.push({buffer:0,byteOffset:start,byteLength:data.byteLength});
 const a={bufferView:doc.bufferViews.length-1,componentType,count:data.length/{SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type],type};if(min)a.min=min;if(max)a.max=max;doc.accessors.push(a);return doc.accessors.length-1;}
const FPS=60;let times;const perClipQa={};
// PvE mede por clipe também mão, pé e penetração da lâmina, para o portão apontar o clipe que falha.
const QA_CLIPE=['minElbowDeg','maxElbowDeg','maxWristDeviationDeg','maxForearmTwistDeg','maxFootSlideOnPlant',...(PVE?['maxHandError','maxFootError','maxSwordBodyPenetration','maxFreeHandHeight']:[])];
// v12: a simulação lê o golpe AUTORADO em vez de uma trajetória escrita à parte. Medido antes desta troca:
// o corte autorado e o simulado divergiam até 0,56 m e 105°, e a mão desenhada era arrastada até o punho
// simulado. Espaço nativo do GLB (altura NATIVE_H); a simulação escala pela altura do Hunter.
const LAMINAS={},NATIVE_H=1.7004320149862906;
function registrarLamina(nome){const hq=B.RightHand.getWorldQuaternion(Q()),p=socketLocalPos.clone().applyQuaternion(hq).add(B.RightHand.getWorldPosition(V())),d=V(0,0,1).applyQuaternion(hq.multiply(socketLocalQ));
 (LAMINAS[nome]??=[]).push([...p.toArray().map(x=>x/NATIVE_H),...d.toArray()].map(x=>+x.toFixed(5)));
 return p.z+d.z*.45;}   // alcance do trecho que corta (60% da lâmina) em direção ao adversário
for(const def of CLIPS){useClip(def);const before=structuredClone(diag);
// quadros deste clipe: `times` é reusado entre clipes, então o manifesto guarda o número por clipe.
const N=Math.round(clip.duration*FPS);def.frames=N+1;times=Array.from({length:N+1},(_,i)=>i/FPS);
const rot=new Map(doc.skins[0].joints.map(i=>[i,[]]));const hips=[];prevToe={};lastTwist=null;
if(V11)for(const k of QA_CLIPE)diag[k]=k.startsWith('min')?180:0;
// v12: o CONTATO é calculado, não declarado: é o instante em que a lâmina chega mais longe na direção do
// adversário. Declarado à mão (0,84 s), ele caía antes de a lâmina cruzar a linha, e o aparo não achava aço.
let alcanceMax={z:-9,t:0};
for(const t of times){pose(t);if(V12&&def.extras?.kind==='attack'){const z=registrarLamina(def.clip.name);if(z>alcanceMax.z)alcanceMax={z,t};}for(const [i,v] of rot){const q=nodes[i].quaternion.clone().normalize();if(v.length&&q.dot(Q().fromArray(v,v.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);v.push(...q.toArray());}hips.push(...B.Hips.position.toArray());}
if(V11){perClipQa[clip.name]=Object.fromEntries(QA_CLIPE.map(k=>[k,diag[k]]));
 if(clip.requiresExtension!==false&&diag.maxElbowDeg<140&&!process.argv.includes('--draft'))throw Error(clip.name+': arm never extends at contact: '+diag.maxElbowDeg);
 for(const k of ['minElbowDeg'])diag[k]=Math.min(diag[k],before[k]);for(const k of QA_CLIPE.slice(1))diag[k]=Math.max(diag[k],before[k]);}
if(V12&&def.extras?.kind==='attack'){clip.contact=+alcanceMax.t.toFixed(4);if(clip.phases)clip.phases.contact=clip.contact;}
const inp=accessor(new Float32Array(times),'SCALAR',5126,[0],[clip.duration]);
const anim={name:clip.name,extras:{kind:'pvp-sword-animation-only',version:VER,status:'pending-director-approval',contact:clip.contact,impact:clip.contact,phases:clip.phases,
 motion:'in-place (front foot steps in and returns)',weaponSocket:SOCKET,hand:'right',freeHand:'counterweight-below-chest',source:'hunter_combat_v05.glb',...def.extras},samplers:[],channels:[]};
for(const [id,v] of rot){anim.samplers.push({input:inp,output:accessor(new Float32Array(v),'VEC4'),interpolation:'LINEAR'});anim.channels.push({sampler:anim.samplers.length-1,target:{node:id,path:'rotation'}});}
anim.samplers.push({input:inp,output:accessor(new Float32Array(hips),'VEC3'),interpolation:'LINEAR'});anim.channels.push({sampler:anim.samplers.length-1,target:{node:nodes.indexOf(B.Hips),path:'translation'}});
doc.animations.push(anim);}
if(PVE){
 // Fonte única do contrato PvE (seção 6): tempo, fases, janelas, contatos de pé, curva de deslocamento e,
 // nos ataques, punho e direção da lâmina por quadro. A simulação e a IA leem daqui.
 const tab=Object.fromEntries(PVE_CLIPS.map(d=>{const e=d.extras;return[d.clip.name,{module:e.module,weapon:e.weapon,loop:e.loop,
  duration:d.clip.duration,fps:FPS,impact:d.clip.contact,phases:d.clip.phases,interrupts:e.interrupts,footContacts:e.footContacts,
  ...(e.stride?{stride:e.stride,stance:e.stance}:{}),rootMotion:e.rootMotion,...(LAMINAS[d.clip.name]?{frames:LAMINAS[d.clip.name]}:{})}];}));
 await writeFile(new URL('../src/trajetorias-pve1.js',import.meta.url),
  '// GERADO por scripts/animate-hunter-pvp-v09.mjs --pve1. Não editar à mão.\n'+
  '// Contrato hunter-pve-v01: tempo, fases, interrupções, contatos de pé e deslocamento de cada clipe PvE; nos\n'+
  '// ataques, punho (em alturas de corpo) e direção da lâmina autorados por quadro a 60 fps.\n'+
  'export default '+JSON.stringify(tab)+';\n');}
else if(V12){const tab=Object.fromEntries(CLIPS.filter(d=>LAMINAS[d.clip.name]).map(d=>[d.clip.name,{impact:d.clip.contact,duration:d.clip.duration,fps:FPS,frames:LAMINAS[d.clip.name]}]));
 await writeFile(new URL('../src/trajetorias-pvp12.js',import.meta.url),
  '// GERADO por scripts/animate-hunter-pvp-v09.mjs --v12. Não editar à mão.\n'+
  '// Punho (em alturas de corpo) e direção da lâmina AUTORADOS, por quadro a 60 fps. A simulação lê daqui,\n'+
  '// então a lâmina desenhada e a do teste de contato são o mesmo golpe.\n'+
  'export default '+JSON.stringify(tab)+';\n');}
if(V10){doc.skins[0].inverseBindMatrices=accessor(newIBM,'MAT4');const at=doc.meshes[0].primitives[0].attributes;at.JOINTS_0=accessor(newJoints,'VEC4',5121);at.WEIGHTS_0=accessor(newWeights,'VEC4');}

// ---------- Real sword mesh on a RightHand socket (blade +Z, edge along socket X) ----------
const m0=doc.materials.length;
for(const [name,c,met,r] of [[`PvP${VN}_Steel`,[.74,.77,.79,1],.8,.32],[`PvP${VN}_LeatherGrip`,[.20,.12,.07,1],0,.9],[`PvP${VN}_IronGuard`,[.36,.33,.30,1],.7,.45]])
 doc.materials.push({name,pbrMetallicRoughness:{baseColorFactor:c,metallicFactor:met,roughnessFactor:r}});
// Each part: cross-section at z0 (w0,h0) and z1 (w1,h1); tapered blade, real flat profile.
function part(z0,z1,w0,t0_,w1,t1,mat){
 const P=[[-w0/2,-t0_/2,z0],[w0/2,-t0_/2,z0],[w0/2,t0_/2,z0],[-w0/2,t0_/2,z0],[-w1/2,-t1/2,z1],[w1/2,-t1/2,z1],[w1/2,t1/2,z1],[-w1/2,t1/2,z1]];
 const F=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],pos=[],nor=[],idx=[];
 for(const f of F){const a=V(...P[f[0]]),b=V(...P[f[1]]),c=V(...P[f[2]]),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const s=pos.length/3;for(const i of f){pos.push(...P[i]);nor.push(...n.toArray());}idx.push(s,s+1,s+2,s,s+2,s+3);}
 const pa=new Float32Array(pos),mn=[0,1,2].map(j=>Math.min(...pos.filter((_,i)=>i%3===j))),mx=[0,1,2].map(j=>Math.max(...pos.filter((_,i)=>i%3===j)));
 return {attributes:{POSITION:accessor(pa,'VEC3',5126,mn,mx),NORMAL:accessor(new Float32Array(nor),'VEC3')},indices:accessor(new Uint16Array(idx),'SCALAR',5123),mode:4,material:m0+mat};
}
doc.meshes.push({name:SWORD+'_Mesh',primitives:[
 part(G0+.025,.80,.046,.011,.034,.008,0),   // blade
 part(.80,.93,.034,.008,.004,.004,0),       // point
 part(G1,G0,.030,.026,.030,.026,1),         // grip (through the fist)
 part(G0,G0+.025,.17,.03,.17,.03,2),        // cross-guard
 part(G1-.035,G1,.045,.04,.045,.04,2)       // pommel
]});
const handIdx=nodes.indexOf(B.RightHand),sockIdx=doc.nodes.length;
doc.nodes.push({name:SOCKET,translation:socketLocalPos.toArray(),rotation:socketLocalQ.toArray(),children:[sockIdx+1]});
doc.nodes.push({name:SWORD,mesh:doc.meshes.length-1});
doc.nodes[handIdx].children=[...(doc.nodes[handIdx].children??[]),sockIdx];

// ---------- Guards: original data untouched, motion inside anatomical tolerances ----------
for(const f of ['skins','textures','images','samplers'])if(!(V10&&f==='skins')&&JSON.stringify(doc[f])!==JSON.stringify(original[f]))throw Error('Original '+f+' modified');
original.meshes.forEach((m,i)=>{const d=structuredClone(doc.meshes[i]);if(V10&&i===0)for(const k of ['JOINTS_0','WEIGHTS_0'])d.primitives[0].attributes[k]=m.primitives[0].attributes[k];
 if(JSON.stringify(d)!==JSON.stringify(m))throw Error('Original mesh altered')});
if(V10){const o=original.skins[0],n=doc.skins[0];if(JSON.stringify(n.joints.slice(0,o.joints.length))!==JSON.stringify(o.joints)||n.skeleton!==o.skeleton)throw Error('Original joint order changed');
 // Old clips leave finger bones at rest: skinning must match the v05 weights exactly in any pose.
 reset();rotWorld(B.RightHand,qAxis(V(1,2,3).normalize(),.9));rotWorld(B.LeftHand,qAxis(V(-2,1,1).normalize(),1.1));localRot(B.Spine,.2,.4,.1);
 const a=skin(oldJ,oldW,oldIBM),b=skin(newJoints,newWeights,newIBM);diag.oldClipSkinDeltaM=Math.max(...a.map((v,i)=>v.distanceTo(b[i])));
 if(diag.oldClipSkinDeltaM>1e-5)throw Error('Finger rig changes old clips: '+diag.oldClipSkinDeltaM);diag.grip=gripFit;reset();}
original.materials.forEach((m,i)=>{if(JSON.stringify(doc.materials[i])!==JSON.stringify(m))throw Error('Original material altered')});
original.animations.forEach((a,i)=>{if(JSON.stringify(doc.animations[i])!==JSON.stringify(a))throw Error('Original clip altered: '+a.name)});
const LIMITS={maxHandError:.01,maxFootError:.012,maxFootSlideOnPlant:.002,maxWristDeviationDeg:60,maxForearmTwistDeg:200,maxSwordBodyPenetration:0,maxFreeHandHeight:1.05};
const DRAFT=process.argv.includes("--draft");
// PvE: centro do punho fechado a 16 cm ou mais do centro da cabeça em todo quadro.
if(PVE){diag.perClipFistHeadM=perClipFistHead;if(diag.minFistHeadM<.16&&!DRAFT)throw Error('QA punho na cabeça: '+diag.minFistHeadM);}for(const [k,v] of Object.entries(LIMITS))if(diag[k]>v&&!DRAFT)throw Error(`QA ${k}=${diag[k]} > ${v}`);
if(diag.maxElbowDeg<140&&!DRAFT)throw Error('Arm never extends at contact: '+diag.maxElbowDeg);

const bin=Buffer.concat(chunks);doc.buffers[0].byteLength=bin.length;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
const result=Buffer.concat([header,json,bh,bin]);
const sha=x=>createHash('sha256').update(x).digest('hex');
await mkdir(OUT,{recursive:true});await writeFile(new URL(FILE,OUT),result);
const manifest={version:PVE?'pve-v01-lote1-espada':V12?'pvp-v12-biblioteca-pvp-nova':`pvp-${VER}-horizontal-cut`,status:'pending-director-approval',...(PVE?{contract:'hunter-pve-v01'}:{}),source:'labs/hunters/assets/hunter-v05/hunter_combat_v05.glb',sourceSha256:sha(raw),
 file:FILE,sha256:sha(result),bytes:result.length,characterTriangles:1000,swordTriangles:60,skinJoints:doc.skins[0].joints.length,
 joints:doc.skins[0].joints.map(i=>doc.nodes[i].name),oldClips:original.animations.length,clips:doc.animations.length,newClips:CLIPS.map(d=>({...d.clip,fps:FPS,frames:d.frames})),...(V11?{perClipQa}:{}),
 weaponSocket:SOCKET,socketTranslation:socketLocalPos.toArray(),socketRotation:socketLocalQ.toArray(),gripAngleDeg:90-GRIP*180/Math.PI,
 originalBinaryPrefixUnchanged:bin.subarray(0,originalBin.length).equals(originalBin),qa:diag,qaLimits:LIMITS,
 ...(V10?{fingerRig:{bones:FINGERS.flatMap(f=>[f.f1.name,f.f2.name]),knuckleM:KNUCKLE,middleM:MIDDLE,curlRad:CURL,
  note:'Ossos novos ficam em identidade nos 83 clipes antigos (sem canais); IBM = L^-1 x IBM_mao, logo o skin antigo e identico.'}}:{}),
 limitations:[V10?'Dedos fecham como dois blocos (proximal+distal) por mão; sem dedos individuais nem polegar animado.':'Rig de 19 ossos sem dedos: a mão não fecha, o cabo passa sob a palma.','Sem ossos de dedo do pé: o pivô do calcanhar gira o pé inteiro em torno da bola do pé.','Somente versão in-place; sem variante root motion.']};
await writeFile(new URL('manifest.json',OUT),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({sha256:manifest.sha256,bytes:manifest.bytes,clips:manifest.clips,qa:diag}));
