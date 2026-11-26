import {WEAPONS} from './equipment.js';
import {beginAttack,defend,distance} from './combat.js';
import {planejarTatica} from '../../ia-criaturas/src/eco/tatica.js';
const idle=(reason='aguardando')=>({estado:'descansando',codigo:'hunter_idle',motivo:reason,destino:null,ritmo:'parado'});
export function decideHunter(sim,a){const h=a.hunter,m=sim.world;if(h.outcome)return idle(h.outcome);if(!h.ai&&!h.manual)return idle('IA desativada');
 const contacts=a.contatos.filter(c=>sim.enemy(a.id,c.id)&&c.via==='visao'&&sim.geometry.line([a.x,a.z+1.5,a.y],[c.x,(sim.geometry.height(c.x,c.y)??a.z)+1,c.y]));
 const target=contacts.sort((b,c)=>distance(a,b)-distance(a,c)||b.id.localeCompare(c.id))[0];
 const injury=a.saude.hp/a.saude.hpMax,critical=injury<.25||a.energia<7;
 if(critical&&target){h.retreatSince??=m.t;if(injury<.19||m.t-h.retreatSince>3&&a.energia<12){sim.finish(a,'rendicao');return idle('rendição por sobrevivência');}}
 if(target&&(critical||injury<(.28+(1-h.courage)*.2)||a.energia<12+(1-h.aggression)*10||(m.opcoes.tatica&&h.retreatSince!=null&&a.energia<35))){
  h.retreatFrom={x:target.x,y:target.y};
  const dx=a.x-target.x,dy=a.y-target.y,n=Math.hypot(dx,dy)||1;h.retreatSince??=m.t;
  // Cover is selected from visible, local terrain, not enemy hidden state.
  const cover=sim.geometry.solid.flat().filter(p=>Math.hypot(p[0]-a.x,p[2]-a.y)<12&&((p[0]-a.x)*dx+(p[2]-a.y)*dy)>0).sort((p,q)=>Math.hypot(p[0]-a.x,p[2]-a.y)-Math.hypot(q[0]-a.x,q[2]-a.y))[0];
  const dest=cover?sim.geometry.spawn(cover[0]+dx/n,cover[2]+dy/n):{x:a.x+dx/n*9,y:a.y+dy/n*9};
  return{estado:'recuando',codigo:'survival',motivo:'risco / ferimentos / fadiga; procurando cobertura',destino:dest,ritmo:a.energia>15?'corrida':'andar',olharPara:target};
 }
 if(!target&&m.opcoes.tatica&&h.retreatSince!=null&&h.retreatFrom){
  const cue=a.contatos.filter(c=>sim.enemy(a.id,c.id)).sort((a,b)=>a.distancia-b.distancia)[0];if(cue)h.retreatFrom={x:cue.x,y:cue.y};
  if(m.t-h.retreatSince>8&&!cue&&distance(a,h.retreatFrom)>6){sim.finish(a,'retirada');return idle('retirada concluída após romper contato sensorial');}
  if(m.t-h.retreatSince>12&&a.energia<8&&cue&&cue.distancia<6){sim.finish(a,'rendicao');return idle('exaustão e ameaça ainda próxima; retirada sem sucesso');}
  const p=h.retreatFrom,dx=a.x-p.x,dy=a.y-p.y,n=Math.hypot(dx,dy)||1;return{estado:'recuando',codigo:'retirada_memoria',motivo:'romper contato; manter retirada em vez de perseguir a ameaça lembrada',destino:{x:a.x+dx/n*4,y:a.y+dy/n*4},ritmo:'andar'};
 }
 if(h.manual){const d=h.input??{x:0,y:0};if(h.order)return{estado:'deslocando',codigo:'ordem',motivo:'ordem do operador',destino:h.order,ritmo:'andar'};return Math.hypot(d.x,d.y)>.1?{estado:'deslocando',codigo:'manual',motivo:'WASD',destino:{x:a.x+d.x*3,y:a.y+d.y*3},ritmo:d.run?'corrida':'andar'}:idle('controle manual');}
 if(target&&m.opcoes.tatica){
  h.retreatSince=null;const w=WEAPONS[h.weapon];
  const plan=planejarTatica(a,target,m,{reach:w.reach,windup:w.windup,energy:w.energy},{aggression:h.aggression,courage:h.courage});
  if(target.signal!=='preparo')h.sawWindup=null;
  else if(!h.sawWindup)h.sawWindup={id:target.id,since:m.t};
  if(target.signal==='preparo'&&m.t-h.sawWindup.since>.22+(1-h.courage)*.12&&!h.attack&&h.recoveryUntil<=m.t&&m.t-(h.lastDefense??-9)>1.0){
   const exposure=Math.abs(Math.atan2(Math.sin((target.direcao??0)-Math.atan2(a.y-target.y,a.x-target.x)),Math.cos((target.direcao??0)-Math.atan2(a.y-target.y,a.x-target.x))));
   if(distance(a,target)<(a.tatica.bands.threat)&&exposure<.9){defend(sim,a,h.shield||h.courage>.5?'block':'dodge');h.lastDefense=m.t;}
  }
  if(plan.attack){const b=m.porId.get(target.id),heavy=a.energia>45&&['recuperacao','caido','desequilibrado'].includes(target.signal);
   const region=target.signal==='fuga'?'pernas':target.signal==='preparo'?'bracos':'tronco';
   if(beginAttack(sim,a,b,heavy,region)){plan.intent.estado='preparando_ataque';plan.intent.destino=null;plan.intent.ritmo='parado';}
  }
  return plan.intent;
 }
 if(target){h.retreatSince=null;const d=distance(a,target),w=WEAPONS[h.weapon];
  if(target.comportamento==='atacando'&&d<3&&!h.attack&&h.recoveryUntil<=m.t){if(a.rngMente.chance(.05+(1-h.aggression)*.18))defend(sim,a,h.shield||h.courage>.65?'block':'dodge');}
  if(d<=w.reach+.18&&Math.abs(Math.atan2(Math.sin(Math.atan2(target.y-a.y,target.x-a.x)-a.direcao),Math.cos(Math.atan2(target.y-a.y,target.x-a.x)-a.direcao)))<.55){
   const b=m.porId.get(target.id);const heavy=a.energia>45&&a.rngMente.chance(h.aggression*.32);const regions=target.especie==='hunter'?['tronco','pernas','bracos','flanco','cabeca','pescoco']:['tronco','pernas','flanco','cabeca','pescoco'];beginAttack(sim,a,b,heavy,a.rngMente.escolher(regions));
   return{estado:h.attack?'atacando':'combatendo',codigo:'contact',motivo:'contato visual e alcance de arma',destino:null,ritmo:'parado',olharPara:target};
  }
  // Keep spear spacing; rotate toward observations even when stopping.
  const u=(w.reach-.05)/Math.max(.1,d);const dest={x:target.x+(a.x-target.x)*u,y:target.y+(a.y-target.y)*u};
  return{estado:'perseguindo',codigo:'position',motivo:'aproximação / vantagem de alcance',destino:dest,ritmo:d>7?'trote':'andar',olharPara:target};
 }
 // Investigate last observed positions and audible clues; never look up a live hidden position.
 const memory=[...a.memoria.criaturas.values()].filter(c=>sim.enemy(a.id,c.id)&&m.t-c.t<8).sort((b,c)=>c.t-b.t)[0];
 const sound=a.memoria.sons.filter(s=>sim.enemy(a.id,s.id)).at(-1);
 const clue=memory??sound;if(clue&&distance(a,clue)>1.4)return{estado:'investigando',codigo:'memory',motivo:'som / última pista percebida',destino:{x:clue.x,y:clue.y},ritmo:'andar'};
 if(a.energia<65)return idle('descanso e recuperação');
 if(h.order&&distance(a,h.order)>1)return{estado:'deslocando',codigo:'ordem',motivo:'ordem do operador',destino:h.order,ritmo:'andar'};
 return idle('sem ameaça percebida');
}
