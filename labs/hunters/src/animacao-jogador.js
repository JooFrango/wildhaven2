// View-only sampler. Clips follow authoritative simulation time; this module never produces damage.
import {tempoAcao,clipePvp12,trajetoriaPve,CARGA_PVE2} from './trajetoria-arma.js';
import {iniciarRotacao,iniciarPosicao,aplicarRotacao,aplicarPosicao,peNoChao,DURACAO} from './inercia.js';
export function combatAnimation(a,t){
 const h=a.hunter,action=h?.action??a.tatica?.action;
 if(!h){if(!a.vivo)return{name:a.labOutcome==='incapacitado'?(a.especie.modelo.clipes.descansar??'rest'):(a.especie.modelo.clipes.morte??'death'),time:t-(a.tatica?.outcomeTime??t-2),oneShot:true};const name=action&&t<=action.end?action.name:a.golpe?.nome;return{name:name?(a.especie.modelo.clipes[name]??name):a.agarrando?(a.especie.modelo.clipes.comer??'bite'):a.velocidade>3?'run':a.velocidade>.15?'walk':a.estado==='ameacando'||a.estado==='intimidando'?'threat_display':'idle',time:action?t-action.start:a.golpe?t-a.golpe.inicio:t,oneShot:!!name};}
 const outcome=h.outcome??h.situacao;
 if(h.getUpUntil>t)return{name:'combat_get_up',time:t-h.getUpStarted,oneShot:true};
 if(outcome==='rendicao'||outcome==='rendido')return{name:'combat_surrender',time:t-(a.tatica?.outcomeTime??t-1.1),oneShot:true};
 if(outcome==='retirada')return{name:'combat_guard',time:t};
 if(!a.vivo||outcome==='morte')return{name:'combat_death',time:t-(a.tatica?.outcomeTime??t-1.5),oneShot:true};
 if(a.saude.caidoAte>t||outcome==='incapacitado')return{name:'combat_knockdown',time:t-(a.tatica?.fallTime??t-1.2),oneShot:true};
 if(a.saude.atordoadoAte>t)return{name:'combat_stagger',time:t% .8,oneShot:false};
 // A parried attacker recoils off the other blade, exactly like the Hunter who held the guard.
 const reaction=h.reacaoImpacto, reactionName=reaction?.tipo==='bloqueio'||reaction?.tipo==='aparo'?'combat_guard_recoil':reaction?.intensidade>=.65?'combat_hit_heavy':'combat_hit_light';
 if(reaction&&t-reaction.t<.32&&!(action&&t<action.end))return{name:reactionName,time:t-reaction.t,oneShot:true};
 if(a.mente?.atingidoPor&&!(action&&t<action.end)&&t-a.mente.atingidoPor.t<.45)return{name:'combat_hit',time:t-a.mente.atingidoPor.t,oneShot:true};
 if(h.dodgeUntil>t){
 // PvE v01: a IA escolheu o lado (`lado`) e a esquiva dura o que o clipe dura (1,00 s). `time` sai na escala de 0,65 s que
 // remapPve1 ainda espera e desfaz (time/.65*duração): o clipe toca em tempo real, sem esticar.
 if(h.esquivaPve||h.dodgeLado){const dur=h.dodgeUntil-h.dodgeStarted;return{name:'combat_dodge',time:(t-h.dodgeStarted)*.65/dur,lado:h.dodgeLado,duracao:dur,oneShot:true};}
 return{name:'combat_dodge',time:.65-(h.dodgeUntil-t),oneShot:true};}
 if(h.blockUntil>t||h.postura==='defesa')return{name:'combat_block',time:.35,oneShot:true};
 if(action&&t<action.end){let name=action.name;if(!/^(spear|sword|greatsword|unarmed)_/.test(name))name=({lanca:'spear',espada:'sword',montante:'greatsword',maos:'unarmed'}[h.equipamento?.arma]??'unarmed')+'_'+(/pesado|heavy/.test(name)?'heavy':'light');const suffix=action.goal==='cabeca'?'_high':action.goal==='pernas'?'_low':'';if(suffix&&!/_high$|_low$/.test(name))name+=suffix;const fim=action.aparo?action.end-(action.aparo.ate-action.aparo.t):action.end;return{name,time:tempoAcao(action,t)-action.start,impact:action.impact-action.start,duration:fim-action.start,oneShot:true,counter:!!action.counter,variante:action.variante};}
 if(a.velocidade>2.2)return{name:a.velocidade>4?'hunter_run':'hunter_jog',locomotion:true,time:t};
 if(a.velocidade>.12){const direction=(a.direcaoMovimento??a.direcao)-a.direcao,relative=Math.atan2(Math.sin(direction),Math.cos(direction));return{name:Math.abs(relative)>2.2?'combat_step_back':Math.abs(relative)>.65?relative>0?'combat_step_right':'combat_step_left':'hunter_walk',locomotion:true,time:t};}
 if(Math.abs(a.velAngular??0)>.4)return{name:a.velAngular>0?'combat_turn_right':'combat_turn_left',time:t,locomotion:true};
 const weapon={lanca:'spear',espada:'sword',montante:'greatsword',maos:'unarmed'}[h.equipamento?.arma]??'unarmed';
 return{name:(a.estado==='recuperando'?'recover_':'guard_')+weapon,time:t};
}
const PVP12={guarda:'pvp12_guard',ataque:'pvp12_sword_horizontal_cut',bloqueio:'pvp12_sword_block'};
// Locomoção: o passo segue a distância andada (stride), como os clipes de passo da v05 faziam.
const PVP12_PASSO={combat_step_back:'pvp12_step_back',combat_step_left:'pvp12_step_left',
 combat_step_right:'pvp12_step_right',hunter_walk:'pvp12_step_forward',hunter_jog:'pvp12_step_forward',
 hunter_run:'pvp12_step_forward',walk:'pvp12_step_forward',run:'pvp12_step_forward'};
