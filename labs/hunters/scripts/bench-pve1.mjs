import {readFile} from 'node:fs/promises';
import {carregarHunterLab} from '../src/node-hunters.mjs';
import {criarMundoHunters,passoHunters} from '../src/mundo-hunters.js';
import * as arma from '../src/trajetoria-arma.js';
const LAB=await carregarHunterLab(),lj=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const CEN=(await lj('../config/cenarios.json')).find(c=>c.id==='jogador-espada'),NAV=await lj('../../hunters-codex/assets/terrain-nav.json'),GEO=await lj('../../hunters-codex/assets/terrain-geometry.json');
const liga=process.argv[2]==='1';if(arma.usarPve1)arma.usarPve1(liga);
const r=[];
for(let rep=0;rep<7;rep++){const cen=structuredClone(CEN);cen.terreno.dados=NAV;cen.geometriaPrecisa=GEO;
 const m=criarMundoHunters({...LAB.cfg,cenarios:{...LAB.cfg.cenarios,[cen.id]:cen}},cen,17,{fichaHunter:LAB.fichaHunter,equipamentos:LAB.equipamentos});
 const t=[];for(let i=0;i<800;i++){const t0=performance.now();passoHunters(m);t.push(performance.now()-t0);}
 t.sort((a,b)=>a-b);r.push([t[Math.floor(t.length/2)],t.reduce((s,x)=>s+x,0)/t.length]);}
r.sort((a,b)=>a[1]-b[1]);console.log((liga?'PvE ligado   ':process.argv[2]==='0'?'PvE desligado':'antes (HEAD)  '),'passo p50',r[3][0].toFixed(3),'ms | média',r[3][1].toFixed(3),'ms (mediana de 7 corridas de 800 passos)');
