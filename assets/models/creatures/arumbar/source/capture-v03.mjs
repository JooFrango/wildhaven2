import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js",
  "--host","127.0.0.1","--port","5494","--strictPort"],
  {stdio:["ignore","pipe","pipe"]});
let startup="";
server.stdout.on("data",d=>startup+=d.toString());
server.stderr.on("data",d=>startup+=d.toString());
const url="http://127.0.0.1:5494/index-v03.html";
async function ready(){
  for(let n=0;n<100;n++){
    if(server.exitCode!==null)throw Error("Vite failed: "+startup);
    try{const r=await fetch(url);if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw Error("Vite not ready "+startup);
}
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true,args:[
    "--no-sandbox","--disable-dev-shm-usage","--use-gl=angle",
    "--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl"]});
  const page=await browser.newPage({
    viewport:{width:1360,height:780},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",error=>errors.push(String(error)));
  await page.goto(url,{waitUntil:"networkidle",timeout:50000});
  await page.waitForFunction(()=>window.__arumbarStudio?.snapshot()?.frame>=3,
    null,{timeout:30000});
  const init=await page.evaluate(()=>window.__arumbarStudio.snapshot());
  if(init.meshes<150)throw Error("Unexpectedly low true polygon mesh count "+init.meshes);
  await page.evaluate(()=>{
    document.querySelector("header")?.remove();
    document.querySelector("#actions")?.remove();
  });
  const cases=[
    {name:"arumbar-real-3d-three-quarter-v03.png",animation:"idle",view:"threeQuarter",time:.35},
    {name:"arumbar-real-3d-side-v03.png",animation:"idle",view:"side",time:.1},
    {name:"arumbar-real-3d-front-v03.png",animation:"alert",view:"front",time:.9},
    {name:"arumbar-real-3d-grazing-v03.png",animation:"graze",view:"grazing",time:1.1},
    {name:"arumbar-real-3d-running-v03.png",animation:"run",view:"threeQuarter",time:.19},
  ];
  page.setDefaultTimeout(120000);
  const output=path.resolve("dist-v03");
  fs.mkdirSync(output,{recursive:true});
  const summary=[];
  for(const item of cases){
    await page.evaluate(c=>{
      window.__arumbarStudio.renderStill(c.view,c.animation,c.time);
    },item);
    let size=0,success=false;
    for(let attempt=0;attempt<5;attempt++){
      await page.waitForTimeout(250+attempt*200);
      const filename=path.join(output,item.name);
      await page.screenshot({path:filename,animations:"disabled",timeout:120000});
      size=fs.statSync(filename).size;
      if(errors.length)throw Error("Viewer runtime failed: "+errors.join(" | "));
      if(size>65000){success=true;break;}
      console.warn("Retrying tiny WebGL frame",item.name,size);
    }
    if(!success)throw Error("Blank image "+item.name+": "+size);
    summary.push({name:item.name,bytes:size,view:item.view,animation:item.animation});
  }
  fs.writeFileSync(path.join(output,"arumbar-render-report-v03.json"),
    JSON.stringify({renderer:"Three.js WebGL screenshot of actual Arumbar geometry",
      meshInstances:init.meshes,anatomySculpt:true,shots:summary},null,2)+"\n");
  console.log(JSON.stringify({initial:init,screenshots:summary},null,2));
}finally{
  await browser?.close();
  server.kill("SIGTERM");
}
