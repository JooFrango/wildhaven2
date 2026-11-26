/** Captures 1 real GLB GIF + 6 contact-frame screenshots in Chromium for director review. */
import {chromium} from '../../hunters-codex/node_modules/playwright-core/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const out=new URL('../resultados/pvp-v07/',import.meta.url);await mkdir(out,{recursive:true});
const url='http://127.0.0.1:5195/hunters/viewer/pvp-preview-v07.html';
for(let i=0;i<60;i++){try{const r=await fetch(url);if(r.ok)break}catch{}if(i===59)throw Error('Static server not ready');await new Promise(r=>setTimeout(r,300))}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1000,height:780},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await page.goto(url,{timeout:90000,waitUntil:'load'});
await page.waitForFunction(()=>window.pvp07?.status==='ready',null,{timeout:90000}).catch(async e=>{throw Error(await page.locator('#status').textContent()+' '+e.message)});
const clip='pvp07_sword_horizontal_review';
for(const t of [0,.26,.64,.88,1.16,1.40,1.87,2.2]){await page.evaluate(t=>{window.pvp07.setTime(t);window.pvp07.render();},t);await page.locator('#stage').screenshot({path:fileURLToPath(new URL(`pose_${String(t).replace('.','_')}.png`,out))});}
const dlPromise=page.waitForEvent('download',{timeout:120000});await page.locator('#export').click();const dl=await dlPromise;
if(dl.suggestedFilename()!==clip+'.gif')throw Error('Wrong GIF '+dl.suggestedFilename());
const dest=fileURLToPath(new URL(clip+'.gif',out));await dl.saveAs(dest);
await page.waitForFunction(()=>!document.getElementById('export').disabled,null,{timeout:120000});
if(errs.length)throw Error('WebGL errors: '+JSON.stringify(errs));
const gif=await readFile(dest),bytes=await readFile(new URL('../assets/hunter-pvp-v07/hunter_pvp_v07.glb',import.meta.url));
if(gif.toString('ascii',0,6)!=='GIF89a'||gif.readUInt16LE(6)!==480||gif.readUInt16LE(8)!==560)throw Error('Bad GIF output');
const sha=x=>createHash('sha256').update(x).digest('hex');
const frames=(gif.toString('latin1').match(/\x21\xF9\x04/g)||[]).length;
if(frames<35)throw Error('Rendered GIF has too few frames: '+frames);
const manifest={status:'rendered-from-real-glb-pending-director-approval',file:clip+'.gif',bytes:gif.length,frames,sha256:sha(gif),glb:'labs/hunters/assets/hunter-pvp-v07/hunter_pvp_v07.glb',glbSha256:sha(bytes),renderer:'three.js WebGL Chromium (actual GLB v07 with integrated sword mesh, no viewer proxy)',contactFrames:[0,.26,.64,.88,1.16,1.4,1.87,2.2].map(t=>`pose_${String(t).replace('.','_')}.png`),errors:errs};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest));await browser.close();