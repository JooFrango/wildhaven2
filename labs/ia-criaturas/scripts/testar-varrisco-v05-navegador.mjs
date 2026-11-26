#!/usr/bin/env node
// Browser/Three.js e GLB real: 41 clipes e IA v05 em combate pelo núcleo eco.
// Evidência renderizada (PNG); falha quando o viewer ou os clipes não carregam.
// Requer Playwright instalado pelo workflow de CI.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';

const port=Number(process.env.PORTA_VARISCO_V05??5193);
const server=spawn(process.execPath,['scripts/servidor.mjs','--porta',String(port)],{
 cwd:new URL('../',import.meta.url),stdio:['ignore','pipe','pipe']
});
const logs=[];
server.stdout.on('data',b=>logs.push(String(b)));
server.stderr.on('data',b=>logs.push(String(b)));
let browser;
try {
 let started=false;
 for(let i=0;i<200;i++){
   if(logs.join('').includes('http://localhost:'+port+'/')){started=true;break;}
   if(server.exitCode!==null)throw Error('Servidor caiu: '+logs.join(''));
   await sleep(100);
 }
 assert.ok(started,'Servidor lab Varrisco não iniciou: '+logs.join('').slice(-800));
 browser=await chromium.launch({headless:true,
   args:['--disable-dev-shm-usage','--enable-webgl','--use-gl=angle',
     '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
 await page.goto('http://127.0.0.1:'+port+'/laboratorio-varrisco.html?modelo=v04',{
   waitUntil:'domcontentloaded',timeout:120000
 });
 await page.waitForFunction(()=>window.lab?.mundo?.porId?.has('v')&&
   window.lab.mundo.config.especies.varrisco.combate.iaAvancada===true,{
   timeout:120000
 });
 const loaded=await page.evaluate(()=>({
   v04:window.lab.mundo.config.especies.varrisco.combate.iaAvancada,
   species:window.lab.mundo.porId.get('v').especie.id,
   tests:window.lab.testes
 }));
 assert.ok(loaded.v04&&loaded.species==='varrisco');
 assert.ok(loaded.tests.includes('ia-v05-duelo'));
 const clips=await page.evaluate(async()=>window.lab.rodar('clipes',{fps:30,maxSeg:120}));
 assert.equal(clips.total,41,'GLB real deve expor 41 clipes');
 assert.equal(clips.todosAnimam,true,'Todos os clipes devem animar ossos reais');
 const named=new Set(clips.clipes.map(c=>c.clipe));
 for(const name of ['feint','dodge_left','dodge_right','grab_start','grab_hold','grab_release',
    'hurt_head','hurt_leg','fall','get_up','double_claw','body_slam','exhausted'])
   assert.ok(named.has(name),'Falta clipe '+name);
 const duel=await page.evaluate(async()=>window.lab.rodar('ia-v05-duelo',{fps:45,maxSeg:62}));
 assert.ok(duel,'duelo real produz resultado');
 assert.equal(duel.semente,7);
 assert.ok(duel.tSim>=59,'duelo deve executar 60 s');
 assert.equal(duel.teste,'ia-v05-duelo');
 const telemetry=duel.iaAvancada||{};
 assert.ok(duel.eventos?.conflito_inicio>0,'conflito físico real foi criado');
 assert.ok(Object.keys(telemetry).some(k=>k.startsWith('tatico_')),'IA emite pelo menos um evento tático no duelo');
 const metrics=await page.evaluate(()=>({
   alive:window.lab.mundo.vivos.length,
   positions:window.lab.mundo.animais.map(a=>({
     id:a.id,x:a.x,y:a.y,z:a.z,hp:a.saude.hp,
     clipe:a.taticaAvancada?.visual?.nome||null,
     patterns:Object.keys(a.taticaAvancada?.padroes??{}).length
   }))
 }));
 assert.ok(metrics.positions.every(a=>[a.x,a.y,a.z,a.hp].every(Number.isFinite)));
 await page.screenshot({path:'/tmp/wildhaven-varrisco-v05-duelo-real.png',timeout:60000});
 assert.deepEqual(errors,[],'Erros no console Three.js durante animações ou combate');
 console.log(JSON.stringify({
   validado:true,
   glb:{nome:'varrisco-v04',totalClipes:clips.total,todosAnimam:clips.todosAnimam},
   duelo:{segundos:duel.tSim,hash:duel.hash,ia:telemetry,conflito:duel.eventos.conflito_inicio},
   animais:metrics.positions,
   evidencia:'/tmp/wildhaven-varrisco-v05-duelo-real.png'
 },null,2));
} finally {
 await browser?.close();
 server.kill('SIGTERM');
}
