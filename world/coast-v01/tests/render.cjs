// Capture the reloaded GLBs using the continental viewer and Alpha GLTFLoader builds.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const {mkdirSync,readFileSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..');
(async()=>{
    const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL||'msedge',headless:true,
        args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const checks=[];
    try {
        for(const {id:tipo,model} of JSON.parse(readFileSync(resolve(root,'prototipos.json'))).tiles){
            for(const alpha of [false,true]){
                const page=await browser.newPage({viewport:{width:1140,height:710}});
                const errors=[];
                const bytes=page.waitForResponse(r=>r.url().endsWith('/'+model)).then(r=>r.body());
                page.on('pageerror',e=>errors.push(e.message));
                page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
                await page.goto('http://127.0.0.1:8816/?foto&tipo='+tipo+(alpha?'&alpha':''),{timeout:90000});
                await page.waitForFunction(()=>window.coastLoaded,null,{timeout:90000});
                const stats=await page.evaluate(()=>window.coastLoaded);
                if(!stats.complete)throw Error('Entorno incompleto em '+tipo);
                if(!alpha && model.endsWith('-v02.glb')){
                    const dest=resolve(root,'preview',tipo+'-v02');mkdirSync(dest,{recursive:true});
                    for(const view of ['perspectiva','superior','mar','encaixe']){
                        await page.evaluate(v=>window.setCoastView(v),view);
                        await page.locator('canvas').screenshot({path:resolve(dest,view+'.jpg'),quality:91});
                    }
                }
                if(errors.length)throw Error(errors.join('\n'));
                checks.push({...stats,sha256:createHash('sha256').update(await bytes).digest('hex'),loader:alpha?'alpha':'continental',errors});
                console.log(tipo,checks.at(-1).loader,stats.revision);
                await page.close();
            }
        }
        writeFileSync(resolve(root,'tests/loaders.json'),JSON.stringify(checks,null,2)+'\n');
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