// Giro parado: não há distância andada, então o passo lateral roda no relógio, senão ficaria congelado.
const PVP12_GIRO={combat_turn_left:'pvp12_step_left',combat_turn_right:'pvp12_step_right'};
export function remapPvp12(o,requested,t){
 if(!o.actions[PVP12.guarda])return requested;
 const n=requested.name;
 if(/^(sword|spear|greatsword|unarmed)_/.test(n)){const clipe=clipePvp12(n,requested.counter,requested.variante);return{...requested,name:o.actions[clipe]?clipe:PVP12.ataque};}
 if(n==='combat_block')return{name:PVP12.bloqueio,time:.35,oneShot:true};
 if(PVP12_PASSO[n]&&o.actions[PVP12_PASSO[n]])return{...requested,name:PVP12_PASSO[n],locomotion:true};
 if(PVP12_GIRO[n]&&o.actions[PVP12_GIRO[n]])return{name:PVP12_GIRO[n],time:t};
 return{name:PVP12.guarda,time:t};
}
// Biblioteca PvE v01 (contrato hunter-pve-v01, lote 1: espada). Estado canônico -> clipe pve1_*. O que ainda não foi
// autorado cai na guarda PvE, nunca num clipe v05 ou pvp12.
const PVE1={guarda:'pve1_b_sword_guard',recupera:'pve1_b_sword_recover',bloqueio:'pve1_b_sword_block',leve:'pve1_c_sword_light',pesado:'pve1_c_sword_heavy'};
const PVE1_PASSO={hunter_walk:'pve1_b_sword_step_forward',walk:'pve1_b_sword_step_forward',combat_step_back:'pve1_b_sword_step_back',
 combat_step_left:'pve1_b_sword_step_left',combat_step_right:'pve1_b_sword_step_right',hunter_jog:'pve1_a_sword_run',hunter_run:'pve1_a_sword_run',run:'pve1_a_sword_run'};
