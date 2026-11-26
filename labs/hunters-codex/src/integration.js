// Adapter only: the existing ecological planner overestimates acceleration uncertainty for a stationary
// upright target. Keep its chase decision and use its existing attack lifecycle at verified body contact.
import {capsula,contatoGolpe,perfilGolpe,iniciarAtaque} from '../../ia-criaturas/src/eco/combate.js';
export function stationaryCreatureContact(sim){const m=sim.world;for(const a of m.vivos){if(a.hunter||a.golpe||a.saude.atordoadoAte>m.t||a.saude.caidoAte>m.t)continue;
 const target=m.porId.get(a.intencao?.alvo?.id);if(!target?.hunter||!target.vivo||target.velocidade>.5||a.estado!=='perseguindo')continue;
 if(!a.contatos.some(c=>c.id===target.id&&c.via==='visao'))continue;
 if(!sim.geometry.line([a.x,a.z+1,a.y],[target.x,target.z+1,target.y]))continue;
 const attack=a.especie.combate.ataques.find(x=>!x.exigeSurpresa&&(a.recargas[x.nome]??0)<=0&&contatoGolpe(a,perfilGolpe(a,x),capsula(target),x.nome).d<=.1);
 if(attack)iniciarAtaque(a,target,attack,m);
}}
