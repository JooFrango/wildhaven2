import {chromium} from 'playwright-core';
import fs from 'node:fs';
import {server} from './serve.mjs';
const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL??'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:920},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error(e));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>typeof window.review==='function',null,{timeout:150000});
 await page.addStyleTag({content:'nav{display:none}'});
 fs.mkdirSync('review',{recursive:true});const metrics=[];
 for(const view of ['air','edge','hunter','island'])for(const mode of ['before','after']){
  await page.evaluate(([m,v])=>window.review(m,v),[mode,view]);
  await page.evaluate(()=>new Promise(resolve=>{let n=0;function tick(){if(++n===6)resolve();else requestAnimationFrame(tick);}tick();}));
  metrics.push({view,mode,...await page.evaluate(([m,v])=>window.review(m,v),[mode,view])});
  await page.locator('canvas').screenshot({path:'review/'+view+'-'+mode+'.jpg',type:'jpeg',quality:91,timeout:120000});
 }
 fs.writeFileSync('review/render.json',JSON.stringify(metrics,null,2));console.table(metrics);
}finally{await browser.close();server.close();}