const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path');
const out=__dirname;
(async()=>{
const b=await chromium.launch({channel:'msedge',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
try{
const page=await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8827/?cena=hunter');await page.waitForFunction(()=>window.WildhavenLoading?.state.ready);
await page.evaluate(()=>WildhavenLoading.restart());
const report=await page.evaluate(async()=>{
  const cv=document.querySelector('canvas'),stream=cv.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:650000});
  const chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
  const stopped=new Promise(r=>rec.onstop=r);rec.start();
  const start=performance.now(),initial=WildhavenLoading.state;
  const intervals=[], phases=new Set();let prev=start,maxPool=0,stationaryFrames=0,prevProgress=-1,oldFrame=-1;
  await new Promise(resolve=>{
    function sample(now){
      const s=WildhavenLoading.state;intervals.push(now-prev);prev=now;
      if(progress===prevProgress && indexNow()!==oldFrame)stationaryFrames++;
      function indexNow(){return Math.floor(time/.73*12)}
      phases.add(indexNow());oldFrame=indexNow();prevProgress=progress;maxPool=Math.max(maxPool,s.activeParticles);
      if(s.cycles-initial.cycles>=21)resolve();else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  rec.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
  const video=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks));});
  const duration=prev-start;intervals.shift();intervals.sort((a,b)=>a-b);
  return {video,cycles:WildhavenLoading.state.cycles-initial.cycles,observedAnimationFrames:phases.size,durationMs:duration,meanFPS:1000*(intervals.length+1)/duration,p95FrameMs:intervals[Math.floor(intervals.length*.95)],maxPool,stationaryFrames,impacts:WildhavenLoading.state.impacts,ua:navigator.userAgent};
});
fs.writeFileSync(path.join(out,'corrida.webm'),Buffer.from(report.video,'base64'));delete report.video;
await page.screenshot({path:path.join(out,'tela.png')});
await page.locator('#pause').click();const pre=await page.evaluate(()=>WildhavenLoading.state);await page.waitForTimeout(850);
const post=await page.evaluate(()=>WildhavenLoading.state);
if(pre.progress!==post.progress||post.cycles<=pre.cycles)throw Error('Pausa');
await page.locator('#restart').click();await page.locator('[data-speed="2"]').click();await page.waitForTimeout(300);
if(!await page.locator('[data-speed="2"]').evaluate(b=>b.getAttribute('aria-pressed')==='true'))throw Error('2x');
await page.locator('[data-speed="4"]').click();await page.waitForFunction(()=>WildhavenLoading.state.progress===1,null,{timeout:18000});
await page.evaluate(()=>{WildhavenLoading.setProgress(.37,'Texturas');WildhavenLoading.setProgress(null,'Preparando malhas')});await page.waitForTimeout(150);
if(await page.locator('#percent').innerText()!=='37%'||await page.locator('#stage').innerText()!=='Preparando malhas')throw Error('Integração');
await page.locator('#restart').click();await page.setViewportSize({width:375,height:700});await page.waitForTimeout(150);
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');
const sheet=await page.evaluate(()=>{
 const cv=document.createElement('canvas');cv.width=6*182;cv.height=2*66;
 const c=cv.getContext('2d');c.fillStyle='#cad0b1';c.fillRect(0,0,cv.width,cv.height);
 for(let i=0;i<12;i++){let x=(i%6)*182,y=Math.floor(i/6)*66;c.drawImage(art.varrisco,i*128,0,128,64,x,y,128,64);c.drawImage(art.hunter,i*52,0,52,50,x+128,y+14,52,50)}
 return cv.toDataURL().split(',')[1]
});
fs.writeFileSync(path.join(out,'quadros.png'),Buffer.from(sheet,'base64'));
const limbs=await page.evaluate(()=>{
  const range=(arr)=>Math.max(...arr)-Math.min(...arr);
  const h=motion.hunter,v=motion.varrisco;
  const hand=(k)=>range(h.map(p=>p[k][0]));
  const vRange=Object.fromEntries(['footL','footR','handL','handR','tailD'].map(k=>[k,Math.max(range(v.map(p=>p[k][0])),range(v.map(p=>p[k][1])))]));
  if(!(h[0].nearFoot[0]>24&&h[0].farFoot[0]<24&&h[6].nearFoot[0]<24&&h[6].farFoot[0]>24))throw Error('Passada');
  if(!(h[0].nearHand[0]<h[0].farHand[0]&&h[6].nearHand[0]>h[6].farHand[0]))throw Error('Braços');
  if(Object.values(vRange).some(n=>n<1))throw Error('Articulação imóvel');
  return {hunterHandSweepPx:[hand('nearHand'),hand('farHand')],varriscoRangePx:vRange,contactFrames:motion.contacts};
});
report.limbs=limbs;
if(errors.length||report.cycles<20||report.stationaryFrames<1||report.maxPool>32)throw Error(JSON.stringify(errors));
report.checks=['pausa da carga com animação ativa','reiniciar','velocidades 2× e 4×','100% no simulador','progresso externo e etapa indeterminada','375 px sem overflow'];report.errors=errors;
fs.writeFileSync(path.join(out,'medidas.json'),JSON.stringify(report,null,2));console.log(report);
}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