const PVE1_GIRO={combat_turn_left:'pve1_b_sword_step_left',combat_turn_right:'pve1_b_sword_step_right'};
export function remapPve1(o,requested,t,a){
 const n=requested.name;
 if(/^(sword|spear|greatsword|unarmed)_/.test(n))return{...requested,name:/heavy|finish/.test(n)?PVE1.pesado:PVE1.leve};
 if(n==='combat_block')return{name:PVE1.bloqueio,time:.30,oneShot:true};
 // A simulação ainda não diz o lado da esquiva: usa a direção do movimento, com a mesma convenção dos passos.
 if(n==='combat_dodge'){const d=(a?.direcaoMovimento??a?.direcao??0)-(a?.direcao??0),rel=Math.atan2(Math.sin(d),Math.cos(d));
  const clipe=rel>0?'pve1_b_sword_dodge_right':'pve1_b_sword_dodge_left',dur=o.actions[clipe]?.getClip().duration??1;
  return{name:clipe,time:requested.time/.65*dur,oneShot:true};}
 if(PVE1_PASSO[n])return{...requested,name:PVE1_PASSO[n],locomotion:true};
 if(PVE1_GIRO[n])return{name:PVE1_GIRO[n],time:t};
 if(/^recover_/.test(n))return{name:PVE1.recupera,time:t};
 return{name:PVE1.guarda,time:t};
}
// Biblioteca PvE v02 (contrato hunter-pve-v02, rig v13: lote 1 de locomoção e lote 2 de combate). Estado canônico ->
// clipe pve2_*. O que não foi autorado no rig v13 (bloqueio, reação, cambaleio, queda, rendição, passos laterais,
// giro parado) cai na guarda PvE v02 — nunca num clipe v05, pvp12 ou pve1, que não existem neste GLB.
const PVE2={guarda:'pve2_b_sword_guard',andar:'pve2_a_sword_walk',trote:'pve2_a_sword_jog',corrida:'pve2_a_sword_run'};
// Andar para trás e para o lado ainda não têm clipe (plano §4, P0): usam o ciclo de caminhada, cujo passo segue a
// distância andada. Assim o pé continua pisando no chão em vez de o corpo deslizar na guarda.
const PVE2_PASSO={hunter_walk:PVE2.andar,walk:PVE2.andar,combat_step_back:PVE2.andar,combat_step_left:PVE2.andar,
 combat_step_right:PVE2.andar,hunter_jog:PVE2.trote,hunter_run:PVE2.corrida,run:PVE2.corrida};
