import {ferir,fatorMobilidade} from '../../ia-criaturas/src/eco/saude.js';
import {capsula,pontoNaCapsula} from '../../ia-criaturas/src/eco/combate.js';
import {WEAPONS,armFactor} from './equipment.js';
export const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function beginAttack(sim,a,target,heavy=false,region='tronco'){
 const h=a.hunter,w=WEAPONS[h.weapon],cost=w.energy*(heavy?1.65:1),now=sim.world.t;
 if(!a.vivo||h.outcome||h.attack||h.recoveryUntil>now||h.blockUntil>now||h.dodgeUntil>now||a.saude.atordoadoAte>now||a.saude.caidoAte>now||a.energia<cost||!target?.vivo||target.hunter?.outcome)return false;
 // Exact target ID is accepted from a player; autonomous callers require perception.
 const id=`H:${++sim.attackSerial}`;
 h.attack={id,target:target.id,heavy,region,weapon:h.weapon,impact:sim.world.tick+Math.ceil(w.windup*(heavy?1.7:1)/sim.dt),reach:w.reach,startX:a.x,startY:a.y};
 if(sim.world.opcoes.tatica){h.action={id,name:h.weapon+'_'+(heavy?'heavy':'light'),start:now,impact:h.attack.impact*sim.dt,end:now+w.windup*(heavy?1.7:1)+w.recovery*(heavy?1.4:1),reach:w.reach,heading:a.direcao};(a.tatica??={}).lastAttack=now;}
 h.recoveryUntil=now+w.windup*(heavy?1.7:1)+w.recovery*(heavy?1.4:1);a.energia-=cost;sim.event('attack_start',a.id,{target:target.id,attack:id,heavy,region,reach:w.reach});return true;
}
export function defend(sim,a,kind){const h=a.hunter,t=sim.world.t;if(!h||!a.vivo||h.outcome||a.saude.caidoAte>t||a.saude.atordoadoAte>t||h.attack||h.recoveryUntil>t)return false;if(kind==='block'&&a.energia>=4){h.blockUntil=t+.7;a.energia-=4;sim.event('block_start',a.id);return true;}if(kind==='dodge'&&a.energia>=16&&fatorMobilidade(a)>.45){h.dodgeUntil=t+.35;h.recoveryUntil=t+.8;a.energia-=16;const p={x:a.x-Math.sin(a.direcao)*.95,y:a.y+Math.cos(a.direcao)*.95},q=sim.geometry.sweep(a,p,.32,1.8);a.x=q.x;a.y=q.y;sim.event('dodge',a.id,{blocked:q.blocked});return true;}return false;}
export function blockedDamage(sim,attacker,victim,damage){if(!victim.hunter)return damage;const h=victim.hunter,t=sim.world.t;if(h.dodgeUntil>t){sim.event('dodge_contact',victim.id,{attacker:attacker.id});return 0;}const facing=Math.abs(angle(Math.atan2(attacker.y-victim.y,attacker.x-victim.x)-victim.direcao));if(h.blockUntil>t&&facing<1.15&&victim.energia>2&&armFactor(victim)>.4){const cost=damage*(h.shield?.55:.9);victim.energia=Math.max(0,victim.energia-cost);const factor=victim.energia>0?(h.shield?.12:.5):.8;sim.event('block_contact',victim.id,{attacker:attacker.id,absorbed:damage*(1-factor)});return damage*factor;}return damage;}
export function resolveAttacks(sim){const m=sim.world;for(const a of m.animais){const g=a.hunter?.attack;if(!g||m.tick<g.impact)continue;a.hunter.attack=null;if(sim.ledger.has(g.id))continue;sim.ledger.add(g.id);const b=m.porId.get(g.target),w=WEAPONS[g.weapon];let reason=null;if(!a.vivo||a.hunter.outcome||a.saude.atordoadoAte>m.t||a.saude.caidoAte>m.t)reason='interrompido';else if(!b?.vivo||b.hunter?.outcome)reason='alvo_inativo';else{const dx=b.x-a.x,dy=b.y-a.y,dir=Math.atan2(dy,dx),contact=pontoNaCapsula(a.x+Math.cos(a.direcao)*g.reach,a.y+Math.sin(a.direcao)*g.reach,capsula(b));if(Math.abs(angle(dir-a.direcao))>.6)reason='direcao';else if(distance(a,b)>g.reach+b.especie.corpo.comprimentoM*.5||contact.d>.18)reason='alcance';else if(!sim.geometry.line([a.x,a.z+1.1,a.y],[b.x,b.z+(g.region==='pernas'?.4:1.05),b.y]))reason='obstaculo';else if(Math.abs(a.z-b.z)>1.6)reason='altura';}
 if(reason){if(a.tatica)a.tatica.lastHit=false;sim.event('miss',a.id,{attack:g.id,target:g.target,reason});continue;}
 const damage=blockedDamage(sim,a,b,w.damage*(g.heavy?1.6:1)*a.atributos.forca*armFactor(a)*(1-a.saude.dor*.25)*(a.energia<15?.7:1));
 if(damage<=0)continue;
 const region=g.region;const fer=ferir(b,{dano:damage,regiao:region,origem:a.id,tipo:'golpe_'+w.type,t:m.t,idEvento:g.id,penetracao:w.penetration});
 if(b.hunter){fer.humanRegion={cabeca:'cabeça',pescoco:'pescoço',tronco:'tórax',flanco:'abdômen',bracos:'braços',pernas:'pernas'}[region];if(region==='bracos'&&fer.gravidade>.22)fer.fratura=true;}
 b.mente.atingidoPor={id:a.id,t:m.t};if(g.heavy){b.saude.desequilibradoAte=m.t+.6;if(fer.gravidade>.28&&sim.geometry.clear(b.x,b.y,b.especie.corpo.raio,b.especie.corpo.alturaM))b.saude.caidoAte=m.t+1.7;}
 sim.event('hit',a.id,{attack:g.id,target:b.id,region,damage:fer.efetivo,distance:distance(a,b),reach:g.reach,fracture:fer.fratura});
 if(a.tatica)a.tatica.lastHit=true;
 }}
