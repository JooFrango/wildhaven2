import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMundoEco, passoEco, hashMundo } from '../src/eco/mundo.js';
import { salvarMundo, carregarMundo } from '../src/eco/persistencia.js';
import { sinalCombate } from '../src/eco/tatica.js';
import { ferir } from '../src/eco/saude.js';
import { mover } from '../src/eco/locomocao.js';
import { resolverGolpe, atualizarAgarroes, escolherAtaque } from '../src/eco/combate.js';
import {
  habilitada, padraoAdversario, observarAdversario, decidirTaticaAvancada,
  ataquePermitido, comboPodeAtacar, registrarResultadoGolpe, registrarComboExecutado,
  registrarEsquivaEfetiva, iniciarAgarraoAvancado, confrontoAgarraoAvancado,
  registrarFerimentoAvancado, registrarQuedaAvancada, recuperarQuedaAvancada, notaAtaqueAprendida, finalizarAgarraoAvancado,
} from '../src/eco/combate-avancado.js';
import { CFG, cenarioTeste, ev } from './eco-ajudantes.mjs';

const pred=(id,x,y,o={})=>({especie:'varrisco',individuos:[{id,x,y,direcaoGraus:id==='v'?0:180,energia:100,fome:85,sexo:'M',...o}]});
const prey=(id,x,y,o={})=>({especie:'velsari',individuos:[{id,x,y,direcaoGraus:0,energia:100,fome:10,sede:5,...o}]});
function setup(advanced=true,pop=[pred('v',55,55),pred('r',58,55)],seed=17) {
 const c=cenarioTeste('avancado-teste',pop,{amplitude:0,rochas:[]});
 const e=CFG.especies.varrisco;
 const customized={...e,combate:{...e.combate,iaAvancada:advanced}};
 const cfg={...CFG,especies:{...CFG.especies,varrisco:customized},
   cenarios:{...CFG.cenarios,[c.id]:c}};
 const world=criarMundoEco(cfg,c,seed);
 return {world, v:world.porId.get('v'),r:world.porId.get('r')??world.porId.get('p')};
}
function contact(a,b,signal='guarda') {
 return {id:b.id,especie:b.especie.id,via:'visao',x:b.x,y:b.y,
   direcao:b.direcao,velocidade:0,distancia:Math.hypot(a.x-b.x,a.y-b.y),
   signal,body:{r:b.especie.corpo.raio,half:.55,center:0},comportamento:'confrontando'};
}
const bands={body:1.15,ideal:2.4,tooClose:1.7,attackMax:3.6,threat:5.5,observe:7.5};
const decision={intent:{estado:'circulando'}};

test('finta v05: visível na percepção, não cria golpe nem dano e tem recuperação',()=>{
 const {world,v,r}=setup();
 world.t=10;v.tatica={started:0};
 assert.equal(habilitada(v),true);
 const hp=r.saude.hp;
 const i=decidirTaticaAvancada(v,contact(v,r),world,bands,'hunt',decision);
 assert.equal(i?.estado,'fintando');
 assert.equal(v.golpe,null,'sem hitbox');
 assert.equal(r.saude.hp,hp,'nenhum dano');
 assert.equal(v.taticaAvancada.visual.nome,'feint');
 assert.equal(sinalCombate(v,world.t+.2),'preparo');
 assert.equal(sinalCombate(v,world.t+.75),'recuperacao');
 assert.equal(ev(world,'tatico_finta','v').length,1);
 world.t=11.2;
 assert.notEqual(sinalCombate(v,world.t),'preparo','finta termina');
});

