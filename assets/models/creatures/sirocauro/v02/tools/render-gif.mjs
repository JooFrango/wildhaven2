#!/usr/bin/env node
// Real Chromium renders of actual glTF GLB animation clips, no AI substitutes.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../../../../..');
const pngRoot=resolve(root,'assets/models/creatures/sirocauro/v02/previews/frames-temp');
const gifDest=resolve(root,'assets/models/creatures/sirocauro/v02/previews/sirocauro-v02-4-animacoes-reais.gif');
const fps=9;
const shows=[
 {name:'walk',label:'CAMINHADA PESADA',seconds:2.1},
 {name:'bite_heavy',label:'MORDIDA PESADA',seconds:1.24},
 {name:'tail_sweep_left',label:'GOLPE DE CAUDA',seconds:1.5},
 {name:'roar',label:'RUGIDO DE INTIMIDACAO',seconds:2.1},
];
const port=5178;
const server=createServer(async(req,res)=>{
 try{
  const url=decodeURIComponent((req.url||'/').split('?')[0]);
  const relative=url==='/'?'/assets/models/creatures/sirocauro/v02/tools/preview.html':url;
  const file=resolve(root,'.'+relative);
  if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const contents=await readFile(file);
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.png':'image/png'}[extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type});res.end(contents);
 }catch(e){res.writeHead(404);res.end(String(e));}
});
await new Promise(ok=>server.listen(port,'127.0.0.1',ok));
let browser;const logs=[];
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:720,height:405},deviceScaleFactor:1});
 page.on('pageerror',e=>logs.push('PAGE '+e.message));
 page.on('console',m=>{if(m.type()==='error')logs.push('CONSOLE '+m.text());});
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__ready||window.__error,{timeout:90000});
 const state=await page.evaluate(()=>({ready:window.__ready,error:window.__error,clips:window.__clips||[]}));
 assert.ok(state.ready,'GLB not ready: '+JSON.stringify(state)+'; '+logs.join('\n'));
 await mkdir(pngRoot,{recursive:true});
 let frame=0;
 for(const show of shows){
  assert.ok(state.clips.includes(show.name),'Missing '+show.name);
  const n=Math.ceil(show.seconds*fps);
  for(let i=0;i<n;i++){
   const time=i/n*show.seconds;
   const result=await page.evaluate(arg=>window.__pose(arg.name,arg.time,arg.label),{name:show.name,time,label:show.label});
   assert.ok(result.hasSkeleton);
   const output=resolve(pngRoot,String(frame).padStart(4,'0')+'.png');
   await page.screenshot({path:output,timeout:30000});
   frame++;
  }
 }
 await browser.close();browser=undefined;
 const py=[
  'import sys,glob',
  'from PIL import Image',
  'paths=sorted(glob.glob(sys.argv[1]+"/*.png"))',
  'assert len(paths)>20,len(paths)',
  'frames=[Image.open(p).convert("RGB").quantize(colors=128,method=Image.Quantize.FASTOCTREE) for p in paths]',
  'frames[0].save(sys.argv[2],save_all=True,append_images=frames[1:],duration=round(1000/int(sys.argv[3])),loop=0,optimize=False,disposal=2)',
  'print("GIF rendered from GLB:",len(frames),"frames")'
 ].join('\n');
 const cmd=spawnSync('python3',['-c',py,pngRoot,gifDest,String(fps)],{encoding:'utf-8',maxBuffer:1000000});
 if(cmd.error||cmd.status!==0)throw new Error('Pillow GIF conversion failed: '+String(cmd.error||cmd.stderr));
 if(logs.length)throw new Error(logs.join('\n'));
 console.log(JSON.stringify({gif:gifDest,real_glb:true,clips:shows.map(s=>s.name),frames:frame,errors:logs},null,2));
}finally{await browser?.close();server.close();}
