/** Capture 10 actual GLB-animation GIFs from the local Hunter PvP viewer in Chromium.
 * Requires Node >=22 and playwright-core installed in labs/hunters-codex.
 * Does not invent frames from AI concepts or image-to-video.
 */
import { chromium } from '../../hunters-codex/node_modules/playwright-core/index.mjs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const out=new URL('../resultados/pvp-v06/',import.meta.url);await mkdir(out,{recursive:true});
const url=process.env.WILDHAVEN_PVP_URL ?? 'http://127.0.0.1:5195/hunters/viewer/pvp-preview-v06.html';
const clips=['pvp_sword_01_ready','pvp_sword_02_slash_right','pvp_sword_03_slash_left','pvp_sword_04_overhead','pvp_sword_05_thrust','pvp_sword_06_guard_high','pvp_sword_07_parry','pvp_sword_08_dodge','pvp_sword_09_take_hit','pvp_sword_10_kneel_injured'];
for(let i=0;i<40;i++){try{const r=await fetch(url);if(r.ok)break;}catch{}if(i===39)throw Error('Hunter lab server did not become ready');await new Promise(r=>setTimeout(r,350));}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1180,height:860},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('Console: '+m.text())});
const response=await page.goto(url,{waitUntil:'load',timeout:90000});if(!response?.ok())throw Error('Viewer HTTP '+response?.status());
await page.waitForFunction(()=>window.hunterPvpPreview?.status==='ready',null,{timeout:90000}).catch(async e=>{throw Error((await page.locator('#status').textContent())+' '+e.message)});
const declared=await page.evaluate(()=>window.hunterPvpPreview.clips);
if(JSON.stringify(declared)!==JSON.stringify(clips))throw Error('Browser does not expose all ten expected clips');
const evidence=[];
for(let i=0;i<clips.length;i++){
  const name=clips[i];await page.selectOption('#clip',name);
  await page.waitForTimeout(80);
  const screenshot=new URL(name+'.png',out);
  await page.screenshot({path:fileURLToPath(screenshot)});
  const downloadPromise=page.waitForEvent('download',{timeout:120000});
  await page.locator('#export').click();
  const dl=await downloadPromise;
  if(dl.suggestedFilename()!==name+'.gif')throw Error('Wrong download '+dl.suggestedFilename());
  const dest=fileURLToPath(new URL(name+'.gif',out));await dl.saveAs(dest);
  await page.waitForFunction(()=>!document.getElementById('export').disabled,null,{timeout:120000});
  const bytes=await readFile(dest);
  if(bytes.toString('ascii',0,6)!=='GIF89a'||bytes.readUInt16LE(6)!==300||bytes.readUInt16LE(8)!==380)throw Error('Invalid real GIF '+name);
  const frames=(bytes.toString('latin1').match(/\x21\xF9\x04/g)||[]).length;
  if(frames<5)throw Error(name+' has '+frames+' frames; expected >=5');
  evidence.push({name,file:name+'.gif',bytes:bytes.length,frames,sha256:createHash('sha256').update(bytes).digest('hex'),screenshot:name+'.png'});
  console.log(`${i+1}/10 ${name}: ${bytes.length} bytes, ${frames} frames`);
}
await browser.close();
if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors.slice(0,10)));
const glb=await readFile(new URL('../assets/hunter-pvp-v06/hunter_pvp_v06.glb',import.meta.url));
const manifest={status:'rendered-from-real-glb-pending-art-director-review',sourceGLB:'labs/hunters/assets/hunter-pvp-v06/hunter_pvp_v06.glb',sourceGLBSha256:createHash('sha256').update(glb).digest('hex'),generatedAt:new Date().toISOString(),renderer:'Three.js WebGL/Chromium SwiftShader; sword is a temporary visualization proxy attached to RightHand',count:evidence.length,gifs:evidence,errors};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2));
console.log('10 GIFs generated from real GLB; manifest '+fileURLToPath(out));