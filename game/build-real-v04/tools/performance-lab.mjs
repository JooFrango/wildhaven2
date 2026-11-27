// Node 22+, Chromium iniciado com um perfil de teste e --remote-debugging-port.
import fs from 'node:fs';
import os from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
const [port, url, scenario, seconds, output] = process.argv.slice(2);
const duration = Number(seconds);
if (!output || !(duration >= 1) || !['vila','economico','alternar','descarte','zoom'].includes(scenario)) {
  throw Error('Uso: node performance-lab.mjs PORT URL vila|economico|alternar|descarte|zoom SEGUNDOS ARQUIVO.json');
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
const report={scenario,url,seconds:duration,cpu:os.cpus()[0].model,logical:os.cpus().length,ramBytes:os.totalmem(),samples:[],errors};
try{
  await call('Network.enable'); await call('Runtime.enable'); await call('Page.enable');
  await call('Page.navigate',{url});
  const start=Date.now();
  while(!await evaluate('Boolean(window.__wildhavenDbg)')){
    if(Date.now()-start>120000)throw Error('Inicialização excedeu 120 s');
    await wait(300);
  }
  report.readyMs=Date.now()-start;
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
  bytes=messages=0;const t=Date.now();
  while(Date.now()-t<duration*1000){
    await wait(1000);
    const i=report.samples.length;
    if(scenario==='alternar' && i%5===0){await evaluate('__wildhavenSetMode('+ (i%10===0)+')');await evaluate('window.auditReset?.()');}
    if(scenario==='zoom' && i%5===0)await evaluate('__wildhavenCamera.zoomTo('+ (i%10===0?65:700)+')');
    const value=await evaluate(`(()=>{const p=__wildhavenPerf;return {mode:p.mode,frames:p.framesDrawn,gpuMs:p.gpuMs,drawCalls:p.drawCalls,triangles:p.triangles,heapMB:p.heapMB,stream:p.streaming,debugScene:!!window.__wildhavenScene,activeScene:__wildhavenDbg().cena,intervals:window.auditFrames?.splice(0)??null}})()`);
    report.samples.push({ms:Date.now()-t,wsBytes:bytes,wsMessages:messages,...value});
    fs.writeFileSync(output,JSON.stringify(report));
  }
  if(scenario==='descarte'){
    await call('HeapProfiler.collectGarbage');
    report.afterGc=await call('Runtime.getHeapUsage');
    report.retained=await evaluate('(()=>{const s=window.__wildhavenScene;return {debugScene:!!s,activeScene:__wildhavenDbg().cena,templates:s?.actors?.templates?.size??0,hunters:s?.actors?.hunters?.size??0}})()');
  }
  const dt=report.samples.flatMap(x=>x.intervals??[]).sort((a,b)=>a-b);
  if(dt.length){
    const tail=f=>{const a=dt.slice(-Math.ceil(f*dt.length));return 1000*a.length/a.reduce((s,t)=>s+t,0);};
    const q=f=>dt[Math.ceil(dt.length*f)-1];
    report.frames={n:dt.length,fps:tail(1),p50:q(.5),p95:q(.95),p99:q(.99),low1:tail(.01),low01:dt.length>=1000?tail(.001):null,over50:dt.filter(x=>x>50).length,over100:dt.filter(x=>x>100).length};
  }
} finally {
  fs.writeFileSync(output,JSON.stringify(report,null,2));socket.close();await fetch(base+'/json/close/'+target.id);
}
