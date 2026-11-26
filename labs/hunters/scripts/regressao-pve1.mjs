#!/usr/bin/env node
// Impressão digital de regressão do interruptor PvE: com ele DESLIGADO, os duelos PvP v12 e os cenários atuais
// têm de dar exatamente o mesmo resultado que antes da IA PvE. Roda igual numa árvore sem `usarPve1` (linha de base).
//   node scripts/regressao-pve1.mjs [--saida arquivo.json]
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {carregarHunterLab} from '../src/node-hunters.mjs';
import {criarMundoHunters,rodarCombate} from '../src/mundo-hunters.js';
import {hashMundo} from '../../ia-criaturas/src/eco/mundo.js';
import * as arma from '../src/trajetoria-arma.js';
const LAB=await carregarHunterLab();
const ARENA={terreno:{tipo:'procedural',largura:120,profundidade:100,res:1,amplitude:0.4,capim:40},dt:0.05};
const cenarioDuelo=(id,hunters,extra={})=>({id,nome:id,dt:.1,duracaoSeg:120,relogio:{segundosPorDia:600,diaInicial:12,horaInicial:10},clima:{chanceIncendio:0},terreno:{tipo:'procedural',largura:120,profundidade:100,res:1,amplitude:.2,capim:40,...(extra.terreno??{})},modoCombate:'treino',hunters,populacoes:[],...extra,terreno:{tipo:'procedural',largura:120,profundidade:100,res:1,amplitude:.2,capim:40,...(extra.terreno??{})}});
const dois=(dist)=>[{id:'hunter-A',nome:'A',equipe:'azul',x:60-dist/2,y:50,direcaoGraus:0,equipamento:{arma:'espada'}},{id:'hunter-B',nome:'B',equipe:'verde',x:60+dist/2,y:50,direcaoGraus:180,equipamento:{arma:'espada'}}];
function mundo(cen,semente){const cfg={...LAB.cfg,cenarios:{...LAB.cfg.cenarios,[cen.id]:cen}};return criarMundoHunters(cfg,cen,semente,{fichaHunter:LAB.fichaHunter,equipamentos:LAB.equipamentos});}
export async function prepararCenario(cen){cen=structuredClone(cen);const lj=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));if(cen.terreno?.recorteCodex){cen.terreno.dados=await lj('../../hunters-codex/assets/terrain-nav.json');cen.geometriaPrecisa=await lj('../../hunters-codex/assets/terrain-geometry.json');}else if(cen.terreno?.tipo==='derivado')cen.terreno.dados=await lj('../../ia-criaturas/'+cen.terreno.arquivo);return cen;}
const resumo=(m,r)=>({t:r.t,resultado:r.resultado,violacoes:r.violacoes.length,eventos:m.eventos.length,
 hash:hashMundo(m),estados:m.hunters.map(h=>[h.id,+h.saude.hp.toFixed(4),+h.x.toFixed(4),+h.y.toFixed(4),h.hunter.golpesDados,h.hunter.golpesRecebidos,h.hunter.bloqueios]),
 tipos:Object.fromEntries(Object.entries(m.eventos.reduce((o,e)=>(o[e.tipo]=(o[e.tipo]??0)+1,o),{})).sort())});
const CENARIOS=JSON.parse(await readFile(new URL('../config/cenarios.json',import.meta.url),'utf8')),saida={};
const guardas=[['v12-guarda-ligada',true],['sem-guarda',false]];
for(const [nome,ligada] of guardas){arma.usarGuardaFechada(ligada);
 for(const s of [7,17,23]){const m=mundo(cenarioDuelo('arena-aparo',dois(3),ARENA),s);saida[`${nome}/duelo-semente-${s}`]=resumo(m,rodarCombate(m,120));}}
arma.usarGuardaFechada(false);
for(const id of ['arena-duelo','jogador-espada','jogador-lanca','jogador-montante','arena-aparo']){
 const cen=CENARIOS.find(c=>c.id===id);
 if(!cen){saida[id]='ausente';continue;}
 const m=mundo(await prepararCenario(cen),17);saida[`cenario/${id}`]=resumo(m,rodarCombate(m,60));}
const texto=JSON.stringify(saida,null,1),i=process.argv.indexOf('--saida');
console.log('sha256',createHash('sha256').update(texto).digest('hex'));
if(i>0)await writeFile(process.argv[i+1],texto);
