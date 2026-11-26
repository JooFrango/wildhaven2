import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB,cenarioDuelo,mundoDuelo,doisHunters} from './ajudantes.mjs';
import {menteJogador,atualizarRitmo,decidirComoJogador,escolherSequencia,registrarCombateJogador} from '../src/combate-jogador.js';
import {decidirHunter} from '../src/cerebro-hunter.js';
import {salvarMundoHunters,carregarMundoHunters,passoHunters} from '../src/mundo-hunters.js';
const setup=(weapon='espada',dist=1.5)=>{const c=cenarioDuelo('ritmo',doisHunters({arma:weapon},{arma:'espada'},{dist})),m=mundoDuelo(c,17),[a,b]=m.hunters;return{m,a,b,c};};
const contact=b=>({id:b.id,especie:'hunter',via:'visao',x:b.x,y:b.y,direcao:b.direcao,velocidade:0,signal:'guarda',human:true,distancia:1.5,body:{r:.26,half:0,center:0,height:1.75}});

test('um erro com chain zerada deixa de bloquear o Hunter para sempre',()=>{
 const {m,a,b}=setup('espada',1.3),s=menteJogador(a),c=contact(b);m.t=5;s.chain=0;s.lastAttack=0;s.lastResult='miss';
 const exit=decidirComoJogador(a,c,b,m);assert.ok(['recuando','defendendo'].includes(exit.estado));assert.equal(a.golpe,null);
 m.t=6;a.velocidade=0;const attack=decidirComoJogador(a,c,b,m);assert.equal(attack.estado,'preparando_ataque');assert.ok(a.golpe);assert.equal(s.lastResult,null);
});

test('erro exige recuperação e saída, sem teleportar nem iniciar outro golpe',()=>{
 const {m,a,b}=setup(),s=menteJogador(a),c=contact(b);m.t=1;a.hunter.action={name:'sword_heavy',start:0,impact:.6,end:1.4,heading:0,cancelAfter:1.2};
 registrarCombateJogador(m,[{tipo:'golpe_errou',id:a.id,t:1}]);const before={x:a.x,y:a.y};
 assert.ok(s.failureUntil>1.4);m.t=1.45;const i=decidirComoJogador(a,c,b,m);assert.equal(i.estado,'recuando');assert.ok(i.destino);assert.equal(a.golpe,null);assert.deepEqual({x:a.x,y:a.y},before);
});

test('a cadeia de montante permanece disponível após uma recuperação maior que dois segundos',()=>{
 const {a}=setup('montante'),s=menteJogador(a);a.hunter.personalidade.agressividade=.95;s.chain=1;s.lastAttack=0;s.chainUntil=3.1;
 const next=escolherSequencia(a,{}, {skill:.8,window:2.5},2.5);assert.ok(next);assert.equal(next.index,1);
 const expired=escolherSequencia(a,{}, {skill:.8,window:2.5},3.2);assert.ok(expired);assert.equal(expired.index,0);
});

test('golpe pesado freia o deslocamento e firma apoio antes de começar',()=>{
 const {m,a,b}=setup('montante'),c={...contact(b),signal:'caido'};a.velocidade=1.3;a.hunter.habilidade=.95;
 const preparing=decidirComoJogador(a,c,b,m);assert.equal(preparing.estado,'avaliando');assert.equal(preparing.destino,null);assert.equal(a.golpe,null);
 m.t=.2;a.velocidade=0;decidirComoJogador(a,c,b,m);assert.ok(a.golpe);assert.ok(a.hunter.action.name.includes('heavy'));
});

test('falta de progresso muda a abordagem, sem exigir atributo oculto do adversário',()=>{
 const {m,a,b}=setup('espada',8),s=menteJogador(a),raw=contact(b),c=new Proxy(raw,{get(o,k){if(['saude','energia','intencao','rngCombate'].includes(k))throw Error('leitura oculta');return o[k];}});
 s.side=1;atualizarRitmo(a,c,m);m.t=3.6;atualizarRitmo(a,c,m);assert.equal(s.side,-1);assert.equal(s.goal,'flanco');assert.ok(s.directApproachUntil>m.t);assert.equal(m.eventos.filter(e=>e.tipo==='hunter_reavaliacao').length,1);
 m.t=3.7;atualizarRitmo(a,c,m);assert.equal(m.eventos.filter(e=>e.tipo==='hunter_reavaliacao').length,1);
});

test('recuperação deliberada de fôlego não conta como aproximação travada',()=>{
 const {m,a,b}=setup('espada',8),s=menteJogador(a);s.regaining=true;s.side=1;atualizarRitmo(a,contact(b),m);m.t=10;atualizarRitmo(a,contact(b),m);assert.equal(s.side,1);assert.equal(m.eventos.filter(e=>e.tipo==='hunter_reavaliacao').length,0);
});

test('sobrevivência não apaga compromisso de um golpe ainda em preparo',()=>{
 const {m,a,b}=setup(),c=contact(b);a.contatos=[c];a.hunter.personalidade.cautela=1;a.hunter.personalidade.agressividade=.2;a.temperamento.coragem=.1;a.saude.hp=a.saude.hpMax*.4;
 a.golpe={nome:'golpe_corte_pesado',inicio:0,impacto:1};a.hunter.action={start:0,impact:1,end:2,cancelAfter:1.6,heading:a.direcao};m.t=.1;
 const i=decidirHunter(a,m);assert.equal(i.estado,'preparando_ataque');assert.equal(i.destino,null);assert.ok(a.golpe);
});

test('memória de erro e de progresso é persistida sem mudar a reprodução posterior',()=>{
 const {m,a,b,c}=setup();m.t=1;menteJogador(a).lastAttack=0;registrarCombateJogador(m,[{tipo:'golpe_errou',id:a.id,t:1}]);atualizarRitmo(a,contact(b),m);
 const cfg={...LAB.cfg,cenarios:{...LAB.cfg.cenarios,[c.id]:c}},r=carregarMundoHunters(cfg,JSON.parse(JSON.stringify(salvarMundoHunters(m))),LAB);
 for(let i=0;i<100;i++){passoHunters(m);passoHunters(r);}assert.deepEqual(salvarMundoHunters(m),salvarMundoHunters(r));
});
