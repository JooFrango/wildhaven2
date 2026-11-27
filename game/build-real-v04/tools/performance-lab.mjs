// Node 22+, Chromium iniciado com um perfil de teste e --remote-debugging-port.
import fs from 'node:fs';
import os from 'node:os';

import { setTimeout as wait } from 'node:timers/promises';
const [port, url, scenario, seconds, output, ...disabled] = process.argv.slice(2);
const duration = Number(seconds);
if (!output || !(duration >= 1) || !['vila','economico','alternar','descarte','zoom','oculto','manual','cancelamento'].includes(scenario)) {
  throw Error('Uso: node performance-lab.mjs PORT URL vila|economico|alternar|descarte|zoom|oculto SEGUNDOS ARQUIVO.json [sistemas a desligar]');
}
const base = 'http://127.0.0.1:' + Number(port);
const target = await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ socket.onopen=resolve; socket.onerror=reject; });
let id=0, bytes=0, messages=0;
const pending=new Map(), errors=[];
socket.onmessage=({data})=>{
  const m=JSON.parse(data);
  if(pending.has(m.id)){const cb=pending.get(m.id);pending.delete(m.id);cb(m);}
  if(m.method==='Network.webSocketFrameReceived'){bytes+=Buffer.byteLength(m.params.response.payloadData);messages++;}
  if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
};
async function call(method,params={}){
  const n=++id;
  const response=new Promise(resolve=>pending.set(n,resolve));
  socket.send(JSON.stringify({id:n,method,params}));
  const m=await response;if(m.error)throw Error(m.error.message);return m.result;
}
async function evaluate(expression){
  const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
let cover;
const report={scenario,url,disabled,seconds:duration,cpu:os.cpus()[0].model,logical:os.cpus().length,ramBytes:os.totalmem(),samples:[],errors};
const version=await (await fetch(base+'/json/version')).json();
report.browser=version.Browser;
const browser=new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{browser.onopen=resolve;browser.onerror=reject;});
async function processTimes(){
  const result=new Promise((resolve,reject)=>{
    browser.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1){if(m.error)reject(Error(m.error.message));else resolve(m.result.processInfo);}};
  });
  browser.send(JSON.stringify({id:1,method:'SystemInfo.getProcessInfo'}));return result;
}
try{
  await call('Network.enable'); await call('Runtime.enable'); await call('Page.enable');
  if(disabled.includes('comunicacao'))await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.WebSocket=class extends WebSocket{constructor(...args){super(...args);window.auditSocket=this}}`});
  await call('Page.navigate',{url});
  const start=Date.now();
  while(!await evaluate('Boolean(window.__wildhavenDbg)')){
    if(Date.now()-start>120000)throw Error('Inicialização excedeu 120 s');
    await wait(300);
  }
  report.readyMs=Date.now()-start;
  await evaluate(`(() => {
    window.auditLong=[];
    new PerformanceObserver(entries=>auditLong.push(...entries.getEntries().map(e=>e.duration))).observe({type:'longtask'});
    const s=window.__wildhavenScene, noop=()=>{};
    for(const key of ${JSON.stringify(disabled)}) {
      switch(key){
        case 'sombras': s.renderer.shadowMap.enabled=false;break;
        case 'agua': s.world.waterMaterial.visible=false;break;
        case 'ceu': s.atm.sky.visible=false;break;
        case 'vegetacao': s.veg.update=noop;s.veg.group.visible=false;s.grass.update=noop;s.grass.group.visible=false;break;
        case 'animacoes': s.actors.tickMixer=noop;break;
        case 'streaming': s.world.stream=noop;s.veg.stream=noop;break;
        case 'hud': document.getElementById('ui').style.display='none';break;
        case 'comunicacao': window.auditSocket.send(JSON.stringify({modo:'fundo'}));break;
        case 'clima': s.fx.update=noop;s.fx.points.visible=false;break;
        default: throw Error('Sistema desconhecido: '+key);
      }
    }
  })()`);
  if(scenario==='economico'||scenario==='descarte')await evaluate('__wildhavenSetMode(true)');
  const probe=await evaluate(`(() => {
    const s=window.__wildhavenScene;
    if(!s)return false;
    const p=s.perf, original=p.frame; let last=0;
    window.auditFrames=[];window.auditReset=()=>{last=0};
    p.frame=function(...args){const now=performance.now();if(last)auditFrames.push(now-last);last=now;return original.apply(this,args)};
    const gl=s.renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'indisponível';
  })()`);
  report.renderer=probe;
  if(scenario==='cancelamento')report.cancellation=await evaluate(`(async()=>{
    const actors=__wildhavenScene.actors, url='/glb/hunter.glb';
    await actors.template(url);
    const before=actors.group.children.length;
    const a=actors.spawn(url,'lab',()=>{});
    actors.creatures.set(-1,a);
    actors.release(-1,a);
    await Promise.resolve();
    return {orphanChildren:actors.group.children.length-before,registered:actors.creatures.has(-1)};
  })()`);
  const toggleManual=()=>evaluate("dispatchEvent(new KeyboardEvent('keydown',{code:'F8',shiftKey:true}))");
  if(scenario==='manual')await toggleManual();
  if(scenario==='oculto'){
    cover=await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
    await fetch(base+'/json/activate/'+cover.id);
    for(let i=0;i<20 && !await evaluate('document.hidden');i++)await wait(100);
    if(!await evaluate('document.hidden')) throw Error('O navegador manteve a aba visível');
  }
  const procBefore=await processTimes();
  bytes=messages=0;const t=Date.now();
  while(Date.now()-t<duration*1000){
    await wait(1000);
    const i=report.samples.length;
    if(scenario==='alternar' && i%5===0){await evaluate('__wildhavenSetMode('+ (i%10===0)+')');await evaluate('window.auditReset?.()');}
    if(scenario==='zoom' && i%5===0)await evaluate('__wildhavenCamera.zoomTo('+ (i%10===0?65:700)+')');
    const value=await evaluate(`(()=>{const p=__wildhavenPerf;return {mode:p.mode,frames:p.framesDrawn,gpuMs:p.gpuMs,drawCalls:p.drawCalls,triangles:p.triangles,heapMB:p.heapMB,stream:p.streaming,debugScene:!!window.__wildhavenScene,activeScene:__wildhavenDbg().cena,intervals:window.auditFrames?.splice(0)??null}})()`);
    const longTasks=await evaluate('auditLong.splice(0)');
    report.samples.push({ms:Date.now()-t,wsBytes:bytes,wsMessages:messages,longTasks,...value});
    fs.writeFileSync(output,JSON.stringify(report));
  }
  const procAfter=await processTimes(), wall=(Date.now()-t)/1000;
  report.processes=procAfter.map(p=>{
    const prev=procBefore.find(b=>b.id===p.id);
    const pct=prev?100*(p.cpuTime-prev.cpuTime)/wall:null;
    return {id:p.id,type:p.type,cpuPctCore:pct,cpuPctMachine:pct===null?null:pct/report.logical};
  });
  report.processSetStable=procBefore.length===procAfter.length && report.processes.every(p=>p.cpuPctCore!==null);
  if(scenario==='descarte'){
    await call('HeapProfiler.collectGarbage');
    report.afterGc=await call('Runtime.getHeapUsage');
    report.retained=await evaluate('(()=>{const s=window.__wildhavenScene;return {debugScene:!!s,activeScene:__wildhavenDbg().cena,templates:s?.actors?.templates?.size??0,hunters:s?.actors?.hunters?.size??0}})()');
  }
  const dt=report.samples.flatMap(x=>x.intervals??[]).sort((a,b)=>a-b);
  if(scenario==='manual'){
    if(report.samples.some(s=>s.mode!=='suspenso'||s.intervals?.length))throw Error('Apresentador ativo no fundo manual');
    await toggleManual();
    await wait(1500);
    report.resumed=await evaluate("__wildhavenDbg().laco==='3d'");
    if(!report.resumed)throw Error('Falha ao retomar');
  }
  if(process.env.WH_LAB_SCREENSHOT){
    const image=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(process.env.WH_LAB_SCREENSHOT,Buffer.from(image.data,'base64'));
  }
  if(dt.length){
    const tail=f=>{const a=dt.slice(-Math.ceil(f*dt.length));return 1000*a.length/a.reduce((s,t)=>s+t,0);};
    const q=f=>dt[Math.ceil(dt.length*f)-1];
    report.frames={n:dt.length,fps:tail(1),p50:q(.5),p95:q(.95),p99:q(.99),low1:tail(.01),low01:dt.length>=1000?tail(.001):null,over50:dt.filter(x=>x>50).length,over100:dt.filter(x=>x>100).length};
  }
} finally {
  fs.writeFileSync(output,JSON.stringify(report,null,2));browser.close();socket.close();await fetch(base+'/json/close/'+target.id);
  if(cover)await fetch(base+'/json/close/'+cover.id);
}