test('esquiva v05: direção deriva da preparação percebida, move o corpo e rejeita paredes',()=>{
 const {world,v,r}=setup();
 world.t=4;r.direcao=Math.PI;v.tatica={started:0};
 const c=contact(v,r,'preparo');
 const action=decidirTaticaAvancada(v,c,world,bands,'territory',decision);
 assert.equal(action?.estado,'esquivando');
 assert.ok(v.impulso&&v.impulso.tipo==='esquiva_tatica');
 assert.equal(v.taticaAvancada.visual.nome.startsWith('dodge_'),true);
 const old={x:v.x,y:v.y};
 mover(v,action,world,.1);
 assert.ok(Math.hypot(v.x-old.x,v.y-old.y)>.015,'esquiva desloca físicamente');
 assert.equal(ev(world,'tatico_esquiva','v').length,1);
 const sec=setup().world;
 const av=sec.porId.get('v'),foe=sec.porId.get('r');
 sec.t=4;foe.direcao=Math.PI;av.tatica={started:0};
 sec.sondagemTatica=()=>false;
 assert.notEqual(decidirTaticaAvancada(av,contact(av,foe,'preparo'),sec,bands,'territory',decision)?.estado,'esquivando');
 assert.equal(av.impulso??null,null,'não atravessa obstáculo nem força impulso');
});

test('resposta a finta: segundo Varrisco reage somente à telemetria visível',()=>{
 const {world,v,r}=setup();
 world.t=8;v.tatica={started:0};r.tatica={started:0};
 const fake=decidirTaticaAvancada(v,contact(v,r),world,bands,'hunt',decision);
 assert.equal(fake?.estado,'fintando');
 r.direcao=Math.PI;
 const seen=contact(r,v,sinalCombate(v,world.t+.2));
 world.t+=.2;
 const reaction=decidirTaticaAvancada(r,seen,world,bands,'territory',decision);
 assert.equal(reaction?.estado,'esquivando');
 assert.equal(r.golpe,null,'oponente não recebe ataque imaginário');
 assert.ok(ev(world,'tatico_esquiva','r').length>0);
});

test('lesões reais mudam escolhas, alcance tático e reação visual',()=>{
 const {world,v,r}=setup();
 world.t=10;v.tatica={started:0};
 const wound=ferir(v,{dano:88,regiao:'pernas',origem:'r',tipo:'garra_foice',t:10,idEvento:'fer-test'});
 registrarFerimentoAvancado(v,wound,world);
 assert.equal(v.taticaAvancada.visual.nome,'hurt_leg');
 assert.equal(ataquePermitido(v,{nome:'bote'}),false,'perna fraturada impede salto perigoso');
 const i=decidirTaticaAvancada(v,contact(v,r),world,bands,'territory',decision);
 assert.equal(i?.estado,'protegendo_ferida','IA protege lesão');
 assert.ok(ev(world,'tatico_protege_ferida','v').length>0);
 const head=ferir(v,{dano:14,regiao:'cabeca',origem:'r',tipo:'mordida',t:10,idEvento:'head'});
 registrarFerimentoAvancado(v,head,world);
 assert.equal(v.taticaAvancada.visual.nome,'hurt_head');
 assert.ok(v.saude.atordoadoAte>10);
});

test('combo só nasce de contato real e valida abertura/recarga/dano',()=>{
 const {world,v,r}=setup();
 world.t=5;v.direcao=0;
 registrarResultadoGolpe(v,r,{nome:'mordida'},world,{acertou:false});
 assert.equal(v.taticaAvancada.combo,null,'erro não gera combo');
 registrarResultadoGolpe(v,r,{nome:'mordida'},world,{acertou:true});
 assert.equal(v.taticaAvancada.combo.proximo,'garra_foice');
 const c=contact(v,r);assert.equal(comboPodeAtacar(v,c,world,bands),'garra_foice');
 registrarComboExecutado(v,r,'garra_foice',world);
 assert.equal(v.taticaAvancada.combo,null);
 assert.equal(ev(world,'tatico_combo_executado','v').length,1);
 registrarResultadoGolpe(v,r,{nome:'garra_foice'},world,{acertou:true});
 assert.equal(v.taticaAvancada.combo.proximo,'mordida');
 world.t=20;
 assert.equal(comboPodeAtacar(v,c,world,bands),null,'janela expira');
});

