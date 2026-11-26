import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const port=5528,url="http://127.0.0.1:"+port;
const server=spawn(process.execPath,[
 "node_modules/vite/bin/vite.js","--host","127.0.0.1",
 "--port",String(port),"--strictPort"],{stdio:["ignore","pipe","pipe"]});
let log="";
server.stdout.on("data",d=>log+=d.toString());
server.stderr.on("data",d=>log+=d.toString());
async function ready(){
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error("Vite failed "+log);
  try{const response=await fetch(url);if(response.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error("Vite startup timeout "+log);
}
let browser;
try{
 await ready();
 browser=await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage",
  "--use-gl=angle","--use-angle=swiftshader",
  "--enable-webgl","--enable-unsafe-swiftshader"]});
 const page=await browser.newPage({viewport:{width:1700,height:940},deviceScaleFactor:1});
 page.setDefaultTimeout(120000);
 const errors=[];page.on("pageerror",error=>errors.push(String(error)));
 await page.goto(url,{waitUntil:"networkidle",timeout:65000});
 await page.waitForFunction(()=>window.__rocantrazStudio?.status.frameCount>=3,
  null,{timeout:30000});
 const init=await page.evaluate(()=>window.__rocantrazStudio.status);
 if(init.creatures.some(x=>x.meshes<100||x.triangles<35000))
   throw Error("Real high-detail models not loaded: "+JSON.stringify(init));
 await page.evaluate(()=>{
  document.querySelector("header")?.remove();
  document.querySelector("#controls")?.remove();
  document.querySelector("#species")?.remove();
 });
 const tasks=[
  ["rocantraz-biped-forest-desert-real-3d-v04.png","both","threeQuarter","idle",.33],
  ["rocantraz-forest-biped-real-3d-v04.png","forest","threeQuarter","idle",.31],
  ["rocantraz-desert-biped-real-3d-v04.png","desert","threeQuarter","idle",.29],
  ["rocantraz-forest-biped-profile-v04.png","forest","side","walk",.20],
  ["rocantraz-forest-biped-roar-v04.png","forest","threeQuarter","roar",.90],
  ["rocantraz-desert-biped-charge-v04.png","desert","threeQuarter","charge",.18],
 ];
 const dest=path.resolve("dist");fs.mkdirSync(dest,{recursive:true});
 const summary=[];
 for(const [name,variant,view,action,time] of tasks){
  await page.evaluate(data=>window.__rocantrazStudio.renderStill(data),
   {variant,view,action,time});
  await page.waitForTimeout(500);
  if(errors.length)throw Error("Browser 3D render error: "+errors.join(" | "));
  const file=path.join(dest,name);
  await page.screenshot({path:file,animations:"disabled",timeout:120000});
  const bytes=fs.statSync(file).size;
  if(bytes<55000)throw Error("Blank/tiny actual 3D screenshot: "+name+" "+bytes);
  console.log("TRUE 3D RENDER",name,bytes);
  summary.push({name,variant,view,action,time,bytes});
  // Real framebuffer crop only. Useful close-up of actual GLB geometry, NOT
  // an AI recreation or a synthetic concept painting.
  if(variant==="both"||name==="rocantraz-forest-biped-real-3d-v04.png"||
      name==="rocantraz-desert-biped-real-3d-v04.png"){
    const clip=variant==="both"?
      {x:350,y:295,width:1080,height:525}:
      {x:365,y:247,width:980,height:600};
    const detail=name.replace("-v04.png","-detail-v04.png");
    const close=path.join(dest,detail);
    await page.screenshot({path:close,clip,animations:"disabled",timeout:120000});
    const cbytes=fs.statSync(close).size;
    if(cbytes<44000)throw Error("Missing real detail render "+detail);
    summary.push({name:detail,variant,view,action,time,bytes:cbytes,
      origin:"WebGL framebuffer crop"});
    console.log("TRUE 3D CLOSE-UP",detail,cbytes);
  }
 }
 fs.writeFileSync(path.join(dest,"rocantraz-biped-preview-report-v04.json"),
  JSON.stringify({source:"true Three.js/WebGL screenshot of implemented models",
   gameIntegrated:false,geometry:init,screenshots:summary},null,2)+"\n");
 console.log("Capture complete",JSON.stringify(init));
}finally{
 await browser?.close();server.kill("SIGTERM");
}
