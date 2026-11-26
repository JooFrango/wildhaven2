// Real WebGL and input smoke test. Requires Chromium/Chrome and Node 22+.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {setTimeout as pause} from 'node:timers/promises'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'wh171-browser-'))
const chrome=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const base=process.env.VILLAGE_URL||'http://127.0.0.1:8799/world/hunters-village-v01/viewer/'
const alpha=process.argv.includes('--alpha')
function urlFor(id){const u=new URL(base);u.searchParams.set('conta',id);return u.href}
const proc=spawn(chrome,['--headless=new','--no-first-run','--disable-default-apps','--disable-extensions','--disable-background-networking',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--window-size=1200,800','--user-data-dir='+profile,'about:blank'],
  {windowsHide:true,stdio:'ignore'})
let ws,seq=0
const waiting=new Map(),errors=[],report={views:[],checks:[]}
async function until(fn,ms=100000){
  const end=Date.now()+ms
  while(Date.now()<end){try{const value=await fn();if(value)return value}catch{}await pause(180)}
  throw Error('Tempo esgotado: '+String(fn).slice(0,100))
}
function cdp(method,params={}){
  const id=++seq
  return new Promise((resolve,reject)=>{waiting.set(id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}))})
}
async function ev(expression){
  const res=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
  if(res.exceptionDetails)throw Error(res.exceptionDetails.exception?.description||res.exceptionDetails.text)
  return res.result.value
}
const waitScene=()=>until(()=>ev('Boolean(window.villageQA?.ready)'))
async function snap(label){
  await ev('villageQA.measure(2)')
  const metrics=await ev('villageQA.metrics')
  report.views.push({view:label,...metrics,stage_layers:await ev('villageQA.stageLayers')})
}
try{
  const port=await until(async()=>(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0],30000)
  const target=await until(async()=>(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page'))
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data)
    if(msg.id && waiting.has(msg.id)){const [r,j]=waiting.get(msg.id);waiting.delete(msg.id);msg.error?j(Error(msg.error.message)):r(msg.result)}
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text)
    if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(msg.params.args.map(x=>x.value??x.description).join(' '))
  }
  await cdp('Page.enable');await cdp('Runtime.enable')
  await cdp('Emulation.setDeviceMetricsOverride',{width:1152,height:728,deviceScaleFactor:1,mobile:false})
  ws.onclose=()=>{for(const [,reject] of waiting.values())reject(Error('Sessão Chromium encerrada'));waiting.clear()}
  await cdp('Page.navigate',{url:urlFor('qa-hunter-a')});await waitScene()
  assert.equal(await ev('villageQA.worldTiles'),171)
  for(let i=1;i<=4;i++){
    await ev('villageQA.stage('+i+')');assert.equal(await ev('villageQA.phase'),i);assert.equal(await ev('villageQA.stageLayers'),2);await snap('fase-'+i)
  }
  await ev('Promise.all([villageQA.stage(1),villageQA.stage(3),villageQA.stage(4)])')
  assert.equal(await ev('villageQA.phase'),4);report.checks.push('troca rápida mantém apenas a última fase')
  await ev('villageQA.walk()');const start=await ev('villageQA.point')
  assert.equal(await ev('villageQA.walking'),true)
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87})
  await until(async()=>{const p=await ev('villageQA.point');return Math.hypot(start[0]-p[0],start[1]-p[1])>.05},20000)
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87})
  const end=await ev('villageQA.point');assert.ok(Math.hypot(start[0]-end[0],start[1]-end[1])>.05)
  await ev('villageQA.walk()');report.checks.push('WASD desloca Hunter sobre a malha')
  await cdp('Page.reload');await pause(850);await waitScene();assert.equal(await ev('villageQA.phase'),4)
  await cdp('Page.navigate',{url:urlFor('qa-hunter-b')});await pause(850);await waitScene()
  assert.equal(await ev('villageQA.phase'),1);report.checks.push('fase persiste ao reabrir e fica isolada por conta')
  await ev('villageQA.stage(4)');await ev("villageQA.view('top')");await snap('planta')
  await ev("villageQA.view('hex')");await snap('hexágono');assert.equal(await ev('villageQA.stageLayers'),1)
  await ev("villageQA.view('seam')");assert.deepEqual(await ev('villageQA.neighbors'),['FX_20'])
  await ev('villageQA.walk()')
  const crossed=await ev("(()=>{const p=villageQA.point;let ok=true; for(let i=0;i<48;i++)ok=villageQA.step(-.125,-.21650635)&&ok;const e=villageQA.point;return {ok,start:p,end:e,height:villageQA.height(...e)}})()")
  assert.ok(crossed.ok && Number.isFinite(crossed.height) && Math.hypot(...crossed.end)>2165.1)
  report.crossing=crossed;report.checks.push('travessia real de HV_01 para FX_20 em primeira pessoa')
  await ev("villageQA.view('world')");await snap('mundo-171');assert.equal(await ev('villageQA.stageLayers'),1)
  if(!alpha){
    const pic=await cdp('Page.captureScreenshot',{format:'png'})
    await fs.writeFile(path.join(root,'preview/mapa_171.png'),Buffer.from(pic.data,'base64'))
  }
  await ev("villageQA.view('village')");await snap('volta ao núcleo')
  const times=await ev('villageQA.measure(10)')
  report.frame_ms_software_webgl=times.slice(2).sort((a,b)=>a-b)
  report.browser=(await cdp('Browser.getVersion')).product
  report.adapter=await ev("(()=>{const g=villageQA.renderer.getContext(),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()")
  report.errors=errors;assert.deepEqual(errors,[])
  await fs.writeFile(path.join(root,'tests',alpha?'alpha-browser.json':'browser.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({views:report.views.length,checks:report.checks,adapter:report.adapter}))
}catch(e){console.error(e,errors);throw e}finally{
  if(ws?.readyState===1){try{await Promise.race([cdp('Browser.close'),pause(500)])}catch{}ws.close()}
  proc.kill();await pause(500)
  try{await fs.rm(profile,{force:true,recursive:true,maxRetries:4,retryDelay:300})}catch{}
}