test('esquiva bem sucedida exige erro físico de um golpe real, e não invulnerabilidade',()=>{
 const {world,v,r}=setup();
 world.t=3; r.direcao=Math.PI;v.tatica={started:0};
 decidirTaticaAvancada(v,contact(v,r,'preparo'),world,bands,'territory',decision);
 const counted=registrarEsquivaEfetiva(v,r,world);
 assert.equal(counted,true);
 assert.equal(registrarEsquivaEfetiva(v,r,world),false,'um evento por janela');
 assert.equal(v.taticaAvancada.padroes.r.esquivamos,1);
 assert.equal(ev(world,'tatico_esquiva_real','v').length,1);
});

test('agarrão v05 disputa força/fadiga, presa solta no núcleo físico',()=>{
 const {world,v,r}=setup(true,[pred('v',55,55),prey('p',56.3,55)]);
 assert.equal(r.id,'p');
 world.t=1;
 v.agarrando=r.id;r.agarradoPor=v.id;
 iniciarAgarraoAvancado(v,r,world);
 assert.equal(v.taticaAvancada.visual.nome,'grab_start');
 assert.equal(ev(world,'tatico_agarrao_inicio','v').length,1);
 const prior=v.energia;
 atualizarAgarroes(world,.2);
 assert.ok(v.energia<prior,'contenção custa energia');
 assert.ok(ev(world,'tatico_disputa_agarrao','v').length>=1,'resistência física medida');
 v.energia=7;
 atualizarAgarroes(world,.1);
 assert.equal(v.agarrando,null);
 assert.equal(r.agarradoPor,null);
 assert.equal(v.taticaAvancada.visual.nome,'grab_release');
 assert.ok(ev(world,'tatico_agarrao_fim','v').length);
});

test('queda real exige levantar antes de voltar a atacar',()=>{
 const {world,v,r}=setup();
 world.t=5; v.tatica={started:0};
 v.saude.caidoAte=6.0;registrarQuedaAvancada(v,world);
 assert.equal(v.taticaAvancada.visual.nome,'fall');
 world.t=6.1;
 const intent=decidirTaticaAvancada(v,contact(v,r),world,bands,'hunt',decision);
 assert.equal(intent?.estado,'levantando');
 assert.equal(v.taticaAvancada.visual.nome,'get_up');
 world.t=6.6;
 assert.equal(decidirTaticaAvancada(v,contact(v,r),world,bands,'hunt',decision)?.estado,'levantando');
 assert.equal(v.golpe,null);
 assert.ok(ev(world,'tatico_levantou','v').length);
});

test('aprendizado de combate: observação parcial, memória limitada e persistente',()=>{
 const {world,v,r}=setup();
 world.t=12;
 observarAdversario(v,contact(v,r,'preparo'),world);
 assert.equal(padraoAdversario(v,'r',world.t).preparos,1);
 world.t=12.2;observarAdversario(v,contact(v,r,'guarda'),world);
 assert.equal(padraoAdversario(v,'r',world.t).preparosCurtos,1);
 world.t=12.3;observarAdversario(v,contact(v,r,'preparo'),world);
 world.t=12.4;observarAdversario(v,contact(v,r,'guarda'),world);
 assert.equal(padraoAdversario(v,'r',world.t).preparos,2);
 for(let k=0;k<12;k++)padraoAdversario(v,'rival-'+k,world.t+k*.1);
 assert.ok(Object.keys(v.taticaAvancada.padroes).length<=8);
 const restored=carregarMundo(world.config,salvarMundo(world));
 assert.deepEqual(restored.porId.get('v').taticaAvancada,v.taticaAvancada);
 assert.equal(habilitada(restored.porId.get('v')),true);
});

test('duas simulações com mesmas sementes e v05 repetem hash; sem regressão do ecossistema',()=>{
 const pop=[pred('v',55,55,{temperamento:{agressividade:.9,coragem:.9,medo:.05}}),
   pred('r',60,55,{temperamento:{agressividade:.85,coragem:.8,medo:.05}})];
 const a=setup(true,pop,9).world,b=setup(true,pop,9).world;
 for(let i=0;i<110;i++){passoEco(a);passoEco(b);}
 assert.equal(hashMundo(a),hashMundo(b));
 assert.equal(a.vivos.length,b.vivos.length);
 for(const actor of a.animais) {
   assert.ok(Number.isFinite(actor.x)&&Number.isFinite(actor.y)&&Number.isFinite(actor.energia));
   assert.ok(actor.energia>=0);
 }
 const restored=carregarMundo(a.config,salvarMundo(a));
 for(let i=0;i<70;i++){passoEco(a);passoEco(restored);}
 assert.equal(hashMundo(a),hashMundo(restored),'retomar combate não altera determinismo');
});

