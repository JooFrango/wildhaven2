// IA PvE v01 (módulo da IA, seção 11 do contrato): a simulação lê tempo, lâmina, janelas e esquiva de trajetorias-pve1.js.
// O que estes testes provam é técnico (taxas, janelas, deslocamento, regressão). Não provam aprovação artística.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {LAB,cenarioDuelo,mundoDuelo,doisHunters} from './ajudantes.mjs';
import {criarMundoHunters,passoHunters} from '../src/mundo-hunters.js';
import {usarPve1,trajetoriaPve1,clipePve1,interrupcaoAberta,amostrarArma} from '../src/trajetoria-arma.js';
import {combatAnimation} from '../src/animacao-jogador.js';
import {menteJogador,decidirComoJogador,escolherSequencia,esquivarParaFlanco,apararComLamina,podeInterromper,moverEsquivasPve1,estilo,observarMovimento} from '../src/combate-jogador.js';

// Impressão digital do laboratório com o interruptor DESLIGADO, medida em add9d7f (antes da IA PvE) por
// scripts/regressao-pve1.mjs: duelos PvP v12 (sementes 7/17/23), arena, jogador-espada/lanca/montante e arena-aparo.
const IMPRESSAO_ANTES='6c3fe698e65e90d27e40acf26f12dee14fbfb8d890cab21c627130ef3605833b';

const lj=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
async function jogadorEspada(semente){
 const cen=(await lj('../config/cenarios.json')).find(c=>c.id==='jogador-espada');
 cen.terreno.dados=await lj('../../hunters-codex/assets/terrain-nav.json');cen.geometriaPrecisa=await lj('../../hunters-codex/assets/terrain-geometry.json');
 return criarMundoHunters({...LAB.cfg,cenarios:{...LAB.cfg.cenarios,[cen.id]:cen}},cen,semente,{fichaHunter:LAB.fichaHunter,equipamentos:LAB.equipamentos});
}
const comPve=async f=>{usarPve1(true);try{return await f();}finally{usarPve1(false);}};

