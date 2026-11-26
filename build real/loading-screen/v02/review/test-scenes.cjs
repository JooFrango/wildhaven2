const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const b=await chromium.launch({channel:'msedge'}),p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
 try{
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8827/');
  await p.waitForFunction(()=>WildhavenLoading.state.ready);
  const draws=await p.evaluate(()=>{
   const hits=new Set();
   for(let i=0;i<100;i++){WildhavenLoading.restart();hits.add(WildhavenLoading.state.scene)}
   return [...hits].sort();
  });
  assert.deepEqual(draws,['dunas','hunter','savana']);
  for(const key of ['dunas','savana']){
   await p.goto('http://127.0.0.1:8827/?cena='+key);
   await p.waitForFunction(()=>WildhavenLoading.state.cycles>=20,null,{timeout:60000});
   const s=await p.evaluate(()=>WildhavenLoading.state);assert.equal(s.scene,key);assert.ok(s.impacts>50);assert.ok(s.progress>0);
   await p.screenshot({path:path.join(__dirname,key+'.png')});
   await p.locator('#pause').click();
   const before=await p.evaluate(()=>WildhavenLoading.state);
   await p.waitForFunction(c=>WildhavenLoading.state.cycles>=c+1,before.cycles);
   assert.equal((await p.evaluate(()=>WildhavenLoading.state)).progress,before.progress);
   console.log(key,s);
  }
  assert.deepEqual(errors,[]);
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
