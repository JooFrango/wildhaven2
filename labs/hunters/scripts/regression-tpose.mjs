import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const base=process.env.HUNTER_TEST_URL??'http://127.0.0.1:8782';
const require=createRequire(new URL('../../hunters-codex/package.json',import.meta.url)),{chromium}=require('playwright-core'),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[];
const poseSource=`id=>{const v=est.vistas.get(id);v.modelo.updateMatrixWorld(true);const pos=n=>v.modelo.worldToLocal(v.modelo.getObjectByName(n).getWorldPosition(new THREE.Vector3())).toArray(),arms=['Left','Right'].map(s=>({shoulder:pos(s+'Arm'),hand:pos(s+'Hand')}));return{clip:v.controladorTatico.clip,tPose:arms.every(({shoulder:p,hand:q})=>Math.abs(p[1]-q[1])<.10&&Math.abs(p[0]-q[0])>.40&&Math.abs(p[2]-q[2])<.10),arms};}`;
try{
 const old=await browser.newPage();
 const legacy=file=>execFileSync('git',['show','3b981ca:labs/hunters/'+file],{encoding:'utf8'});
 await old.route(/\/src\/animacao-jogador\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:legacy('src/animacao-jogador.js')}));
 await old.route(/\/src\/web3d\/app-hunters\.js(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:legacy('src/web3d/app-hunters.js')+'\nwindow.hunterLab.medirPose='+poseSource+';'}));
 await old.goto(base+'/labs/hunters/hunter-lab.html?cenario=arena-duelo');await old.waitForFunction(()=>window.hunterLab?.medirPose&&window.hunterLab.mundo,null,{timeout:60000});
 const before=await old.evaluate(async()=>{const m=hunterLab.mundo,a=m.hunters[0];await new Promise(requestAnimationFrame);a.hunter.action={name:'spear_clipe_inexistente',start:-.1,impact:.2,end:2};const frames=[];for(let i=0;i<16;i++){await new Promise(requestAnimationFrame);frames.push(hunterLab.medirPose(a.id));}return{frames,tPose:frames.filter(f=>f.tPose).length};});await old.close();
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(base+'/labs/hunters/hunter-lab.html?cenario=arena-duelo');await page.waitForFunction(()=>window.hunterLab?.medirPose&&window.hunterLab.mundo,null,{timeout:60000});
 const after=await page.evaluate(async()=>{
  const m=hunterLab.mundo,a=m.hunters[0],original={hunter:a.hunter,health:a.saude},reports=[];
  const cases=[['initial',{}],['unknown_clip',{action:{name:'spear_clipe_inexistente',start:-.1,impact:.2,end:2}}],['paused_attack',{action:{name:'spear_light',start:-.1,impact:.2,end:2}}],['walk',{speed:1}],['run',{speed:5}],['block',{blockUntil:2}],['dodge',{dodgeUntil:.4}],['hit',{hit:true}],['fall',{fall:true}],['get_up',{getUpUntil:.8,getUpStarted:0}],['surrender',{situacao:'rendido'}],['idle_after_surrender',{}]];
  for(const [name,options]of cases){a.hunter={...original.hunter,action:null,blockUntil:0,dodgeUntil:0,...options};a.saude={...original.health,caidoAte:options.fall?2:0,atordoadoAte:0};a.mente.atingidoPor=options.hit?{id:'teste',t:0}:null;a.velocidade=options.speed??0;a.direcaoMovimento=a.direcao;
   const frames=[];for(let i=0;i<16;i++){await new Promise(requestAnimationFrame);frames.push(hunterLab.medirPose(a.id));}reports.push({name,tPose:frames.filter(f=>f.tPose).length,last:frames.at(-1)});
  }
  return{reports,tPose:reports.reduce((sum,r)=>sum+r.tPose,0),pausedTime:m.t};
 });
 assert.equal(after.tPose,0,JSON.stringify(after));assert.equal(after.pausedTime,0);assert.equal(after.reports.find(r=>r.name==='unknown_clip').last.result.fallback,'combat_guard');
 await page.screenshot({path:fileURLToPath(new URL('../resultados/jogador/hunter-sem-tpose.png',import.meta.url))});
 await page.goto(base+'/labs/hunters/hunter-lab.html?cenario=jogador-lanca&semente=17');await page.waitForFunction(()=>window.hunterLab?.medirPose&&window.hunterLab.mundo,null,{timeout:60000});
 const fight=await page.evaluate(async()=>{let tPose=0,frames=0;const clips=new Set();for(let i=0;i<300&&!hunterLab.mundo.resultado;i++){hunterLab.avancar(.1);await new Promise(requestAnimationFrame);const p=hunterLab.medirPose(hunterLab.mundo.hunters[0].id);if(p.tPose)tPose++;frames++;clips.add(p.clip);}return{frames,tPose,clips:[...clips],seconds:hunterLab.mundo.t,invariants:hunterLab.invariantes()};});
 assert.equal(fight.tPose,0,JSON.stringify(fight));assert.deepEqual(fight.invariants,[]);assert.deepEqual(errors,[]);
 await writeFile(new URL('../resultados/jogador/tpose-regressao.json',import.meta.url),JSON.stringify({before,after,fight,errors},null,2));console.log(JSON.stringify({beforeT:before.tPose,pausedFrames:after.reports.length*16,afterT:after.tPose,fight}));await page.close();
}finally{await browser.close();}
