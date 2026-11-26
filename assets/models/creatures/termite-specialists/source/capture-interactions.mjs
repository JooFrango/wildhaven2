import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port=5489;
const url="http://127.0.0.1:"+port+"/interaction.html";
const previewDir=path.resolve("..");
fs.mkdirSync(previewDir,{recursive:true});
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js",
  "--host","127.0.0.1","--port",String(port),"--strictPort"],
  {stdio:["ignore","pipe","pipe"]});
let serverLog="";
server.stdout.on("data",d=>serverLog+=d.toString());
server.stderr.on("data",d=>serverLog+=d.toString());
async function waitReady(){
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error("Vite failed: "+serverLog);
    try{
      const response=await fetch(url);
      if(response.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw Error("Vite timeout: "+serverLog);
}
let browser;
try {
  await waitReady();
  browser=await chromium.launch({
    headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage",
      "--use-gl=angle","--use-angle=swiftshader",
      "--enable-webgl","--enable-unsafe-swiftshader"]
  });
  const page=await browser.newPage({viewport:{width:2000,height:1050},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:"networkidle",timeout:55000});
  await page.waitForFunction(()=>window.__wildhavenTestScene?.stages?.length===3,
    null,{timeout:30000});
  const start=await page.evaluate(()=>window.__wildhavenTestScene.snapshots);
  if(start.length!==3||start.some(s=>s.population!==16000))throw Error("Invalid starting colony state");
  for(const row of start){
    const distance=Math.hypot(
      row.animal[0]-row.mound[0],row.animal[2]-row.mound[2]);
    if(distance>4.4)throw Error("Food source out of reach: "+row.id+", distance="+distance);
  }
  await page.waitForTimeout(1100);
  const jobs=[
    {name:"combined",file:"feeding-scenes-real-3d-v02.png",focus:"all"},
    {name:"forest",file:"forest-feeding-real-3d-v02.png",focus:"ferrunco"},
    {name:"desert",file:"desert-feeding-real-3d-v02.png",focus:"dunlingua"},
    {name:"grassland",file:"grassland-feeding-real-3d-v02.png",focus:"pica_termita"}
  ];
  for(const job of jobs){
    await page.evaluate(focus=>{
      window.__wildhavenTestScene.focus(focus);
      document.querySelector("#info")?.remove();
      document.querySelector("#controls").style.display="none";
    },job.focus);
    let bytes=0,success=false;
    for(let attempt=0;attempt<5;attempt++){
      await page.waitForTimeout(750+attempt*350);
      const filename=path.join(previewDir,job.file);
      await page.locator("#render").screenshot({path:filename,animations:"disabled"});
      bytes=fs.statSync(filename).size;
      if(errors.length)throw Error("Browser errors: "+errors.join("; "));
      if(bytes>60000){success=true;break;}
      console.warn("Retrying empty WebGL frame",job.name,bytes);
    }
    if(!success)throw Error("Empty 3D screenshot "+job.name+" "+bytes);
    if(job.name==="combined"){
      // Tighter genuine framebuffer crop for readable model inspection.
      const detail=path.join(previewDir,"feeding-scenes-detail-real-3d-v02.png");
      await page.screenshot({path:detail,clip:{x:180,y:240,width:1640,height:650},
        animations:"disabled"});
      if(fs.statSync(detail).size<45000)
        throw Error("Detail WebGL capture is blank");
    }
    console.log(job.name+" real 3D screenshot "+bytes+" bytes");
  }
  // Validate visible ecological actions and the irreversible extinction rule.
  const after=await page.evaluate(()=>{
    const g=window.__wildhavenTestScene;
    const first=g.eat("ferrunco"),second=g.eat("dunlingua"),third=g.eat("pica_termita");
    const feeding=g.snapshots;
    g.empty("dunlingua");
    g.grow(60);
    const extinct=g.snapshots.find(x=>x.id==="dunlingua");
    return {consumed:[first,second,third],feeding,extinct};
  });
  if(after.consumed[0]!==340||after.consumed[1]!==210||after.consumed[2]!==60)
    throw Error("Wrong physical feeding amounts: "+JSON.stringify(after.consumed));
  if(after.extinct.population!==0||!after.extinct.extinct)
    throw Error("Extinct mound revived during simulated 60 days");
  fs.writeFileSync(path.join(previewDir,"feeding-scene-validation-v02.json"),
    JSON.stringify({assetSource:"genuine Three.js models",
      sceneType:"isolated biome validation, not playable Alpha",
      baseline:start,feeding:after.feeding,extinction:after.extinct,
      screenshots:[...jobs.map(j=>j.file),"feeding-scenes-detail-real-3d-v02.png"]},null,2)+"\n");
  console.log(JSON.stringify({checked:3,consumed:after.consumed,
    extinctAfter60Days:after.extinct,errors},null,2));
} finally {
  await browser?.close();server.kill("SIGTERM");
}