export function remapPve2(o,requested,t,a){
 const n=requested.name,action=a?.hunter?.action??a?.tatica?.action;
 if(/^(sword|spear|greatsword|unarmed)_/.test(n)){
  const clipe=/^pve2_/.test(action?.clip??'')?action.clip:'pve2_c_sword_combo_1',tab=trajetoriaPve(clipe);
  // Carga: o laço toca em tempo real até a liberação começar, então nenhum dos dois clipes é esticado.
  const carga=(action?.clipeInicio??action?.start??0)-(action?.start??0);
  if(requested.time<carga-1e-9)return{name:CARGA_PVE2,time:t};
  return{...requested,name:clipe,time:requested.time-carga,impact:tab.impact,duration:tab.duration};
 }
 // Esquiva do lote 2 = rolamento, 0,90 s e 1,3 m de lado. O lado é o que a simulação já escolheu.
 if(n==='combat_dodge'){const lado=a?.hunter?.dodgeLado??'right',clipe='pve2_b_sword_roll_'+lado;
  return{name:clipe,time:requested.time/.65*(o.actions[clipe]?.getClip().duration??.9),oneShot:true};}
 if(PVE2_PASSO[n])return{...requested,name:PVE2_PASSO[n],locomotion:true};
 return{name:PVE2.guarda,time:t};
}
export function sampleCombatAnimation(o,a,t,dtVisual=0){
 // Biblioteca PvP v12: quando ela está no GLB, o duelo desenha só os três clipes novos e nenhum clipe da v05.
 // O que ainda não foi autorado (reação, cambaleio, queda, locomoção) cai na guarda, não numa pose antiga.
 // Painel de teste do laboratório: um clipe escolhido à mão toca em laço, sem passar pela decisão da simulação.
 // Ele anda no relógio real (dtVisual), e não no da simulação, para rodar também com o mundo pausado.
 if(o.forcado&&!o.actions[o.forcado])o.forcado=null;
 const forcado=o.forcado?{name:o.forcado,time:(o.forcadoT=(o.forcadoT??0)+Math.max(0,Math.min(.1,dtVisual))),oneShot:false}:null;
 const requested=forcado??(o.actions[PVE2.guarda]?remapPve2(o,combatAnimation(a,t),t,a):o.actions[PVE1.guarda]?remapPve1(o,combatAnimation(a,t),t,a):remapPvp12(o,combatAnimation(a,t),t));
 // Reserva: a guarda que existe neste GLB. No rig v13 não há combat_guard.
 const reserva=o.actions['combat_guard']?'combat_guard':PVE2.guarda;
 const spec=o.actions[requested.name]?requested:{name:reserva,time:t,missing:requested.name};
 const action=o.actions[spec.name];if(!action)throw new Error('Hunter sem clipe de guarda: verifique o GLB v04.');
 const trocou=o.clip!==spec.name&&!!o.clip&&t>=(o.lastSample??0);
 if(o.clip!==spec.name){
  if(!o.pve2){const from=[];o.root.traverse(x=>{if(x.isBone)from.push({bone:x,q:x.quaternion.clone(),p:x.position.clone()});});o.transition=trocou?{from,elapsed:0}:null;}
  o.footLocks=null;o.clip=spec.name;
 }
 const clip=action.getClip(),duration=clip.duration;
 let time=spec.time;
 if(spec.locomotion){const last=o.animationLast;if(last&&t>=last.t&&t-last.t<1)o.animationDistance=(o.animationDistance??0)+Math.hypot(a.x-last.x,a.y-last.y);o.animationLast={x:a.x,y:a.y,t};time=(o.animationDistance??0)/(o.clipMeta?.[spec.name]?.stride??.5)*duration;}
 else{o.animationLast={x:a.x,y:a.y,t};if(spec.duration){const clipImpact=o.clipMeta?.[spec.name]?.impact??spec.impact;time=spec.time<=spec.impact?spec.time/Math.max(.01,spec.impact)*clipImpact:clipImpact+(spec.time-spec.impact)/Math.max(.01,spec.duration-spec.impact)*(duration-clipImpact);}}
 action.time=spec.oneShot?Math.max(0,Math.min(duration-.00001,time)):((Math.max(0,time)%duration));
 // Evaluate exported skeletal tracks directly. No mixer can restore a bind pose between frames.
 for(const channel of o.poseTracks[spec.name])channel.binding.setValue(channel.interpolant.evaluate(action.time),0);
 if(o.pve2){transicaoInercial(o,trocou,dtVisual);transicaoPegada(o,spec,trocou,dtVisual);}
 else if(o.transition){o.transition.elapsed+=Math.max(0,Math.min(.1,dtVisual));const f=Math.min(1,o.transition.elapsed/.12);for(const {bone,q,p}of o.transition.from){bone.quaternion.slerpQuaternions(q,bone.quaternion.clone(),f);bone.position.lerpVectors(p,bone.position.clone(),f);}if(f===1)o.transition=null;}o.lastSample=t;
 // Flinch: o osso se chama 'neck'; sem pve2 a busca por 'Neck' (que não acha nada) fica como estava no aprovado.
 const reaction=a.hunter?.reacaoImpacto, age=reaction?t-reaction.t:99;
 if(age>=0&&age<.30&&a.hunter?.action&&t<a.hunter.action.end){const neck=o.root.getObjectByName(o.pve2?'neck':'Neck');if(neck){const Q=neck.quaternion.constructor;neck.quaternion.multiply(new Q().setFromAxisAngle({x:1,y:0,z:0},Math.sin(age/.30*Math.PI)*reaction.intensidade*.18));}}
 if(o.ground)ajustarPes(o,a,t,action.time/duration,spec);
 return{clip:spec.name,time:action.time,...(spec.missing?{missing:spec.missing,fallback:reserva}:{})};
}

// Troca de pegada normal <-> reversa (a corrida do rig v13 carrega a lâmina ao contrário): o socket da mão gira meia
// volta no clipe, e na troca de clipe isso seria um salto de 180° num quadro. Aqui a mão sai da pegada anterior e
// chega na nova em 0,30 s, pelo arco mais curto entre as duas — o resto do corpo segue a transição por inércia.
export const PEGADA=.3;
function transicaoPegada(o,spec,trocou,dt){
 const socket=o.root.getObjectByName('WeaponSocket_R');if(!socket)return;
 const pegada=o.clipMeta?.[spec.name]?.bladeCarry?.grip??'normal';
 if(trocou&&o.pegada&&o.pegada!==pegada&&o.socketAnterior)o.giro={t:0,q:o.socketAnterior};
 o.pegada=pegada;
 if(o.giro){const u=Math.min(1,o.giro.t/PEGADA);
  socket.quaternion.slerpQuaternions(o.giro.q,socket.quaternion.clone(),u*u*(3-2*u));
  o.giro.t+=Math.max(0,Math.min(.1,dt));if(u>=1)o.giro=null;}
 o.socketAnterior=socket.quaternion.clone();
}