test('regressão: com o interruptor PvE desligado o laboratório dá o mesmo resultado de antes (PvP v12, arena, jogador-*)',()=>{
 const saida=execFileSync(process.execPath,[new URL('../scripts/regressao-pve1.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8'});
 assert.equal(saida.match(/sha256 (\w+)/)[1],IMPRESSAO_ANTES);
});

test('tempo vem do clipe: leve e pesado têm preparo e duração exatos de trajetorias-pve1.js, sem acelerar',()=>comPve(()=>{
 const c=cenarioDuelo('pve-tempo',doisHunters({arma:'espada'},{arma:'espada'},{dist:1.2})),m=mundoDuelo(c,17),[a,b]=m.hunters;
 assert.equal(estilo(a).pve,true);
 const contato={id:b.id,especie:'hunter',via:'visao',x:b.x,y:b.y,direcao:b.direcao,velocidade:0,signal:'caido',human:true,distancia:1.2,body:{r:.26,half:0,center:0,height:1.75}};
 a.hunter.habilidade=.95;a.hunter.personalidade.agressividade=.9;
 decidirComoJogador(a,contato,b,m);
 assert.ok(a.golpe,'o Hunter não iniciou golpe com o rival caído');
 const ac=a.hunter.action,tab=trajetoriaPve1(ac.clip);
 assert.equal(ac.clip,clipePve1(ac.name));
 assert.ok(Math.abs(ac.impact-ac.start-tab.impact)<1e-9,`preparo ${ac.impact-ac.start} contra clipe ${tab.impact}`);
 assert.ok(Math.abs(ac.end-ac.start-tab.duration)<1e-9,`duração ${ac.end-ac.start} contra clipe ${tab.duration}`);
 const o=combatAnimation(a,m.t+.01);assert.equal(o.impact,ac.impact-ac.start);assert.equal(o.duration,ac.end-ac.start);
 // O pesado (rival caído abre a janela) usa o clipe pesado, e a cadeia da espada fica em dois golpes (sem "finish" no lote 1).
 assert.equal(estilo(a).chain,2);
}));

test('regra de escolha do clipe é a de remapPve1: heavy/finish -> pesado, o resto -> leve',()=>{
 for(const [n,e] of [['sword_light','pve1_c_sword_light'],['sword_follow','pve1_c_sword_light'],['sword_heavy','pve1_c_sword_heavy'],['sword_finish','pve1_c_sword_heavy'],['sword_heavy_high','pve1_c_sword_heavy']])assert.equal(clipePve1(n),e,n);
});

test('lâmina e contato vêm do quadro do clipe: janela ativa autorada, ponta no alcance do clipe',()=>comPve(()=>{
 const tab=trajetoriaPve1('pve1_c_sword_light'),ac={name:'sword_light',start:0,impact:tab.impact,end:tab.duration,reach:1.05};
 const em=t=>amostrarArma(ac,t,{arma:'espada',altura:1.75});
 assert.equal(em(tab.phases.activeStart-.02).active,false);assert.equal(em(tab.impact).active,true);assert.equal(em(tab.phases.activeEnd+.02).active,false);
 const q=tab.frames[Math.round(tab.impact*60)],s=em(tab.impact);
 for(let i=0;i<3;i++)assert.ok(Math.abs(s.grip[i]-q[i]*1.75)<2e-3,'punho fora do quadro do clipe');
 const n=Math.hypot(q[3],q[4],q[5]),L=Math.hypot(...s.tip.map((v,i)=>v-s.grip[i]));
 for(let i=0;i<3;i++)assert.ok(Math.abs((s.tip[i]-s.grip[i])/L-q[3+i]/n)<2e-3,'direção da lâmina fora do quadro do clipe');
}));

test('PvE em jogador-espada contra o Varrisco real: taxa de cada golpe em 0,90×–1,10× e contato dentro da janela ativa',()=>comPve(async()=>{
 const m=await jogadorEspada(17),a=m.hunters[0],golpes=new Map(),taxas=[];
 for(let i=0;i<1400&&!m.resultado;i++){
  passoHunters(m);
  const ac=a.hunter.action,o=combatAnimation(a,m.t);
  if(ac&&!golpes.has(ac.start))golpes.set(ac.start,ac);
  if(o.impact!=null&&/^sword_/.test(o.name)){const tab=trajetoriaPve1(clipePve1(o.name));taxas.push(o.time<=o.impact?tab.impact/Math.max(.01,o.impact):(tab.duration-tab.impact)/Math.max(.01,o.duration-o.impact));}
 }
 assert.ok(golpes.size>=8,'poucos golpes para medir: '+golpes.size);
 assert.ok(taxas.length>100);
 for(const r of taxas)assert.ok(r>=.9&&r<=1.1,'taxa fora do portão: '+r);
 const ferimentos=m.eventos.filter(e=>e.tipo==='ferimento'&&e.atacante===a.id);
 assert.ok(ferimentos.length>=5,'a lâmina autorada não acertou o Varrisco');
 for(const e of ferimentos){const ac=[...golpes.values()].filter(x=>x.impact<=e.t+1e-6).pop(),tab=trajetoriaPve1(ac.clip),rel=e.t-ac.start;
  assert.ok(rel>=tab.phases.activeStart-1e-9&&rel<=tab.phases.activeEnd+1e-9,`acerto fora da janela ativa: ${rel} em [${tab.phases.activeStart},${tab.phases.activeEnd}]`);}
 assert.deepEqual(m.eventos.filter(e=>e.tipo==='golpe_errou'&&e.id===a.id&&e.motivo==='trajetoria_nao_alcanca').length,0);
}));

test('interrupção só dentro das janelas do clipe: leve em [0,0.12] e [0.62,1.15]; pesado em [0,0.3] e [1.5,2.0]',()=>comPve(()=>{
 assert.equal(interrupcaoAberta('pve1_c_sword_light',.30,'dodge'),false);
 assert.equal(interrupcaoAberta('pve1_c_sword_light',.70,'dodge'),true);
 assert.equal(interrupcaoAberta('pve1_c_sword_light',.70,'block'),true);
 assert.equal(interrupcaoAberta('pve1_c_sword_heavy',1.0,'block'),false);
 assert.equal(interrupcaoAberta('pve1_c_sword_heavy',1.6,'block'),true);
 assert.equal(interrupcaoAberta('pve1_c_sword_heavy',1.6,'heavy'),false,'o pesado não declara janela para outro pesado');
 const ac={clip:'pve1_c_sword_heavy',start:10,cancelAfter:11.5};
 assert.equal(podeInterromper(ac,11.0,'dodge'),false);assert.equal(podeInterromper(ac,11.6,'dodge'),true);
 // Integração: o cancelAfter de um golpe real começa na primeira janela pós-contato (leve 0,62 s; pesado 1,50 s).
 const c=cenarioDuelo('pve-janela',doisHunters({arma:'espada'},{arma:'espada'},{dist:1.2})),m=mundoDuelo(c,17),[a,b]=m.hunters;
 const contato={id:b.id,especie:'hunter',via:'visao',x:b.x,y:b.y,direcao:b.direcao,velocidade:0,signal:'caido',human:true,distancia:1.2,body:{r:.26,half:0,center:0,height:1.75}};
 a.hunter.habilidade=.95;decidirComoJogador(a,contato,b,m);const x=a.hunter.action;
 assert.ok(Math.abs(x.cancelAfter-x.start-(x.clip.endsWith('heavy')?1.5:.62))<1e-9);
}));

// Hunter sozinho num mundo vazio e um sinal de preparo de investida vindo de frente: isola a esquiva do resto da luta.
function esquivaIsolada(extra={}){
 const c=cenarioDuelo('pve-esquiva',[{id:'hunter-A',nome:'A',equipe:'azul',x:60,y:50,direcaoGraus:0,equipamento:{arma:'espada'}}],extra),m=mundoDuelo(c,17),a=m.hunters[0];
 a.x=60;a.y=50;a.hunter.habilidade=.9;menteJogador(a).reading={restante:.5};
 const contato={id:'varrisco-1',especie:'varrisco',via:'visao',x:62.6,y:50,direcao:Math.PI,velocidade:0,signal:'preparo',human:false,distancia:2.6,body:{r:.5,half:1,center:0,height:1.5},tell:{key:'k',name:'bote',kind:'investida',heading:Math.PI,reach:2,progress:.1}};
 return{m,a,contato};
}
test('esquiva PvE: a IA escolhe o lado, dura 1,00 s e o corpo percorre a curva do clipe escalada pela altura',()=>comPve(()=>{
 const{m,a,contato}=esquivaIsolada(),e0=a.energia,x0={x:a.x,y:a.y};
 assert.equal(esquivarParaFlanco(a,contato,m),true);
 const esq=a.hunter.esquivaPve,tab=trajetoriaPve1('pve1_b_sword_dodge_'+esq.lado),inicio=m.t;
 assert.ok(['left','right'].includes(esq.lado));assert.equal(esq.clip,'pve1_b_sword_dodge_'+esq.lado);
 assert.ok(Math.abs(esq.fim-esq.inicio-tab.duration)<1e-9);assert.equal(esq.fim-esq.inicio,1);assert.ok(Math.abs(a.hunter.dodgeUntil-inicio-1)<1e-9);
 assert.ok(a.energia<e0);assert.equal(a.impulso??null,null,'a esquiva PvE não usa o impulso do núcleo');
 // O lado exposto à animação e o movimento do corpo batem (+X local = esquerda = direcao − 90°).
 const o=combatAnimation(a,m.t);assert.equal(o.name,'combat_dodge');assert.equal(o.lado,esq.lado);assert.equal(o.duracao,1);
 const escala=a.especie.corpo.alturaM*a.escala/1.70,curva=t=>{const x=Math.min(60,t*60),k=Math.floor(x),cv=tab.rootMotion.curve;return Math.abs(cv[k]+(cv[Math.min(60,k+1)]-cv[k])*(x-k));};
 const dirLado=esq.lado==='left'?-Math.PI/2:Math.PI/2;
 for(let n=1;n<=24;n++){
  passoHunters(m);
  const t=m.t-inicio,d=Math.hypot(a.x-x0.x,a.y-x0.y);
  if(t>.2&&t<1.0)assert.ok(Math.abs(d-curva(t)*escala)<.06,`em ${t.toFixed(2)} s o corpo está a ${d.toFixed(3)} m e a curva diz ${(curva(t)*escala).toFixed(3)} m`);
 }
 const ang=Math.atan2(a.y-x0.y,a.x-x0.x)-a.direcao,rel=Math.atan2(Math.sin(ang),Math.cos(ang));
 assert.ok(Math.abs(rel-dirLado)<.1,'o corpo andou para o lado oposto ao escolhido: '+rel);
 assert.ok(Math.abs(Math.hypot(a.x-x0.x,a.y-x0.y)-1.2*escala)<.08,'deslocamento total');
 assert.equal(a.hunter.esquivaPve??null,null);
}));

test('esquiva PvE respeita terreno: sem espaço dos dois lados a IA não esquiva; ferida na perna encurta a esquiva; sem tempo, não esquiva',()=>comPve(()=>{
 const{m,a,contato}=esquivaIsolada({terreno:{tipo:'procedural',largura:120,profundidade:100,res:1,amplitude:.2,capim:40,rochas:[{x:60,y:47.2,raio:1.8},{x:60,y:52.8,raio:1.8}]}});
 assert.equal(esquivarParaFlanco(a,contato,m),false,'esquivou para dentro de rocha');assert.equal(a.hunter.esquivaPve??null,null);
 const b=esquivaIsolada();b.a.saude.ferimentos.push({regiao:'pernas',gravidade:.5,fratura:false,sangramento:0});
 assert.equal(esquivarParaFlanco(b.a,b.contato,b.m),true);assert.ok(b.a.hunter.esquivaPve.escala<1.75/1.70*.7,'a perna ferida não reduziu a esquiva: '+b.a.hunter.esquivaPve.escala);
 const c=esquivaIsolada();menteJogador(c.a).reading={restante:.10};
 assert.equal(esquivarParaFlanco(c.a,c.contato,c.m),false,'esquivou sem tempo de sair da linha do golpe');
}));

test('bloqueio PvE segura na pose de 0,30 s: a guarda sobe pelo tempo do clipe, não em 0,12 s',()=>comPve(()=>{
 const c=cenarioDuelo('pve-bloqueio',doisHunters({arma:'espada'},{arma:'espada'},{dist:1.5})),m=mundoDuelo(c,17),[a,b]=m.hunters;
 const contato={id:b.id,especie:'hunter',via:'visao',x:b.x,y:b.y,direcao:b.direcao,velocidade:0,signal:'preparo',human:true,distancia:1.5,body:{r:.26,half:0,center:0,height:1.75},tell:{key:'g',name:'sword_light',kind:'golpe',heading:Math.PI,reach:1,height:1.2,linha:0,progress:.1}};
 const leitura={skill:.9};
 assert.equal(apararComLamina(a,contato,m,leitura),true);
 const g=a.hunter.guarda;assert.ok(Math.abs(g.impact-g.start-.30)<1e-9);
 const meio=amostrarArma({...g,name:'sword_block'},g.start+.15,{arma:'espada',altura:1.75}),fim=amostrarArma({...g,name:'sword_block'},g.start+.30,{arma:'espada',altura:1.75}),ini=amostrarArma({...g,name:'sword_block'},g.start,{arma:'espada',altura:1.75});
 const dist=(p,q)=>Math.hypot(...p.grip.map((v,i)=>v-q.grip[i]));assert.ok(dist(meio,ini)>.05&&dist(meio,ini)<dist(fim,ini)*.9,'a guarda chegou à pose cedo demais');
 assert.deepEqual(combatAnimation(a,m.t),{name:'combat_block',time:.35,oneShot:true});   // o renderizador PvE a prende na pose de 0,30 s (remapPve1)
}));

test('com o interruptor desligado a esquiva e o golpe continuam sendo os do núcleo (impulso, 0,50 s, tempo antigo)',()=>{
 const{m,a,contato}=esquivaIsolada();
 assert.equal(estilo(a).light,.29);assert.equal(estilo(a).pve,undefined);
 assert.equal(esquivarParaFlanco(a,contato,m),true);assert.ok(a.impulso&&a.impulso.tipo==='esquiva');assert.equal(a.hunter.esquivaPve??null,null);assert.ok(Math.abs(a.hunter.dodgeUntil-m.t-.5)<1e-9);
 assert.equal(combatAnimation(a,m.t+.1).lado,undefined);
});
