import test from 'node:test';import assert from 'node:assert/strict';
import {criarApresentacao} from '../src/apresentacao-combate.js';
const actor=(id,x,hunter=true)=>({id,x,y:10,z:2,vivo:true,velocidade:0,energia:100,hunter:hunter?{alvoId:'beast',action:null}:null,especie:{corpo:{comprimentoM:hunter?.45:2.9}}});
const world=()=>{const a=actor('hunter',10),b=actor('beast',14,false);return{t:0,tick:0,terreno:{largura:100,profundidade:100},animais:[a,b],hunters:[a],porId:new Map([[a.id,a],[b.id,b]]),eventos:[]};};
const event=(m,tipo,more={})=>{m.t+=.05;m.tick++;m.eventos.push({n:m.eventos.length+1,t:m.t,tipo,id:'hunter',alvo:'beast',...more});};
const vector=(x=0,y=0,z=0)=>({x,y,z});
function cameraFixture(){return{camera:{position:vector(-10,15,-8),lookAt(){}},orbit:{target:vector(),enabled:true}};}
function fakeAudio(){
 const ctx={state:'running',currentTime:0,sampleRate:8000,destination:{},starts:0,stops:0,closed:false};
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}}),node=()=>({connect(){},disconnect(){}});
 ctx.createGain=()=>({...node(),gain:param()});ctx.createBiquadFilter=()=>({...node(),frequency:param(),Q:param()});ctx.createStereoPanner=()=>({...node(),pan:param()});
 const source=()=>({...node(),start(){ctx.starts++;},stop(){ctx.stops++;},frequency:param()});ctx.createOscillator=source;ctx.createBufferSource=source;ctx.createBuffer=(n,len)=>({getChannelData:()=>new Float32Array(len)});ctx.close=()=>{ctx.closed=true;ctx.state='closed';};return ctx;
}
test('apresentação deduplica impacto e ferimento do mesmo contato sem alterar o mundo',()=>{
 const m=world(),p=criarApresentacao();p.update(m,.016,{sons:true});event(m,'ferimento',{id:'beast',atacante:'hunter',dano:20});m.eventos.push({n:2,t:m.t,tipo:'impacto_arma',id:'hunter',alvo:'beast',intensidade:.7,pesado:true,x:13,y:10,z:3});const before=JSON.stringify(m);
 p.update(m,.016,{sons:true});assert.equal(p.stats().impactos,1);assert.equal(p.stats().sons,1);assert.ok(p.stats().particles>0);p.update(m,.016,{sons:true});assert.equal(p.stats().impactos,1);assert.equal(JSON.stringify(m),before);p.dispose();
});
test('pausa não repete passos, respiração ou eventos; retomar processa uma vez',()=>{
 const m=world(),p=criarApresentacao();p.update(m,.016,{sons:true});m.hunters[0].velocidade=3;m.hunters[0].x+=1;event(m,'ataque_inicio');p.update(m,.016,{sons:true});const counts=p.stats();for(let i=0;i<30;i++)p.update(m,.016,{sons:true});assert.equal(p.stats().sons,counts.sons);assert.equal(p.stats().events,counts.events);event(m,'golpe_errou');p.update(m,.016,{sons:true});assert.equal(p.stats().events,2);p.dispose();
});
test('trocar cenário ou restaurar estado não reproduz eventos históricos',()=>{
 const a=world(),p=criarApresentacao();p.update(a,.016,{sons:true});event(a,'impacto_arma',{intensidade:.9,pesado:true});p.update(a,.016,{sons:true});const n=p.stats().sons,b=world();event(b,'impacto_arma',{intensidade:.9,pesado:true});p.update(b,.016,{sons:true});assert.equal(p.stats().sons,n);event(b,'golpe_errou');p.update(b,.016,{sons:true});assert.equal(p.stats().sons,n+1);b.t=0;p.update(b,.016,{sons:true});assert.equal(p.stats().sons,n+1);p.dispose();
});
test('som desligado não cria AudioContext, fontes ou ruído contínuo',()=>{
 let contexts=0;const m=world(),p=criarApresentacao({audioFactory:()=>{contexts++;return fakeAudio();}});p.update(m,.016);event(m,'impacto_arma',{intensidade:1,pesado:true});p.update(m,.016,{sons:false,efeitos:false});assert.equal(contexts,0);assert.equal(p.stats().sons,0);assert.equal(p.stats().particles,0);p.dispose();
});
test('áudio é desbloqueado explicitamente, limitado e liberado ao descartar',async()=>{
 const audio=fakeAudio(),m=world(),p=criarApresentacao({audioFactory:()=>audio});p.update(m,.016);event(m,'impacto_arma',{intensidade:.8,pesado:true});p.update(m,.016,{sons:true});assert.equal(audio.starts,0);assert.equal(await p.unlockAudio(),true);event(m,'golpe_errou');p.update(m,.016,{sons:true});assert.ok(audio.starts>0);const started=audio.starts;for(let i=0;i<40;i++){event(m,'ataque_inicio');p.update(m,.016,{sons:true});}assert.ok(p.stats().voices<=10);assert.ok(audio.starts>=started);p.dispose();assert.equal(audio.closed,true);assert.equal(p.stats().voices,0);assert.ok(audio.stops>0);
});
test('câmera opcional enquadra o par com deslocamento limitado e não altera estado físico',()=>{
 const m=world(),f=cameraFixture(),p=criarApresentacao(f),initial={...f.camera.position};p.update(m,.016,{cinematica:false});event(m,'impacto_arma',{intensidade:1,pesado:true});const before=JSON.stringify(m);p.update(m,.016,{cinematica:false});assert.deepEqual(f.camera.position,initial);p.update(m,.016,{cinematica:true,selected:'hunter'});assert.equal(f.orbit.enabled,false);assert.ok(Number.isFinite(f.camera.position.x));const displacement=Math.hypot(f.camera.position.x-initial.x,f.camera.position.y-initial.y,f.camera.position.z-initial.z);assert.ok(displacement<4);assert.equal(JSON.stringify(m),before);p.update(m,.016,{cinematica:false});assert.equal(f.orbit.enabled,true);p.dispose();
});
test('feedback proporcional conserva contraste entre golpe leve e pesado',()=>{
 const m=world(),p=criarApresentacao();p.update(m,.016,{sons:true});event(m,'impacto_arma',{intensidade:.2,pesado:false});p.update(m,.016,{sons:true});event(m,'impacto_arma',{intensidade:.9,pesado:true});p.update(m,.016,{sons:true});const q=p.stats().lastCues;assert.ok(q[1].intensity>q[0].intensity);assert.equal(q[0].heavy,false);assert.equal(q[1].heavy,true);p.dispose();
});
test('trilhas usam a trajetória fornecida sem tocar na ação autoritativa',()=>{
 const m=world(),p=criarApresentacao({trajetoria:a=>({active:true,tip:{x:a.x+1,y:a.y,z:a.z+1}})});p.update(m,.016);m.t=.05;m.hunters[0].x+=.2;p.update(m,.016);const before=JSON.stringify(m);m.t=.1;p.update(m,.016);assert.ok(p.stats().trails>0);const state=JSON.parse(before);assert.deepEqual(m.hunters[0].hunter,state.hunters[0].hunter);p.dispose();
});

test('impactos distantes não sacodem a câmera nem produzem som/partículas locais',()=>{
 const m=world(),p=criarApresentacao();p.update(m,.016,{sons:true});event(m,'impacto_arma',{intensidade:1,pesado:true,x:900,y:900,z:2});p.update(m,.016,{sons:true});assert.equal(p.stats().sons,0);assert.equal(p.stats().particles,0);p.dispose();
});
