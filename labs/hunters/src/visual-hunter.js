// Human transforms and skeleton have a single owner; the creature animator is not run for Hunters.
import {sampleCombatAnimation} from './animacao-jogador.js?revision=epic1';
import {amostrarArma,giroAcao} from './trajetoria-arma.js';
export function instalarVisualHunter(v,g,agente,{tempo,alturaEm,terreno}){
 const T=v.THREE,clips=g.animations;
 // Rig v13 (PvE v02): a guarda é pve2_b_sword_guard; este GLB não tem os clipes da v04.
 const guardaV13=clips.some(c=>c.name==='pve2_b_sword_guard');
 if(!guardaV13&&!clips.some(c=>c.name==='combat_guard'))throw new Error('GLB Hunter sem combat_guard; carregue a versão v04.');
 v.mixer.stopAllAction();
 // A espada do GLB (socket PvP) serve de referência de pose; quem é desenhado na arena é a espada
 // simulada do laboratório, senão o Hunter apareceria com duas lâminas.
 // PvE v01: a espada desenhada é a do GLB, presa ao socket, e o braço segue o clipe autorado. A trajetória simulada
 // ainda é a antiga (a simulação passa a ler trajetorias-pve1.js na etapa da IA), então ela não move a mão aqui.
 // A espada desenhada é a do GLB tanto no PvE v01 quanto no rig v13; a simulada é escondida pelo laboratório.
 const pve1=guardaV13||clips.some(c=>c.name==='pve1_b_sword_guard');
 v.modelo.traverse(x=>{if(/_OneHanded_Sword$/.test(x.name??''))x.visible=pve1;});
 // PvE v02 (?pve1=1&pve2=1): transição por inércia, contato de pé do clipe, troca de pegada e flinch no osso 'neck'.
 // Sem a flag nada muda. Com o rig v13 carregado a flag é obrigatória: só os clipes pve2_* existem no GLB.
 const pve2=pve1&&(guardaV13||new URLSearchParams(globalThis.location?.search??'').has('pve2'));
 const controller={root:v.modelo,mixer:v.mixer,actions:Object.fromEntries(clips.map(c=>[c.name,v.mixer.clipAction(c)])),clip:null,pve1,pve2,
  clipMeta:Object.fromEntries((g.parser?.json?.animations??[]).map(c=>[c.name,c.extras??{}])),bodyScale:v.escalaBase,
  ground:(x,z)=>alturaEm(x+terreno().largura/2,z+terreno().profundidade/2),poseTracks:{}};
 for(const clip of clips)controller.poseTracks[clip.name]=clip.tracks.map(track=>{const binding=new T.PropertyBinding(v.modelo,track.name);binding.bind();return{binding,interpolant:track.createInterpolant()};});
 v.controladorTatico=controller;
 v.passoSimulacao=a=>{v.ant={...v.cur};v.cur={x:a.x,y:a.y,z:a.z,prof:0};v.aplicarEscala(a);};
 v.quadro=(alfa,dtReal,a,t,altura)=>{
  v.quadroSimples(alfa,dtReal,a,t,altura);v.inclinacao.rotation.set(0,0,0);
  // PvE v02: o mesmo giro que a lâmina simulada recebe (giroAcao), em torno do eixo vertical do próprio modelo.
  if(pve2)v.modelo.rotation.y=giroAcao(a.hunter?.action??a.tatica?.action,tempo());
  controller.lastResult=sampleCombatAnimation(controller,a,tempo(),dtReal);
  // A guarda de aparo é uma pose resolvida pela simulação, como o golpe: a mão vai até o punho da espada,
  // senão o clipe de bloqueio põe a mão num lugar e a lâmina fica em outro.
  const golpe=a.hunter?.action,guarda=a.hunter?.guarda,t0=tempo();
  const action=golpe&&t0>=golpe.start&&t0<golpe.end?golpe:guarda&&t0>=guarda.start&&t0<guarda.end?guarda:null;
  if(action&&!pve1){
   const s=amostrarArma(action,tempo(),{arma:a.hunter.equipamento.arma,altura:a.especie.corpo.alturaM*a.escala});
   const target=v.pivo.localToWorld(new T.Vector3(...s.grip));
   // O punho simulado é o CENTRO DO PUNHO FECHADO (socket do GLB PvP), não o pulso. Sem descontar o
   // deslocamento pulso->socket o IK punha o pulso no cabo e a espada ficava ~7 cm fora da mão.
   const socket=v.modelo.getObjectByName('RightHand')?.children.find(x=>/^WeaponSocket_Right_/.test(x.name??''));
   // Duas passadas: o IK também gira a mão, e com ela muda o deslocamento pulso->socket.
   const alvoPunho=target.clone();
   for(let passada=0;passada<(socket?2:1);passada++){
    if(socket){v.modelo.updateMatrixWorld(true);target.copy(alvoPunho).sub(socket.getWorldPosition(new T.Vector3()).sub(socket.parent.getWorldPosition(new T.Vector3())));}
    if(passada===0)ajustarApoio(T,v,target);alinharMao(T,v,'Right',target);
   }
   if(a.hunter.equipamento.arma==='montante')alinharMao(T,v,'Left',v.pivo.localToWorld(new T.Vector3(s.grip[0]-.065,s.grip[1]-.015,s.grip[2]-.07)));
  }
 };
 // Pose the rig before the first visible frame, including when the simulation starts paused.
 controller.lastResult=sampleCombatAnimation(controller,agente,tempo(),0);
 return controller;
}

