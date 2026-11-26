#!/usr/bin/env node
// Medição da IA PvE v01 no cenário jogador-espada (Hunter de espada contra o Varrisco real), sem renderizador.
//   node scripts/medir-pve1.mjs [--sementes 7,17,23] [--segundos 120] [--saida arquivo.json]
// Mede: taxa de reprodução de cada golpe (o que o renderizador faria com `combatAnimation`), contato dentro da janela
// ativa do clipe, esquivas (lado, duração, deslocamento) e desfecho. Taxa = tempo do clipe / tempo simulado.
import {readFile,writeFile} from 'node:fs/promises';
import {carregarHunterLab} from '../src/node-hunters.mjs';
import {criarMundoHunters,passoHunters} from '../src/mundo-hunters.js';
import {combatAnimation} from '../src/animacao-jogador.js';
import {usarPve1,trajetoriaPve1,clipePve1} from '../src/trajetoria-arma.js';
import {verificarInvariantes} from '../../ia-criaturas/src/eco/invariantes.js';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const sementes=String(arg('sementes','7,17,23')).split(',').map(Number),segundos=Number(arg('segundos',120)),ligado=arg('pve1','1')!=='0';
const LAB=await carregarHunterLab(),lj=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const CEN=(await lj('../config/cenarios.json')).find(c=>c.id==='jogador-espada');
const NAV=await lj('../../hunters-codex/assets/terrain-nav.json'),GEO=await lj('../../hunters-codex/assets/terrain-geometry.json');
usarPve1(ligado);
const saida={pve1:ligado,sementes:{}};
for(const semente of sementes){
 const cen=structuredClone(CEN);cen.terreno.dados=NAV;cen.geometriaPrecisa=GEO;
 const m=criarMundoHunters({...LAB.cfg,cenarios:{...LAB.cfg.cenarios,[cen.id]:cen}},cen,semente,{fichaHunter:LAB.fichaHunter,equipamentos:LAB.equipamentos});
 const a=m.hunters[0],golpes=new Map(),taxas={},esquivas=[],bloqueios=[];let violacoes=[],ultimaEsq=null,minDist=Infinity,tProx=5;
 while(m.t<segundos-1e-9){
  passoHunters(m);
  if(m.t>=tProx){violacoes.push(...verificarInvariantes(m));tProx+=5;}
  const h=a.hunter,ac=h.action;
  if(ac&&m.t<=ac.end&&ac.name&&!golpes.has(ac.start))golpes.set(ac.start,{nome:ac.name,clip:clipePve1(ac.name),start:ac.start,impact:ac.impact,end:ac.end,aparo:!!ac.aparo,contato:null});
  const o=combatAnimation(a,m.t);
  if(ligado&&o.impact!=null&&/^sword_/.test(o.name)){const tab=trajetoriaPve1(clipePve1(o.name)),r=o.time<=o.impact?tab.impact/Math.max(.01,o.impact):(tab.duration-tab.impact)/Math.max(.01,o.duration-o.impact);
   const k=clipePve1(o.name)+(o.time<=o.impact?':preparo':':recuperacao');const x=taxas[k]??={min:Infinity,max:0,n:0};x.min=Math.min(x.min,r);x.max=Math.max(x.max,r);x.n++;}
  if(h.esquivaPve&&(!ultimaEsq||ultimaEsq.inicio!==h.esquivaPve.inicio)){ultimaEsq={inicio:h.esquivaPve.inicio,lado:h.esquivaPve.lado,x0:a.x,y0:a.y,dir:h.esquivaPve.dir,dur:h.esquivaPve.fim-h.esquivaPve.inicio,clip:h.esquivaPve.clip};esquivas.push(ultimaEsq);}
  if(ultimaEsq&&!h.esquivaPve&&ultimaEsq.d==null){ultimaEsq.d=+Math.hypot(a.x-ultimaEsq.x0,a.y-ultimaEsq.y0).toFixed(3);ultimaEsq.fim=+m.t.toFixed(2);}
  const c=h.ultimoContato;if(c&&c.inicio!=null){const g=golpes.get(c.inicio);if(g&&g.contato==null&&c.time!=null)g.contato=c;}
  if(m.resultado)break;
 }
 const lista=[...golpes.values()].map(g=>{const tab=trajetoriaPve1(g.clip),c=g.contato,rel=c?.time!=null?c.time-g.start:null;
  return{nome:g.nome,clip:g.clip,start:+g.start.toFixed(3),preparo:+(g.impact-g.start).toFixed(4),clipePreparo:tab.impact,duracao:+(g.end-g.start).toFixed(4),clipeDuracao:tab.duration,aparo:g.aparo,
   contato:c?{acertou:!!c.hit,t:+rel.toFixed(3),naJanelaAtiva:rel>=tab.phases.activeStart-1e-9&&rel<=tab.phases.activeEnd+1e-9,distancia:+(c.distance??0).toFixed(3)}:null};});
 const ev=t=>m.eventos.filter(e=>e.tipo===t&&e.id===a.id).length,evr=t=>m.eventos.filter(e=>e.tipo===t&&e.atacante===a.id).length;
 saida.sementes[semente]={t:+m.t.toFixed(2),resultado:m.resultado,violacoes:violacoes.length,golpes:lista,taxas,esquivas:esquivas.map(e=>({...e,x0:undefined,y0:undefined})),
  acertos:evr('ferimento'),erros:ev('golpe_errou'),aparos:m.eventos.filter(e=>e.motivo==='aparo_lamina').length,esquivasTaticas:ev('hunter_esquiva_tatica'),guardas:ev('hunter_guarda_lamina'),
  hpHunter:+a.saude.hp.toFixed(1),feridasHunter:m.eventos.filter(e=>e.tipo==='ferimento'&&e.id===a.id).length,
  motivosErro:Object.entries(m.eventos.filter(e=>e.tipo==='golpe_errou'&&e.id===a.id).reduce((o,e)=>(o[e.motivo]=(o[e.motivo]??0)+1,o),{}))};
}
const texto=JSON.stringify(saida,null,1);if(arg('saida'))await writeFile(arg('saida'),texto);
// Resumo legível: o arquivo --saida guarda o detalhe golpe a golpe.
for(const [sem,r] of Object.entries(saida.sementes)){const g=r.golpes,com=g.filter(x=>x.contato);
 console.log('semente',sem,'t',r.t,'desfecho',r.resultado?.motivo??'em andamento','| golpes',g.length,'acertos',r.acertos,'erros',r.erros,JSON.stringify(r.motivosErro),'aparos',r.aparos,'| esquivas',r.esquivas.length,'guardas',r.guardas,'| hp Hunter',r.hpHunter,'feridas',r.feridasHunter,'| violações',r.violacoes);
 console.log('  taxas',JSON.stringify(Object.fromEntries(Object.entries(r.taxas).map(([k,v])=>[k,[+v.min.toFixed(3),+v.max.toFixed(3)]]))));
 console.log('  contato na janela ativa',com.filter(x=>x.contato.naJanelaAtiva).length+'/'+com.length,'| esquivas',JSON.stringify(r.esquivas.map(e=>[e.lado,e.dur,e.d])));}
