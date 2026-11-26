#!/usr/bin/env node
// Duelo real dos dois GLBs no Chromium: não é vídeo nem simulação fake.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';

const port=Number(process.env.PORTA_GIGANTES??5194);
const server=spawn(process.execPath,['scripts/servidor.mjs','--porta',String(port)],{
 cwd:new URL('../',import.meta.url),stdio:['ignore','pipe','pipe']});
const logs=[];
server.stdout.on('data',v=>logs.push(String(v)));
server.stderr.on('data',v=>logs.push(String(v)));
let browser;
try{
 let ready=false;
 for(let i=0;i<200;i++){
   if(logs.join('').includes('http://localhost:'+port+'/')){ready=true;break;}
   if(server.exitCode!==null)throw Error('Servidor caiu: '+logs.join(''));
   await sleep(100);
 }
 assert.ok(ready,'Servidor não iniciou: '+logs.join('').slice(-1000));
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:'+port+
 '/laboratorio-predadores.html?modelo=v04&teste=ia-v05-gravarto-rocantraz',
 {waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.lab?.mundo?.porId?.has('v')&&
 window.lab.mundo.porId.has('rival'),{timeout:120000});
 const inicial=await page.evaluate(()=>({
   animais:window.lab.mundo.animais.map(a=>({id:a.id,especie:a.especie.id,ia:a.especie.combate.iaAvancada})),
   modelos:window.lab.modelos(),testes:window.lab.testes
 }));
 assert.deepEqual(inicial.animais.map(x=>x.especie),['gravarto','rocantraz']);
 assert.ok(inicial.animais.every(x=>x.ia===true));
 assert.equal(inicial.modelos.gravarto.clipes.length,17,'17 animações originais Gravarto v02');
 assert.equal(inicial.modelos.rocantraz.clipes.length,12,'12 animações originais Rocantraz v05');
 for(const name of ['bite','tail_sweep','walk','short_sprint'])assert.ok(
   inicial.modelos.gravarto.clipes.includes(name),'Gravarto sem clipe '+name);
 for(const name of ['bite','swipe','run','roar'])assert.ok(
   inicial.modelos.rocantraz.clipes.includes(name),'Rocantraz sem clipe '+name);
 const duelo=await page.evaluate(()=>window.lab.rodar('ia-v05-gravarto-rocantraz',{fps:45,maxSeg:77}));
 assert.equal(duelo.teste,'ia-v05-gravarto-rocantraz');
 assert.ok(duelo.tSim>=74,'executar os 75s completos');
 assert.ok((duelo.eventos.ataque_inicio||0)>0,'duelo precisa iniciar ao menos um golpe físico');
 const pos=await page.evaluate(()=>window.lab.mundo.animais.map(a=>({id:a.id,x:a.x,y:a.y,z:a.z,hp:a.saude.hp})));
 assert.ok(pos.every(a=>[a.x,a.y,a.z,a.hp].every(Number.isFinite)));
 await page.screenshot({path:'/tmp/wildhaven-gravarto-rocantraz-duelo-real.png',timeout:60000});
 assert.deepEqual(errors,[], 'Erros de Three.js/navegador');
 console.log(JSON.stringify({validado:true,modelos:Object.fromEntries(
  Object.entries(inicial.modelos).filter(([id])=>['gravarto','rocantraz'].includes(id)).map(([id,m])=>[id,m.clipes.length])),
  resultado:{segundos:duelo.tSim,hash:duelo.hash,eventos:duelo.eventos,ia:duelo.iaAvancada},
  posicoes:pos,imagem:'/tmp/wildhaven-gravarto-rocantraz-duelo-real.png'},null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
