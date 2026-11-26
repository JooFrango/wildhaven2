/** Renders the REAL v09 GLB in Chromium/WebGL: 3 GIFs (profile, front, three-quarter) + key-pose PNGs.
 * Usage: node scripts/capture-hunter-pvp-v09.mjs [--v10|--v11 [--reverse]] [--chrome <path>] [--poses-only]
 */
import {chromium} from '../../hunters-codex/node_modules/playwright-core/index.mjs';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {extname,join,normalize} from 'node:path';

// --pve1: mesmo visualizador da v12 com o GLB PvE v01; saída em resultados/pve-v01/.
const PVE=process.argv.includes('--pve1');
const VER=PVE||process.argv.includes('--v12')?'v12':process.argv.includes('--v11')?'v11':process.argv.includes('--v10')?'v10':'v09',VN=VER.slice(1);
// --v12: a biblioteca tem três clipes; --clip <nome> escolhe qual renderizar, e as poses-chave vêm do manifesto.
const ci=process.argv.indexOf('--clip'),CLIP_ARG=ci>0?process.argv[ci+1]:null;
// --reverse (v11+): render the backhand clip instead of the forehand one.
const REV=process.argv.includes('--reverse'),STEM=REV?'sword_horizontal_reverse_cut':'sword_horizontal_cut';
const CLIP_NAME=CLIP_ARG??`pvp${VN}_${STEM}`;
const ROOT=fileURLToPath(new URL('..',import.meta.url));
const OUT=new URL(PVE?'../resultados/pve-v01/':`../resultados/pvp-${VER}/`,import.meta.url);await mkdir(OUT,{recursive:true});
const TYPES={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json'};
const server=createServer(async(req,res)=>{const p=normalize(join(ROOT,decodeURIComponent(new URL(req.url,'http://x').pathname)));
 if(req.url.startsWith('/favicon')){res.writeHead(204).end();return;}
 if(!p.startsWith(ROOT)){res.writeHead(403).end();return;}
 try{const b=await readFile(p);res.writeHead(200,{'content-type':TYPES[extname(p)]??'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/viewer/pvp-preview-${VER}.html?clip=${encodeURIComponent(CLIP_NAME)}${PVE?'&pve1=1':''}`;
const arg=process.argv.indexOf('--chrome'),executablePath=arg>0?process.argv[arg+1]:process.env.CHROME_PATH;
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:780}}),errs=[];
page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await page.goto(url,{timeout:90000,waitUntil:'load'});
await page.waitForFunction(()=>window.pvpViewer?.status==='ready',null,{timeout:90000}).catch(async e=>{throw Error(await page.locator('#status').textContent()+' '+e.message)});
const sha=x=>createHash('sha256').update(x).digest('hex');
// v12: as poses-chave de cada clipe saem do manifesto gerado, então a captura segue a autoria, não uma lista fixa.
let MINFRAMES=30;
let POSES={guard:0,preparation:.2,charge:.42,execution:.7,contact:.84,continuation:1.02,followEnd:1.18,recovery:1.5};
if(VER==='v12'){const man=JSON.parse(await readFile(new URL(PVE?'../assets/hunter-pve-v01/manifest.json':'../assets/hunter-pvp-v12/manifest.json',import.meta.url),'utf8'));
 const def=man.newClips.find(c=>c.name===CLIP_NAME);if(!def)throw Error('Clipe fora do manifesto: '+CLIP_NAME);
 POSES=Object.fromEntries(Object.entries(def.phases).map(([k,v])=>[k,Math.min(v,def.duration-.002)]));
 // O portão de quadros segue a duração do clipe: o bloqueio tem 1,10 s, não os 1,9 s do corte.
 MINFRAMES=Math.floor(def.duration*25)-1;}
const shots=[];
for(const angle of ['profile','front','threequarter'])for(const [phase,t] of Object.entries(POSES)){
 await page.evaluate(([a,t])=>{window.pvpViewer.pause();window.pvpViewer.setAngle(a);window.pvpViewer.setTime(t);},[angle,t]);
 const file=`pose_${VER==='v12'?CLIP_NAME+'_':REV?'reverse_':''}${angle}_${phase}_${String(t).replace('.','_')}.png`;await page.locator('#stage').screenshot({path:fileURLToPath(new URL(file,OUT))});shots.push(file);}
const previews=[];
if(!process.argv.includes('--poses-only'))for(const angle of ['profile','front','threequarter']){
 await page.evaluate(a=>window.pvpViewer.setAngle(a),angle);
 await page.evaluate(()=>window.pvpViewer.exportGif());
 const gif=Buffer.from(await page.evaluate(()=>window.pvpViewer.lastGifBase64),'base64');
 if(gif.toString('ascii',0,6)!=='GIF89a')throw Error('Invalid GIF '+angle);
 const frames=(gif.toString('latin1').match(/\x21\xF9\x04/g)||[]).length;if(frames<MINFRAMES)throw Error('Missing frames '+angle+': '+frames);
 const file=`${VER==='v12'?CLIP_NAME:'pvp'+VN+'_'+STEM}_${angle}.gif`;await writeFile(new URL(file,OUT),gif);
 previews.push({file,angle,frames,width:gif.readUInt16LE(6),height:gif.readUInt16LE(8),bytes:gif.length,sha256:sha(gif)});console.log(JSON.stringify(previews.at(-1)));}
await browser.close();server.close();
if(errs.length)throw Error('WebGL errors: '+JSON.stringify(errs));
if(previews.length){const GLB_REL=PVE?'labs/hunters/assets/hunter-pve-v01/hunter_pve_v01.glb':`labs/hunters/assets/hunter-pvp-${VER}/hunter_pvp_${VER}.glb`;
 const glb=await readFile(new URL('../../../'+GLB_REL,import.meta.url));
 // v12: a biblioteca tem vários clipes e cada execução renderiza um. O manifesto ACUMULA por clipe,
 // senão a última execução apagaria a prova das anteriores.
 const arquivo=new URL('manifest.json',OUT);
 let anterior={};
 if(VER==='v12')try{anterior=JSON.parse(await readFile(arquivo,'utf8'));}catch{}
 const base={status:'rendered-from-real-glb-pending-director-approval',glb:GLB_REL,glbSha256:sha(glb),
  renderer:`three.js WebGL (headless Chromium) loading the real ${PVE?'PvE v01':VER} GLB with its integrated sword mesh`};
 if(VER!=='v12'){await writeFile(arquivo,JSON.stringify({...base,previews,keyPoses:POSES,screenshots:shots},null,2));}
 else{
  // Entradas gravadas contra um GLB antigo não valem como prova deste: são descartadas.
  const clipes=anterior.glbSha256===base.glbSha256?(anterior.clipes??{}):{};
  clipes[CLIP_NAME]={previews,keyPoses:POSES,screenshots:shots};
  await writeFile(arquivo,JSON.stringify({...base,clipes},null,2));
 }}
console.log(`ok ${shots.length} screenshots, ${previews.length} GIFs`);