// PvE v02 (?pve2=1): transição por inércia no lugar do instantâneo de 0,12 s (ver inercia.js). Só vista.
function transicaoInercial(o,trocou,dt){
 const bones=o.ossos??=(()=>{const b=[];o.root.traverse(x=>{if(x.isBone)b.push(x);});return b;})();
 const q=b=>[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w],p=b=>[b.position.x,b.position.y,b.position.z];
 if(trocou&&o.poseAnterior)o.inercia={t:0,ossos:bones.map((b,i)=>({r:iniciarRotacao(o.posePenultima?.[i].q,o.poseAnterior[i].q,o.dtAnterior,q(b)),
  p:iniciarPosicao(o.posePenultima?.[i].p,o.poseAnterior[i].p,o.dtAnterior,p(b))}))};
 if(o.inercia){const t=o.inercia.t;
  if(t>=DURACAO)o.inercia=null;
  else{bones.forEach((b,i)=>{const s=o.inercia.ossos[i];b.quaternion.fromArray(aplicarRotacao(s.r,t,q(b)));b.position.fromArray(aplicarPosicao(s.p,t,p(b)));});o.inercia.t+=Math.max(0,Math.min(.1,dt));}}
 o.posePenultima=o.poseAnterior;o.poseAnterior=bones.map(b=>({q:q(b),p:p(b)}));o.dtAnterior=dt;
}

// View-only two-bone IK. Stance anchors are released during swings and clip changes.
function ajustarPes(o,a,t,phase,spec){
 const root=o.root,V=root.position.constructor,Q=root.quaternion.constructor;
 // Rolamentos de fora: no ar as pernas são FK autoradas, e o IK iria puxar o pé para o chão no meio da cambalhota.
 const active=spec.locomotion||spec.name==='combat_guard'||spec.name==='combat_block'||spec.name==='pvp12_guard'||spec.name==='pvp12_sword_block'||/^pve1_b_sword_(guard|block|recover)$/.test(spec.name)||spec.name==='pve2_b_sword_guard';if(!active){o.footLocks=null;return;}
 o.footLocks??={};root.updateMatrixWorld(true);
 for(const side of ['Left','Right']){
  const upper=root.getObjectByName(side+'UpLeg'),knee=root.getObjectByName(side+'Leg'),foot=root.getObjectByName(side+'Foot');if(!upper||!knee||!foot)continue;
  const p=foot.getWorldPosition(new V()),start=upper.getWorldPosition(new V()),middle=knee.getWorldPosition(new V()),meta=o.clipMeta?.[spec.name],
   contact=(o.pve2?peNoChao(meta?.footContacts?.[side==='Left'?'left':'right'],phase*(meta?.duration??0),meta?.duration??0):null)??(!spec.locomotion||((phase+(side==='Left'?0:.5))%1)<(meta?.stance??.62));
  const old=o.footLocks[side];let target=p.clone();
  if(contact){if(!old||old.clip!==spec.name||t<old.t||p.distanceTo(old.p)>.65)o.footLocks[side]={p:p.clone(),clip:spec.name,t};else target.copy(old.p);}
  else delete o.footLocks[side];
  const ground=o.ground(target.x,target.z);if(!Number.isFinite(ground))continue;
  target.y=Math.max(target.y,ground+.12*o.bodyScale);if(contact)target.y=ground+.12*o.bodyScale;
  const l1=start.distanceTo(middle),l2=middle.distanceTo(p),axis=target.clone().sub(start),d=axis.length();if(d>l1+l2-.002||d<.03)continue;
  axis.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),bend=middle.clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const elbow=start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along))),footQ=foot.getWorldQuaternion(new Q());
  const rotate=(bone,child,to)=>{const from=bone.getWorldPosition(new V()),v=child.getWorldPosition(new V()).sub(from).normalize(),want=to.clone().sub(from).normalize(),q=new Q().setFromUnitVectors(v,want).multiply(bone.getWorldQuaternion(new Q()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new Q()).invert().multiply(q));root.updateMatrixWorld(true);};
  rotate(upper,knee,elbow);rotate(knee,foot,target);foot.quaternion.copy(foot.parent.getWorldQuaternion(new Q()).invert().multiply(footQ));
 }
 root.updateMatrixWorld(true);
}
