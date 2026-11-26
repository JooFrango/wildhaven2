import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB,cenarioDuelo,mundoDuelo,doisHunters} from './ajudantes.mjs';
import {passoHunters,enfileirarComando,salvarMundoHunters,carregarMundoHunters,instalarGeometria} from '../src/mundo-hunters.js';
import {data} from '../../hunters-codex/scripts/data-node.mjs';
function setup(){const c=cenarioDuelo('bridge',doisHunters({arma:'lanca'},{arma:'espada'}));return{c,m:mundoDuelo(c,17)};}
test('portabilidade: fila futura, equipamento e atributos persistem sem repetir impactos',()=>{
 const {m,c}=setup();for(let i=0;i<30;i++)passoHunters(m);
 enfileirarComando(m,'equipamento','hunter-A',{arma:'espada',escudo:'escudo',armadura:'pesada'},m.tick+8);
 enfileirarComando(m,'personalidade','hunter-A',{agressividade:.9,disciplina:.8},m.tick+9);
 enfileirarComando(m,'atributos','hunter-A',{forca:1.3},m.tick+9);
 const save=JSON.parse(JSON.stringify(salvarMundoHunters(m))),cfg={...LAB.cfg,cenarios:{...LAB.cfg.cenarios,[c.id]:c}},r=carregarMundoHunters(cfg,save,LAB);
 assert.equal(m.hunters[0].hunter.equipamento.arma,'lanca');
 for(let i=0;i<160;i++){passoHunters(m);passoHunters(r);}
 assert.equal(m.hunters[0].hunter.equipamento.arma,'espada');assert.equal(m.hunters[0].atributos.forca,1.3);
 assert.deepEqual(salvarMundoHunters(m),salvarMundoHunters(r));
});
test('portabilidade: esquiva manual desloca o corpo e cobra energia',()=>{
 const {m}=setup(),a=m.hunters[0];for(let i=0;i<4;i++)passoHunters(m);
 enfileirarComando(m,'manual',a.id,{on:true});enfileirarComando(m,'input',a.id,{esquivar:true});const p={x:a.x,y:a.y},energy=a.energia;
 for(let i=0;i<8;i++)passoHunters(m);
 assert.ok(m.eventos.some(e=>e.tipo==='esquiva'&&e.id===a.id));assert.ok(Math.hypot(a.x-p.x,a.y-p.y)>.1);assert.ok(a.energia<energy);
});
test('portabilidade: geometria precisa usa o mesmo contrato de colisão do Codex e sobrevive ao save',()=>{
 const {m,c}=setup();instalarGeometria(m,data.geometry);
 assert.equal(m.sondagemTatica(m.hunters[0],{x:-4,y:-4}),false);
 const r=carregarMundoHunters({...LAB.cfg,cenarios:{[c.id]:c}},JSON.parse(JSON.stringify(salvarMundoHunters(m))),LAB);
 assert.ok(r.geometriaHunter);assert.equal(r.sondagemTatica(r.hunters[0],{x:-4,y:-4}),false);
});
