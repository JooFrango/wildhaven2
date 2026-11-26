import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const host = "127.0.0.1", port = 5477;
const url = `http://${host}:${port}/creatures.html`;
const target = path.resolve("../detritivoros/detritivoros-real-3d.png");
fs.mkdirSync(path.dirname(target), { recursive: true });
const server = spawn(process.execPath,
  ["./node_modules/vite/bin/vite.js","--host",host,"--port",String(port),"--strictPort"],
  { stdio:["ignore","pipe","pipe"] });
let startup = "";
server.stdout.on("data",d=>startup+=d.toString());
server.stderr.on("data",d=>startup+=d.toString());
async function ready() {
  for(let i=0;i<100;i++) {
    if(server.exitCode !== null) throw Error(startup);
    try { const r=await fetch(url); if(r.ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw Error("Vite did not start: "+startup);
}
let browser;
try {
  await ready();
  browser=await chromium.launch({ headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle",
      "--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl"] });
  const page=await browser.newPage({viewport:{width:1500,height:870},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",err=>errors.push(String(err)));
  let bytes=0;
  for(let i=0;i<5;i++) {
    await page.goto(url,{waitUntil:"networkidle",timeout:45000});
    await page.waitForTimeout(1100+i*400);
    await page.evaluate(()=>{
      document.querySelector("header")?.remove();
      document.querySelector(".actions")?.remove();
      document.querySelector(".labels")?.remove();
    });
    await page.waitForTimeout(500);
    await page.locator("#preview").screenshot({path:target});
    bytes=fs.statSync(target).size;
    if(errors.length) throw Error(errors.join("; "));
    if(bytes>25000) break;
    console.warn("Retrying blank Three.js frame",i+1,"bytes",bytes);
  }
  if(bytes<=25000) {
    fs.unlinkSync(target);
    throw Error("Blank screenshot after attempts: "+bytes);
  }
  console.log(JSON.stringify({target,bytes,source:"Three.js/WebGL real 3D geometry"}));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
