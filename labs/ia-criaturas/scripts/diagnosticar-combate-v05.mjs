#!/usr/bin/env node
// Reproduz duelo do laboratorio sem render; diagnostico de eventos reais e politica IA.
import {carregarConfigEcoNode} from '../src/node/eco-node.js';
import {criarMundoEco,passoEco} from '../src/eco/mundo.js';
import {abrirConflito} from '../src/eco/combate.js';
const cfg=await carregarConfigEcoNode();
const species={...cfg.especies.varrisco,
  combate:{...cfg.especies.varrisco.combate,iaAvancada:true,
    _diagnostico:'só laboratório'}};
const base={
 id:'v05-duelo-diagnostico',nome:'duelo',dt:.1,duracaoSeg:60,
 relogio:{segundosPorDia:600,diaInicial:20,horaInicial:17.0},
 clima:{chanceChuvaChuvosa:0,chanceChuvaSeca:0,chanceIncendio:0},
 terreno:{tipo:'procedural',largura:140,profundidade:100,res:1,amplitude:3.2,capim:45,
  lago:{x:118,y:78,raio:7,fundo:1.5},
  rochas:[{x:66,y:46,raio:1.6,altura:1.5},{x:72,y:52,raio:1.4,altura:1.3},{x:68,y:57,raio:1.2,altura:1.2},{x:75,y:45,raio:1.5,altura:1.4},{x:62,y:53,raio:1.3,altura:1.2},{x:70,y:41,raio:1.2,altura:1.1}],
  arbustos:[{x:30,y:78,raio:5,ocultacao:70,alimento:20},{x:98,y:22,raio:4,ocultacao:65,alimento:20}]},
 populacoes:[{especie:'varrisco',individuos:[
  {id:'v',x:51,y:50,fome:80,energia:100,sexo:'M',direcaoGraus:0,
    temperamento:{agressividade:.96,coragem:.96,medo:.03}},
  {id:'rival',x:53.2,y:50,fome:78,energia:100,sexo:'M',direcaoGraus:180,
    temperamento:{agressividade:.94,coragem:.95,medo:.04}}]}]
};
const all={...cfg,especies:{...cfg.especies,varrisco:species},
 cenarios:{...cfg.cenarios,[base.id]:base}};
const m=criarMundoEco(all,base,7);
const v=m.porId.get('v'),r=m.porId.get('rival');
const cf=abrirConflito(m,v,r,'territorio',null);
cf.fase='combate';cf.desde=m.t;cf.fasesVistas.push('combate');
for(let j=0;j<600;j++){
 passoEco(m);
 if(j%50===0)console.log('STATE '+JSON.stringify({t:m.t,conflict:cf.fase,result:cf.resultado,v:{state:v.estado,reason:v.motivo,position:[+v.x.toFixed(2),+v.y.toFixed(2)],direction:+v.direcao.toFixed(2),hp:+v.saude.hp.toFixed(2),tatica:v.tatica?.phase,learn:v.taticaAvancada?.padroes,contact:v.contatos?.map(c=>({id:c.id,via:c.via,signal:c.signal,dist:c.distancia}))},r:{state:r.estado,tatica:r.tatica?.phase,position:[+r.x.toFixed(2),+r.y.toFixed(2)]}}));
}
const count={};for(const e of m.eventos)count[e.tipo]=(count[e.tipo]||0)+1;
console.log('RESULT '+JSON.stringify({counts:count,decisions:m.decisoes?.length,
 observations:[v.taticaAvancada,r.taticaAvancada].map(a=>a?.padroes),mismatches:m.metricas.falhas?.length,
 events:m.eventos.filter(e=>e.tipo.startsWith('tatico')||e.tipo.startsWith('conflito')||e.tipo==='ataque_inicio').slice(-40)}));
