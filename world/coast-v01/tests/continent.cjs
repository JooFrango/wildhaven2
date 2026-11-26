const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {resolve}=require('node:path');
const {mkdirSync,writeFileSync}=require('node:fs');
(async()=>{
 const root=resolve(__dirname,'..'),dest=resolve(root,'preview/continente');
 mkdirSync(dest,{recursive:true});
 const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],checks={};
 try{
  for(const alpha of [false,true]){
   const page=await browser.newPage({viewport:{width:1150,height:850}});
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto('http://127.0.0.1:8816/'+(alpha?'?tipo=glacial&alpha&foto':'viewer/continente.html?foto'));
   if(!alpha){
    await page.waitForFunction(()=>window.continentState?.().overview===274,null,{timeout:90000});
    await page.locator('canvas').screenshot({path:resolve(dest,'auralis.jpg'),quality:92});
    await page.evaluate(()=>document.querySelector('#mouth').click());
    await page.waitForFunction(()=>{const s=window.continentState();return s.full.includes(s.selected)&&!s.loading;},null,{timeout:90000});
    checks.estuary=await page.evaluate(()=>window.continentState());
    await page.locator('canvas').screenshot({path:resolve(dest,'foz.jpg'),quality:92});
   }else await page.waitForFunction(()=>window.coastLoaded?.complete,null,{timeout:90000});
   checks[alpha?'alpha':'continental']=await page.evaluate(async()=>{
    const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
    const catalog=await (await fetch('/viewer/continente/composition.json')).json();
    const loader=new GLTFLoader();let count=0;
    for(const r of catalog.tiles){
     const response=await fetch('/'+r.model);
     if(!response.ok)throw Error(r.model);
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength!==r.bytes)throw Error('Tamanho '+r.id);
     const scene=(await loader.parseAsync(bytes,'/')).scene;
     if(!scene.getObjectByName('terrain'))throw Error(r.id);
     scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}}});
     count++;
    }
    return count;
   });
   await page.close();
  }
 }finally{await browser.close();}
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync(resolve(__dirname,'continental-loaders.json'),JSON.stringify({...checks,errors},null,2)+'\n');console.log(checks);
})().catch(e=>{console.error(e);process.exitCode=1});
