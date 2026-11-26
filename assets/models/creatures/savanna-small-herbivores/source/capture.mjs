import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const port=5519,url="http://127.0.0.1:"+port;
const server=spawn(process.execPath,
 ["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port),"--strictPort"],
 {stdio:["ignore","pipe","pipe"]});
let log="";
server.stdout.on("data",d=>log+=d.toString());
server.stderr.on("data",d=>log+=d.toString());
async function ready(){
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error("Server failed: "+log);
  try{const r=await fetch(url);if(r.ok)return;}catch{}
  await new Promise(ok=>setTimeout(ok,250));
 }
 throw Error("No Vite server: "+log);
}
let browser;
try{
 await ready();
 browser=await chromium.launch({headless:true,args:[
  "--no-sandbox","--disable-dev-shm-usage","--use-gl=angle",
  "--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
 const page=await browser.newPage({viewport:{width:1680,height:940},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:"networkidle",timeout:60000});
 await page.waitForFunction(()=>window.__savannaPreview?.status?.frames>=3,
  null,{timeout:30000});
 await page.evaluate(()=>{
   document.querySelector("header")?.remove();
   document.querySelector("#controls")?.remove();
 });
 const jobs=[
  {name:"savanna-small-herbivores-real-3d-v01.png",
   species:"all",action:"idle",view:"threeQuarter",time:0.3},
  {name:"velsari-real-3d-three-quarter-v01.png",
   species:"velsari",action:"idle",view:"threeQuarter",time:.2},
  {name:"velsari-real-3d-side-v01.png",
   species:"velsari",action:"alert",view:"side",time:.8},
  {name:"velsari-real-3d-running-v01.png",
   species:"velsari",action:"run",view:"action",time:.17},
  {name:"tarruco-real-3d-three-quarter-v01.png",
   species:"tarruco",action:"idle",view:"threeQuarter",time:.2},
  {name:"tarruco-real-3d-side-v01.png",
   species:"tarruco",action:"alert",view:"side",time:.8},
  {name:"tarruco-real-3d-digging-v01.png",
   species:"tarruco",action:"dig",view:"action",time:.9}
 ];
 const out=path.resolve("dist");fs.mkdirSync(out,{recursive:true});
 const verified=[];
 for(const job of jobs){
  await page.evaluate(job=>window.__savannaPreview.renderStill(job),job);
  await page.waitForTimeout(350);
  if(errors.length)throw Error("3D viewer exception: "+errors.join("; "));
  const f=path.join(out,job.name);
  await page.screenshot({path:f,animations:"disabled",timeout:120000});
  const bytes=fs.statSync(f).size;
  if(bytes<42000)throw Error("Possibly blank 3D preview "+job.name+": "+bytes);
  verified.push({...job,bytes});
  console.log("REAL WEBGL:",job.name,bytes);
 }
 const status=await page.evaluate(()=>window.__savannaPreview.status);
 fs.writeFileSync(path.join(out,"savanna-small-herbivores-render-report-v01.json"),
   JSON.stringify({source:"actual Three.js WebGL geometry; not AI concept images",
     status,screenshots:verified},null,2)+"\n");
 console.log(JSON.stringify(status,null,2));
}finally{
 await browser?.close();server.kill("SIGTERM");
}
