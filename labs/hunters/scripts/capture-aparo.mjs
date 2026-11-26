/** Grava o duelo 1×1 espada contra espada na Arena dos Caçadores, com os GLBs reais do laboratório.
 * Dois ângulos (perfil e três-quartos), vídeo real do canvas + PNGs no instante em que as lâminas se encontram.
 * Uso: node scripts/capture-aparo.mjs [--chrome <caminho>] [--semente 17] [--segundos 26] [--pvp12]
 * --pvp12 roda o mesmo duelo com a biblioteca de animações PvP v12 e grava em resultados/pvp-v12-duelo/.
 */
import {chromium} from '../../hunters-codex/node_modules/playwright-core/index.mjs';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {extname,join,normalize} from 'node:path';

const arg=(nome,padrao)=>{const i=process.argv.indexOf(nome);return i>0?process.argv[i+1]:padrao;};
const SEMENTE=arg('--semente','17'),SEGUNDOS=Number(arg('--segundos','26')),PVP12=process.argv.includes('--pvp12');
const RAIZ=fileURLToPath(new URL('../../..',import.meta.url));
const OUT=new URL(PVP12?'../resultados/pvp-v12-duelo/':'../resultados/pvp-aparo/',import.meta.url);await mkdir(OUT,{recursive:true});
// Limpa a pasta: os arquivos entregues têm de ser os desta gravação, não restos de uma anterior.
for(const f of await readdir(OUT))await rm(new URL(f,OUT));
const TIPOS={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png','.css':'text/css'};
// A página resolve os assets sob /repo, como o servidor do laboratório: aceita com e sem o prefixo.
const server=createServer(async(req,res)=>{const caminho=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/repo(?=\/|$)/,'');
 const p=normalize(join(RAIZ,caminho));
 if(req.url.startsWith('/favicon')){res.writeHead(204).end();return;}
 if(!p.startsWith(RAIZ)){res.writeHead(403).end();return;}
 try{const b=await readFile(p);res.writeHead(200,{'content-type':TIPOS[extname(p)]??'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:arg('--chrome',process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const sha=x=>createHash('sha256').update(x).digest('hex');
const ANGULOS={perfil:Math.PI/2,threequarter:2.3561944901923448};
const relatorios=[];
try{
 for(const [nome,azimute] of Object.entries(ANGULOS)){
  const page=await browser.newPage({viewport:{width:1100,height:800}}),erros=[];
  page.on('pageerror',e=>erros.push(e.stack));page.on('console',m=>{if(m.type()==='error')erros.push(m.text())});
  await page.goto(`${base}/labs/hunters/hunter-lab.html?cenario=arena-aparo&semente=${SEMENTE}${PVP12?'&pvp12=1':''}`,{timeout:120000,waitUntil:'load'});
  await page.waitForFunction(()=>window.hunterLab?.mundo&&window.hunterLab.modelosCarregados().length>0,null,{timeout:120000});
  if(await page.locator('#marcadores').evaluate(e=>e.classList.contains('ativo')))await page.locator('#marcadores').click();
  const resultado=await page.evaluate(async ([azimute,segundos,angulo])=>{
   const api=hunterLab,canvas=document.querySelector('#palco canvas'),out=document.createElement('canvas');
   out.width=900;out.height=650;const ctx=out.getContext('2d'),stream=out.captureStream(20),pedacos=[];
   const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1400000});
   rec.ondataavailable=e=>{if(e.data.size)pedacos.push(e.data)};const fim=new Promise(r=>rec.onstop=r);rec.start();
   const quadros={},clipes=new Set(),vistos=new Set();const aparos=[],ordem=[],sequencia={};
   const desenhar=rotulo=>{ctx.drawImage(canvas,0,0,900,650);ctx.fillStyle='#15272bea';ctx.fillRect(0,0,900,46);ctx.fillRect(0,600,900,50);
    ctx.fillStyle='#eed8a1';ctx.font='17px sans-serif';ctx.fillText('ARENA DOS CAÇADORES / HUNTER × HUNTER / ESPADA × ESPADA / GLB REAL / '+angulo.toUpperCase(),16,29);
    ctx.font='15px sans-serif';ctx.fillText(rotulo,16,631);};
   while(api.mundo.t<segundos&&!api.mundo.resultado){
    api.enquadrar(60,50,8,azimute);
    api.avancar(api.mundo.dt);
    await new Promise(requestAnimationFrame);
    const a=api.mundo.hunters[0],b=api.mundo.hunters[1];
    const cl=api.clipes();for(const v of cl)clipes.add(v.clip);
   for(const v of cl){const ult=sequencia[v.id];if(ult!==v.clip){sequencia[v.id]=v.clip;ordem.push({id:v.id,clip:v.clip,t:+api.mundo.t.toFixed(2)});}}
    const estado=id=>{const h=api.mundo.porId.get(id);return h?`${h.hunter.nome} ${h.hunter.postura}${h.hunter.guarda&&h.hunter.blockUntil>api.mundo.t?'/guarda':''}`:id;};
    desenhar(`${api.mundo.t.toFixed(2)} s · ${estado(a.id)} · ${estado(b.id)} · clipes: ${cl.map(v=>v.clip).join(' | ')}`);
    // Quadro exatamente no encontro das lâminas: o hitstop mantém o contato visível no próximo quadro.
    for(const e of api.mundo.eventos){
     if(e.tipo!=='golpe_interrompido'||e.motivo!=='aparo_lamina'||vistos.has(e.n))continue;
     vistos.add(e.n);
     // Empunhadura no instante do aparo: prova de que a lâmina desenhada está na mão dos dois Hunters.
     aparos.push({n:e.n,t:e.t,atacante:e.id,defensor:e.alvo,x:e.x,y:e.y,z:e.z,
      empunhadura:[e.id,e.alvo].map(id=>({id,...api.medirEmpunhadura(id)}))});
     if(Object.keys(quadros).length<4){
      api.enquadrar(60,50,3.4,azimute);await new Promise(requestAnimationFrame);   // aproxima no aparo: a revisão visual precisa ver a mão, o punho e as duas lâminas
      desenhar(`APARO ${aparos.length} · t=${e.t.toFixed(2)} s · ${e.id} aparado por ${e.alvo} · contato (${e.x.toFixed(2)}, ${e.y.toFixed(2)}, ${e.z.toFixed(2)})`);
      quadros[`aparo${aparos.length}_t${e.t.toFixed(2).replace('.','_')}`]=out.toDataURL('image/png').split(',')[1];
     }
    }
   }
   const desfecho=api.resultado();
   desenhar(desfecho?`DESFECHO: ${desfecho.motivo}`:`AMOSTRA DE ${segundos} s SIMULADOS, sem desfecho`);
   await new Promise(r=>setTimeout(r,400));rec.stop();await fim;stream.getTracks().forEach(t=>t.stop());
   const bytes=new Uint8Array(await new Blob(pedacos).arrayBuffer());let cru='';
   for(let i=0;i<bytes.length;i+=32768)cru+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return{base64:btoa(cru),quadros,aparos,desfecho,segundos:api.mundo.t,clipes:[...clipes],ordem,
    invariantes:api.invariantes(),estado:api.estado(),hash:api.hash(),
    empunhadura:api.mundo.hunters.map(h=>({id:h.id,...api.medirEmpunhadura(h.id)})),quadro:api.medirQuadro()};
  },[azimute,SEGUNDOS,nome]);
  const {base64,quadros,...relatorio}=resultado;
  const video=Buffer.from(base64,'base64');
  if(video.length<20000)throw Error(`vídeo ${nome} vazio: ${video.length} bytes`);
  await writeFile(new URL(`${PVP12?'duelo-pvp12':'duelo-aparo'}-${nome}.webm`,OUT),video);
  const pngs=[];
  for(const [k,png] of Object.entries(quadros)){const arquivo=`${nome}_${k}.png`;await writeFile(new URL(arquivo,OUT),Buffer.from(png,'base64'));pngs.push(arquivo);}
  if(erros.length)throw Error(`erros de página (${nome}): ${JSON.stringify(erros.slice(0,4))}`);
  if(relatorio.invariantes.length)throw Error(`invariantes violados: ${JSON.stringify(relatorio.invariantes)}`);
  if(!relatorio.aparos.length)throw Error(`nenhum aparo de lâmina em ${relatorio.segundos.toFixed(1)} s (${nome})`);
  if(PVP12){
   // Com a v12 ligada nenhum clipe da v05 pode aparecer: o duelo é desenhado só pela biblioteca nova.
   const velhos=relatorio.clipes.filter(c=>!c.startsWith('pvp12_'));
   if(velhos.length)throw Error(`clipes da v05 desenhados no duelo v12: ${velhos.join(', ')}`);
   for(const exigido of ['pvp12_guard','pvp12_sword_horizontal_cut','pvp12_sword_block'])
    if(!relatorio.clipes.includes(exigido))throw Error(`clipe ${exigido} nunca foi desenhado em ${nome}`);
  }
  relatorios.push({angulo:nome,azimute,video:`${PVP12?'duelo-pvp12':'duelo-aparo'}-${nome}.webm`,bytes:video.length,sha256:sha(video),pngs,...relatorio});
  console.log(JSON.stringify({angulo:nome,aparos:relatorio.aparos.length,segundos:+relatorio.segundos.toFixed(1),bytes:video.length,pngs:pngs.length}));
  await page.close();
 }
}finally{await browser.close();server.close();}
const GLB_REL=PVP12?'labs/hunters/assets/hunter-pvp-v12/hunter_pvp_v12.glb':'labs/hunters/assets/hunter-v05/hunter_combat_v05.glb';
const glb=await readFile(new URL('../../../'+GLB_REL,import.meta.url));
await writeFile(new URL('manifest.json',OUT),JSON.stringify({
 status:'gravado-do-laboratorio-real-aguardando-aprovacao',
 cenario:'arena-aparo (Arena dos Caçadores, 1×1 espada × espada, dt 0,05 s)',
 semente:Number(SEMENTE),
 glb:GLB_REL,glbSha256:sha(glb),
 biblioteca:PVP12?['pvp12_guard','pvp12_sword_horizontal_cut','pvp12_sword_block']:'clipes v05',
 renderizador:'hunter-lab.html em Chromium headless (ANGLE SwiftShader), GLBs reais do laboratório',
 observacao:'Lâmina, pose de guarda e teste estreito saem da mesma função (src/trajetoria-arma.js), então o contato desenhado é o contato simulado.',
 angulos:relatorios},null,2));
console.log('ok',relatorios.map(r=>`${r.angulo}:${r.aparos.length} aparos`).join(' '));