test('somente v04 habilitado: animais legados mantêm os mesmos contratos',()=>{
 const legacy=setup(false).world,a=legacy.porId.get('v');
 assert.equal(habilitada(a),false);
 const c=contact(a,legacy.porId.get('r'));
 assert.equal(decidirTaticaAvancada(a,c,legacy,bands,'hunt',decision),null);
 assert.equal(a.taticaAvancada,undefined);
 assert.equal(ataquePermitido(a,{nome:'bote'}),true);
 assert.equal(escolherAtaque(a,legacy.porId.get('r'),3,false)===null||typeof escolherAtaque(a,legacy.porId.get('r'),3,false)==='object',true);
});

test('aprendizado realmente reduz prioridade de ataque lento após erros observados',()=>{
 const {world,v,r}=setup();
 world.t=20;
 const slow={nome:'lento',dano:30,recargaSeg:1.2},fast={nome:'rapido',dano:20,recargaSeg:1};
 const beforeSlow=notaAtaqueAprendida(v,r,slow,.8);
 const beforeFast=notaAtaqueAprendida(v,r,fast,.2);
 assert.equal(beforeSlow,25);
 assert.equal(beforeFast,20);
 for(let k=0;k<5;k++) registrarResultadoGolpe(v,r,{nome:'mordida'},world,{acertou:false,esquivou:true});
 const afterSlow=notaAtaqueAprendida(v,r,slow,.8);
 const afterFast=notaAtaqueAprendida(v,r,fast,.2);
 assert.ok(afterSlow<beforeSlow,'adversario evasivo torna ataque lento menos atraente');
 assert.ok(afterSlow/afterFast<beforeSlow/beforeFast,'ordem relativa muda');
});

test('experiência com telegráficos curtos posterga a esquiva mas não a impede',()=>{
 const {world,v,r}=setup();
 v.tatica={started:0};r.direcao=Math.PI;
 world.t=10;
 const memory=padraoAdversario(v,'r',10);
 memory.preparos=6;memory.preparosCurtos=5;
 let c=contact(v,r,'preparo');
 assert.notEqual(decidirTaticaAvancada(v,c,world,bands,'territory',decision)?.estado,'esquivando',
   'suspeita de finta evita esquiva instantânea');
 world.t=10.3;c=contact(v,r,'preparo');
 const action=decidirTaticaAvancada(v,c,world,bands,'territory',decision);
 assert.equal(action?.estado,'esquivando','mantém defesa após preparo persistente');
});

test('queda bloqueia movimento e golpes até levantar mesmo sem alvo visível',()=>{
 const {world,v,r}=setup();
 world.t=5;
 registrarQuedaAvancada(v,world);
 v.saude.caidoAte=5.1;
 world.t=5.3;
 const action=recuperarQuedaAvancada(v,world);
 assert.equal(action?.estado,'levantando');
 assert.equal(v.taticaAvancada.visual.nome,'get_up');
 assert.equal(escolherAtaque(v,r,3,false),null,'não ataca durante levantamento');
 world.t=7.2;
 assert.equal(recuperarQuedaAvancada(v,world),null);
});

test('morte libera agarrador e vítima, sem ficar preso em mundo salvo',()=>{
 const {world,v,r}=setup(true,[pred('v',55,55),prey('p',56,55)]);
 v.agarrando='p';r.agarradoPor='v';iniciarAgarraoAvancado(v,r,world);
 world.matar(v,'combate','p');
 assert.equal(r.agarradoPor,null);
 assert.equal(v.agarrando,null);
 assert.equal(v.taticaAvancada.agarrando,null);
 const s=salvarMundo(world),restored=carregarMundo(world.config,s);
 assert.equal(restored.porId.get('p').agarradoPor,null);
});