// Fit the exported motion to the observed target's exact height without changing simulation or rig.
function alinharMao(T,v,side,target,first='Arm',second='ForeArm',last='Hand'){
 const root=v.modelo,upper=root.getObjectByName(side+first),elbow=root.getObjectByName(side+second),hand=root.getObjectByName(side+last);if(!upper||!elbow||!hand)return;
 root.updateMatrixWorld(true);const start=upper.getWorldPosition(new T.Vector3()),middle=elbow.getWorldPosition(new T.Vector3()),end=hand.getWorldPosition(new T.Vector3()),l1=start.distanceTo(middle),l2=middle.distanceTo(end),axis=target.clone().sub(start),raw=axis.length();if(raw<.001)return;
 const d=Math.min(raw,l1+l2-.00001);axis.normalize();target=start.clone().addScaledVector(axis,d);
 const along=(l1*l1-l2*l2+d*d)/(2*d),bend=middle.clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis));if(bend.length()<.001)bend.set(side==='Right'?-1:1,-.5,0);bend.normalize();
 const joint=start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
 const rotate=(bone,child,to)=>{const from=bone.getWorldPosition(new T.Vector3()),dir=child.getWorldPosition(new T.Vector3()).sub(from).normalize(),want=to.clone().sub(from).normalize(),q=new T.Quaternion().setFromUnitVectors(dir,want).multiply(bone.getWorldQuaternion(new T.Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);};
 rotate(upper,elbow,joint);rotate(elbow,hand,target);
}

function ajustarApoio(T,v,target){
 const r=v.modelo,hip=r.getObjectByName('Hips'),arm=r.getObjectByName('RightArm'),elbow=r.getObjectByName('RightForeArm'),hand=r.getObjectByName('RightHand');if(!hip||!arm||!elbow||!hand)return;
 r.updateMatrixWorld(true);const p=arm.getWorldPosition(new T.Vector3()),q=elbow.getWorldPosition(new T.Vector3()),h=hand.getWorldPosition(new T.Vector3()),length=p.distanceTo(q)+q.distanceTo(h)-.005,horizontal=Math.hypot(p.x-target.x,p.z-target.z),vertical=Math.sqrt(Math.max(0,length*length-horizontal*horizontal)),drop=Math.max(0,Math.min(.30,p.y-target.y-vertical));
 if(drop<.001)return;
 const feet=['Left','Right'].map(side=>({side,target:r.getObjectByName(side+'Foot')?.getWorldPosition(new T.Vector3())}));
 hip.position.y-=drop/v.escalaBase;r.updateMatrixWorld(true);
 for(const foot of feet)if(foot.target)alinharMao(T,v,foot.side,foot.target,'UpLeg','Leg','Foot');
}
