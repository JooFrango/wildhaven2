import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(".");
const base=path.resolve("../..");
const port=5478;
const address="http://127.0.0.1:"+port;
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js",
  "--host","127.0.0.1","--port",String(port),"--strictPort"],
  {cwd:root,stdio:["ignore","pipe","pipe"]});
let serverLog="";
server.stdout.on("data",d=>serverLog+=d.toString());
server.stderr.on("data",d=>serverLog+=d.toString());
async function ready(){
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error("Vite failed "+serverLog);
    try{const res=await fetch(address);if(res.ok)return;}catch{}
    await new Promise(ok=>setTimeout(ok,300));
  }
  throw Error("Vite start timeout "+serverLog);
}
let browser;
try {
  await ready();
  browser=await chromium.launch({
    headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage",
      "--use-gl=angle","--use-angle=swiftshader",
      "--enable-webgl","--enable-unsafe-swiftshader"]
  });
  const page=await browser.newPage({viewport:{width:1800,height:1000},deviceScaleFactor:1});
  const errs=[];page.on("pageerror",e=>errs.push(String(e)));
  await page.goto(address,{waitUntil:"networkidle",timeout:50000});
  await page.waitForFunction(()=>!!window.__wildhavenPreview?.models?.length,
    null,{timeout:30000});
  await page.waitForTimeout(1300);
  await page.evaluate(()=>{
    document.querySelector("header")?.remove();
    document.querySelector("#actions")?.remove();
  });
  await page.waitForTimeout(450);
  const jobs=[
    {file:"termite-specialists-real-3d-v02.png",index:-1,name:"together"},
    {file:"../ferrunco/ferrunco-real-3d-v02.png",index:0,name:"ferrunco",action:"dig"},
    {file:"../dunlingua/dunlingua-real-3d-v02.png",index:1,name:"dunlingua",action:"feed"},
    {file:"../pica-termita/pica-termita-real-3d-v02.png",index:2,name:"pica_termita",action:"crest_display"},
    {file:"../../environment/cupinzeiro/cupinzeiro-real-3d-v02.png",index:3,name:"cupinzeiro",action:"active"}
  ];
  for(const job of jobs){
    let success=false,bytes=0;
    for(let attempt=0;attempt<4;attempt++){
      await page.evaluate(({index,name,action})=>{
        const host=window.__wildhavenPreview;
        if(index<0)host.show(-1);
        else host.selectAnimation(name,action);
      },job);
      await page.waitForTimeout(700+attempt*450);
      const output=path.resolve(base,"termite-specialists",job.file);
      fs.mkdirSync(path.dirname(output),{recursive:true});
      await page.locator("#view").screenshot({path:output,animations:"disabled"});
      bytes=fs.statSync(output).size;
      if(errs.length)throw Error("3D browser exception: "+errs.join("; "));
      if(bytes>45000){success=true;break;}
      console.warn("Tiny WebGL frame, retrying",job.name,bytes);
      if(attempt<3)await page.reload({waitUntil:"networkidle"});
    }
    if(!success)throw Error("Invalid preview "+job.name+": "+bytes);
    console.log(JSON.stringify({name:job.name,bytes,source:"live Three.js WebGL"}));
  }
} finally {
  await browser?.close();server.kill("SIGTERM");
}
